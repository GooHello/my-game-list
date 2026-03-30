'use client';

interface FilterBarProps {
  tags: string[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
}

export default function FilterBar({ tags, selectedTag, onSelectTag }: FilterBarProps) {
  return (
    <div className="sticky top-0 z-30 bg-[#1b2838]/95 backdrop-blur-md border-b border-[#2a475e] shadow-lg">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => onSelectTag(null)}
          className={`px-4 py-1.5 rounded-sm text-sm font-medium transition-all duration-200 ${
            selectedTag === null
              ? 'bg-gradient-to-r from-[#47bfff] to-[#1a44c2] text-white shadow-[0_0_10px_rgba(71,191,255,0.3)]'
              : 'bg-[#202d39] text-[#c7d5e0] hover:bg-[#2a475e] hover:text-white border border-[#3d4450]/50'
          }`}
        >
          全部游戏
        </button>
        
        {tags.map((tag) => (
          <button
            key={tag}
            onClick={() => onSelectTag(tag)}
            className={`px-4 py-1.5 rounded-sm text-sm font-medium transition-all duration-200 ${
              selectedTag === tag
                ? 'bg-gradient-to-r from-[#47bfff] to-[#1a44c2] text-white shadow-[0_0_10px_rgba(71,191,255,0.3)]'
                : 'bg-[#202d39] text-[#c7d5e0] hover:bg-[#2a475e] hover:text-white border border-[#3d4450]/50'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}