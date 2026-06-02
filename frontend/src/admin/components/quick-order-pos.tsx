import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/admin/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/admin/components/ui/card';
import { Badge } from '@/admin/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/admin/components/ui/select';
import { Input } from '@/admin/components/ui/input';
import { Label } from '@/admin/components/ui/label';
import { Textarea } from '@/admin/components/ui/textarea';
import { ScrollArea } from '@/admin/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/admin/components/ui/tabs';
import { 
  Plus, Minus, X, IndianRupee, UtensilsCrossed, Zap, 
  Search, Sparkles, ShoppingBag, CheckCircle, ChevronDown, 
  ChevronUp, Tag as TagIcon, Flame, Package2, Clock, 
  AlertTriangle, ChefHat, Repeat, Volume2, VolumeX, 
  ArrowRight, ArrowLeft, Edit, Trash2, Check, 
  Timer, TrendingUp, Package
} from 'lucide-react';
import { toast } from 'sonner';
import { tablesApi, ordersApi, menuApi } from '@/admin/utils/api';
import { API_BASE_URL } from '@/admin/utils/api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/admin/components/ui/dialog';
import { restaurantState } from '@/admin/services/restaurant-state';
import { useAuth } from '@/admin/utils/auth-context';
import { PaymentDialog } from '@/admin/components/payment-dialog';
import { Switch } from '@/admin/components/ui/switch';
import { Progress } from '@/admin/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/admin/components/ui/collapsible';

// ==================== INTERFACES ====================

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  image: string;
  available: boolean;
  dietType?: 'veg' | 'non-veg';
  spiceLevel?: 'mild' | 'medium' | 'hot' | 'extra-hot';
  calories?: number;
  preparationTime?: number;
  cookingStation?: string;
}

interface ComboMeal {
  id: string;
  name: string;
  description: string;
  items: string[]; // menu item IDs
  originalPrice: number;
  discountedPrice: number;
  image: string;
  available: boolean;
  calories?: number;
}

interface QuickOrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  isCombo?: boolean;
  comboItems?: MenuItem[]; // expanded combo items
  customization?: string;
  category?: string;
  cookingStation?: string;
  image?: string;
}

interface OrderTimeline {
  status: 'placed' | 'accepted' | 'preparing' | 'ready' | 'served';
  timestamp: Date;
  duration?: number;
}

interface RecentOrder {
  id: string;
  items: QuickOrderItem[];
  total: number;
  timestamp: Date;
}

interface TableData {
  _id: string;
  name: string;
  displayNumber: string;
  capacity: number;
  location: string;
  segment: string;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning';
  reservationType?: string;
  guestCount?: number;
  waiterName?: string | null;
  waiterId?: string | null;
}

interface QuickOrderPOSProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderCreated: () => void;
  initialTableNumber?: string;
  initialOrderType?: 'dine-in' | 'takeaway';
  existingOrderId?: string; // When set, updates the existing order instead of creating a new one
}

// ==================== CONSTANTS ====================

const QUICK_TAGS = ['Extra Spicy', 'No Onion', 'No Garlic', 'Priority', 'VIP', 'Allergy'];

const ORDER_STATUSES: OrderTimeline['status'][] = ['placed', 'accepted', 'preparing', 'ready', 'served'];

const STATUS_COLORS = {
  placed: 'bg-blue-500',
  accepted: 'bg-yellow-500',
  preparing: 'bg-orange-500',
  ready: 'bg-green-500',
  served: 'bg-gray-500',
};

const COOKING_STATIONS = {
  grill: { label: 'Grill', icon: Flame, color: 'text-red-600 bg-red-50' },
  wok: { label: 'Wok', icon: ChefHat, color: 'text-orange-600 bg-orange-50' },
  tandoor: { label: 'Tandoor', icon: Flame, color: 'text-yellow-600 bg-yellow-50' },
  fryer: { label: 'Fryer', icon: Package, color: 'text-amber-600 bg-amber-50' },
  salad: { label: 'Salad', icon: Package2, color: 'text-green-600 bg-green-50' },
};

// Feature #13: Sound Effects
const playSound = (type: 'add' | 'remove' | 'complete' | 'error', soundEnabled: boolean) => {
  if (!soundEnabled) return;
  
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  const frequencies = {
    add: 800,
    remove: 400,
    complete: 1000,
    error: 200,
  };
  
  oscillator.frequency.value = frequencies[type];
  oscillator.type = 'sine';
  
  gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.1);
};

// ==================== MAIN COMPONENT ====================

