import { useState } from 'react';
import { Button } from '@/admin/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/admin/components/ui/dialog';
import { Label } from '@/admin/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/admin/components/ui/radio-group';
import { CreditCard, Banknote, Smartphone, Wallet, User, Phone, IndianRupee } from 'lucide-react';
import { API_BASE_URL } from '@/admin/utils/api';
import { toast } from 'sonner';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  amount: number;
  customerName?: string;
  customerPhone?: string;
  onSuccess?: () => void;
}

export function PaymentDialog({ open, onOpenChange, orderId, amount, customerName, customerPhone, onSuccess }: PaymentDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi' | 'wallet'>('cash');
  const [processing, setProcessing] = useState(false);

  const handlePayment = async () => {
    setProcessing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/billing/process-order-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, amount, method: paymentMethod }),
      });

      const result = await response.json();
      if (result.success) {
        toast.success('Payment processed successfully!');
        onOpenChange(false);
        if (onSuccess) onSuccess();
      } else {
        toast.error('Payment failed. Please try again.');
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const paymentMethods = [
    { id: 'cash', name: 'Cash', icon: Banknote },
    { id: 'card', name: 'Credit/Debit Card', icon: CreditCard },
    { id: 'upi', name: 'UPI', icon: Smartphone },
    { id: 'wallet', name: 'Digital Wallet', icon: Wallet },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Collect Payment — Takeaway</DialogTitle>
          <DialogDescription>Select a payment method and confirm the transaction</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Info */}
          {(customerName || customerPhone) && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
              {customerName && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-amber-700" />
                  <span className="font-medium text-amber-900">{customerName}</span>
                </div>
              )}
              {customerPhone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-amber-700" />
                  <span className="text-amber-800">{customerPhone}</span>
                </div>
              )}
            </div>
          )}

          {/* Amount */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Total Amount:</span>
              <span className="text-2xl font-bold flex items-center gap-0.5">
                <IndianRupee className="h-6 w-6" />
                {amount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-3">
            <Label>Payment Method</Label>
            <RadioGroup value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}>
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                return (
                  <div
                    key={method.id}
                    className={`flex items-center space-x-2 border rounded-lg p-4 cursor-pointer hover:bg-muted transition-colors ${
                      paymentMethod === method.id ? 'border-primary bg-muted' : ''
                    }`}
                    onClick={() => setPaymentMethod(method.id as any)}
                  >
                    <RadioGroupItem value={method.id} id={method.id} />
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <Label htmlFor={method.id} className="flex-1 cursor-pointer">
                      {method.name}
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePayment}
              className="flex-1 bg-[#8B5E34] hover:bg-[#8B5E34]/90"
              disabled={processing}
            >
              {processing ? 'Processing...' : (
                <span className="flex items-center gap-1">
                  Pay <IndianRupee className="h-4 w-4" />{amount.toFixed(2)}
                </span>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
