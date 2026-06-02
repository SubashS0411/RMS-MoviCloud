import { useState, useEffect, type ChangeEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/admin/components/ui/card';
import { Button } from '@/admin/components/ui/button';
import { Input } from '@/admin/components/ui/input';
import { Label } from '@/admin/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/admin/components/ui/select';
import { Separator } from '@/admin/components/ui/separator';
import { Wrench, Save, Upload, MapPin, Phone, Globe, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { systemConfigApi } from '@/admin/utils/api';

interface SystemConfig {
  restaurantName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contactNumber: string;
  email: string;
  website: string;
  operatingHours: string;
  currency: string;
  timezone: string;
  language: string;
  dateFormat: string;
  timeFormat: string;
  logoUrl: string;
}

const defaultConfig: SystemConfig = {
  restaurantName: 'Restaurant Management System',
  address: '',
  city: '',
  state: '',
  pincode: '',
  contactNumber: '',
  email: '',
  website: '',
  operatingHours: '',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  language: 'English',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '12-hour',
  logoUrl: '/favicon.png',
};

export function SystemConfiguration() {
  const [config, setConfig] = useState<SystemConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load configuration from backend API
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const data = await systemConfigApi.get();
        if (data) {
          setConfig({
            restaurantName: data.restaurantName || defaultConfig.restaurantName,
            address: data.address || '',
            city: data.city || '',
            state: data.state || '',
            pincode: data.pincode || '',
            contactNumber: data.contactNumber || '',
            email: data.email || '',
            website: data.website || '',
            operatingHours: data.operatingHours || '',
            currency: data.currency || 'INR',
            timezone: data.timezone || 'Asia/Kolkata',
            language: data.language || 'English',
            dateFormat: data.dateFormat || 'DD/MM/YYYY',
            timeFormat: data.timeFormat || '12-hour',
            logoUrl: data.logoUrl || '/favicon.png',
          });
        }
      } catch (error) {
        console.error('Failed to load system config:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await systemConfigApi.update(config);
      toast.success('System configuration saved successfully!');
    } catch (error) {
      console.error('Failed to save config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast.error('Logo file must be under 500 KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setConfig((prev) => ({ ...prev, logoUrl: reader.result as string }));
      toast.success('Logo loaded — click Save Configuration to apply');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-black">System Configuration</CardTitle>
                <CardDescription className="text-black">Configure restaurant details and system preferences</CardDescription>
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Configuration
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Restaurant Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Restaurant Information</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="restaurant-name">Restaurant Name</Label>
                <Input
                  id="restaurant-name"
                  value={config.restaurantName}
                  onChange={(e) => setConfig({ ...config, restaurantName: e.target.value })}
                  placeholder="Enter restaurant name"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Street Address</Label>
                <Input
                  id="address"
                  value={config.address}
                  onChange={(e) => setConfig({ ...config, address: e.target.value })}
                  placeholder="Building, Street, Locality"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={config.city}
                  onChange={(e) => setConfig({ ...config, city: e.target.value })}
                  placeholder="City"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={config.state}
                  onChange={(e) => setConfig({ ...config, state: e.target.value })}
                  placeholder="State"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pincode">Pincode</Label>
                <Input
                  id="pincode"
                  value={config.pincode}
                  onChange={(e) => setConfig({ ...config, pincode: e.target.value })}
                  placeholder="6-digit pincode"
                />
              </div>

              <div className="space-y-2">
                <Label>Restaurant Logo</Label>
                <div className="flex items-start gap-3">
                  {config.logoUrl && (
                    <img
                      src={config.logoUrl}
                      alt="Logo preview"
                      className="w-14 h-14 rounded-lg object-cover border border-border flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 space-y-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      type="button"
                      onClick={() => (document.getElementById('logo-file-input') as HTMLInputElement | null)?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {config.logoUrl ? 'Change Logo' : 'Upload Logo'}
                    </Button>
                    {config.logoUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-destructive hover:text-destructive"
                        type="button"
                        onClick={() => setConfig({ ...config, logoUrl: '' })}
                      >
                        Remove Logo
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground">PNG / JPG / SVG · max 500 KB</p>
                  </div>
                </div>
                <input
                  id="logo-file-input"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={handleLogoFileChange}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Contact Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Contact Details</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact-number">Contact Number</Label>
                <Input
                  id="contact-number"
                  value={config.contactNumber}
                  onChange={(e) => setConfig({ ...config, contactNumber: e.target.value })}
                  placeholder="+91 XXXXX XXXXX"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={config.email}
                  onChange={(e) => setConfig({ ...config, email: e.target.value })}
                  placeholder="contact@restaurant.com"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="website">Website URL</Label>
                <Input
                  id="website"
                  value={config.website}
                  onChange={(e) => setConfig({ ...config, website: e.target.value })}
                  placeholder="www.restaurant.com"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="operating-hours">Operating Hours</Label>
                <Input
                  id="operating-hours"
                  value={config.operatingHours}
                  onChange={(e) => setConfig({ ...config, operatingHours: e.target.value })}
                  placeholder="e.g., 10:00 AM - 11:00 PM"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Regional & Localization Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Regional & Localization</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select value={config.currency} onValueChange={(value) => setConfig({ ...config, currency: value })}>
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">₹ Indian Rupee (INR)</SelectItem>
                    <SelectItem value="USD">$ US Dollar (USD)</SelectItem>
                    <SelectItem value="EUR">€ Euro (EUR)</SelectItem>
                    <SelectItem value="GBP">£ British Pound (GBP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Time Zone</Label>
                <Select value={config.timezone} onValueChange={(value) => setConfig({ ...config, timezone: value })}>
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</SelectItem>
                    <SelectItem value="America/New_York">America/New York (EST -5:00)</SelectItem>
                    <SelectItem value="Europe/London">Europe/London (GMT +0:00)</SelectItem>
                    <SelectItem value="Asia/Dubai">Asia/Dubai (GST +4:00)</SelectItem>
                    <SelectItem value="Asia/Singapore">Asia/Singapore (SGT +8:00)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">System Language</Label>
                <Select value={config.language} onValueChange={(value) => setConfig({ ...config, language: value })}>
                  <SelectTrigger id="language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Hindi">हिंदी (Hindi)</SelectItem>
                    <SelectItem value="Tamil">தமிழ் (Tamil)</SelectItem>
                    <SelectItem value="Bengali">বাংলা (Bengali)</SelectItem>
                    <SelectItem value="Telugu">తెలుగు (Telugu)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date-format">Date Format</Label>
                <Select value={config.dateFormat} onValueChange={(value) => setConfig({ ...config, dateFormat: value })}>
                  <SelectTrigger id="date-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="time-format">Time Format</Label>
                <Select value={config.timeFormat} onValueChange={(value) => setConfig({ ...config, timeFormat: value })}>
                  <SelectTrigger id="time-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12-hour">12-hour (AM/PM)</SelectItem>
                    <SelectItem value="24-hour">24-hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Save Button at Bottom */}
          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} size="lg" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save All Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
