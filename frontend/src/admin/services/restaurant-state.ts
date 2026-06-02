/**
 * Restaurant State Management Service
 * Provides centralized state management for Table-Order-Waiter integration
 */

export type UserRole = 'admin' | 'waiter';

export type TableStatus = 'Available' | 'Reserved' | 'Occupied' | 'Eating' | 'Cleaning';
export type OrderStatus = 'created' | 'accepted' | 'cooking' | 'ready' | 'served' | 'completed' | 'cancelled';

export interface RestaurantOrder {
  id: string;
  tableId: string;
  tableNumber: string;
  waiterId: string;
  waiterName: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface TableAssignment {
  tableId: string;
  waiterId: string;
  waiterName: string;
  status: TableStatus;
}

// Event types for cross-module communication
export type RestaurantEvent = 
  | { type: 'ORDER_CREATED'; payload: RestaurantOrder }
  | { type: 'ORDER_STATUS_CHANGED'; payload: { orderId: string; status: OrderStatus } }
  | { type: 'TABLE_STATUS_CHANGED'; payload: { tableId: string; status: TableStatus } }
  | { type: 'WAITER_ASSIGNED'; payload: TableAssignment }
  | { type: 'CHECKOUT_COMPLETED'; payload: { tableId: string; orderId: string } }
  | { type: 'TABLE_CLEANED'; payload: { tableId: string } };

class RestaurantStateManager {
  private listeners: Array<(event: RestaurantEvent) => void> = [];
  private currentRole: UserRole = 'admin';
  private currentWaiterId: string | null = null;
  private orders: Map<string, RestaurantOrder> = new Map();
  private tableAssignments: Map<string, TableAssignment> = new Map();

  // Role Management
  setRole(role: UserRole, waiterId?: string) {
    this.currentRole = role;
    this.currentWaiterId = waiterId || null;
    localStorage.setItem('restaurant_role', role);
    if (waiterId) {
      localStorage.setItem('restaurant_waiter_id', waiterId);
    } else {
      localStorage.removeItem('restaurant_waiter_id');
    }
  }

  getRole(): UserRole {
    const stored = localStorage.getItem('restaurant_role');
    return (stored as UserRole) || this.currentRole;
  }

  getCurrentWaiterId(): string | null {
    const stored = localStorage.getItem('restaurant_waiter_id');
    return stored || this.currentWaiterId;
  }

  // Permission Checks
  canCleanTable(): boolean {
    return this.getRole() === 'admin';
  }

  canCreateOrder(tableWaiterId: string): boolean {
    const role = this.getRole();
    // Admins can create any order, waiters can only create for their assigned tables
    if (role === 'admin') {
      return true;
    }
    if (role === 'waiter') {
      const currentWaiterId = this.getCurrentWaiterId();
      return currentWaiterId === tableWaiterId;
    }
    return false;
  }

  canAcceptOrder(orderWaiterId: string): boolean {
    const role = this.getRole();
    // Admins can accept any order, waiters can only accept their own
    if (role === 'admin') {
      return true;
    }
    if (role === 'waiter') {
      const currentWaiterId = this.getCurrentWaiterId();
      return currentWaiterId === orderWaiterId;
    }
    return false;
  }

  canSendToCooking(orderWaiterId: string): boolean {
    const role = this.getRole();
    // Admins can send any order to cooking, waiters can only send their own
    if (role === 'admin') {
      return true;
    }
    if (role === 'waiter') {
      const currentWaiterId = this.getCurrentWaiterId();
      return currentWaiterId === orderWaiterId;
    }
    return false;
  }

  canMarkReady(orderWaiterId: string): boolean {
    const role = this.getRole();
    // Admins can mark any order as ready, waiters can only mark their own
    if (role === 'admin') {
      return true;
    }
    if (role === 'waiter') {
      const currentWaiterId = this.getCurrentWaiterId();
      return currentWaiterId === orderWaiterId;
    }
    return false;
  }

  canServeOrder(orderWaiterId: string): boolean {
    const role = this.getRole();
    // Admins can serve any order, waiters can only serve their own
    if (role === 'admin') {
      return true;
    }
    if (role === 'waiter') {
      const currentWaiterId = this.getCurrentWaiterId();
      return currentWaiterId === orderWaiterId;
    }
    return false;
  }

