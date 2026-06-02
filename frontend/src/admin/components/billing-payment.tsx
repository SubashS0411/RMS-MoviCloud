import { useState, useEffect } from 'react';
import { LoadingBilling } from '@/admin/components/ui/loading-spinner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/admin/components/ui/card';
import { Button } from '@/admin/components/ui/button';
import { Input } from '@/admin/components/ui/input';
import { Label } from '@/admin/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/admin/components/ui/tabs';
import { Badge } from '@/admin/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/admin/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/admin/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/admin/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/admin/components/ui/radio-group';
import { Separator } from '@/admin/components/ui/separator';
import { ScrollArea } from '@/admin/components/ui/scroll-area';
import { 
  CreditCard, 
  Wallet, 
  Smartphone, 
  Banknote, 
  Receipt, 
  Download, 
  Printer,
  Plus,
  Minus,
  Search,
  RefreshCcw,
  CheckCircle,
  XCircle,
  Clock,
  IndianRupee,
  Calendar,
  User,
  Percent,
  Calculator,
} from 'lucide-react';
import { toast } from 'sonner';
import { ordersApi, billingApi, systemConfigApi } from '@/admin/utils/api';
import { useAuth } from '@/admin/utils/auth-context';

interface Order {
  id: string;
  table_number: number;
  customer_name: string;
  order_type: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  total: number;
  status: string;
  source?: string;        // 'client' = placed by customer; absent/other = admin/staff
  orderNumber?: string;
  billingId?: string;     // For linking to billing entry
  paymentStatus?: string; // 'paid' | 'unpaid' | 'pending'
}

interface BillItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  table_number: number;
  items: BillItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_type: 'flat' | 'percentage';
  discount_value: number;
  discount_amount: number;
  grand_total: number;
  payment_mode: string;
  status: string;
  created_at: string;
  generated_by: string;  // who released the bill
  source: string;        // 'admin' | 'client'
}

