'use client';

import { Users, UserCircle, Award, AlertTriangle } from 'lucide-react';

export default function TraineeBoardPage() {
  const mockTrainees = [
    { id: '1', name: '王小明', stage: 2, quadrant: 'C', mentor: '李芳', joinDate: '2024-11-01' },
    { id: '2', name: '张小红', stage: 1, quadrant: 'A', mentor: '李芳', joinDate: '2024-12-01' },
    { id: '3', name: '刘小华', stage: 2, quadrant: 'B', mentor: '王刚', joinDate: '2024-10-15' },
    { id: '4', name: '陈小龙', stage: 1, quadrant: 'D', mentor: '王刚', joinDate: '2025-01-10' },
  ];

  const QUADRANT_COLORS: Record<string, string> = {
    A: 'bg-[#22c55e]/15 text-[#22c55e]',
    B: 'bg-[#f59e0b]/15 text-[#f59e0b]',
    C: 'bg-[#ef4444]/15 text-[#ef4444]',
    D: 'bg-[#ef4444]/15 text-[#ef4444]',
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">新人看板</h1>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-lg shadow-card p-4">
          <p className="text-xs text-muted-foreground">新人总数</p>
          <p className="text-2xl font-bold text-foreground">{mockTrainees.length}</p>
        </div>
        <div className="bg-card rounded-lg shadow-card p-4">
          <p className="text-xs text-muted-foreground">达标率</p>
          <p className="text-2xl font-bold text-[#22c55e]">
            {Math.round(mockTrainees.filter(t => t.quadrant === 'A').length / mockTrainees.length * 100)}%
          </p>
        </div>
        <div className="bg-card rounded-lg shadow-card p-4">
          <p className="text-xs text-muted-foreground">待干预</p>
          <p className="text-2xl font-bold text-destructive">
            {mockTrainees.filter(t => t.quadrant === 'D').length}
          </p>
        </div>
      </div>

      <div className="bg-card rounded-lg shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">新人列表</h2>
        </div>
        <div className="divide-y divide-border">
          {mockTrainees.map(t => (
            <div key={t.id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/50 transition-colors">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-medium">
                {t.name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{t.name}</p>
                <p className="text-xs text-muted-foreground">带教: {t.mentor} · 入职: {t.joinDate}</p>
              </div>
              <span className="text-xs text-muted-foreground">阶段{t.stage}</span>
              <span className={`px-2 py-0.5 rounded-sm text-xs font-medium ${QUADRANT_COLORS[t.quadrant]}`}>
                {t.quadrant}类
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
