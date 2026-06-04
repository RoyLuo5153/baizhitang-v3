'use client';

import { BookOpen, FileText, Video, Search, Upload, Headphones, FolderTree, ChevronRight, ChevronDown, Plus, Trash2, Pencil, X, Eye, ArrowUp, ArrowDown, Download, Loader2, Shield, Phone, MessageSquare, AlertCircle, UserPlus, ListChecks, Star, ShieldCheck, Pill } from 'lucide-react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth/context';

// === Types ===

interface Category {
  id: number;
  name: string;
  parentId: number | null;
  sortOrder: number;
  icon: string | null;
  resourceCount: number;
}

interface Resource {
  id: number;
  title: string;
  category: string;
  categoryId: number | null;
  categoryName: string;
  fileType: string;
  fileUrl: string | null;
  description: string;
  uploadedBy: string | null;
  viewCount: number;
  downloadCount: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

const TYPE_CONFIG: Record<string, { icon: typeof FileText; label: string; color: string }> = {
  document: { icon: FileText, label: '文档', color: 'text-primary' },
  audio: { icon: Headphones, label: '音频', color: 'text-[#f59e0b]' },
  video: { icon: Video, label: '视频', color: 'text-destructive' },
};

const ICON_MAP: Record<string, typeof FileText> = {
  BookOpen, Headphones, FileText, Shield, Phone, MessageSquare, AlertCircle,
  UserPlus, ListChecks, Star, ShieldCheck, Pill, FolderTree,
};

// === Category Tree Node ===

interface CatNode {
  cat: Category;
  children: CatNode[];
  level: number;
}

function buildTree(categories: Category[]): CatNode[] {
  const map = new Map<number, CatNode>();
  categories.forEach(c => map.set(c.id, { cat: c, children: [], level: 0 }));

  const roots: CatNode[] = [];
  categories.forEach(c => {
    const node = map.get(c.id)!;
    if (c.parentId && map.has(c.parentId)) {
      const parent = map.get(c.parentId)!;
      node.level = parent.level + 1;
      parent.children.push(node);
    } else {
      node.level = 0;
      roots.push(node);
    }
  });
  return roots;
}

// === Upload Dialog ===

function UploadDialog({ categories, onClose, onSaved }: { categories: Category[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: '',
    categoryId: categories[0]?.id || null,
    fileType: 'document',
    fileUrl: '',
    description: '',
    tagsInput: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError('标题不能为空'); return; }
    setSaving(true);
    setError('');
    try {
      const tags = form.tagsInput.split(/[,，]/).map(t => t.trim()).filter(Boolean);
      const res = await fetch('/api/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          categoryId: form.categoryId,
          fileType: form.fileType,
          fileUrl: form.fileUrl || null,
          description: form.description,
          tags,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || '上传失败');
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setSaving(false);
    }
  };

  const flatCategories = useMemo(() => {
    const result: { id: number; name: string; level: number }[] = [];
    const tree = buildTree(categories);
    function walk(nodes: CatNode[]) {
      for (const n of nodes) {
        result.push({ id: n.cat.id, name: n.cat.name, level: n.level });
        walk(n.children);
      }
    }
    walk(tree);
    return result;
  }, [categories]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-card rounded-lg shadow-lg w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-foreground">上传资料</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">标题</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" placeholder="资料标题" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">分类</label>
            <select value={form.categoryId || ''} onChange={e => setForm(p => ({ ...p, categoryId: Number(e.target.value) }))}
              className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30">
              {flatCategories.map(c => (
                <option key={c.id} value={c.id}>{'\u00A0\u00A0'.repeat(c.level)}{c.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">类型</label>
              <select value={form.fileType} onChange={e => setForm(p => ({ ...p, fileType: e.target.value }))}
                className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30">
                <option value="document">文档</option>
                <option value="audio">音频</option>
                <option value="video">视频</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">文件链接</label>
              <input value={form.fileUrl} onChange={e => setForm(p => ({ ...p, fileUrl: e.target.value }))}
                className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" placeholder="URL（可选）" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">描述</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className="w-full h-20 rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" placeholder="资料说明" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">标签（逗号分隔）</label>
            <input value={form.tagsInput} onChange={e => setForm(p => ({ ...p, tagsInput: e.target.value }))}
              className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" placeholder="例：糖尿病,服务用语,首通电话" />
          </div>
        </div>
        {error && <div className="mt-3 flex items-center gap-1.5 text-sm text-destructive"><X className="w-3.5 h-3.5" />{error}</div>}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">取消</button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : '上传'}
          </button>
        </div>
      </div>
    </div>
  );
}

// === Category Add Dialog ===

function CategoryAddDialog({ parentId, categories, onClose, onSaved }: { parentId: number | null; categories: Category[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const parentName = parentId ? categories.find(c => c.id === parentId)?.name : '根分类';
  const childLevel = parentId ? (categories.find(c => c.id === parentId)?.sortOrder || 0) + 1 : 1;

  const handleSubmit = async () => {
    if (!name.trim()) { setError('分类名称不能为空'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/resources/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentId }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || '创建失败'); }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-card rounded-lg shadow-lg w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-foreground">新增分类</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground">父级分类: {parentName}（第{childLevel}级）</div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">分类名称</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" placeholder="输入分类名称" />
          </div>
        </div>
        {error && <div className="mt-3 text-sm text-destructive">{error}</div>}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">取消</button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}

// === Preview Dialog ===

function PreviewDialog({ resource, onClose }: { resource: Resource; onClose: () => void }) {
  const TypeIcon = TYPE_CONFIG[resource.fileType]?.icon || FileText;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-card rounded-lg shadow-lg w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center"><TypeIcon className="w-5 h-5 text-primary" /></div>
            <div>
              <h3 className="text-base font-semibold text-foreground">{resource.title}</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span>{resource.categoryName}</span>
                <span>·</span>
                <span>{TYPE_CONFIG[resource.fileType]?.label || resource.fileType}</span>
                <span>·</span>
                <span>{resource.viewCount}次浏览</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        {resource.description && (
          <div className="p-3 bg-muted/50 rounded-lg mb-4 text-sm text-foreground">{resource.description}</div>
        )}
        {resource.tags.length > 0 && (
          <div className="flex items-center gap-1.5 mb-4">
            {resource.tags.map(tag => (
              <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs bg-primary/10 text-primary">{tag}</span>
            ))}
          </div>
        )}
        {resource.fileUrl ? (
          <div className="border border-border rounded-lg overflow-hidden">
            {resource.fileType === 'video' ? (
              <video src={resource.fileUrl} controls className="w-full max-h-[50vh]" />
            ) : resource.fileType === 'audio' ? (
              <div className="p-6"><audio src={resource.fileUrl} controls className="w-full" /></div>
            ) : (
              <iframe src={resource.fileUrl} className="w-full h-[50vh]" title={resource.title} />
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">暂无文件预览</div>
        )}
      </div>
    </div>
  );
}

// === Main Page ===

export default function ResourcesPage() {
  const { user } = useAuth();
  const isTrainee = user?.role === 'trainee';
  const [categories, setCategories] = useState<Category[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [activeType, setActiveType] = useState<string>('all');
  const [expandedCats, setExpandedCats] = useState<Set<number>>(new Set());
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showAddCatDialog, setShowAddCatDialog] = useState<{ parentId: number | null } | null>(null);
  const [previewResource, setPreviewResource] = useState<Resource | null>(null);
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [editCatName, setEditCatName] = useState('');

  // Fetch data
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/resources/categories');
      if (res.ok) {
        const json = await res.json();
        setCategories(json.categories || []);
      }
    } catch {}
  }, []);

  const fetchResources = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCategoryId) params.set('categoryId', String(activeCategoryId));
      if (searchQuery) params.set('search', searchQuery);
      if (activeType !== 'all') params.set('fileType', activeType);
      const res = await fetch(`/api/resources?${params}`);
      if (res.ok) {
        const json = await res.json();
        setResources(json.resources || []);
      }
    } catch {}
    setLoading(false);
  }, [activeCategoryId, searchQuery, activeType]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { fetchResources(); }, [fetchResources]);

  // Auto-expand parents when selecting
  useEffect(() => {
    if (activeCategoryId) {
      const path = getCategoryPath(activeCategoryId, categories);
      setExpandedCats(prev => {
        const next = new Set(prev);
        path.forEach(id => next.add(id));
        return next;
      });
    }
  }, [activeCategoryId, categories]);

  const tree = useMemo(() => buildTree(categories), [categories]);

  const toggleCat = (id: number) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const stats = useMemo(() => {
    const byType = { document: 0, audio: 0, video: 0 };
    resources.forEach(r => { if (byType[r.fileType as keyof typeof byType] !== undefined) byType[r.fileType as keyof typeof byType]++; });
    return byType;
  }, [resources]);

  // Category CRUD
  const handleDeleteCat = async (id: number) => {
    if (!confirm('确定要删除此分类吗？')) return;
    const res = await fetch(`/api/resources/categories?id=${id}`, { method: 'DELETE' });
    if (res.ok) { fetchCategories(); } else { const j = await res.json(); alert(j.error); }
  };

  const handleRenameCat = async (id: number, newName: string) => {
    if (!newName.trim()) return;
    await fetch('/api/resources/categories', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: newName }),
    });
    setEditingCatId(null);
    fetchCategories();
  };

  const handleMoveCat = async (id: number, direction: 'up' | 'down') => {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    const siblings = categories.filter(c => c.parentId === cat.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = siblings.findIndex(s => s.id === id);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === siblings.length - 1) return;
    const swapWith = siblings[direction === 'up' ? idx - 1 : idx + 1];
    await Promise.all([
      fetch('/api/resources/categories', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, sortOrder: swapWith.sortOrder }) }),
      fetch('/api/resources/categories', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: swapWith.id, sortOrder: cat.sortOrder }) }),
    ]);
    fetchCategories();
  };

  const handleDeleteResource = async (id: number) => {
    if (!confirm('确定要删除此资料吗？')) return;
    const res = await fetch(`/api/resources?id=${id}`, { method: 'DELETE' });
    if (res.ok) fetchResources(); else { const j = await res.json(); alert(j.error); }
  };

  // Render category tree
  function renderTree(nodes: CatNode[]) {
    return nodes.map(node => {
      const isActive = activeCategoryId === node.cat.id;
      const isExpanded = expandedCats.has(node.cat.id);
      const IconComp = ICON_MAP[node.cat.icon || ''] || FolderTree;
      const hasChildren = node.children.length > 0;

      return (
        <div key={node.cat.id}>
          <div className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm transition ${
            isActive ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'
          }`} style={{ paddingLeft: `${8 + node.level * 16}px` }}>
            {hasChildren ? (
              <button onClick={() => toggleCat(node.cat.id)} className="shrink-0 p-0.5 hover:bg-muted rounded">
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
            ) : <span className="w-4 shrink-0" />}
            <button onClick={() => setActiveCategoryId(isActive ? null : node.cat.id)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
              <IconComp className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              {editingCatId === node.cat.id ? (
                <input
                  value={editCatName}
                  onChange={e => setEditCatName(e.target.value)}
                  onBlur={() => handleRenameCat(node.cat.id, editCatName)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRenameCat(node.cat.id, editCatName); if (e.key === 'Escape') setEditingCatId(null); }}
                  className="flex-1 h-6 px-1 text-xs border border-primary rounded bg-transparent outline-none min-w-0"
                  autoFocus
                />
              ) : (
                <span className="flex-1 truncate">{node.cat.name}</span>
              )}
              <span className="text-xs text-muted-foreground shrink-0">{node.cat.resourceCount}</span>
            </button>
            {/* Hover actions - hidden for trainee */}
            {!isTrainee && (
            <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
              <button onClick={() => { setEditingCatId(node.cat.id); setEditCatName(node.cat.name); }} className="p-0.5 rounded hover:bg-muted text-muted-foreground" title="重命名">
                <Pencil className="w-2.5 h-2.5" />
              </button>
              <button onClick={() => handleMoveCat(node.cat.id, 'up')} className="p-0.5 rounded hover:bg-muted text-muted-foreground" title="上移">
                <ArrowUp className="w-2.5 h-2.5" />
              </button>
              <button onClick={() => handleMoveCat(node.cat.id, 'down')} className="p-0.5 rounded hover:bg-muted text-muted-foreground" title="下移">
                <ArrowDown className="w-2.5 h-2.5" />
              </button>
              <button onClick={() => setShowAddCatDialog({ parentId: node.cat.id })} className="p-0.5 rounded hover:bg-muted text-muted-foreground" title="添加子分类">
                <Plus className="w-2.5 h-2.5" />
              </button>
              <button onClick={() => handleDeleteCat(node.cat.id)} className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="删除">
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            </div>
            )}
          </div>
          {hasChildren && isExpanded && renderTree(node.children)}
        </div>
      );
    });
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">资料中心</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">学习资料管理与知识库</p>
        </div>
        {!isTrainee && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddCatDialog({ parentId: null })}
            className="h-8 px-3 rounded-md border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            新增分类
          </button>
          <button
            onClick={() => setShowUploadDialog(true)}
            className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            上传资料
          </button>
        </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { type: 'document', label: '文档', count: stats.document, icon: FileText, color: 'text-primary' },
          { type: 'audio', label: '音频', count: stats.audio, icon: Headphones, color: 'text-[#f59e0b]' },
          { type: 'video', label: '视频', count: stats.video, icon: Video, color: 'text-destructive' },
          { type: 'total', label: '总计', count: resources.length, icon: FolderTree, color: 'text-primary' },
        ].map(item => (
          <div key={item.type} className="bg-card rounded-lg shadow-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <item.icon className={`w-5 h-5 ${item.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{item.count}</p>
              <p className="text-xs text-muted-foreground">{item.label}资料</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main: Sidebar + Content */}
      <div className="flex gap-6">
        {/* Category Tree Sidebar */}
        <div className="w-60 shrink-0 bg-card rounded-lg shadow-card p-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-2">资料分类</h3>
          <div className="space-y-0.5">
            <button
              onClick={() => setActiveCategoryId(null)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition ${
                activeCategoryId === null ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'
              }`}
            >
              <FolderTree className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">全部</span>
              <span className="text-xs text-muted-foreground">{resources.length}</span>
            </button>
            {renderTree(tree)}
          </div>
        </div>

        {/* Resource Content */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Search + Type filter */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="搜索资料名称或描述..."
              />
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setActiveType('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${activeType === 'all' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                全部
              </button>
              {Object.entries(TYPE_CONFIG).map(([type, config]) => (
                <button key={type} onClick={() => setActiveType(type)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${activeType === type ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                  {config.label}
                </button>
              ))}
            </div>
          </div>

          {/* Resource List */}
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}</div>
          ) : resources.length === 0 ? (
            <div className="bg-card rounded-lg shadow-card p-12 text-center">
              <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">未找到匹配的资料</p>
            </div>
          ) : (
            <div className="space-y-3">
              {resources.map(r => {
                const config = TYPE_CONFIG[r.fileType] || TYPE_CONFIG.document;
                const Icon = config.icon;
                return (
                  <div key={r.id} className="bg-card rounded-lg shadow-card p-4 flex items-center gap-4 border border-border/50 hover:shadow-float transition-shadow group">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Icon className={`w-5 h-5 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.description}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs bg-muted text-muted-foreground">{r.categoryName}</span>
                        <span className="text-xs text-muted-foreground">{config.label}</span>
                        <span className="text-xs text-muted-foreground">{r.viewCount}次浏览</span>
                        <span className="text-xs text-muted-foreground">{r.downloadCount}次下载</span>
                        {r.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs bg-primary/5 text-primary/70">{tag}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setPreviewResource(r)} className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition-colors" title="预览">
                        <Eye className="w-4 h-4" />
                      </button>
                      {r.fileUrl && (
                        <a href={r.fileUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition-colors" title="下载">
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                      <button onClick={() => handleDeleteResource(r.id)} className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100" title="删除">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="text-center text-xs text-muted-foreground">
            共 {resources.length} 份资料 {searchQuery && `（搜索：${searchQuery}）`}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {showUploadDialog && <UploadDialog categories={categories} onClose={() => setShowUploadDialog(false)} onSaved={() => { setShowUploadDialog(false); fetchResources(); fetchCategories(); }} />}
      {showAddCatDialog && <CategoryAddDialog parentId={showAddCatDialog.parentId} categories={categories} onClose={() => setShowAddCatDialog(null)} onSaved={() => { setShowAddCatDialog(null); fetchCategories(); }} />}
      {previewResource && <PreviewDialog resource={previewResource} onClose={() => setPreviewResource(null)} />}
    </div>
  );
}

// Helper: get path from root to category
function getCategoryPath(catId: number, categories: Category[]): number[] {
  const path: number[] = [];
  let current = categories.find(c => c.id === catId);
  while (current && current.parentId) {
    path.unshift(current.parentId);
    current = categories.find(c => c.id === current!.parentId);
  }
  return path;
}
