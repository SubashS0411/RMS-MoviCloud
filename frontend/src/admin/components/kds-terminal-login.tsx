import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Badge } from '@/admin/components/ui/badge';
import { cn } from '@/admin/components/ui/utils';
import { useAuth } from '@/admin/utils/auth-context';
import { LoadingKitchen } from '@/admin/components/ui/loading-spinner';
import {
  ChefHat,
  Flame,
  UtensilsCrossed,
  Soup,
  Coffee,
  Salad,
  Crown,
} from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/admin/utils/api';

export type KitchenTerminalStation =
  | 'FRY'
  | 'CURRY'
  | 'RICE'
  | 'PREP'
  | 'GRILL'
  | 'DESSERT'
  | 'HEAD_CHEF';

interface StationCard {
  id: KitchenTerminalStation;
  name: string;
  icon: ReactNode;
  colorClass: string;
  description: string;
  isHeadChef?: boolean;
}

interface ChefRecord {
  _id: string;
  name: string;
  kitchenStation?: string;
  shift?: string;
}

export const TERMINAL_STATIONS: StationCard[] = [
  { id: 'FRY', name: 'Fry Station', icon: <Flame className="h-5 w-5" />, colorClass: 'bg-[#f4eadf]', description: 'Deep-fry, saute, tempura' },
  { id: 'CURRY', name: 'Curry Station', icon: <Soup className="h-5 w-5" />, colorClass: 'bg-[#f4eadf]', description: 'Gravies, curries, sauces' },
  { id: 'RICE', name: 'Rice Station', icon: <UtensilsCrossed className="h-5 w-5" />, colorClass: 'bg-[#f4eadf]', description: 'Biryani, pulao, fried rice' },
  { id: 'PREP', name: 'Prep Station', icon: <Salad className="h-5 w-5" />, colorClass: 'bg-[#f4eadf]', description: 'Salads, cold items, plating' },
  { id: 'GRILL', name: 'Grill Station', icon: <ChefHat className="h-5 w-5" />, colorClass: 'bg-[#f4eadf]', description: 'Tandoor, BBQ, grills' },
  { id: 'DESSERT', name: 'Dessert Station', icon: <Coffee className="h-5 w-5" />, colorClass: 'bg-[#f4eadf]', description: 'Sweets, beverages, desserts' },
  { id: 'HEAD_CHEF', name: 'Head Chef', icon: <Crown className="h-5 w-5" />, colorClass: 'bg-[#f4eadf]', description: 'Global oversight across all stations', isHeadChef: true },
];

interface KDSTerminalLoginProps {
  onLogin: (station: KitchenTerminalStation) => void;
}

