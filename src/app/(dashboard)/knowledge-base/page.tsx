'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth/context';
import {
  BookOpen, Search, Tag, Bookmark, BookmarkCheck, Eye,
  ChevronRight, Filter, Plus, Edit2, Trash2, X, Target, HelpCircle
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────

interface Article {
  id: number;
  title: string;
  content: string;
  category: string;
  tags: string[];
  scenario: string;
  problemSolved: string;
  authorId: string;
  status: string;
  viewCount: number;
  bookmarkCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  isBookmarked: boolean;
}

// ─── Category colors ────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  '糖尿病基础': { bg: 'bg-[#2978B5]/10', text: 'text-[#2978B5]' },
  '服务用语技巧': { bg: 'bg-[#F59E0B]/10', text: 'text-[#F59E0B]' },
  '业务流程': { bg: 'bg-[#22c55e]/10', text: 'text-[#22c55e]' },
  '案例分析': { bg: 'bg-destructive/10', text: 'text-destructive' },
  '制度规范': { bg: 'bg-[#2978B5]/10', text: 'text-[#2978B5]' },
  '产品知识': { bg: 'bg-purple-500/10', text: 'text-purple-500' },
};

const ALL_CATEGORIES = ['糖尿病基础', '服务用语技巧', '业务流程', '案例分析', '制度规范', '产品知识'];

// ─── Edit/Create Dialog ─────────────────────────────────

