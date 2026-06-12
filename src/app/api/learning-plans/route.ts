import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromHeaders } from '@/lib/auth/api-auth';
import { pgQuery, pgExecute, pgInsert } from '@/storage/database/pg-client';
import { generateLearningPlan, reschedulePlans } from '@/lib/learning-path-engine';

/**
 * GET /api/learning-plans?userId=xxx — 查询某人的学习计划
 * POST /api/learning-plans?action=generate — 手动触发生成计划
 * POST /api/learning-plans?action=add — 手动添加任务
 * POST /api/learning-plans?action=reschedule — 批量重排日期
 */

export async function GET(request: NextRequest) {
  const auth = getAuthFromHeaders(request);
  if (!auth) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: '缺少 userId 参数' }, { status: 400 });
  }

  const plans = await pgQuery(
    `SELECT * FROM learning_plans WHERE user_id = $1 ORDER BY day_number, sort_order`,
    [userId]
  );

  return NextResponse.json({ plans });
}

export async function POST(request: NextRequest) {
  const auth = getAuthFromHeaders(request);
  if (!auth) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'generate';

  if (action === 'generate') {
    return handleGenerate(request, auth.userId);
  }
  if (action === 'add') {
    return handleAdd(request, auth.userId);
  }
  if (action === 'reschedule') {
    return handleReschedule(request, auth.userId);
  }

  return NextResponse.json({ error: '未知操作' }, { status: 400 });
}

async function handleGenerate(request: NextRequest, operatorId: string) {
  const body = await request.json();
  const { userId } = body;

  if (!userId) {
    return NextResponse.json({ error: '缺少 userId' }, { status: 400 });
  }

  try {
    const plans = await generateLearningPlan(userId);
    return NextResponse.json({ success: true, plans });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

async function handleAdd(request: NextRequest, operatorId: string) {
  const body = await request.json();
  const { userId, dayNumber, title, purpose, problemSolved, learningForm, verificationStandard, scheduledDate, deadline, sortOrder } = body;

  if (!userId || !title || !purpose || !scheduledDate) {
    return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
  }

  const plan = await pgInsert(
    `INSERT INTO learning_plans (user_id, day_number, title, purpose, problem_solved, learning_form, verification_standard, scheduled_date, deadline, status, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10)
     RETURNING *`,
    [userId, dayNumber || 0, title, purpose, problemSolved || null, learningForm || null, verificationStandard || null, scheduledDate, deadline || null, sortOrder || 0]
  );

  // 记录编辑日志
  await pgExecute(
    `INSERT INTO learning_plan_edit_logs (plan_id, edited_by, action, after_snapshot)
     VALUES ($1, $2, 'create', $3)`,
    [plan.id, operatorId, JSON.stringify(plan)]
  );

  return NextResponse.json({ success: true, plan });
}

async function handleReschedule(request: NextRequest, operatorId: string) {
  const body = await request.json();
  const { userId, newStartDate } = body;

  if (!userId || !newStartDate) {
    return NextResponse.json({ error: '缺少 userId 或 newStartDate' }, { status: 400 });
  }

  await reschedulePlans(userId, new Date(newStartDate), operatorId);
  return NextResponse.json({ success: true });
}
