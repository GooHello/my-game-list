'use client';

import { useState } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';

interface TagTiers {
  core: string[];
  sub: string[];
  mode: string[];
}

interface FilterBarProps {
  tagTiers: TagTiers;
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  searchQuery: string;
  onSearch: (query: string) => void;
  statusCounts: Record<string, number>;
  selectedStatus: string | null;
  onSelectStatus: (status: string | null) => void;
}

// 状态枚举的展示配置（与 GameCard 的状态图标/文案保持一致）
const STATUS_META: Record<string, { label: string; icon: string }> = {
  playing: { label: '游玩中', icon: '🎮' },
  cleared: { label: '已通关', icon: '🏆' },
  completed: { label: '全成就', icon: '✨' },
  'on-hold': { label: '搁置', icon: '⏳' },
  dropped: { label: '放弃', icon: '❌' },
};

function TagButton({ tag, isSelected, onClick, compact = false }: { tag: string; isSelected: boolean; onClick: () => void; compact?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`${compact ? 'px-2.5 py-1 text-xs' : 'px-4 py-1.5 text-sm'} rounded-sm font-medium transition-all duration-200 whitespace-nowrap ${
        isSelected
          ? 'bg-gradient-to-r from-[#47bfff] to-[#1a44c2] text-white shadow-[0_0_10px_rgba(71,191,255,0.3)]'
          : 'bg-[#202d39] text-[#c7d5e0] hover:bg-[#2a475e] hover:text-white border border-[#3d4450]/50'
      }`}
    >
      {tag}
    </button>
  );
}

export default function FilterBar({ tagTiers, selectedTag, onSelectTag, searchQuery, onSearch, statusCounts, selectedStatus, onSelectStatus }: FilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isMobile = useIsMobile();

  // 只显示有游戏的状态档，按 STATUS_META 的固定顺序
  const activeStatuses = Object.keys(STATUS_META).filter(s => (statusCounts[s] || 0) > 0);

  const tierConfig = [
    { label: 'Genre', tags: tagTiers.core },
    { label: 'Sub-Genre', tags: tagTiers.sub },
    { label: 'Mode', tags: tagTiers.mode },
  ];

  const handleTagClick = (tag: string | null) => {
    onSelectTag(tag);
    // 移动端选中后自动收起
    if (isMobile) {
      setIsExpanded(false);
    }
  };

  const handleStatusClick = (status: string | null) => {
    onSelectStatus(status);
    if (isMobile) {
      setIsExpanded(false);
    }
  };

  // 「全部游戏」= 重置所有筛选（标签 + 搜索 + 状态）
  const resetAll = () => {
    onSelectTag(null);
    onSearch('');
    onSelectStatus(null);
  };

  // 状态行（桌面端与移动端展开态共用）
  const statusRow = activeStatuses.length > 0 && (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[#8f98a0] text-sm w-20 shrink-0 text-left font-bold">状态</span>
      {activeStatuses.map(status => (
        <TagButton
          key={status}
          tag={`${STATUS_META[status].icon} ${STATUS_META[status].label} ${statusCounts[status]}`}
          isSelected={selectedStatus === status}
          onClick={() => handleStatusClick(selectedStatus === status ? null : status)}
        />
      ))}
    </div>
  );

  // 移动端展开态的状态行（紧凑样式）
  const statusRowCompact = activeStatuses.length > 0 && (
    <div>
      <span className="text-[#8f98a0] text-xs font-bold mb-1 block">状态</span>
      <div className="flex flex-wrap gap-1.5">
        {activeStatuses.map(status => (
          <TagButton
            key={status}
            tag={`${STATUS_META[status].icon} ${STATUS_META[status].label} ${statusCounts[status]}`}
            isSelected={selectedStatus === status}
            onClick={() => handleStatusClick(selectedStatus === status ? null : status)}
            compact
          />
        ))}
      </div>
    </div>
  );

  // ========================
  // 移动端：折叠/展开模式
  // ========================
  if (isMobile) {
    return (
      <div className="sticky top-0 z-30 bg-[#1b2838]/95 backdrop-blur-md border-b border-[#2a475e] shadow-lg">
        <div className="px-3 py-2">
          {/* 收起状态：一行显示当前选中 + 展开按钮 */}
          {!isExpanded && (
            <div className="flex items-center gap-2">
              <TagButton
                tag="全部游戏"
                isSelected={selectedTag === null && !searchQuery && selectedStatus === null}
                onClick={resetAll}
                compact
              />
              {selectedTag && (
                <TagButton
                  tag={selectedTag}
                  isSelected={true}
                  onClick={() => handleTagClick(null)}
                  compact
                />
              )}
              {selectedStatus && (
                <TagButton
                  tag={`${STATUS_META[selectedStatus]?.icon || ''} ${STATUS_META[selectedStatus]?.label || selectedStatus}`}
                  isSelected={true}
                  onClick={() => handleStatusClick(null)}
                  compact
                />
              )}
              <button
                onClick={() => setIsExpanded(true)}
                className="ml-auto px-3 py-1 text-xs text-[#66c0f4] border border-[#66c0f4]/40 rounded-sm bg-[#202d39] hover:bg-[#2a475e] transition-colors flex items-center gap-1"
              >
                展开筛选 ▾
              </button>
            </div>
          )}

          {/* 展开状态：状态 + 完整三级标签 */}
          {isExpanded && (
            <div className="space-y-2.5">
              {/* 顶部：标题 + 收起按钮 */}
              <div className="flex items-center justify-between pb-1 border-b border-[#2a475e]/50">
                <TagButton
                  tag="全部游戏"
                  isSelected={selectedTag === null && selectedStatus === null}
                  onClick={resetAll}
                  compact
                />
                <button
                  onClick={() => setIsExpanded(false)}
                  className="px-3 py-1 text-xs text-[#66c0f4] border border-[#66c0f4]/40 rounded-sm bg-[#202d39] hover:bg-[#2a475e] transition-colors"
                >
                  收起筛选 ▴
                </button>
              </div>

              {statusRowCompact}

              {tierConfig.map(({ label, tags }, tierIdx) => (
                tags.length > 0 && (
                  <div key={tierIdx}>
                    <span className="text-[#8f98a0] text-xs font-bold mb-1 block">{label}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map(tag => (
                        <TagButton
                          key={tag}
                          tag={tag}
                          isSelected={selectedTag === tag}
                          onClick={() => handleTagClick(tag)}
                          compact
                        />
                      ))}
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ========================
  // 桌面端：状态行 + 三行完整展示
  // ========================
  return (
    <div className="sticky top-0 z-30 bg-[#1b2838]/95 backdrop-blur-md border-b border-[#2a475e] shadow-lg">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 space-y-2">
        {statusRow}
        {tierConfig.map(({ label, tags }, tierIdx) => (
          tags.length > 0 && (
            <div key={tierIdx} className="flex items-center gap-2 flex-wrap">
              <span className="text-[#8f98a0] text-sm w-20 shrink-0 text-left font-bold">
                {label}
              </span>
              {tierIdx === 0 && (
                <TagButton
                  tag="全部游戏"
                  isSelected={selectedTag === null && !searchQuery && selectedStatus === null}
                  onClick={resetAll}
                />
              )}
              {tags.map(tag => (
                <TagButton
                  key={tag}
                  tag={tag}
                  isSelected={selectedTag === tag}
                  onClick={() => onSelectTag(tag)}
                />
              ))}
            </div>
          )
        ))}
      </div>
    </div>
  );
}
