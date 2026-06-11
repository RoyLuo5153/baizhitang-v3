import { NextRequest, NextResponse } from 'next/server';
import { pgQuery } from '@/storage/database/pg-client';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { checkAndTransitionStage } from '@/lib/stage-engine';

/**
 * GET /api/stage-transitions
 * 查询阶段转换记录
 * 支持参数: userId, fromStage, toStage, startDate, endDate, limit
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const fromStage = searchParams.get('fromStage');
    const toStage = searchParams.get('toStage');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    let sql = `
      SELECT 
        st.id, st.user_id, st.from_stage, st.to_stage, 
        st.rule_id, st.triggered_by, st.created_at,
        u.real_name as user_name,
        sr.description as rule_description
      FROM stage_transitions st
      LEFT JOIN users u ON st.user_id = u.id
      LEFT JOIN stage_rules sr ON st.rule_id = sr.id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramIdx = 1;

    if (userId) {
      sql += ` AND st.user_id = $${paramIdx++}`;
      params.push(userId);
    }
    if (fromStage) {
      sql += ` AND st.from_stage = $${paramIdx++}`;
      params.push(parseInt(fromStage));
    }
    if (toStage) {
      sql += ` AND st.to_stage = $${paramIdx++}`;
      params.push(parseInt(toStage));
    }
    if (startDate) {
      sql += ` AND st.created_at >= $${paramIdx++}`;
      params.push(startDate);
    }
    if (endDate) {
      sql += ` AND st.created_at <= $${paramIdx++}`;
      params.push(endDate);
    }

    sql += ` ORDER BY st.created_at DESC LIMIT $${paramIdx}`;
    params.push(limit);

    const result = await pgQuery(sql, params);

    return NextResponse.json({
      transitions: result,
      count: result.length,
    });
  } catch (error) {
    console.error('Stage transitions query error:', error);
    return NextResponse.json(
      { error: '查询阶段转换记录失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/stage-transitions
 * 手动触发阶段转换检查
 * Body: { userId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: '缺少 userId 参数' },
        { status: 400 }
      );
    }

    // 验证用户存在
    const client = getSupabaseClient();
    const { data: user, error: userError } = await client
      .from('users')
      .select('id, stage, real_name, role_id')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !user) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    // 执行阶段转换检查
    const result = await checkAndTransitionStage(userId);

    return NextResponse.json({
      ...result,
      userName: user.real_name,
    });
  } catch (error) {
    console.error('Stage transition trigger error:', error);
    return NextResponse.json(
      { error: '触发阶段转换失败' },
      { status: 500 }
    );
  }
}
