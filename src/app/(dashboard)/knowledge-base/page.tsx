'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth/context';
import {
  BookOpen, Search, Tag, Bookmark, BookmarkCheck, Eye,
  ChevronRight, Filter, Plus, Edit2, Trash2, X, Target, HelpCircle,
  CheckCircle, XCircle, Clock, AlertCircle, Upload, FileText, File,
  Image, Music, Video, Download, Paperclip, Loader2
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────

interface Attachment {
  key: string;
  url?: string;
  type: string;
  name: string;
  size: number;
}

interface Article {
  id: number;
  title: string;
  content: string;
  categoryId: number | null;
  categoryName: string;
  category: string;
  tags: string[];
  scenario: string;
  problemSolved: string;
  authorId: string;
  status: string;
  reviewedBy: number | null;
  reviewedAt: string | null;
  viewCount: number;
  bookmarkCount: number;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  isBookmarked: boolean;
}

interface Category {
  id: number;
  name: string;
  parentId: number | null;
  sortOrder: number;
  status: string | null;
  articleCount: number;
  createdAt: string | null;
}

// ─── Status config ──────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: typeof Clock }> = {
  draft: { label: '草稿', color: 'text-muted-foreground', bgColor: 'bg-muted', icon: Edit2 },
  pending_review: { label: '待审核', color: 'text-[#F59E0B]', bgColor: 'bg-[#F59E0B]/10', icon: Clock },
  approved: { label: '已通过', color: 'text-[#22c55e]', bgColor: 'bg-[#22c55e]/10', icon: CheckCircle },
  rejected: { label: '已驳回', color: 'text-destructive', bgColor: 'bg-destructive/10', icon: XCircle },
  published: { label: '已发布', color: 'text-[#22c55e]', bgColor: 'bg-[#22c55e]/10', icon: CheckCircle },
};

// ─── Category colors (dynamic fallback) ─────────────────

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  '糖尿病基础': { bg: 'bg-[#2978B5]/10', text: 'text-[#2978B5]' },
  '服务用语技巧': { bg: 'bg-[#F59E0B]/10', text: 'text-[#F59E0B]' },
  '业务流程': { bg: 'bg-[#22c55e]/10', text: 'text-[#22c55e]' },
  '案例分析': { bg: 'bg-destructive/10', text: 'text-destructive' },
  '制度规范': { bg: 'bg-[#2978B5]/10', text: 'text-[#2978B5]' },
  '产品知识': { bg: 'bg-purple-500/10', text: 'text-purple-500' },
};

const FALLBACK_CAT_COLOR = { bg: 'bg-muted', text: 'text-muted-foreground' };

function getCatColor(name: string) {
  return CATEGORY_COLORS[name] || FALLBACK_CAT_COLOR;
}

// ─── Helpers ────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
}

function getFileIcon(type: string) {
  switch (type) {
    case 'image': return Image;
    case 'audio': return Music;
    case 'video': return Video;
    default: return FileText;
  }
}

// ─── Attachment Renderer ────────────────────────────────

