import { useState, useEffect, useMemo, useCallback } from "react";
import { LoadingAlerts } from "@/admin/components/ui/loading-spinner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/admin/components/ui/card";
import { Badge } from "@/admin/components/ui/badge";
import { Input } from "@/admin/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/admin/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/admin/components/ui/table";
import { Button } from "@/admin/components/ui/button";
import { Tabs, TabsContent } from "@/admin/components/ui/tabs";
import { cn } from "@/admin/components/ui/utils";
import { notificationsApi, billingApi } from "@/admin/utils/api";
import { useAuth } from "@/admin/utils/auth-context";
import { toast } from "sonner";
import {
  Bell,
  ChefHat,
  CreditCard,
  BarChart3,
  Crown,
  AlertTriangle,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  UtensilsCrossed,
  DollarSign,
  RefreshCcw,
  Search,
  Filter,
  ShieldAlert,
  Star,
  CalendarClock,
  CheckCheck,
  BellRing,
  Utensils,
  StickyNote,
  BadgeDollarSign,
  TriangleAlert,
  ClipboardCheck,
  UserX,
  UserCheck,
  TrendingDown,
  Flame,
  CircleAlert,
  Layers,
  LayoutDashboard,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  recipient: string;
  channel: string;
  status: string;
  created_at: string;
  orderId?: string;
  paymentId?: string;
  expiresAt?: string;
}

// ─── Role-based notification spec ────────────────────────────────────────────

interface NotifSpec {
  icon: React.ElementType;
  label: string;
  description: string;
  color: string;
  bgColor: string;
}

const CHEF_SPECS: NotifSpec[] = [
  { icon: UtensilsCrossed, label: "New Order Received", description: "With all ordered items listed", color: "text-orange-400", bgColor: "bg-orange-500/20" },
  { icon: XCircle, label: "Order Cancelled", description: "When a customer or manager cancels an order", color: "text-red-400", bgColor: "bg-red-500/20" },
  { icon: TrendingDown, label: "Low Stock Alert", description: "Ingredient below minimum threshold", color: "text-amber-400", bgColor: "bg-amber-500/20" },
  { icon: Clock, label: "Order Delayed Warning", description: "Order exceeds 20-min preparation limit", color: "text-yellow-400", bgColor: "bg-yellow-500/20" },
  { icon: StickyNote, label: "Special Instructions", description: "Custom instructions from waiter/customer", color: "text-blue-400", bgColor: "bg-blue-500/20" },
];

const WAITER_SPECS: NotifSpec[] = [
  { icon: Layers, label: "New Table Assigned", description: "A table has been assigned to you", color: "text-sky-400", bgColor: "bg-sky-500/20" },
  { icon: ChefHat, label: "Order Ready from Kitchen", description: "Dish prepared and ready to serve", color: "text-green-400", bgColor: "bg-green-500/20" },
  { icon: RefreshCcw, label: "Order Modified", description: "Customer changed their order", color: "text-purple-400", bgColor: "bg-purple-500/20" },
  { icon: XCircle, label: "Order Cancelled", description: "Order was cancelled by customer or manager", color: "text-red-400", bgColor: "bg-red-500/20" },
  { icon: BellRing, label: "Customer Assistance", description: "Customer pressed call-waiter button", color: "text-pink-400", bgColor: "bg-pink-500/20" },
  { icon: ClipboardCheck, label: "Bill Generated", description: "Bill has been created for a table", color: "text-indigo-400", bgColor: "bg-indigo-500/20" },
  { icon: CheckCircle2, label: "Payment Completed", description: "Customer successfully paid the bill", color: "text-emerald-400", bgColor: "bg-emerald-500/20" },
  { icon: AlertTriangle, label: "Payment Failed", description: "Payment was not processed successfully", color: "text-red-400", bgColor: "bg-red-500/20" },
  { icon: CalendarClock, label: "Table Idle Reminder", description: "Customer seated but no order placed after X mins", color: "text-orange-400", bgColor: "bg-orange-500/20" },
];

