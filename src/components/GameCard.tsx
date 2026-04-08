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
  const [showMobileInfo, setShowMobileInfo] = useState(false);
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

  // 点击外部关闭移动端信息面板
  useEffect(() => {
    if (!showMobileInfo) return;
    const handleClickOutside = (e: Event) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setShowMobileInfo(false);
      }
    };
    document.addEventListener('touchstart', handleClickOutside);
    return () => document.removeEventListener('touchstart', handleClickOutside);
  }, [showMobileInfo]);

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

  // 生成本地 SVG 占位图
  const fallbackImage = `data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='400' viewBox='0 0 300 400'%3E%3Crect width='300' height='400' fill='%23212429'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='16' fill='%238f98a0'%3E${encodeURIComponent(game.title.slice(0, 10))}%3C/text%3E%3C/svg%3E`;
  
  const coverSrc = imgError
    ? fallbackImage
    : game.cover
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

  // 移动端点击处理
  const handleMobileClick = (e: React.MouseEvent) => {
    if (!isMobile) return;
    // 如果有 reviewFile，长按/第二次点击跳转；第一次点击展示信息
    if (!showMobileInfo) {
      e.preventDefault();
      e.stopPropagation();
      setShowMobileInfo(true);
    }
    // 如果已经展开信息，让 Link 正常跳转（有 reviewFile 时）
  };

  const CardContent = (
    <div 
      ref={cardRef}
      className="relative group cursor-pointer z-10 md:hover:z-50"
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleMobileClick}
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
          className="object-cover object-center"
          sizes="(max-width: 768px) 25vw, (max-width: 1200px) 20vw, 14vw"
          onError={() => setImgError(true)}
          unoptimized={coverSrc.startsWith('data:') || coverSrc.startsWith('http')}
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
          <div className="absolute top-1 right-1 md:top-2 md:right-2 text-sm md:text-xl drop-shadow-md z-10" style={{ transform: 'translateZ(20px)' }}>
            🔥
          </div>
        )}
      </div>

      {/* ======================== */}
      {/* 移动端：点击弹出信息面板 */}
      {/* ======================== */}
      {showMobileInfo && isMobile && (
        <div className="absolute inset-0 z-50 bg-[#171a21]/70 backdrop-blur-[2px] flex flex-col justify-end">
          <div className="p-2 space-y-1.5">
            {/* 游戏名 */}
            <h3 className="text-[10px] font-bold text-white leading-tight line-clamp-2">{game.title}</h3>
            
            {/* 状态 */}
            <div className="flex items-center gap-1">
              <span className="text-xs">{getStatusIcon(game.playStatus)}</span>
              <span className="text-[10px] text-[#c7d5e0]">{getStatusText(game.playStatus)}</span>
            </div>

            {/* 标签（全部显示） */}
            <div className="flex flex-wrap gap-0.5">
              {[...game.tags].sort((a, b) => {
                const getWeight = (t: string) => t === '实战项目' ? 2 : t === '小想法' ? 1 : 0;
                return getWeight(b) - getWeight(a);
              }).filter(t => t !== 'Mobile').map(tag => {
                const isSpecial = tag === '实战项目' || tag === '小想法';
                return (
                  <span key={tag} className={`text-[8px] px-1 py-0.5 rounded border ${
                    isSpecial
                      ? 'bg-[#a4d007]/20 text-[#a4d007] border-[#a4d007]/50 font-bold'
                      : 'bg-[#202d39] text-[#66c0f4] border-[#2a475e]/50'
                  }`}>
                    {tag}
                  </span>
                );
              })}
            </div>

            {/* 有评测的提示 */}
            {game.reviewFile && (
              <div className="text-[9px] text-[#66c0f4] text-center pt-1 border-t border-[#2a475e]/50">
                再次点击查看印象 →
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================== */}
      {/* 桌面端：Steam 风格侧边悬浮信息卡片 */}
      {/* ======================== */}
      {isHovered && !isMobile && (
        <div 
          className={`absolute top-0 w-80 bg-[#171a21]/90 backdrop-blur-md border border-[#3d4450] shadow-2xl flex flex-col pointer-events-none
            ${tooltipPos === 'right' ? 'left-full ml-2' : 'right-full mr-2'}
          `}
          style={{ zIndex: 100 }}
        >
          {/* Header 区 */}
          <div className="bg-gradient-to-r from-[#202d39]/90 to-[#171a21]/90 p-3 border-b border-[#2a475e]">
            <h3 className="text-lg font-bold text-white leading-tight">{game.title}</h3>
          </div>
          
          {/* Content 区 */}
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

          {/* Action 区 */}
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