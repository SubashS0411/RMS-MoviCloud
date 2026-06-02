import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { systemConfigApi } from './api';
import { USE_MOCK_DATA } from './mock-data';

export interface SystemConfig {
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
  currencySymbol: string;
  timezone: string;
  language: string;
  dateFormat: string;
  timeFormat: string;
}

interface SystemConfigContextType {
  config: SystemConfig;
  loading: boolean;
  refreshConfig: () => Promise<void>;
  formatCurrency: (amount: number) => string;
  formatDate: (date: Date | string) => string;
  formatTime: (date: Date | string) => string;
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
  currencySymbol: '₹',
  timezone: 'Asia/Kolkata',
  language: 'English',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '12-hour',
};

const currencySymbols: Record<string, string> = {
  'INR': '₹',
  'USD': '$',
  'EUR': '€',
  'GBP': '£',
  'AED': 'د.إ',
  'SAR': '﷼',
  'SGD': 'S$',
};

const SystemConfigContext = createContext<SystemConfigContextType | undefined>(undefined);

export function SystemConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SystemConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);

  const refreshConfig = async () => {
    // Skip API call in mock mode - use defaults
    if (USE_MOCK_DATA) {
      setLoading(false);
      return;
    }
    
    try {
      const data = await systemConfigApi.get();
      const currencySymbol = currencySymbols[data.currency] || data.currency;
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
        currencySymbol,
        timezone: data.timezone || 'Asia/Kolkata',
        language: data.language || 'English',
        dateFormat: data.dateFormat || 'DD/MM/YYYY',
        timeFormat: data.timeFormat || '12-hour',
      });
    } catch (error) {
      console.error('Error fetching system config:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshConfig();
  }, []);

  // Format currency based on system settings
  const formatCurrency = (amount: number): string => {
    const symbol = currencySymbols[config.currency] || config.currency;
    return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Format date based on system settings
  const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return String(date);

    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();

    switch (config.dateFormat) {
      case 'MM/DD/YYYY':
        return `${month}/${day}/${year}`;
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}`;
      case 'DD/MM/YYYY':
      default:
        return `${day}/${month}/${year}`;
    }
  };

  // Format time based on system settings
  const formatTime = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return String(date);

    if (config.timeFormat === '24-hour') {
      return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    } else {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
  };

  return (
    <SystemConfigContext.Provider value={{ config, loading, refreshConfig, formatCurrency, formatDate, formatTime }}>
      {children}
    </SystemConfigContext.Provider>
  );
}

export function useSystemConfig() {
  const context = useContext(SystemConfigContext);
  if (context === undefined) {
    throw new Error('useSystemConfig must be used within a SystemConfigProvider');
  }
  return context;
}

// Hook to get just the restaurant name (for titles, headers, etc.)
export function useRestaurantName() {
  const { config } = useSystemConfig();
  return config.restaurantName;
}

// Hook to format currency
export function useCurrency() {
  const { formatCurrency, config } = useSystemConfig();
  return { formatCurrency, currency: config.currency, symbol: config.currencySymbol };
}

// Hook to format dates/times
export function useDateTimeFormat() {
  const { formatDate, formatTime, config } = useSystemConfig();
  return { formatDate, formatTime, dateFormat: config.dateFormat, timeFormat: config.timeFormat };
}