export function BillingPayment() {
  const { user: authUser } = useAuth();
  const [activeTab, setActiveTab] = useState('generate');
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [taxRate, setTaxRate] = useState(5);
  const [discountType, setDiscountType] = useState<'flat' | 'percentage'>('percentage');
  const [discountValue, setDiscountValue] = useState(0);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sysConfig, setSysConfig] = useState({ restaurantName: 'Restaurant Management System', logoUrl: '/favicon.png' });

  useEffect(() => {
    Promise.all([fetchOrders(), fetchInvoices()]).finally(() => setLoading(false));
    systemConfigApi.get().then((data: any) => {
      if (data) setSysConfig({
        restaurantName: data.restaurantName || 'Restaurant Management System',
        logoUrl: data.logoUrl || '/favicon.png',
      });
    }).catch(() => {});
    const interval = setInterval(fetchOrders, 10000); // auto-refresh every 10s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const total = billItems.reduce((sum, item) => sum + item.total, 0);
    setSubtotal(total);
  }, [billItems]);

  const normalizeOrder = (o: any): Order => ({
    id: o._id || o.id,
    table_number: o.tableNumber || o.table_number || 0,
    customer_name: o.customerName || o.customer_name || 'Guest',
    order_type: o.type || o.order_type || 'dine-in',
    items: (o.items || []).map((item: any) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    })),
    total: o.total || o.totalAmount || 0,
    status: o.status,
    source: o.source,
    paymentStatus: o.paymentStatus,
  });

  const fetchOrders = async () => {
    try {
      // Fetch served and bill_requested orders from the real backend in parallel
      const [servedRes, billRes] = await Promise.all([
        ordersApi.list({ status: 'served' }),
        ordersApi.list({ status: 'bill_requested' }),
      ]);

      const extract = (res: any): any[] =>
        Array.isArray(res) ? res : (res?.data ?? []);

      const combined = [...extract(servedRes), ...extract(billRes)];

      // Deduplicate by id
      const seen = new Set<string>();
      const unique = combined.filter(o => {
        const id = o._id || o.id;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });

      // Exclude orders placed by the customer via the client app or kiosk (auto-invoiced)
      const adminOnly = unique.filter((o: any) => o.source !== 'client' && o.source !== 'kiosk');

      // Exclude orders that are already paid (they should only appear in Invoices tab)
      const unpaidOnly = adminOnly.filter((o: any) => o.paymentStatus !== 'paid');

      // Exclude takeaway orders (they are paid immediately via Quick Order POS and appear only in Invoices)
      const dineInOnly = unpaidOnly.filter((o: any) => {
        const orderType = o.type || o.orderType || o.order_type || '';
        return orderType.toLowerCase() !== 'takeaway';
      });

      // bill_requested first, then served
      dineInOnly.sort((a: any, b: any) => {
        if (a.status === 'bill_requested' && b.status !== 'bill_requested') return -1;
        if (a.status !== 'bill_requested' && b.status === 'bill_requested') return 1;
        return 0;
      });

      setOrders(dineInOnly.map(normalizeOrder));
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders');
    }
  };

  const fetchInvoices = async () => {
    try {
      const res = await billingApi.listInvoices();
      const raw: any[] = Array.isArray(res) ? res : [];
      const normalized: Invoice[] = raw.map((inv: any) => ({
        id: inv._id || inv.id,
        invoice_number: inv.invoiceNumber || inv.invoice_number || inv.id,
        customer_name: inv.customerName || inv.customer_name || 'Guest',
        table_number: inv.tableNumber || inv.table_number || 0,
        items: (inv.items || []).map((item: any, idx: number) => ({
          id: item.id || `item-${idx}`,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.quantity * item.price,
        })),
        subtotal: inv.subtotal || 0,
        tax_rate: inv.taxPercent ?? inv.tax_rate ?? 5,
        tax_amount: inv.taxAmount ?? inv.tax_amount ?? 0,
        discount_type: inv.discountType || inv.discount_type || 'flat',
        discount_value: inv.discountValue ?? inv.discount_value ?? 0,
        discount_amount: inv.discountAmount ?? inv.discount_amount ?? 0,
        grand_total: inv.grandTotal || inv.grand_total || 0,
        payment_mode: inv.paymentMethod || inv.payment_mode || 'cash',
        status: inv.status || 'paid',
        created_at: inv.createdAt || inv.created_at || new Date().toISOString(),
        generated_by: inv.generatedBy || inv.generated_by || (inv.source === 'client' ? 'Customer (online)' : 'Admin'),
        source: inv.source || 'admin',
      }));
      setInvoices(normalized);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    }
  };

  const loadOrderIntoBill = (order: Order) => {
    setSelectedOrder(order);
    const items: BillItem[] = (order.items || []).map((item, idx) => ({
      id: `item-${idx}`,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      total: item.quantity * item.price,
    }));
    setBillItems(items);
    const label = order.order_type === 'takeaway'
      ? `Takeaway – ${order.customer_name}`
      : `Table ${order.table_number} – ${order.customer_name}`;
    toast.success(`Order loaded: ${label}`);
  };

  const updateItemQuantity = (itemId: string, delta: number) => {
    setBillItems(items =>
      items.map(item => {
        if (item.id === itemId) {
          const newQuantity = Math.max(0, item.quantity + delta);
          return {
            ...item,
            quantity: newQuantity,
            total: newQuantity * item.price,
          };
        }
        return item;
      }).filter(item => item.quantity > 0)
    );
  };

  const removeItem = (itemId: string) => {
    setBillItems(items => items.filter(item => item.id !== itemId));
  };

  const calculateTotals = () => {
    const taxAmount = (subtotal * taxRate) / 100;
    let discountAmount = 0;
    
    if (discountType === 'flat') {
      discountAmount = discountValue;
    } else {
      discountAmount = (subtotal * discountValue) / 100;
    }

    const grandTotal = subtotal + taxAmount - discountAmount;
    
    return {
      subtotal,
      taxAmount,
      discountAmount,
      grandTotal: Math.max(0, grandTotal),
    };
  };

  const generateInvoice = async () => {
    if (billItems.length === 0) {
      toast.error('Please add items to the bill');
      return;
    }
    
    // Prevent generating invoice for takeaway orders (they are paid via Quick Order POS)
    if (selectedOrder?.order_type === 'takeaway') {
      toast.error('Takeaway orders should be paid via Quick Order POS, not through bill generation.');
      return;
    }
    
    // Prevent generating invoice for already-paid orders (e.g., takeaway with payment already done)
    if (selectedOrder?.paymentStatus === 'paid') {
      toast.error('This order has already been paid. Check the Invoices tab.');
      return;
    }
    
    setIsGenerating(true);

    const totals = calculateTotals();

    const invoicePayload = {
      orderId: selectedOrder?.id,
      tableNumber: selectedOrder?.table_number,
      customerName: selectedOrder?.customer_name || 'Walk-in Customer',
      items: billItems.map(item => ({ name: item.name, quantity: item.quantity, price: item.price })),
      subtotal: totals.subtotal,
      taxPercent: taxRate,
      taxAmount: totals.taxAmount,
      discountType,
      discountValue,
      discountAmount: totals.discountAmount,
      grandTotal: totals.grandTotal,
      paymentMethod: paymentMode,
      status: 'paid',
      source: 'admin',
      generatedBy: authUser?.name || authUser?.email || 'Admin',
    };

    try {
      // Persist invoice to backend
      const created = await billingApi.createInvoice(invoicePayload);
      const invoiceNumber = created?.invoiceNumber || `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(4, '0')}`;

      // Mark order as completed in backend
      if (selectedOrder?.id) {
        try {
          await ordersApi.updateStatus(selectedOrder.id, 'completed', false);
        } catch (e) {
          console.warn('Could not mark order as completed:', e);
        }
      }

      const invoice: Invoice = {
        id: created?._id || created?.id || Date.now().toString(),
        invoice_number: invoiceNumber,
        customer_name: selectedOrder?.customer_name || 'Walk-in Customer',
        table_number: selectedOrder?.table_number || 0,
        items: billItems,
        subtotal: totals.subtotal,
        tax_rate: taxRate,
        tax_amount: totals.taxAmount,
        discount_type: discountType,
        discount_value: discountValue,
        discount_amount: totals.discountAmount,
        grand_total: totals.grandTotal,
        payment_mode: paymentMode,
        status: 'paid',
        created_at: created?.createdAt || new Date().toISOString(),
        generated_by: authUser?.name || authUser?.email || 'Admin',
        source: 'admin',
      };

      setInvoices(prev => [invoice, ...prev]);
      setPreviewInvoice(invoice);
      setShowInvoicePreview(true);

      // Remove the order from the list since it's now billed
      setOrders(prev => prev.filter(o => o.id !== selectedOrder?.id));
      setBillItems([]);
      setSelectedOrder(null);
      setDiscountValue(0);

      toast.success(`Invoice ${invoiceNumber} generated successfully!`);
    } catch (error) {
      console.error('Failed to generate invoice:', error);
      toast.error('Failed to save invoice. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const loadImageAsBase64 = (url: string): Promise<string | null> =>
    new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(null); return; }
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });

  const downloadInvoice = async (invoice: Invoice) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Logo
    let yOff = 0;
    const imgData = await loadImageAsBase64(sysConfig.logoUrl);
    if (imgData) {
      const logoSize = 18;
      doc.addImage(imgData, 'PNG', pageWidth / 2 - logoSize / 2, 6, logoSize, logoSize);
      yOff = 20;
    }

    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(sysConfig.restaurantName, pageWidth / 2, 20 + yOff, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Movicloud Labs', pageWidth / 2, 27 + yOff, { align: 'center' });
    
    // Invoice details
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Invoice: ${invoice.invoice_number}`, pageWidth / 2, 38 + yOff, { align: 'center' });
    
    // Separator line
    doc.setLineWidth(0.5);
    doc.line(14, 42 + yOff, pageWidth - 14, 42 + yOff);
    
    // Customer & Invoice info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const infoStartY = 50 + yOff;
    
    doc.text(`Customer: ${invoice.customer_name}`, 14, infoStartY);
    doc.text(`${invoice.table_number ? `Table: ${invoice.table_number}` : 'Takeaway'}`, 14, infoStartY + 6);
    doc.text(`Date: ${new Date(invoice.created_at).toLocaleString()}`, pageWidth - 14, infoStartY, { align: 'right' });
    doc.text(`Payment: ${invoice.payment_mode.toUpperCase()}`, pageWidth - 14, infoStartY + 6, { align: 'right' });
    
    // Items table
    const tableData = (invoice.items || []).map(item => [
      item.name,
      item.quantity.toString(),
      `Rs.${item.price.toFixed(2)}`,
      `Rs.${item.total.toFixed(2)}`
    ]);
    
    autoTable(doc, {
      startY: infoStartY + 15,
      head: [['Item', 'Qty', 'Price', 'Total']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [51, 51, 51], textColor: 255 },
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 35, halign: 'right' },
        3: { cellWidth: 35, halign: 'right' }
      }
    });
    
    // Get the Y position after the table
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    // Totals section
    const totalsX = pageWidth - 14;
    doc.setFont('helvetica', 'normal');
    doc.text(`Subtotal:`, totalsX - 50, finalY);
    doc.text(`Rs.${invoice.subtotal.toFixed(2)}`, totalsX, finalY, { align: 'right' });
    
    doc.text(`GST (${invoice.tax_rate}%):`, totalsX - 50, finalY + 6);
    doc.text(`Rs.${invoice.tax_amount.toFixed(2)}`, totalsX, finalY + 6, { align: 'right' });
    
    let currentY = finalY + 12;
    if (invoice.discount_amount > 0) {
      doc.setTextColor(0, 128, 0);
      doc.text(`Discount:`, totalsX - 50, currentY);
      doc.text(`-Rs.${invoice.discount_amount.toFixed(2)}`, totalsX, currentY, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      currentY += 6;
    }
    
    // Separator line before grand total
    doc.setLineWidth(0.3);
    doc.line(pageWidth - 100, currentY + 2, pageWidth - 14, currentY + 2);
    
    // Grand total
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Grand Total:`, totalsX - 50, currentY + 10);
    doc.text(`Rs.${invoice.grand_total.toFixed(2)}`, totalsX, currentY + 10, { align: 'right' });
    
    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);
    doc.text('Thank you for dining with us!', pageWidth / 2, currentY + 25, { align: 'center' });
    doc.text('This is a computer generated invoice.', pageWidth / 2, currentY + 30, { align: 'center' });
    
    // Save the PDF
    doc.save(`${invoice.invoice_number}.pdf`);
    toast.success(`Invoice ${invoice.invoice_number} downloaded as PDF`);
  };

  const printInvoice = (invoice: Invoice) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print invoice');
      return;
    }
    
    const itemRows = (invoice.items || []).map(item => `
      <tr>
        <td class="inv-cell">${item.name}</td>
        <td class="inv-cell inv-cell-center">${item.quantity}</td>
        <td class="inv-cell inv-cell-right">₹${item.price.toFixed(2)}</td>
        <td class="inv-cell inv-cell-right">₹${item.total.toFixed(2)}</td>
      </tr>
    `).join('');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${invoice.invoice_number}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
          .header h1 { margin: 0; font-size: 24px; }
          .header p { margin: 5px 0; color: #666; }
          .invoice-id { font-weight: bold; margin-top: 10px; }
          .logo { max-height: 64px; margin-bottom: 8px; }
          .info { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .info div { font-size: 14px; }
          .info-right { text-align: right; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background: #333; color: white; padding: 10px; text-align: left; }
          .th-center { text-align: center; }
          .th-right { text-align: right; }
          .inv-cell { padding: 8px; border-bottom: 1px solid #ddd; }
          .inv-cell-center { text-align: center; }
          .inv-cell-right { text-align: right; }
          .totals { text-align: right; }
          .totals div { margin: 5px 0; }
          .grand-total { font-size: 18px; font-weight: bold; border-top: 2px solid #333; padding-top: 10px; margin-top: 10px; }
          .discount { color: green; }
          .footer { text-align: center; margin-top: 30px; color: #888; font-size: 12px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          ${sysConfig.logoUrl ? `<img src="${sysConfig.logoUrl}" class="logo" alt="Logo" />` : ''}
          <h1>${sysConfig.restaurantName}</h1>
          <p>Movicloud Labs</p>
          <p class="invoice-id">Invoice: ${invoice.invoice_number}</p>
        </div>
        
        <div class="info">
          <div>
            <p><strong>Customer:</strong> ${invoice.customer_name}</p>
            <p><strong>${invoice.table_number ? `Table: ${invoice.table_number}` : 'Takeaway'}</strong></p>
          </div>
          <div class="info-right">
            <p><strong>Date:</strong> ${new Date(invoice.created_at).toLocaleString()}</p>
            <p><strong>Payment:</strong> ${invoice.payment_mode.toUpperCase()}</p>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th class="th-center">Qty</th>
              <th class="th-right">Price</th>
              <th class="th-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>
        
        <div class="totals">
          <div>Subtotal: ₹${invoice.subtotal.toFixed(2)}</div>
          <div>GST (${invoice.tax_rate}%): ₹${invoice.tax_amount.toFixed(2)}</div>
          ${invoice.discount_amount > 0 ? `<div class="discount">Discount: -₹${invoice.discount_amount.toFixed(2)}</div>` : ''}
          <div class="grand-total">Grand Total: ₹${invoice.grand_total.toFixed(2)}</div>
        </div>
        
        <div class="footer">
          <p>Thank you for dining with us!</p>
          <p>This is a computer generated invoice.</p>
        </div>
        
        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
    toast.success(`Invoice ${invoice.invoice_number} sent to printer`);
  };

  const totals = calculateTotals();

  if (loading) return <LoadingBilling />;

  return (
    <div className="min-h-screen bg-[#f8f8f8] space-y-4 sm:space-y-5 px-4 py-4 sm:px-6 sm:py-5 max-w-full overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button onClick={fetchOrders} size="sm" className="font-semibold shadow-sm bg-white text-[#8B5A2B] border border-[#e7ded4] hover:bg-gray-50">
          <RefreshCcw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 sm:w-[500px] bg-white border border-[#e7ded4] p-1 rounded-xl shadow-sm">
          <TabsTrigger value="generate" className="rounded-xl font-medium text-[#6B5B4F] transition-all duration-300 hover:bg-[#F5EDE5] hover:text-[#8B5A2B] data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#8B5A2B] data-[state=active]:to-[#A0694B] data-[state=active]:!text-white data-[state=active]:shadow-md data-[state=active]:shadow-[#8B5A2B]/25">Bill Generation</TabsTrigger>
          <TabsTrigger value="invoices" className="rounded-xl font-medium text-[#6B5B4F] transition-all duration-300 hover:bg-[#F5EDE5] hover:text-[#8B5A2B] data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#8B5A2B] data-[state=active]:to-[#A0694B] data-[state=active]:!text-white data-[state=active]:shadow-md data-[state=active]:shadow-[#8B5A2B]/25">Invoices</TabsTrigger>
          <TabsTrigger value="refunds" className="rounded-xl font-medium text-[#6B5B4F] transition-all duration-300 hover:bg-[#F5EDE5] hover:text-[#8B5A2B] data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#8B5A2B] data-[state=active]:to-[#A0694B] data-[state=active]:!text-white data-[state=active]:shadow-md data-[state=active]:shadow-[#8B5A2B]/25">Refunds</TabsTrigger>
        </TabsList>

        {/* Bill Generation Tab */}
        <TabsContent value="generate" className="space-y-4 sm:space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 items-stretch">
            {/* Order Selection */}
            <Card className="h-full shadow-sm border border-[#ebe2d8] rounded-2xl bg-white flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  Select Order
                  {orders.filter(o => o.status === 'bill_requested').length > 0 && (
                    <Badge className="bg-amber-500 text-white text-xs">
                      {orders.filter(o => o.status === 'bill_requested').length} Pending
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>Bill-requested orders appear first</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 pt-0">
                <ScrollArea className="h-[360px] pr-3">
                  <div className="space-y-2.5">
                    {orders.map(order => (
                      <Card
                        key={order.id}
                        className={`cursor-pointer transition-all hover:shadow-md rounded-xl ${
                          selectedOrder?.id === order.id
                            ? 'border-primary bg-primary/5'
                            : order.status === 'bill_requested'
                            ? 'border-amber-400 bg-amber-50'
                            : ''
                        }`}
                        onClick={() => loadOrderIntoBill(order)}
                      >
                        <CardContent className="p-3 sm:p-3.5">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-medium">
                              {order.order_type === 'takeaway' ? 'Takeaway' : `Table ${order.table_number}`}
                            </span>
                            <Badge
                              variant={order.status === 'bill_requested' ? 'default' : 'outline'}
                              className={order.status === 'bill_requested' ? 'bg-amber-500 text-white' : ''}
                            >
                              {order.status === 'bill_requested' ? '⚑ Bill Requested' : order.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-1.5">{order.customer_name}</p>
                          <p className="text-sm font-medium">
                            <IndianRupee className="h-3 w-3 inline" />
                            {order.total}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                    {orders.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">No pending bills</p>
                        <p className="text-xs mt-1">Bills appear here when a waiter marks a table as Available</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Bill Items */}
            <Card className="lg:col-span-2 h-full shadow-sm border border-[#ebe2d8] rounded-2xl bg-white flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Bill Items</CardTitle>
                <CardDescription>
                  {selectedOrder 
                    ? `${selectedOrder.order_type === 'takeaway' ? 'Takeaway' : `Table ${selectedOrder.table_number}`} – ${selectedOrder.customer_name}` 
                    : 'No order selected'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-4 pt-0">
                {/* Items List */}
                <div className="space-y-2.5">
                  {billItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-xl bg-white">
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          ₹{item.price} each
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => updateItemQuantity(item.id, -1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-12 text-center font-medium">{item.quantity}</span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => updateItemQuantity(item.id, 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="w-24 text-right font-medium">
                          ₹{item.total}
                        </div>
                      </div>
                    </div>
                  ))}
                  {billItems.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calculator className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Select an order to start billing</p>
                    </div>
                  )}
                </div>

                {billItems.length > 0 && (
                  <>
                    <Separator />

                    {/* Tax & Discount */}
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Tax Selection */}
                      <div className="space-y-2">
                        <Label>GST Rate</Label>
                        <Select value={taxRate.toString()} onValueChange={(v) => setTaxRate(Number(v))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0% - No GST</SelectItem>
                            <SelectItem value="5">5% GST</SelectItem>
                            <SelectItem value="12">12% GST</SelectItem>
                            <SelectItem value="18">18% GST</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Discount */}
                      <div className="space-y-2">
                        <Label>Discount</Label>
                        <div className="flex gap-2">
                          <Select value={discountType} onValueChange={(v: 'flat' | 'percentage') => setDiscountType(v)}>
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentage">%</SelectItem>
                              <SelectItem value="flat">₹</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            value={discountValue}
                            onChange={(e) => setDiscountValue(Number(e.target.value))}
                            placeholder="0"
                            min="0"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bill Summary */}
                    <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal</span>
                        <span>₹{totals.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>GST ({taxRate}%)</span>
                        <span>₹{totals.taxAmount.toFixed(2)}</span>
                      </div>
                      {totals.discountAmount > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Discount</span>
                          <span>-₹{totals.discountAmount.toFixed(2)}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between font-semibold text-lg">
                        <span>Grand Total</span>
                        <span>₹{totals.grandTotal.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Payment Mode Selection */}
                    <div className="space-y-3">
                      <Label>Payment Mode</Label>
                      <RadioGroup value={paymentMode} onValueChange={setPaymentMode}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Label
                            htmlFor="cash"
                            className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                              paymentMode === 'cash' ? 'border-primary bg-primary/5' : 'border-border'
                            }`}
                          >
                            <RadioGroupItem value="cash" id="cash" />
                            <Banknote className="h-5 w-5" />
                            <span>Cash</span>
                          </Label>

                          <Label
                            htmlFor="card"
                            className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                              paymentMode === 'card' ? 'border-primary bg-primary/5' : 'border-border'
                            }`}
                          >
                            <RadioGroupItem value="card" id="card" />
                            <CreditCard className="h-5 w-5" />
                            <span>Card</span>
                          </Label>

                          <Label
                            htmlFor="upi"
                            className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                              paymentMode === 'upi' ? 'border-primary bg-primary/5' : 'border-border'
                            }`}
                          >
                            <RadioGroupItem value="upi" id="upi" />
                            <Smartphone className="h-5 w-5" />
                            <span>UPI</span>
                          </Label>

                          <Label
                            htmlFor="wallet"
                            className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                              paymentMode === 'wallet' ? 'border-primary bg-primary/5' : 'border-border'
                            }`}
                          >
                            <RadioGroupItem value="wallet" id="wallet" />
                            <Wallet className="h-5 w-5" />
                            <span>Wallet</span>
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <Button onClick={generateInvoice} className="w-full" size="lg" disabled={isGenerating}>
                      <Receipt className="h-5 w-5 mr-2" />
                      {isGenerating ? 'Processing...' : 'Generate Invoice & Process Payment'}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Invoice History</CardTitle>
              <CardDescription>View and manage all generated invoices</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice No.</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>Released By</TableHead>
                    <TableHead>Released At</TableHead>
                    <TableHead>Payment Mode</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map(invoice => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                      <TableCell>{invoice.customer_name}</TableCell>
                      <TableCell>{invoice.table_number ? `Table ${invoice.table_number}` : 'Takeaway'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{invoice.generated_by}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{new Date(invoice.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{invoice.payment_mode.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{invoice.grand_total.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {invoice.status === 'paid' ? (
                          <Badge className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            paid
                          </Badge>
                        ) : invoice.status === 'pending' ? (
                          <Badge className="bg-amber-500">
                            <Clock className="h-3 w-3 mr-1" />
                            pending
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-400">
                            {invoice.status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setPreviewInvoice(invoice);
                              setShowInvoicePreview(true);
                            }}
                          >
                            <Receipt className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadInvoice(invoice)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => printInvoice(invoice)}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Refunds Tab */}
        <TabsContent value="refunds" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Refund Management</CardTitle>
              <CardDescription>Process refunds for invoices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Invoice Number</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select invoice" />
                      </SelectTrigger>
                      <SelectContent>
                        {invoices.map(invoice => (
                          <SelectItem key={invoice.id} value={invoice.invoice_number}>
                            {invoice.invoice_number} - ₹{invoice.grand_total.toFixed(2)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Refund Type</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select refund type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">Full Refund</SelectItem>
                        <SelectItem value="partial">Partial Refund</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Refund Amount (₹)</Label>
                    <Input type="number" placeholder="Enter amount" />
                  </div>

                  <div className="space-y-2">
                    <Label>Reason</Label>
                    <Input placeholder="Reason for refund" />
                  </div>
                </div>

                <Button className="w-full">
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Process Refund
                </Button>

                <Separator className="my-6" />

                {/* Refund History */}
                <div>
                  <h3 className="font-medium mb-4">Refund History</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice No.</TableHead>
                        <TableHead>Refund Amount</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="text-muted-foreground" colSpan={5}>
                          No refunds processed yet
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invoice Preview Dialog */}
      <Dialog open={showInvoicePreview} onOpenChange={setShowInvoicePreview}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Invoice Preview</DialogTitle>
            <DialogDescription>Invoice details and summary</DialogDescription>
          </DialogHeader>
          {previewInvoice && (
            <div className="space-y-6 overflow-y-auto flex-1 pr-1">
              {/* Invoice Header */}
              <div className="text-center border-b pb-4">
                <h2 className="text-2xl font-bold">Restaurant Management System</h2>
                <p className="text-sm text-muted-foreground">Movicloud Labs</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Invoice: {previewInvoice.invoice_number}
                </p>
              </div>

              {/* Customer Details */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-medium">{previewInvoice.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Table Number</p>
                  <p className="font-medium">{previewInvoice.table_number ? `Table ${previewInvoice.table_number}` : 'Takeaway'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date & Time</p>
                  <p className="font-medium">{new Date(previewInvoice.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payment Mode</p>
                  <p className="font-medium">{previewInvoice.payment_mode.toUpperCase()}</p>
                </div>
              </div>

              {/* Items */}
              <div>
                <h3 className="font-medium mb-3">Items</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(previewInvoice.items || []).map(item => (
                      <TableRow key={item.id}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">₹{item.price}</TableCell>
                        <TableCell className="text-right">₹{item.total}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Totals */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>₹{previewInvoice.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST ({previewInvoice.tax_rate}%)</span>
                  <span>₹{previewInvoice.tax_amount.toFixed(2)}</span>
                </div>
                {previewInvoice.discount_amount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-₹{previewInvoice.discount_amount.toFixed(2)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-semibold">
                  <span>Grand Total</span>
                  <span>₹{previewInvoice.grand_total.toFixed(2)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button onClick={() => downloadInvoice(previewInvoice)} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
                <Button onClick={() => printInvoice(previewInvoice)} variant="outline" className="flex-1">
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
