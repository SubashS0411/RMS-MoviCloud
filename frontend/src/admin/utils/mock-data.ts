// Mock data for development without backend
// Set VITE_USE_MOCK_DATA=false in .env when you connect to a real backend
export const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA !== 'false';

export const mockAnalytics = {
  totalOrders: 156,
  completedOrders: 142,
  totalRevenue: 48750.00,
  avgOrderValue: 312.50,
  popularItems: [
    { name: 'Butter Chicken', count: 45 },
    { name: 'Paneer Tikka', count: 38 },
    { name: 'Biryani', count: 35 },
    { name: 'Naan', count: 52 },
    { name: 'Dal Makhani', count: 28 },
  ],
  tableOccupancy: 75,
  activeOrders: 14,
};

export const mockMenuItems = [
  {
    id: 'menu:1',
    name: 'Butter Chicken',
    description: 'Creamy tomato-based curry with tender chicken pieces',
    price: 350,
    category: 'Main Course',
    available: true,
    image: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=300',
  },
  {
    id: 'menu:2',
    name: 'Paneer Tikka',
    description: 'Grilled cottage cheese with spices and vegetables',
    price: 280,
    category: 'Starters',
    available: true,
    image: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=300',
  },
  {
    id: 'menu:3',
    name: 'Chicken Biryani',
    description: 'Aromatic basmati rice with spiced chicken',
    price: 320,
    category: 'Main Course',
    available: true,
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=300',
  },
  {
    id: 'menu:4',
    name: 'Garlic Naan',
    description: 'Soft bread with garlic and butter',
    price: 60,
    category: 'Breads',
    available: true,
    image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=300',
  },
  {
    id: 'menu:5',
    name: 'Dal Makhani',
    description: 'Creamy black lentils slow-cooked overnight',
    price: 220,
    category: 'Main Course',
    available: true,
    image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=300',
  },
  {
    id: 'menu:6',
    name: 'Masala Dosa',
    description: 'Crispy rice crepe with spiced potato filling',
    price: 150,
    category: 'South Indian',
    available: true,
    image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=300',
  },
  {
    id: 'menu:7',
    name: 'Gulab Jamun',
    description: 'Sweet milk dumplings in rose syrup',
    price: 120,
    category: 'Desserts',
    available: true,
    image: 'https://images.unsplash.com/photo-1666190053276-45a6f8c32fb3?w=300',
  },
  {
    id: 'menu:8',
    name: 'Mango Lassi',
    description: 'Refreshing yogurt drink with mango',
    price: 90,
    category: 'Beverages',
    available: true,
    image: 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=300',
  },
];

export const mockOrders = [
  {
    id: 'order:1',
    tableNumber: 5,
    customerName: 'Aman Deep',
    items: [
      { menuItemId: 'menu:1', name: 'Butter Chicken', quantity: 2, price: 350 },
      { menuItemId: 'menu:4', name: 'Garlic Naan', quantity: 4, price: 60 },
    ],
    status: 'preparing',
    type: 'dine-in',
    total: 940,
    createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
    notes: 'Less spicy',
  },
  {
    id: 'order:2',
    tableNumber: 3,
    customerName: 'Sneha Gupta',
    items: [
      { menuItemId: 'menu:3', name: 'Chicken Biryani', quantity: 1, price: 320 },
      { menuItemId: 'menu:8', name: 'Mango Lassi', quantity: 2, price: 90 },
    ],
    status: 'pending',
    type: 'dine-in',
    total: 500,
    createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
    notes: '',
  },
  {
    id: 'order:3',
    tableNumber: 8,
    customerName: 'Vikram Singh',
    items: [
      { menuItemId: 'menu:2', name: 'Paneer Tikka', quantity: 1, price: 280 },
      { menuItemId: 'menu:5', name: 'Dal Makhani', quantity: 1, price: 220 },
      { menuItemId: 'menu:4', name: 'Garlic Naan', quantity: 2, price: 60 },
    ],
    status: 'ready',
    type: 'takeaway',
    total: 620,
    createdAt: new Date(Date.now() - 25 * 60000).toISOString(),
    notes: 'Extra butter in naan',
  },
  {
    id: 'order:4',
    tableNumber: 12,
    customerName: 'Priya Sharma',
    items: [
      { menuItemId: 'menu:6', name: 'Masala Dosa', quantity: 2, price: 150 },
      { menuItemId: 'menu:7', name: 'Gulab Jamun', quantity: 2, price: 120 },
    ],
    status: 'completed',
    type: 'dine-in',
    total: 540,
    createdAt: new Date(Date.now() - 45 * 60000).toISOString(),
    notes: '',
  },
];

