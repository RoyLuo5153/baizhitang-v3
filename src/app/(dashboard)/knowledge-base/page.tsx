'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Search, Star, Eye, Clock, Tag, Bookmark, BookmarkCheck, ThumbsUp, Share2, ChevronRight, Filter } from 'lucide-react';

interface Article {
  id: number;
  title: string;
  summary: string;
  content: string;
  category: string;
  tags: string[];
  author_id: string;
  author_name: string;
  view_count: number;
  like_count: number;
  bookmark_count: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  is_bookmarked?: boolean;
}

export default function KnowledgeBasePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [showBookmarks, setShowBookmarks] = useState(false);

  useEffect(() => { fetchArticles(); }, []);

  const fetchArticles = async () => {
    try {
      const res = await fetch('/api/knowledge');
      if (res.ok) {
        const data = await res.json();
        setArticles(data.articles || []);
        setLoading(false);
        return;
      }
    } catch {}
    setArticles(MOCK_ARTICLES);
    setLoading(false);
  };

  const categories = ['all', ...Array.from(new Set(articles.map(a => a.category)))];
  const filtered = articles
    .filter(a => {
      if (showBookmarks) return a.is_bookmarked;
      return true;
    })
    .filter(a => activeCategory === 'all' || a.category === activeCategory)
    .filter(a => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q) || a.tags.some(t => t.toLowerCase().includes(q));
    });

  const toggleBookmark = (id: number) => {
    setArticles(prev => prev.map(a => a.id === id ? { ...a, is_bookmarked: !a.is_bookmarked, bookmark_count: a.is_bookmarked ? a.bookmark_count - 1 : a.bookmark_count + 1 } : a));
    fetch(`/api/knowledge/interact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId: id, action: 'bookmark' }),
    }).catch(() => {});
  };

  const categoryColors: Record<string, { bg: string; text: string }> = {
    '糖尿病基础': { bg: 'bg-primary/10', text: 'text-primary' },
    '话术技巧': { bg: 'bg-[#f59e0b]/10', text: 'text-[#f59e0b]' },
    '业务流程': { bg: 'bg-[#22c55e]/10', text: 'text-[#22c55e]' },
    '案例分析': { bg: 'bg-[#ef4444]/10', text: 'text-[#ef4444]' },
    '制度规范': { bg: 'bg-primary/10', text: 'text-primary' },
    '产品知识': { bg: 'bg-[#8b5cf6]/10', text: 'text-[#8b5cf6]' },
  };

  if (loading) return <div className="space-y-4">{[1,2,3].map(i=><div key={i} className="bg-card rounded-lg p-5 animate-pulse"><div className="h-5 bg-muted rounded w-1/3 mb-3"/><div className="h-3 bg-muted rounded w-2/3"/></div>)}</div>;

  // Article detail view
  if (selectedArticle) {
    const catColor = categoryColors[selectedArticle.category] || { bg: 'bg-muted', text: 'text-muted-foreground' };
    return (
      <div className="space-y-5">
        <button onClick={() => setSelectedArticle(null)} className="flex items-center gap-1 text-sm text-primary hover:underline">
          <ChevronRight className="w-3 h-3 rotate-180" />返回知识库
        </button>
        <div className="bg-card rounded-lg shadow-card p-8">
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${catColor.bg} ${catColor.text}`}>{selectedArticle.category}</span>
            {selectedArticle.tags.map(t => (
              <span key={t} className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded flex items-center gap-1"><Tag className="w-2.5 h-2.5" />{t}</span>
            ))}
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">{selectedArticle.title}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
            <span>{selectedArticle.author_name}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(selectedArticle.updated_at).toLocaleDateString('zh-CN')}</span>
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{selectedArticle.view_count}</span>
          </div>
          <div className="prose max-w-none text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {selectedArticle.content}
          </div>
          <div className="flex items-center gap-4 mt-8 pt-6 border-t border-border/40">
            <button onClick={() => toggleBookmark(selectedArticle.id)} className={`flex items-center gap-1.5 text-sm ${selectedArticle.is_bookmarked ? 'text-[#f59e0b]' : 'text-muted-foreground hover:text-foreground'} transition`}>
              {selectedArticle.is_bookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
              {selectedArticle.is_bookmarked ? '已收藏' : '收藏'}
            </button>
            <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
              <ThumbsUp className="w-4 h-4" />{selectedArticle.like_count}
            </button>
            <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
              <Share2 className="w-4 h-4" />分享
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">知识库</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBookmarks(!showBookmarks)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition ${showBookmarks ? 'bg-[#f59e0b]/10 text-[#f59e0b]' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
          >
            <Bookmark className="w-4 h-4" />{showBookmarks ? '我的收藏' : '收藏'}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm focus:ring-1 focus:ring-primary focus:border-primary"
          placeholder="搜索知识库..."
        />
      </div>

      {/* Category filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-muted-foreground" />
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
              activeCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {cat === 'all' ? '全部' : cat}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '文章总数', value: articles.length, icon: BookOpen, color: 'text-primary', bg: 'bg-primary/10' },
          { label: '总阅读量', value: articles.reduce((s, a) => s + a.view_count, 0), icon: Eye, color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
          { label: '我的收藏', value: articles.filter(a => a.is_bookmarked).length, icon: Bookmark, color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/10' },
        ].map((s, i) => (
          <div key={i} className="bg-card rounded-lg shadow-card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
            <div><div className="text-xl font-bold text-foreground">{s.value}</div><div className="text-xs text-muted-foreground">{s.label}</div></div>
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
          const catColor = categoryColors[article.category] || { bg: 'bg-muted', text: 'text-muted-foreground' };
          return (
            <div key={article.id} className="bg-card rounded-lg shadow-card p-5 hover:shadow-card/80 transition cursor-pointer" onClick={() => setSelectedArticle(article)}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${catColor.bg} ${catColor.text}`}>{article.category}</span>
                    {article.is_bookmarked && <BookmarkCheck className="w-3.5 h-3.5 text-[#f59e0b]" />}
                  </div>
                  <h3 className="font-semibold text-foreground mb-1.5 hover:text-primary transition">{article.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{article.summary}</p>
                  <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                    <span>{article.author_name}</span>
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{article.view_count}</span>
                    <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{article.like_count}</span>
                    <span>{new Date(article.updated_at).toLocaleDateString('zh-CN')}</span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1 ml-4">
                  <button onClick={e => { e.stopPropagation(); toggleBookmark(article.id); }}
                    className={`p-1.5 rounded-lg transition ${article.is_bookmarked ? 'text-[#f59e0b] bg-[#f59e0b]/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                  >
                    {article.is_bookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const MOCK_ARTICLES: Article[] = [
  { id: 1, title: '糖尿病分类与诊断标准', summary: '详细介绍1型、2型、妊娠期糖尿病的分类标准、诊断方法与鉴别要点', content: '一、糖尿病分类\n\n糖尿病是一组以高血糖为特征的代谢性疾病。根据病因和发病机制的不同，主要分为以下几类：\n\n1. 1型糖尿病（T1DM）\n- 自身免疫性：β细胞被破坏，导致胰岛素绝对缺乏\n- 特发性：无自身免疫证据的1型糖尿病\n\n2. 2型糖尿病（T2DM）\n- 从胰岛素抵抗为主伴相对胰岛素不足\n- 到胰岛素分泌不足为主伴胰岛素抵抗\n\n3. 妊娠期糖尿病（GDM）\n- 妊娠期间首次发现的糖耐量异常\n\n二、诊断标准\n\n1. 典型症状+随机血糖≥11.1mmol/L\n2. 空腹血糖(FPG)≥7.0mmol/L\n3. OGTT 2h血糖≥11.1mmol/L\n4. HbA1c≥6.5%\n\n注意：无典型症状者需改日复查确认', category: '糖尿病基础', tags: ['糖尿病', '诊断', '分类'], author_id: '7', author_name: '吴培训', view_count: 342, like_count: 28, bookmark_count: 45, is_published: true, created_at: '2025-05-01T10:00:00Z', updated_at: '2025-05-20T15:00:00Z', is_bookmarked: true },
  { id: 2, title: '服务助理电话沟通话术指南', summary: '涵盖首次来电、复诊邀约、用药提醒等场景的标准化话术模板与注意事项', content: '一、首次来电话术\n\n开场白："您好，我是百芝堂服务助理[姓名]，请问是[患者称呼]吗？"\n\n自我介绍："我是您的专属健康管理助理，后续会协助您进行健康管理。"\n\n二、复诊邀约话术\n\n提醒方式："[患者称呼]您好，根据您的血糖监测数据，建议您安排一次复诊。"\n\n时间确认："我们这边可以帮您预约[日期]的时间，您看方便吗？"\n\n三、注意事项\n\n1. 语速适中，语气亲切\n2. 重要信息需重复确认\n3. 避免使用过多医学术语\n4. 做好沟通记录', category: '话术技巧', tags: ['话术', '电话沟通', '服务助理'], author_id: '6', author_name: '陈导师', view_count: 567, like_count: 42, bookmark_count: 78, is_published: true, created_at: '2025-04-15T09:00:00Z', updated_at: '2025-06-01T10:00:00Z', is_bookmarked: true },
  { id: 3, title: '加V流程与微信管理规范', summary: '详细说明患者加V标准流程、微信沟通规范及信息安全管理要求', content: '一、加V标准流程\n\n1. 获取患者信息（姓名+手机号）\n2. 发送添加好友申请\n3. 通过后发送欢迎语\n4. 确认患者身份\n5. 完善患者档案\n\n二、微信沟通规范\n\n1. 响应时效：工作时间内30分钟内回复\n2. 沟通内容限于健康管理相关\n3. 不推荐非公司产品\n4. 不得泄露患者隐私信息\n\n三、信息安全管理\n\n1. 禁止转发患者信息至非工作群\n2. 截图需脱敏处理\n3. 离职需交接所有患者微信', category: '业务流程', tags: ['加V', '微信', '流程'], author_id: '9', author_name: '郑管理', view_count: 289, like_count: 19, bookmark_count: 33, is_published: true, created_at: '2025-03-20T14:00:00Z', updated_at: '2025-05-10T11:00:00Z', is_bookmarked: false },
  { id: 4, title: '患者复诊管理案例分析', summary: '3个真实的患者复诊管理案例，展示如何通过持续跟进提升复诊率', content: '案例一：李阿姨的血糖管理之旅\n\n背景：65岁，2型糖尿病8年，血糖控制不佳\n干预：\n1. 建立信任关系\n2. 制定个性化管理方案\n3. 每周电话跟进\n4. 协助预约专家复诊\n\n结果：3个月后HbA1c从9.2%降至7.5%，复诊率100%\n\n案例二：张先生的用药依从性改善\n\n背景：45岁，2型糖尿病2年，经常忘记服药\n干预：\n1. 设置服药提醒\n2. 每日微信打卡\n3. 定期用药知识科普\n4. 家属协同管理\n\n结果：用药依从性从60%提升至95%\n\n案例三：王女士的饮食管理\n\n背景：52岁，妊娠期糖尿病史，饮食控制困难\n干预：\n1. 制定饮食计划\n2. 每餐拍照打卡\n3. 营养师在线指导\n4. 食物交换份教学\n\n结果：空腹血糖从8.5降至6.8', category: '案例分析', tags: ['复诊', '案例', '管理'], author_id: '7', author_name: '周导师', view_count: 198, like_count: 15, bookmark_count: 22, is_published: true, created_at: '2025-05-10T16:00:00Z', updated_at: '2025-05-25T09:00:00Z', is_bookmarked: false },
  { id: 5, title: '常用降糖药物知识手册', summary: '涵盖二甲双胍、磺脲类、DPP-4抑制剂、SGLT2抑制剂等常用降糖药的作用机制与注意事项', content: '一、二甲双胍\n\n作用机制：减少肝糖输出，增加外周葡萄糖利用\n适用：2型糖尿病一线用药\n注意事项：\n- 肾功能不全者慎用\n- 常见胃肠道反应\n- 维生素B12缺乏风险\n\n二、磺脲类\n\n作用机制：刺激胰岛β细胞分泌胰岛素\n代表药物：格列美脲、格列齐特\n注意事项：\n- 低血糖风险\n- 体重增加\n- 需餐前服用\n\n三、DPP-4抑制剂\n\n作用机制：抑制DPP-4酶，延长GLP-1作用时间\n代表药物：西格列汀、利格列汀\n注意事项：\n- 低血糖风险低\n- 不增加体重\n- 可单用或联合用药\n\n四、SGLT2抑制剂\n\n作用机制：抑制肾脏近端小管对葡萄糖的重吸收\n代表药物：达格列净、恩格列净\n注意事项：\n- 泌尿系感染风险\n- 糖尿病酮症酸中毒风险\n- 心肾保护作用', category: '产品知识', tags: ['降糖药', '用药', '药物知识'], author_id: '7', author_name: '吴培训', view_count: 456, like_count: 35, bookmark_count: 61, is_published: true, created_at: '2025-04-01T10:00:00Z', updated_at: '2025-06-02T14:00:00Z', is_bookmarked: true },
  { id: 6, title: '新人培训制度规范', summary: '百芝堂新人培训三阶段制度说明，包括闯关学习、双轨诊断与赋能闭环', content: '一、培训三阶段\n\n阶段一：基础培训期\n- 闯关学习（7关）\n- 质检标准学习\n- 基本话术训练\n\n阶段二：能力提升期\n- 闯关全部通过后进入\n- 双轨诊断合格标准\n- 辅导与赋能机制\n\n阶段三：独立作业期\n- 连续4周A类后进入\n- 可带教新人\n- 参与质检评审\n\n二、复训触发条件\n\n连续2周D类 → 触发复训\n复训期间重新进入阶段一闯关\n\n三、评估标准\n\n四象限分类：\nA类：过程+结果均合格\nB类：过程合格+结果不合格\nC类：过程不合格+结果合格\nD类：过程+结果均不合格', category: '制度规范', tags: ['培训', '制度', '规范'], author_id: '9', author_name: '郑管理', view_count: 312, like_count: 22, bookmark_count: 40, is_published: true, created_at: '2025-03-01T08:00:00Z', updated_at: '2025-05-15T16:00:00Z', is_bookmarked: false },
];
