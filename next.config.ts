import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 每次构建生成唯一 buildId，确保部署后浏览器加载最新代码
  // 生产环境本身靠内容哈希破缓存，generateBuildId是双保险
  generateBuildId: async () => {
    return Date.now().toString();
  },

  allowedDevOrigins: ['*.dev.coze.site'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
