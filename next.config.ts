import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  // 开启静态导出模式，这是部署到 GitHub Pages 必须的
  output: 'export',
  
  // 只有在生产环境（npm run build）时，才配置 basePath
  // 这样本地开发（npm run dev）时就不会破图了
  basePath: isProd ? '/my-game-list' : '',
  
  // 禁用 Next.js 默认的图片优化 API，因为静态导出不支持
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
      },
    ],
  },
};

export default nextConfig;