import { Badge } from '@/admin/components/ui/badge';
import { cn } from '@/admin/components/ui/utils';

interface LiveDataIndicatorProps {
  variant?: 'dashboard' | 'reports' | 'kitchen' | 'orders';
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LiveDataIndicator({ 
  variant = 'dashboard', 
  showLabel = true,
  size = 'md',
  className 
}: LiveDataIndicatorProps) {
  const sizeClasses = {
    sm: 'h-6 px-2 text-xs',
    md: 'h-8 px-3 text-sm',
    lg: 'h-10 px-4 text-base',
  };

  const dotSizes = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };

  return (
    <Badge 
      className={cn(
        'bg-red-600 text-white font-semibold flex items-center gap-2 animate-pulse-subtle shadow-md',
        sizeClasses[size],
        className
      )}
     
    >
      {/* Pulsing Dot */}
      <span className="relative flex">
        <span className={cn(
          'absolute inline-flex rounded-full bg-red-400 opacity-75 animate-ping',
          dotSizes[size]
        )} />
        <span className={cn(
          'relative inline-flex rounded-full bg-white',
          dotSizes[size]
        )} />
      </span>
      
      {/* Label */}
      {showLabel && <span>Live Data</span>}
    </Badge>
  );
}

// Module Connection Indicator - Shows which modules are connected
interface ModuleConnectionProps {
  modules: Array<{
    name: string;
    icon: React.ReactNode;
    active: boolean;
  }>;
  className?: string;
}

export function ModuleConnectionIndicator({ modules, className }: ModuleConnectionProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {modules.map((module, index) => (
        <div key={module.name} className="flex items-center gap-2">
          {/* Module Badge */}
          <Badge 
            variant={module.active ? 'default' : 'outline'}
            className={cn(
              'h-8 px-3 flex items-center gap-2',
              module.active ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'
            )}
          >
            {module.icon}
            <span className="text-xs font-medium">{module.name}</span>
          </Badge>
          
          {/* Connection Line */}
          {index < modules.length - 1 && (
            <div className={cn(
              'h-px w-6 transition-colors',
              module.active && modules[index + 1].active 
                ? 'bg-green-600' 
                : 'bg-gray-300'
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

// Status Dot Component - For staff status indicators
interface StatusDotProps {
  status: 'active' | 'leave' | 'busy' | 'offline';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function StatusDot({ status, size = 'md', showLabel = false, className }: StatusDotProps) {
  const statusConfig = {
    active: { color: 'bg-green-600', label: 'Active', ring: 'ring-green-600' },
    leave: { color: 'bg-orange-500', label: 'On Leave', ring: 'ring-orange-500' },
    busy: { color: 'bg-red-600', label: 'Busy', ring: 'ring-red-600' },
    offline: { color: 'bg-gray-400', label: 'Offline', ring: 'ring-gray-400' },
  };

  const dotSizes = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const config = statusConfig[status];

  if (showLabel) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <span className={cn(
          'relative flex',
          dotSizes[size]
        )}>
          <span className={cn(
            'absolute inline-flex rounded-full opacity-75 animate-ping',
            config.color,
            dotSizes[size]
          )} />
          <span className={cn(
            'relative inline-flex rounded-full',
            config.color,
            dotSizes[size]
          )} />
        </span>
        <span className="text-sm font-medium">
          {config.label}
        </span>
      </div>
    );
  }

  return (
    <span className={cn(
      'relative flex',
      dotSizes[size],
      className
    )}>
      <span className={cn(
        'absolute inline-flex rounded-full opacity-75 animate-ping',
        config.color,
        dotSizes[size]
      )} />
      <span className={cn(
        'relative inline-flex rounded-full ring-2 ring-offset-2',
        config.color,
        config.ring,
        dotSizes[size]
      )} />
    </span>
  );
}

// Add this to your CSS (or in a global styles file)
// @keyframes pulse-subtle {
//   0%, 100% { opacity: 1; }
//   50% { opacity: 0.8; }
// }
// 
// .animate-pulse-subtle {
//   animation: pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
// }
