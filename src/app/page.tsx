'use client';

import { useState, useMemo } from 'react';
import FilterBar from '@/components/FilterBar';
import GameGrid from '@/components/GameGrid';
import gamesData from '../../data/games.json';

export default function Home() {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    gamesData.forEach(game => {
      if (game && game.tags) {
        game.tags.forEach(tag => {
          // 过滤掉内部使用的 Mobile 标签，不让它出现在顶部的过滤栏里
          if (tag !== 'Mobile') {
            tags.add(tag);
          }
        });
      }
    });
    return Array.from(tags);
  }, []);

  // 核心过滤与分类逻辑 (纯粹依赖底层数据)
  const { anchorGames, mobileGames, normalGames } = useMemo(() => {
    let result = [...gamesData].filter(game => game !== null);

    // 标签过滤
    if (selectedTag) {
      result = result.filter(game => game.tags && game.tags.includes(selectedTag));
    }

    const anchors: typeof result = [];
    const mobiles: typeof result = [];
    const normals: typeof result = [];

    result.forEach(game => {
      if (game.isAnchor) {
        anchors.push(game);
      } else if (game.tags && game.tags.includes('Mobile')) {
        mobiles.push(game);
      } else {
        normals.push(game);
      }
    });

    // 排序逻辑
    const sortFn = (a: any, b: any) => {
      const aIsNative = a.cover && !a.cover.includes('bing');
      const bIsNative = b.cover && !b.cover.includes('bing');
      if (aIsNative && !bIsNative) return -1;
      if (!aIsNative && bIsNative) return 1;
      return b.orderWeight - a.orderWeight;
    };

    return {
      anchorGames: anchors.sort((a, b) => b.orderWeight - a.orderWeight), // 研发项目按权重排
      mobileGames: mobiles.sort(sortFn),
      normalGames: normals.sort(sortFn)
    };
  }, [selectedTag]);

  return (
    <main className="min-h-screen flex flex-col">
      {/* 极简头部 */}
      <div className="pt-16 pb-8 px-4 md:px-8 max-w-7xl mx-auto w-full">
        <div className="inline-block">
          <h1 className="text-4xl md:text-5xl font-light text-white tracking-wider uppercase drop-shadow-lg">
            My Game List
          </h1>
          <div className="h-1 w-full bg-gradient-to-r from-[#66c0f4] to-transparent mt-2 mb-1"></div>
          <p className="text-[#8f98a0] text-sm tracking-[0.2em] uppercase">
            Design Inspiration By Steam
          </p>
        </div>
      </div>
      
      <FilterBar 
        tags={allTags} 
        selectedTag={selectedTag} 
        onSelectTag={setSelectedTag} 
      />
      
      <div className="max-w-7xl mx-auto w-full flex-grow pb-10">
        {/* 区域 1：参与研发的项目 (最顶部) */}
        {anchorGames.length > 0 && (
          <div className="mt-8 mb-12">
            <div className="px-4 md:px-8 mb-4 flex items-center gap-3">
              <h2 className="text-xl font-bold text-white tracking-wide">参与研发</h2>
              <div className="h-px flex-1 bg-gradient-to-r from-[#2a475e] to-transparent"></div>
            </div>
            <GameGrid games={anchorGames} />
          </div>
        )}

        {/* 区域 2：游玩与拆解库 (中间) */}
        {normalGames.length > 0 && (
          <div className="mb-12">
            <div className="px-4 md:px-8 mb-4 flex items-center gap-3">
              <h2 className="text-xl font-bold text-white tracking-wide">游戏经历</h2>
              <div className="h-px flex-1 bg-gradient-to-r from-[#2a475e] to-transparent"></div>
            </div>
            <GameGrid games={normalGames} />
          </div>
        )}

        {/* 区域 3：移动端游戏 (移到最下面) */}
        {mobileGames.length > 0 && (
          <div>
            <div className="px-4 md:px-8 mb-4 flex items-center gap-3">
              <h2 className="text-xl font-bold text-white tracking-wide">移动端游戏</h2>
              <div className="h-px flex-1 bg-gradient-to-r from-[#2a475e] to-transparent"></div>
            </div>
            <GameGrid games={mobileGames} />
          </div>
        )}

        {/* 空状态 */}
        {anchorGames.length === 0 && mobileGames.length === 0 && normalGames.length === 0 && (
          <div className="text-center py-20 text-[#8f98a0]">
            <p className="text-xl">没有找到匹配的游戏</p>
            <p className="mt-2">尝试调整过滤条件</p>
          </div>
        )}
      </div>

      {/* 底部文案 */}
      <footer className="w-full py-12 border-t border-[#2a475e] bg-[#171a21] mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center flex flex-col gap-2">
          <p className="text-[#8f98a0] text-sm tracking-wide">
            This represents only a portion of my gaming experience.
          </p>
          <p className="text-[#8f98a0] text-sm tracking-wide">
            The game is still ongoing, and I’ll continue to add more content.
          </p>
        </div>
      </footer>
    </main>
  );
}