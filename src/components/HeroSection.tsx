export default function HeroSection() {
  return (
    <div className="relative bg-slate-900 overflow-hidden border-b border-slate-800">
      {/* 背景装饰 */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-gradient-to-b from-blue-900/20 to-transparent pointer-events-none"></div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight mb-4">
            <span className="block">游戏策划作品集</span>
            <span className="block text-blue-500 mt-2 text-3xl md:text-5xl">Gameplay & 系统交互设计</span>
          </h1>
          
          <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-400">
            600+ 款游戏阅历沉淀，专注于核心战斗拆解、被动 BD 构建与主机交互适配。
          </p>

          <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
            <div className="bg-slate-800/80 backdrop-blur border border-slate-700 rounded-xl p-6 text-left shadow-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                  七
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">七日世界 (Once Human)</h3>
                  <p className="text-sm text-blue-400">战斗策划 · 11个月</p>
                </div>
              </div>
              <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside pl-2">
                <li>战斗异常物（召唤物+英雄技能）设计</li>
                <li>战斗被动 BD 构建与系统优化</li>
                <li>主机端交互适配与体验打磨</li>
              </ul>
            </div>

            <div className="bg-slate-800/80 backdrop-blur border border-slate-700 rounded-xl p-6 text-left shadow-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold">
                  香
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">香肠派对 (Sausage Man)</h3>
                  <p className="text-sm text-orange-400">玩法策划 · 5个月</p>
                </div>
              </div>
              <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside pl-2">
                <li>游戏副玩法（街机模式）设计</li>
                <li>战斗道具（枪械、装备、技能）设计</li>
                <li>联动 IP 监修与落地</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}