function ArticleEditor({
  article,
  onClose,
  onSaved,
}: {
  article: Article | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!article;
  const [title, setTitle] = useState(article?.title || '');
  const [content, setContent] = useState(article?.content || '');
  const [category, setCategory] = useState(article?.category || '');
  const [tagsStr, setTagsStr] = useState(article?.tags?.join(', ') || '');
  const [scenario, setScenario] = useState(article?.scenario || '');
  const [problemSolved, setProblemSolved] = useState(article?.problemSolved || '');
  const [status, setStatus] = useState(article?.status || 'draft');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const tags = tagsStr.split(/[,，]/).map(t => t.trim()).filter(Boolean);
      const body: Record<string, unknown> = {
        title: title.trim(),
        content,
        category,
        tags,
        scenario,
        problemSolved,
        status,
      };

      if (isEdit) {
        body.articleId = article!.id;
        const res = await fetch('/api/knowledge', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) onSaved();
      } else {
        const res = await fetch('/api/knowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) onSaved();
      }
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
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#2978B5]/30"
              >
                <option value="">选择分类</option>
                {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
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

          {/* Status */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">状态</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-sm">
                <input type="radio" name="status" checked={status === 'draft'} onChange={() => setStatus('draft')} />
                <span className="text-muted-foreground">草稿</span>
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input type="radio" name="status" checked={status === 'published'} onChange={() => setStatus('published')} />
                <span className="text-muted-foreground">发布</span>
              </label>
            </div>
          </div>
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
}: {
  article: Article;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleBookmark: () => void;
}) {
  const catColor = CATEGORY_COLORS[article.category] || { bg: 'bg-muted', text: 'text-muted-foreground' };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-[#2978B5] hover:underline">
          <ChevronRight className="w-3 h-3 rotate-180" />返回知识库
        </button>
        <div className="flex items-center gap-2">
          <button onClick={onEdit} className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-card rounded-lg shadow-card p-8">
        {/* Tags row */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${catColor.bg} ${catColor.text}`}>
            {article.category}
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
          {article.status === 'draft' && (
            <span className="text-xs bg-muted px-2 py-0.5 rounded">草稿</span>
          )}
        </div>

        {/* Content */}
        <div className="prose max-w-none text-foreground/90 leading-relaxed whitespace-pre-wrap">
          {article.content}
        </div>

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
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────

export default function KnowledgeBasePage() {
  const { user } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const [dbTags, setDbTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeTag, setActiveTag] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [editorArticle, setEditorArticle] = useState<Article | null | 'new'>(null);

  const isManager = user?.role !== 'trainee'; // non-trainees can edit

  const fetchArticles = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (user?.id) params.set('userId', user.id);
      if (activeCategory !== 'all') params.set('category', activeCategory);
      if (activeTag) params.set('tag', activeTag);
      if (searchQuery) params.set('search', searchQuery);
      // For managers, show all including drafts
      if (isManager) params.set('status', '');

      const res = await fetch(`/api/knowledge?${params}`);
      if (res.ok) {
        const data = await res.json();
        setArticles(data.articles || []);
        setDbCategories(data.categories || []);
        setDbTags(data.tags || []);
        return;
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, [user?.id, activeCategory, activeTag, searchQuery, isManager]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  useEffect(() => {
    setLoading(true);
  }, [activeCategory, activeTag, searchQuery]);

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
    }
  };

  const filtered = articles.filter(a => {
    if (showBookmarks && !a.isBookmarked) return false;
    return true;
  });

  const categories = ['all', ...dbCategories];
  const tags = dbTags;

  // Detail view
  if (selectedArticle) {
    return (
      <ArticleDetail
        article={selectedArticle}
        onBack={() => setSelectedArticle(null)}
        onEdit={() => setEditorArticle(selectedArticle)}
        onDelete={() => handleDelete(selectedArticle.id)}
        onToggleBookmark={() => toggleBookmark(selectedArticle.id)}
      />
    );
  }

  // Editor dialog
  if (editorArticle !== null) {
    return (
      <ArticleEditor
        article={editorArticle === 'new' ? null : editorArticle}
        onClose={() => setEditorArticle(null)}
        onSaved={() => { setEditorArticle(null); fetchArticles(); }}
      />
    );
  }

  return (
    <div className="space-y-5">
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
          {isManager && (
            <button
              onClick={() => setEditorArticle('new')}
              className="bg-[#2978B5] text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />新建
            </button>
          )}
        </div>
      </div>

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

      {/* Category filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-muted-foreground" />
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
              activeCategory === cat
                ? 'bg-[#2978B5] text-white'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {cat === 'all' ? '全部' : cat}
          </button>
        ))}
      </div>

      {/* Tag filters */}
      {tags.length > 0 && (
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
          {tags.map(tag => (
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '文章总数', value: articles.length, icon: BookOpen, color: 'text-[#2978B5]', bg: 'bg-[#2978B5]/10' },
          { label: '总阅读量', value: articles.reduce((s, a) => s + a.viewCount, 0), icon: Eye, color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10' },
          { label: '我的收藏', value: articles.filter(a => a.isBookmarked).length, icon: Bookmark, color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/10' },
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
            <p className="text-muted-foreground text-sm">{showBookmarks ? '暂无收藏的文章' : '暂无匹配的文章'}</p>
          </div>
        ) : filtered.map(article => {
          const catColor = CATEGORY_COLORS[article.category] || { bg: 'bg-muted', text: 'text-muted-foreground' };
          return (
            <div
              key={article.id}
              className="bg-card rounded-lg shadow-card p-5 hover:shadow-card/80 transition cursor-pointer border border-border/50 hover:border-border"
              onClick={() => setSelectedArticle(article)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  {/* Tags row */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${catColor.bg} ${catColor.text}`}>
                      {article.category}
                    </span>
                    {article.tags.slice(0, 3).map(t => (
                      <span key={t} className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <Tag className="w-2.5 h-2.5" />{t}
                      </span>
                    ))}
                    {article.isBookmarked && <BookmarkCheck className="w-3.5 h-3.5 text-[#F59E0B]" />}
                    {article.status === 'draft' && (
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">草稿</span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="font-semibold text-foreground mb-1.5 hover:text-[#2978B5] transition">{article.title}</h3>

                  {/* Scenario & Problem preview */}
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

                  {/* Meta */}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{article.viewCount}</span>
                    <span>{new Date(article.updatedAt).toLocaleDateString('zh-CN')}</span>
                  </div>
                </div>

                {/* Actions */}
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
                  {isManager && (
                    <button
                      onClick={e => { e.stopPropagation(); setEditorArticle(article); }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
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
