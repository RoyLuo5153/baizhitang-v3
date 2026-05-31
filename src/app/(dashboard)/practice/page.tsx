'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth/context';
import { cn } from '@/lib/utils';

/* ── 类型 ── */
interface PracticeTask {
  id: number;
  task_type: 'system_task' | 'temp_task';
  title: string;
  description: string | null;
  task_tag: string | null;
  linked_course: string | null;
  linked_stage: string | null;
  linked_day_index: number | null;
  assigned_to: string;
  assigned_by: string | null;
  deadline: string | null;
  status: 'pending' | 'submitted' | 'reviewed';
  submission_id: number | null;
  created_at: string;
  // 附加字段（API join）
  trainee_name?: string;
  submission?: { id: number; file_url: string; submitted_at: string; description: string | null };
  review?: { score: number | null; comment: string | null; reviewer_id: string | null; reviewed_at: string | null } | null;
}

interface CoreAction {
  id: number;
  node_key: string;
  node_name: string;
  action_index: number;
  action_name: string;
  scoring_5: string | null;
  scoring_4: string | null;
  scoring_3: string | null;
  scoring_2: string | null;
  scoring_0: string | null;
}

const SCORE_LABELS: Record<number, { label: string; color: string }> = {
  5: { label: '全面完成有亮点', color: 'text-emerald-600' },
  4: { label: '按要求完成', color: 'text-blue-600' },
  3: { label: '勉强完成', color: 'text-amber-600' },
  2: { label: '明显遗漏', color: 'text-orange-600' },
  0: { label: '未执行', color: 'text-red-600' },
};

