import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export const dynamic = 'force-dynamic';

// 关卡名称和阶段映射
const LEVEL_NAMES: Record<number, { name: string; stage: number; stageName: string }> = {
  1:  { name: '初心启航', stage: 1, stageName: '理论基础' },
  2:  { name: '角色认知', stage: 1, stageName: '理论基础' },
  3:  { name: '糖尿病基础', stage: 1, stageName: '理论基础' },
  4:  { name: '血糖监测原理', stage: 1, stageName: '理论基础' },
  5:  { name: '药物分类认知', stage: 1, stageName: '理论基础' },
  6:  { name: '营养饮食指导', stage: 1, stageName: '理论基础' },
  7:  { name: '并发症预防', stage: 1, stageName: '理论基础' },
  8:  { name: '首诊话术实训', stage: 2, stageName: '实战演练' },
  9:  { name: '加微承接话术', stage: 2, stageName: '实战演练' },
  10: { name: '用药关怀话术', stage: 2, stageName: '实战演练' },
  11: { name: '实战话术演练', stage: 2, stageName: '实战演练' },
  12: { name: '复诊邀约话术', stage: 2, stageName: '实战演练' },
  13: { name: '续方确认话术', stage: 2, stageName: '实战演练' },
  14: { name: '综合实战考核', stage: 2, stageName: '实战演练' },
  15: { name: '全流程模拟', stage: 3, stageName: '综合达标' },
  16: { name: '紧急情况应对', stage: 3, stageName: '综合达标' },
  17: { name: '患者异议处理', stage: 3, stageName: '综合达标' },
  18: { name: '服务质量达标', stage: 3, stageName: '综合达标' },
  19: { name: '业务指标达标', stage: 3, stageName: '综合达标' },
  20: { name: '独立接诊验证', stage: 3, stageName: '综合达标' },
  21: { name: '综合能力达标', stage: 3, stageName: '综合达标' },
};

const PASSING_SCORE = 80;

// GET /api/learning - 获取关卡列表和进度
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const client = getSupabaseClient(token);

  // 从JWT获取用户ID（暂时用query param）
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
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
  for (const q of questionStats || []) {
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
  const progressMap: Record<number, any> = {};
  for (const p of progress || []) {
    progressMap[p.level_id] = p;
  }

  // 确定关卡状态
  const levels = [];
  let maxPassedLevel = 0;
  for (const p of progress || []) {
    if (p.status === 'passed' && p.level_id > maxPassedLevel) {
      maxPassedLevel = p.level_id;
    }
  }

  // 检查阶段解锁
  const stage1Complete = maxPassedLevel >= 7;
  const stage2Complete = maxPassedLevel >= 14;

  for (let i = 1; i <= 21; i++) {
    const info = LEVEL_NAMES[i];
    if (!info) continue;

    const p = progressMap[i];
    const stats = levelQuestionMap[i] || { single: 0, multi: 0, tf: 0, essay: 0, total: 0 };

    let status: string;
    if (p?.status === 'passed') {
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
      stageName: info.stageName,
      status,
      bestScore: p?.best_score ?? null,
      attempts: p?.attempts ?? 0,
      lastAttemptAt: p?.last_attempt_at ?? null,
      passedAt: p?.passed_at ?? null,
      questionStats: stats,
    });
  }

  // 计算阶段进度
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
