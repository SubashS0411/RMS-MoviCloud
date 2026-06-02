import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/admin/components/ui/card';
import { Button } from '@/admin/components/ui/button';
import { Input } from '@/admin/components/ui/input';
import { Badge } from '@/admin/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/admin/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/admin/components/ui/select';
import { FileText, Download, RefreshCcw, Search, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface AuditLog {
  _id: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  userId?: string;
  userName?: string;
  details?: Record<string, unknown>;
  status?: string;
  ip?: string;
  timestamp?: string;
  createdAt?: string;
}

export function AuditLogs() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [resources, setResources] = useState<string[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);

  // Fetch from API - with proper error handling
  const fetchData = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const API_URL = import.meta.env.PROD
        ? (import.meta.env.VITE_API_URL || '') + '/api/admin'
        : '/api/admin';
      
      const headers = {
        'Content-Type': 'application/json',
      };

      // Fetch audit logs
      let logs: AuditLog[] = [];
      let total = 0;
      try {
        const logsResponse = await fetch(`${API_URL}/audit?limit=500`, { 
          headers,
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        
        if (logsResponse.ok) {
          const logsResult = await logsResponse.json();
          logs = Array.isArray(logsResult.data) ? logsResult.data : [];
          total = logsResult.total || logs.length;
        } else {
          console.log('API returned error status:', logsResponse.status);
        }
      } catch (err) {
        console.log('Failed to fetch audit logs, using empty state');
      }

      // Fetch unique resources
      let resourcesList: string[] = [];
      try {
        const resourcesResponse = await fetch(`${API_URL}/audit/resources`, { 
          headers,
          signal: AbortSignal.timeout(5000)
        });
        
        if (resourcesResponse.ok) {
          const resourcesResult = await resourcesResponse.json();
          resourcesList = Array.isArray(resourcesResult) ? resourcesResult : [];
        }
      } catch (err) {
        console.log('Failed to fetch resources');
      }
      
      setAuditLogs(logs);
      setFilteredLogs(logs);
      setResources(resourcesList);
      setTotalLogs(total);
    } catch (error) {
      console.error('Error fetching audit data:', error);
      setApiError('Unable to connect to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...auditLogs];

    // User filter
    if (userFilter !== 'all') {
      filtered = filtered.filter(log => {
        const userName = String(log.userName || '');
        const userId = String(log.userId || '');
        return userName.toLowerCase().includes(userFilter.toLowerCase()) || userId.includes(userFilter);
      });
    }

    // Module/Resource filter
    if (moduleFilter !== 'all') {
      filtered = filtered.filter(log => log.resource === moduleFilter);
    }

    // Time filter
    if (timeFilter !== 'all') {
      const now = new Date();
      filtered = filtered.filter(log => {
        const timestamp = log.timestamp || log.createdAt;
        if (!timestamp) return true;
        try {
          const logDate = new Date(timestamp);
          if (isNaN(logDate.getTime())) return true;
          const diffDays = Math.floor((now.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (timeFilter === 'today') return diffDays === 0;
          if (timeFilter === 'week') return diffDays <= 7;
          if (timeFilter === 'month') return diffDays <= 30;
        } catch (e) {
          return true;
        }
        return true;
      });
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(log => {
        const actionStr = String(log.action || '');
        const resourceStr = String(log.resource || '');
        const userNameStr = String(log.userName || '');
        const detailsStr = log.details ? JSON.stringify(log.details) : '';
        
        return actionStr.toLowerCase().includes(query) ||
               resourceStr.toLowerCase().includes(query) ||
               userNameStr.toLowerCase().includes(query) ||
               detailsStr.toLowerCase().includes(query);
      });
    }

    setFilteredLogs(filtered);
  }, [userFilter, moduleFilter, timeFilter, searchQuery, auditLogs]);

  const handleExportLogs = async () => {
    try {
      const API_URL = import.meta.env.PROD
        ? (import.meta.env.VITE_API_URL || '') + '/api/admin'
        : '/api/admin';
      const response = await fetch(`${API_URL}/audit/export?format=json&limit=1000`, {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Audit logs exported successfully');
      } else {
        toast.error('Failed to export logs');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export logs');
    }
  };

  const handleRefresh = () => {
    fetchData();
    toast.success('Audit logs refreshed');
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'warning':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-500';
    }
  };

  const formatAction = (action?: string) => {
    if (!action) return 'Unknown';
    return String(action).split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return '-';
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return '-';
    }
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-2 sm:p-3">
      {/* API Error Banner */}
      {apiError && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-800">Server Connection Error</p>
            <p className="text-sm text-amber-600">Unable to connect to backend server. Showing cached/empty data.</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} className="ml-auto">
            Retry
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-black">Audit Logs</CardTitle>
                <CardDescription className="text-black">System activity and user action tracking</CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportLogs} disabled={apiError !== null}>
                <Download className="h-4 w-4 mr-2" />
                Export Logs
              </Button>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
                <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <Card className="border-dashed">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Filters</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Filter by User</label>
                  <Select value={userFilter} onValueChange={setUserFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Users" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="cashier">Cashier</SelectItem>
                      <SelectItem value="chef">Chef</SelectItem>
                      <SelectItem value="waiter">Waiter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Filter by Module</label>
                  <Select value={moduleFilter} onValueChange={setModuleFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Modules" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Modules</SelectItem>
                      {resources.map(resource => (
                        <SelectItem key={String(resource)} value={String(resource)}>
                          {String(resource).charAt(0).toUpperCase() + String(resource).slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Time Range</label>
                  <Select value={timeFilter} onValueChange={setTimeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">Last 7 Days</SelectItem>
                      <SelectItem value="month">Last 30 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search logs..."
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results Summary */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filteredLogs.length}</span> of{' '}
              <span className="font-semibold text-foreground">{totalLogs}</span> audit logs
            </p>
          </div>

          {/* Logs Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {apiError ? 'Unable to load audit logs. Please ensure the backend server is running.' : 'No audit logs found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map(log => (
                    <TableRow key={log._id || Math.random().toString()}>
                      <TableCell>
                        <Badge className={getStatusColor(log.status)}>
                          {formatValue(log.status) || 'success'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatValue(log.userName || log.userId) || 'System'}
                      </TableCell>
                      <TableCell>{formatAction(log.action)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{formatValue(log.resource) || 'N/A'}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="truncate text-sm">
                          {log.details ? formatValue(log.details) : formatValue(log.resourceId) || '-'}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatTimestamp(log.timestamp)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatValue(log.ip) || '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
