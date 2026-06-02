import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/admin/components/ui/card';
import { Button } from '@/admin/components/ui/button';
import { Input } from '@/admin/components/ui/input';
import { Label } from '@/admin/components/ui/label';
import { Switch } from '@/admin/components/ui/switch';
import { Separator } from '@/admin/components/ui/separator';
import { DollarSign, Save, Percent, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { taxConfigApi } from '@/admin/utils/api';

interface TaxConfig {
  gstEnabled: boolean;
  gstRate: number;
  cgstRate: number;
  sgstRate: number;
  serviceChargeEnabled: boolean;
  serviceChargeRate: number;
  packagingChargeEnabled: boolean;
  packagingChargeRate: number;
}

export function TaxServiceSettings() {
  const [taxConfig, setTaxConfig] = useState<TaxConfig>({
    gstEnabled: true,
    gstRate: 5,
    cgstRate: 2.5,
    sgstRate: 2.5,
    serviceChargeEnabled: true,
    serviceChargeRate: 10,
    packagingChargeEnabled: true,
    packagingChargeRate: 20,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load tax configuration and discounts from backend API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const taxData = await taxConfigApi.get().catch(() => null);
        
        if (taxData) {
          setTaxConfig({
            gstEnabled: taxData.gstEnabled ?? true,
            gstRate: taxData.gstRate ?? 5,
            cgstRate: taxData.cgstRate ?? 2.5,
            sgstRate: taxData.sgstRate ?? 2.5,
            serviceChargeEnabled: taxData.serviceChargeEnabled ?? true,
            serviceChargeRate: taxData.serviceChargeRate ?? 10,
            packagingChargeEnabled: taxData.packagingChargeEnabled ?? true,
            packagingChargeRate: taxData.packagingChargeRate ?? 20,
          });
        }
      } catch (error) {
        console.error('Failed to load tax & discount data:', error);
        toast.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSaveTaxConfig = async () => {
    setSaving(true);
    try {
      await taxConfigApi.update(taxConfig);
      toast.success('Tax & service charge settings saved successfully!');
    } catch (error) {
      console.error('Failed to save tax config:', error);
      toast.error('Failed to save tax settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-2 sm:p-3">
      {/* GST Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-black">GST / VAT Configuration</CardTitle>
              <CardDescription className="text-black">Configure tax rates for billing</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label>Enable GST</Label>
              <p className="text-xs text-muted-foreground">Apply GST on all transactions</p>
            </div>
            <Switch
              checked={taxConfig.gstEnabled}
              onCheckedChange={(checked) => setTaxConfig({ ...taxConfig, gstEnabled: checked })}
            />
          </div>

          {taxConfig.gstEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/50">
              <div className="space-y-2">
                <Label htmlFor="gst-rate">Total GST Rate (%)</Label>
                <Input
                  id="gst-rate"
                  type="number"
                  value={taxConfig.gstRate}
                  onChange={(e) => setTaxConfig({ ...taxConfig, gstRate: parseFloat(e.target.value) })}
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cgst-rate">CGST Rate (%)</Label>
                <Input
                  id="cgst-rate"
                  type="number"
                  value={taxConfig.cgstRate}
                  onChange={(e) => setTaxConfig({ ...taxConfig, cgstRate: parseFloat(e.target.value) })}
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sgst-rate">SGST Rate (%)</Label>
                <Input
                  id="sgst-rate"
                  type="number"
                  value={taxConfig.sgstRate}
                  onChange={(e) => setTaxConfig({ ...taxConfig, sgstRate: parseFloat(e.target.value) })}
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Service Charge Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-black">Service & Additional Charges</CardTitle>
              <CardDescription className="text-black">Configure service and packaging charges</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label>Service Charge</Label>
              <p className="text-xs text-muted-foreground">Add service charge to bills</p>
            </div>
            <Switch
              checked={taxConfig.serviceChargeEnabled}
              onCheckedChange={(checked) => setTaxConfig({ ...taxConfig, serviceChargeEnabled: checked })}
            />
          </div>

          {taxConfig.serviceChargeEnabled && (
            <div className="space-y-2 p-4 border rounded-lg bg-muted/50">
              <Label htmlFor="service-charge">Service Charge Rate (%)</Label>
              <Input
                id="service-charge"
                type="number"
                value={taxConfig.serviceChargeRate}
                onChange={(e) => setTaxConfig({ ...taxConfig, serviceChargeRate: parseFloat(e.target.value) })}
                min="0"
                max="100"
                step="0.1"
              />
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label>Packaging Charge</Label>
              <p className="text-xs text-muted-foreground">Add packaging charge for takeaway orders</p>
            </div>
            <Switch
              checked={taxConfig.packagingChargeEnabled}
              onCheckedChange={(checked) => setTaxConfig({ ...taxConfig, packagingChargeEnabled: checked })}
            />
          </div>

          {taxConfig.packagingChargeEnabled && (
            <div className="space-y-2 p-4 border rounded-lg bg-muted/50">
              <Label htmlFor="packaging-charge">Packaging Charge (₹)</Label>
              <Input
                id="packaging-charge"
                type="number"
                value={taxConfig.packagingChargeRate}
                onChange={(e) => setTaxConfig({ ...taxConfig, packagingChargeRate: parseFloat(e.target.value) })}
                min="0"
                step="1"
              />
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button onClick={handleSaveTaxConfig} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Tax Settings
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
