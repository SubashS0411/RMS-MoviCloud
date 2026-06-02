import type { ReactNode } from 'react';

interface AppNavbarProps {
  title: string;
  logoSrc?: string;
  mobileTitle?: string;
  rightSlot?: ReactNode;
  className?: string;
  innerClassName?: string;
}

export default function AppNavbar({
  title,
  logoSrc = '/favicon.png',
  mobileTitle,
  rightSlot,
  className,
  innerClassName = 'app-navbar-inner',
}: AppNavbarProps) {
  return (
    <div className={className}>
      <div className={innerClassName}>
        <div className="app-navbar-row">
          <div className="app-navbar-left">
            <img
              src={logoSrc}
              alt="Logo"
              className="app-brand-logo"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/favicon.png'; }}
            />
            <div className="min-w-0 overflow-hidden">
              <div className="sm:hidden app-brand-title-mobile truncate">{mobileTitle || title}</div>
              <div className="hidden sm:block app-brand-title truncate">{title}</div>
            </div>
          </div>

          <div className="app-navbar-right">
            {rightSlot}
          </div>
        </div>
      </div>
    </div>
  );
}