export default function PracticePage() {
  const { user } = useAuth();
  const isTrainee = user?.role === '1';
  const [activeTab, setActiveTab] = useState(isTrainee ? 'pending' : 'review');
  const [pendingTasks, setPendingTasks] = useState<PracticeTask[]>([]);
  const [history, setHistory] = useState<PracticeTask[]>([]);
  const [pendingReview, setPendingReview] = useState<PracticeTask[]>([]);
  const [reviewedHistory, setReviewedHistory] = useState<PracticeTask[]>([]);
  const [coreActions, setCoreActions] = useState<CoreAction[]>([]);
  const [stats, setStats] = useState({ pending: 0, submitted: 0, reviewed: 0 });
  const [loading, setLoading] = useState(true);
  const [submitModal, setSubmitModal] = useState<PracticeTask | null>(null);
  const [reviewModal, setReviewModal] = useState<PracticeTask | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [submitFileUrl, setSubmitFileUrl] = useState('');
  const [submitDesc, setSubmitDesc] = useState('');
  const [reviewScore, setReviewScore] = useState<number | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewPass, setReviewPass] = useState(true);
  const [newTask, setNewTask] = useState({ assignedTo: '', title: '', description: '', taskTag: '', deadline: '' });

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/practice?userId=${user.id}&role=${isTrainee ? 'trainee' : 'reviewer'}`);
      const data = await res.json();
      if (isTrainee) {
        setPendingTasks(data.pendingTasks || []);
        setHistory(data.history || []);
        setStats(data.stats || { pending: 0, submitted: 0, reviewed: 0 });
      } else {
        setPendingReview(data.pendingReview || []);
        setReviewedHistory(data.reviewedHistory || []);
        setCoreActions(data.coreActions || []);
        setStats({ pending: (data.pendingReview || []).length, submitted: 0, reviewed: (data.reviewedHistory || []).length });
      }
    } catch (err) {
      console.error('Fetch practice error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, isTrainee]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── 新人提交录音 ── */
  const handleSubmit = async () => {
    if (!submitModal || !user?.id) return;
    try {
      const res = await fetch('/api/practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: submitModal.id,
          traineeId: user.id,
          fileUrl: submitFileUrl,
          description: submitDesc,
          title: submitModal.title,
        }),
      });
      if (res.ok) {
        setSubmitModal(null);
        setSubmitFileUrl('');
        setSubmitDesc('');
        fetchData();
      }
    } catch (err) {
      console.error('Submit error:', err);
    }
  };

  /* ── 导师审核 ── */
  const handleReview = async () => {
    if (!reviewModal?.submission?.id || reviewScore === null) return;
    try {
      const res = await fetch('/api/practice', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: reviewModal.submission.id,
          reviewScore,
          reviewComment,
          reviewerId: user?.id,
          pass: reviewPass,
        }),
      });
      if (res.ok) {
        setReviewModal(null);
        setReviewScore(null);
        setReviewComment('');
        setReviewPass(true);
        fetchData();
      }
    } catch (err) {
      console.error('Review error:', err);
    }
  };

  /* ── 创建临时任务 ── */
  const handleCreateTask = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch('/api/practice/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedTo: newTask.assignedTo,
          title: newTask.title,
          description: newTask.description,
          taskTag: newTask.taskTag,
          deadline: newTask.deadline || null,
          assignedBy: user.id,
        }),
      });
      if (res.ok) {
        setCreateModal(false);
        setNewTask({ assignedTo: '', title: '', description: '', taskTag: '', deadline: '' });
        fetchData();
      }
    } catch (err) {
      console.error('Create task error:', err);
    }
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('zh-CN') : '';
  const formatTime = (d: string | null) => d ? new Date(d).toLocaleString('zh-CN') : '';

  if (loading) {
    return <div className="flex items-center justify-center h-96 text-muted-foreground">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: '#102A43' }}>录音演练</h1>
        {!isTrainee && (
          <button
            onClick={() => setCreateModal(true)}
            className="px-4 py-2 rounded-lg text-white font-medium"
            style={{ backgroundColor: '#F59E0B' }}
          >
            + 创建临时演练任务
          </button>
        )}
      </div>

      {/* 统计条 */}
      <div className="grid grid-cols-3 gap-4">
        {isTrainee ? (
          <>
            <StatCard label="待完成" value={stats.pending} color="#F59E0B" />
            <StatCard label="已提交待审" value={stats.submitted} color="#2978B5" />
            <StatCard label="已审核" value={stats.reviewed} color="#10B981" />
          </>
        ) : (
          <>
            <StatCard label="待审核" value={stats.pending} color="#F59E0B" />
            <StatCard label="已审核" value={stats.reviewed} color="#10B981" />
            <StatCard label="核心动作" value={coreActions.length} color="#2978B5" />
          </>
        )}
      </div>

      {/* Tab切换 */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: '#E6E1D8' }}>
        {isTrainee ? (
          <>
            <TabBtn active={activeTab === 'pending'} onClick={() => setActiveTab('pending')}>待完成演练</TabBtn>
            <TabBtn active={activeTab === 'history'} onClick={() => setActiveTab('history')}>历史与反馈</TabBtn>
          </>
        ) : (
          <>
            <TabBtn active={activeTab === 'review'} onClick={() => setActiveTab('review')}>待我审核</TabBtn>
            <TabBtn active={activeTab === 'reviewed'} onClick={() => setActiveTab('reviewed')}>审核历史</TabBtn>
          </>
        )}
      </div>

      {/* ── 新人：待完成演练 ── */}
      {isTrainee && activeTab === 'pending' && (
        <div className="space-y-3">
          {pendingTasks.length === 0 ? (
            <EmptyState text="暂无待完成演练任务" />
          ) : pendingTasks.map(task => (
            <div key={task.id} className="rounded-xl border p-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E6E1D8' }}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                      task.task_type === 'system_task' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                    )}>
                      {task.task_type === 'system_task' ? '系统任务' : '临时任务'}
                    </span>
                    {task.task_tag && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{task.task_tag}</span>
                    )}
                    {task.status === 'submitted' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">已提交</span>
                    )}
                  </div>
                  <h3 className="font-semibold text-base mb-1" style={{ color: '#102A43' }}>{task.title}</h3>
                  {task.description && <p className="text-sm mb-2" style={{ color: '#667085' }}>{task.description}</p>}
                  {task.linked_course && (
                    <p className="text-xs mb-1" style={{ color: '#2978B5' }}>关联课程：{task.linked_course}</p>
                  )}
                  {task.linked_stage && (
                    <p className="text-xs" style={{ color: '#667085' }}>
                      {task.linked_stage === 'learning' ? '学习期' : '练习期'} Day{task.linked_day_index}
                    </p>
                  )}
                  {task.deadline && (
                    <p className="text-xs mt-1" style={{ color: '#667085' }}>
                      截止：{formatTime(task.deadline)}
                    </p>
                  )}
                  {task.task_type === 'temp_task' && task.assigned_by && (
                    <p className="text-xs mt-1" style={{ color: '#667085' }}>布置人：导师</p>
                  )}
                </div>
                {task.status === 'pending' && (
                  <button
                    onClick={() => setSubmitModal(task)}
                    className="ml-4 px-4 py-2 rounded-lg text-white text-sm font-medium shrink-0"
                    style={{ backgroundColor: '#2978B5' }}
                  >
                    提交录音
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 新人：历史与反馈 ── */}
      {isTrainee && activeTab === 'history' && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <EmptyState text="暂无审核历史" />
          ) : history.map(task => (
            <div key={task.id} className="rounded-xl border p-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E6E1D8' }}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                      task.task_type === 'system_task' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                    )}>
                      {task.task_type === 'system_task' ? '系统任务' : '临时任务'}
                    </span>
                    {task.task_tag && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{task.task_tag}</span>
                    )}
                  </div>
                  <h3 className="font-semibold text-base mb-1" style={{ color: '#102A43' }}>{task.title}</h3>
                  {task.review && task.review.score !== null && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm" style={{ color: '#667085' }}>评分：</span>
                        <span className={cn('text-lg font-bold', SCORE_LABELS[task.review.score]?.color || 'text-gray-600')}>
                          {task.review.score}分
                        </span>
                        <span className="text-sm" style={{ color: '#667085' }}>
                          {SCORE_LABELS[task.review.score]?.label || ''}
                        </span>
                      </div>
                      {task.review.comment && (
                        <p className="text-sm mt-1 p-2 rounded" style={{ backgroundColor: '#F8F6F0', color: '#1D2733' }}>
                          {task.review.comment}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 导师/负责人：待审核 ── */}
      {!isTrainee && activeTab === 'review' && (
        <div className="space-y-3">
          {pendingReview.length === 0 ? (
            <EmptyState text="暂无待审核演练" />
          ) : pendingReview.map(task => (
            <div key={task.id} className="rounded-xl border p-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E6E1D8' }}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                      task.task_type === 'system_task' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                    )}>
                      {task.task_type === 'system_task' ? '系统任务' : '临时任务'}
                    </span>
                    {task.task_tag && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{task.task_tag}</span>
                    )}
                  </div>
                  <h3 className="font-semibold text-base mb-1" style={{ color: '#102A43' }}>
                    <span style={{ color: '#2978B5' }}>{task.trainee_name}</span> — {task.title}
                  </h3>
                  <p className="text-sm" style={{ color: '#667085' }}>
                    提交时间：{task.submission?.submitted_at ? formatTime(task.submission.submitted_at) : '未知'}
                  </p>
                  {task.submission?.description && (
                    <p className="text-sm mt-1" style={{ color: '#667085' }}>说明：{task.submission.description}</p>
                  )}
                </div>
                <button
                  onClick={() => { setReviewModal(task); setReviewScore(null); setReviewComment(''); setReviewPass(true); }}
                  className="ml-4 px-4 py-2 rounded-lg text-white text-sm font-medium shrink-0"
                  style={{ backgroundColor: '#F59E0B' }}
                >
                  审核评分
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 导师/负责人：审核历史 ── */}
      {!isTrainee && activeTab === 'reviewed' && (
        <div className="space-y-3">
          {reviewedHistory.length === 0 ? (
            <EmptyState text="暂无审核历史" />
          ) : reviewedHistory.map(task => (
            <div key={task.id} className="rounded-xl border p-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E6E1D8' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                  task.task_type === 'system_task' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                )}>
                  {task.task_type === 'system_task' ? '系统任务' : '临时任务'}
                </span>
              </div>
              <h3 className="font-semibold text-base" style={{ color: '#102A43' }}>
                <span style={{ color: '#2978B5' }}>{task.trainee_name}</span> — {task.title}
              </h3>
              {task.review && task.review.score !== null && (
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn('text-lg font-bold', SCORE_LABELS[task.review.score]?.color || 'text-gray-600')}>
                    {task.review.score}分
                  </span>
                  <span className="text-sm" style={{ color: '#667085' }}>{SCORE_LABELS[task.review.score]?.label || ''}</span>
                </div>
              )}
              {task.review?.comment && (
                <p className="text-sm mt-1 p-2 rounded" style={{ backgroundColor: '#F8F6F0', color: '#1D2733' }}>{task.review.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── 提交录音弹窗 ── */}
      {submitModal && (
        <Modal title="提交演练录音" onClose={() => setSubmitModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium" style={{ color: '#102A43' }}>演练任务</label>
              <p className="mt-1 text-sm p-2 rounded" style={{ backgroundColor: '#F8F6F0', color: '#1D2733' }}>
                {submitModal.title}
              </p>
              {submitModal.description && (
                <p className="text-xs mt-1" style={{ color: '#667085' }}>{submitModal.description}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium" style={{ color: '#102A43' }}>录音链接</label>
              <input
                type="text"
                value={submitFileUrl}
                onChange={e => setSubmitFileUrl(e.target.value)}
                placeholder="粘贴录音文件链接"
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                style={{ borderColor: '#E6E1D8' }}
              />
            </div>
            <div>
              <label className="text-sm font-medium" style={{ color: '#102A43' }}>说明（选填）</label>
              <textarea
                value={submitDesc}
                onChange={e => setSubmitDesc(e.target.value)}
                placeholder="对本次演练的补充说明..."
                rows={3}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                style={{ borderColor: '#E6E1D8' }}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setSubmitModal(null)} className="px-4 py-2 rounded-lg border text-sm" style={{ borderColor: '#E6E1D8', color: '#667085' }}>取消</button>
              <button onClick={handleSubmit} className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: '#2978B5' }}>提交</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── 审核评分弹窗 ── */}
      {reviewModal && (
        <Modal title="审核评分" onClose={() => setReviewModal(null)}>
          <div className="space-y-4">
            <div className="p-3 rounded-lg" style={{ backgroundColor: '#F8F6F0' }}>
              <p className="font-medium" style={{ color: '#102A43' }}>
                <span style={{ color: '#2978B5' }}>{reviewModal.trainee_name}</span> — {reviewModal.title}
              </p>
              <p className="text-sm mt-1" style={{ color: '#667085' }}>
                提交时间：{reviewModal.submission?.submitted_at ? formatTime(reviewModal.submission.submitted_at) : '未知'}
              </p>
              {reviewModal.submission?.description && (
                <p className="text-sm mt-1" style={{ color: '#667085' }}>说明：{reviewModal.submission.description}</p>
              )}
            </div>

            {/* 5级评分选择 */}
            <div>
              <label className="text-sm font-medium" style={{ color: '#102A43' }}>评分</label>
              <div className="grid grid-cols-5 gap-2 mt-2">
                {[5, 4, 3, 2, 0].map(s => (
                  <button
                    key={s}
                    onClick={() => setReviewScore(s)}
                    className={cn(
                      'p-2 rounded-lg border text-center text-sm transition-all',
                      reviewScore === s ? 'border-blue-500 ring-2 ring-blue-200' : ''
                    )}
                    style={{ borderColor: reviewScore === s ? '#2978B5' : '#E6E1D8', backgroundColor: reviewScore === s ? '#EBF5FF' : '#FFFFFF' }}
                  >
                    <div className={cn('text-lg font-bold', SCORE_LABELS[s].color)}>{s}分</div>
                    <div className="text-xs" style={{ color: '#667085' }}>{SCORE_LABELS[s].label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 评分标准参考 */}
            {reviewScore !== null && reviewModal.task_tag && coreActions.length > 0 && (
              <div className="p-3 rounded-lg border text-xs" style={{ backgroundColor: '#FAFAFA', borderColor: '#E6E1D8' }}>
                <p className="font-medium mb-1" style={{ color: '#102A43' }}>评分标准参考：</p>
                {coreActions
                  .filter(a => reviewModal.task_tag?.includes(a.node_name) || reviewModal.title.includes(a.action_name))
                  .slice(0, 3)
                  .map(a => (
                    <div key={a.id} className="mb-1" style={{ color: '#667085' }}>
                      {a.action_name}：{a[`scoring_${reviewScore}` as keyof CoreAction] as string || '—'}
                    </div>
                  ))
                }
              </div>
            )}

            <div>
              <label className="text-sm font-medium" style={{ color: '#102A43' }}>卡点说明/改进建议</label>
              <textarea
                value={reviewComment}
                onChange={e => setReviewComment(e.target.value)}
                placeholder="指出卡点和改进方向..."
                rows={3}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                style={{ borderColor: '#E6E1D8' }}
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={reviewPass}
                  onChange={e => setReviewPass(e.target.checked)}
                  className="rounded"
                />
                <span style={{ color: '#102A43' }}>通过</span>
              </label>
              <span className="text-xs" style={{ color: '#667085' }}>
                不通过将要求新人重新提交
              </span>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setReviewModal(null)} className="px-4 py-2 rounded-lg border text-sm" style={{ borderColor: '#E6E1D8', color: '#667085' }}>取消</button>
              <button
                onClick={handleReview}
                disabled={reviewScore === null}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                style={{ backgroundColor: reviewScore === null ? '#ccc' : '#F59E0B' }}
              >
                提交审核结论
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── 创建临时任务弹窗 ── */}
      {createModal && (
        <Modal title="创建临时演练任务" onClose={() => setCreateModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium" style={{ color: '#102A43' }}>指派新人</label>
              <input
                type="text"
                value={newTask.assignedTo}
                onChange={e => setNewTask({ ...newTask, assignedTo: e.target.value })}
                placeholder="输入新人ID"
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                style={{ borderColor: '#E6E1D8' }}
              />
            </div>
            <div>
              <label className="text-sm font-medium" style={{ color: '#102A43' }}>任务名称</label>
              <input
                type="text"
                value={newTask.title}
                onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="如：异议处理专项演练"
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                style={{ borderColor: '#E6E1D8' }}
              />
            </div>
            <div>
              <label className="text-sm font-medium" style={{ color: '#102A43' }}>知识点标签</label>
              <input
                type="text"
                value={newTask.taskTag}
                onChange={e => setNewTask({ ...newTask, taskTag: e.target.value })}
                placeholder="如：异议处理、首通电话"
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                style={{ borderColor: '#E6E1D8' }}
              />
            </div>
            <div>
              <label className="text-sm font-medium" style={{ color: '#102A43' }}>演练要求</label>
              <textarea
                value={newTask.description}
                onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="描述演练的具体要求和标准..."
                rows={3}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                style={{ borderColor: '#E6E1D8' }}
              />
            </div>
            <div>
              <label className="text-sm font-medium" style={{ color: '#102A43' }}>截止时间</label>
              <input
                type="datetime-local"
                value={newTask.deadline}
                onChange={e => setNewTask({ ...newTask, deadline: e.target.value })}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                style={{ borderColor: '#E6E1D8' }}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setCreateModal(false)} className="px-4 py-2 rounded-lg border text-sm" style={{ borderColor: '#E6E1D8', color: '#667085' }}>取消</button>
              <button
                onClick={handleCreateTask}
                disabled={!newTask.assignedTo || !newTask.title}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                style={{ backgroundColor: !newTask.assignedTo || !newTask.title ? '#ccc' : '#F59E0B' }}
              >
                派发任务
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── 小组件 ── */
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border p-4 text-center" style={{ backgroundColor: '#FFFFFF', borderColor: '#E6E1D8' }}>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="text-sm" style={{ color: '#667085' }}>{label}</div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn('px-4 py-2 rounded-md text-sm font-medium transition-all', active ? 'bg-white shadow-sm' : '')}
      style={{ color: active ? '#102A43' : '#667085' }}
    >
      {children}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="text-center py-12" style={{ color: '#667085' }}>{text}</div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#E6E1D8' }}>
          <h2 className="font-semibold text-lg" style={{ color: '#102A43' }}>{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
