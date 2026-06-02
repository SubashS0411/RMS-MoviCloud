import { useState } from 'react';
import { Bell, CheckCircle, Clock, CreditCard, Globe, HelpCircle, Key, Languages, Lock, LogOut, Mail, MapPin, Moon, Phone, Plus, ShieldCheck, Smartphone, Sparkles, SunMedium, ToggleLeft, Trash2, User, Wallet } from 'lucide-react';
import type { User as UserType } from '@/client/app/App';
import { useSystemConfig } from '@/client/context/SystemConfigContext';

interface Notification {
  id: string;
  message: string;
  time: string;
  read: boolean;
}

interface SettingsProps {
  user: UserType;
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onLogout: () => void;
}

export default function Settings({ user, notifications: userNotifications, onMarkAsRead, onLogout }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'account' | 'preferences' | 'notifications' | 'privacy' | 'payments' | 'app' | 'support'>('account');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [language, setLanguage] = useState('English');
  const [defaultOrderType, setDefaultOrderType] = useState<'dine-in' | 'takeaway'>('dine-in');
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [offersPromotions, setOffersPromotions] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [autoApplyLoyalty, setAutoApplyLoyalty] = useState(true);
  const [saveFavorites, setSaveFavorites] = useState(true);
  const [quickReorder, setQuickReorder] = useState(true);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState([
    { id: 'upi-1', type: 'UPI', label: 'pooja@upi', detail: 'Primary UPI' },
    { id: 'card-1', type: 'Card', label: 'Visa •••• 4821', detail: 'Expires 08/28' },
  ]);
  const [profileForm, setProfileForm] = useState({
    name: user.name,
    email: user.email,
    phone: user.phone,
    address: user.address,
  });
  const { config: sysConfig } = useSystemConfig();

  // Sample notifications for demo
  const sampleNotifications: Notification[] = [
    {
      id: '1',
      message: 'Your order #ORD-12345 is ready for pickup!',
      time: '5 mins ago',
      read: false
    },
    {
      id: '2',
      message: 'Payment of ₹850 received successfully',
      time: '15 mins ago',
      read: false
    },
    {
      id: '3',
      message: 'New offer: Get 20% off on your next order',
      time: '1 hour ago',
      read: false
    },
    {
      id: '4',
      message: 'Your table reservation for tomorrow at 7 PM is confirmed',
      time: '2 hours ago',
      read: true
    },
    {
      id: '5',
      message: 'You earned 50 loyalty points from your last order',
      time: '1 day ago',
      read: true
    },
    {
      id: '6',
      message: 'Your queue number #145 is being called. Please proceed to the counter.',
      time: '2 days ago',
      read: true
    }
  ];

  const notifications = userNotifications.length > 0 ? userNotifications : sampleNotifications;
  const unreadCount = notifications.filter(n => !n.read).length;

  const lastLogin = 'Today at 9:42 AM';
  const membershipLabel = user.membership?.plan ? user.membership.plan.charAt(0).toUpperCase() + user.membership.plan.slice(1) : 'Standard';

  const handleSave = () => {
    setSaveMessage('Settings saved successfully');
    window.setTimeout(() => setSaveMessage(null), 2200);
  };

  const addPaymentMethod = (type: 'UPI' | 'Card') => {
    setPaymentMethods((prev) => [
      ...prev,
      type === 'UPI'
        ? { id: `upi-${Date.now()}`, type, label: 'newaccount@upi', detail: 'Added from settings' }
        : { id: `card-${Date.now()}`, type, label: 'Mastercard •••• 9012', detail: 'Expires 11/29' },
    ]);
  };

  const removePaymentMethod = (id: string) => {
    setPaymentMethods((prev) => prev.filter((method) => method.id !== id));
  };

  const getIcon = (message: string) => {
    if (message.includes('order') || message.includes('Order')) {
      return <Bell className="w-5 h-5 text-blue-600" />;
    } else if (message.includes('payment') || message.includes('Payment')) {
      return <CreditCard className="w-5 h-5 text-green-600" />;
    } else if (message.includes('offer') || message.includes('Offer')) {
      return <Sparkles className="w-5 h-5 text-purple-600" />;
    } else if (message.includes('reservation') || message.includes('Reservation')) {
      return <Clock className="w-5 h-5 text-orange-600" />;
    } else if (message.includes('queue') || message.includes('Queue')) {
      return <Bell className="w-5 h-5 text-red-600" />;
    } else {
      return <CheckCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const markAllAsRead = () => {
    notifications.forEach(notification => {
      if (!notification.read) {
        onMarkAsRead(notification.id);
      }
    });
  };

  const sidebarItemClass = (tab: typeof activeTab) => `w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all border ${
    activeTab === tab
      ? 'border-[#C8A47A] bg-[#FAF0E4] text-[#3E2723] shadow-sm'
      : 'border-transparent text-[#6D4C41] hover:border-[#E8D5B5] hover:bg-[#FAF7F2]'
  }`;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex flex-col gap-4 rounded-[1.5rem] border border-[#E8D5B5] bg-white px-5 py-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8B5A2B]">Account control panel</p>
            <h1 className="settings-title mt-2 text-3xl font-semibold text-[#3E2723]">Settings</h1>
            <p className="mt-2 max-w-2xl text-sm sm:text-base text-[#6D4C41]">Manage profile details, preferences, notifications, security, and support in one place.</p>
          </div>
          <div className="flex items-center gap-3 self-start">
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-[#E8D5B5] bg-[#FAF7F2] px-3 py-2 text-sm text-[#6D4C41]">
              <Bell className="w-4 h-4" />
              {unreadCount} unread
            </div>
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-2 rounded-xl bg-[#3E2723] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2D1B10]"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-[1.5rem] border border-[#E8D5B5] bg-white p-3 shadow-sm">
              <div className="rounded-2xl bg-[#FAF7F2] px-4 py-4 ring-1 ring-[#E8D5B5]">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3E2723] text-white">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-[#3E2723]">{user.name}</p>
                    <p className="truncate text-sm text-[#6D4C41]">{user.email}</p>
                  </div>
                </div>
              </div>

              <nav className="mt-4 space-y-2">
                <button onClick={() => setActiveTab('account')} className={sidebarItemClass('account')}>
                  <User className="h-4 w-4" />
                  <span className="font-medium">Account Settings</span>
                </button>
                <button onClick={() => setActiveTab('preferences')} className={sidebarItemClass('preferences')}>
                  <Languages className="h-4 w-4" />
                  <span className="font-medium">Preferences</span>
                </button>
                <button onClick={() => setActiveTab('notifications')} className={sidebarItemClass('notifications')}>
                  <Bell className="h-4 w-4" />
                  <span className="font-medium">Notifications</span>
                  {unreadCount > 0 && <span className="ml-auto rounded-full bg-[#3E2723] px-2 py-0.5 text-[10px] font-semibold text-white">{unreadCount}</span>}
                </button>
                <button onClick={() => setActiveTab('privacy')} className={sidebarItemClass('privacy')}>
                  <ShieldCheck className="h-4 w-4" />
                  <span className="font-medium">Privacy &amp; Security</span>
                </button>
                <button onClick={() => setActiveTab('payments')} className={sidebarItemClass('payments')}>
                  <CreditCard className="h-4 w-4" />
                  <span className="font-medium">Payments</span>
                </button>
                <button onClick={() => setActiveTab('app')} className={sidebarItemClass('app')}>
                  <Sparkles className="h-4 w-4" />
                  <span className="font-medium">App Settings</span>
                </button>
                <button onClick={() => setActiveTab('support')} className={sidebarItemClass('support')}>
                  <HelpCircle className="h-4 w-4" />
                  <span className="font-medium">Help &amp; Support</span>
                </button>
              </nav>

              <div className="mt-4 rounded-2xl border border-[#E8D5B5] bg-[#FAF7F2] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B5A2B]">Quick stats</p>
                <div className="mt-3 space-y-2 text-sm text-[#6D4C41]">
                  <div className="flex items-center justify-between"><span>Loyalty points</span><span className="font-semibold text-[#3E2723]">{user.loyaltyPoints}</span></div>
                  <div className="flex items-center justify-between"><span>Membership</span><span className="font-semibold text-[#3E2723]">{membershipLabel}</span></div>
                  <div className="flex items-center justify-between"><span>Last login</span><span className="font-semibold text-[#3E2723]">{lastLogin}</span></div>
                </div>
              </div>
            </div>
          </aside>

          <main className="space-y-6 pb-24">
            {activeTab === 'account' && (
              <div className="space-y-6">
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.9fr)]">
                  <section className="rounded-[1.5rem] border border-[#E8D5B5] bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex items-center justify-between gap-4 border-b border-[#F1E4D1] pb-4">
                      <div>
                        <h2 className="text-xl font-semibold text-[#3E2723]">Account Information</h2>
                        <p className="mt-1 text-sm text-[#6D4C41]">Keep your profile details up to date.</p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="mb-2 block text-sm font-medium text-[#6D4C41]">Full Name</label>
                        <div className="flex items-center gap-3 rounded-xl border border-[#E8D5B5] bg-[#FAF7F2] px-4 py-3">
                          <User className="h-4 w-4 text-[#8B5A2B]" />
                          <input
                            type="text"
                            value={profileForm.name}
                            onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
                            className="w-full bg-transparent text-sm text-[#3E2723] outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-[#6D4C41]">Email</label>
                        <div className="flex items-center gap-3 rounded-xl border border-[#E8D5B5] bg-[#FAF7F2] px-4 py-3">
                          <Mail className="h-4 w-4 text-[#8B5A2B]" />
                          <input
                            type="email"
                            value={profileForm.email}
                            onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
                            className="w-full bg-transparent text-sm text-[#3E2723] outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-[#6D4C41]">Phone Number</label>
                        <div className="flex items-center gap-3 rounded-xl border border-[#E8D5B5] bg-[#FAF7F2] px-4 py-3">
                          <Phone className="h-4 w-4 text-[#8B5A2B]" />
                          <input
                            type="tel"
                            value={profileForm.phone}
                            onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                            className="w-full bg-transparent text-sm text-[#3E2723] outline-none"
                          />
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="mb-2 block text-sm font-medium text-[#6D4C41]">Address</label>
                        <div className="flex items-start gap-3 rounded-xl border border-[#E8D5B5] bg-[#FAF7F2] px-4 py-3">
                          <MapPin className="mt-0.5 h-4 w-4 text-[#8B5A2B]" />
                          <textarea
                            value={profileForm.address}
                            onChange={(e) => setProfileForm((prev) => ({ ...prev, address: e.target.value }))}
                            rows={3}
                            className="w-full resize-none bg-transparent text-sm text-[#3E2723] outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </section>

                  <aside className="space-y-4">
                    <section className="rounded-[1.5rem] border border-[#E8D5B5] bg-gradient-to-br from-[#3E2723] to-[#8B5A2B] p-5 text-white shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Loyalty program</p>
                          <p className="mt-2 text-4xl font-bold">{user.loyaltyPoints}</p>
                          <p className="mt-1 text-sm text-white/75">Points available</p>
                        </div>
                        <Sparkles className="h-10 w-10 text-white/60" />
                      </div>
                      <div className="mt-4 border-t border-white/20 pt-4 text-sm text-white/80">
                        Earn points with every order and redeem them for exclusive rewards.
                      </div>
                    </section>

                    {(sysConfig.contactNumber || sysConfig.email || sysConfig.operatingHours || sysConfig.address) && (
                      <section className="rounded-[1.5rem] border border-[#E8D5B5] bg-white p-5 shadow-sm">
                        <h3 className="text-lg font-semibold text-[#3E2723]">Restaurant Information</h3>
                        <div className="mt-4 space-y-4">
                          {sysConfig.contactNumber && (
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FAF7F2] text-[#8B5A2B]"><Phone className="h-4 w-4" /></div>
                              <div><p className="text-xs font-medium uppercase tracking-wide text-[#8B5A2B]">Phone</p><p className="font-semibold text-[#3E2723]">{sysConfig.contactNumber}</p></div>
                            </div>
                          )}
                          {sysConfig.email && (
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FAF7F2] text-[#8B5A2B]"><Mail className="h-4 w-4" /></div>
                              <div><p className="text-xs font-medium uppercase tracking-wide text-[#8B5A2B]">Email</p><p className="font-semibold text-[#3E2723]">{sysConfig.email}</p></div>
                            </div>
                          )}
                          {sysConfig.operatingHours && (
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FAF7F2] text-[#8B5A2B]"><Clock className="h-4 w-4" /></div>
                              <div><p className="text-xs font-medium uppercase tracking-wide text-[#8B5A2B]">Hours</p><p className="font-semibold text-[#3E2723]">{sysConfig.operatingHours}</p></div>
                            </div>
                          )}
                          {sysConfig.address && (
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-[#FAF7F2] text-[#8B5A2B]"><MapPin className="h-4 w-4" /></div>
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-[#8B5A2B]">Address</p>
                                <p className="font-semibold leading-relaxed text-[#3E2723]">{sysConfig.address}{(sysConfig.city || sysConfig.state) && <>, {[sysConfig.city, sysConfig.state, sysConfig.pincode].filter(Boolean).join(', ')}</>}</p>
                              </div>
                            </div>
                          )}
                          {sysConfig.website && (
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FAF7F2] text-[#8B5A2B]"><Globe className="h-4 w-4" /></div>
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-[#8B5A2B]">Website</p>
                                <a href={sysConfig.website} target="_blank" rel="noreferrer" className="font-semibold text-[#3E2723] hover:underline">{sysConfig.website}</a>
                              </div>
                            </div>
                          )}
                        </div>
                      </section>
                    )}
                  </aside>
                </div>
              </div>
            )}

            {activeTab === 'preferences' && (
              <div className="grid gap-6 xl:grid-cols-2">
                <section className="rounded-[1.5rem] border border-[#E8D5B5] bg-white p-5 shadow-sm sm:p-6">
                  <div className="border-b border-[#F1E4D1] pb-4">
                    <h2 className="text-xl font-semibold text-[#3E2723]">Preferences</h2>
                    <p className="mt-1 text-sm text-[#6D4C41]">Personalize the experience to match the way you use the app.</p>
                  </div>

                  <div className="mt-5 space-y-5">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-[#6D4C41]">Theme</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setTheme('light')} className={`rounded-2xl border px-4 py-4 text-left transition-all ${theme === 'light' ? 'border-[#C8A47A] bg-[#FAF0E4] text-[#3E2723]' : 'border-[#E8D5B5] bg-white text-[#6D4C41]'}`}>
                          <SunMedium className="h-5 w-5" />
                          <p className="mt-2 font-semibold">Light</p>
                          <p className="text-xs">Clean and bright</p>
                        </button>
                        <button onClick={() => setTheme('dark')} className={`rounded-2xl border px-4 py-4 text-left transition-all ${theme === 'dark' ? 'border-[#C8A47A] bg-[#FAF0E4] text-[#3E2723]' : 'border-[#E8D5B5] bg-white text-[#6D4C41]'}`}>
                          <Moon className="h-5 w-5" />
                          <p className="mt-2 font-semibold">Dark</p>
                          <p className="text-xs">Premium low-light view</p>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-[#6D4C41]">Language</label>
                      <div className="flex items-center gap-3 rounded-2xl border border-[#E8D5B5] bg-[#FAF7F2] px-4 py-3">
                        <Languages className="h-4 w-4 text-[#8B5A2B]" />
                        <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full bg-transparent text-sm text-[#3E2723] outline-none">
                          <option>English</option>
                          <option>தமிழ்</option>
                          <option>हिन्दी</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-[#6D4C41]">Default order type</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setDefaultOrderType('dine-in')} className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-all ${defaultOrderType === 'dine-in' ? 'border-[#C8A47A] bg-[#FAF0E4] text-[#3E2723]' : 'border-[#E8D5B5] text-[#6D4C41]'}`}>Dine-in</button>
                        <button onClick={() => setDefaultOrderType('takeaway')} className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-all ${defaultOrderType === 'takeaway' ? 'border-[#C8A47A] bg-[#FAF0E4] text-[#3E2723]' : 'border-[#E8D5B5] text-[#6D4C41]'}`}>Takeaway</button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#E8D5B5] bg-[#FAF7F2] px-4 py-3">
                      <p className="text-sm font-medium text-[#6D4C41]">Currency display</p>
                      <p className="mt-1 text-sm font-semibold text-[#3E2723]">₹ INR</p>
                    </div>
                  </div>
                </section>

                <section className="rounded-[1.5rem] border border-[#E8D5B5] bg-white p-5 shadow-sm sm:p-6">
                  <div className="border-b border-[#F1E4D1] pb-4">
                    <h2 className="text-xl font-semibold text-[#3E2723]">Visual preferences</h2>
                    <p className="mt-1 text-sm text-[#6D4C41]">A few extra controls to personalize the app feel.</p>
                  </div>
                  <div className="mt-5 rounded-2xl border border-[#E8D5B5] bg-[#FAF7F2] p-4 text-sm text-[#6D4C41]">
                    <div className="flex items-start gap-3">
                      <ToggleLeft className="mt-0.5 h-5 w-5 text-[#8B5A2B]" />
                      <p>Theme and language choices update this demo instantly, with no layout changes or reloads.</p>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                <section className="rounded-[1.5rem] border border-[#E8D5B5] bg-white p-5 shadow-sm sm:p-6">
                  <div className="border-b border-[#F1E4D1] pb-4">
                    <h2 className="text-xl font-semibold text-[#3E2723]">Notification Settings</h2>
                    <p className="mt-1 text-sm text-[#6D4C41]">Choose what should reach your inbox or device.</p>
                  </div>

                  <div className="mt-5 space-y-4">
                    {[
                      { title: 'Order updates', desc: 'Status changes, prep alerts, and pickup updates', checked: orderUpdates, setter: setOrderUpdates },
                      { title: 'Offers & promotions', desc: 'Discounts, coupons, and seasonal offers', checked: offersPromotions, setter: setOffersPromotions },
                      { title: 'Email notifications', desc: 'Receipts, confirmations, and account updates', checked: emailNotifications, setter: setEmailNotifications },
                      { title: 'SMS alerts', desc: 'Short, urgent updates on your phone', checked: smsAlerts, setter: setSmsAlerts },
                    ].map((item) => (
                      <div key={item.title} className="flex items-center justify-between rounded-2xl border border-[#E8D5B5] bg-[#FAF7F2] px-4 py-4">
                        <div className="pr-4">
                          <p className="font-semibold text-[#3E2723]">{item.title}</p>
                          <p className="text-sm text-[#6D4C41]">{item.desc}</p>
                        </div>
                        <button type="button" onClick={() => item.setter((prev: boolean) => !prev)} className={`relative h-7 w-12 rounded-full transition-colors ${item.checked ? 'bg-[#3E2723]' : 'bg-[#D8C8B3]'}`} aria-pressed={item.checked}>
                          <span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${item.checked ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-[1.5rem] border border-[#E8D5B5] bg-white p-5 shadow-sm sm:p-6">
                  <div className="border-b border-[#F1E4D1] pb-4">
                    <h3 className="text-lg font-semibold text-[#3E2723]">Recent Notifications</h3>
                    <p className="mt-1 text-sm text-[#6D4C41]">Quick access to your latest alerts.</p>
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#FAF7F2] px-4 py-3 text-sm text-[#6D4C41]">
                    <span>{unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}</span>
                    {unreadCount > 0 && (
                      <button onClick={markAllAsRead} className="font-semibold text-[#3E2723] hover:underline">Mark all read</button>
                    )}
                  </div>

                  <div className="mt-4 space-y-3">
                    {notifications.slice(0, 4).map((notification) => (
                      <div key={notification.id} className={`rounded-2xl border p-4 ${notification.read ? 'border-[#E8D5B5] bg-white' : 'border-[#C8A47A]/40 bg-[#FAF7F2]'}`}>
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-white ring-1 ring-[#E8D5B5]">{getIcon(notification.message)}</div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm ${notification.read ? 'text-[#6D4C41]' : 'font-medium text-[#3E2723]'}`}>{notification.message}</p>
                            <p className="mt-1 text-xs text-[#8B5A2B]">{notification.time}</p>
                          </div>
                          {!notification.read ? (
                            <button onClick={() => onMarkAsRead(notification.id)} className="rounded-full border border-[#C8A47A] px-3 py-1 text-xs font-semibold text-[#3E2723] hover:bg-[#FAF0E4]">Mark read</button>
                          ) : (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="grid gap-6 xl:grid-cols-2">
                <section className="rounded-[1.5rem] border border-[#E8D5B5] bg-white p-5 shadow-sm sm:p-6">
                  <div className="border-b border-[#F1E4D1] pb-4">
                    <h2 className="text-xl font-semibold text-[#3E2723]">Privacy &amp; Security</h2>
                    <p className="mt-1 text-sm text-[#6D4C41]">Protect your account and control access.</p>
                  </div>

                  <div className="mt-5 space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-[#6D4C41]">Current Password</label>
                      <div className="flex items-center gap-3 rounded-xl border border-[#E8D5B5] bg-[#FAF7F2] px-4 py-3"><Lock className="h-4 w-4 text-[#8B5A2B]" /><input type="password" placeholder="Enter current password" className="w-full bg-transparent text-sm text-[#3E2723] outline-none" /></div>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-[#6D4C41]">New Password</label>
                      <div className="flex items-center gap-3 rounded-xl border border-[#E8D5B5] bg-[#FAF7F2] px-4 py-3"><Key className="h-4 w-4 text-[#8B5A2B]" /><input type="password" placeholder="Enter new password" className="w-full bg-transparent text-sm text-[#3E2723] outline-none" /></div>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-[#6D4C41]">Confirm New Password</label>
                      <div className="flex items-center gap-3 rounded-xl border border-[#E8D5B5] bg-[#FAF7F2] px-4 py-3"><Key className="h-4 w-4 text-[#8B5A2B]" /><input type="password" placeholder="Confirm new password" className="w-full bg-transparent text-sm text-[#3E2723] outline-none" /></div>
                    </div>
                    <button type="button" className="inline-flex items-center gap-2 rounded-xl bg-[#3E2723] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2D1B10]">
                      <Key className="h-4 w-4" />
                      Change Password
                    </button>
                  </div>
                </section>

                <div className="space-y-6">
                  <section className="rounded-[1.5rem] border border-[#E8D5B5] bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex items-center justify-between gap-4 border-b border-[#F1E4D1] pb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-[#3E2723]">Two-Factor Authentication</h3>
                        <p className="mt-1 text-sm text-[#6D4C41]">Add an extra layer of protection to your account.</p>
                      </div>
                      <button type="button" onClick={() => setTwoFactorEnabled((prev) => !prev)} className={`relative h-7 w-12 rounded-full transition-colors ${twoFactorEnabled ? 'bg-[#3E2723]' : 'bg-[#D8C8B3]'}`} aria-pressed={twoFactorEnabled}>
                        <span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${twoFactorEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>
                    <div className="mt-4 rounded-2xl bg-[#FAF7F2] p-4 text-sm text-[#6D4C41]">When enabled, we will ask for a verification code during sign-in.</div>
                  </section>

                  <section className="rounded-[1.5rem] border border-[#E8D5B5] bg-white p-5 shadow-sm sm:p-6">
                    <h3 className="text-lg font-semibold text-[#3E2723]">Login Activity</h3>
                    <div className="mt-4 rounded-2xl border border-[#E8D5B5] bg-[#FAF7F2] p-4">
                      <p className="text-sm text-[#6D4C41]">Last login</p>
                      <p className="mt-1 font-semibold text-[#3E2723]">{lastLogin}</p>
                    </div>
                    <button type="button" className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#E8D5B5] px-4 py-3 text-sm font-semibold text-[#3E2723] transition-colors hover:bg-[#FAF7F2]">
                      <LogOut className="h-4 w-4" />
                      Logout from all devices
                    </button>
                  </section>
                </div>
              </div>
            )}

            {activeTab === 'payments' && (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                <section className="rounded-[1.5rem] border border-[#E8D5B5] bg-white p-5 shadow-sm sm:p-6">
                  <div className="border-b border-[#F1E4D1] pb-4">
                    <h2 className="text-xl font-semibold text-[#3E2723]">Saved Payment Methods</h2>
                    <p className="mt-1 text-sm text-[#6D4C41]">Manage UPI IDs and cards for faster checkout.</p>
                  </div>

                  <div className="mt-5 space-y-3">
                    {paymentMethods.map((method) => (
                      <div key={method.id} className="flex items-center justify-between rounded-2xl border border-[#E8D5B5] bg-[#FAF7F2] px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#8B5A2B] ring-1 ring-[#E8D5B5]">
                            {method.type === 'UPI' ? <Smartphone className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="font-semibold text-[#3E2723]">{method.label}</p>
                            <p className="text-sm text-[#6D4C41]">{method.detail}</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => removePaymentMethod(method.id)} className="rounded-full border border-[#E8D5B5] p-2 text-[#6D4C41] transition-colors hover:bg-white hover:text-[#3E2723]">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-[1.5rem] border border-[#E8D5B5] bg-white p-5 shadow-sm sm:p-6">
                  <h3 className="text-lg font-semibold text-[#3E2723]">Add Payment Method</h3>
                  <p className="mt-1 text-sm text-[#6D4C41]">Keep a saved method ready for the next order.</p>
                  <div className="mt-4 space-y-3">
                    <button type="button" onClick={() => addPaymentMethod('UPI')} className="flex w-full items-center justify-between rounded-2xl border border-[#E8D5B5] px-4 py-3 text-left transition-colors hover:bg-[#FAF7F2]">
                      <span className="flex items-center gap-3"><Smartphone className="h-4 w-4 text-[#8B5A2B]" />Add UPI</span>
                      <Plus className="h-4 w-4 text-[#8B5A2B]" />
                    </button>
                    <button type="button" onClick={() => addPaymentMethod('Card')} className="flex w-full items-center justify-between rounded-2xl border border-[#E8D5B5] px-4 py-3 text-left transition-colors hover:bg-[#FAF7F2]">
                      <span className="flex items-center gap-3"><CreditCard className="h-4 w-4 text-[#8B5A2B]" />Add Card</span>
                      <Plus className="h-4 w-4 text-[#8B5A2B]" />
                    </button>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'app' && (
              <div className="grid gap-6 xl:grid-cols-2">
                <section className="rounded-[1.5rem] border border-[#E8D5B5] bg-white p-5 shadow-sm sm:p-6">
                  <div className="border-b border-[#F1E4D1] pb-4">
                    <h2 className="text-xl font-semibold text-[#3E2723]">App Settings</h2>
                    <p className="mt-1 text-sm text-[#6D4C41]">Make repeat ordering faster and more convenient.</p>
                  </div>

                  <div className="mt-5 space-y-4">
                    {[
                      { title: 'Auto-apply loyalty points', desc: 'Use loyalty points whenever they improve the bill', checked: autoApplyLoyalty, setter: setAutoApplyLoyalty },
                      { title: 'Save favorite dishes', desc: 'Keep your favorite dishes accessible for quick reorders', checked: saveFavorites, setter: setSaveFavorites },
                      { title: 'Enable quick reorder', desc: 'Add items from the last order in one tap', checked: quickReorder, setter: setQuickReorder },
                    ].map((item) => (
                      <div key={item.title} className="flex items-center justify-between rounded-2xl border border-[#E8D5B5] bg-[#FAF7F2] px-4 py-4">
                        <div className="pr-4">
                          <p className="font-semibold text-[#3E2723]">{item.title}</p>
                          <p className="text-sm text-[#6D4C41]">{item.desc}</p>
                        </div>
                        <button type="button" onClick={() => item.setter((prev: boolean) => !prev)} className={`relative h-7 w-12 rounded-full transition-colors ${item.checked ? 'bg-[#3E2723]' : 'bg-[#D8C8B3]'}`} aria-pressed={item.checked}>
                          <span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${item.checked ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-[1.5rem] border border-[#E8D5B5] bg-white p-5 shadow-sm sm:p-6">
                  <h3 className="text-lg font-semibold text-[#3E2723]">App Behavior</h3>
                  <div className="mt-4 rounded-2xl bg-[#FAF7F2] p-4 text-sm text-[#6D4C41]">
                    These preferences shape checkout, favorites, and reorder shortcuts without changing the rest of the app layout.
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'support' && (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                <section className="rounded-[1.5rem] border border-[#E8D5B5] bg-white p-5 shadow-sm sm:p-6">
                  <div className="border-b border-[#F1E4D1] pb-4">
                    <h2 className="text-xl font-semibold text-[#3E2723]">Help &amp; Support</h2>
                    <p className="mt-1 text-sm text-[#6D4C41]">Reach the right team or find answers faster.</p>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-[#E8D5B5] bg-[#FAF7F2] p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white ring-1 ring-[#E8D5B5]"><Phone className="h-4 w-4 text-[#8B5A2B]" /></div>
                        <div>
                          <p className="font-semibold text-[#3E2723]">Call support</p>
                          <p className="text-sm text-[#6D4C41]">Fast help during operating hours</p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-[#3E2723]">{sysConfig.contactNumber || '+91 98765 43210'}</p>
                    </div>

                    <div className="rounded-2xl border border-[#E8D5B5] bg-[#FAF7F2] p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white ring-1 ring-[#E8D5B5]"><Mail className="h-4 w-4 text-[#8B5A2B]" /></div>
                        <div>
                          <p className="font-semibold text-[#3E2723]">Email us</p>
                          <p className="text-sm text-[#6D4C41]">Share feedback or report an issue</p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-[#3E2723]">{sysConfig.email || 'support@urbanbites.com'}</p>
                    </div>

                    <div className="rounded-2xl border border-[#E8D5B5] bg-[#FAF7F2] p-4 sm:col-span-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white ring-1 ring-[#E8D5B5]"><HelpCircle className="h-4 w-4 text-[#8B5A2B]" /></div>
                        <div>
                          <p className="font-semibold text-[#3E2723]">Need quick answers?</p>
                          <p className="text-sm text-[#6D4C41]">Common help topics are listed below.</p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {['Orders not updating', 'Refunds', 'Reservation issues', 'Loyalty points'].map((item) => (
                          <span key={item} className="rounded-full border border-[#E8D5B5] bg-white px-3 py-1 text-xs font-semibold text-[#3E2723]">{item}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-[1.5rem] border border-[#E8D5B5] bg-white p-5 shadow-sm sm:p-6">
                  <h3 className="text-lg font-semibold text-[#3E2723]">Restaurant details</h3>
                  <div className="mt-4 space-y-4 text-sm text-[#6D4C41]">
                    {sysConfig.operatingHours && <div className="rounded-2xl bg-[#FAF7F2] p-4"><p className="font-semibold text-[#3E2723]">Hours</p><p className="mt-1">{sysConfig.operatingHours}</p></div>}
                    {sysConfig.address && <div className="rounded-2xl bg-[#FAF7F2] p-4"><p className="font-semibold text-[#3E2723]">Address</p><p className="mt-1">{sysConfig.address}</p></div>}
                    <div className="rounded-2xl bg-[#FAF7F2] p-4">
                      <p className="font-semibold text-[#3E2723]">Feedback matters</p>
                      <p className="mt-1">Your ratings and comments help improve the dining experience.</p>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </main>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-[#3E2723] px-5 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-[#2D1B10]"
      >
        <CheckCircle className="h-4 w-4" />
        Save Changes
      </button>

      {saveMessage && (
        <div className="fixed bottom-20 right-5 z-40 rounded-2xl border border-[#E8D5B5] bg-white px-4 py-3 text-sm font-semibold text-[#3E2723] shadow-lg">
          {saveMessage}
        </div>
      )}
    </div>
  );
}