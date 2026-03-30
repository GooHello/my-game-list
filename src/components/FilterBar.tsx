'use client';

interface TagTiers {
  core: string[];
  sub: string[];
  mode: string[];
}

interface FilterBarProps {
  tagTiers: TagTiers;
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
}

function TagButton({ tag, isSelected, onClick }: { tag: string; isSelected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-sm text-sm font-medium transition-all duration-200 whitespace-nowrap ${
        isSelected
          ? 'bg-gradient-to-r from-[#47bfff] to-[#1a44c2] text-white shadow-[0_0_10px_rgba(71,191,255,0.3)]'
          : 'bg-[#202d39] text-[#c7d5e0] hover:bg-[#2a475e] hover:text-white border border-[#3d4450]/50'
      }`}
    >
      {tag}
    </button>
  );
}

export default function FilterBar({ tagTiers, selectedTag, onSelectTag }: FilterBarProps) {
  const tierConfig = [
    { label: 'Genre', tags: tagTiers.core },
    { label: 'Sub-Genre', tags: tagTiers.sub },
    { label: 'Mode', tags: tagTiers.mode },
  ];

  return (
    <div className="sticky top-0 z-30 bg-[#1b2838]/95 backdrop-blur-md border-b border-[#2a475e] shadow-lg">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 space-y-2">
        {/* 第0行：全部游戏按钮 */}
        {tierConfig.map(({ label, tags }, tierIdx) => (
          tags.length > 0 && (
            <div key={tierIdx} className="flex items-center gap-2 flex-wrap">
              {/* 行标签 */}
              <span className="text-[#8f98a0] text-sm w-20 shrink-0 text-left hidden md:inline-block font-bold">
                {label}
              </span>
              {/* 第一行加上"全部游戏"按钮 */}
              {tierIdx === 0 && (
                <TagButton
                  tag="全部游戏"
                  isSelected={selectedTag === null}
                  onClick={() => onSelectTag(null)}
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