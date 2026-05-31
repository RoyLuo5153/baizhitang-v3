'use client';

import { ClipboardCheck, Plus, CheckCircle2, XCircle } from 'lucide-react';
import { useState } from 'react';

export default function AssessmentPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">日常考核</h1>
      </div>

      <div className="bg-card rounded-lg shadow-card p-12 text-center">
        <ClipboardCheck className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground">日常考核模块</p>
        <p className="text-xs text-muted-foreground mt-1">可通过质检审核模块创建录音/微信质检记录</p>
      </div>
    </div>
  );
}
