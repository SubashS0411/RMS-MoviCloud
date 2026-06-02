import { useState, useEffect } from 'react';
import { LoadingStaff } from '@/admin/components/ui/loading-spinner';
import { Input } from '@/admin/components/ui/input';
import {
  Tabs,
  TabsContent,
} from '@/admin/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/admin/components/ui/select';
import {
  Search,
  LayoutDashboard,
  Users,
  CalendarCheck,
  Clock,
  FileBarChart,
  Filter,
} from 'lucide-react';
import { cn } from '@/admin/components/ui/utils';

// Import sub-components
import { StaffOverview } from "./staff/StaffOverview";
import { StaffList } from "./staff/StaffList";
import { StaffAttendance } from "./staff/StaffAttendance";
import { StaffShiftTimings } from "./staff/StaffShiftTimings";
import { StaffReports } from "./staff/StaffReports";

export function StaffManagement() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [globalSearch, setGlobalSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [shiftFilter, setShiftFilter] = useState('all');

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 350);
    return () => clearTimeout(t);
  }, []);

  const tabs = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, description: 'Staff overview' },
    { id: 'staff', label: 'Staff', icon: Users, description: 'Employee records' },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck, description: 'Daily tracking' },
    { id: 'shift-timings', label: 'Shift Timings', icon: Clock, description: 'Schedule management' },
    { id: 'reports', label: 'Reports', icon: FileBarChart, description: 'Analytics & insights' },
  ];

  if (loading) return <LoadingStaff />;

  return (
    <div className="min-h-screen bg-[#f8f6f3] px-4 py-4 sm:px-6 sm:py-5 space-y-4 sm:space-y-5 max-w-full overflow-x-hidden">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search staff..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="pl-10 bg-white border border-border rounded-xl h-10 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-[#8B5A2B]"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-auto min-w-[140px] max-w-[200px] bg-white border-border text-foreground rounded-xl h-10">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
            <SelectValue placeholder="Role" className="whitespace-normal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="chef">Chef</SelectItem>
            <SelectItem value="waiter">Waiter</SelectItem>
            <SelectItem value="cashier">Cashier</SelectItem>
          </SelectContent>
        </Select>
        <Select value={shiftFilter} onValueChange={setShiftFilter}>
          <SelectTrigger className="w-auto min-w-[140px] max-w-[200px] bg-white border-border text-foreground rounded-xl h-10">
            <Clock className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
            <SelectValue placeholder="Shift" className="whitespace-normal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Shifts</SelectItem>
            <SelectItem value="morning">Morning</SelectItem>
            <SelectItem value="evening">Evening</SelectItem>
            <SelectItem value="night">Night</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-full overflow-x-auto pb-2">
        <nav className="flex gap-3 min-w-max p-1">
          {tabs.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg transition-colors text-left min-w-[180px] border shadow-sm',
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary shadow-md'
                    : 'bg-white text-foreground border-border hover:bg-gray-50'
                )}
              >
                <Icon className={cn('h-5 w-5 mt-0.5 flex-shrink-0', isActive ? 'text-primary-foreground' : 'text-muted-foreground')} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium', isActive ? 'text-primary-foreground' : 'text-foreground')}>
                    {item.label}
                  </p>
                  <p className={cn('text-xs mt-0.5', isActive ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                    {item.description}
                  </p>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

          <TabsContent value="overview" className="mt-0 focus-visible:outline-none">
            <StaffOverview />
          </TabsContent>

          <TabsContent value="staff" className="mt-0 focus-visible:outline-none">
            <StaffList globalSearch={globalSearch} globalRoleFilter={roleFilter} globalShiftFilter={shiftFilter} />
          </TabsContent>

          <TabsContent value="attendance" className="mt-0 focus-visible:outline-none">
            <StaffAttendance globalSearch={globalSearch} />
          </TabsContent>

          <TabsContent value="shift-timings" className="mt-0 focus-visible:outline-none">
            <StaffShiftTimings globalSearch={globalSearch} />
          </TabsContent>

          <TabsContent value="reports" className="mt-0 focus-visible:outline-none">
            <StaffReports />
          </TabsContent>
        </Tabs>
    </div>
  );
}
