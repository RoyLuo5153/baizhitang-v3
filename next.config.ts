import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 每次构建生成唯一 buildId，确保部署后浏览器加载最新代码
  generateBuildId: async () => {
    return Date.now().toString();
  },

  // 开发环境下对 JS/CSS 资源设置 no-cache，防止浏览器缓存旧版本
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ];
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
