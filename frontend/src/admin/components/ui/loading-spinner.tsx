import { cn } from './utils';
import { 
  Coffee, 
  UtensilsCrossed, 
  Package, 
  Users, 
  ClipboardList,
  LayoutGrid,
  CreditCard,
  Truck,
  Settings,
  ChefHat,
  ShoppingCart,
  Bell,
  TrendingUp,
  Gift,
  type LucideIcon
} from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
  icon?: LucideIcon | 'orders' | 'tables' | 'inventory' | 'staff' | 'menu' | 'billing' | 'kitchen' | 'delivery' | 'settings' | 'customers' | 'reports' | 'alerts' | 'offers';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const iconMap: Record<string, LucideIcon> = {
  orders: ClipboardList,
  tables: LayoutGrid,
  inventory: Package,
  staff: Users,
  menu: UtensilsCrossed,
  billing: CreditCard,
  kitchen: ChefHat,
  delivery: Truck,
  settings: Settings,
  customers: ShoppingCart,
  reports: TrendingUp,
  alerts: Bell,
  offers: Gift,
};

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
};

export function LoadingSpinner({ 
  message = 'Loading...', 
  icon = Coffee,
  className,
  size = 'md'
}: LoadingSpinnerProps) {
  const IconComponent = typeof icon === 'string' ? iconMap[icon] || Coffee : icon;
  
  return (
    <div className={cn("flex items-center justify-center h-96", className)}>
      <div className="text-center">
        <div className="relative">
          {/* Outer ring animation */}
          <div className="absolute inset-0 m-auto h-20 w-20 rounded-full border-4 border-primary/20 animate-ping" />
          
          {/* Icon container with subtle bounce */}
          <div className="relative z-10 flex h-20 w-20 items-center justify-center mx-auto mb-4">
            <IconComponent 
              className={cn(
                "text-muted-foreground animate-pulse",
                sizeClasses[size]
              )} 
            />
          </div>
        </div>
        
        <p className="text-muted-foreground text-sm font-medium mt-2">{message}</p>
        
        {/* Animated dots */}
        <div className="flex items-center justify-center gap-1 mt-3">
          <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

// Pre-configured loading components for each module
export function LoadingOrders() {
  return <LoadingSpinner message="Loading orders..." icon="orders" />;
}

export function LoadingTables() {
  return <LoadingSpinner message="Loading tables..." icon="tables" />;
}

export function LoadingInventory() {
  return <LoadingSpinner message="Loading inventory..." icon="inventory" />;
}

export function LoadingStaff() {
  return <LoadingSpinner message="Loading staff..." icon="staff" />;
}

export function LoadingMenu() {
  return <LoadingSpinner message="Loading menu..." icon="menu" />;
}

export function LoadingBilling() {
  return <LoadingSpinner message="Loading billing..." icon="billing" />;
}

export function LoadingKitchen() {
  return <LoadingSpinner message="Loading kitchen..." icon="kitchen" />;
}

export function LoadingDelivery() {
  return <LoadingSpinner message="Loading delivery..." icon="delivery" />;
}

export function LoadingSettings() {
  return <LoadingSpinner message="Loading settings..." icon="settings" />;
}

export function LoadingCustomers() {
  return <LoadingSpinner message="Loading customers..." icon="customers" />;
}

export function LoadingReports() {
  return <LoadingSpinner message="Loading reports..." icon="reports" />;
}

export function LoadingAlerts() {
  return <LoadingSpinner message="Loading notifications..." icon="alerts" />;
}

export function LoadingOffers() {
  return <LoadingSpinner message="Loading offers..." icon="offers" />;
}
