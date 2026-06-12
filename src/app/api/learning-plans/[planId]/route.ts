import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromHeaders } from '@/lib/auth/api-auth';
import { pgQuery, pgExecute } from '@/storage/database/pg-client';

/**
 * PUT /api/learning-plans/[planId] — 编辑单个任务
 * DELETE /api/learning-plans/[planId] — 删除单个任务
 * POST /api/learning-plans/[planId]?action=complete — 标记完成
 * POST /api/learning-plans/[planId]?action=skip — 跳过任务
 * POST /api/learning-plans/[planId]?action=reorder — 调整顺序
 */

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  const auth = getAuthFromHeaders(request);
  if (!auth) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { planId } = await params;
  const body = await request.json();

  // 获取修改前的快照
  const before = await pgQuery(
    `SELECT * FROM learning_plans WHERE id = $1`,
    [parseInt(planId)]
  );
  if (!before || before.length === 0) {
    return NextResponse.json({ error: '计划不存在' }, { status: 404 });
  }

  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  let idx = 1;

  for (const [key, val] of Object.entries(body)) {
    const colMap: Record<string, string> = {
      title: 'title',
      purpose: 'purpose',
      problemSolved: 'problem_solved',
      learningForm: 'learning_form',
      verificationStandard: 'verification_standard',
      scheduledDate: 'scheduled_date',
      deadline: 'deadline',
      dayNumber: 'day_number',
      sortOrder: 'sort_order',
    };
    const col = colMap[key];
    if (col) {
      fields.push(`${col} = $${idx}`);
      values.push(val as string | number | null);
      idx++;
    }
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: '无可更新字段' }, { status: 400 });
  }

  values.push(parseInt(planId));
  const updated = await pgQuery(
    `UPDATE learning_plans SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
    values
  );

  // 记录编辑日志
  await pgExecute(
    `INSERT INTO learning_plan_edit_logs (plan_id, edited_by, action, before_snapshot, after_snapshot)
     VALUES ($1, $2, 'update', $3, $4)`,
    [parseInt(planId), auth.userId, JSON.stringify(before[0]), JSON.stringify(updated[0])]
  );

  return NextResponse.json({ success: true, plan: updated[0] });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  const auth = getAuthFromHeaders(request);
  if (!auth) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { planId } = await params;

  const before = await pgQuery(
    `SELECT * FROM learning_plans WHERE id = $1`,
    [parseInt(planId)]
  );
  if (!before || before.length === 0) {
    return NextResponse.json({ error: '计划不存在' }, { status: 404 });
  }

  // 先删关联的编辑日志（外键约束），再删计划本身
  await pgExecute(`DELETE FROM learning_plan_edit_logs WHERE plan_id = $1`, [parseInt(planId)]);
  await pgExecute(`DELETE FROM learning_plans WHERE id = $1`, [parseInt(planId)]);

  return NextResponse.json({ success: true });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  const auth = getAuthFromHeaders(request);
  if (!auth) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { planId } = await params;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'complete';

  if (action === 'complete') {
    return handleComplete(parseInt(planId), auth.userId);
  }
  if (action === 'skip') {
    return handleSkip(parseInt(planId), auth.userId);
  }
  if (action === 'reorder') {
    return handleReorder(request, parseInt(planId), auth.userId);
  }

  return NextResponse.json({ error: '未知操作' }, { status: 400 });
}

async function handleComplete(planId: number, userId: string) {
  const before = await pgQuery(`SELECT * FROM learning_plans WHERE id = $1`, [planId]);
  if (!before || before.length === 0) {
    return NextResponse.json({ error: '计划不存在' }, { status: 404 });
  }

  const updated = await pgQuery(
    `UPDATE learning_plans SET status = 'completed', completed_at = NOW(), updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [planId]
  );

  await pgExecute(
    `INSERT INTO learning_plan_edit_logs (plan_id, edited_by, action, before_snapshot, after_snapshot)
     VALUES ($1, $2, 'complete', $3, $4)`,
    [planId, userId, JSON.stringify(before[0]), JSON.stringify(updated[0])]
  );

  return NextResponse.json({ success: true, plan: updated[0] });
}

async function handleSkip(planId: number, userId: string) {
  const before = await pgQuery(`SELECT * FROM learning_plans WHERE id = $1`, [planId]);
  if (!before || before.length === 0) {
    return NextResponse.json({ error: '计划不存在' }, { status: 404 });
  }

  const updated = await pgQuery(
    `UPDATE learning_plans SET status = 'skipped', updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [planId]
  );

  await pgExecute(
    `INSERT INTO learning_plan_edit_logs (plan_id, edited_by, action, before_snapshot, after_snapshot)
     VALUES ($1, $2, 'skip', $3, $4)`,
    [planId, userId, JSON.stringify(before[0]), JSON.stringify(updated[0])]
  );

  return NextResponse.json({ success: true, plan: updated[0] });
}

async function handleReorder(request: NextRequest, planId: number, userId: string) {
  const body = await request.json();
  const { newSortOrder } = body;

  if (newSortOrder === undefined) {
    return NextResponse.json({ error: '缺少 newSortOrder' }, { status: 400 });
  }

  const before = await pgQuery(`SELECT * FROM learning_plans WHERE id = $1`, [planId]);
  if (!before || before.length === 0) {
    return NextResponse.json({ error: '计划不存在' }, { status: 404 });
  }

  const updated = await pgQuery(
    `UPDATE learning_plans SET sort_order = $1, updated_at = NOW()
     WHERE id = $2 RETURNING *`,
    [newSortOrder, planId]
  );

  await pgExecute(
    `INSERT INTO learning_plan_edit_logs (plan_id, edited_by, action, before_snapshot, after_snapshot)
     VALUES ($1, $2, 'reorder', $3, $4)`,
    [planId, userId, JSON.stringify(before[0]), JSON.stringify(updated[0])]
  );

  return NextResponse.json({ success: true, plan: updated[0] });
}