const CASHIER_SPECS: NotifSpec[] = [
  { icon: ClipboardCheck, label: "New Bill Generated", description: "A new bill has been created", color: "text-blue-400", bgColor: "bg-blue-500/20" },
  { icon: DollarSign, label: "Payment Initiated", description: "Customer started payment process", color: "text-sky-400", bgColor: "bg-sky-500/20" },
  { icon: CheckCircle2, label: "Payment Successful", description: "Transaction completed successfully", color: "text-green-400", bgColor: "bg-green-500/20" },
  { icon: XCircle, label: "Payment Failed", description: "Transaction could not be processed", color: "text-red-400", bgColor: "bg-red-500/20" },
  { icon: RefreshCcw, label: "Refund Requested", description: "Customer or manager requested refund", color: "text-amber-400", bgColor: "bg-amber-500/20" },
  { icon: BadgeDollarSign, label: "Refund Approved/Rejected", description: "Refund status update", color: "text-purple-400", bgColor: "bg-purple-500/20" },
  { icon: AlertTriangle, label: "Large Transaction Alert", description: "Transaction above configured threshold", color: "text-orange-400", bgColor: "bg-orange-500/20" },
  { icon: TriangleAlert, label: "Cash Drawer Mismatch", description: "Physical cash versus system balance mismatch", color: "text-red-400", bgColor: "bg-red-500/20" },
  { icon: Clock, label: "Shift Closing Reminder", description: "Time to close your cashier shift", color: "text-yellow-400", bgColor: "bg-yellow-500/20" },
  { icon: ClipboardCheck, label: "End-of-Day Settlement", description: "Daily settlement is pending", color: "text-indigo-400", bgColor: "bg-indigo-500/20" },
];

const MANAGER_SPECS: NotifSpec[] = [
  { icon: Clock, label: "Order Delayed Beyond SLA", description: "Order significantly exceeds service level agreement", color: "text-orange-400", bgColor: "bg-orange-500/20" },
  { icon: Flame, label: "High Pending Orders", description: "Too many orders waiting to be processed", color: "text-red-400", bgColor: "bg-red-500/20" },
  { icon: TrendingDown, label: "Low Stock Alert", description: "Inventory item below threshold", color: "text-amber-400", bgColor: "bg-amber-500/20" },
  { icon: Package, label: "Critical Stock Out", description: "Ingredient completely unavailable", color: "text-red-400", bgColor: "bg-red-500/20" },
  { icon: UserX, label: "Staff Late Check-in", description: "Staff member has not checked in on time", color: "text-yellow-400", bgColor: "bg-yellow-500/20" },
  { icon: UserX, label: "Staff Absent", description: "Staff absent without marking leave", color: "text-red-400", bgColor: "bg-red-500/20" },
  { icon: BadgeDollarSign, label: "Large Refund Processed", description: "A significant refund has been completed", color: "text-purple-400", bgColor: "bg-purple-500/20" },
  { icon: ShieldAlert, label: "Suspicious Transaction", description: "Unusual transaction pattern detected", color: "text-red-500", bgColor: "bg-red-600/20" },
  { icon: Star, label: "Daily Sales Milestone", description: "Sales target or milestone reached", color: "text-green-400", bgColor: "bg-green-500/20" },
  { icon: BarChart3, label: "End-of-Day Report Ready", description: "Daily summary report has been generated", color: "text-blue-400", bgColor: "bg-blue-500/20" },
  { icon: CircleAlert, label: "System Error / Downtime", description: "Critical system error or outage alert", color: "text-red-500", bgColor: "bg-red-600/20" },
];

const HEAD_CHEF_SPECS: NotifSpec[] = [
  { icon: UtensilsCrossed, label: "New Order Received", description: "Summary view of all newly received orders", color: "text-orange-400", bgColor: "bg-orange-500/20" },
  { icon: Clock, label: "Order Delayed at Station", description: "Specific station has an overdue order", color: "text-yellow-400", bgColor: "bg-yellow-500/20" },
  { icon: Flame, label: "Station Overloaded", description: "Too many pending items at a specific station", color: "text-red-400", bgColor: "bg-red-500/20" },
  { icon: CheckCircle2, label: "Order Completed", description: "Order finished and served across all stations", color: "text-green-400", bgColor: "bg-green-500/20" },
  { icon: StickyNote, label: "Special Customer Instructions", description: "Custom requests affecting kitchen prep", color: "text-blue-400", bgColor: "bg-blue-500/20" },
  { icon: AlertTriangle, label: "Ingredient Out-of-Stock", description: "Missing ingredient affecting active orders", color: "text-red-400", bgColor: "bg-red-500/20" },
];

