'use client';

import { BookOpen, FileText, Video, Download, Search, Upload, Headphones, Filter, FolderTree, Tag, ChevronRight, ChevronDown } from 'lucide-react';
import { useState, useMemo } from 'react';

interface Resource {
  id: string;
  title: string;
  type: 'document' | 'audio' | 'video';
  category: string;
  size: string;
  description: string;
  date: string;
  downloadCount: number;
}

const CATEGORIES = ['全部', '医学基础', '话术训练', '沟通技巧', '流程规范', '质检标准', '产品知识'];

// Category tree structure for the enhanced view
interface CategoryNode {
  name: string;
  count: number;
  children?: CategoryNode[];
  icon: typeof FileText;
}

const CATEGORY_TREE: CategoryNode[] = [
  { name: '医学基础', count: 3, icon: BookOpen, children: [
    { name: '糖尿病基础', count: 2, icon: FileText },
    { name: '并发症知识', count: 1, icon: FileText },
  ]},
  { name: '话术训练', count: 2, icon: Headphones, children: [
    { name: '电话话术', count: 1, icon: Headphones },
    { name: '微信话术', count: 1, icon: Headphones },
  ]},
  { name: '沟通技巧', count: 2, icon: Video, children: [
    { name: '患者沟通', count: 1, icon: Video },
    { name: '场景模拟', count: 1, icon: Video },
  ]},
  { name: '流程规范', count: 2, icon: FileText, children: [
    { name: '加V流程', count: 1, icon: FileText },
    { name: '操作规范', count: 1, icon: FileText },
  ]},
  { name: '质检标准', count: 2, icon: FileText, children: [
    { name: '评分标准', count: 1, icon: FileText },
    { name: '合规手册', count: 1, icon: FileText },
  ]},
  { name: '产品知识', count: 1, icon: BookOpen },
];

const TYPE_CONFIG: Record<string, { icon: typeof FileText; label: string; color: string }> = {
  document: { icon: FileText, label: '文档', color: 'text-primary' },
  audio: { icon: Headphones, label: '音频', color: 'text-[#f59e0b]' },
  video: { icon: Video, label: '视频', color: 'text-destructive' },
};

const MOCK_RESOURCES: Resource[] = [
  { id: '1', title: '糖尿病基础知识手册', type: 'document', category: '医学基础', size: '2.3MB', description: '涵盖糖尿病分型、病理机制、诊断标准等核心知识', date: '2025-06-01', downloadCount: 156 },
  { id: '2', title: '服务话术标准录音', type: 'audio', category: '话术训练', size: '15.6MB', description: '加微、面诊邀约、用药指导等标准话术录音', date: '2025-05-28', downloadCount: 89 },
  { id: '3', title: '患者沟通技巧视频教程', type: 'video', category: '沟通技巧', size: '128MB', description: '情景模拟+专家点评，共8讲', date: '2025-05-25', downloadCount: 234 },
  { id: '4', title: '慢病管理标准流程图', type: 'document', category: '流程规范', size: '1.1MB', description: '从首诊到长期随访的全流程可视化指引', date: '2025-05-20', downloadCount: 178 },
  { id: '5', title: '质检评分标准细则', type: 'document', category: '质检标准', size: '856KB', description: '4维度16项评分细则，含正反面案例', date: '2025-05-15', downloadCount: 67 },
  { id: '6', title: '百芝堂产品知识手册', type: 'document', category: '产品知识', size: '4.2MB', description: '公司产品线、功效机理、使用方法全览', date: '2025-05-10', downloadCount: 203 },
  { id: '7', title: '投诉处理话术音频', type: 'audio', category: '话术训练', size: '8.9MB', description: '5种常见投诉场景的标准应对话术', date: '2025-05-08', downloadCount: 45 },
  { id: '8', title: '血糖监测操作规范视频', type: 'video', category: '流程规范', size: '95MB', description: '血糖仪使用、数据记录、异常值处理', date: '2025-05-05', downloadCount: 132 },
  { id: '9', title: '用药指导情景模拟', type: 'video', category: '沟通技巧', size: '156MB', description: '6个用药指导场景的实战演练', date: '2025-04-28', downloadCount: 98 },
  { id: '10', title: '合规规范红线手册', type: 'document', category: '质检标准', size: '1.8MB', description: '服务合规必读：禁止承诺、话术红线、隐私保护', date: '2025-04-20', downloadCount: 312 },
];