function AttachmentList({ attachments }: { attachments: Attachment[] }) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="mt-6 pt-5 border-t border-border/40">
      <div className="flex items-center gap-2 mb-3">
        <Paperclip className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">附件 ({attachments.length})</span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {attachments.map((att, idx) => {
          const Icon = getFileIcon(att.type);
          // 图片：内联缩略图
          if (att.type === 'image' && att.url) {
            return (
              <div key={idx} className="bg-muted/30 rounded-lg p-3 border border-border/30">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-[#2978B5]" />
                  <span className="text-sm text-foreground">{att.name}</span>
                  <span className="text-xs text-muted-foreground">({formatFileSize(att.size)})</span>
                </div>
                <a href={att.url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={att.url}
                    alt={att.name}
                    className="max-w-xs max-h-48 rounded-md border border-border/50 cursor-pointer hover:opacity-90 transition"
                  />
                </a>
              </div>
            );
          }

          // 音频：内嵌播放器
          if (att.type === 'audio' && att.url) {
            return (
              <div key={idx} className="bg-muted/30 rounded-lg p-3 border border-border/30">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-[#F59E0B]" />
                  <span className="text-sm text-foreground">{att.name}</span>
                  <span className="text-xs text-muted-foreground">({formatFileSize(att.size)})</span>
                </div>
                <audio controls className="w-full max-w-md" src={att.url}>
                  您的浏览器不支持音频播放
                </audio>
              </div>
            );
          }

          // 视频：内嵌播放器
          if (att.type === 'video' && att.url) {
            return (
              <div key={idx} className="bg-muted/30 rounded-lg p-3 border border-border/30">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-[#22c55e]" />
                  <span className="text-sm text-foreground">{att.name}</span>
                  <span className="text-xs text-muted-foreground">({formatFileSize(att.size)})</span>
                </div>
                <video controls className="w-full max-w-lg rounded-md" src={att.url}>
                  您的浏览器不支持视频播放
                </video>
              </div>
            );
          }

          // 文档/表格：文件名+大小+下载按钮
          return (
            <div key={idx} className="bg-muted/30 rounded-lg p-3 border border-border/30 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Icon className="w-4 h-4 text-[#2978B5] shrink-0" />
                <span className="text-sm text-foreground truncate">{att.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">({formatFileSize(att.size)})</span>
              </div>
              {att.url && (
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch(att.url!);
                      const blob = await response.blob();
                      const blobUrl = window.URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = blobUrl;
                      link.download = att.name;
                      link.click();
                      window.URL.revokeObjectURL(blobUrl);
                    } catch {
                      window.open(att.url, '_blank');
                    }
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-[#2978B5]/10 text-[#2978B5] hover:bg-[#2978B5]/20 transition shrink-0 ml-2"
                >
                  <Download className="w-3 h-3" />下载
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Edit/Create Dialog ─────────────────────────────────

function ArticleEditor({
  article,
  onClose,
  onSaved,
  userRole,
  categories,
}: {
  article: Article | null;
  onClose: () => void;
  onSaved: (reviewStatus?: string) => void;
  userRole: string;
  categories: Category[];
}) {
  const isEdit = !!article;
  const isTrainingManager = userRole === 'training_manager';
  const [title, setTitle] = useState(article?.title || '');
  const [content, setContent] = useState(article?.content || '');
  const [categoryId, setCategoryId] = useState<number | null>(article?.categoryId || null);
  const [tagsStr, setTagsStr] = useState(article?.tags?.join(', ') || '');
  const [scenario, setScenario] = useState(article?.scenario || '');
  const [problemSolved, setProblemSolved] = useState(article?.problemSolved || '');
  const [attachments, setAttachments] = useState<Attachment[]>(article?.attachments || []);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showNewCat, setShowNewCat] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatStatus, setNewCatStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (files: FileList) => {
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        if (res.ok) {
          const data = await res.json();
          setAttachments(prev => [...prev, {
            key: data.key,
            type: data.type,
            name: data.name,
            size: data.size,
          }]);
        } else {
          const data = await res.json();
          alert(data.error || '上传失败');
        }
      }
    } catch {
      alert('上传出错');
    }
    setUploading(false);
  };

  const handleRemoveAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const res = await fetch('/api/knowledge/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setCategoryId(data.category.id);
        setNewCatStatus(data.reviewStatus);
        setShowNewCat(false);
        setNewCatName('');
        // 通知父组件刷新分类
        setTimeout(() => {
          // 父组件通过categories prop自动更新
        }, 500);
      } else {
        const data = await res.json();
        alert(data.error || '创建分类失败');
      }
    } catch {
      alert('创建分类出错');
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const tags = tagsStr.split(/[,，]/).map(t => t.trim()).filter(Boolean);
      const body: Record<string, unknown> = {
        title: title.trim(),
        content,
        categoryId,
        // 兼容旧category字段：从分类中查找名称
        category: categories.find(c => c.id === categoryId)?.name || '',
        tags,
        scenario,
        problemSolved,
        attachments,
      };

      let reviewStatus: string | undefined;

      if (isEdit) {
        body.articleId = article!.id;
        const res = await fetch('/api/knowledge', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const json = await res.json();
          reviewStatus = json.reviewStatus;
        }
      } else {
        const res = await fetch('/api/knowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const json = await res.json();
          reviewStatus = json.reviewStatus;
        }
      }
      onSaved(reviewStatus);
    } catch {
      // ignore
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-6 overflow-y-auto pb-8">
      <div className="bg-card rounded-xl shadow-lg w-full max-w-2xl mx-4">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="text-base font-bold text-foreground">{isEdit ? '编辑文章' : '新建文章'}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">标题 *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="输入知识标题"
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#2978B5]/30"
            />
          </div>

          {/* Category + Tags */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">分类</label>
              <div className="flex items-center gap-1">
                <select
                  value={categoryId || ''}
                  onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : null)}
                  className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#2978B5]/30"
                >
                  <option value="">选择分类</option>
                  {categories.filter(c => c.status === 'active').map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowNewCat(!showNewCat)}
                  className="p-2 rounded-md border border-border bg-background text-muted-foreground hover:text-[#2978B5] hover:border-[#2978B5]/30 transition"
                  title="新建分类"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {newCatStatus && (
                <p className="text-xs text-[#22c55e] mt-1">{newCatStatus}</p>
              )}
              {showNewCat && (
                <div className="flex items-center gap-1 mt-2">
                  <input
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    placeholder="新分类名称"
                    className="flex-1 px-2 py-1 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#2978B5]/30"
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateCategory(); }}
                  />
                  <button
                    onClick={handleCreateCategory}
                    className="px-2 py-1 text-xs rounded-md bg-[#2978B5] text-white hover:opacity-90"
                  >
                    创建
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">标签（逗号分隔）</label>
              <input
                value={tagsStr}
                onChange={e => setTagsStr(e.target.value)}
                placeholder="如: 糖尿病, 诊断, 服务用语"
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#2978B5]/30"
              />
            </div>
          </div>

          {/* Scenario & Problem */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground flex items-center gap-1 mb-1">
                <Target className="w-3.5 h-3.5 text-[#2978B5]" />应用场景
              </label>
              <textarea
                value={scenario}
                onChange={e => setScenario(e.target.value)}
                placeholder="这个知识点在什么场景下使用？"
                className="w-full h-20 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-[#2978B5]/30"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground flex items-center gap-1 mb-1">
                <HelpCircle className="w-3.5 h-3.5 text-[#F59E0B]" />解决的问题
              </label>
              <textarea
                value={problemSolved}
                onChange={e => setProblemSolved(e.target.value)}
                placeholder="这个知识点解决什么问题？"
                className="w-full h-20 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-[#2978B5]/30"
              />
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">内容 *</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="输入知识内容..."
              className="w-full h-48 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-[#2978B5]/30"
            />
          </div>

          {/* Attachments */}
          <div>
            <label className="text-sm font-medium text-foreground flex items-center gap-1 mb-2">
              <Paperclip className="w-3.5 h-3.5 text-[#2978B5]" />附件
            </label>
            <div className="space-y-2">
              {/* Upload button */}
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xlsx,.xls,.csv"
                  className="hidden"
                  onChange={e => { if (e.target.files) handleUpload(e.target.files); e.target.value = ''; }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-dashed border-border bg-muted/30 text-muted-foreground hover:text-[#2978B5] hover:border-[#2978B5]/30 transition disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {uploading ? '上传中...' : '上传文件'}
                </button>
                <span className="text-xs text-muted-foreground">
                  支持图片/音频/视频/文档/表格
                </span>
              </div>

              {/* Uploaded list */}
              {attachments.length > 0 && (
                <div className="space-y-1">
                  {attachments.map((att, idx) => {
                    const Icon = getFileIcon(att.type);
                    return (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-md bg-muted/20 border border-border/30">
                        <Icon className="w-3.5 h-3.5 text-[#2978B5] shrink-0" />
                        <span className="text-sm text-foreground truncate flex-1">{att.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">({formatFileSize(att.size)})</span>
                        <button
                          onClick={() => handleRemoveAttachment(idx)}
                          className="text-muted-foreground hover:text-destructive transition shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 审核提示 */}
          {!isTrainingManager && (
            <div className="flex items-center gap-2 p-3 bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-lg">
              <AlertCircle className="w-4 h-4 text-[#F59E0B] shrink-0" />
              <span className="text-sm text-[#F59E0B]">提交后将进入审核流程，由培训负责人审核通过后发布</span>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-border flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground">取消</button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="bg-[#2978B5] text-white px-5 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? '保存中...' : isEdit ? '更新' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Article Detail View ────────────────────────────────

function ArticleDetail({
  article,
  onBack,
  onEdit,
  onDelete,
  onToggleBookmark,
  onApprove,
  onReject,
  isTrainingManager,
  isTrainee,
}: {
  article: Article;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleBookmark: () => void;
  onApprove: () => void;
  onReject: () => void;
  isTrainingManager: boolean;
  isTrainee: boolean;
}) {
  const displayName = article.categoryName || article.category;
  const catColor = getCatColor(displayName);
  const statusCfg = STATUS_CONFIG[article.status] || STATUS_CONFIG.draft;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-[#2978B5] hover:underline">
          <ChevronRight className="w-3 h-3 rotate-180" />返回知识库
        </button>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${statusCfg.bgColor} ${statusCfg.color}`}>
            <StatusIcon className="w-3 h-3" />{statusCfg.label}
          </span>
          {!isTrainee && (
            <>
              <button onClick={onEdit} className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
                <Edit2 className="w-4 h-4" />
              </button>
              {isTrainingManager && (
                <button onClick={onDelete} className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="bg-card rounded-lg shadow-card p-8">
        {/* Tags row */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${catColor.bg} ${catColor.text}`}>
            {displayName}
          </span>
          {article.tags.map(t => (
            <span key={t} className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded flex items-center gap-1">
              <Tag className="w-2.5 h-2.5" />{t}
            </span>
          ))}
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-foreground mb-3">{article.title}</h1>

        {/* Scenario & Problem */}
        {(article.scenario || article.problemSolved) && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            {article.scenario && (
              <div className="bg-[#2978B5]/5 rounded-lg p-3 border border-[#2978B5]/10">
                <div className="flex items-center gap-1.5 mb-1">
                  <Target className="w-3.5 h-3.5 text-[#2978B5]" />
                  <span className="text-xs font-semibold text-[#2978B5]">应用场景</span>
                </div>
                <p className="text-sm text-foreground/80">{article.scenario}</p>
              </div>
            )}
            {article.problemSolved && (
              <div className="bg-[#F59E0B]/5 rounded-lg p-3 border border-[#F59E0B]/10">
                <div className="flex items-center gap-1.5 mb-1">
                  <HelpCircle className="w-3.5 h-3.5 text-[#F59E0B]" />
                  <span className="text-xs font-semibold text-[#F59E0B]">解决的问题</span>
                </div>
                <p className="text-sm text-foreground/80">{article.problemSolved}</p>
              </div>
            )}
          </div>
        )}

        {/* Meta */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
          <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{article.viewCount}</span>
          <span>{new Date(article.updatedAt).toLocaleDateString('zh-CN')}</span>
        </div>

        {/* Content */}
        <div className="prose max-w-none text-foreground/90 leading-relaxed whitespace-pre-wrap">
          {article.content}
        </div>

        {/* Attachments */}
        <AttachmentList attachments={article.attachments} />

        {/* Bottom actions */}
        <div className="flex items-center gap-4 mt-8 pt-6 border-t border-border/40">
          <button
            onClick={onToggleBookmark}
            className={`flex items-center gap-1.5 text-sm ${
              article.isBookmarked ? 'text-[#F59E0B]' : 'text-muted-foreground hover:text-foreground'
            } transition`}
          >
            {article.isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            {article.isBookmarked ? '已收藏' : '收藏'}
          </button>

          {isTrainingManager && article.status === 'pending_review' && (
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={onReject}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 transition"
              >
                <XCircle className="w-4 h-4" />驳回
              </button>
              <button
                onClick={onApprove}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-[#22c55e] text-white hover:bg-[#22c55e]/90 transition"
              >
                <CheckCircle className="w-4 h-4" />通过
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Review Panel (for training_manager) ────────────────

interface PendingArticle {
  id: number;
  title: string;
  category: string;
  authorId: string;
  authorName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

function ReviewPanel({ onApprove, onReject }: { onApprove: (id: number) => void; onReject: (id: number) => void }) {
  const [pendingArticles, setPendingArticles] = useState<PendingArticle[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch('/api/knowledge/review');
      if (res.ok) {
        const data = await res.json();
        setPendingArticles(data.articles || []);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const handleApprove = async (id: number) => {
    const res = await fetch('/api/knowledge/review', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId: id, action: 'approve' }),
    });
    if (res.ok) {
      setPendingArticles(prev => prev.filter(a => a.id !== id));
      onApprove(id);
    }
  };

  const handleReject = async (id: number) => {
    const res = await fetch('/api/knowledge/review', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId: id, action: 'reject' }),
    });
    if (res.ok) {
      setPendingArticles(prev => prev.filter(a => a.id !== id));
      onReject(id);
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-lg shadow-card p-4 mb-5">
        <div className="h-6 w-32 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (pendingArticles.length === 0) return null;

  return (
    <div className="bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-lg p-4 mb-5">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-[#F59E0B]" />
        <h3 className="text-sm font-semibold text-[#F59E0B]">待审核文章 ({pendingArticles.length})</h3>
      </div>
      <div className="space-y-2">
        {pendingArticles.map(a => (
          <div key={a.id} className="bg-card rounded-lg p-3 flex items-center justify-between border border-border/50">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span>{a.category}</span>
                <span>·</span>
                <span>提交人: {a.authorName}</span>
                <span>·</span>
                <span>{new Date(a.updatedAt).toLocaleDateString('zh-CN')}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-3 shrink-0">
              <button
                onClick={() => handleReject(a.id)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 transition"
              >
                <XCircle className="w-3.5 h-3.5" />驳回
              </button>
              <button
                onClick={() => handleApprove(a.id)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-[#22c55e] text-white hover:bg-[#22c55e]/90 transition"
              >
                <CheckCircle className="w-3.5 h-3.5" />通过
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────

export default function KnowledgeBasePage() {
  const { user } = useAuth();
  const role = user?.role || 'trainee';
  const isTrainee = role === 'trainee';
  const isTrainingManager = role === 'training_manager';
  const canEdit = !isTrainee;

  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dbTags, setDbTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [activeTag, setActiveTag] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [editorArticle, setEditorArticle] = useState<Article | null | 'new'>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [reviewToast, setReviewToast] = useState<string | null>(null);

  const fetchArticles = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (user?.id) params.set('userId', user.id);
      if (activeCategoryId) params.set('categoryId', String(activeCategoryId));
      if (activeTag) params.set('tag', activeTag);
      if (searchQuery) params.set('search', searchQuery);
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/knowledge?${params}`);
      if (res.ok) {
        const data = await res.json();
        setArticles(data.articles || []);
        setDbTags(data.tags || []);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, [user?.id, activeCategoryId, activeTag, searchQuery, statusFilter]);

  // 获取分类列表
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/knowledge/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    setLoading(true);
  }, [activeCategoryId, activeTag, searchQuery, statusFilter]);

  useEffect(() => {
    if (reviewToast) {
      const timer = setTimeout(() => setReviewToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [reviewToast]);

  const toggleBookmark = async (id: number) => {
    const article = articles.find(a => a.id === id);
    if (!article) return;
    const action = article.isBookmarked ? 'unbookmark' : 'bookmark';
    setArticles(prev => prev.map(a =>
      a.id === id ? { ...a, isBookmarked: !a.isBookmarked, bookmarkCount: a.bookmarkCount + (a.isBookmarked ? -1 : 1) } : a
    ));
    fetch('/api/knowledge/interact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user?.id, articleId: id, action }),
    }).catch(() => {});
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此文章？')) return;
    const res = await fetch(`/api/knowledge?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setSelectedArticle(null);
      fetchArticles();
    } else {
      const data = await res.json();
      alert(data.error || '删除失败');
    }
  };

  const handleReview = async (articleId: number, action: 'approve' | 'reject') => {
    const res = await fetch('/api/knowledge/review', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId, action }),
    });
    if (res.ok) {
      fetchArticles();
      if (selectedArticle?.id === articleId) {
        setSelectedArticle(prev => prev ? { ...prev, status: action === 'approve' ? 'approved' : 'rejected' } : null);
      }
    }
  };

  const handleEditorSaved = (reviewStatus?: string) => {
    setEditorArticle(null);
    fetchArticles();
    fetchCategories(); // 刷新分类（可能新建了分类）
    if (reviewStatus === 'pending_review') {
      setReviewToast('已提交审核，等待培训负责人审核通过后发布');
    } else if (reviewStatus === 'approved') {
      setReviewToast('文章已直接发布');
    }
  };

  const filtered = articles.filter(a => {
    if (showBookmarks && !a.isBookmarked) return false;
    return true;
  });

  const activeCategories = categories.filter(c => c.status === 'active');

  // Detail view
  if (selectedArticle) {
    return (
      <div className="space-y-5 relative">
        {reviewToast && (
          <div className="fixed top-4 right-4 z-50 bg-card border border-[#F59E0B]/30 rounded-lg shadow-lg p-3 flex items-center gap-2 max-w-sm">
            <CheckCircle className="w-4 h-4 text-[#22c55e] shrink-0" />
            <span className="text-sm text-foreground">{reviewToast}</span>
          </div>
        )}
        <ArticleDetail
          article={selectedArticle}
          onBack={() => setSelectedArticle(null)}
          onEdit={() => setEditorArticle(selectedArticle)}
          onDelete={() => handleDelete(selectedArticle.id)}
          onToggleBookmark={() => toggleBookmark(selectedArticle.id)}
          onApprove={() => handleReview(selectedArticle.id, 'approve')}
          onReject={() => handleReview(selectedArticle.id, 'reject')}
          isTrainingManager={isTrainingManager}
          isTrainee={isTrainee}
        />
        {editorArticle !== null && (
          <ArticleEditor
            article={editorArticle === 'new' ? null : editorArticle}
            onClose={() => setEditorArticle(null)}
            onSaved={handleEditorSaved}
            userRole={role}
            categories={activeCategories}
          />
        )}
      </div>
    );
  }

  // Editor dialog
  if (editorArticle !== null) {
    return (
      <ArticleEditor
        article={editorArticle === 'new' ? null : editorArticle}
        onClose={() => setEditorArticle(null)}
        onSaved={handleEditorSaved}
        userRole={role}
        categories={activeCategories}
      />
    );
  }

  return (
    <div className="space-y-5 relative">
      {reviewToast && (
        <div className="fixed top-4 right-4 z-50 bg-card border border-[#2978B5]/30 rounded-lg shadow-lg p-3 flex items-center gap-2 max-w-sm animate-in slide-in-from-top-2">
          <CheckCircle className="w-4 h-4 text-[#22c55e] shrink-0" />
          <span className="text-sm text-foreground">{reviewToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#2978B5]" />
          <h1 className="text-xl font-semibold text-foreground">知识库</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBookmarks(!showBookmarks)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition ${
              showBookmarks ? 'bg-[#F59E0B]/10 text-[#F59E0B]' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {showBookmarks ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            {showBookmarks ? '我的收藏' : '收藏'}
          </button>
          {canEdit && (
            <button
              onClick={() => setEditorArticle('new')}
              className="bg-[#2978B5] text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />新建
            </button>
          )}
        </div>
      </div>

      {/* 待审核面板 */}
      {isTrainingManager && (
        <ReviewPanel
          onApprove={() => fetchArticles()}
          onReject={() => fetchArticles()}
        />
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground focus:ring-1 focus:ring-[#2978B5] focus:border-[#2978B5]"
          placeholder="搜索知识库（标题、标签）..."
        />
      </div>

      {/* Category filters — 动态分类 */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-muted-foreground" />
        <button
          onClick={() => setActiveCategoryId(null)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
            !activeCategoryId ? 'bg-[#2978B5] text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          全部
        </button>
        {activeCategories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategoryId(cat.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
              activeCategoryId === cat.id
                ? 'bg-[#2978B5] text-white'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Tag filters */}
      {dbTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Tag className="w-3.5 h-3.5 text-muted-foreground" />
          <button
            onClick={() => setActiveTag('')}
            className={`px-2.5 py-1 text-xs rounded-md transition ${
              !activeTag ? 'bg-[#2978B5]/15 text-[#2978B5]' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            全部标签
          </button>
          {dbTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? '' : tag)}
              className={`px-2.5 py-1 text-xs rounded-md transition ${
                activeTag === tag
                  ? 'bg-[#2978B5]/15 text-[#2978B5]'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Status filter */}
      {!isTrainee && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">状态筛选：</span>
          {[
            { key: 'all', label: '全部' },
            { key: 'pending_review', label: '待审核' },
            { key: 'approved', label: '已通过' },
            { key: 'rejected', label: '已驳回' },
            { key: 'draft', label: '草稿' },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => setStatusFilter(s.key)}
              className={`px-2.5 py-1 text-xs rounded-md transition ${
                statusFilter === s.key
                  ? 'bg-[#2978B5]/15 text-[#2978B5] font-medium'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '文章总数', value: filtered.length, icon: BookOpen, color: 'text-[#2978B5]', bg: 'bg-[#2978B5]/10' },
          { label: '总阅读量', value: filtered.reduce((s, a) => s + a.viewCount, 0), icon: Eye, color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10' },
          { label: '我的收藏', value: filtered.filter(a => a.isBookmarked).length, icon: Bookmark, color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/10' },
        ].map((s, i) => (
          <div key={i} className="bg-card rounded-lg shadow-card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <div>
              <div className="text-xl font-bold text-foreground">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Article list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-card rounded-lg p-12 text-center">
            <BookOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm mb-4">{showBookmarks ? '暂无收藏的文章' : '暂无匹配的文章'}</p>
            {!showBookmarks && (
              <button onClick={() => setEditorArticle('new')} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                <Plus className="w-4 h-4" />
                创建第一篇文章
              </button>
            )}
          </div>
        ) : filtered.map(article => {
          const displayName = article.categoryName || article.category;
          const catColor = getCatColor(displayName);
          const statusCfg = STATUS_CONFIG[article.status] || STATUS_CONFIG.draft;
          const StatusIcon = statusCfg.icon;
          const hasAttachments = article.attachments && article.attachments.length > 0;

          return (
            <div
              key={article.id}
              className="bg-card rounded-lg shadow-card p-5 hover:shadow-card/80 transition cursor-pointer border border-border/50 hover:border-border"
              onClick={() => setSelectedArticle(article)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${catColor.bg} ${catColor.text}`}>
                      {displayName}
                    </span>
                    {article.tags.slice(0, 3).map(t => (
                      <span key={t} className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <Tag className="w-2.5 h-2.5" />{t}
                      </span>
                    ))}
                    {article.isBookmarked && <BookmarkCheck className="w-3.5 h-3.5 text-[#F59E0B]" />}
                    {hasAttachments && (
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <Paperclip className="w-2.5 h-2.5" />{article.attachments.length}
                      </span>
                    )}
                    {article.status !== 'approved' && article.status !== 'published' && (
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded ${statusCfg.bgColor} ${statusCfg.color}`}>
                        <StatusIcon className="w-3 h-3" />{statusCfg.label}
                      </span>
                    )}
                  </div>

                  <h3 className="font-semibold text-foreground mb-1.5 hover:text-[#2978B5] transition">{article.title}</h3>

                  {(article.scenario || article.problemSolved) && (
                    <div className="flex items-center gap-4 mb-2">
                      {article.scenario && (
                        <span className="text-xs text-[#2978B5] flex items-center gap-1 line-clamp-1">
                          <Target className="w-3 h-3 shrink-0" />{article.scenario}
                        </span>
                      )}
                      {article.problemSolved && (
                        <span className="text-xs text-[#F59E0B] flex items-center gap-1 line-clamp-1">
                          <HelpCircle className="w-3 h-3 shrink-0" />{article.problemSolved}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{article.viewCount}</span>
                    <span>{new Date(article.updatedAt).toLocaleDateString('zh-CN')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 ml-4">
                  <button
                    onClick={e => { e.stopPropagation(); toggleBookmark(article.id); }}
                    className={`p-1.5 rounded-lg transition ${
                      article.isBookmarked
                        ? 'text-[#F59E0B] bg-[#F59E0B]/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {article.isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                  </button>
                  {canEdit && (
                    <button
                      onClick={e => { e.stopPropagation(); setEditorArticle(article); }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {isTrainingManager && article.status === 'pending_review' && (
                    <>
                      <button
                        onClick={e => { e.stopPropagation(); handleReview(article.id, 'reject'); }}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                        title="驳回"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleReview(article.id, 'approve'); }}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-[#22c55e] hover:bg-[#22c55e]/10 transition"
                        title="通过"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
