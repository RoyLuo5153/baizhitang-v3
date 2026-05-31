import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

interface AlertItem {
  userId: string;
  realName: string;
  alertType: string;
  alertLevel: 'warning' | 'danger' | 'info';
  message: string;
  detail: string;
  relatedModule: string;
  relatedId: string | null;
  createdAt: string;
  mentorName: string | null;
  department: string | null;
  stage: number | null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const roleId = parseInt(searchParams.get('roleId') || '1');

    if (!userId) {
      return NextResponse.json({ error: '缺少userId' }, { status: 400 });
    }

    const alerts: AlertItem[] = [];

    // 1. 获取新人列表（根据角色过滤）
    let traineeQuery = supabase
      .from('users')
      .select('id, real_name, stage, department, mentor_id, join_date')
      .eq('role_id', 1)
      .eq('is_active', true);

    // 导师只看自己带的新人
    if (roleId === 3) {
      traineeQuery = traineeQuery.eq('mentor_id', userId);
    }

    const { data: trainees, error: traineeError } = await traineeQuery;
    if (traineeError) {
      return NextResponse.json({ error: '获取新人列表失败' }, { status: 500 });
    }

    // 获取导师映射
    const mentorIds = [...new Set((trainees || []).map((t: { mentor_id: string | null }) => t.mentor_id).filter(Boolean))] as string[];
    const mentorMap: Record<string, string> = {};
    if (mentorIds.length > 0) {
      const { data: mentors } = await supabase.from('users').select('id, real_name').in('id', mentorIds);
      (mentors || []).forEach((m: { id: string; real_name: string }) => { mentorMap[m.id] = m.real_name; });
    }

