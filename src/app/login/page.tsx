'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';

export default function LoginPage() {
  const { user, login, forceChangePassword, setForceChangePassword } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 强制改密弹窗状态
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [changePwdError, setChangePwdError] = useState('');
  const [changePwdLoading, setChangePwdLoading] = useState(false);

  // 已登录用户访问登录页，自动跳转首页
  useEffect(() => {
    if (user && !loading && !forceChangePassword) {
      window.location.href = '/';
    }
  }, [user, loading, forceChangePassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: unknown) {
      if (err instanceof TypeError) {
        setError('网络连接失败，请检查网络后重试');
      } else if (err instanceof Error) {
        setError(err.message || '登录失败');
      } else {
        setError('登录失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePwdError('');

    if (!oldPwd || !newPwd || !confirmPwd) {
      setChangePwdError('请填写所有字段');
      return;
    }
    if (newPwd.length < 6) {
      setChangePwdError('新密码至少6位');
      return;
    }
    if (newPwd !== confirmPwd) {
      setChangePwdError('两次输入的新密码不一致');
      return;
    }
    if (oldPwd === newPwd) {
      setChangePwdError('新密码不能与旧密码相同');
      return;
    }

    setChangePwdLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }),
      });
      const data = await res.json();
      if (!res.ok) {
        setChangePwdError(data.error || '修改密码失败');
        return;
      }
      // 改密成功，清除强制改密标记，跳转首页
      setForceChangePassword(false);
      window.location.href = '/';
    } catch {
      setChangePwdError('网络错误，请重试');
    } finally {
      setChangePwdLoading(false);
    }
  };

  // 加载中或已登录（非改密状态）时显示加载状态
  if ((loading || (user && !forceChangePassword))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F6F0]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2978B5] border-t-transparent" />
          <span className="text-sm text-[#667085]">正在跳转...</span>
        </div>
      </div>
    );
  }

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
                disabled={loading}
                className="w-full px-4 py-2.5 rounded-md border border-[#E6E1D8] bg-[#F8F6F0] text-[#1D2733] placeholder:text-[#667085]/60 focus:outline-none focus:ring-2 focus:ring-[#2978B5]/30 focus:border-[#2978B5] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
                disabled={loading}
                className="w-full px-4 py-2.5 rounded-md border border-[#E6E1D8] bg-[#F8F6F0] text-[#1D2733] placeholder:text-[#667085]/60 focus:outline-none focus:ring-2 focus:ring-[#2978B5]/30 focus:border-[#2978B5] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="w-full py-2.5 bg-[#102A43] text-white rounded-md font-medium text-sm hover:bg-[#1a3a5c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '登录中...' : '登 录'}
            </button>
          </form>

          {/* 测试账号提示（不显示密码） */}
          <div className="mt-6 pt-5 border-t border-[#E6E1D8]">
            <p className="text-xs text-[#667085] mb-2">测试账号</p>
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

      {/* 强制改密弹窗 */}
      {forceChangePassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#F59E0B]/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#F59E0B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#102A43]">安全提示：请修改初始密码</h3>
                <p className="text-sm text-[#667085]">检测到您使用的是初始密码，请修改后继续使用</p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1D2733] mb-1">旧密码</label>
                <input
                  type="password"
                  value={oldPwd}
                  onChange={e => setOldPwd(e.target.value)}
                  placeholder="请输入旧密码"
                  className="w-full px-4 py-2.5 rounded-md border border-[#E6E1D8] bg-[#F8F6F0] text-[#1D2733] placeholder:text-[#667085]/60 focus:outline-none focus:ring-2 focus:ring-[#2978B5]/30 focus:border-[#2978B5] text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1D2733] mb-1">新密码</label>
                <input
                  type="password"
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  placeholder="请输入新密码（至少6位）"
                  className="w-full px-4 py-2.5 rounded-md border border-[#E6E1D8] bg-[#F8F6F0] text-[#1D2733] placeholder:text-[#667085]/60 focus:outline-none focus:ring-2 focus:ring-[#2978B5]/30 focus:border-[#2978B5] text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1D2733] mb-1">确认新密码</label>
                <input
                  type="password"
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  placeholder="请再次输入新密码"
                  className="w-full px-4 py-2.5 rounded-md border border-[#E6E1D8] bg-[#F8F6F0] text-[#1D2733] placeholder:text-[#667085]/60 focus:outline-none focus:ring-2 focus:ring-[#2978B5]/30 focus:border-[#2978B5] text-sm"
                  required
                />
              </div>

              {changePwdError && (
                <div className="bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-md px-4 py-2.5 text-sm text-[#ef4444]">
                  {changePwdError}
                </div>
              )}

              <button
                type="submit"
                disabled={changePwdLoading}
                className="w-full py-2.5 bg-[#102A43] text-white rounded-md font-medium text-sm hover:bg-[#1a3a5c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {changePwdLoading ? '提交中...' : '确认修改'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
