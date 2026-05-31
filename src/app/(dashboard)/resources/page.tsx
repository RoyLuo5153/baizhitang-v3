'use client';

import { BookOpen, FileText, Video, Download, Search } from 'lucide-react';
import { useState } from 'react';

export default function ResourcesPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const mockResources = [
    { id: '1', title: '糖尿病基础知识手册', type: 'document', category: '医学基础', size: '2.3MB' },
    { id: '2', title: '服务话术标准录音', type: 'audio', category: '话术训练', size: '15.6MB' },
    { id: '3', title: '患者沟通技巧视频', type: 'video', category: '沟通技巧', size: '128MB' },
    { id: '4', title: '慢病管理流程图', type: 'document', category: '流程规范', size: '1.1MB' },
  ];

  const TYPE_ICONS: Record<string, any> = {
    document: FileText,
    audio: BookOpen,
    video: Video,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">资料中心</h1>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-foreground text-sm"
          placeholder="搜索资料..."
        />
      </div>

      <div className="space-y-3">
        {mockResources
          .filter(r => !searchQuery || r.title.includes(searchQuery))
          .map(r => {
            const Icon = TYPE_ICONS[r.type] || FileText;
            return (
              <div key={r.id} className="bg-card rounded-lg shadow-card p-4 flex items-center gap-4 border border-border/50 hover:shadow-float transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.category} · {r.size}</p>
                </div>
                <button className="text-primary hover:text-primary/80 transition-colors">
                  <Download className="w-4 h-4" />
                </button>
              </div>
            );
          })}
      </div>
    </div>
  );
}
