import { useEffect, useRef, useState } from 'react';
import { fetchSystemConfig } from '@/client/api/config';
import type { ReactNode } from 'react';

interface TopAppBarProps {
  title?: string;
  centerSlot?: ReactNode;
  rightSlot?: ReactNode;
  showLogo?: boolean;
}

export default function TopAppBar({
  title = 'Urban Bites',
  centerSlot,
  rightSlot,
  showLogo = true,
}: TopAppBarProps) {
  const [sysConfig, setSysConfig] = useState({ restaurantName: 'Urban Bites', logoUrl: '/favicon.png' });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSystemConfig()
      .then((cfg) => {
        setSysConfig({
          restaurantName: cfg.restaurantName?.trim() || 'Urban Bites',
          logoUrl: cfg.logoUrl || '/favicon.png',
        });
      })
      .catch(() => {
        setSysConfig({ restaurantName: 'Urban Bites', logoUrl: '/favicon.png' });
      });
  }, []);

  return (
    <div ref={containerRef} className="relative z-30 max-w-7xl mx-auto">
      <div className="bg-white/95 border border-[#E8DED0] rounded-xl shadow-sm px-3 py-2">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          {/* Left: Logo + Title */}
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            {showLogo && (
              <img
                src={sysConfig.logoUrl || '/favicon.png'}
                alt="Logo"
                className="w-8 h-8 rounded-md object-cover border border-[#E8DED0] bg-[#FAF1E6]"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/favicon.png'; }}
              />
            )}
            <span className="text-sm sm:text-base font-semibold text-[#3E2723] truncate">
              {title || sysConfig.restaurantName || 'Urban Bites'}
            </span>
          </div>

          {/* Center: Customizable content (e.g., search) */}
          {centerSlot && (
            <div className="flex-1 min-w-0 px-1 sm:px-2 flex items-center justify-center">
              <div className="w-full max-w-[460px]">{centerSlot}</div>
            </div>
          )}
          {!centerSlot && <div className="flex-1" />}

          {/* Right: Customizable actions */}
          {rightSlot && (
            <div className="flex items-center gap-1.5 sm:gap-2 justify-end shrink-0">
              {rightSlot}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
