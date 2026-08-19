'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import GameCard from './GameCard';

interface GameGridProps {
  games: Array<{
    id: string;
    title: string;
    cover: string;
    playStatus: string;
    tags: string[];
    isAnchor: boolean;
  }>;
}

// ==========================================
// 懒渲染：451 张卡片不再全量挂载
// 所有卡片共享一个 IntersectionObserver（避免 451 个独立实例的开销），
// 进入视口前 800px 才真正挂载 GameCard（图片、事件监听、3D 状态），
// 未挂载时用等尺寸占位块支撑布局，滚动不跳动。
// ==========================================

const handlers = new Map<Element, () => void>();
let sharedObserver: IntersectionObserver | null = null;

function getSharedObserver(): IntersectionObserver {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const handler = handlers.get(entry.target);
          if (handler) {
            handler();
            handlers.delete(entry.target);
            sharedObserver?.unobserve(entry.target);
          }
        }
      }
    }, { rootMargin: '800px 0px' });
  }
  return sharedObserver;
}

function LazyMount({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    handlers.set(el, () => setVisible(true));
    getSharedObserver().observe(el);
    return () => {
      handlers.delete(el);
      getSharedObserver().unobserve(el);
    };
  }, []);

  return (
    <div ref={ref}>
      {visible ? children : (
        <div className="aspect-[3/4] bg-[#10141b] border border-[#3d4450]/30" />
      )}
    </div>
  );
}

export default function GameGrid({ games }: GameGridProps) {
  if (games.length === 0) {
    return (
      <div className="text-center py-20 text-[#8f98a0]">
        <p className="text-xl">没有找到匹配的游戏</p>
        <p className="mt-2">尝试调整过滤条件</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-x-2 gap-y-2 md:gap-x-6 md:gap-y-4 p-2 md:p-8">
      {games.map((game) => (
        <LazyMount key={game.id}>
          <GameCard game={game} />
        </LazyMount>
      ))}
    </div>
  );
}
