'use client';

import { useAuth } from '@/lib/auth/context';
import { GraduationCap } from 'lucide-react';
import { ManagerDashboard } from './components/ManagerDashboard';
import { TeacherDelivery } from './components/TeacherDelivery';
import { MentorProgress } from './components/MentorProgress';
import { TraineeLearning } from './components/TraineeLearning';

export default function CoursesPage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  const role = user.role;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <GraduationCap className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-semibold text-foreground">
          {role === 'training_manager' ? '培训监督仪表盘' :
           role === 'teacher' ? '课程交付台' :
           role === 'mentor' ? '学员进度管理' :
           '我的学习'}
        </h1>
      </div>

      {role === 'training_manager' && <ManagerDashboard />}
      {role === 'teacher' && <TeacherDelivery />}
      {role === 'mentor' && <MentorProgress />}
      {role === 'trainee' && <TraineeLearning />}
      {!['training_manager', 'teacher', 'mentor', 'trainee'].includes(role) && (
        <div className="bg-card rounded-lg shadow-card p-8 text-center">
          <GraduationCap className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">暂无课程管理权限</p>
        </div>
      )}
    </div>
  );
}
