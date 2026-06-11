import { NextRequest, NextResponse } from 'next/server';
import { pgQuery, pgInsert } from '@/storage/database/pg-client';

export const dynamic = 'force-dynamic';

// GET /api/action-scores - 查询评分记录
// 查询参数: recordId, actionNo, perspective, userId(通过qc_records关联), stats
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '') || undefined;

  const { searchParams } = new URL(request.url);
  const recordId = searchParams.get('recordId');
  const actionNo = searchParams.get('actionNo');
  const perspective = searchParams.get('perspective');
  const userId = searchParams.get('userId');
  const stats = searchParams.get('stats') === 'true';

  // 统计模式：按动作计算达标率
  if (stats && userId) {
    return handleStats(userId);
  }

  // 构建查询条件
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (recordId) {
    conditions.push(`as1.record_id = $${paramIdx}`);
    params.push(recordId);
    paramIdx++;
  }
  if (actionNo) {
    conditions.push(`as1.action_no = $${paramIdx}`);
    params.push(Number(actionNo));
    paramIdx++;
  }
  if (perspective) {
    conditions.push(`as1.perspective = $${paramIdx}`);
    params.push(perspective);
    paramIdx++;
  }
  if (userId && !recordId) {
    conditions.push(`qr.user_id = $${paramIdx}`);
    params.push(userId);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT as1.*, ca.action_name, ca.node_id, ca.trust_element
    FROM action_scores as1
    LEFT JOIN core_actions ca ON as1.action_no = ca.action_no
    LEFT JOIN qc_records qr ON as1.record_id = qr.id
    ${whereClause}
    ORDER BY as1.created_at DESC
    LIMIT 200
  `;

  try {
    const scores = await pgQuery(sql, params);
    return NextResponse.json({
      scores,
      total: scores.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '查询失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/action-scores - 提交评分（支持批量）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 批量提交模式
    if (Array.isArray(body.scores)) {
      return handleBatchSubmit(body);
    }

    // 单条提交模式
    const { recordId, actionNo, score, perspective, executed, executionForm, notes } = body;

    if (!recordId || actionNo === undefined || score === undefined) {
      return NextResponse.json({ error: '缺少必要参数(recordId, actionNo, score)' }, { status: 400 });
    }

    if (![0, 2, 3, 4, 5].includes(score)) {
      return NextResponse.json({ error: '评分必须为0/2/3/4/5' }, { status: 400 });
    }

    if (!['high_level', 'assistant', 'patient'].includes(perspective)) {
      return NextResponse.json({ error: 'perspective必须为high_level/assistant/patient' }, { status: 400 });
    }

    // Upsert
    const sql = `
      INSERT INTO action_scores (record_id, action_no, score, perspective, executed, execution_form, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (record_id, action_no, perspective)
      DO UPDATE SET score = EXCLUDED.score, executed = EXCLUDED.executed, 
                    execution_form = EXCLUDED.execution_form, notes = EXCLUDED.notes
      RETURNING *
    `;

    const result = await pgInsert(sql, [
      recordId, actionNo, score, perspective,
      executed !== undefined ? executed : true,
      executionForm || null,
      notes || null,
    ]);

    return NextResponse.json({ success: true, scoreRecord: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : '请求格式错误';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// 批量提交
async function handleBatchSubmit(body: { recordId: string; scores: Array<{ actionNo: number; score: number; perspective: string; executed?: boolean; executionForm?: string; notes?: string }> }) {
  const { recordId, scores } = body;

  if (!recordId || !Array.isArray(scores) || scores.length === 0) {
    return NextResponse.json({ error: '缺少必要参数(recordId, scores[])' }, { status: 400 });
  }

  // 校验每条评分
  for (const s of scores) {
    if (s.actionNo === undefined || s.score === undefined || !s.perspective) {
      return NextResponse.json({ error: '评分记录缺少必要字段(actionNo/score/perspective)' }, { status: 400 });
    }
    if (![0, 2, 3, 4, 5].includes(s.score)) {
      return NextResponse.json({ error: `动作${s.actionNo}评分必须为0/2/3/4/5` }, { status: 400 });
    }
    if (!['high_level', 'assistant', 'patient'].includes(s.perspective)) {
      return NextResponse.json({ error: `动作${s.actionNo} perspective必须为high_level/assistant/patient` }, { status: 400 });
    }
  }

  // 逐条upsert
  const results: Record<string, unknown>[] = [];
  for (const s of scores) {
    const sql = `
      INSERT INTO action_scores (record_id, action_no, score, perspective, executed, execution_form, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (record_id, action_no, perspective)
      DO UPDATE SET score = EXCLUDED.score, executed = EXCLUDED.executed,
                    execution_form = EXCLUDED.execution_form, notes = EXCLUDED.notes
      RETURNING *
    `;
    const row = await pgInsert(sql, [
      recordId, s.actionNo, s.score, s.perspective,
      s.executed !== undefined ? s.executed : true,
      s.executionForm || null,
      s.notes || null,
    ]);
    results.push(row);
  }

  return NextResponse.json({ success: true, count: results.length, scoreRecords: results });
}

// 统计模式：计算每个动作的达标率
async function handleStats(userId: string) {
  // 获取用户的质检记录ID
  const qcSql = `SELECT id FROM qc_records WHERE user_id = $1`;
  const qcRecords = await pgQuery<{ id: string }>(qcSql, [userId]);
  const recordIds = qcRecords.map(r => r.id);

  if (recordIds.length === 0) {
    return NextResponse.json({ stats: [], overall: { passRate: 0, avgScore: 0 } });
  }

  // 查询该用户所有评分
  const placeholders = recordIds.map((_, i) => `$${i + 1}`).join(',');
  const scoresSql = `
    SELECT action_no, score, perspective, executed
    FROM action_scores
    WHERE record_id IN (${placeholders})
  `;
  const scores = await pgQuery<{ action_no: number; score: number; perspective: string; executed: boolean }>(
    scoresSql,
    recordIds
  );

  // 按动作统计
  const actionStats: Record<number, { total: number; passCount: number; scoreSum: number; perspectives: Record<string, number[]> }> = {};
  for (const s of scores) {
    if (!actionStats[s.action_no]) {
      actionStats[s.action_no] = { total: 0, passCount: 0, scoreSum: 0, perspectives: {} };
    }
    const stat = actionStats[s.action_no];
    stat.total++;
    stat.scoreSum += s.score;
    if (s.score >= 3) stat.passCount++;
    if (!stat.perspectives[s.perspective]) stat.perspectives[s.perspective] = [];
    stat.perspectives[s.perspective].push(s.score);
  }

  const result = Object.entries(actionStats).map(([actionNo, stat]) => ({
    actionNo: Number(actionNo),
    totalEvaluations: stat.total,
    passCount: stat.passCount,
    passRate: stat.total > 0 ? Math.round((stat.passCount / stat.total) * 100) : 0,
    avgScore: stat.total > 0 ? Math.round((stat.scoreSum / stat.total) * 10) / 10 : 0,
    byPerspective: Object.fromEntries(
      Object.entries(stat.perspectives).map(([p, pScores]) => [
        p,
        {
          count: pScores.length,
          avg: Math.round((pScores.reduce((a, b) => a + b, 0) / pScores.length) * 10) / 10,
        },
      ])
    ),
  }));

  // 整体达标率
  const totalEvals = result.reduce((sum, r) => sum + r.totalEvaluations, 0);
  const totalPass = result.reduce((sum, r) => sum + r.passCount, 0);
  const totalScoreSum = scores.reduce((sum: number, s: { score: number }) => sum + s.score, 0);

  return NextResponse.json({
    stats: result,
    overall: {
      totalEvaluations: totalEvals,
      passRate: totalEvals > 0 ? Math.round((totalPass / totalEvals) * 100) : 0,
      avgScore: totalEvals > 0 ? Math.round((totalScoreSum / totalEvals) * 10) / 10 : 0,
    },
  });
}
