import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth/context';

export const metadata: Metadata = {
  title: '百芝堂赋能系统',
  description: '培训赋能 · 双轨驱动',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