export const mockStaff = [
  {
    id: 'staff:1',
    name: 'Rahul Sharma',
    role: 'chef',
    email: 'rahul@restaurant.com',
    phone: '+91 9876543210',
    salary: 45000,
    status: 'active',
  },
  {
    id: 'staff:2',
    name: 'Priya Patel',
    role: 'waiter',
    email: 'priya@restaurant.com',
    phone: '+91 9876543211',
    salary: 25000,
    status: 'active',
  },
  {
    id: 'staff:3',
    name: 'Amit Kumar',
    role: 'manager',
    email: 'amit@restaurant.com',
    phone: '+91 9876543212',
    salary: 55000,
    status: 'active',
  },
  {
    id: 'staff:4',
    name: 'Sneha Reddy',
    role: 'cashier',
    email: 'sneha@restaurant.com',
    phone: '+91 9876543213',
    salary: 28000,
    status: 'active',
  },
];

export const mockTables = [
  { id: 'table:1', number: 1, capacity: 2, status: 'available' },
  { id: 'table:2', number: 2, capacity: 2, status: 'occupied' },
  { id: 'table:3', number: 3, capacity: 4, status: 'occupied' },
  { id: 'table:4', number: 4, capacity: 4, status: 'available' },
  { id: 'table:5', number: 5, capacity: 4, status: 'occupied' },
  { id: 'table:6', number: 6, capacity: 6, status: 'reserved' },
  { id: 'table:7', number: 7, capacity: 6, status: 'available' },
  { id: 'table:8', number: 8, capacity: 4, status: 'occupied' },
  { id: 'table:9', number: 9, capacity: 8, status: 'available' },
  { id: 'table:10', number: 10, capacity: 8, status: 'reserved' },
];

export const mockCombos = [
  {
    id: 'combo:1',
    name: 'Family Feast',
    items: ['menu:1', 'menu:3', 'menu:4', 'menu:5'],
    discountedPrice: 899,
    originalPrice: 1050,
    available: true,
  },
  {
    id: 'combo:2',
    name: 'Lunch Special',
    items: ['menu:6', 'menu:8'],
    discountedPrice: 199,
    originalPrice: 240,
    available: true,
  },
];

export const mockInventory = [
  { id: 'inv:1', name: 'Chicken', quantity: 25, unit: 'kg', reorderLevel: 10, category: 'Meat' },
  { id: 'inv:2', name: 'Basmati Rice', quantity: 50, unit: 'kg', reorderLevel: 20, category: 'Grains' },
  { id: 'inv:3', name: 'Paneer', quantity: 15, unit: 'kg', reorderLevel: 5, category: 'Dairy' },
  { id: 'inv:4', name: 'Onions', quantity: 30, unit: 'kg', reorderLevel: 15, category: 'Vegetables' },
  { id: 'inv:5', name: 'Tomatoes', quantity: 20, unit: 'kg', reorderLevel: 10, category: 'Vegetables' },
  { id: 'inv:6', name: 'Cooking Oil', quantity: 40, unit: 'liters', reorderLevel: 15, category: 'Oils' },
  { id: 'inv:7', name: 'Flour', quantity: 35, unit: 'kg', reorderLevel: 10, category: 'Grains' },
  { id: 'inv:8', name: 'Butter', quantity: 8, unit: 'kg', reorderLevel: 3, category: 'Dairy' },
];
