import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/admin/components/ui/button';
import { Badge } from '@/admin/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/admin/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/admin/components/ui/select';
import { Input } from '@/admin/components/ui/input';
import { Label } from '@/admin/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/admin/components/ui/tabs';
import { cn } from '@/admin/components/ui/utils';
import { LoadingTables } from '@/admin/components/ui/loading-spinner';
import {
  Users, Clock, Utensils, Sparkles, CheckCircle, UserPlus,
  AlertCircle, ChefHat, Timer, MapPin, Calendar, X, Coffee, DollarSign,
  Plus, ChevronsRight, Minus, RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { tablesApi } from '@/admin/utils/api';
import { staffApi } from '@/admin/utils/api';
import { ordersApi } from '@/admin/utils/api';
import { workflowApi } from '@/admin/utils/api';
import { useAuth } from '@/admin/utils/auth-context';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type TableStatus = 'Available' | 'Reserved' | 'Occupied' | 'Eating' | 'Cleaning';
type Location = 'VIP Hall' | 'Main Hall' | 'AC Hall';
type Segment = 'Front' | 'Middle' | 'Back';

// Time slots for the walk-in modal
const TIME_SLOTS = [
  '7:30 AM - 8:50 AM',
  '9:10 AM - 10:30 AM',
  '12:00 PM - 1:20 PM',
  '1:40 PM - 3:00 PM',
  '6:40 PM - 8:00 PM',
  '8:20 PM - 9:40 PM'
];

// ============================================================================
// TABLE ILLUSTRATION COMPONENT
// ============================================================================

function TableIllustration({ capacity }: { capacity: number }) {
  const cap = capacity >= 6 ? 6 : capacity >= 4 ? 4 : 2;
  if (cap === 2) {
    return (
      <div className="flex items-center justify-center gap-1">
        <div className="w-3 h-4 bg-gray-400 rounded-sm" />
        <div className="w-8 h-6 bg-gray-600 rounded" />
        <div className="w-3 h-4 bg-gray-400 rounded-sm" />
      </div>
    );
  }
  if (cap === 4) {
    return (
      <div className="flex flex-col items-center justify-center gap-0.5">
        <div className="w-3 h-3 bg-gray-400 rounded-sm" />
        <div className="flex items-center gap-0.5">
          <div className="w-3 h-3 bg-gray-400 rounded-sm" />
          <div className="w-10 h-8 bg-gray-600 rounded" />
          <div className="w-3 h-3 bg-gray-400 rounded-sm" />
        </div>
        <div className="w-3 h-3 bg-gray-400 rounded-sm" />
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center gap-0.5">
      <div className="flex gap-2">
        <div className="w-3 h-3 bg-gray-400 rounded-sm" />
        <div className="w-3 h-3 bg-gray-400 rounded-sm" />
      </div>
      <div className="flex items-center gap-0.5">
        <div className="w-3 h-4 bg-gray-400 rounded-sm" />
        <div className="w-12 h-10 bg-gray-600 rounded" />
        <div className="w-3 h-4 bg-gray-400 rounded-sm" />
      </div>
      <div className="flex gap-2">
        <div className="w-3 h-3 bg-gray-400 rounded-sm" />
        <div className="w-3 h-3 bg-gray-400 rounded-sm" />
      </div>
    </div>
  );
}

// ============================================================================
// TABLE CARD COMPONENT
// ============================================================================

interface TableCardProps {
  table: any;
  onClick: () => void;
  waiters: any[];
  onAssignWaiter: (tableId: string, waiterId: string, waiterName: string) => void;
  onCheckout: (tableId: string) => void;
  onRequestOrder: (tableId: string) => void;
  onSeatGuests: (tableId: string, guestCount: number) => void;
  onUpdateStatus?: (tableId: string, status: 'Cleaning' | 'Available') => void;
  currentUser?: any;
}

function TableCard({ table, onClick, waiters, onAssignWaiter, onCheckout, onRequestOrder, onSeatGuests, onUpdateStatus, currentUser }: TableCardProps) {
  const isWaiter = currentUser?.role === 'waiter';
  const isAdminOrManager = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const isMyTable = isWaiter && table.waiterId === currentUser?.id;
  // Waiter can interact with their own table or unassigned occupied tables
  const canInteract = isAdminOrManager || !isWaiter || isMyTable || !table.waiterId;
  const [cleaningTimeLeft, setCleaningTimeLeft] = useState<number>(0);
  const [isPulsing, setIsPulsing] = useState(false);
  const [seatCount, setSeatCount] = useState(2);

  // Cleaning timer countdown
  useEffect(() => {
    if (table.status === 'Cleaning' && table.cleaningEndTime) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((table.cleaningEndTime! - Date.now()) / 1000));
        setCleaningTimeLeft(remaining);
        
        if (remaining === 0) {
          // Auto-reset to Available after timer ends - emit event for parent to handle
          window.dispatchEvent(new CustomEvent('table:reset-status', { 
            detail: { tableId: table.id } 
          }));
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [table.status, table.cleaningEndTime, table.id]);

  // Pulsating effect for "Order Ready"
  useEffect(() => {
    if (table.kitchenStatus === 'Ready') {
      const interval = setInterval(() => {
        setIsPulsing(prev => !prev);
      }, 500);
      return () => clearInterval(interval);
    } else {
      setIsPulsing(false);
    }
  }, [table.kitchenStatus]);

  const getStatusColor = () => {
    switch (table.status) {
      case 'Available': return 'bg-[#6ea77a]';
      case 'Reserved': return 'bg-[#c79b63]';
      case 'Occupied': return 'bg-[#6f8598]';
      case 'Eating': return 'bg-[#7a8591]';
      case 'Cleaning': return 'bg-[#9ca3af]';
      default: return 'bg-gray-300';
    }
  };

  const getStatusIcon = () => {
    switch (table.status) {
      case 'Available': return <CheckCircle className="w-4 h-4" />;
      case 'Reserved': return <Calendar className="w-4 h-4" />;
      case 'Occupied': return <Users className="w-4 h-4" />;
      case 'Eating': return <Utensils className="w-4 h-4" />;
      case 'Cleaning': return <Sparkles className="w-4 h-4" />;
      default: return null;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // All waiters from DB are available for assignment
  const availableWaiters = waiters;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="relative h-full"
    >
      <div
        className={cn(
          "bg-white cursor-pointer transition-all duration-200 border rounded-xl h-[272px] p-2.5 flex flex-col",
          "border-[#ece5dc] shadow-[0_4px_10px_rgba(0,0,0,0.06)] hover:-translate-y-[3px] hover:shadow-[0_8px_16px_rgba(0,0,0,0.09)]",
          isPulsing && "animate-pulse border-amber-500 shadow-xl"
        )}
        onClick={onClick}
      >
        <div className="space-y-1.5 flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn("w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-bold flex-shrink-0", getStatusColor())}>
                {table.displayNumber}
              </div>
            </div>
            <span className={cn(
              "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border",
              table.status === 'Available' && "bg-[#eef6f0] text-[#4f7f5b] border-[#cce3d2]",
              table.status === 'Occupied' && "bg-[#eef2f5] text-[#5f7284] border-[#d4dee7]",
              table.status === 'Eating' && "bg-[#f0f2f4] text-[#67737f] border-[#d8dce1]",
              table.status === 'Reserved' && "bg-[#fbf3e6] text-[#92693e] border-[#ecd6b7]",
              table.status === 'Cleaning' && "bg-[#f3f4f6] text-[#6b7280] border-[#e5e7eb]",
            )}>
              {getStatusIcon()}
              {table.status}
            </span>
          </div>

          {/* Capacity & Location */}
          <div className="flex items-center justify-between text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              <span>{table.capacity} seats</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span className="text-xs">{table.location}</span>
            </div>
          </div>

          {/* Waiter Info */}
          <div className="flex items-center gap-1.5 text-xs min-h-4">
            <UserPlus className="w-3 h-3 text-gray-500" />
            <span className="text-gray-700 truncate">{table.waiterName || 'Waiter: Unassigned'}</span>
          </div>

          {/* Kitchen Status Badge */}
          {table.kitchenStatus === 'Ready' && table.status === 'Eating' && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="bg-[#fbf3e6] border border-[#e8cba2] rounded-md p-1.5 flex items-center justify-center gap-1.5"
            >
              <ChefHat className="w-3.5 h-3.5 text-[#8f6437]" />
              <span className="font-semibold text-[#8f6437] text-xs">Order Ready!</span>
            </motion.div>
          )}

          {/* Guest Count */}
          {table.guestCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <Users className="w-3 h-3 text-gray-500" />
              <span className="text-gray-700">{table.guestCount} guests</span>
            </div>
          )}

          {/* Reserved Info */}
          {table.status === 'Reserved' && (
            <div className="bg-[#fbf3e6] border border-[#ecd6b7] rounded-md p-2 space-y-1">
              {(table.reservationTime || table.reservationSlot) && (
                <div className="flex items-center gap-2 text-amber-800">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-xs font-semibold">
                    {table.reservationTime || table.reservationSlot}
                  </span>
                </div>
              )}
              {table.reservedFor && (
                <div className="flex items-center gap-2 text-amber-700">
                  <UserPlus className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-xs truncate">{table.reservedFor}</span>
                </div>
              )}
            </div>
          )}

          {/* Cleaning Timer */}
          {table.status === 'Cleaning' && (
            <div className="bg-gray-100 rounded-md p-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer className="w-3.5 h-3.5 text-gray-600" />
                <span className="text-xs font-medium text-gray-700">Cleaning</span>
              </div>
              <span className="font-mono text-xs font-bold text-gray-800">
                {formatTime(cleaningTimeLeft)}
              </span>
            </div>
          )}

          {/* Bottom actions (fixed alignment) */}
          <div className="mt-auto pt-1 space-y-1" onClick={(e) => e.stopPropagation()}>
            {/* Waiter Assignment */}
            {table.status === 'Occupied' && !table.waiterName && (
              isWaiter ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 rounded-md text-xs border-[#b7d6bf] text-[#4f7f5b] hover:bg-[#eef6f0]"
                  onClick={() => onAssignWaiter(table.id, currentUser.id, currentUser.name)}
                >
                  <UserPlus className="w-3 h-3 mr-1" />
                  Assign
                </Button>
              ) : (
                <Select
                  onValueChange={(value) => {
                    const [waiterId, waiterName] = value.split('|');
                    onAssignWaiter(table.id, waiterId, waiterName);
                  }}
                >
                  <SelectTrigger className="h-7 text-xs rounded-md">
                    <SelectValue placeholder="Assign Waiter" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableWaiters.map((waiter) => (
                      <SelectItem key={waiter.id} value={`${waiter.id}|${waiter.name}`}>
                        {waiter.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            )}

            {table.status === 'Available' && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-6 w-6 rounded-md" onClick={() => setSeatCount(Math.max(1, seatCount - 1))}>
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="flex-1 text-center text-xs font-medium text-gray-900">{seatCount} guests</span>
                  <Button variant="outline" size="icon" className="h-6 w-6 rounded-md" onClick={() => setSeatCount(Math.min(table.capacity, seatCount + 1))}>
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
                <Button
                  size="sm"
                  className="w-full h-7 rounded-md text-xs bg-[#8b5e34] hover:bg-[#744a25] text-white"
                  onClick={() => onSeatGuests(table.id, seatCount)}
                >
                  <ChevronsRight className="w-4 h-4 mr-1" />
                  Seat Guests
                </Button>
              </div>
            )}

            {(table.status === 'Occupied' || table.status === 'Eating') && !table.currentOrderId && canInteract && (
              <Button
                size="sm"
                className="w-full h-7 rounded-md text-xs bg-[#8b5e34] hover:bg-[#744a25] text-white"
                onClick={() => onRequestOrder(table.id)}
              >
                <Utensils className="w-4 h-4 mr-1" />
                Request Order
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ReservationCard({ table, onCancel }: ReservationCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="bg-white border-2 border-stone-200 rounded-lg p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          {/* Table Number */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-stone-800 text-white rounded-lg flex items-center justify-center font-bold text-lg">
              {table.displayNumber}
            </div>
            <div>
              <p className="text-sm text-stone-500">Table • {table.capacity} Seats</p>
              <p className="text-xs text-stone-400">{table.location}</p>
            </div>
          </div>

          {/* Time Slot */}
          {table.reservationSlot && (
            <div className="flex items-center gap-2 text-amber-900">
              <Clock className="w-4 h-4" />
              <span className="font-medium text-sm">{table.reservationSlot}</span>
            </div>
          )}

          {/* Guest Count */}
          <div className="flex items-center gap-2 text-stone-700">
            <Users className="w-4 h-4" />
            <span className="text-sm">{table.guestCount} Guests</span>
          </div>

          {/* Status */}
          <div className="inline-block">
            <span className="text-xs font-medium text-stone-800 bg-stone-100 px-3 py-1 rounded-full border border-stone-300">
              {table.reservationStatus}
            </span>
          </div>
        </div>

        {/* Cancel Button */}
        <Button
          variant="outline"
          size="sm"
          className="border-stone-300 text-stone-700 hover:bg-stone-100 hover:text-stone-900"
          onClick={() => onCancel(table.id)}
        >
          <X className="w-4 h-4 mr-1" />
          Cancel
        </Button>
      </div>
    </motion.div>
  );
}

// ============================================================================
// WALK-IN MODAL COMPONENT
// ============================================================================

interface WalkInModalProps {
  open: boolean;
  onClose: () => void;
  tables: any[];
  onSelectTable: (tableId: string, guestCount: number, customerName: string) => void;
}

function WalkInModal({ open, onClose, tables, onSelectTable }: WalkInModalProps) {
  const [guestCount, setGuestCount] = useState(2);
  const [customerName, setCustomerName] = useState('');
  const [location, setLocation] = useState<Location | 'All'>('All');
  const [segment, setSegment] = useState<Segment | 'All'>('All');
  const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[0]);

  const eligibleTables = tables.filter(t => {
    if (t.status !== 'Available') return false;
    if (t.capacity < guestCount) return false;
    if (location !== 'All' && t.location !== location) return false;
    if (segment !== 'All' && t.segment !== segment) return false;
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#8B5A2B]" />
            New Walk-In Guest
          </DialogTitle>
          <DialogDescription>
            Select guest count and preferences to find available tables
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Guest Count */}
          <div className="space-y-2">
            <Label>Guest Count</Label>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="lg" onClick={() => setGuestCount(Math.max(1, guestCount - 1))}>
                <Minus className="w-4 h-4" />
              </Button>
              <div className="flex-1 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                <span className="text-4xl font-bold text-gray-900">{guestCount}</span>
              </div>
              <Button variant="outline" size="lg" onClick={() => setGuestCount(guestCount + 1)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Customer Name */}
          <div className="space-y-2">
            <Label>Customer Name</Label>
            <Input
              placeholder="Enter customer/guest name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="text-base"
            />
          </div>

          {/* Location Filter */}
          <div className="space-y-2">
            <Label>Location Preference (Optional)</Label>
            <Select value={location} onValueChange={(v) => setLocation(v as Location | 'All')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Locations</SelectItem>
                <SelectItem value="VIP Hall">VIP Hall</SelectItem>
                <SelectItem value="Main Hall">Main Hall</SelectItem>
                <SelectItem value="AC Hall">AC Hall</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Segment Filter */}
          <div className="space-y-2">
            <Label>Segment Preference (Optional)</Label>
            <Select value={segment} onValueChange={(v) => setSegment(v as Segment | 'All')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Segments</SelectItem>
                <SelectItem value="Front">Front</SelectItem>
                <SelectItem value="Middle">Middle</SelectItem>
                <SelectItem value="Back">Back</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Time Slot */}
          <div className="space-y-2">
            <Label>Time Slot (Optional)</Label>
            <Select value={timeSlot} onValueChange={setTimeSlot}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map(slot => (
                  <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Available Tables */}
          <div className="space-y-2">
            <Label>Available Tables (Capacity ≥ {guestCount})</Label>
            {eligibleTables.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No tables available matching your criteria</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto p-2">
                {eligibleTables.map(table => (
                  <Button
                    key={table.id}
                    variant="outline"
                    className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-emerald-50 hover:border-emerald-500"
                    onClick={() => { 
                      if (!customerName.trim()) {
                        toast.error('Please enter customer name');
                        return;
                      }
                      onSelectTable(table.id, guestCount, customerName);
                      onClose();
                      setCustomerName('');
                    }}
                  >
                    <TableIllustration capacity={table.capacity} />
                    <div className="font-bold text-gray-900">{table.displayNumber}</div>
                    <div className="text-xs text-gray-600">{table.location} — {table.segment}</div>
                    <Badge variant="secondary" className="text-xs">Seats {table.capacity}</Badge>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// RESERVATION TIME PARSER
// Handles: "7:30 PM", "19:30", "7:30 AM - 8:50 AM" (slot), ISO datetime
// ============================================================================

function parseReservationTime(timeStr: string | null | undefined): Date | null {
  if (!timeStr) return null;

  // ISO datetime string
  if (timeStr.includes('T') || /\d{4}-\d{2}-\d{2}/.test(timeStr)) {
    const d = new Date(timeStr);
    return isNaN(d.getTime()) ? null : d;
  }

  // Slot format "7:30 AM - 8:50 AM" → take start time
  const slotMatch = timeStr.match(/^(\d{1,2}:\d{2}\s*[AP]M)/i);
  const source = (slotMatch ? slotMatch[1] : timeStr).trim();

  // "H:MM AM/PM"
  const ampm = source.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1]);
    const m = parseInt(ampm[2]);
    const pm = ampm[3].toUpperCase() === 'PM';
    if (pm && h !== 12) h += 12;
    if (!pm && h === 12) h = 0;
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }

  // "HH:MM" 24-hour
  const h24 = source.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) {
    const d = new Date();
    d.setHours(parseInt(h24[1]), parseInt(h24[2]), 0, 0);
    return d;
  }

  return null;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function TableManagementComprehensive() {
  const { user } = useAuth();
  const [tables, setTables] = useState<any[]>([]);
  const [waiters, setWaiters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isInitialLoad = useRef(true);
  // Tracks tables that already had a waiter auto-assigned at reservation time
  const autoAssignedRef = useRef<Set<string>>(new Set());
  const [selectedLocation, setSelectedLocation] = useState<Location | 'All'>('All');
  const [walkInModalOpen, setWalkInModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('floor');
  
  // Add Table Dialog State
  const [addTableDialogOpen, setAddTableDialogOpen] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState(4);
  const [newTableLocation, setNewTableLocation] = useState<Location>('Main Hall');
  const [newTableSegment, setNewTableSegment] = useState('Front');
  const [creatingTable, setCreatingTable] = useState(false);
  const [statusDialogTable, setStatusDialogTable] = useState<any>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      // Fetch tables and staff independently so a staff failure never blocks the table view
      const [tablesRes, staffRes] = await Promise.allSettled([
        tablesApi.list(),
        staffApi.list({ role: 'Waiter' })
      ]);

      // ── Tables ──────────────────────────────────────────
      if (tablesRes.status === 'fulfilled') {
        const normalizeStatus = (s: string): TableStatus => {
          const map: Record<string, TableStatus> = {
            available: 'Available', occupied: 'Occupied', reserved: 'Reserved',
            cleaning: 'Cleaning', eating: 'Eating',
          };
          return map[s?.toLowerCase()] ?? 'Available';
        };

        const tablesData = Array.isArray(tablesRes.value) ? tablesRes.value : ((tablesRes.value as any).data || []);
        const transformedTables = tablesData.map((t: any) => ({
          id: t._id || t.id,
          displayNumber: t.displayNumber || t.display_number || t.name || t.tableNumber || t.table_number || `#${String(t._id || t.id).slice(-4)}`,
          number: t.displayNumber || t.display_number || t.name || t.tableNumber || t.number,
          capacity: t.capacity,
          location: t.location,
          segment: t.segment,
          status: normalizeStatus(t.status),
          guestCount: t.guestCount ?? t.currentGuests ?? 0,
          currentOrderId: t.currentOrderId,
          waiterId: t.waiterId || t.assignedWaiterId,
          waiterName: t.waiterName || t.assignedWaiterName,
          kitchenStatus: t.kitchenStatus,
          cleaningEndTime: t.cleaningEndTime,
          reservationSlot: t.reservation?.timeSlot || t.reservationSlot,
          reservationStatus: t.reservation?.status || t.reservationStatus,
          reservationType: t.reservation?.type || t.reservationType,
          reservedFor: t.reservedFor || t.reservation?.customerName || t.reservation?.name || null,
          reservationTime: t.reservationTime || t.reservation?.time || t.reservation?.scheduledTime || null,
        }));
        setTables(transformedTables);
      } else {
        console.error('Error fetching tables:', tablesRes.reason);
        if (isInitialLoad.current) toast.error('Failed to load tables');
      }

      // ── Waiters ─────────────────────────────────────────
      if (staffRes.status === 'fulfilled') {
        const staffData = Array.isArray(staffRes.value) ? staffRes.value : ((staffRes.value as any).data || []);
        const transformedWaiters = staffData.map((s: any) => ({
          id: s._id || s.id,
          name: s.name,
          assignedTableId: s.assignedTableId
        }));
        setWaiters(transformedWaiters);
      } else {
        console.warn('Could not load waiters (waiter assignment will be unavailable):', staffRes.reason);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      if (isInitialLoad.current) toast.error('Failed to load tables');
    } finally {
      if (isInitialLoad.current) {
        setLoading(false);
        isInitialLoad.current = false;
      }
    }
  };

  const handleAssignWaiter = async (tableId: string, waiterId: string, waiterName: string) => {
    try {
      await tablesApi.assignWaiter(tableId, waiterId, waiterName);
      
      // Call workflow endpoint to register waiter assignment (also creates notification in backend)
      try {
        await workflowApi.waiterAssigned(tableId, waiterId, waiterName);
      } catch (e) {
        console.warn('Could not notify workflow of waiter assignment:', e);
      }
      
      // Also update existing order for this table with the waiter info
      const table = tables.find(t => t.id === tableId);
      if (table?.currentOrderId) {
        try {
          await ordersApi.update(table.currentOrderId, { waiterId, waiterName });
        } catch (e) {
          console.warn('Could not update order with waiter info:', e);
        }
      }

      // Dispatch event to refresh notification badge count in the header
      window.dispatchEvent(new Event('new-admin-notification'));

      toast.success(`${waiterName} assigned to table`);
      fetchData();
    } catch (error) {
      toast.error('Failed to assign waiter');
    }
  };

  // ── Auto-assign least-loaded waiter when reservation time arrives ──────────
  useEffect(() => {
    if (waiters.length === 0) return;

    const check = () => {
      const now = new Date();
      const reserved = tables.filter(
        t => t.status === 'Reserved' && !t.waiterId && !autoAssignedRef.current.has(t.id)
      );
      if (reserved.length === 0) return;

      for (const table of reserved) {
        const resTime = parseReservationTime(table.reservationTime || table.reservationSlot);
        if (!resTime) continue;

        // Trigger within a 10-minute window after reservation time
        const diffMs = now.getTime() - resTime.getTime();
        if (diffMs < 0 || diffMs > 10 * 60 * 1000) continue;

        // Count active tables per waiter (Occupied or Eating)
        const leastBusy = [...waiters]
          .map(w => ({
            ...w,
            load: tables.filter(
              t => t.waiterId === w.id && (t.status === 'Occupied' || t.status === 'Eating')
            ).length,
          }))
          .sort((a, b) => a.load - b.load)[0];

        if (!leastBusy) continue;

        // Mark immediately to prevent re-triggering on next interval
        autoAssignedRef.current.add(table.id);

        toast.info(
          `⏰ Reservation time reached — assigning ${leastBusy.name} to Table ${table.displayNumber}`
        );

        handleAssignWaiter(table.id, leastBusy.id, leastBusy.name).catch(() => {
          // Allow retry on next cycle if assignment failed
          autoAssignedRef.current.delete(table.id);
        });
      }
    };

    check(); // run immediately whenever tables / waiters change
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [tables, waiters]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCheckout = async (tableId: string) => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    try {
      // Update order to bill_requested
      if (table.currentOrderId) {
        await ordersApi.updateStatus(table.currentOrderId, 'bill_requested');
      }

      toast.success('Checkout initiated - Bill requested');
      fetchData();
    } catch (error) {
      toast.error('Failed to initiate checkout');
    }
  };

  const handleWalkIn = async () => {
    setWalkInModalOpen(true);
  };

  const handleSelectTableForWalkIn = async (tableId: string, guestCount: number, customerName: string) => {
    try {
      // Call workflow API to block table for 15 minutes
      await workflowApi.walkInBooking(tableId, guestCount, customerName);
      toast.success(`${customerName}'s table blocked for 15 minutes`);
      fetchData();
    } catch (error) {
      console.error('Walk-in booking failed:', error);
      toast.error('Failed to book walk-in table');
    }
  };

  const handleCancelReservation = async (tableId: string) => {
    try {
      await tablesApi.updateStatus(tableId, 'available');
      toast.success('Reservation cancelled');
      fetchData();
    } catch (error) {
      toast.error('Failed to cancel reservation');
    }
  };

  const handleSeatGuests = async (tableId: string, guestCount: number) => {
    try {
      await tablesApi.updateStatus(tableId, 'occupied', guestCount);

      // If a waiter is logged in, auto-assign them to this table
      if (user?.role === 'waiter') {
        try {
          await tablesApi.assignWaiter(tableId, user.id, user.name);
          // Trigger waiter assignment workflow + notification
          try {
            await workflowApi.waiterAssigned(tableId, user.id, user.name);
          } catch (_) {}
          window.dispatchEvent(new Event('new-admin-notification'));
        } catch (e) {
          console.warn('Could not auto-assign waiter on seat:', e);
        }
      }
      
      // Call workflow endpoint to notify guest arrival
      try {
        await workflowApi.guestArrived(tableId);
      } catch (e) {
        console.warn('Could not notify workflow of guest arrival:', e);
      }
      
      toast.success(`Table seated with ${guestCount} guest${guestCount !== 1 ? 's' : ''}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to seat guests');
    }
  };

  const handleUpdateTableStatus = async (tableId: string, status: 'Cleaning' | 'Available') => {
    await handleTableStatusChange(tableId, status);
  };

  const handleResetAllTables = async () => {
    if (!confirm('Reset ALL tables to Available? This will clear all waiter assignments, guest counts, and active orders.')) return;
    try {
      const result = await tablesApi.resetAll();
      toast.success(`Reset ${result.modified} tables to Available`);
      fetchData();
    } catch (error) {
      toast.error('Failed to reset tables');
    }
  };

  const handleTableStatusChange = async (tableId: string, newStatus: TableStatus) => {
    try {
      const updateData: any = { status: newStatus.toLowerCase() };
      if (newStatus === 'Cleaning') {
        updateData.cleaningEndTime = Date.now() + 10 * 60 * 1000; // 10-minute timer
      } else if (newStatus === 'Available') {
        // If table has an active order, queue it for billing before freeing the table
        const table = tables.find(t => t.id === tableId);
        if (table?.currentOrderId) {
          try {
            await ordersApi.updateStatus(table.currentOrderId, 'bill_requested');
            toast.info(`Bill queued for Table ${table.displayNumber} — check the Billing page.`, { duration: 5000 });
          } catch (e) {
            console.warn('Could not set order to bill_requested:', e);
          }
        }
        // Clear assignment and guest info when freeing the table
        updateData.cleaningEndTime = null;
        updateData.waiterId = null;
        updateData.waiterName = null;
        updateData.guestCount = 0;
        updateData.currentOrderId = null;
        updateData.kitchenStatus = null;
      }
      await tablesApi.update(tableId, updateData);
      toast.success(`Table marked as ${newStatus}`);
      setStatusDialogTable(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to update table status');
    }
  };

  const handleRequestOrder = async (tableId: string) => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    // Determine waiterId: use table's assigned waiter, or auto-assign if current user is a waiter
    let waiterId = table.waiterId || null;
    let waiterName = table.waiterName || null;

    if (!waiterId && user?.role === 'waiter') {
      // Auto-assign the current waiter to this table and order
      waiterId = user.id;
      waiterName = user.name;
      try {
        await tablesApi.assignWaiter(tableId, waiterId, waiterName);
        // Trigger waiter assignment workflow + notification
        try {
          await workflowApi.waiterAssigned(tableId, waiterId, waiterName);
        } catch (_) {}
        window.dispatchEvent(new Event('new-admin-notification'));
      } catch (e) {
        console.warn('Could not auto-assign waiter to table:', e);
      }
    }

    if (!waiterId) {
      toast.error('Please assign a waiter to this table first');
      return;
    }

    try {
      const orderData = {
        tableId,
        tableNumber: table.displayNumber,
        waiterId,
        waiterName,
        type: 'dine-in',
        status: 'placed',
        items: [],
        total: 0,
        notes: '',
      };
      
      const orderResponse = await ordersApi.create(orderData);
      
      // Ensure response has proper ID
      const orderId = orderResponse?._id || orderResponse?.id;
      if (!orderId) {
        console.error('Order created but no ID returned:', orderResponse);
        throw new Error('Order creation failed: No ID returned from server');
      }
      
      await tablesApi.update(tableId, { currentOrderId: orderId, status: 'occupied' });
      
      // Call workflow endpoint to register order creation
      try {
        const orderNumber = `#ORD-${Date.now().toString().slice(-4)}`;
        await workflowApi.orderCreated(tableId, orderId, orderNumber);
      } catch (e) {
        console.warn('Could not notify workflow of order creation:', e);
      }
      
      toast.success(`Order created for table ${table.displayNumber}`);
      fetchData();
    } catch (error) {
      console.error('Failed to create order request:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to create order: ${errorMsg}`);
    }
  };

  // Handle creating a new table
  const handleCreateTable = async () => {
    if (!newTableName.trim()) {
      toast.error('Please enter a table name');
      return;
    }
    
    setCreatingTable(true);
    try {
      const tableData = {
        name: newTableName,
        displayNumber: newTableName,
        capacity: newTableCapacity,
        location: newTableLocation,
        segment: newTableSegment,
        status: 'available',
        reservationType: 'None',
        guestCount: 0
      };
      
      await tablesApi.create(tableData);
      
      toast.success(`Table ${newTableName} created successfully`);
      setAddTableDialogOpen(false);
      // Reset form
      setNewTableName('');
      setNewTableCapacity(4);
      setNewTableLocation('Main Hall');
      setNewTableSegment('Front');
      fetchData();
    } catch (error) {
      console.error('Error creating table:', error);
      toast.error('Failed to create table');
    } finally {
      setCreatingTable(false);
    }
  };

  const isWaiterUser = user?.role === 'waiter';
  const filteredTables = (selectedLocation === 'All'
    ? tables
    : tables.filter(t => t.location === selectedLocation)
  ).filter(t => !isWaiterUser || t.waiterId === user?.id);

  const reservationTables = tables.filter(
    t => t.reservationStatus && !['Cancelled', 'Expired'].includes(t.reservationStatus)
  );

  const groupedTables: Record<string, any[]> = filteredTables.reduce((acc: Record<string, any[]>, table) => {
    const location = table.location || 'Other';
    if (!acc[location as Location]) {
      acc[location as Location] = [];
    }
    acc[location as Location].push(table);
    return acc;
  }, {} as Record<string, any[]>);

  if (loading) {
    return <LoadingTables />;
  }

  return (
    <div className="min-h-screen p-4 sm:p-5 space-y-2.5 bg-[#f8f6f3] max-w-full overflow-x-hidden text-[#2c2c2c]">
      {/* Header Row: KPI cards (left) + Actions (right) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {[
            { label: 'Available Tables', count: tables.filter(t => t.status === 'Available').length, color: 'bg-[#6ea77a]', text: 'text-[#4f7f5b]' },
            { label: 'Occupied Tables', count: tables.filter(t => t.status === 'Occupied' || t.status === 'Eating').length, color: 'bg-[#6f8598]', text: 'text-[#5f7284]' },
            { label: 'Reserved Tables', count: tables.filter(t => t.status === 'Reserved').length, color: 'bg-[#c79b63]', text: 'text-[#92693e]' },
            { label: 'Cleaning Tables', count: tables.filter(t => t.status === 'Cleaning').length, color: 'bg-gray-400', text: 'text-gray-700' },
          ].map(({ label, count, color, text }) => (
            <div key={label} className="h-[72px] w-[200px] flex items-center justify-center gap-2 rounded-xl border border-[#ece5dc] bg-white px-2.5 py-2 shadow-[0_4px_10px_rgba(0,0,0,0.06)]">
              <div className={`w-3 h-3 rounded-full ${color}`} />
              <div className="flex flex-col justify-center">
                <p className="text-[16px] leading-none font-bold text-gray-900 mb-0.5">{count}</p>
                <p className={`text-[12px] font-medium ${text}`}>{label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Only admin/manager can add tables */}
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <>
              <Button
                className="h-9 rounded-md bg-[#b65b5b] hover:bg-[#a24f4f] text-white text-xs sm:text-sm"
                onClick={handleResetAllTables}
              >
                <RotateCcw className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Reset All Tables</span>
                <span className="sm:hidden">Reset</span>
              </Button>
              <Button
                className="h-9 rounded-md bg-[#8B5A2B] hover:bg-[#6B4520] text-white text-xs sm:text-sm"
                onClick={() => setAddTableDialogOpen(true)}
              >
                <Plus className="w-4 h-4 mr-1 sm:mr-2" />
                Add Table
              </Button>
            </>
          )}
          <Button
            className="h-9 rounded-md bg-[#8B5A2B] hover:bg-[#6B4520] text-white text-xs sm:text-sm"
            onClick={handleWalkIn}
          >
            <UserPlus className="w-4 h-4 mr-1 sm:mr-2" />
            Walk-In Entry
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white">
          <TabsTrigger value="floor">Floor Plan</TabsTrigger>
          <TabsTrigger value="reservations">Reservations</TabsTrigger>
        </TabsList>

        {/* Floor Plan Tab */}
        <TabsContent value="floor" className="space-y-2.5">
          {/* Location Filter */}
          <div className="bg-white rounded-[10px] p-3 border border-[#ece5dc] shadow-[0_4px_10px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Label className="text-sm font-medium">Filter:</Label>
              <div className="flex gap-2 flex-wrap">
                {(['All', 'VIP Hall', 'Main Hall', 'AC Hall'] as const).map((loc) => (
                  <Button
                    key={loc}
                    variant={selectedLocation === loc ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedLocation(loc)}
                    className={cn(
                      'h-7 rounded-md text-xs',
                      selectedLocation === loc && 'bg-[#8B5A2B] text-white hover:bg-[#6B4520]'
                    )}
                  >
                    {loc === 'VIP Hall' ? 'VIP' : loc}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Tables Grid */}
          {Object.keys(groupedTables).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-stone-300 rounded-xl bg-white">
              <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mb-4">
                <Utensils className="w-10 h-10 text-stone-400" />
              </div>
              <h3 className="text-xl font-semibold text-stone-700 mb-1">
                {tables.length === 0 ? 'No tables yet' : 'No tables match this filter or role'}
              </h3>
              <p className="text-stone-400 text-sm mb-6">
                {tables.length === 0
                  ? 'Get started by adding your first table to the floor plan.'
                  : 'Try selecting a different location filter or role.'}
              </p>
              {tables.length === 0 && (
                <Button
                  className="bg-[#8B5A2B] hover:bg-[#6B4520] text-white"
                  onClick={() => setAddTableDialogOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Table
                </Button>
              )}
            </div>
          ) : (
            Object.entries(groupedTables).map(([location, locationTables]) => (
              <div key={location} className="space-y-1.5">
                <h2 className="text-base font-semibold text-[#3d3a36] flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#8B5A2B]" />
                  {location}
                </h2>
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                  <AnimatePresence>
                    {locationTables.map((table) => (
                      <TableCard
                        key={table.id}
                        table={table}
                        onClick={() => setStatusDialogTable(table)}
                        waiters={waiters}
                        onAssignWaiter={handleAssignWaiter}
                        onCheckout={handleCheckout}
                        onRequestOrder={handleRequestOrder}
                        onSeatGuests={handleSeatGuests}
                        onUpdateStatus={handleUpdateTableStatus}
                        currentUser={user}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* Reservations Tab */}
        <TabsContent value="reservations" className="space-y-4">
          <div className="bg-stone-50 rounded-lg p-6 border border-stone-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-amber-900">Reservation Log</h2>
                <p className="text-stone-600 text-sm mt-1">Upcoming and active bookings</p>
              </div>
              <Badge variant="outline" className="text-stone-800 border-stone-400">
                {reservationTables.length} Active
              </Badge>
            </div>

            <div className="space-y-3">
              {reservationTables.length === 0 ? (
                <div className="text-center py-12 text-stone-500">
                  <Calendar className="w-16 h-16 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No reservations</p>
                  <p className="text-sm text-stone-400 mt-1">All tables are available</p>
                </div>
              ) : (
                <AnimatePresence>
                  {reservationTables.map((table) => (
                    <ReservationCard
                      key={table.id}
                      table={table}
                      onCancel={handleCancelReservation}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Table Status Dialog */}
      <Dialog open={!!statusDialogTable} onOpenChange={(open) => { if (!open) setStatusDialogTable(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Table {statusDialogTable?.displayNumber}
              <span className={cn(
                'text-xs font-medium px-2 py-1 rounded-full border ml-1',
                statusDialogTable?.status === 'Available' && 'bg-green-50 text-green-700 border-green-200',
                statusDialogTable?.status === 'Occupied' && 'bg-blue-50 text-blue-700 border-blue-200',
                statusDialogTable?.status === 'Eating' && 'bg-purple-50 text-purple-700 border-purple-200',
                statusDialogTable?.status === 'Reserved' && 'bg-amber-50 text-amber-700 border-amber-200',
                statusDialogTable?.status === 'Cleaning' && 'bg-gray-50 text-gray-700 border-gray-200',
              )}>
                {statusDialogTable?.status}
              </span>
            </DialogTitle>
            <DialogDescription>Change the status of this table</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2 py-2">
            {([
              { status: 'Available' as TableStatus, icon: <CheckCircle className="w-4 h-4" />, color: 'border-green-400 text-green-700 hover:bg-green-50' },
              { status: 'Occupied' as TableStatus, icon: <Users className="w-4 h-4" />, color: 'border-blue-400 text-blue-700 hover:bg-blue-50' },
              { status: 'Eating' as TableStatus, icon: <Utensils className="w-4 h-4" />, color: 'border-purple-400 text-purple-700 hover:bg-purple-50' },
              { status: 'Reserved' as TableStatus, icon: <Calendar className="w-4 h-4" />, color: 'border-amber-400 text-amber-700 hover:bg-amber-50' },
              { status: 'Cleaning' as TableStatus, icon: <Sparkles className="w-4 h-4" />, color: 'border-gray-400 text-gray-700 hover:bg-gray-50' },
            ]).map(({ status, icon, color }) => (
              <Button
                key={status}
                variant="outline"
                className={cn('w-full justify-start gap-2', color, statusDialogTable?.status === status && 'ring-2 ring-offset-1')}
                onClick={() => statusDialogTable && handleTableStatusChange(statusDialogTable.id, status)}
              >
                {icon}
                {status}
                {statusDialogTable?.status === status && <span className="ml-auto text-xs opacity-60">current</span>}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Table Dialog */}
      <Dialog open={addTableDialogOpen} onOpenChange={setAddTableDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Table</DialogTitle>
            <DialogDescription>
              Create a new table for the restaurant floor
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Table Name */}
            <div className="space-y-2">
              <Label htmlFor="tableName">Table Name / Number</Label>
              <Input
                id="tableName"
                placeholder="e.g., T1, A1, V1"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
              />
            </div>
            
            {/* Capacity */}
            <div className="space-y-2">
              <Label htmlFor="capacity">Capacity (seats)</Label>
              <Input
                id="capacity"
                type="number"
                min={1}
                max={20}
                value={newTableCapacity}
                onChange={(e) => setNewTableCapacity(Number(e.target.value))}
              />
            </div>
            
            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Select
                value={newTableLocation}
                onValueChange={(value) => setNewTableLocation(value as Location)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIP Hall">VIP Hall</SelectItem>
                  <SelectItem value="Main Hall">Main Hall</SelectItem>
                  <SelectItem value="AC Hall">AC Hall</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Segment */}
            <div className="space-y-2">
              <Label htmlFor="segment">Segment</Label>
              <Select
                value={newTableSegment}
                onValueChange={(value) => setNewTableSegment(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Front">Front</SelectItem>
                  <SelectItem value="Middle">Middle</SelectItem>
                  <SelectItem value="Back">Back</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddTableDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTable}
              disabled={creatingTable || !newTableName.trim()}
              className="bg-[#8B5A2B] hover:bg-[#6B4520] text-white"
            >
              {creatingTable ? 'Creating...' : 'Create Table'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WalkInModal
        open={walkInModalOpen}
        onClose={() => setWalkInModalOpen(false)}
        tables={tables}
        onSelectTable={handleSelectTableForWalkIn}
      />
    </div>
  );
}
