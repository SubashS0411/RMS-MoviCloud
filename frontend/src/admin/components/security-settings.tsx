import { useState, useEffect } from 'react';
import { LoadingSettings } from '@/admin/components/ui/loading-spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/admin/components/ui/card';
import { Button } from '@/admin/components/ui/button';
import { Badge } from '@/admin/components/ui/badge';
import { 
  Shield, 
  Users, 
  FileText, 
  Database, 
  Wrench,
  DollarSign,
  Lock,
  Settings,
} from 'lucide-react';
import { cn } from '@/admin/components/ui/utils';

// Import sub-components
import { AccountAuthentication } from '@/admin/components/settings/account-authentication';
import { RoleBasedAccessControl } from '@/admin/components/settings/role-based-access-control';
import { AuditLogs } from '@/admin/components/settings/audit-logs';
import { SystemConfiguration } from '@/admin/components/settings/system-configuration';
import { TaxServiceSettings } from '@/admin/components/settings/tax-service-settings';
import { BackupRecovery } from '@/admin/components/settings/backup-recovery';

type SettingsSection = 
  | 'account' 
  | 'rbac' 
  | 'audit' 
  | 'system' 
  | 'tax' 
  | 'backup';

interface NavigationItem {
  id: SettingsSection;
  label: string;
  icon: any;
  description: string;
}

const navigationItems: NavigationItem[] = [
  {
    id: 'account',
    label: 'Account & Authentication',
    icon: Lock,
    description: 'Manage passwords and user accounts',
  },
  {
    id: 'rbac',
    label: 'Role-Based Access Control',
    icon: Shield,
    description: 'Configure roles and permissions',
  },
  {
    id: 'audit',
    label: 'Audit Logs',
    icon: FileText,
    description: 'View system activity logs',
  },
  {
    id: 'system',
    label: 'System Configuration',
    icon: Wrench,
    description: 'Restaurant and system settings',
  },
  {
    id: 'tax',
    label: 'Tax & Service Charge',
    icon: DollarSign,
    description: 'Configure tax and pricing',
  },
  {
    id: 'backup',
    label: 'Backup & Recovery',
    icon: Database,
    description: 'Manage data backups',
  },
];

export function SecuritySettings() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('account');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 350);
    return () => clearTimeout(t);
  }, []);

  const renderContent = () => {
    switch (activeSection) {
      case 'account':
        return <AccountAuthentication />;
      case 'rbac':
        return <RoleBasedAccessControl />;
      case 'audit':
        return <AuditLogs />;
      case 'system':
        return <SystemConfiguration />;
      case 'tax':
        return <TaxServiceSettings />;
      case 'backup':
        return <BackupRecovery />;
      default:
        return <AccountAuthentication />;
    }
  };

  if (loading) return <LoadingSettings />;

  return (
    <div className="min-h-screen bg-[#f8f8f8] px-4 py-4 sm:px-6 sm:py-5 space-y-4 sm:space-y-5 max-w-full overflow-x-hidden">

      {/* Settings Navigation */}
      <div className="w-full overflow-x-auto pb-2">
        <nav className="flex gap-3 min-w-max p-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-xl transition-colors text-left min-w-[240px] border shadow-sm',
                  isActive
                    ? 'bg-[#e8f0ff] border-[#c9d9ff] text-[#2D2D2D]'
                    : 'bg-white border-[#e7ded4] text-[#4f4f4f] hover:bg-gray-50'
                )}
              >
                <Icon className={cn('h-5 w-5 mt-0.5 flex-shrink-0', isActive ? 'text-[#2D2D2D]' : 'text-muted-foreground')} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium', isActive ? 'text-[#2D2D2D]' : 'text-foreground')}>
                    {item.label}
                  </p>
                  <p className={cn('text-xs mt-0.5', isActive ? 'text-[#5f5f5f]' : 'text-muted-foreground')}>
                    {item.description}
                  </p>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="w-full rounded-2xl border border-[#e7ded4] bg-white shadow-sm p-3 sm:p-4">
        {renderContent()}
      </div>
    </div>
  );
}
