import { Home, User, Calendar, Clock, Menu as MenuIcon, ShoppingCart, Gift, MapPin, History, MessageSquare, Settings, Bell, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Module, User as UserType } from '@/client/app/App';
import { useNotifications } from '@/client/context/NotificationsContext';
import { useSystemConfig } from '@/client/context/SystemConfigContext';
import AppNavbar from '@/shared/components/AppNavbar';

interface TopDashboardProps {
  activeModule: Module;
  isLoggedIn: boolean;
  cartItemCount: number;
  onModuleChange: (module: Module) => void;
  onLogout: () => void;
  user: UserType | null;
  showModuleNav?: boolean; // New prop to control module nav visibility
}

interface NavItem {
  id: Module;
  label: string;
  icon: React.ReactNode;
}

export default function TopDashboard({
  activeModule,
  isLoggedIn,
  cartItemCount,
  onModuleChange,
  onLogout,
  user,
  showModuleNav = true // Default to true
}: TopDashboardProps) {
  const navigate = useNavigate();
  const { getUnreadCount } = useNotifications();
  const unreadCount = getUnreadCount();
  const { config: sysConfig } = useSystemConfig();

  const restaurantName = 'Urban Bites';

  const navItems: NavItem[] = [
    { id: 'home', label: 'Home', icon: <Home className="w-4 h-4" /> },
    // Profile, Cart, Settings removed from module navigation - accessible only via header icons
    { id: 'reservation', label: 'Reservation', icon: <Calendar className="w-4 h-4" /> },
    { id: 'queue', label: 'Queue', icon: <Clock className="w-4 h-4" /> },
    { id: 'menu', label: 'Menu', icon: <MenuIcon className="w-4 h-4" /> },
    { id: 'offers', label: 'Offers & Loyalty', icon: <Gift className="w-4 h-4" /> },
    { id: 'tracking', label: 'Order Tracking', icon: <MapPin className="w-4 h-4" /> },
    { id: 'feedback', label: 'Feedback', icon: <MessageSquare className="w-4 h-4" /> },
  ];

  const rightSlot = !isLoggedIn ? (
    <button
      onClick={() => navigate('/admin')}
      className="flex items-center gap-1.5 px-3 py-2 text-muted-foreground hover:text-foreground border border-border hover:border-border rounded-lg transition-all duration-200 text-[11px] font-medium uppercase tracking-wider bg-white/70 hover:bg-white flex-shrink-0"
    >
      <ShieldCheck className="w-4 h-4" />
      <span>Staff</span>
    </button>
  ) : (
    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
      <button
        onClick={() => onModuleChange('cart')}
        className={`relative app-icon-button transition-all ${
          activeModule === 'cart' ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
        }`}
        title="Cart"
      >
        <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
        {cartItemCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-white text-[10px] w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center font-semibold">
            {cartItemCount}
          </span>
        )}
      </button>

      <button
        onClick={() => onModuleChange('notifications')}
        className={`relative app-icon-button transition-all ${
          activeModule === 'notifications' ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
        }`}
        title="Notifications"
      >
        <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-accent text-foreground text-[10px] min-w-4 h-4 sm:min-w-5 sm:h-5 px-1 rounded-full flex items-center justify-center font-semibold border border-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <button
        onClick={() => onModuleChange('profile')}
        className={`relative app-icon-button transition-all ${
          activeModule === 'profile' ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
        }`}
        title={user?.name || 'Profile'}
      >
        <User className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      <button
        onClick={() => onModuleChange('settings')}
        className={`relative app-icon-button transition-all ${
          activeModule === 'settings' ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
        }`}
        title="Settings"
      >
        <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>
    </div>
  );

  return (
    <div className="fixed top-0 left-0 right-0 z-50 app-header">
      <AppNavbar
        title={restaurantName}
        mobileTitle="Urban Bites"
        logoSrc={sysConfig.logoUrl || '/favicon.png'}
        className="bg-white/90 backdrop-blur-sm text-foreground border-b border-border/70"
        rightSlot={rightSlot}
      />

      {/* Module Navigation Bar - Below Header, Only After Login */}
      {isLoggedIn && showModuleNav && (
        <nav className="bg-white border-b border-border">
          <div className="app-navbar-inner">
            <div className="app-subnav-row flex items-center gap-0.5 sm:gap-1 overflow-x-auto scrollbar-hide">
              {navItems.map((item) => {
                const active = activeModule === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => onModuleChange(item.id)}
                    className={`app-tab-trigger relative whitespace-nowrap text-xs sm:text-sm ${active ? 'bg-primary text-white shadow-sm' : 'text-foreground hover:bg-secondary'}`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                    {item.id === 'cart' && cartItemCount > 0 && !active && (
                      <span className="ml-1 bg-destructive text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                        {cartItemCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      )}
    </div>
  );
}