// ─── Tab configuration ────────────────────────────────────────────────────────

const TABS = [
  {
    id: "overview",
    label: "Overview",
    description: "All notifications",
    icon: LayoutDashboard,
    accentColor: "#6366f1",
    recipientKey: null as string | null,
    specs: null as NotifSpec[] | null,
  },
  {
    id: "chef",
    label: "Chef",
    description: "Kitchen alerts",
    icon: ChefHat,
    accentColor: "#f97316",
    recipientKey: "chef" as string | null,
    specs: CHEF_SPECS as NotifSpec[] | null,
  },
  {
    id: "waiter",
    label: "Waiter",
    description: "Service alerts",
    icon: Utensils,
    accentColor: "#0ea5e9",
    recipientKey: "waiter" as string | null,
    specs: WAITER_SPECS as NotifSpec[] | null,
  },
  {
    id: "cashier",
    label: "Cashier",
    description: "Payment alerts",
    icon: CreditCard,
    accentColor: "#22c55e",
    recipientKey: "cashier" as string | null,
    specs: CASHIER_SPECS as NotifSpec[] | null,
  },
  {
    id: "manager",
    label: "Manager / Admin",
    description: "Operations alerts",
    icon: BarChart3,
    accentColor: "#a855f7",
    recipientKey: "manager" as string | null,
    specs: MANAGER_SPECS as NotifSpec[] | null,
  },
  {
    id: "head-chef",
    label: "Head Chef",
    description: "Master view",
    icon: Crown,
    accentColor: "#f59e0b",
    recipientKey: "head_chef" as string | null,
    specs: HEAD_CHEF_SPECS as NotifSpec[] | null,
  },
];

// ─── Notification type → icon / color mapping ─────────────────────────────────

const TYPE_ICON: Record<string, React.ElementType> = {
  order: UtensilsCrossed,
  "order-cancelled": XCircle,
  "order-modified": RefreshCcw,
  "order-delayed": Clock,
  "order-ready": CheckCircle2,
  payment: DollarSign,
  "payment-failed": XCircle,
  "payment-success": CheckCircle2,
  "payment-initiated": DollarSign,
  stock: Package,
  "low-stock": TrendingDown,
  "critical-stock": AlertTriangle,
  "table-assigned": Layers,
  "table-idle": CalendarClock,
  "bill-generated": ClipboardCheck,
  "refund-requested": RefreshCcw,
  "refund-processed": BadgeDollarSign,
  "large-transaction": AlertTriangle,
  "cash-mismatch": TriangleAlert,
  "shift-closing": Clock,
  "eod-settlement": ClipboardCheck,
  "staff-late": UserX,
  "staff-absent": UserX,
  "staff-checkin": UserCheck,
  "sales-milestone": Star,
  "eod-report": BarChart3,
  "system-error": CircleAlert,
  "suspicious-transaction": ShieldAlert,
  "special-instructions": StickyNote,
  "customer-assistance": BellRing,
  "station-overloaded": Flame,
  "station-delayed": Clock,
};

const TYPE_COLOR: Record<string, string> = {
  order: "bg-blue-100 text-blue-700 border-blue-300",
  "order-cancelled": "bg-red-100 text-red-700 border-red-300",
  "order-modified": "bg-purple-100 text-purple-700 border-purple-300",
  "order-delayed": "bg-yellow-100 text-yellow-700 border-yellow-300",
  "order-ready": "bg-green-100 text-green-700 border-green-300",
  payment: "bg-emerald-100 text-emerald-700 border-emerald-300",
  "payment-failed": "bg-red-100 text-red-700 border-red-300",
  "payment-success": "bg-green-100 text-green-700 border-green-300",
  "payment-initiated": "bg-sky-100 text-sky-700 border-sky-300",
  stock: "bg-amber-100 text-amber-700 border-amber-300",
  "low-stock": "bg-amber-100 text-amber-700 border-amber-300",
  "critical-stock": "bg-red-100 text-red-700 border-red-300",
  "table-assigned": "bg-sky-100 text-sky-700 border-sky-300",
  "table-idle": "bg-orange-100 text-orange-700 border-orange-300",
  "bill-generated": "bg-indigo-100 text-indigo-700 border-indigo-300",
  "refund-requested": "bg-amber-100 text-amber-700 border-amber-300",
  "refund-processed": "bg-purple-100 text-purple-700 border-purple-300",
  "large-transaction": "bg-orange-100 text-orange-700 border-orange-300",
  "cash-mismatch": "bg-red-100 text-red-700 border-red-300",
  "shift-closing": "bg-yellow-100 text-yellow-700 border-yellow-300",
  "eod-settlement": "bg-indigo-100 text-indigo-700 border-indigo-300",
  "staff-late": "bg-yellow-100 text-yellow-700 border-yellow-300",
  "staff-absent": "bg-red-100 text-red-700 border-red-300",
  "staff-checkin": "bg-green-100 text-green-700 border-green-300",
  "sales-milestone": "bg-green-100 text-green-700 border-green-300",
  "eod-report": "bg-blue-100 text-blue-700 border-blue-300",
  "system-error": "bg-red-100 text-red-700 border-red-300",
  "suspicious-transaction": "bg-red-100 text-red-700 border-red-300",
  "special-instructions": "bg-blue-100 text-blue-700 border-blue-300",
  "customer-assistance": "bg-pink-100 text-pink-700 border-pink-300",
  "station-overloaded": "bg-red-100 text-red-700 border-red-300",
  "station-delayed": "bg-yellow-100 text-yellow-700 border-yellow-300",
};