export function QuickOrderPOS({ open, onOpenChange, onOrderCreated, initialTableNumber, initialOrderType, existingOrderId }: QuickOrderPOSProps) {
  const { user } = useAuth();

  // ========== STATE MANAGEMENT ==========
  
  // Order Info State
  const [orderType, setOrderType] = useState<'dine-in' | 'takeaway'>('dine-in');
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Multi-step flow: step 1 = details, step 2 = items, step 3 = payment (takeaway only)
  const [currentStep, setCurrentStep] = useState(1);

  // Takeaway payment flow
  const [takeawayPaymentOpen, setTakeawayPaymentOpen] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState('');
  const [createdOrderTotal, setCreatedOrderTotal] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi' | 'wallet'>('cash');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [availableTables, setAvailableTables] = useState<TableData[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);

  // Menu Data
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [comboMeals, setComboMeals] = useState<ComboMeal[]>([]);
  const [loading, setLoading] = useState(true);

  // Item Selection State
  const [activeTab, setActiveTab] = useState<'combos' | 'items' | 'recent'>('combos');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Order Items State
  const [orderItems, setOrderItems] = useState<QuickOrderItem[]>([]);

  // Progressive Disclosure State
  const [showSpecialInstructions, setShowSpecialInstructions] = useState(false);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  // Feature #1: Live Order Timeline State
  const [orderTimeline, setOrderTimeline] = useState<OrderTimeline[]>([
    { status: 'placed', timestamp: new Date(), duration: 0 }
  ]);
  const [currentStatus, setCurrentStatus] = useState<OrderTimeline['status']>('placed');

  // Feature #2: Bottleneck Detection State
  const [isBottleneck, setIsBottleneck] = useState(false);
  const [preparingDuration, setPreparingDuration] = useState(0);
  const BOTTLENECK_THRESHOLD = 15; // minutes

  // Feature #3: Smart KOT Grouping State
  const [groupedItems, setGroupedItems] = useState<Record<string, QuickOrderItem[]>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Feature #4: Rollback Protection State
  const [rollbackDialog, setRollbackDialog] = useState(false);

  // Feature #5: Drag Gesture State
  const [dragStartX, setDragStartX] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Feature #6: Combo Split Select State
  const [expandedCombo, setExpandedCombo] = useState<string | null>(null);

  // Feature #8: Recent Orders State
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);

  // Feature #13: Sound Feedback State
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Role State for access control
  const [currentRole, setCurrentRole] = useState<'admin' | 'waiter'>('admin');

  // Feature #11: Inline Search (already implemented with searchQuery)

  // Feature #12: Gesture Shortcuts State
  const [lastTap, setLastTap] = useState<number>(0);
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Refs for gesture handling
  const orderCardRef = useRef<HTMLDivElement>(null);

  // ========== EFFECTS ==========

  // Pre-fill table number when opened from Take Order button
  useEffect(() => {
    if (open) {
      setCurrentStep(1);
      if (initialTableNumber) {
        setOrderType(initialOrderType ?? 'dine-in');
        setTableNumber(initialTableNumber);
      }
    }
  }, [open, initialTableNumber, initialOrderType]);

  // Check current role on open — prefer auth user role, fall back to restaurantState
  useEffect(() => {
    if (open) {
      const authRole = user?.role;
      if (authRole === 'waiter') {
        setCurrentRole('waiter');
      } else if (authRole === 'admin' || authRole === 'manager' || authRole === 'cashier') {
        setCurrentRole('admin');
      } else {
        const role = restaurantState.getRole();
        setCurrentRole(role);
      }
    }
  }, [open, user?.role]);

  // Fetch menu items and combos from Menu Management
  useEffect(() => {
    if (open) {
      fetchMenuData();
      loadRecentOrders();
      fetchAvailableTables();
    }
  }, [open]);

  // Feature #2: Bottleneck Detection - Monitor preparing duration
  useEffect(() => {
    if (currentStatus === 'preparing') {
      const interval = setInterval(() => {
        setPreparingDuration(prev => {
          const newDuration = prev + 1;
          if (newDuration >= BOTTLENECK_THRESHOLD) {
            setIsBottleneck(true);
            // Feature #10: Smart Notification
            if (newDuration === BOTTLENECK_THRESHOLD) {
              toast.warning('Order taking longer than usual', { duration: 3000 });
            }
          }
          return newDuration;
        });
      }, 60000); // every minute
      
      return () => clearInterval(interval);
    } else {
      setPreparingDuration(0);
      setIsBottleneck(false);
    }
  }, [currentStatus]);

  // Feature #3: Smart KOT Grouping - Group items by cooking station
  useEffect(() => {
    const grouped: Record<string, QuickOrderItem[]> = {};
    
    orderItems.forEach(item => {
      const station = item.cookingStation || 'other';
      if (!grouped[station]) {
        grouped[station] = [];
      }
      grouped[station].push(item);
    });
    
    setGroupedItems(grouped);
  }, [orderItems]);

  // ========== DATA FETCHING ==========

  const fetchMenuData = async () => {
    setLoading(true);
    
    // Mock data with cooking stations
    const mockMenuItems: MenuItem[] = [
      {
        id: '1',
        name: 'Paneer Tikka',
        category: 'appetizers',
        price: 280,
        description: 'Grilled cottage cheese with spices',
        image: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400',
        available: true,
        dietType: 'veg',
        spiceLevel: 'medium',
        calories: 350,
        preparationTime: 15
      },
      {
        id: '2',
        name: 'Butter Chicken',
        category: 'main-course',
        price: 350,
        description: 'Creamy tomato-based chicken curry',
        image: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400',
        available: true,
        dietType: 'non-veg',
        spiceLevel: 'mild',
        calories: 520,
        preparationTime: 25
      },
      {
        id: '3',
        name: 'Dal Makhani',
        category: 'main-course',
        price: 220,
        description: 'Creamy black lentils',
        image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400',
        available: true,
        dietType: 'veg',
        spiceLevel: 'mild',
        calories: 280,
        preparationTime: 20
      },
      {
        id: '4',
        name: 'Butter Naan',
        category: 'breads',
        price: 50,
        description: 'Soft flatbread with butter',
        image: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=400',
        available: true,
        dietType: 'veg',
        calories: 150,
        preparationTime: 5
      },
      {
        id: '5',
        name: 'Gulab Jamun',
        category: 'desserts',
        price: 80,
        description: 'Sweet milk dumplings in syrup',
        image: 'https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?w=400',
        available: true,
        dietType: 'veg',
        calories: 200,
        preparationTime: 5
      },
      {
        id: '6',
        name: 'Biryani',
        category: 'main-course',
        price: 320,
        description: 'Fragrant rice with spices',
        image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400',
        available: true,
        dietType: 'non-veg',
        spiceLevel: 'hot',
        calories: 450,
        preparationTime: 30
      },
      {
        id: '7',
        name: 'Masala Dosa',
        category: 'main-course',
        price: 180,
        description: 'Crispy rice crepe with potato filling',
        image: 'https://images.unsplash.com/photo-1630383249896-424e482df921?w=400',
        available: true,
        dietType: 'veg',
        spiceLevel: 'medium',
        calories: 320,
        preparationTime: 15
      },
      {
        id: '8',
        name: 'Chicken Tikka',
        category: 'appetizers',
        price: 320,
        description: 'Grilled chicken marinated in spices',
        image: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400',
        available: true,
        dietType: 'non-veg',
        spiceLevel: 'hot',
        calories: 280,
        preparationTime: 20
      }
    ];

    const mockCombos: ComboMeal[] = [
      {
        id: 'combo1',
        name: 'Family Feast',
        description: 'Butter Chicken + Biryani + 4 Naan + Gulab Jamun',
        items: ['2', '6', '4', '5'],
        originalPrice: 1200,
        discountedPrice: 999,
        image: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400',
        available: true,
        calories: 1400
      },
      {
        id: 'combo2',
        name: 'Veg Delight',
        description: 'Paneer Tikka + Dal Makhani + 3 Naan',
        items: ['1', '3', '4'],
        originalPrice: 700,
        discountedPrice: 599,
        image: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400',
        available: true,
        calories: 780
      }
    ];

    try {
      // Try fetching from API first
      let menuFetched = false;
      let comboFetched = false;

      try {
        const menuResult: any = await menuApi.list();
        console.log('Menu API Response:', menuResult);
        
        // Handle both array response and {success, data} format
        const menuData = Array.isArray(menuResult) ? menuResult : (menuResult.data || []);
        console.log('Menu items count:', menuData.length);
        
        // Map _id to id for frontend compatibility
        const availableItems = menuData
          .filter((item: MenuItem) => item.available !== false)
          .map((item: any) => ({
            ...item,
            id: item._id || item.id,
          }));
        setMenuItems(availableItems);
        menuFetched = true;
        console.log('Loaded', availableItems.length, 'menu items from API');
      } catch (menuError) {
        console.error('Menu API error:', menuError);
        console.log('Using mock data');
      }

      try {
        const comboResult: any = await menuApi.listCombos();
        console.log('Combo API Response:', comboResult);
        
        // Handle both array response and {success, data} format
        const comboData = Array.isArray(comboResult) ? comboResult : (comboResult.data || []);
        console.log('Combo count:', comboData.length);
        
        // Map _id to id for frontend compatibility and normalize prices
        const availableCombos = comboData
          .filter((combo: ComboMeal) => combo.available !== false)
          .map((combo: any) => ({
            ...combo,
            id: combo._id || combo.id,
            items: combo.items || [],
            originalPrice: Number(combo.originalPrice) || Number(combo.discountedPrice) || Number(combo.price) || 0,
            discountedPrice: Number(combo.discountedPrice) || Number(combo.price) || Number(combo.originalPrice) || 0,
          }));
        setComboMeals(availableCombos);
        comboFetched = true;
        console.log('Loaded', availableCombos.length, 'combo meals from API');
      } catch (comboError) {
        console.error('Combo API error:', comboError);
        console.log('Using mock combo data');
      }

      // Use mock data if API fetch failed
      if (!menuFetched) {
        console.warn('Using mock menu data (8 items) - API fetch failed or unavailable');
        setMenuItems(mockMenuItems);
      }
      if (!comboFetched) {
        console.warn('Using mock combo data - API fetch failed or unavailable');
        setComboMeals(mockCombos);
      }

      // Feature #7: Menu Sync - Show sync badge
      if (menuFetched && comboFetched) {
        toast.success('✓ Menu synced', { duration: 2000 });
      } else if (menuFetched || comboFetched) {
        toast.info('Partial menu sync - check console for details', { duration: 3000 });
      }

    } catch (error) {
      console.error('Error fetching menu data:', error);
      setMenuItems(mockMenuItems);
      setComboMeals(mockCombos);
      toast.info('Using sample menu data');
    } finally {
      setLoading(false);
    }
  };

  // Feature #8: Load Recent Orders
  const loadRecentOrders = () => {
    // Mock recent orders (would be fetched from API in production)
    const mockRecentOrders: RecentOrder[] = [
      {
        id: 'recent1',
        items: [
          { id: 'r1', name: 'Butter Chicken', quantity: 1, price: 350 },
          { id: 'r2', name: 'Butter Naan', quantity: 3, price: 50 }
        ],
        total: 500,
        timestamp: new Date(Date.now() - 1000 * 60 * 30) // 30 mins ago
      },
      {
        id: 'recent2',
        items: [
          { id: 'r3', name: 'Paneer Tikka', quantity: 2, price: 280 },
          { id: 'r4', name: 'Dal Makhani', quantity: 1, price: 220 }
        ],
        total: 780,
        timestamp: new Date(Date.now() - 1000 * 60 * 60) // 1 hour ago
      }
    ];
    
    setRecentOrders(mockRecentOrders);
  };

  // Fetch available tables from API
  const fetchAvailableTables = async () => {
    setTablesLoading(true);
    try {
      const result = await tablesApi.list();
      const tables: TableData[] = result.data || [];
      // Show both available tables AND occupied tables (for waiters taking orders on their assigned tables)
      // Filter to only show available and occupied tables (not reserved or cleaning)
      const available = tables.filter(t => {
        const status = t.status?.toLowerCase();
        return status === 'available' || status === 'occupied';
      });
      // Sort by location and name
      available.sort((a, b) => {
        if (a.location !== b.location) return a.location.localeCompare(b.location);
        return a.name.localeCompare(b.name);
      });
      setAvailableTables(available);
    } catch (error) {
      console.error('Error fetching tables:', error);
      toast.error('Failed to load tables');
      setAvailableTables([]);
    } finally {
      setTablesLoading(false);
    }
  };

  // ========== ORDER ITEM MANAGEMENT ==========

  // Feature #12: Double Tap to Add
  const handleDoubleTap = (item: MenuItem) => {
    const now = Date.now();
    if (now - lastTap < 300) {
      addItemToOrder(item);
    }
    setLastTap(now);
  };

  // Feature #12: Long Press to Customize
  const handleLongPressStart = (item: MenuItem) => {
    const timer = setTimeout(() => {
      // Open customization dialog
      toast.info(`Customize ${item.name}`, { duration: 2000 });
    }, 500);
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  // Add item to order
  const addItemToOrder = (item: MenuItem) => {
    const existingItem = orderItems.find(
      (oi) => oi.name === item.name && !oi.isCombo
    );

    // Ensure price is a valid number
    const itemPrice = Number(item.price) || 0;
    const itemName = item.name || 'Unknown Item';

    if (existingItem) {
      setOrderItems(
        orderItems.map((oi) =>
          oi.id === existingItem.id
            ? { ...oi, quantity: oi.quantity + 1 }
            : oi
        )
      );
    } else {
      const newItem: QuickOrderItem = {
        id: `${Date.now()}-${Math.random()}`,
        name: itemName,
        quantity: 1,
        price: itemPrice,
        isCombo: false,
        category: item.category,
        cookingStation: item.cookingStation || undefined,
        image: item.image || undefined,
      };
      setOrderItems([...orderItems, newItem]);
    }

    // Feature #10: Smart Notification
    toast.success(`${itemName} added!`, { duration: 1500 });
    
    // Feature #13: Sound Feedback
    playSound('add', soundEnabled);
  };

  // Feature #6: Add combo to order with split select capability
  const addComboToOrder = (combo: ComboMeal) => {
    const comboItemsDetails = (combo.items || []).map(itemId => 
      menuItems.find(mi => mi.id === itemId)
    ).filter(Boolean) as MenuItem[];

    // Ensure price is a valid number - use discountedPrice, fall back to originalPrice or price
    const comboPrice = Number(combo.discountedPrice) || Number(combo.originalPrice) || Number((combo as any).price) || 0;
    const comboName = combo.name || 'Unknown Combo';

    const newCombo: QuickOrderItem = {
      id: `combo-${Date.now()}-${Math.random()}`,
      name: comboName,
      quantity: 1,
      price: comboPrice,
      isCombo: true,
      comboItems: comboItemsDetails,
    };

    setOrderItems([...orderItems, newCombo]);
    
    // Feature #10: Smart Notification
    toast.success(`${comboName} combo added!`, { duration: 1500 });
    
    // Feature #13: Sound Feedback
    playSound('add', soundEnabled);
  };

  // Feature #6: Toggle combo expansion
  const toggleComboExpansion = (comboId: string) => {
    setExpandedCombo(expandedCombo === comboId ? null : comboId);
  };

  // Update item quantity
  const updateItemQuantity = (itemId: string, delta: number) => {
    setOrderItems(
      orderItems
        .map((item) => {
          if (item.id === itemId) {
            const newQuantity = item.quantity + delta;
            return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
    
    // Feature #13: Sound Feedback
    playSound(delta > 0 ? 'add' : 'remove', soundEnabled);
  };

  // Remove item from order
  const removeItemFromOrder = (itemId: string) => {
    setOrderItems(orderItems.filter((item) => item.id !== itemId));
    
    // Feature #10: Smart Notification
    toast.info('Item removed', { duration: 1500 });
    
    // Feature #13: Sound Feedback
    playSound('remove', soundEnabled);
  };

  // Feature #8: Repeat recent order
  const repeatOrder = (order: RecentOrder) => {
    const validatedItems = order.items.map(item => ({
      ...item,
      id: `${Date.now()}-${Math.random()}`,
      name: item.name || 'Unknown Item',
      price: Number(item.price) || 0,
      quantity: Number(item.quantity) || 1
    }));
    
    setOrderItems([...orderItems, ...validatedItems]);
    
    // Feature #10: Smart Notification
    toast.success('Order repeated!', { duration: 2000 });
    
    // Feature #13: Sound Feedback
    playSound('add', soundEnabled);
  };

  // Toggle tag
  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // ========== ORDER STATUS MANAGEMENT ==========

  // Feature #5: Drag gesture handlers
  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    setDragStartX(clientX);
    setIsDragging(true);
  };

  const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    setDragOffset(clientX - dragStartX);
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    
    // Swipe right for next status
    if (dragOffset > 100) {
      moveToNextStatus();
    }
    // Swipe left for cancel
    else if (dragOffset < -100) {
      handleCancelOrder();
    }
    
    setDragOffset(0);
    setIsDragging(false);
  };

  // Feature #4: Move to next status with rollback protection
  const moveToNextStatus = () => {
    const currentIndex = ORDER_STATUSES.indexOf(currentStatus);
    if (currentIndex < ORDER_STATUSES.length - 1) {
      const nextStatus = ORDER_STATUSES[currentIndex + 1];
      
      // Feature #4: Rollback Protection - show confirmation before PREPARING
      if (nextStatus === 'preparing' && currentStatus === 'accepted') {
        setRollbackDialog(true);
      } else {
        updateOrderStatus(nextStatus);
      }
    }
  };

  const updateOrderStatus = (newStatus: OrderTimeline['status']) => {
    setCurrentStatus(newStatus);
    setOrderTimeline(prev => [
      ...prev,
      { status: newStatus, timestamp: new Date() }
    ]);
    
    // Feature #10: Smart Notification
    toast.success(`Order moved to ${newStatus}`, { duration: 2000 });
    
    // Feature #13: Sound Feedback
    playSound('complete', soundEnabled);
  };

  // ========== ORDER CREATION ==========

  // Safely parse numeric values
  const safeNumber = (val: any, fallback: number = 0): number => {
    const num = Number(val);
    return isNaN(num) ? fallback : num;
  };

  // Calculate totals with safe number handling
  const subtotal = orderItems.reduce(
    (sum, item) => sum + (safeNumber(item.price) * safeNumber(item.quantity, 1)),
    0
  );
  const totalItems = orderItems.reduce((sum, item) => sum + safeNumber(item.quantity, 1), 0);

  // Feature #9: Order Flow Restriction - Validation
  const isOrderValid =
    orderItems.length > 0 &&
    (orderType === 'takeaway'
      ? (customerName.trim().length > 0 && customerPhone.trim().length > 0)
      : (orderType === 'dine-in' && !!tableNumber));

  // Step validation
  const isStep1Valid =
    orderType === 'dine-in'
      ? !!tableNumber
      : customerName.trim().length > 0 && customerPhone.trim().length > 0;

  const totalSteps = orderType === 'takeaway' ? 3 : 2;

  const stepLabels: Record<number, string> =
    orderType === 'takeaway'
      ? { 1: 'Customer Details', 2: 'Order Items', 3: 'Payment' }
      : { 1: 'Table Details', 2: 'Order Items' };

  // Reset form
  const resetForm = () => {
    setOrderType('dine-in');
    setTableNumber('');
    setCustomerName('');
    setCustomerPhone('');
    setOrderItems([]);
    setNotes('');
    setTags([]);
    setSearchQuery('');
    setShowSpecialInstructions(false);
    setActiveTab('combos');
    setCurrentStatus('placed');
    setOrderTimeline([{ status: 'placed', timestamp: new Date(), duration: 0 }]);
    setExpandedCombo(null);
    setCurrentStep(1);
  };

  // Cancel order
  const handleCancelOrder = () => {
    resetForm();
    onOpenChange(false);
    toast.info('Order cancelled', { duration: 2000 });
  };

  // Handle inline payment on step 3
  const handlePaymentConfirm = async () => {
    setPaymentProcessing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/billing/process-order-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: createdOrderId, amount: createdOrderTotal, method: paymentMethod }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Payment processed successfully!');
        resetForm();
        onOpenChange(false);
      } else {
        toast.error('Payment failed. Please try again.');
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Payment failed. Please try again.');
    } finally {
      setPaymentProcessing(false);
    }
  };

  // Create or update order
  const handleCreateOrder = async () => {
    // Role check: waiters, admins, managers, and cashiers can create orders
    const authRole = user?.role ?? restaurantState.getRole();
    if (!['waiter', 'admin', 'manager', 'cashier'].includes(authRole)) {
      toast.error('You do not have permission to create orders', {
        description: 'Only waiters, admins, managers, and cashiers can place orders',
        duration: 4000,
      });
      playSound('error', soundEnabled);
      return;
    }

    if (!isOrderValid) {
      toast.error('Please add items and select table (for dine-in)');
      playSound('error', soundEnabled);
      return;
    }

    try {
      const orderData = {
        type: orderType,
        tableNumber: orderType === 'dine-in' ? tableNumber : undefined,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        items: orderItems.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          menuItemId: item.id,
          category: item.category || undefined,
          cookingStation: item.cookingStation || undefined,
        })),
        total: subtotal,
        status: 'placed',
        tags: tags.length > 0 ? tags : undefined,
        notes: notes || undefined,
        waiterId: user?.id || undefined,
        waiterName: user?.name || undefined,
      };

      let result: any;

      if (existingOrderId) {
        // Update the existing order instead of creating a new one
        const cleanId = existingOrderId.replace('order:', '');
        result = await ordersApi.update(cleanId, orderData);
      } else {
        result = await ordersApi.create(orderData);
      }

      // Check if order was created/updated (API returns the order object with _id)
      if (result && (result._id || result.id || result.success)) {
        // Mark table as occupied (walk-in) for dine-in orders (only on new orders)
        if (!existingOrderId && orderType === 'dine-in' && tableNumber) {
          const selectedTable = availableTables.find(t => 
            (t.displayNumber || t.name) === tableNumber
          );
          if (selectedTable) {
            try {
              await tablesApi.updateStatus(selectedTable._id, 'occupied', 2);
            } catch (tableError) {
              console.warn('Failed to update table status:', tableError);
            }
          }
        }

        onOrderCreated();
        playSound('complete', soundEnabled);

        // For takeaway orders go to step 3 (inline payment)
        if (!existingOrderId && orderType === 'takeaway') {
          const orderId = result.id || result._id || '';
          setCreatedOrderId(orderId);
          setCreatedOrderTotal(subtotal);
          setCurrentStep(3);
          toast.success('Takeaway order created! Collect payment.', { duration: 3000 });
        } else {
          toast.success(existingOrderId ? 'Order updated successfully!' : 'Order created successfully!', { duration: 3000 });
          resetForm();
          onOpenChange(false);
        }
      } else {
        throw new Error(result.detail || (existingOrderId ? 'Failed to update order' : 'Failed to create order'));
      }
    } catch (error: any) {
      let errorMsg = existingOrderId ? 'Failed to update order' : 'Failed to create order';
      if (error instanceof Error) {
        errorMsg = error.message;
      } else if (typeof error === 'string') {
        errorMsg = error;
      } else if (error && error.detail) {
        errorMsg = error.detail;
      }
      console.error('Error saving order:', error);
      toast.error(`Order save failed: ${errorMsg}`);
      playSound('error', soundEnabled);
    }
  };

  // ========== FILTERING ==========

  // Filter menu items with Feature #11: Inline Item Search
  const filteredMenuItems = menuItems.filter((item) => {
    const matchesSearch = item.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories
  const categories = [
    'all',
    ...Array.from(new Set(menuItems.map((item) => item.category))),
  ];

  // ========== RENDER ==========

  const stepSubtitles: Record<number, string> =
    orderType === 'takeaway'
      ? { 1: 'Customer & Order Information', 2: 'Menu Selection', 3: 'Payment Collection' }
      : { 1: 'Table & Order Information', 2: 'Menu Selection' };

  const STEP_ICONS = [UtensilsCrossed, ShoppingBag, CheckCircle];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[96vw] max-w-[96vw] sm:max-w-[96vw] h-[92dvh] max-h-[92dvh] p-0 overflow-hidden flex flex-col md:flex-row gap-0 border-0 [&>button]:hidden">

          {/* ===== MOBILE TOP BAR (visible only on small screens) ===== */}
          <div className="md:hidden bg-[#8B5E34] px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex flex-col">
              <span className="text-white font-bold text-sm tracking-wide">QUICK ORDER</span>
              <span className="text-white/70 text-[10px] uppercase tracking-wider">{stepLabels[currentStep]}</span>
            </div>
            {/* Step pills */}
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map(step => (
                <div
                  key={step}
                  className={`rounded-full transition-all ${
                    step === currentStep ? 'w-6 h-2.5 bg-white' : step < currentStep ? 'w-2.5 h-2.5 bg-white/60' : 'w-2.5 h-2.5 bg-white/20'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={handleCancelOrder}
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/10 text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ===== LEFT SIDEBAR (hidden on mobile) ===== */}
          <div className="hidden md:flex w-72 bg-[#8B5E34] flex-col shrink-0">
            {/* Brand */}
            <div className="px-6 py-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-white font-bold text-base leading-tight">QUICK</p>
                  <p className="text-white/80 font-semibold text-sm leading-tight tracking-wide">ORDER</p>
                </div>
              </div>
            </div>

            {/* Step Navigation */}
            <nav className="flex-1 px-4 py-6 space-y-3">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map(step => {
                const isActive = currentStep === step;
                const isDone = currentStep > step;
                const StepIcon = STEP_ICONS[step - 1] ?? CheckCircle;
                return (
                  <div key={step} className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
                    isActive ? 'bg-white shadow-sm' : isDone ? 'bg-white/20' : 'opacity-40'
                  }`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-[#8B5E34]' : isDone ? 'bg-white/40' : 'bg-white/10'
                    }`}>
                      {isDone
                        ? <Check className="h-4 w-4 text-white" />
                        : <StepIcon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-white/80'}`} />
                      }
                    </div>
                    <div>
                      <p className={`text-[10px] font-bold uppercase tracking-widest ${
                        isActive ? 'text-[#8B5E34]/60' : 'text-white/50'
                      }`}>
                        STEP {String(step).padStart(2, '0')}
                      </p>
                      <p className={`text-sm font-semibold ${
                        isActive ? 'text-[#8B5E34]' : 'text-white'
                      }`}>
                        {stepLabels[step]}
                      </p>
                    </div>
                  </div>
                );
              })}
            </nav>

            {/* Discard Entry */}
            <div className="px-4 pb-6">
              <button
                onClick={handleCancelOrder}
                className="flex items-center gap-2 px-4 py-2.5 w-full rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all text-sm font-medium"
              >
                <X className="h-4 w-4" />
                DISCARD ENTRY
              </button>
            </div>
          </div>

          {/* ===== RIGHT CONTENT AREA ===== */}
          <div className="flex-1 flex flex-col bg-white min-w-0 min-h-0">

            {/* Right Header — hidden on mobile (top bar serves this role) */}
            <div className="hidden md:block px-8 py-5 border-b border-gray-100 shrink-0">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl md:text-2xl">
                    <span className="font-light text-gray-700">Quick </span>
                    <span className="font-bold text-[#8B5E34]">Order</span>
                  </h2>
                  <p className="text-[10px] md:text-[11px] text-muted-foreground uppercase tracking-widest mt-0.5 font-medium">
                    {stepSubtitles[currentStep]} — PHASE {currentStep} OF {totalSteps}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:bg-gray-100 rounded-full"
                  >
                    {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:bg-gray-100 rounded-full"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Step Content */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-[#F7F3EE] px-3 py-4 md:px-6 md:py-6">
          {/* STEP 1: Details */}
          {currentStep === 1 && (
            <div className="max-w-4xl mx-auto">
              {/* Order Information Card */}
              <Card className="shadow-md border-2 border-[#8B5E34]/10">
                <CardHeader className="bg-gradient-to-r from-[#F6F2ED] to-white pb-4">
                  <CardTitle className="text-lg flex items-center gap-2 text-[#8B5E34]">
                    <UtensilsCrossed className="h-5 w-5" />
                    Order Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-5">
                  {/* Order Type */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                      Order Type *
                    </Label>
                    <Select
                      value={orderType}
                      onValueChange={(value: 'dine-in' | 'takeaway') =>
                        setOrderType(value)
                      }
                    >
                      <SelectTrigger className="h-12 text-base font-medium border-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dine-in">Dine-In</SelectItem>
                        <SelectItem value="takeaway">Takeaway</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Table Number (conditional) */}
                  {orderType === 'dine-in' && (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                        Select Table *
                      </Label>
                      <Select
                        value={tableNumber}
                        onValueChange={(value) => setTableNumber(value)}
                      >
                        <SelectTrigger className="h-12 text-base font-medium border-2">
                          <SelectValue placeholder={tablesLoading ? "Loading tables..." : "Select a table"} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableTables.length === 0 ? (
                            <SelectItem value="no-tables" disabled>
                              {tablesLoading ? "Loading..." : "No tables available"}
                            </SelectItem>
                          ) : (
                            <>
                              {/* Group tables by location */}
                              {['VIP', 'Main Hall', 'AC Hall'].map(location => {
                                const locationTables = availableTables.filter(t => t.location === location);
                                if (locationTables.length === 0) return null;
                                return (
                                  <div key={location}>
                                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted">
                                      {location}
                                    </div>
                                    {locationTables.map(table => (
                                      <SelectItem key={table._id} value={table.displayNumber || table.name}>
                                        <span className="flex items-center gap-2">
                                          <span className="font-bold">{table.displayNumber || table.name}</span>
                                          <span className="text-muted-foreground text-xs">
                                            ({table.capacity} seats{table.status?.toLowerCase() === 'occupied' ? ', Occupied' : ''})
                                          </span>
                                          {table.status?.toLowerCase() === 'occupied' && table.waiterName && (
                                            <span className="text-xs text-emerald-600">
                                              • {table.waiterName}
                                            </span>
                                          )}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      {availableTables.length === 0 && !tablesLoading && (
                        <p className="text-xs text-amber-600">
                          All tables are currently occupied. Please wait or use takeaway.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Customer Name */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                      Customer Name {orderType === 'takeaway' && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                      placeholder={orderType === 'takeaway' ? 'Required for takeaway' : 'Optional'}
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="h-12 border-2"
                    />
                  </div>

                  {/* Phone Number (required for takeaway) */}
                  {orderType === 'takeaway' && (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                        Phone Number <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        placeholder="e.g. 9876543210"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        inputMode="numeric"
                        className="h-12 border-2"
                      />
                    </div>
                  )}

                  {/* Progressive Disclosure: Special Instructions */}
                  {!showSpecialInstructions ? (
                    <Button
                      variant="outline"
                      onClick={() => setShowSpecialInstructions(true)}
                      className="w-full h-11 gap-2 border-dashed border-2"
                    >
                      <TagIcon className="h-4 w-4" />
                      Add special instructions
                      <ChevronDown className="h-4 w-4 ml-auto" />
                    </Button>
                  ) : (
                    <div className="space-y-4 pt-2 border-t-2 border-dashed">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                          Special Instructions
                        </Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowSpecialInstructions(false);
                            setNotes('');
                            setTags([]);
                          }}
                          className="h-7 text-xs"
                        >
                          <ChevronUp className="h-3 w-3 mr-1" />
                          Hide
                        </Button>
                      </div>

                      {/* Tags */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Tags</Label>
                        <div className="flex flex-wrap gap-2">
                          {QUICK_TAGS.map((tag) => (
                            <Button
                              key={tag}
                              size="sm"
                              variant={tags.includes(tag) ? 'default' : 'outline'}
                              onClick={() => toggleTag(tag)}
                              className="h-8 text-xs"
                            >
                              {tag}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Notes */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Notes</Label>
                        <Textarea
                          placeholder="e.g., No onion, Extra spicy..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={3}
                          className="resize-none border-2"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* STEP 2: Items */}
          {currentStep === 2 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">

              {/* Item Selection Card */}
              <Card className="shadow-md border-2 border-[#8B5E34]/10 flex-1 flex flex-col lg:col-span-7">
                <CardHeader className="bg-gradient-to-r from-[#F6F2ED] to-white pb-4">
                  <CardTitle className="text-lg flex items-center gap-2 text-[#8B5E34]">
                    <ShoppingBag className="h-5 w-5" />
                    Select Items
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 flex-1 flex flex-col overflow-hidden">
                  {/* Tabs: Combos | Individual Items | Recent Orders */}
                  <Tabs
                    value={activeTab}
                    onValueChange={(value) =>
                      setActiveTab(value as 'combos' | 'items' | 'recent')
                    }
                    className="flex-1 flex flex-col"
                  >
                    <TabsList className="grid w-full grid-cols-3 h-12 mb-4">
                      <TabsTrigger value="combos" className="text-sm font-semibold">
                        <Sparkles className="h-4 w-4 mr-2" />
                        Combos
                      </TabsTrigger>
                      <TabsTrigger value="items" className="text-sm font-semibold">
                        <Package2 className="h-4 w-4 mr-2" />
                        Items
                      </TabsTrigger>
                      <TabsTrigger value="recent" className="text-sm font-semibold">
                        <Repeat className="h-4 w-4 mr-2" />
                        Recent
                      </TabsTrigger>
                    </TabsList>

                    {/* Combos Tab */}
                    <TabsContent value="combos" className="flex-1 overflow-hidden mt-0 space-y-2">
                      {/* Task 2: Show Total Combo Count */}
                      {!loading && comboMeals.length > 0 && (
                        <div className="flex items-center text-sm px-1">
                          <span className="text-muted-foreground">
                            <Sparkles className="inline h-4 w-4 mr-1" />
                            <strong className="text-[#8B5E34]">{comboMeals.length}</strong> combo meals available
                          </span>
                        </div>
                      )}
                      
                      {loading ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <div className="animate-spin h-8 w-8 border-4 border-[#8B5E34] border-t-transparent rounded-full mx-auto mb-3"></div>
                            <p className="text-sm text-muted-foreground">Loading combos...</p>
                          </div>
                        </div>
                      ) : comboMeals.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center max-w-sm">
                            <Sparkles className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                            <h3 className="text-lg font-semibold mb-2">No Combos Available</h3>
                            <p className="text-sm text-muted-foreground">
                              Create combo meals in Menu Management
                            </p>
                          </div>
                        </div>
                      ) : (
                        <ScrollArea className="h-[450px] pr-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                            {comboMeals.map((combo) => {
                              const savings = combo.originalPrice - combo.discountedPrice;
                              const discountPercent = Math.round(
                                (savings / combo.originalPrice) * 100
                              );
                              const isExpanded = expandedCombo === combo.id;

                              return (
                                <Card
                                  key={combo.id}
                                  className="cursor-pointer hover:shadow-lg transition-shadow duration-150 border-2 hover:border-[#8B5E34]/50 group active:scale-[0.98]"
                                >
                                  <CardContent className="p-4">
                                    <div className="flex gap-4">
                                      {/* Combo Image */}
                                      <div className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-orange-100 to-amber-100 relative">
                                        <img
                                          src={combo.image}
                                          alt={combo.name}
                                          className="w-full h-full aspect-square object-cover group-hover:scale-110 transition-transform duration-300"
                                        />
                                        {combo.calories && (
                                          <div className="absolute bottom-1 right-1 bg-black/70 text-[#FF7F50] text-xs px-2 py-0.5 rounded">
                                            {combo.calories} cal
                                          </div>
                                        )}
                                      </div>

                                      {/* Combo Info */}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                          <h4 className="font-semibold text-base line-clamp-1">
                                            {combo.name}
                                          </h4>
                                          {discountPercent > 0 && (
                                            <Badge className="bg-green-100 text-green-700 text-xs flex-shrink-0">
                                              {discountPercent}% OFF
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                          {combo.description}
                                        </p>
                                        <div className="flex items-center gap-2">
                                          {combo.originalPrice > combo.discountedPrice && (
                                            <span className="text-xs text-muted-foreground line-through flex items-center">
                                              <IndianRupee className="h-3 w-3" />
                                              {combo.originalPrice}
                                            </span>
                                          )}
                                          <span className="text-lg font-bold text-[#8B5E34] flex items-center">
                                            <IndianRupee className="h-4 w-4" />
                                            {combo.discountedPrice}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Feature #6: Split Select - Expand combo items */}
                                    <div className="mt-3 space-y-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => toggleComboExpansion(combo.id)}
                                        className="w-full text-xs"
                                      >
                                        {isExpanded ? (
                                          <>
                                            <ChevronUp className="h-3 w-3 mr-1" />
                                            Hide Items
                                          </>
                                        ) : (
                                          <>
                                            <ChevronDown className="h-3 w-3 mr-1" />
                                            View Items ({(combo.items || []).length})
                                          </>
                                        )}
                                      </Button>

                                      <AnimatePresence>
                                        {isExpanded && (
                                          <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                          >
                                            <div className="border rounded p-2 space-y-1 text-xs bg-gray-50">
                                              {(combo.items || []).length === 0 ? (
                                                <p className="text-muted-foreground text-center py-1">
                                                  No items linked. Edit combo in Menu Management to add items.
                                                </p>
                                              ) : (
                                                (combo.items || []).map(itemId => {
                                                  const item = menuItems.find(mi => mi.id === itemId);
                                                  return item ? (
                                                    <div key={itemId} className="flex justify-between">
                                                      <span>• {item.name}</span>
                                                      <span className="text-muted-foreground flex items-center">
                                                        <IndianRupee className="h-3 w-3" />
                                                        {item.price}
                                                      </span>
                                                    </div>
                                                  ) : (
                                                    <div key={itemId} className="text-muted-foreground">
                                                      • Item not found (ID: {itemId.slice(0, 8)}...)
                                                    </div>
                                                  );
                                                })
                                              )}
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>

                                      <Button
                                        size="sm"
                                        onClick={() => addComboToOrder(combo)}
                                        className="w-full h-9 gap-2 bg-[#8B5E34] hover:bg-[#8B5E34]/90"
                                      >
                                        <Plus className="h-4 w-4" />
                                        Add Combo
                                      </Button>
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      )}
                    </TabsContent>

                    {/* Individual Items Tab */}
                    <TabsContent value="items" className="flex-1 overflow-hidden mt-0 space-y-4">
                      {/* Feature #11: Inline Item Search */}
                      <div className="space-y-2">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Search dishes..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="pl-9 h-11 border-2"
                            />
                          </div>
                          <Select
                            value={selectedCategory}
                            onValueChange={setSelectedCategory}
                          >
                            <SelectTrigger className="w-full sm:w-[180px] h-11 border-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((category) => (
                                <SelectItem key={category} value={category}>
                                  {category === 'all'
                                    ? 'All Categories'
                                    : category.charAt(0).toUpperCase() + category.slice(1)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* Task 2: Show Total Menu Item Count */}
                        {!loading && (
                          <div className="flex items-center justify-between text-sm px-1">
                            <span className="text-muted-foreground">
                              {filteredMenuItems.length === menuItems.length ? (
                                <>
                                  <Package className="inline h-4 w-4 mr-1" />
                                  <strong className="text-[#8B5E34]">{menuItems.length}</strong> items available
                                </>
                              ) : (
                                <>
                                  Showing <strong className="text-[#8B5E34]">{filteredMenuItems.length}</strong> of{' '}
                                  <strong className="text-[#8B5E34]">{menuItems.length}</strong> items
                                </>
                              )}
                            </span>
                          </div>
                        )}
                      </div>

                      {loading ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <div className="animate-spin h-8 w-8 border-4 border-[#8B5E34] border-t-transparent rounded-full mx-auto mb-3"></div>
                            <p className="text-sm text-muted-foreground">Loading items...</p>
                          </div>
                        </div>
                      ) : filteredMenuItems.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center max-w-sm">
                            <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                            <h3 className="text-lg font-semibold mb-2">No Items Found</h3>
                            <p className="text-sm text-muted-foreground">
                              Try adjusting your search or filters
                            </p>
                          </div>
                        </div>
                      ) : (
                        <ScrollArea className="h-[450px] pr-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                            {filteredMenuItems.map((item) => (
                              <Card
                                key={item.id}
                                className="cursor-pointer hover:shadow-lg transition-shadow duration-150 border-2 hover:border-[#8B5E34]/50 group active:scale-[0.98]"
                                onClick={() => addItemToOrder(item)}
                                onDoubleClick={() => handleDoubleTap(item)}
                                onTouchStart={() => handleLongPressStart(item)}
                                onTouchEnd={handleLongPressEnd}
                                onMouseDown={() => handleLongPressStart(item)}
                                onMouseUp={handleLongPressEnd}
                                onMouseLeave={handleLongPressEnd}
                              >
                                <CardContent className="p-4">
                                  <div className="flex gap-4">
                                    {/* Item Image */}
                                    <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-orange-100 to-amber-100 relative">
                                      <img
                                        src={item.image}
                                        alt={item.name}
                                        className="w-full h-full aspect-square object-cover group-hover:scale-110 transition-transform duration-300"
                                      />
                                      {item.calories && (
                                        <div className="absolute bottom-1 right-1 bg-black/70 text-[#FF7F50] text-xs px-1.5 py-0.5 rounded">
                                          {item.calories} cal
                                        </div>
                                      )}
                                    </div>

                                    {/* Item Info */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-2">
                                        <h4 className="font-semibold text-sm line-clamp-1">
                                          {item.name}
                                        </h4>
                                        {item.dietType && (
                                          <Badge
                                            variant="outline"
                                            className={`text-xs flex-shrink-0 ${
                                              item.dietType === 'veg'
                                                ? 'border-green-500 text-green-700'
                                                : 'border-red-500 text-red-700'
                                            }`}
                                          >
                                            {item.dietType === 'veg' ? 'Veg' : 'Non-Veg'}
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                        {item.description}
                                      </p>
                                      <div className="flex items-center justify-between">
                                        <span className="text-base font-bold text-[#8B5E34] flex items-center">
                                          <IndianRupee className="h-4 w-4" />
                                          {item.price}
                                        </span>
                                        {item.preparationTime && (
                                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {item.preparationTime}m
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </TabsContent>

                    {/* Feature #8: Recent Orders Tab */}
                    <TabsContent value="recent" className="flex-1 overflow-hidden mt-0">
                      {recentOrders.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center max-w-sm">
                            <Repeat className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                            <h3 className="text-lg font-semibold mb-2">No Recent Orders</h3>
                            <p className="text-sm text-muted-foreground">
                              Your recent orders will appear here
                            </p>
                          </div>
                        </div>
                      ) : (
                        <ScrollArea className="h-[400px] pr-4">
                          <div className="space-y-4 pb-4">
                            {recentOrders.map((order) => (
                              <Card
                                key={order.id}
                                className="border-2 hover:border-[#8B5E34]/50 transition-colors"
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-start justify-between mb-3">
                                    <div>
                                      <h4 className="font-semibold text-sm mb-1">
                                        {order.items.length} items
                                      </h4>
                                      <p className="text-xs text-muted-foreground">
                                        {new Date(order.timestamp).toLocaleTimeString()}
                                      </p>
                                    </div>
                                    <span className="text-base font-bold text-[#8B5E34] flex items-center">
                                      <IndianRupee className="h-4 w-4" />
                                      {order.total}
                                    </span>
                                  </div>
                                  
                                  <div className="space-y-1 mb-3">
                                    {order.items.map((item, idx) => (
                                      <div key={idx} className="text-xs text-muted-foreground flex justify-between">
                                        <span>• {item.name} x{item.quantity}</span>
                                        <span className="flex items-center">
                                          <IndianRupee className="h-3 w-3" />
                                          {item.price * item.quantity}
                                        </span>
                                      </div>
                                    ))}
                                  </div>

                                  <Button
                                    size="sm"
                                    onClick={() => repeatOrder(order)}
                                    className="w-full h-9 gap-2 bg-[#8B5E34] hover:bg-[#8B5E34]/90"
                                  >
                                    <Repeat className="h-4 w-4" />
                                    Repeat Order
                                  </Button>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

            {/* RIGHT PANEL: Live Order Preview */}
            <div className="lg:col-span-5 sticky top-0 self-start">
              {/* Order Preview Card */}
              <Card className="shadow-md border-2 border-[#8B5E34]/10 flex flex-col max-h-[calc(92dvh-140px)]">
                <CardHeader className="bg-gradient-to-r from-[#F6F2ED] to-white pb-4">
                  <CardTitle className="text-lg flex items-center justify-between text-[#8B5E34]">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Order Items ({totalItems})
                    </div>
                    <span className="text-base flex items-center font-bold">
                      <IndianRupee className="h-5 w-5" />
                      {subtotal}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 flex-1 min-h-0 flex flex-col overflow-hidden">
                  {orderItems.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center max-w-xs">
                        <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-semibold mb-2">No Items Added</h3>
                        <p className="text-sm text-muted-foreground">
                          Start adding items to create an order
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-y-auto space-y-3 pr-1 max-h-[calc(92dvh-260px)]">
                        {orderItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border"
                          >
                            {/* Item image */}
                            <div className="h-14 w-14 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200">
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center">
                                  <Package className="h-6 w-6 text-gray-400" />
                                </div>
                              )}
                            </div>
                            {/* Item details */}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{item.name}</p>
                              {item.isCombo && (
                                <Badge className="mt-0.5 text-xs" variant="outline">Combo</Badge>
                              )}
                              <p className="text-xs text-muted-foreground mt-0.5 flex items-center">
                                <IndianRupee className="h-3 w-3" />
                                {item.price} × {item.quantity}
                              </p>
                            </div>
                            {/* Qty controls + remove */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <div className="flex items-center gap-0.5 border rounded-lg">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => updateItemQuantity(item.id, -1)}
                                  className="h-7 w-7 p-0"
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="text-sm font-semibold w-6 text-center">
                                  {item.quantity}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => updateItemQuantity(item.id, 1)}
                                  className="h-7 w-7 p-0"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeItemFromOrder(item.id)}
                                className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                </CardContent>
              </Card>
            </div>
            </div>
          )}

          {/* STEP 3: Payment (takeaway only) */}
          {currentStep === 3 && (
            <div className="max-w-4xl mx-auto">
              <Card className="shadow-md border-2 border-[#8B5E34]/10">
                <CardHeader className="bg-gradient-to-r from-[#F6F2ED] to-white pb-4">
                  <CardTitle className="text-lg flex items-center gap-2 text-[#8B5E34]">
                    <CheckCircle className="h-5 w-5" />
                    Collect Payment
                  </CardTitle>
                  <CardDescription>Select payment method and confirm the transaction</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-5">
                  {/* Customer summary */}
                  {(customerName || customerPhone) && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
                      {customerName && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-amber-900">{customerName}</span>
                        </div>
                      )}
                      {customerPhone && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-amber-800">{customerPhone}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Order summary */}
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    {orderItems.map(item => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span>{item.name} × {item.quantity}</span>
                        <span className="flex items-center font-medium">
                          <IndianRupee className="h-3.5 w-3.5" />{(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                    <div className="border-t pt-2 flex justify-between font-bold">
                      <span>Total</span>
                      <span className="flex items-center text-lg text-[#8B5E34]">
                        <IndianRupee className="h-4 w-4" />{createdOrderTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Payment method */}
                  <div className="space-y-3">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                      Payment Method
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      {(['cash', 'card', 'upi', 'wallet'] as const).map(method => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPaymentMethod(method)}
                          className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                            paymentMethod === method
                              ? 'border-[#8B5E34] bg-[#8B5E34]/10 text-[#8B5E34]'
                              : 'border-muted hover:border-[#8B5E34]/40'
                          }`}
                        >
                          {method === 'cash' && 'Cash'}
                          {method === 'card' && 'Card'}
                          {method === 'upi' && 'UPI'}
                          {method === 'wallet' && 'Wallet'}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
            </div>{/* end Step Content scroll area */}

            {/* ===== FOOTER ===== */}
            <div className="shrink-0 bg-white border-t border-gray-100 px-4 py-3 md:px-8 md:py-4">
              <div className="flex items-center justify-between gap-4">
                {/* Left */}
                {currentStep === 1 ? (
                  <Button
                    variant="ghost"
                    onClick={handleCancelOrder}
                    className="text-muted-foreground font-semibold tracking-wide uppercase text-sm"
                  >
                    Dismiss
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() => setCurrentStep(s => s - 1)}
                    className="text-muted-foreground gap-2 font-semibold tracking-wide uppercase text-sm"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                )}

                {/* Centre total (shown on step 2+) */}
                {currentStep >= 2 && (
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Amount</p>
                    <p className="text-xl font-bold text-[#8B5E34] flex items-center justify-center gap-0.5">
                      <IndianRupee className="h-5 w-5" />
                      {subtotal}
                    </p>
                  </div>
                )}

                {/* Right */}
                {currentStep === 1 && (
                  <Button
                    onClick={() => setCurrentStep(2)}
                    disabled={!isStep1Valid}
                    className="bg-[#8B5E34] hover:bg-[#8B5E34]/90 font-semibold tracking-wide gap-2 uppercase text-sm"
                  >
                    Next Phase
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}

                {currentStep === 2 && (
                  <Button
                    onClick={handleCreateOrder}
                    disabled={orderItems.length === 0}
                    className="bg-[#8B5E34] hover:bg-[#8B5E34]/90 font-semibold tracking-wide gap-2 uppercase text-sm"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {existingOrderId ? 'Update Order' : orderType === 'takeaway' ? 'Confirm & Pay' : 'Create Order'}
                  </Button>
                )}

                {currentStep === 3 && (
                  <Button
                    onClick={handlePaymentConfirm}
                    disabled={paymentProcessing}
                    className="bg-[#8B5E34] hover:bg-[#8B5E34]/90 font-semibold tracking-wide gap-2 uppercase text-sm"
                  >
                    {paymentProcessing ? 'Processing...' : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Pay <IndianRupee className="h-4 w-4" />{createdOrderTotal.toFixed(2)}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>{/* end right content area */}
        </DialogContent>
      </Dialog>

      {/* Takeaway Payment — now handled inline in Step 3, dialog kept for fallback only */}
      {takeawayPaymentOpen && (
        <PaymentDialog
          open={takeawayPaymentOpen}
          onOpenChange={(o) => {
            setTakeawayPaymentOpen(o);
            if (!o) { resetForm(); onOpenChange(false); }
          }}
          orderId={createdOrderId}
          amount={createdOrderTotal}
          customerName={customerName}
          customerPhone={customerPhone}
          onSuccess={() => {
            setTakeawayPaymentOpen(false);
            resetForm();
            onOpenChange(false);
          }}
        />
      )}

      {/* Feature #4: Rollback Protection Dialog */}
      <Dialog open={rollbackDialog} onOpenChange={setRollbackDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Status Change</DialogTitle>
            <DialogDescription>
              Moving order to PREPARING. This action will send the order to the kitchen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm">Would you like to:</p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setRollbackDialog(false);
                  // Open edit mode
                  toast.info('Edit order', { duration: 2000 });
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Order
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setRollbackDialog(false);
                  handleCancelOrder();
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel Order
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setRollbackDialog(false)}
            >
              Go Back
            </Button>
            <Button
              onClick={() => {
                updateOrderStatus('preparing');
                setRollbackDialog(false);
              }}
              className="bg-[#8B5E34] hover:bg-[#8B5E34]/90"
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Continue to Preparing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
