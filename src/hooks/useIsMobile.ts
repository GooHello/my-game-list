import { useState, useEffect } from 'react';

/**
 * 检测是否为移动端视口（默认断点 768px）
 * GameCard 与 FilterBar 共用，确保 resize 行为一致
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [breakpoint]);

  return isMobile;
}