export default function ResourcesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('全部');
  const [activeType, setActiveType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return MOCK_RESOURCES.filter(r => {
      const matchSearch = !searchQuery || r.title.includes(searchQuery) || r.description.includes(searchQuery);
      const matchCategory = activeCategory === '全部' || r.category === activeCategory;
      const matchType = activeType === 'all' || r.type === activeType;
      return matchSearch && matchCategory && matchType;
    });
  }, [searchQuery, activeCategory, activeType]);

  const stats = useMemo(() => {
    const byType = { document: 0, audio: 0, video: 0 };
    MOCK_RESOURCES.forEach(r => { byType[r.type]++; });
    return byType;
  }, []);

  const toggleCat = (name: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">资料中心</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">学习资料下载与知识库管理</p>
        </div>
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all inline-flex items-center gap-2">
          <Upload className="w-3.5 h-3.5" />
          上传资料
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { type: 'document', label: '文档', count: stats.document },
          { type: 'audio', label: '音频', count: stats.audio },
          { type: 'video', label: '视频', count: stats.video },
          { type: 'total', label: '总计', count: MOCK_RESOURCES.length },
        ].map(item => {
          const config = item.type === 'total' ? { icon: FolderTree, color: 'text-primary' } : TYPE_CONFIG[item.type];
          const Icon = config.icon;
          return (
            <div key={item.type} className="bg-card rounded-lg shadow-card p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${config.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{item.count}</p>
                <p className="text-xs text-muted-foreground">{item.label}资料</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search + View Toggle + Filters */}
      <div className="space-y-3">
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
          <div className="flex bg-muted rounded-lg p-1">
            {(['list', 'tree'] as const).map(v => (
              <button key={v} onClick={() => setViewMode(v)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${viewMode === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {v === 'list' ? '列表视图' : '分类树视图'}
              </button>
            ))}
          </div>
        </div>

        {viewMode === 'list' && (
          <>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">分类：</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      activeCategory === cat
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground">类型：</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActiveType('all')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    activeType === 'all' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  全部
                </button>
                {Object.entries(TYPE_CONFIG).map(([type, config]) => (
                  <button
                    key={type}
                    onClick={() => setActiveType(type)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      activeType === type ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {config.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Tree view with sidebar */}
      {viewMode === 'tree' ? (
        <div className="flex gap-6">
          {/* Category tree sidebar */}
          <div className="w-56 shrink-0 bg-card rounded-lg shadow-card p-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-2">资料分类</h3>
            <div className="space-y-0.5">
              <button
                onClick={() => setActiveCategory('全部')}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition ${
                  activeCategory === '全部' ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'
                }`}
              >
                <FolderTree className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">全部</span>
                <span className="text-xs text-muted-foreground">{MOCK_RESOURCES.length}</span>
              </button>
              {CATEGORY_TREE.map(cat => (
                <div key={cat.name}>
                  <button
                    onClick={() => { setActiveCategory(cat.name); if (cat.children) toggleCat(cat.name); }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition ${
                      activeCategory === cat.name ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    {cat.children ? (
                      expandedCats.has(cat.name) ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />
                    ) : <span className="w-3" />}
                    <cat.icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-left">{cat.name}</span>
                    <span className="text-xs text-muted-foreground">{cat.count}</span>
                  </button>
                  {cat.children && expandedCats.has(cat.name) && (
                    <div className="ml-6 space-y-0.5 mt-0.5">
                      {cat.children.map(child => (
                        <button
                          key={child.name}
                          onClick={() => setActiveCategory(child.name)}
                          className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-xs transition ${
                            activeCategory === child.name ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          <child.icon className="w-3 h-3 shrink-0" />
                          <span className="flex-1 text-left">{child.name}</span>
                          <span className="text-xs text-muted-foreground/60">{child.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Resource list */}
          <div className="flex-1 space-y-3">
            {filtered.length === 0 ? (
              <div className="bg-card rounded-lg shadow-card p-12 text-center">
                <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">未找到匹配的资料</p>
              </div>
            ) : (
              filtered.map(r => {
                const config = TYPE_CONFIG[r.type];
                const Icon = config.icon;
                return (
                  <div key={r.id} className="bg-card rounded-lg shadow-card p-4 flex items-center gap-4 border border-border/50 hover:shadow-float transition-shadow">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0"><Icon className={`w-5 h-5 ${config.color}`} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.description}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs bg-muted text-muted-foreground">{r.category}</span>
                        <span className="text-xs text-muted-foreground">{config.label}</span>
                        <span className="text-xs text-muted-foreground">{r.size}</span>
                        <span className="text-xs text-muted-foreground">{r.downloadCount}次下载</span>
                      </div>
                    </div>
                    <button className="text-primary hover:text-primary/80 transition-colors p-2" title="下载"><Download className="w-4 h-4" /></button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* List view (original) */
        <>
          {/* Resource List */}
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="bg-card rounded-lg shadow-card p-12 text-center">
                <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">未找到匹配的资料</p>
              </div>
            ) : (
              filtered.map(r => {
                const config = TYPE_CONFIG[r.type];
                const Icon = config.icon;
                return (
                  <div
                    key={r.id}
                    className="bg-card rounded-lg shadow-card p-4 flex items-center gap-4 border border-border/50 hover:shadow-float transition-shadow"
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Icon className={`w-5 h-5 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.description}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs bg-muted text-muted-foreground">{r.category}</span>
                        <span className="text-xs text-muted-foreground">{config.label}</span>
                        <span className="text-xs text-muted-foreground">{r.size}</span>
                        <span className="text-xs text-muted-foreground">{r.date}</span>
                        <span className="text-xs text-muted-foreground">{r.downloadCount}次下载</span>
                      </div>
                    </div>
                    <button className="text-primary hover:text-primary/80 transition-colors p-2" title="下载">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom info */}
          <div className="text-center text-xs text-muted-foreground">
            共 {filtered.length} 份资料 {searchQuery && `（搜索：${searchQuery}）`}
          </div>
        </>
      )}
    </div>
  );
}