    // 2. 检查闯关逾期（学习期>7天未完成）
    const traineeIds = (trainees || []).map((t: { id: string }) => t.id);
    if (traineeIds.length > 0) {
      // 闯关进度
      const { data: levelProgress } = await supabase
        .from('level_progress')
        .select('user_id, level_id, status, updated_at')
        .in('user_id', traineeIds);

      const progressMap: Record<string, Record<number, { status: string; updatedAt: string }>> = {};
      (levelProgress || []).forEach((lp: { user_id: string; level_id: number; status: string; updated_at: string }) => {
        if (!progressMap[lp.user_id]) progressMap[lp.user_id] = {};
        progressMap[lp.user_id][lp.level_id] = { status: lp.status, updatedAt: lp.updated_at };
      });

      // 检查逾期新人
      (trainees || []).forEach((t: { id: string; real_name: string; stage: number | null; department: string | null; mentor_id: string | null; join_date: string | null }) => {
        // 入职超过7天仍在阶段1且未通过7关
        if (t.join_date && t.stage === 1) {
          const joinDate = new Date(t.join_date);
          const daysSince = Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24));
          const passedLevels = Object.values(progressMap[t.id] || {}).filter((l: { status: string }) => l.status === 'passed').length;
          if (daysSince > 7 && passedLevels < 7) {
            alerts.push({
              userId: t.id,
              realName: t.real_name,
              alertType: 'level_overdue',
              alertLevel: daysSince > 14 ? 'danger' : 'warning',
              message: `${t.real_name} 入职${daysSince}天，仅通过${passedLevels}/7关`,
              detail: `阶段1学习期已超时，预期7天完成7关闯关`,
              relatedModule: 'learning',
              relatedId: t.id,
              createdAt: new Date().toISOString(),
              mentorName: t.mentor_id ? (mentorMap[t.mentor_id] || null) : null,
              department: t.department,
              stage: t.stage,
            });
          }
        }
      });

      // 3. 检查演练低分
      const { data: lowScoreSubmissions } = await supabase
        .from('practice_submissions')
        .select('id, trainee_id, score, feedback, created_at')
        .in('trainee_id', traineeIds)
        .lte('score', 2)
        .order('created_at', { ascending: false })
        .limit(20);

      (lowScoreSubmissions || []).forEach((sub: { id: number; trainee_id: string; score: number; feedback: string | null; created_at: string }) => {
        const trainee = (trainees || []).find((t: { id: string }) => t.id === sub.trainee_id);
        if (trainee) {
          alerts.push({
            userId: sub.trainee_id,
            realName: (trainee as Record<string, unknown>).real_name as string,
            alertType: 'practice_low_score',
            alertLevel: sub.score === 0 ? 'danger' : 'warning',
            message: `${(trainee as Record<string, unknown>).real_name as string} 演练评分仅${sub.score}分`,
            detail: sub.feedback || '评分≤2分，需要针对性赋能',
            relatedModule: 'practice',
            relatedId: String(sub.id),
            createdAt: sub.created_at,
            mentorName: ((trainee as Record<string, unknown>).mentor_id as string) ? (mentorMap[(trainee as Record<string, unknown>).mentor_id as string] || null) : null,
            department: (trainee as Record<string, unknown>).department as string | null,
            stage: (trainee as Record<string, unknown>).stage as number | null,
          });
        }
      });

      // 4. 检查双轨诊断不合格
      const { data: diagnoses } = await supabase
        .from('diagnoses')
        .select('id, trainee_id, quadrant, created_at')
        .in('trainee_id', traineeIds)
        .in('quadrant', ['B', 'C', 'D'])
        .order('created_at', { ascending: false })
        .limit(20);

      (diagnoses || []).forEach((d: { id: number; trainee_id: string; quadrant: string; created_at: string }) => {
        const trainee = (trainees || []).find((t: { id: string }) => t.id === d.trainee_id);
        if (trainee) {
          const quadrantDesc: Record<string, string> = { B: '结果不合格', C: '过程不合格', D: '全不合格' };
          alerts.push({
            userId: d.trainee_id,
            realName: (trainee as Record<string, unknown>).real_name as string,
            alertType: 'diagnosis_fail',
            alertLevel: d.quadrant === 'D' ? 'danger' : 'warning',
            message: `${(trainee as Record<string, unknown>).real_name as string} 诊断${d.quadrant}类（${quadrantDesc[d.quadrant]}）`,
            detail: `四象限分类：${d.quadrant}类，需关注${d.quadrant === 'D' ? '过程和结果双线' : d.quadrant === 'B' ? '结果线指标' : '过程线指标'}`,
            relatedModule: 'diagnosis',
            relatedId: String(d.id),
            createdAt: d.created_at,
            mentorName: ((trainee as Record<string, unknown>).mentor_id as string) ? (mentorMap[(trainee as Record<string, unknown>).mentor_id as string] || null) : null,
            department: (trainee as Record<string, unknown>).department as string | null,
            stage: (trainee as Record<string, unknown>).stage as number | null,
          });
        }
      });

      // 5. 检查即将下组（预计下组日期7天内）
      const { data: upcomingGroup } = await supabase
        .from('trainee_profiles')
        .select('user_id, expected_group_date, profile_status')
        .in('user_id', traineeIds)
        .eq('profile_status', 'training');

      (upcomingGroup || []).forEach((p: { user_id: string; expected_group_date: string | null; profile_status: string }) => {
        if (p.expected_group_date) {
          const groupDate = new Date(p.expected_group_date);
          const daysUntil = Math.floor((groupDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysUntil <= 7 && daysUntil >= 0) {
            const trainee = (trainees || []).find((t: { id: string }) => t.id === p.user_id);
            if (trainee) {
              alerts.push({
                userId: p.user_id,
                realName: (trainee as Record<string, unknown>).real_name as string,
                alertType: 'upcoming_group',
                alertLevel: daysUntil <= 3 ? 'danger' : 'warning',
                message: `${(trainee as Record<string, unknown>).real_name as string} ${daysUntil}天后预计下组`,
                detail: `预计下组日期：${p.expected_group_date}，请确认是否达标`,
                relatedModule: 'trainee-profiles',
                relatedId: p.user_id,
                createdAt: new Date().toISOString(),
                mentorName: ((trainee as Record<string, unknown>).mentor_id as string) ? (mentorMap[(trainee as Record<string, unknown>).mentor_id as string] || null) : null,
                department: (trainee as Record<string, unknown>).department as string | null,
                stage: (trainee as Record<string, unknown>).stage as number | null,
              });
            }
          }
        }
      });

      // 6. 检查连续2周D类（触发复训预警）
      const { data: recentDiagnoses } = await supabase
        .from('diagnoses')
        .select('trainee_id, quadrant, created_at')
        .in('trainee_id', traineeIds)
        .eq('quadrant', 'D')
        .order('created_at', { ascending: false });

      const dCountMap: Record<string, number> = {};
      (recentDiagnoses || []).forEach((d: { trainee_id: string; created_at: string }) => {
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        if (new Date(d.created_at) >= twoWeeksAgo) {
          dCountMap[d.trainee_id] = (dCountMap[d.trainee_id] || 0) + 1;
        }
      });

      Object.entries(dCountMap).forEach(([tid, count]) => {
        if (count >= 2) {
          const trainee = (trainees || []).find((t: { id: string }) => t.id === tid);
          if (trainee) {
            alerts.push({
              userId: tid,
              realName: (trainee as Record<string, unknown>).real_name as string,
              alertType: 'consecutive_d',
              alertLevel: 'danger',
              message: `${(trainee as Record<string, unknown>).real_name as string} 连续2周D类，需触发复训`,
              detail: `近2周${count}次D类诊断，按规则应启动复训流程`,
              relatedModule: 'empowerment',
              relatedId: tid,
              createdAt: new Date().toISOString(),
              mentorName: ((trainee as Record<string, unknown>).mentor_id as string) ? (mentorMap[(trainee as Record<string, unknown>).mentor_id as string] || null) : null,
              department: (trainee as Record<string, unknown>).department as string | null,
              stage: (trainee as Record<string, unknown>).stage as number | null,
            });
          }
        }
      });

      // 7. 检查待审核演练（导师视角）
      if (roleId === 3 || roleId === 4) {
        const { data: pendingReviews } = await supabase
          .from('practice_submissions')
          .select('id, trainee_id, created_at')
          .is('score', null)
          .in('trainee_id', traineeIds)
          .order('created_at', { ascending: false })
          .limit(20);

        (pendingReviews || []).forEach((pr: { id: number; trainee_id: string; created_at: string }) => {
          const trainee = (trainees || []).find((t: { id: string }) => t.id === pr.trainee_id);
          if (trainee) {
            const hoursSince = Math.floor((Date.now() - new Date(pr.created_at).getTime()) / (1000 * 60 * 60));
            alerts.push({
              userId: pr.trainee_id,
              realName: (trainee as Record<string, unknown>).real_name as string,
              alertType: 'pending_review',
              alertLevel: hoursSince > 24 ? 'danger' : 'info',
              message: `${(trainee as Record<string, unknown>).real_name as string} 演练待审核（${hoursSince}小时）`,
              detail: `提交时间：${new Date(pr.created_at).toLocaleString()}，请尽快审核`,
              relatedModule: 'practice',
              relatedId: String(pr.id),
              createdAt: pr.created_at,
              mentorName: ((trainee as Record<string, unknown>).mentor_id as string) ? (mentorMap[(trainee as Record<string, unknown>).mentor_id as string] || null) : null,
              department: (trainee as Record<string, unknown>).department as string | null,
              stage: (trainee as Record<string, unknown>).stage as number | null,
            });
          }
        });
      }

      // 8. 检查待审核质检
      if (roleId === 3 || roleId === 4 || roleId === 2) {
        const { data: pendingQc } = await supabase
          .from('qc_records')
          .select('id, trainee_id, created_at')
          .eq('status', 'pending')
          .in('trainee_id', traineeIds)
          .order('created_at', { ascending: false })
          .limit(20);

        (pendingQc || []).forEach((qc: { id: number; trainee_id: string; created_at: string }) => {
          const trainee = (trainees || []).find((t: { id: string }) => t.id === qc.trainee_id);
          if (trainee) {
            const hoursSince = Math.floor((Date.now() - new Date(qc.created_at).getTime()) / (1000 * 60 * 60));
            alerts.push({
              userId: qc.trainee_id,
              realName: (trainee as Record<string, unknown>).real_name as string,
              alertType: 'pending_qc',
              alertLevel: hoursSince > 48 ? 'danger' : 'warning',
              message: `${(trainee as Record<string, unknown>).real_name as string} 质检待审核（${hoursSince}小时）`,
              detail: `质检提交时间：${new Date(qc.created_at).toLocaleString()}`,
              relatedModule: 'qc-review',
              relatedId: String(qc.id),
              createdAt: qc.created_at,
              mentorName: ((trainee as Record<string, unknown>).mentor_id as string) ? (mentorMap[(trainee as Record<string, unknown>).mentor_id as string] || null) : null,
              department: (trainee as Record<string, unknown>).department as string | null,
              stage: (trainee as Record<string, unknown>).stage as number | null,
            });
          }
        });
      }
    }

    // 新人视角：看自己的待办
    if (roleId === 1) {
      // 未完成的演练任务
      const { data: pendingTasks } = await supabase
        .from('practice_tasks')
        .select('id, title, deadline')
        .eq('assigned_to', userId)
        .eq('status', 'active');

      (pendingTasks || []).forEach((task: { id: number; title: string; deadline: string | null }) => {
        const isOverdue = task.deadline && new Date(task.deadline) < new Date();
        alerts.push({
          userId: userId!,
          realName: '',
          alertType: 'pending_practice',
          alertLevel: isOverdue ? 'danger' : 'info',
          message: `待完成演练：${task.title}`,
          detail: isOverdue ? '已逾期，请尽快完成' : (task.deadline ? `截止：${new Date(task.deadline).toLocaleDateString()}` : ''),
          relatedModule: 'practice',
          relatedId: String(task.id),
          createdAt: new Date().toISOString(),
          mentorName: null,
          department: null,
          stage: null,
        });
      });
    }

    // Sort by alert level priority: danger > warning > info
    const levelPriority = { danger: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => levelPriority[a.alertLevel] - levelPriority[b.alertLevel]);

    // Stats
    const stats = {
      total: alerts.length,
      dangerCount: alerts.filter(a => a.alertLevel === 'danger').length,
      warningCount: alerts.filter(a => a.alertLevel === 'warning').length,
      infoCount: alerts.filter(a => a.alertLevel === 'info').length,
      byType: {
        level_overdue: alerts.filter(a => a.alertType === 'level_overdue').length,
        practice_low_score: alerts.filter(a => a.alertType === 'practice_low_score').length,
        diagnosis_fail: alerts.filter(a => a.alertType === 'diagnosis_fail').length,
        upcoming_group: alerts.filter(a => a.alertType === 'upcoming_group').length,
        consecutive_d: alerts.filter(a => a.alertType === 'consecutive_d').length,
        pending_review: alerts.filter(a => a.alertType === 'pending_review').length,
        pending_qc: alerts.filter(a => a.alertType === 'pending_qc').length,
        pending_practice: alerts.filter(a => a.alertType === 'pending_practice').length,
      },
    };

    return NextResponse.json({ alerts, stats });
  } catch (err) {
    console.error('[trainee-alerts] Error:', err);
    return NextResponse.json({ error: '获取预警数据失败' }, { status: 500 });
  }
}