const DEFAULT_TYPE_COLOR = "bg-gray-100 text-gray-700 border-gray-300";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTypeColor(type: string) {
  return TYPE_COLOR[type] ?? DEFAULT_TYPE_COLOR;
}

function getTypeIcon(type: string): React.ElementType {
  return TYPE_ICON[type] ?? Bell;
}

function formatDate(date: string) {
  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Role → visible tabs mapping ─────────────────────────────────────────────
// admin & manager can see every tab; all other roles only see their own tab.

const ROLE_VISIBLE_TABS: Record<string, string[]> = {
  admin:   ["overview", "chef", "waiter", "cashier", "manager", "head-chef"],
  manager: ["overview", "chef", "waiter", "cashier", "manager", "head-chef"],
  chef:    ["chef"],
  waiter:  ["waiter"],
  cashier: ["cashier"],
};

// Default active tab per role (for roles that don't see the overview)
const ROLE_DEFAULT_TAB: Record<string, string> = {
  admin:   "overview",
  manager: "overview",
  chef:    "chef",
  waiter:  "waiter",
  cashier: "cashier",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center justify-center bg-white border border-[#e7ded4] rounded-2xl px-4 py-2.5 min-w-[88px] shadow-sm">
      <span className={cn("text-xl sm:text-2xl font-bold", color)}>{value}</span>
      <span className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 uppercase tracking-wide">{label}</span>
    </div>
  );
}

function SpecsGrid({ specs }: { specs: NotifSpec[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {specs.map((spec) => {
        const Icon = spec.icon;
        return (
          <div
            key={spec.label}
            className={cn("flex items-start gap-3 p-3 rounded-xl border border-gray-200 bg-white", spec.bgColor)}
          >
            <div className={cn("mt-0.5 shrink-0", spec.color)}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className={cn("text-sm font-semibold", spec.color)}>{spec.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{spec.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function NotificationManagement() {
  const { user } = useAuth();

  const navigateToTab = (tab: string) =>
    window.dispatchEvent(new CustomEvent("rms:navigate-tab", { detail: tab }));

  // ── Role-based tab visibility ──
  const userRole = user?.role ?? "admin";
  const visibleTabs = useMemo(
    () => TABS.filter((t) => (ROLE_VISIBLE_TABS[userRole] ?? ROLE_VISIBLE_TABS["admin"]).includes(t.id)),
    [userRole]
  );

  // ── State ──
  const [activeTab, setActiveTab] = useState(() => ROLE_DEFAULT_TAB[userRole] ?? "overview");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAsRead, setMarkingAsRead] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showSpecsPanel, setShowSpecsPanel] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  // ── Data ──
  const fetchNotifications = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const result = await notificationsApi.list({ limit: 500 });
      const data = result.data || [];
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load notifications");
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(false);
    const iv = setInterval(() => fetchNotifications(true), 30_000);
    return () => clearInterval(iv);
  }, [fetchNotifications]);

  // ── Computed ──
  const sorted = useMemo(
    () =>
      [...notifications].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [notifications]
  );

  const currentTab = TABS.find((t) => t.id === activeTab) ?? visibleTabs[0]!;

  // For non-admin/manager roles, even the "overview" tab must be scoped to their role
  const roleRecipientKey = useMemo(() => {
    const privileged = userRole === "admin" || userRole === "manager";
    if (privileged) return null; // null = no extra restriction
    // Find the tab that matches their role to get its recipientKey
    const roleTab = TABS.find((t) => t.id === userRole || t.recipientKey === userRole);
    return roleTab?.recipientKey ?? userRole;
  }, [userRole]);

  const tabFiltered = useMemo(() => {
    // Determine which key to filter by: role-scope override takes priority over tab's own key
    const effectiveKey = roleRecipientKey ?? currentTab.recipientKey;
    if (!effectiveKey) return sorted;
    return sorted.filter(
      (n) =>
        n.recipient?.toLowerCase().includes(effectiveKey) ||
        n.recipient?.toLowerCase().includes(currentTab.id)
    );
  }, [sorted, currentTab, roleRecipientKey]);

  const filtered = useMemo(() => {
    return tabFiltered.filter((n) => {
      const matchSearch =
        !search ||
        n.title?.toLowerCase().includes(search.toLowerCase()) ||
        n.message?.toLowerCase().includes(search.toLowerCase()) ||
        n.type?.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === "all" || n.type === typeFilter;
      const matchStatus = statusFilter === "all" || n.status === statusFilter;
      const matchDate =
        dateFilter === "all" ||
        (dateFilter === "today" &&
          new Date(n.created_at).toDateString() === new Date().toDateString()) ||
        (dateFilter === "last7" &&
          new Date(n.created_at).getTime() > Date.now() - 7 * 86_400_000);
      return matchSearch && matchType && matchStatus && matchDate;
    });
  }, [tabFiltered, search, typeFilter, statusFilter, dateFilter]);

  // unreadAll: for privileged roles count all; for scoped roles count only their own
  const unreadAll = useMemo(() => {
    const base = roleRecipientKey
      ? notifications.filter(
          (n) =>
            n.recipient?.toLowerCase().includes(roleRecipientKey) ||
            n.recipient?.toLowerCase().includes(userRole)
        )
      : notifications;
    return base.filter((n) => n.status === "unread").length;
  }, [notifications, roleRecipientKey, userRole]);

  const tabUnread = tabFiltered.filter((n) => n.status === "unread").length;
  const tabRead = tabFiltered.filter((n) => n.status === "read").length;

  const presentTypes = useMemo(
    () => [...new Set(tabFiltered.map((n) => n.type).filter(Boolean))].sort(),
    [tabFiltered]
  );

  // ── Handlers ──
  const handleMarkRead = async (id: string) => {
    try {
      await notificationsApi.markAsRead(id);
      toast.success("Marked as read");
      fetchNotifications(true);
    } catch {
      toast.error("Failed to mark as read");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setMarkingAsRead(true);
      await notificationsApi.markAllRead();
      toast.success("All notifications marked as read");
      await fetchNotifications(true);
    } catch {
      toast.error("Failed to mark all as read");
    } finally {
      setMarkingAsRead(false);
    }
  };

  const handleRetryPayment = async (paymentId?: string, expiresAt?: string) => {
    if (!paymentId) { toast.error("Payment ID not found"); return; }
    if (expiresAt && new Date() > new Date(expiresAt)) {
      toast.error("Payment retry window has expired. Order was cancelled.");
      fetchNotifications(true);
      return;
    }
    try {
      await billingApi.retryPayment(paymentId);
      toast.success("Payment retry initiated successfully");
      fetchNotifications(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to retry payment");
    }
  };

  if (loading) return <LoadingAlerts />;

  return (
    <div className="min-h-screen bg-[#f8f8f8] px-4 py-4 sm:px-6 sm:py-5 space-y-4 sm:space-y-5 max-w-full overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
        <Button
          variant="outline"
          onClick={() => fetchNotifications(true)}
          disabled={refreshing}
          className="bg-white hover:bg-gray-50 text-foreground border border-[#e7ded4] shadow-sm"
        >
          <RefreshCcw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
          Refresh
        </Button>
        <Button
          variant="outline"
          onClick={handleMarkAllRead}
          disabled={markingAsRead || unreadAll === 0}
          className="bg-white hover:bg-gray-50 text-foreground border border-[#e7ded4] shadow-sm disabled:opacity-40"
        >
          <CheckCheck className="mr-2 h-4 w-4" />
          {markingAsRead ? "Marking…" : "Mark All Read"}
        </Button>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-[#e7ded4] rounded-2xl shadow-sm p-3 sm:p-4">
        <div className="relative w-full sm:w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notifications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-white border border-border rounded-xl h-10 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-[#8B5A2B]"
          />
        </div>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-auto min-w-[150px] bg-white border-border text-foreground rounded-xl h-10 shadow-sm">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {presentTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-auto min-w-[140px] bg-white border-border text-foreground rounded-xl h-10 shadow-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
            <SelectItem value="read">Read</SelectItem>
          </SelectContent>
        </Select>

        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-auto min-w-[130px] bg-white border-border text-foreground rounded-xl h-10 shadow-sm">
            <SelectValue placeholder="Date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dates</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="last7">Last 7 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
        <nav className="flex gap-3 min-w-max p-1">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const tabN = tab.recipientKey
              ? notifications.filter(
                  (n) =>
                    n.recipient?.toLowerCase().includes(tab.recipientKey!) ||
                    n.recipient?.toLowerCase().includes(tab.id)
                )
              : notifications;
            const tabUnreadCount = tabN.filter((n) => n.status === "unread").length;

              const activeClassByTab: Record<string, string> = {
                overview: "bg-[#e8f0ff] border-[#c9d9ff]",
                chef: "bg-[#fff3e6] border-[#f4d1ad]",
                waiter: "bg-[#e8f7ff] border-[#c9eaf6]",
                cashier: "bg-[#eaf7ee] border-[#cce8d4]",
                manager: "bg-[#f3e9ff] border-[#dcc8f6]",
                "head-chef": "bg-[#fff4db] border-[#ecd7a3]",
              };

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative flex items-start gap-3 p-3 rounded-xl transition-all text-left min-w-[170px] border shadow-sm",
                    isActive
                      ? cn("text-[#2D2D2D]", activeClassByTab[tab.id] ?? "bg-[#e8f0ff] border-[#c9d9ff]")
                      : "bg-white border-[#e7ded4] text-[#4f4f4f] hover:bg-gray-50"
                  )}
                >
                  <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", isActive ? "text-[#2D2D2D]" : "text-muted-foreground")} />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-semibold", isActive ? "text-[#2D2D2D]" : "text-foreground")}>{tab.label}</p>
                    <p className={cn("text-xs mt-0.5", isActive ? "text-[#5f5f5f]" : "text-muted-foreground")}>
                      {tab.description}
                    </p>
                  </div>
                  {tabUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] text-[10px] font-bold bg-[#fff3e6] text-[#b45309] border border-[#f4d1ad] rounded-full flex items-center justify-center px-1">
                      {tabUnreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {visibleTabs.map((tab) => (
            <TabsContent
              key={tab.id}
              value={tab.id}
              className="mt-0 focus-visible:outline-none space-y-5"
            >
              {/* ── Stats row ── */}
              <div className="flex flex-wrap items-center gap-3">
                <StatPill label="Total" value={tabFiltered.length} color="text-gray-900" />
                <StatPill label="Unread" value={tabUnread} color="text-orange-600" />
                <StatPill label="Read" value={tabRead} color="text-green-600" />
                <StatPill label="Filtered" value={filtered.length} color="text-sky-600" />

                {tab.specs && (
                  <button
                    onClick={() => setShowSpecsPanel((v) => !v)}
                    className="ml-auto flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground border border-[#e7ded4] bg-white hover:bg-gray-50 rounded-xl px-3 py-2 shadow-sm transition-colors"
                  >
                    <BellRing className="h-3.5 w-3.5" />
                    {showSpecsPanel ? "Hide" : "Show"} notification types
                  </button>
                )}
              </div>

              {/* ── Specs Panel ── */}
              {showSpecsPanel && tab.specs && (
                <Card className="bg-white border-gray-200 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-gray-900 text-base flex items-center gap-2">
                      <BellRing className={cn("h-4 w-4", tab.id === "chef" ? "text-[#f97316]" : tab.id === "waiter" ? "text-[#0ea5e9]" : tab.id === "cashier" ? "text-[#22c55e]" : tab.id === "manager" ? "text-[#a855f7]" : tab.id === "head-chef" ? "text-[#f59e0b]" : "text-[#6366f1]")} />
                      Notification Types for {tab.label}
                    </CardTitle>
                    <CardDescription className="text-gray-500">
                      All configured alert types for this role
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SpecsGrid specs={tab.specs} />
                  </CardContent>
                </Card>
              )}

              {/* ── Notification Table ── */}
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-gray-900 text-base">
                    {tab.id === "overview" ? "All Notifications" : `${tab.label} Notifications`}
                  </CardTitle>
                  <CardDescription className="text-gray-500">
                    {filtered.length} notification{filtered.length !== 1 ? "s" : ""} shown
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
                      <Bell className="h-12 w-12 opacity-30" />
                      <p className="text-sm">No notifications match your filters</p>
                      {(typeFilter !== "all" || statusFilter !== "all" || dateFilter !== "all" || search) && (
                        <button
                          onClick={() => {
                            setTypeFilter("all");
                            setStatusFilter("all");
                            setDateFilter("all");
                            setSearch("");
                          }}
                          className="text-xs underline text-gray-400 hover:text-gray-700"
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-gray-100 hover:bg-transparent">
                            <TableHead className="text-gray-500 font-semibold w-10">#</TableHead>
                            <TableHead className="text-gray-500 font-semibold">Type</TableHead>
                            <TableHead className="text-gray-500 font-semibold">Title</TableHead>
                            <TableHead className="text-gray-500 font-semibold hidden md:table-cell">Message</TableHead>
                            <TableHead className="text-gray-500 font-semibold hidden lg:table-cell">Recipient</TableHead>
                            <TableHead className="text-gray-500 font-semibold">Status</TableHead>
                            <TableHead className="text-gray-500 font-semibold hidden sm:table-cell">Date</TableHead>
                            <TableHead className="text-gray-500 font-semibold text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filtered.map((n, idx) => {
                            const TypeIcon = getTypeIcon(n.type);
                            const typeColorClass = getTypeColor(n.type);
                            const isUnread = n.status === "unread";
                            return (
                              <TableRow
                                key={n._id}
                                className={cn(
                                  "border-gray-100 hover:bg-gray-50 transition-colors",
                                  isUnread && "bg-orange-50/40"
                                )}
                              >
                                <TableCell className="text-gray-400 text-xs font-mono">{idx + 1}</TableCell>

                                <TableCell>
                                  <div
                                    className={cn(
                                      "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium",
                                      typeColorClass
                                    )}
                                  >
                                    <TypeIcon className="h-3 w-3 shrink-0" />
                                    <span className="hidden sm:inline">
                                      {n.type?.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "—"}
                                    </span>
                                  </div>
                                </TableCell>

                                <TableCell>
                                  <p className={cn("text-sm font-semibold", isUnread ? "text-gray-900" : "text-gray-600")}>
                                    {n.title || "—"}
                                  </p>
                                </TableCell>

                                <TableCell className="hidden md:table-cell">
                                  <p className="text-sm text-gray-500 max-w-[280px] truncate" title={n.message}>
                                    {n.message || "—"}
                                  </p>
                                </TableCell>

                                <TableCell className="hidden lg:table-cell">
                                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full capitalize">
                                    {n.recipient || "—"}
                                  </span>
                                </TableCell>

                                <TableCell>
                                  <Badge
                                    className={cn(
                                      "text-xs font-semibold border",
                                      isUnread
                                        ? "bg-orange-100 text-orange-700 border-orange-300"
                                        : "bg-green-100 text-green-700 border-green-300"
                                    )}
                                  >
                                    {isUnread ? "Unread" : "Read"}
                                  </Badge>
                                </TableCell>

                                <TableCell className="hidden sm:table-cell text-gray-400 text-xs">
                                  {formatDate(n.created_at)}
                                </TableCell>

                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                    {isUnread && (
                                      <button
                                        onClick={() => handleMarkRead(n._id)}
                                        className="text-xs px-2 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 border border-green-300 transition-colors whitespace-nowrap"
                                      >
                                        Mark Read
                                      </button>
                                    )}

                                    {(n.type === "order" ||
                                      n.type === "order-delayed" ||
                                      n.type === "order-ready" ||
                                      n.type === "order-modified" ||
                                      n.type === "station-delayed" ||
                                      n.type === "station-overloaded") && (
                                      <button
                                        className="text-xs px-2 py-1 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300 transition-colors whitespace-nowrap"
                                        onClick={() => navigateToTab("orders")}
                                      >
                                        View Order
                                      </button>
                                    )}

                                    {n.type === "order-cancelled" && (
                                      <button
                                        className="text-xs px-2 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 border border-red-300 transition-colors whitespace-nowrap"
                                        onClick={() => navigateToTab("orders")}
                                      >
                                        View Orders
                                      </button>
                                    )}

                                    {(n.type === "payment" ||
                                      n.type === "payment-failed" ||
                                      n.type === "payment-initiated") && (
                                      <>
                                        {n.expiresAt && new Date() > new Date(n.expiresAt) ? (
                                          <span className="text-xs text-red-600 font-medium">Expired</span>
                                        ) : (
                                          <button
                                            className="text-xs px-2 py-1 rounded-lg bg-sky-100 text-sky-700 hover:bg-sky-200 border border-sky-300 transition-colors whitespace-nowrap"
                                            onClick={() => handleRetryPayment(n.paymentId, n.expiresAt)}
                                          >
                                            Retry Payment
                                          </button>
                                        )}
                                      </>
                                    )}

                                    {n.type === "payment-success" && (
                                      <button
                                        className="text-xs px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-300 transition-colors whitespace-nowrap"
                                        onClick={() => navigateToTab("billing")}
                                      >
                                        View Bill
                                      </button>
                                    )}

                                    {(n.type === "bill-generated" ||
                                      n.type === "refund-requested" ||
                                      n.type === "refund-processed" ||
                                      n.type === "large-transaction" ||
                                      n.type === "cash-mismatch" ||
                                      n.type === "eod-settlement" ||
                                      n.type === "shift-closing" ||
                                      n.type === "suspicious-transaction") && (
                                      <button
                                        className="text-xs px-2 py-1 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border border-indigo-300 transition-colors whitespace-nowrap"
                                        onClick={() => navigateToTab("billing")}
                                      >
                                        Open Billing
                                      </button>
                                    )}

                                    {(n.type === "stock" ||
                                      n.type === "low-stock" ||
                                      n.type === "critical-stock") && (
                                      <button
                                        className="text-xs px-2 py-1 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-300 transition-colors whitespace-nowrap"
                                        onClick={() => navigateToTab("inventory")}
                                      >
                                        Open Inventory
                                      </button>
                                    )}

                                    {(n.type === "staff-late" ||
                                      n.type === "staff-absent" ||
                                      n.type === "staff-checkin") && (
                                      <button
                                        className="text-xs px-2 py-1 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-300 transition-colors whitespace-nowrap"
                                        onClick={() => navigateToTab("staff")}
                                      >
                                        View Staff
                                      </button>
                                    )}

                                    {(n.type === "eod-report" || n.type === "sales-milestone") && (
                                      <button
                                        className="text-xs px-2 py-1 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300 transition-colors whitespace-nowrap"
                                        onClick={() => navigateToTab("reports")}
                                      >
                                        View Reports
                                      </button>
                                    )}

                                    {n.type === "table-assigned" && (
                                      <button
                                        className="text-xs px-2 py-1 rounded-lg bg-sky-100 text-sky-700 hover:bg-sky-200 border border-sky-300 transition-colors whitespace-nowrap"
                                        onClick={() => navigateToTab("tables")}
                                      >
                                        View Tables
                                      </button>
                                    )}

                                    {n.type === "table-idle" && (
                                      <button
                                        className="text-xs px-2 py-1 rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-200 border border-orange-300 transition-colors whitespace-nowrap"
                                        onClick={() => navigateToTab("tables")}
                                      >
                                        View Table
                                      </button>
                                    )}

                                    {n.type === "customer-assistance" && (
                                      <button
                                        className="text-xs px-2 py-1 rounded-lg bg-pink-100 text-pink-700 hover:bg-pink-200 border border-pink-300 transition-colors whitespace-nowrap"
                                        onClick={() => navigateToTab("tables")}
                                      >
                                        Go to Table
                                      </button>
                                    )}

                                    {n.type === "system-error" && (
                                      <button
                                        className="text-xs px-2 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 border border-red-300 transition-colors whitespace-nowrap"
                                        onClick={() => navigateToTab("settings")}
                                      >
                                        View Settings
                                      </button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
    </div>
  );
}
