import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const dynamic = 'force-dynamic';

const STAGE_NAMES: Record<number, string> = {
  1: '理论基础',
  2: '实战演练',
  3: '综合达标',
};

// Fallback if DB doesn't have learning_levels
const FALLBACK_NAMES: Record<number, { name: string; stage: number }> = {
  1:  { name: '初心启航', stage: 1 },
  2:  { name: '角色认知', stage: 1 },
  3:  { name: '糖尿病基础', stage: 1 },
  4:  { name: '血糖监测原理', stage: 1 },
  5:  { name: '药物分类认知', stage: 1 },
  6:  { name: '营养饮食指导', stage: 1 },
  7:  { name: '并发症预防', stage: 1 },
  8:  { name: '首诊话术实训', stage: 2 },
  9:  { name: '加微承接话术', stage: 2 },
  10: { name: '用药关怀话术', stage: 2 },
  11: { name: '实战话术演练', stage: 2 },
  12: { name: '复诊邀约话术', stage: 2 },
  13: { name: '续方确认话术', stage: 2 },
  14: { name: '综合实战考核', stage: 2 },
  15: { name: '全流程模拟', stage: 3 },
  16: { name: '紧急情况应对', stage: 3 },
  17: { name: '患者异议处理', stage: 3 },
  18: { name: '服务质量达标', stage: 3 },
  19: { name: '业务指标达标', stage: 3 },
  20: { name: '独立接诊验证', stage: 3 },
  21: { name: '综合能力达标', stage: 3 },
};

const PASSING_SCORE = 80;

// GET /api/learning - 获取关卡列表和进度
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  // Get level definitions from DB (editable by training manager)
  const { data: dbLevels } = await client
    .from('learning_levels')
    .select('level_id, name, stage, is_active, sort_order, description')
    .order('level_id');

  // Build level info map, fall back to hardcoded if DB is empty
  const levelInfoMap: Record<number, { name: string; stage: number; isActive: boolean; description?: string }> = {};
  if (dbLevels && dbLevels.length > 0) {
    for (const dl of dbLevels) {
      levelInfoMap[dl.level_id] = {
        name: dl.name,
        stage: dl.stage,
        isActive: dl.is_active,
        description: dl.description,
      };
    }
  } else {
    for (const [id, info] of Object.entries(FALLBACK_NAMES)) {
      levelInfoMap[Number(id)] = { name: info.name, stage: info.stage, isActive: true };
    }
  }

  // 获取用户进度
  const { data: progress, error: progressError } = await client
    .from('level_progress')
    .select('*')
    .eq('user_id', userId);

  if (progressError) {
    return NextResponse.json({ error: progressError.message }, { status: 500 });
  }

  // 获取各关卡题目统计
  const { data: questionStats, error: qError } = await client
    .from('questions')
    .select('level_id, question_type')
    .eq('is_active', true)
    .in('level_id', Array.from({ length: 21 }, (_, i) => i + 1));

  if (qError) {
    return NextResponse.json({ error: qError.message }, { status: 500 });
  }

  // 统计各关卡题型分布
  const levelQuestionMap: Record<number, { single: number; multi: number; tf: number; essay: number; total: number }> = {};
  for (const q of (questionStats || []) as Array<{ level_id: number; question_type: string }>) {
    if (!levelQuestionMap[q.level_id]) {
      levelQuestionMap[q.level_id] = { single: 0, multi: 0, tf: 0, essay: 0, total: 0 };
    }
    const map = levelQuestionMap[q.level_id];
    map.total++;
    if (q.question_type === 'single_choice') map.single++;
    else if (q.question_type === 'multiple_choice') map.multi++;
    else if (q.question_type === 'true_false') map.tf++;
    else if (q.question_type === 'essay') map.essay++;
  }

  // 构建进度map
  const progressMap: Record<number, Record<string, unknown>> = {};
  for (const p of (progress || []) as Array<Record<string, unknown>>) {
    progressMap[p.level_id as number] = p;
  }

  // 确定关卡状态
  let maxPassedLevel = 0;
  for (const p of (progress || []) as Array<Record<string, unknown>>) {
    if (p.status === 'passed' && (p.level_id as number) > maxPassedLevel) {
      maxPassedLevel = p.level_id as number;
    }
  }

  const stage1Complete = maxPassedLevel >= 7;
  const stage2Complete = maxPassedLevel >= 14;

  const levels = [];
  for (let i = 1; i <= 21; i++) {
    const info = levelInfoMap[i];
    if (!info) continue;

    const p = progressMap[i];
    const stats = levelQuestionMap[i] || { single: 0, multi: 0, tf: 0, essay: 0, total: 0 };

    let status: string;
    if (!info.isActive) {
      status = 'disabled';
    } else if (p?.status === 'passed') {
      status = 'passed';
    } else if (info.stage === 3 && !stage2Complete) {
      status = 'locked-stage';
    } else if (i <= maxPassedLevel + 1) {
      status = p?.status === 'in_progress' ? 'in_progress' : (i === maxPassedLevel + 1 ? 'active' : 'locked');
    } else {
      status = 'locked';
    }

    levels.push({
      levelId: i,
      name: info.name,
      stage: info.stage,
      stageName: STAGE_NAMES[info.stage] || '未知阶段',
      status,
      bestScore: (p?.best_score as number) ?? null,
      attempts: (p?.attempts as number) ?? 0,
      lastAttemptAt: (p?.last_attempt_at as string) ?? null,
      passedAt: (p?.passed_at as string) ?? null,
      questionStats: stats,
      description: info.description || '',
    });
  }

  const stageProgress = {
    1: { completed: levels.filter(l => l.stage === 1 && l.status === 'passed').length, total: 7 },
    2: { completed: levels.filter(l => l.stage === 2 && l.status === 'passed').length, total: 7 },
    3: { completed: levels.filter(l => l.stage === 3 && l.status === 'passed').length, total: 7 },
  };

  return NextResponse.json({
    levels,
    stageProgress,
    totalPassed: levels.filter(l => l.status === 'passed').length,
    totalLevels: 21,
  });
}

// PUT /api/learning - 更新关卡配置（培训负责人用）
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { levelId, name, description, isActive } = body;

    if (!levelId) {
      return NextResponse.json({ error: 'Missing levelId' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.is_active = isActive;

    const { error } = await supabase
      .from('learning_levels')
      .update(updateData)
      .eq('level_id', levelId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