  canCheckout(): boolean {
    // ONLY admin can perform checkout
    return this.getRole() === 'admin';
  }

  // Order Management
  createOrder(order: RestaurantOrder) {
    this.orders.set(order.id, order);
    this.saveOrders();
    this.emit({ type: 'ORDER_CREATED', payload: order });
  }

  updateOrderStatus(orderId: string, status: OrderStatus) {
    const order = this.orders.get(orderId);
    if (order) {
      order.status = status;
      order.updatedAt = new Date().toISOString();
      this.orders.set(orderId, order);
      this.saveOrders();
      this.emit({ type: 'ORDER_STATUS_CHANGED', payload: { orderId, status } });
    }
  }

  getOrder(orderId: string): RestaurantOrder | undefined {
    return this.orders.get(orderId);
  }

  getOrderForTable(tableId: string): RestaurantOrder | undefined {
    return Array.from(this.orders.values()).find(
      order => order.tableId === tableId && order.status !== 'completed' && order.status !== 'cancelled'
    );
  }

  getAllOrders(): RestaurantOrder[] {
    return Array.from(this.orders.values());
  }

  completeOrder(orderId: string) {
    this.updateOrderStatus(orderId, 'completed');
  }

  // Table Management
  assignWaiterToTable(assignment: TableAssignment) {
    this.tableAssignments.set(assignment.tableId, assignment);
    this.saveTableAssignments();
    this.emit({ type: 'WAITER_ASSIGNED', payload: assignment });
  }

  getTableAssignment(tableId: string): TableAssignment | undefined {
    return this.tableAssignments.get(tableId);
  }

  updateTableStatus(tableId: string, status: TableStatus) {
    const assignment = this.tableAssignments.get(tableId);
    if (assignment) {
      assignment.status = status;
      this.tableAssignments.set(tableId, assignment);
      this.saveTableAssignments();
    }
    this.emit({ type: 'TABLE_STATUS_CHANGED', payload: { tableId, status } });
  }

  clearTableAssignment(tableId: string) {
    this.tableAssignments.delete(tableId);
    this.saveTableAssignments();
    this.emit({ type: 'TABLE_CLEANED', payload: { tableId } });
  }

  // Checkout Process
  processCheckout(tableId: string, orderId: string) {
    // Mark order as completed
    this.completeOrder(orderId);
    
    // Emit checkout event
    this.emit({ type: 'CHECKOUT_COMPLETED', payload: { tableId, orderId } });
  }

  // Event System
  subscribe(listener: (event: RestaurantEvent) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private emit(event: RestaurantEvent) {
    this.listeners.forEach(listener => listener(event));
  }

  // Persistence
  private saveOrders() {
    const ordersArray = Array.from(this.orders.entries());
    localStorage.setItem('restaurant_orders', JSON.stringify(ordersArray));
  }

  private saveTableAssignments() {
    const assignmentsArray = Array.from(this.tableAssignments.entries());
    localStorage.setItem('restaurant_table_assignments', JSON.stringify(assignmentsArray));
  }

  loadFromStorage() {
    // Load orders
    try {
      const ordersData = localStorage.getItem('restaurant_orders');
      if (ordersData) {
        const ordersArray = JSON.parse(ordersData);
        this.orders = new Map(ordersArray);
      }
    } catch (e) {
      console.error('Failed to load orders:', e);
    }

    // Load table assignments
    try {
      const assignmentsData = localStorage.getItem('restaurant_table_assignments');
      if (assignmentsData) {
        const assignmentsArray = JSON.parse(assignmentsData);
        this.tableAssignments = new Map(assignmentsArray);
      }
    } catch (e) {
      console.error('Failed to load table assignments:', e);
    }

    // Load role
    const role = localStorage.getItem('restaurant_role');
    if (role) {
      this.currentRole = role as UserRole;
    }

    const waiterId = localStorage.getItem('restaurant_waiter_id');
    if (waiterId) {
      this.currentWaiterId = waiterId;
    }
  }

  // Clear all data (for testing/reset)
  clearAll() {
    this.orders.clear();
    this.tableAssignments.clear();
    localStorage.removeItem('restaurant_orders');
    localStorage.removeItem('restaurant_table_assignments');
  }
}

// Singleton instance
export const restaurantState = new RestaurantStateManager();

// Initialize on load
if (typeof window !== 'undefined') {
  restaurantState.loadFromStorage();
}