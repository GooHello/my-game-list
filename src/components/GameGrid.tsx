import GameCard from './GameCard';

interface GameGridProps {
  games: Array<{
    id: string;
    title: string;
    cover: string;
    playtime: string;
    showPlaytime: boolean;
    playStatus: string;
    tags: string[];
    isAnchor: boolean;
    reviewFile: string | null;
  }>;
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
    <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-x-2 gap-y-2 md:gap-x-6 md:gap-y-4 p-2 md:p-8">
      {games.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  );
}