export function KDSTerminalLogin({ onLogin }: KDSTerminalLoginProps) {
  const { user } = useAuth();
  const [chefs, setChefs] = useState<ChefRecord[]>([]);
  const [loadingChefs, setLoadingChefs] = useState(true);

  useEffect(() => {
    const fetchChefs = async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}/staff/chefs`);
        if (resp.ok) {
          const data = await resp.json();
          setChefs(data);
        }
      } catch {
        // Silently fail � all stations stay visible
      } finally {
        setLoadingChefs(false);
      }
    };
    fetchChefs();
  }, []);

  const getChefsForStation = (stationId: string): ChefRecord[] =>
    chefs.filter((c) => (c.kitchenStation || '').toUpperCase() === stationId.toUpperCase());

  const isPrivileged = user?.role === 'admin' || user?.role === 'manager';
  const visibleStations = TERMINAL_STATIONS.filter((station) => {
    if (isPrivileged) return true; // Admin/manager sees all stations
    if (station.isHeadChef) return true;
    if (loadingChefs) return true;
    return chefs.some((c) => c.kitchenStation === station.id);
  });

  const handleEnterStation = (station: StationCard) => {
    const assignedChefs = getChefsForStation(station.id);
    const chefLabel = assignedChefs.length > 0 ? assignedChefs.map((c) => c.name).join(', ') : station.name;
    toast.success(`Entered ${station.name}`, {
      description: `Welcome${assignedChefs.length > 0 ? `, ${chefLabel}` : ''}! Your terminal is ready.`,
    });
    onLogin(station.id);
  };

  return (
    <div className="relative min-h-screen bg-[#f8f6f3] p-4 sm:p-6 max-w-full overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_15%,rgba(139,94,52,0.08),transparent_30%),radial-gradient(circle_at_90%_10%,rgba(111,69,35,0.06),transparent_28%)]" />
      <div className="relative w-full max-w-[1220px] mx-auto">
        <div className="mb-4 sm:mb-5 text-center">
          <div className="inline-flex items-center justify-center p-2 bg-[#f4eadf] rounded-lg mb-2 border border-[#eadfce] shadow-[0_4px_10px_rgba(0,0,0,0.06)]">
            <ChefHat className="h-5 w-5 text-[#8B5E3C]" />
          </div>
          <p className="text-[12px] uppercase tracking-[0.14em] text-[#7b746c]">Select Station</p>
        </div>

        {loadingChefs ? (
          <LoadingKitchen />
        ) : (
          <div className="grid gap-4 sm:gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
            {visibleStations.map((station, index) => {
              const assignedChefs = getChefsForStation(station.id);
              return (
                <button
                  key={station.id}
                  onClick={() => handleEnterStation(station)}
                  className={cn(
                    'group relative overflow-hidden flex h-full min-h-[210px] flex-col items-start justify-between gap-3 p-5 rounded-[18px] border',
                    station.isHeadChef
                      ? 'border-[#d9b16f] shadow-[0_8px_18px_rgba(159,114,36,0.13)]'
                      : 'border-[#e8dfd2] shadow-[0_8px_16px_rgba(0,0,0,0.07),0_2px_6px_rgba(0,0,0,0.03)]',
                    'transition-[transform,box-shadow,border-color,background-position] duration-300 ease-out',
                    'hover:scale-[1.03] hover:-translate-y-[4px] hover:shadow-[0_14px_28px_rgba(0,0,0,0.14),0_4px_12px_rgba(0,0,0,0.08)] hover:border-[#8b5e34] active:scale-[0.985]',
                    'text-[#2c2c2c] cursor-pointer animate-kds-fade-up'
                  )}
                  style={{
                    backgroundImage: station.isHeadChef
                      ? 'linear-gradient(135deg, #fff9ee 0%, #f8e8ca 100%)'
                      : 'linear-gradient(135deg, #ffffff 0%, #f4f0ea 100%)',
                    animationDelay: `${index * 70}ms`,
                  }}
                >
                  <span className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_top_right,rgba(139,94,52,0.14),transparent_45%)]" />
                  <span className="pointer-events-none absolute -inset-x-10 -bottom-16 h-20 bg-white/40 blur-xl opacity-0 group-active:opacity-100 transition-opacity duration-150" />
                  <div
                    className={cn(
                      'relative z-10 p-3 rounded-full flex items-center justify-center transition-all duration-300',
                      'group-hover:scale-110 group-hover:shadow-[0_0_0_6px_rgba(139,94,52,0.10)]',
                      'group-hover:-rotate-6 group-active:scale-95',
                      station.isHeadChef ? 'bg-[#f6deb4]' : station.colorClass
                    )}
                  >
                    <span className="text-[#8B5E3C] transition-colors duration-300 group-hover:text-[#6f4523]">{station.icon}</span>
                  </div>
                  <div className="relative z-10 text-left">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <h3 className="font-semibold text-[16px] sm:text-[17px] leading-tight">{station.name}</h3>
                      {station.isHeadChef && (
                        <Badge className="bg-amber-100 text-amber-700 border border-amber-300 text-[10px] px-2 py-0 shadow-[0_0_0_2px_rgba(245,158,11,0.12)]">SENIOR</Badge>
                      )}
                    </div>
                    <p className="text-[12px] sm:text-[13px] text-[#6b665f]">{station.description}</p>
                  </div>
                  {assignedChefs.length > 0 && (
                    <p className="relative z-10 text-[11px] text-emerald-700 font-medium leading-snug">
                      Assigned: {assignedChefs.map((c) => c.name).join(', ')}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes kds-fade-up {
          from { opacity: 0; transform: translateY(10px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-kds-fade-up {
          animation: kds-fade-up 420ms ease-out both;
        }
      `}</style>
    </div>
  );
}
