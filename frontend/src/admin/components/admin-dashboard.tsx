import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/admin/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { IndianRupee, ShoppingCart, TrendingUp, Users, AlertCircle, Activity, Package, ChefHat, UserCog, Clock, Radio } from 'lucide-react';
import { API_BASE_URL } from '@/admin/utils/api';
import { Alert, AlertDescription, AlertTitle } from '@/admin/components/ui/alert';
import { Button } from '@/admin/components/ui/button';
import { Badge } from '@/admin/components/ui/badge';
import { LoadingSpinner } from '@/admin/components/ui/loading-spinner';

interface Analytics {
  totalOrders: number;
  completedOrders: number;
  invoiceCount: number;
  totalRevenue: number;
  avgOrderValue: number;
  popularItems: Array<{ 
    name: string; 
    count: number;
    revenue: number;
    avgPrepTime: number;
  }>;
  tableOccupancy: number;
  activeOrders: number;
  // Staff data
  totalStaff: number;
  onDutyStaff: number;
  onLeaveStaff: number;
}

export function AdminDashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(() => {
      fetchAnalytics();
    }, 10000); // Refresh every 10 seconds for live updates
    return () => clearInterval(interval);
  }, []);

  const fetchAnalytics = async () => {
    try {
      setError(null);
      const response = await fetch(
        `${API_BASE_URL}/analytics`,
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.success) {
        setAnalytics(result.data);
        setLastUpdated(new Date());
      } else {
        throw new Error(result.error || 'Failed to fetch analytics');
      }
    } catch (error) {
      // Silently handle error and use default data
      if (!analytics) {
        setAnalytics({
          totalOrders: 0,
          completedOrders: 0,
          invoiceCount: 0,
          totalRevenue: 0,
          avgOrderValue: 0,
          popularItems: [],
          tableOccupancy: 0,
          activeOrders: 0,
          totalStaff: 0,
          onDutyStaff: 0,
          onLeaveStaff: 0,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  return (
    <div className="app-admin-content py-6 space-y-6">
      {/* Header with Live Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 sm:p-6 bg-white/70 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-700 font-medium mt-1">Restaurant management overview</p>
        </div>
        
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border shadow-sm self-start">
          <Radio className="h-4 w-4 text-success animate-pulse" />
          <div className="text-sm">
            <span className="font-medium text-success">Live status</span>
            <span className="mx-2 text-border">|</span>
            <span className="text-slate-600 font-medium">Updated {lastUpdated.toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error}. The system may not be fully connected.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAnalytics}
              className="ml-4"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards - Row 1: Financial & Orders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{(analytics?.totalRevenue ?? 0).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {analytics?.invoiceCount || 0} invoices made
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.activeOrders || 0}</div>
            <p className="text-xs text-muted-foreground">Currently processing</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{(analytics?.avgOrderValue ?? 0).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Per completed order</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Table Occupancy</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round((analytics?.tableOccupancy ?? 0) * 100)}%</div>
            <div className="w-full bg-muted rounded-full h-1.5 mt-2">
              <div 
                className="bg-primary h-1.5 rounded-full" 
                style={{ width: `${Math.min(100, Math.round((analytics?.tableOccupancy ?? 0) * 100))}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">Current capacity</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Staff Status Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Staff Status</CardTitle>
              <UserCog className="h-4 w-4 text-primary" />
            </div>
            <CardDescription>Workforce summary</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Total Workers</span>
              <span className="text-2xl font-bold">{analytics?.totalStaff || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                On Duty
              </Badge>
              <span className="text-xl font-bold text-success">{analytics?.onDutyStaff || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                On Leave
              </Badge>
              <span className="text-xl font-bold text-warning">{analytics?.onLeaveStaff || 0}</span>
            </div>
            <div className="pt-2">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-success transition-all duration-500"
                  style={{ width: `${analytics?.totalStaff ? (analytics.onDutyStaff / analytics.totalStaff) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {analytics?.totalStaff ? Math.round((analytics.onDutyStaff / analytics.totalStaff) * 100) : 0}% workforce active
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Popular Menu Items */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Popular Menu Items</CardTitle>
                <CardDescription>Top 5 most ordered items</CardDescription>
              </div>
              <Badge variant="outline" className="text-primary border-primary">
                Live Updates
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {analytics?.popularItems && analytics.popularItems.length > 0 ? (
              <div className="h-[250px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.popularItems} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px'
                      }}
                      formatter={(value: any, name: string) => {
                        if (name === 'count') return [value, 'Orders'];
                        return [value, name];
                      }}
                    />
                    <Bar dataKey="count" fill="#8B5A2B" radius={[8, 8, 0, 0]}>
                      {analytics.popularItems.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(${30 - index * 5}, 50%, ${45 + index * 5}%)`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Detailed Table */}
                <div className="border rounded-lg overflow-x-auto mt-6">
                  <table className="w-full min-w-[400px]">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 text-sm font-semibold">Item Name</th>
                        <th className="text-center p-3 text-sm font-semibold">Orders</th>
                        <th className="text-center p-3 text-sm font-semibold">Revenue</th>
                        <th className="text-center p-3 text-sm font-semibold">Avg Prep Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.popularItems.map((item, index) => (
                        <tr key={index} className="border-t hover:bg-muted/50 transition-colors">
                          <td className="p-3">
                            <span className="font-medium text-sm">
                              {index + 1}. {item.name}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant="secondary">
                              {item.count || 0}
                            </Badge>
                          </td>
                          <td className="p-3 text-center font-semibold text-primary">
                            ₹{(item.revenue ?? 0).toFixed(2)}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {item.avgPrepTime || 0} min
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mb-2" />
                <p>No orders yet. Popular items will appear here.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Order Statistics</CardTitle>
            <CardDescription>Overview of order processing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total Orders</span>
              <span className="text-2xl font-bold">{analytics?.invoiceCount || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Completed</span>
              <span className="text-xl font-bold text-success">{analytics?.completedOrders || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">In Progress</span>
              <span className="text-xl font-bold text-info">{analytics?.activeOrders || 0}</span>
            </div>
            <div className="pt-2">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-success transition-all duration-500"
                  style={{ width: `${analytics?.invoiceCount ? Math.min((analytics.completedOrders / analytics.invoiceCount) * 100, 100) : 0}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {analytics?.invoiceCount ? Math.round((analytics.completedOrders / analytics.invoiceCount) * 100) : 0}% completion rate
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}