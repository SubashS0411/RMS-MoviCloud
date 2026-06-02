import { apiRequest } from "@/client/api/client";
import type { Order } from "@/client/app/App";

export async function createOrder(order: Order, userId?: string, source?: string): Promise<Order> {
  return apiRequest<Order>("/orders", {
    method: "POST",
    body: {
      ...order,
      userId,
      source: source || "client",
    },
  });
}

export async function fetchOrders(userId?: string): Promise<Order[]> {
  const sp = new URLSearchParams();
  if (userId) sp.set("userId", userId);
  const res = await apiRequest<{ orders: Order[] }>(`/orders${sp.toString() ? `?${sp.toString()}` : ""}`);
  return res.orders;
}

export interface ClientInvoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  customerName: string;
  tableNumber?: string | number;
  orderType: string;
  items: { name: string; quantity: number; price: number }[];
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  discountAmount: number;
  grandTotal: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

export async function fetchInvoices(userId?: string): Promise<ClientInvoice[]> {
  const sp = new URLSearchParams();
  if (userId) sp.set("userId", userId);
  const res = await apiRequest<{ invoices: ClientInvoice[] }>(`/invoices${sp.toString() ? `?${sp.toString()}` : ""}`);
  return res.invoices ?? [];
}
