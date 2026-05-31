'use client';

import { useState, useEffect } from 'react';
import { Mic, Upload, CheckCircle2, Clock, MessageSquare, Send, FileAudio, ChevronDown, ChevronUp, Star } from 'lucide-react';

interface Submission {
  id: number;
  trainee_id: string;
  trainee_name?: string | null;
  level_id: number;
  level_name?: string | null;
  submission_type: string;
  title: string;
  description: string;
  file_url: string;
  status: string;
  reviewer_id: string | null;
  reviewer_name?: string | null;
  review_score: number | null;
  review_comment: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

export default function PracticePage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'my' | 'review'>('my');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => { fetchSubmissions(); }, []);

  const fetchSubmissions = async () => {
    try {
      const res = await fetch('/api/practice?userId=1');
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions || []);
        setLoading(false);
        return;
      }
    } catch {}
    setSubmissions(MOCK_SUBMISSIONS);
    setLoading(false);
  };

  const statusConfig: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
    submitted: { label: '待审核', color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10', icon: Clock },
    reviewed: { label: '已评分', color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/10', icon: CheckCircle2 },
    revision: { label: '需修改', color: 'text-destructive', bg: 'bg-destructive/10', icon: MessageSquare },
  };

  const typeConfig: Record<string, { label: string; icon: typeof Mic }> = {
    recording: { label: '录音演练', icon: Mic },
    wechat: { label: '微信截图', icon: MessageSquare },
  };

  const mySubmissions = submissions.filter(s => s.trainee_id === '1');
  const pendingReviews = submissions.filter(s => s.status === 'submitted' && s.trainee_id !== '1');

  if (loading) return <div className="space-y-4">{[1,2,3].map(i=><div key={i} className="bg-card rounded-lg p-5 animate-pulse"><div className="h-5 bg-muted rounded w-1/3 mb-3"/><div className="h-3 bg-muted rounded w-2/3"/></div>)}</div>;

  const displayList = activeTab === 'my' ? mySubmissions : pendingReviews;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">录音演练</h1>
        </div>
        <button onClick={() => setShowSubmitModal(true)} className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition">
          <Upload className="w-4 h-4" /> 提交演练
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '我的提交', value: mySubmissions.length, icon: Send, color: 'text-primary', bg: 'bg-primary/10' },
          { label: '待审核', value: mySubmissions.filter(s => s.status === 'submitted').length, icon: Clock, color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
          { label: '已通过', value: mySubmissions.filter(s => s.review_score !== null && s.review_score >= 70).length, icon: CheckCircle2, color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/10' },
          { label: '平均分', value: mySubmissions.filter(s => s.review_score).length ? Math.round(mySubmissions.filter(s => s.review_score).reduce((a, s) => a + (s.review_score || 0), 0) / mySubmissions.filter(s => s.review_score).length) : '-', icon: Star, color: 'text-primary', bg: 'bg-primary/10' },
        ].map((s, i) => (
          <div key={i} className="bg-card rounded-lg shadow-card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
            <div><div className="text-xl font-bold text-foreground">{s.value}</div><div className="text-xs text-muted-foreground">{s.label}</div></div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex bg-muted rounded-lg p-1 w-fit">
        <button onClick={() => setActiveTab('my')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${activeTab === 'my' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>我的提交</button>
        <button onClick={() => setActiveTab('review')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${activeTab === 'review' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>待我审核 ({pendingReviews.length})</button>
      </div>

      {/* Submission list */}
      <div className="space-y-3">
        {displayList.length === 0 ? (
          <div className="bg-card rounded-lg p-12 text-center">
            <Mic className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">{activeTab === 'my' ? '暂无演练记录，点击"提交演练"开始' : '暂无待审核的演练'}</p>
          </div>
        ) : displayList.map(sub => {
          const cfg = statusConfig[sub.status] || statusConfig.submitted;
          const tcfg = typeConfig[sub.submission_type] || typeConfig.recording;
          const StatusIcon = cfg.icon;
          const TypeIcon = tcfg.icon;
          const isExpanded = expandedId === sub.id;

          return (
            <div key={sub.id} className="bg-card rounded-lg shadow-card overflow-hidden">
              <div className="p-5 cursor-pointer hover:bg-muted/20 transition" onClick={() => setExpandedId(isExpanded ? null : sub.id)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <TypeIcon className={`w-4 h-4 ${cfg.color}`} />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground mb-1">{sub.title}</h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className={`px-1.5 py-0.5 rounded ${tcfg.label === '录音演练' ? 'bg-primary/10 text-primary' : 'bg-[#f59e0b]/10 text-[#f59e0b]'}`}>{tcfg.label}</span>
                        {sub.level_name && <span>关卡: {sub.level_name}</span>}
                        <span>{new Date(sub.submitted_at).toLocaleDateString('zh-CN')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${cfg.bg} ${cfg.color} flex items-center gap-1`}>
                      <StatusIcon className="w-3 h-3" />{cfg.label}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-0 border-t border-border/30">
                  <div className="mt-4 space-y-3">
                    {sub.description && (
                      <div>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">描述</span>
                        <p className="text-sm text-foreground mt-1">{sub.description}</p>
                      </div>
                    )}
                    {sub.file_url && (
                      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                        <FileAudio className="w-4 h-4 text-primary" />
                        <span className="text-sm text-primary hover:underline cursor-pointer">播放录音</span>
                      </div>
                    )}
                    {sub.review_score !== null && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <span className="text-xs text-muted-foreground">评分</span>
                          <div className={`text-2xl font-bold mt-1 ${sub.review_score >= 70 ? 'text-[#22c55e]' : sub.review_score >= 50 ? 'text-[#f59e0b]' : 'text-destructive'}`}>
                            {sub.review_score}<span className="text-sm text-muted-foreground font-normal">/100</span>
                          </div>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <span className="text-xs text-muted-foreground">审核人</span>
                          <div className="text-sm font-medium text-foreground mt-1">{sub.reviewer_name || '导师'}</div>
                          {sub.reviewed_at && <div className="text-xs text-muted-foreground mt-0.5">{new Date(sub.reviewed_at).toLocaleDateString('zh-CN')}</div>}
                        </div>
                      </div>
                    )}
                    {sub.review_comment && (
                      <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg">
                        <span className="text-xs font-semibold text-primary">导师评语</span>
                        <p className="text-sm text-foreground mt-1">{sub.review_comment}</p>
                      </div>
                    )}
                    {activeTab === 'review' && sub.status === 'submitted' && (
                      <div className="flex gap-3 pt-2">
                        <input type="number" placeholder="评分(0-100)" className="border border-border rounded-lg px-3 py-2 text-sm w-32" min={0} max={100} />
                        <input placeholder="评语" className="border border-border rounded-lg px-3 py-2 text-sm flex-1" />
                        <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition">提交评分</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowSubmitModal(false)}>
          <div className="bg-card rounded-xl shadow-lg w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-foreground mb-4">提交演练</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">演练类型</label>
                <div className="flex gap-3">
                  <button className="flex-1 p-3 border-2 border-primary rounded-lg text-center">
                    <Mic className="w-5 h-5 mx-auto mb-1 text-primary" /><span className="text-sm font-medium text-foreground">录音演练</span>
                  </button>
                  <button className="flex-1 p-3 border border-border rounded-lg text-center hover:border-primary/50">
                    <MessageSquare className="w-5 h-5 mx-auto mb-1 text-muted-foreground" /><span className="text-sm font-medium text-muted-foreground">微信截图</span>
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">演练标题</label>
                <input className="w-full border border-border rounded-lg px-3 py-2 text-sm" placeholder="如：首次电话沟通演练" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">关联关卡</label>
                <select className="w-full border border-border rounded-lg px-3 py-2 text-sm">
                  <option>初心启航(第1关)</option><option>角色认知(第2关)</option><option>糖尿病基础(第3关)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">上传文件</label>
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition cursor-pointer">
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">点击上传或拖拽文件至此</p>
                  <p className="text-xs text-muted-foreground mt-1">支持 mp3/wav/png/jpg，最大50MB</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">备注说明</label>
                <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm" rows={2} placeholder="描述演练场景或特别说明" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowSubmitModal(false)} className="px-4 py-2 text-sm text-muted-foreground">取消</button>
              <button onClick={() => setShowSubmitModal(false)} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">提交</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const MOCK_SUBMISSIONS: Submission[] = [
  { id: 1, trainee_id: '1', trainee_name: '张小红', level_id: 1, level_name: '初心启航', submission_type: 'recording', title: '首次电话沟通演练', description: '按照第一关话术要求进行的电话沟通录音', file_url: '/uploads/recording_1.mp3', status: 'reviewed', reviewer_id: '6', reviewer_name: '陈导师', review_score: 78, review_comment: '话术基本到位，但开场白需要更自然，建议多练习自我介绍环节', submitted_at: '2025-06-03T10:00:00Z', reviewed_at: '2025-06-04T15:00:00Z' },
  { id: 2, trainee_id: '2', trainee_name: '李大伟', level_id: 1, level_name: '初心启航', submission_type: 'recording', title: '服务助理角色模拟', description: '模拟患者来电咨询场景', file_url: '/uploads/recording_2.mp3', status: 'submitted', reviewer_id: null, reviewer_name: null, review_score: null, review_comment: null, submitted_at: '2025-06-05T14:00:00Z', reviewed_at: null },
  { id: 3, trainee_id: '3', trainee_name: '王美玲', level_id: 5, level_name: '复诊邀约', submission_type: 'recording', title: '复诊邀约话术演练', description: '按照第五关要求进行的复诊邀约录音', file_url: '/uploads/recording_3.mp3', status: 'reviewed', reviewer_id: '7', reviewer_name: '周导师', review_score: 85, review_comment: '整体流畅，邀约话术运用得当，继续保持', submitted_at: '2025-06-04T09:00:00Z', reviewed_at: '2025-06-05T11:00:00Z' },
  { id: 4, trainee_id: '1', trainee_name: '张小红', level_id: 1, level_name: '初心启航', submission_type: 'wechat', title: '微信加V沟通截图', description: '与患者微信加好友的完整沟通截图', file_url: '/uploads/wechat_1.png', status: 'submitted', reviewer_id: null, reviewer_name: null, review_score: null, review_comment: null, submitted_at: '2025-06-06T16:00:00Z', reviewed_at: null },
];
