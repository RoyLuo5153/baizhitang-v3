import { NextRequest, NextResponse } from 'next/server';
import {
  calculateTrustScore,
  calculateNodeTrustScore,
  calculateTrustTrend,
  getNodeActions,
  type ActionScoreInput,
  type TrustElement,
  type TrustScoreResult,
} from '@/lib/trust-engine';
import { pgQuery, pgInsert } from '@/storage/database/pg-client';

export const dynamic = 'force-dynamic';

// GET /api/trust-score - 计算并返回信任度得分
// 查询参数: userId(必填), recordId(可选-单次质检), nodeId(可选-单节点), trend(可选-趋势)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const recordId = searchParams.get('recordId');
  const nodeId = searchParams.get('nodeId');
  const trend = searchParams.get('trend') === 'true';

  if (!userId) {
    return NextResponse.json({ error: 'userId必填' }, { status: 400 });
  }

  try {
    // 单次质检的信任度
    if (recordId) {
      return await handleSingleRecord(recordId, nodeId ? Number(nodeId) : undefined);
    }

    // 趋势模式
    if (trend) {
      return await handleTrend(userId, nodeId ? Number(nodeId) : undefined);
    }

    // 默认：计算用户最新信任度
    return await handleUserLatest(userId, nodeId ? Number(nodeId) : undefined);
  } catch (err) {
    const message = err instanceof Error ? err.message : '计算信任度失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 获取单次质检的信任度
async function handleSingleRecord(recordId: string, nodeId?: number) {
  const scores = await getScoresForRecord(recordId);
  if (scores.length === 0) {
    return NextResponse.json({ error: '该记录无评分数据' }, { status: 404 });
  }

  const trustResult = calculateTrustScore(scores);

  // 如果指定了nodeId，计算该节点的信任度
  if (nodeId) {
    const nodeTrust = calculateNodeTrustScore(scores, nodeId);
    return NextResponse.json({
      recordId,
      nodeId,
      overall: trustResult,
      node: nodeTrust,
    });
  }

  // 按节点分别计算
  const byNode: Record<number, TrustScoreResult> = {};
  for (let n = 1; n <= 4; n++) {
    const nodeActions = getNodeActions(n);
    const nodeScores = scores.filter(s => nodeActions.includes(s.actionNo));
    if (nodeScores.length > 0) {
      byNode[n] = calculateNodeTrustScore(nodeScores, n);
    }
  }

  return NextResponse.json({
    recordId,
    overall: trustResult,
    byNode,
  });
}

// 获取用户最新信任度
async function handleUserLatest(userId: string, nodeId?: number) {
  // 获取用户最新的质检记录
  const latestSql = `
    SELECT id FROM qc_records 
    WHERE user_id = $1 
    ORDER BY created_at DESC 
    LIMIT 5
  `;
  const records = await pgQuery<{ id: string }>(latestSql, [userId]);

  if (records.length === 0) {
    return NextResponse.json({
      userId,
      message: '暂无质检记录',
      overall: { totalTrust: 0, cognitiveScore: 0, professionalScore: 0, safetyScore: 0, obstacleClearanceScore: 0, bottleneck: '暂无数据', suggestion: '请先完成演练' },
      byNode: {},
    });
  }

  const recordIds = records.map(r => r.id);
  const placeholders = recordIds.map((_, i) => `$${i + 1}`).join(',');
  const scoresSql = `
    SELECT as1.action_no, as1.score, as1.perspective
    FROM action_scores as1
    WHERE as1.record_id IN (${placeholders})
    ORDER BY as1.created_at DESC
  `;
  const allScoreRows = await pgQuery(scoresSql, recordIds);

  // 转换为ActionScoreInput格式
  const allScores: ActionScoreInput[] = (allScoreRows as Array<Record<string, unknown>>).map(row => ({
    actionNo: Number(row.action_no),
    score: Number(row.score),
  }));

  if (allScores.length === 0) {
    return NextResponse.json({
      userId,
      message: '暂无评分数据',
      overall: { totalTrust: 0, cognitiveScore: 0, professionalScore: 0, safetyScore: 0, obstacleClearanceScore: 0, bottleneck: '暂无数据', suggestion: '请先完成演练和评分' },
      byNode: {},
    });
  }

  const trustResult = calculateTrustScore(allScores);

  // 按节点分别计算
  const byNode: Record<number, TrustScoreResult> = {};
  for (let n = 1; n <= 4; n++) {
    const nodeActions = getNodeActions(n);
    const nodeScores = allScores.filter(s => nodeActions.includes(s.actionNo));
    if (nodeScores.length > 0) {
      byNode[n] = calculateNodeTrustScore(nodeScores, n);
    }
  }

  // 保存快照
  await saveSnapshot(records[0].id, userId, trustResult);

  return NextResponse.json({
    userId,
    overall: trustResult,
    byNode,
    latestRecordId: records[0].id,
  });
}

// 获取信任度趋势
async function handleTrend(userId: string, nodeId?: number) {
  const params: unknown[] = [userId];
  let snapshotsSql = `
    SELECT * FROM trust_snapshots
    WHERE user_id = $1
  `;
  if (nodeId) {
    snapshotsSql += ' AND node_id = $2';
    params.push(nodeId);
  }
  snapshotsSql += ' ORDER BY created_at DESC LIMIT 20';

  const snapshotRows = await pgQuery(snapshotsSql, params);

  // 如果没有快照，尝试从评分计算
  if (snapshotRows.length === 0) {
    const result = await handleUserLatest(userId, nodeId);
    return result;
  }

  const snapshots = snapshotRows as Array<Record<string, unknown>>;
  const trend = calculateTrustTrend(
    snapshots.map(s => ({
      cognitiveScore: Number(s.cognitive_score ?? 0),
      professionalScore: Number(s.professional_score ?? 0),
      safetyScore: Number(s.safety_score ?? 0),
      obstacleClearanceScore: Number(s.obstacle_clearance_score ?? 0),
      totalTrust: Number(s.total_trust ?? 0),
      createdAt: String(s.created_at ?? ''),
    }))
  );

  return NextResponse.json({
    userId,
    trend,
    snapshots: snapshots.reverse(),
  });
}

// 辅助：获取某次质检的所有评分
async function getScoresForRecord(recordId: string): Promise<ActionScoreInput[]> {
  const sql = `
    SELECT action_no, score, perspective
    FROM action_scores
    WHERE record_id = $1
    ORDER BY action_no
  `;
  const rows = await pgQuery(sql, [recordId]);
  return (rows as Array<Record<string, unknown>>).map(row => ({
    actionNo: Number(row.action_no),
    score: Number(row.score),
  }));
}

// 辅助：保存信任度快照
async function saveSnapshot(recordId: string, userId: string, trustResult: TrustScoreResult) {
  try {
    const sql = `
      INSERT INTO trust_snapshots (record_id, user_id, cognitive_score, professional_score, safety_score, obstacle_clearance_score, total_trust, bottleneck, suggestion)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;
    await pgInsert(sql, [
      recordId,
      userId,
      trustResult.cognitiveScore,
      trustResult.professionalScore,
      trustResult.safetyScore,
      trustResult.obstacleClearanceScore,
      trustResult.totalTrust,
      trustResult.bottleneck,
      trustResult.suggestion,
    ]);
  } catch {
    // 快照保存失败不应影响主流程
  }
}
