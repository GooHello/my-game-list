'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useRef, MouseEvent, useEffect } from 'react';

const basePath = process.env.NODE_ENV === 'production' ? '/my-game-list' : '';

interface GameCardProps {
  game: {
    id: string;
    title: string;
    cover: string;
    playtime: string;
    showPlaytime: boolean;
    playStatus: string;
    tags: string[];
    isAnchor: boolean;
    reviewFile: string | null;
  };
}

export default function GameCard({ game }: GameCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<'left' | 'right'>('right');
  const [isMobile, setIsMobile] = useState(false);
  const [imgError, setImgError] = useState(false);
  
  // 3D Tilt 状态
  const [transform, setTransform] = useState('');
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  // 检测是否为移动端
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'cleared': return '🏆';
      case 'completed': return '🏆✨';
      case 'playing': return '🎮';
      case 'on-hold': return '⏳';
      case 'dropped': return '❌';
      default: return '';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'cleared': return '已通关';
      case 'completed': return '全成就';
      case 'playing': return '游玩中';
      case 'on-hold': return '搁置';
      case 'dropped': return '放弃';
      default: return '';
    }
  };

  // 生成本地 SVG 占位图，使用 Steam 库的深灰色调
  const fallbackImage = `data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='400' viewBox='0 0 300 400'%3E%3Crect width='300' height='400' fill='%23212429'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='20' fill='%238f98a0'%3E${encodeURIComponent(game.title)}%3C/text%3E%3C/svg%3E`;
  
  // 注意：因为配置了 basePath，如果 cover 是绝对路径（以 / 开头），
  // next/image 会自动处理它。但如果是 fallbackImage (data URI)，则不需要处理。
  // 为生产环境的本地图片路径加上 basePath 前缀
  const coverSrc = game.cover
    ? (game.cover.startsWith('/') ? `${basePath}${game.cover}` : game.cover)
    : fallbackImage;

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (isMobile || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -8;
    const rotateY = ((x - centerX) / centerX) * 8;

    setTransform(`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.03, 1.03, 1.03)`);
    
    setGlare({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.15
    });
  };

  const handleMouseEnter = () => {
    if (isMobile) return;
    setIsHovered(true);
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      if (rect.right + 320 > window.innerWidth) {
        setTooltipPos('left');
      } else {
        setTooltipPos('right');
      }
    }
  };

  const handleMouseLeave = () => {
    if (isMobile) return;
    setIsHovered(false);
    setTransform('');
    setGlare({ x: 50, y: 50, opacity: 0 });
  };

  const CardContent = (
    <div 
      ref={cardRef}
      className="relative group cursor-pointer z-10 md:hover:z-50"
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ perspective: '1000px' }}
    >
      {/* 封面图容器 */}
      <div 
        className="relative aspect-[3/4] overflow-hidden shadow-lg transition-all duration-200 ease-out bg-[#10141b] border border-[#3d4450]/50 md:group-hover:border-[#66c0f4]/50"
        style={{ 
          transform: transform || 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
          transformStyle: 'preserve-3d',
          boxShadow: isHovered ? '0 20px 40px rgba(0,0,0,0.6)' : '0 4px 6px rgba(0,0,0,0.3)'
        }}
      >
        <Image
          src={coverSrc}
          alt={game.title}
          fill
          className="object-cover object-center" // 确保图片居中裁剪，填满容器
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
        />
        
        {/* 动态反光层 (仅桌面端) */}
        {!isMobile && (
          <div 
            className="absolute inset-0 pointer-events-none transition-opacity duration-200"
            style={{
              opacity: glare.opacity,
              background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 60%)`
            }}
          />
        )}

        {/* 极简置顶角标 */}
        {game.isAnchor && (
          <div className="absolute top-2 right-2 text-xl drop-shadow-md z-10" style={{ transform: 'translateZ(20px)' }}>
            🔥
          </div>
        )}

        {/* 移动端专属：常驻底部信息条 */}
        <div className="md:hidden absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#10141b] via-[#10141b]/80 to-transparent pt-6 pb-2 px-2 flex justify-between items-end">
          <span className="text-xl drop-shadow-md">{getStatusIcon(game.playStatus)}</span>
          {game.reviewFile && (
            <div className="flex items-center gap-1 bg-[#66c0f4]/20 px-2 py-0.5 rounded border border-[#66c0f4]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[#66c0f4] shadow-[0_0_5px_#66c0f4]"></span>
              <span className="text-[10px] text-[#66c0f4] font-bold">印象</span>
            </div>
          )}
        </div>
      </div>

      {/* 桌面端专属：Steam 风格侧边悬浮信息卡片 (带层次感 + 毛玻璃) */}
      {isHovered && !isMobile && (
        <div 
          className={`absolute top-0 w-80 bg-[#171a21]/90 backdrop-blur-md border border-[#3d4450] shadow-2xl flex flex-col pointer-events-none
            ${tooltipPos === 'right' ? 'left-full ml-2' : 'right-full mr-2'}
          `}
          style={{ zIndex: 100 }}
        >
          {/* Header 区：带微渐变 */}
          <div className="bg-gradient-to-r from-[#202d39]/90 to-[#171a21]/90 p-3 border-b border-[#2a475e]">
            <h3 className="text-lg font-bold text-white leading-tight">{game.title}</h3>
          </div>
          
          {/* Content 区：深色背景 */}
          <div className="p-3 flex flex-col gap-3 bg-[#171a21]/50">
            {/* 状态块 */}
            <div className="flex items-center gap-3 bg-[#10141b]/80 p-2 rounded border border-[#2a475e]/50">
              <span className="text-2xl">{getStatusIcon(game.playStatus)}</span>
              <div className="flex flex-col">
                <span className="text-xs text-[#8f98a0] uppercase tracking-wider">游玩情况</span>
                <span className="text-sm text-[#c7d5e0] font-medium">{getStatusText(game.playStatus)}</span>
              </div>
            </div>

            {game.showPlaytime && (
              <div className="text-xs text-[#8f98a0]">
                游玩时长: <span className="text-[#c7d5e0]">{game.playtime}</span>
              </div>
            )}

            {/* Tags 块 */}
            <div className="flex flex-wrap gap-1.5 mt-1">
              {[...game.tags].sort((a, b) => {
                // 优先级：实战项目 (2) > 小想法 (1) > 其他 (0)
                const getWeight = (t: string) => t === '实战项目' ? 2 : t === '小想法' ? 1 : 0;
                return getWeight(b) - getWeight(a);
              }).map(tag => {
                const isSpecial = tag === '实战项目' || tag === '小想法';
                return (
                  <span 
                    key={tag} 
                    className={`backdrop-blur-sm text-[11px] px-2 py-1 rounded border ${
                      isSpecial 
                        ? 'bg-[#a4d007]/20 text-[#a4d007] border-[#a4d007]/50 font-bold shadow-[0_0_5px_rgba(164,208,7,0.2)]' 
                        : 'bg-[#202d39]/80 text-[#66c0f4] border-[#2a475e]'
                    }`}
                  >
                    {tag}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Action 区：Steam 标志性蓝绿渐变 */}
          {game.reviewFile && (
            <div className="bg-gradient-to-r from-[#47bfff]/20 to-[#1a44c2]/20 backdrop-blur-md p-2.5 text-center border-t border-[#2a475e]">
              <span className="text-sm text-[#66c0f4] font-bold tracking-wide drop-shadow-md">
                点击可看游戏印象
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (game.reviewFile) {
    return (
      <Link href={`/review/${game.id}`}>
        {CardContent}
      </Link>
    );
  }

  return CardContent;
}