'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/context';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F6F0]">
      <div className="w-full max-w-md">
        {/* Logo区域 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-[#102A43] mb-4">
            <span className="text-white text-2xl font-bold">BZ</span>
          </div>
          <h1 className="text-2xl font-semibold text-[#102A43]">百芝堂培训管理系统</h1>
          <p className="text-sm text-[#667085] mt-2">百芝堂新人培训管理系统</p>
        </div>

        {/* 登录表单 */}
        <div className="bg-white rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#1D2733] mb-1.5">
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="请输入用户名"
                className="w-full px-4 py-2.5 rounded-md border border-[#E6E1D8] bg-[#F8F6F0] text-[#1D2733] placeholder:text-[#667085]/60 focus:outline-none focus:ring-2 focus:ring-[#2978B5]/30 focus:border-[#2978B5] text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1D2733] mb-1.5">
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="w-full px-4 py-2.5 rounded-md border border-[#E6E1D8] bg-[#F8F6F0] text-[#1D2733] placeholder:text-[#667085]/60 focus:outline-none focus:ring-2 focus:ring-[#2978B5]/30 focus:border-[#2978B5] text-sm"
                required
              />
            </div>

            {error && (
              <div className="bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-md px-4 py-2.5 text-sm text-[#ef4444]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#102A43] text-white rounded-md font-medium text-sm hover:bg-[#1a3a5c] transition-colors disabled:opacity-50"
            >
              {loading ? '登录中...' : '登 录'}
            </button>
          </form>

          {/* 测试账号提示 */}
          <div className="mt-6 pt-5 border-t border-[#E6E1D8]">
            <p className="text-xs text-[#667085] mb-2">测试账号（密码：bt2026）</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-[#667085]">
              <span>zhangxh - 新人</span>
              <span>chends - 带教老师</span>
              <span>wupx - 培训老师</span>
              <span>zhengl - 培训负责人</span>
              <span>sunz - 总经理</span>
              <span>lidw - 新人</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
