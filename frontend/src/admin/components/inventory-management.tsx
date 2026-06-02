import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { LoadingInventory } from '@/admin/components/ui/loading-spinner';
import { 
  Package,
  AlertTriangle, 
  ShoppingCart, 
  FileText, 
  Search, 
  Filter, 
  Plus, 
  RefreshCcw, 
  MoreHorizontal, 
  ArrowDown, 
  Truck, 
  CheckCircle2, 
  XCircle, 
  Play, 
  Pause,
  History,
  TrendingDown,
  AlertOctagon,
  Download,
  Loader2
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

import { Button } from '@/admin/components/ui/button';
import { Input } from '@/admin/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/admin/components/ui/card';
import { Badge } from '@/admin/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/admin/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/admin/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/admin/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/admin/components/ui/select';
import { Progress } from "@/admin/components/ui/progress";
import { Avatar, AvatarFallback } from "@/admin/components/ui/avatar";
import { Separator } from "@/admin/components/ui/separator";
import { Label } from "@/admin/components/ui/label";
import { cn } from '@/admin/components/ui/utils';
import { toast } from 'sonner';
import { inventoryApi } from '@/admin/utils/api';

// --- Types ---

interface Ingredient {
  id: string;
  name: string;
  category: string;
  stockLevel: number;
  unit: string;
  minThreshold: number;
  costPerUnit: number;
  supplierId: string;
  status: 'Healthy' | 'Low' | 'Critical' | 'Out';
  usageRate: 'High' | 'Medium' | 'Low';
  lastDeduction?: string;
}

interface DeductionLog {
  id: string;
  orderId: string;
  dishName: string;
  ingredients: { name: string; amount: number; unit: string }[];
  timestamp: string;
}

interface Supplier {
  id: string;
  name: string;
  contact: string;
  email: string;
  status: 'Active' | 'Disabled';
  suppliedItems: string[];
}

interface PurchaseRecord {
  id: string;
  supplierName: string;
  ingredientName: string;
  quantity: number;
  cost: number;
  date: string;
}

// Note: Recipes are now managed via backend API at /api/recipes
// When setting up, create recipes that map menu items to ingredients

export function InventoryManagement({ triggerStockManagement }: { triggerStockManagement?: boolean }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [deductionLogs, setDeductionLogs] = useState<DeductionLog[]>([]);
  const [purchaseRecords, setPurchaseRecords] = useState<PurchaseRecord[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const logEndRef = useRef<HTMLDivElement>(null);

  // Fetch data from API
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [ingredientsRes, suppliersRes, deductionsRes, purchasesRes] = await Promise.all([
        inventoryApi.list().catch(() => []),
        inventoryApi.listSuppliers().catch(() => []),
        inventoryApi.listDeductions().catch(() => []),
        inventoryApi.listPurchases().catch(() => [])
      ]);
      
      // Handle different response formats
      const ingredientsData = Array.isArray(ingredientsRes) ? ingredientsRes : (ingredientsRes as any)?.data || [];
      setIngredients(ingredientsData.map((ing: any) => ({
        id: ing._id || ing.id,
        name: ing.name,
        category: ing.category || 'Other',
        stockLevel: ing.stockLevel || 0,
        unit: ing.unit || 'units',
        minThreshold: ing.minThreshold || 10,
        costPerUnit: ing.costPerUnit || 0,
        supplierId: ing.supplierId || '',
        status: ing.status || 'Healthy',
        usageRate: ing.usageRate || 'Medium',
        lastDeduction: ing.lastDeduction
      })));
      
      setSuppliers((suppliersRes || []).map((sup: any) => ({
        id: sup._id || sup.id,
        name: sup.name,
        contact: sup.contact || '',
        email: sup.email || '',
        status: sup.status || 'Active',
        suppliedItems: sup.suppliedItems || []
      })));
      
      setDeductionLogs((deductionsRes || []).map((log: any) => ({
        id: log._id || log.id,
        orderId: log.orderId,
        dishName: log.items?.[0]?.name || 'Order',
        ingredients: log.ingredients || [],
        timestamp: log.timestamp
      })));
      
      setPurchaseRecords((purchasesRes || []).map((rec: any) => ({
        id: rec._id || rec.id,
        supplierName: rec.supplierName,
        ingredientName: rec.ingredientName,
        quantity: rec.quantity,
        cost: rec.cost,
        date: rec.date || rec.createdAt
      })));
    } catch (error) {
      console.error('Error fetching inventory data:', error);
      toast.error('Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Handle external trigger
  useEffect(() => {
    if (triggerStockManagement) {
      setActiveTab('inventory');
    }
  }, [triggerStockManagement]);

  // Derived Stats
  const stats = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayLogs = deductionLogs.filter(log => {
      if (!log.timestamp) return false;
      return new Date(log.timestamp) >= todayStart;
    });
    return {
      total: ingredients.length,
      low: ingredients.filter(i => i.status === 'Low').length,
      critical: ingredients.filter(i => i.status === 'Critical').length,
      out: ingredients.filter(i => i.status === 'Out').length,
      consumptionToday: todayLogs.reduce((acc, log) => acc + log.ingredients.length, 0)
    };
  }, [ingredients, deductionLogs]);

  const filteredIngredients = useMemo(() => {
    return ingredients.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [ingredients, searchQuery, statusFilter, categoryFilter]);

  const uniqueCategories = useMemo(() => Array.from(new Set(ingredients.map(i => i.category))), [ingredients]);

  // Fetch ingredients from backend API
  useEffect(() => {
    const fetchIngredients = async () => {
      try {
        const API_URL = import.meta.env.PROD
          ? (import.meta.env.VITE_API_URL || '') + '/api/admin'
          : '/api/admin';
        const response = await fetch(`${API_URL}/inventory`);
        if (response.ok) {
          const result = await response.json();
          // API returns {data: [], total: number}
          const items = result.data || result;
          // Map API response to component state
          const mappedIngredients = items.map((ing: any) => ({
            id: ing._id || ing.id,
            name: ing.name,
            category: ing.category,
            stockLevel: ing.stockLevel,
            unit: ing.unit,
            minThreshold: ing.minThreshold,
            costPerUnit: ing.costPerUnit,
            supplierId: ing.supplierId,
            status: ing.status as Ingredient['status'],
            usageRate: ing.usageRate as Ingredient['usageRate'],
            lastDeduction: ing.lastDeduction
          }));
          setIngredients(mappedIngredients);
        }
      } catch (error) {
        console.log('Using mock data: Could not fetch from API');
        setIngredients([]);
      }
    };

    fetchIngredients();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchIngredients, 10000);
    return () => clearInterval(interval);
  }, []);

  // Simulation Logic
  useEffect(() => {
    let interval: any;
    if (isSimulating) {
      // In simulation mode, refresh every 5 seconds to show live updates from orders
      interval = setInterval(() => {
        fetchData();
        toast.info("Syncing with orders...", { duration: 1000 });
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isSimulating, fetchData]);

  // Actions
  const handleAddPurchase = async (data: any) => {
    try {
      // Find ingredient ID by name
      const ingredient = ingredients.find(i => i.name === data.ingredientName);
      
      await inventoryApi.createPurchase({
        ingredientId: ingredient?.id,
        ingredientName: data.ingredientName,
        supplierName: data.supplierName,
        quantity: Number(data.quantity),
        cost: Number(data.cost),
        date: new Date().toISOString()
      });
      
      toast.success("Purchase Recorded", { description: "Stock updated and audit log created." });
      fetchData(); // Refresh to show updated stock
    } catch (error) {
      console.error('Error adding purchase:', error);
      toast.error("Failed to record purchase");
    }
  };

  const handleToggleSupplier = async (id: string) => {
    try {
      const supplier = suppliers.find(s => s.id === id);
      if (!supplier) return;
      
      const newStatus = supplier.status === 'Active' ? 'Disabled' : 'Active';
      await inventoryApi.updateSupplier(id, { status: newStatus });
      
      toast.success(`Supplier ${newStatus}`, { description: `${supplier.name} has been ${newStatus.toLowerCase()}.` });
      fetchData();
    } catch (error) {
      console.error('Error toggling supplier:', error);
      toast.error("Failed to update supplier");
    }
  };

  const getRowColor = (status: Ingredient['status']) => {
    switch(status) {
      case 'Out': return 'bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500';
      case 'Critical': return 'bg-red-50/50 hover:bg-red-100/50 border-l-4 border-l-red-400';
      case 'Low': return 'bg-yellow-50 hover:bg-yellow-100 border-l-4 border-l-yellow-400';
      default: return 'bg-white hover:bg-gray-50 border-l-4 border-l-green-500';
    }
  };

  if (loading) return <LoadingInventory />;

  return (
    <div className="min-h-screen bg-[#f8f6f3] pb-20 max-w-full overflow-x-hidden">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 pt-4 sm:pt-5 space-y-6">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button variant="outline" onClick={fetchData} disabled={loading} className="bg-white hover:bg-gray-50 text-foreground border-border">
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
          {isSimulating ? (
            <Button variant="destructive" onClick={() => setIsSimulating(false)} className="shadow-sm">
              <Pause className="mr-2 h-4 w-4" /> Stop Live Sync
            </Button>
          ) : (
            <Button onClick={() => setIsSimulating(true)} className="bg-emerald-600 hover:bg-emerald-700 shadow-sm text-white">
              <Play className="mr-2 h-4 w-4" /> Start Live Sync
            </Button>
          )}
          <AddPurchaseDialog ingredients={ingredients} suppliers={suppliers} onSave={handleAddPurchase} />
        </div>

        <div className="w-full overflow-x-auto pb-2">
          <div className="bg-muted text-muted-foreground rounded-xl p-[3px] grid grid-cols-5 min-w-[560px]">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Package },
              { id: 'inventory', label: 'Stock', icon: Package },
              { id: 'feed', label: 'Deductions', icon: History },
              { id: 'suppliers', label: 'Suppliers', icon: Truck },
              { id: 'records', label: 'Purchases', icon: FileText },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive
                      ? 'bg-background text-foreground shadow-sm'
                      : 'hover:bg-background/50 hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsContent value="dashboard" className="space-y-6 animate-in fade-in-50 duration-500">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
               <KPICard title="Total Ingredients" value={stats.total} icon={Package} />
               <KPICard title="Low Stock Items" value={stats.low} icon={AlertTriangle} color="text-yellow-600" bg="bg-yellow-50" border="border-yellow-200" />
               <KPICard title="Out of Stock" value={stats.out} icon={XCircle} color="text-red-600" bg="bg-red-50" border="border-red-200" />
               <KPICard title="Deductions Today" value={stats.consumptionToday} icon={TrendingDown} color="text-blue-600" bg="bg-blue-50" border="border-blue-200" />
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 shadow-sm border-none bg-white">
                  <CardHeader>
                    <CardTitle>Consumption Trends</CardTitle>
                    <CardDescription>Live order-based ingredient usage over time</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={deductionLogs.slice(0, 20).reverse().map((l, i) => ({ time: i, amount: l.ingredients.length }))}>
                        <defs>
                          <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="time" hide />
                        <YAxis hide />
                        <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                        <Area type="monotone" dataKey="amount" stroke="#10b981" fillOpacity={1} fill="url(#colorUsage)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-none bg-white">
                  <CardHeader>
                    <CardTitle>Low Stock Alerts</CardTitle>
                    <CardDescription>Advisory only - Action required</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {ingredients.filter(i => i.status !== 'Healthy').slice(0, 4).map(item => (
                      <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border bg-gray-50/50">
                        {item.status === 'Out' ? <XCircle className="h-5 w-5 text-red-500 mt-0.5" /> : <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />}
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <h4 className="font-medium text-sm">{item.name}</h4>
                            <span className={`text-xs font-bold ${item.status === 'Out' ? 'text-red-600' : 'text-yellow-600'}`}>{item.status}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Current: {item.stockLevel} {item.unit} (Min: {item.minThreshold})
                          </p>
                          <Button variant="link" className="p-0 h-auto text-xs mt-2 text-primary">
                            Create Purchase Record
                          </Button>
                        </div>
                      </div>
                    ))}
                    {ingredients.filter(i => i.status !== 'Healthy').length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                        <CheckCircle2 className="h-10 w-10 text-green-100 mb-2" />
                        <p>All stock levels are healthy.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
             </div>
          </TabsContent>

          {/* INVENTORY TAB */}
          <TabsContent value="inventory" className="space-y-6 animate-in fade-in-50 duration-500">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-lg shadow-sm border">
               <div className="flex-1 flex items-center gap-3">
                 <Search className="h-4 w-4 text-muted-foreground" />
                 <Input 
                   placeholder="Search ingredients..." 
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="border-none shadow-none focus-visible:ring-0 pl-0" 
                 />
               </div>
               <div className="flex items-center gap-3">
                 <Select value={statusFilter} onValueChange={setStatusFilter}>
                   <SelectTrigger className="w-[140px] h-9">
                     <SelectValue placeholder="Status" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">All Status</SelectItem>
                     <SelectItem value="Healthy">Healthy</SelectItem>
                     <SelectItem value="Low">Low Stock</SelectItem>
                     <SelectItem value="Critical">Critical</SelectItem>
                     <SelectItem value="Out">Out of Stock</SelectItem>
                   </SelectContent>
                 </Select>

                 <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                   <SelectTrigger className="w-[140px] h-9">
                     <SelectValue placeholder="Category" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem key="all-cats" value="all">All Categories</SelectItem>
                     {uniqueCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                   </SelectContent>
                 </Select>
                 
                 {(statusFilter !== 'all' || categoryFilter !== 'all' || searchQuery) && (
                   <Button variant="ghost" size="sm" onClick={() => { setStatusFilter('all'); setCategoryFilter('all'); setSearchQuery(''); }}>
                     <XCircle className="h-4 w-4 mr-2" /> Clear
                   </Button>
                 )}
               </div>
            </div>

            <div className="rounded-md border shadow-sm bg-white overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead>Ingredient Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Stock Level</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Usage Rate</TableHead>
                    <TableHead>Last Order</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIngredients.map((item) => (
                    <TableRow key={item.id} className={`${getRowColor(item.status)} transition-colors duration-500`}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell>
                        <span className="font-bold font-mono text-base">{item.stockLevel.toFixed(2)}</span>
                        <span className="text-muted-foreground text-xs ml-1">{item.unit}</span>
                      </TableCell>
                      <TableCell className="w-[200px]">
                        <Progress 
                          value={Math.min(100, (item.stockLevel / (item.minThreshold * 3)) * 100)} 
                          className="h-2 bg-black/5"
                          indicatorClassName={
                             item.status === 'Out' ? 'bg-red-600' :
                             item.status === 'Critical' ? 'bg-red-500' :
                             item.status === 'Low' ? 'bg-yellow-500' : 'bg-green-600'
                          } 
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`
                          ${item.status === 'Out' ? 'bg-red-100 text-red-700 border-red-200' : 
                            item.status === 'Critical' ? 'bg-red-50 text-red-600 border-red-100' :
                            item.status === 'Low' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 
                            'bg-green-100 text-green-700 border-green-200'}
                        `}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="opacity-70">{item.usageRate}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.lastDeduction ? format(new Date(item.lastDeduction), 'HH:mm:ss') : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredIngredients.length === 0 && (
                     <TableRow>
                       <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                         No ingredients found matching your filters.
                       </TableCell>
                     </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* FEED TAB */}
          <TabsContent value="feed" className="space-y-6 animate-in fade-in-50 duration-500">
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-none shadow-md overflow-hidden flex flex-col h-[600px] bg-slate-900 text-white relative">
                   <div className="absolute top-0 w-full h-16 bg-gradient-to-b from-slate-900 to-transparent z-10 pointer-events-none" />
                   <CardHeader className="z-20 bg-slate-900/80 backdrop-blur border-b border-slate-800">
                     <CardTitle className="flex items-center gap-2">
                       <ShoppingCart className="h-5 w-5 text-emerald-400" />
                       Real-time Deduction Feed
                     </CardTitle>
                     <CardDescription className="text-slate-400">
                       Live stream of stock being deducted as orders confirm.
                     </CardDescription>
                   </CardHeader>
                   <CardContent className="flex-1 overflow-y-auto p-0 relative bg-slate-900/50">
                     <div className="p-6 space-y-4">
                       <AnimatePresence initial={false}>
                         {deductionLogs.map((log) => (
                           <motion.div
                             key={log.id}
                             initial={{ opacity: 0, x: -20, height: 0 }}
                             animate={{ opacity: 1, x: 0, height: 'auto' }}
                             className="flex gap-4 p-4 rounded-lg bg-slate-800 border border-slate-700 shadow-sm"
                           >
                             <div className="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                               <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                             </div>
                             <div className="flex-1">
                               <div className="flex justify-between items-start">
                                 <div>
                                   <p className="font-semibold text-white">{log.dishName}</p>
                                   <p className="text-xs text-slate-400 font-mono">{log.orderId}</p>
                                 </div>
                                 <span className="text-xs text-slate-500 font-mono">
                                   {format(new Date(log.timestamp), 'HH:mm:ss')}
                                 </span>
                               </div>
                               <div className="mt-3 flex flex-wrap gap-2">
                                 {log.ingredients.map((ing, i) => (
                                   <Badge key={i} variant="outline" className="bg-slate-900/50 border-slate-600 text-slate-300">
                                     {ing.name} <span className="text-red-400 ml-1">-{ing.amount} {ing.unit}</span>
                                   </Badge>
                                 ))}
                               </div>
                             </div>
                           </motion.div>
                         ))}
                       </AnimatePresence>
                       {deductionLogs.length === 0 && (
                         <div className="flex flex-col items-center justify-center h-[300px] text-slate-600">
                           <RefreshCcw className="h-12 w-12 mb-4 opacity-20" />
                           <p>Waiting for live orders...</p>
                         </div>
                       )}
                     </div>
                   </CardContent>
                </Card>

             </div>
          </TabsContent>

          {/* SUPPLIERS TAB */}
          <TabsContent value="suppliers" className="space-y-6 animate-in fade-in-50 duration-500">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {suppliers.map(supplier => (
                  <Card key={supplier.id} className="group hover:shadow-lg transition-shadow border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border bg-white">
                          <AvatarFallback className="text-primary">{supplier.name.substring(0,2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-base group-hover:text-primary transition-colors">{supplier.name}</CardTitle>
                          <Badge variant={supplier.status === 'Active' ? 'default' : 'secondary'} className="mt-1 text-[10px] h-5">
                            {supplier.status}
                          </Badge>
                        </div>
                      </div>
                      <SupplierActionsMenu supplier={supplier} onToggle={handleToggleSupplier} />
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      <div className="text-sm space-y-1">
                         <p className="text-muted-foreground flex items-center justify-between">
                           Contact <span className="text-foreground font-medium">{supplier.contact}</span>
                         </p>
                         <p className="text-muted-foreground flex items-center justify-between">
                           Email <span className="text-foreground font-medium truncate max-w-[150px]">{supplier.email}</span>
                         </p>
                      </div>
                      <Separator />
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase">Supplies</p>
                        <div className="flex flex-wrap gap-1">
                          {supplier.suppliedItems.map(item => (
                            <Badge key={item} variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-200">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
             </div>
          </TabsContent>

          {/* RECORDS TAB */}
          <TabsContent value="records" className="space-y-6 animate-in fade-in-50 duration-500">
             <Card className="border-none shadow-sm">
               <CardHeader>
                 <CardTitle>Purchase Records & Audit Logs</CardTitle>
                 <CardDescription>
                   Non-affecting accounting records for inventory tracking.
                 </CardDescription>
               </CardHeader>
               <CardContent>
                 <Table>
                   <TableHeader>
                     <TableRow>
                       <TableHead>Date & Time</TableHead>
                       <TableHead>Ingredient</TableHead>
                       <TableHead>Supplier</TableHead>
                       <TableHead>Type</TableHead>
                       <TableHead>Quantity</TableHead>
                       <TableHead>Cost</TableHead>
                       <TableHead>Status</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {purchaseRecords.map(record => (
                       <TableRow key={record.id}>
                         <TableCell className="font-mono text-muted-foreground">
                           {format(new Date(record.date), 'dd MMM yyyy, HH:mm')}
                         </TableCell>
                         <TableCell className="font-medium">{record.ingredientName}</TableCell>
                         <TableCell>{record.supplierName}</TableCell>
                         <TableCell><Badge variant="outline">Purchase</Badge></TableCell>
                         <TableCell>{record.quantity} Units</TableCell>
                         <TableCell>₹{record.cost.toLocaleString()}</TableCell>
                         <TableCell><Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending Receipt</Badge></TableCell>
                       </TableRow>
                     ))}
                     {purchaseRecords.length === 0 && (
                       <TableRow>
                         <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                           <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                           No purchase records found. Create one to start tracking.
                         </TableCell>
                       </TableRow>
                     )}
                   </TableBody>
                 </Table>
               </CardContent>
             </Card>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}

// --- Sub-Components ---

function KPICard({ title, value, icon: Icon, color = "text-primary", bg = "bg-primary/10", border = "border-transparent", subtext }: any) {
  return (
    <Card className={`border ${border} shadow-sm hover:shadow-md transition-all`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${bg}`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
      </CardContent>
    </Card>
  );
}

function AddPurchaseDialog({ ingredients, suppliers, onSave }: any) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    ingredientName: '',
    supplierName: '',
    quantity: '',
    cost: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.ingredientName || !formData.supplierName || !formData.quantity || !formData.cost) {
      toast.error("Missing Fields", { description: "Please fill in all fields." });
      return;
    }
    onSave({
      ingredientName: formData.ingredientName,
      supplierName: formData.supplierName,
      quantity: Number(formData.quantity),
      cost: Number(formData.cost)
    });
    setOpen(false);
    setFormData({ ingredientName: '', supplierName: '', quantity: '', cost: '' });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Add Purchase
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Purchase Record</DialogTitle>
          <DialogDescription>
            Creates a financial record of the purchase.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Ingredient</Label>
            <Select onValueChange={(v) => setFormData({...formData, ingredientName: v})}>
              <SelectTrigger>
                <SelectValue placeholder="Select ingredient" />
              </SelectTrigger>
              <SelectContent>
                {ingredients.map((i: any) => <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Supplier</Label>
            <Select onValueChange={(v) => setFormData({...formData, supplierName: v})}>
              <SelectTrigger>
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s: any) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" placeholder="0.00" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Total Cost (₹)</Label>
              <Input type="number" placeholder="0.00" value={formData.cost} onChange={(e) => setFormData({...formData, cost: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Create Record</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SupplierActionsMenu({ supplier, onToggle }: any) {
  return (
    <Dialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem>
            <AlertOctagon className="mr-2 h-4 w-4" /> View Details
          </DropdownMenuItem>
          <DialogTrigger asChild>
             <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
               <FileText className="mr-2 h-4 w-4" /> View Agreement
             </DropdownMenuItem>
          </DialogTrigger>
          <DropdownMenuSeparator />
          <DropdownMenuItem className={supplier.status === 'Active' ? 'text-red-600' : 'text-green-600'} onClick={() => onToggle(supplier.id)}>
            {supplier.status === 'Active' ? (
               <><XCircle className="mr-2 h-4 w-4" /> Disable Supplier</>
            ) : (
               <><CheckCircle2 className="mr-2 h-4 w-4" /> Enable Supplier</>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Embedded Agreement Dialog */}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supplier Agreement: {supplier.name}</DialogTitle>
          <DialogDescription>Valid until Dec 31, 2026</DialogDescription>
        </DialogHeader>
        <div className="p-4 bg-gray-50 rounded text-sm text-gray-600 h-64 overflow-y-auto border">
          <p><strong>Standard Supply Agreement</strong></p>
          <p className="mt-2">This agreement is made between Movicloud Labs (Buyer) and {supplier.name} (Supplier).</p>
          <p className="mt-2">1. The Supplier agrees to deliver goods as per the quality standards defined.</p>
          <p>2. Payment terms are Net 30 days.</p>
          <p>3. Delivery must be within 24 hours of order placement.</p>
          <p className="mt-4 italic">Signed digitally.</p>
        </div>
        <DialogFooter>
          <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Download PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper for Dropdown menu since it was missing in the imports
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/admin/components/ui/dropdown-menu";