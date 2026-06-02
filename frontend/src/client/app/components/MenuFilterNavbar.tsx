import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Grid3X3, Leaf, UtensilsCrossed, Sparkles, Globe } from 'lucide-react';
import type { ReactNode } from 'react';

export type VegFilter = 'all' | 'veg' | 'non-veg' | 'special';
export type CuisineFilter = 'all' | 'North Indian' | 'South Indian' | 'Chinese' | 'Italian' | 'Continental';

interface MenuFilterNavbarProps {
  appName?: string;
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  filterVeg: VegFilter;
  onFilterVegChange: (value: VegFilter) => void;
  filterCuisine: CuisineFilter;
  onFilterCuisineChange: (value: CuisineFilter) => void;
  centerSlot?: ReactNode;
  rightSlot?: ReactNode;
}

const cuisines: CuisineFilter[] = ['all', 'North Indian', 'South Indian', 'Chinese', 'Italian', 'Continental'];

const navBtnBase = 'w-full text-left px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors';

export default function MenuFilterNavbar({
  appName = 'Urban Bites',
  categories,
  selectedCategory,
  onSelectCategory,
  filterVeg,
  onFilterVegChange,
  filterCuisine,
  onFilterCuisineChange,
  centerSlot,
  rightSlot,
}: MenuFilterNavbarProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (ev: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const selectCategory = (value: string) => {
    onSelectCategory(value);
    setOpen(false);
  };

  const selectVeg = (value: VegFilter) => {
    onFilterVegChange(value);
    setOpen(false);
  };

  const selectCuisine = (value: CuisineFilter) => {
    onFilterCuisineChange(value);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative z-30 max-w-[1200px] mx-auto">
      <div className="bg-white/95 border border-[#E8DED0] rounded-xl shadow-sm px-3 py-2">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[#FAF1E6] border border-[#E8DED0] text-[#8B5A2B] flex items-center justify-center shrink-0">
              <UtensilsCrossed className="w-4 h-4" />
            </div>
            <span className="text-sm sm:text-base font-semibold text-[#3E2723] truncate">{appName}</span>
          </div>

          {centerSlot ? (
            <div className="flex-1 min-w-0 px-1 sm:px-2 flex items-center justify-center">
              <div className="w-full max-w-[460px]">{centerSlot}</div>
            </div>
          ) : (
            <div className="flex-1" />
          )}

          <div className="flex items-center gap-1.5 sm:gap-2 justify-end shrink-0">
            <button
              onClick={() => setOpen((v) => !v)}
              className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap ${
                open
                  ? 'bg-[#8B5A2B] text-white border-[#8B5A2B]'
                  : 'bg-[#FCFAF7] text-[#6D4C41] border-[#E8DED0] hover:border-[#C8A47A] hover:text-[#8B5A2B]'
              }`}
            >
              <span className="hidden sm:inline">Browse Categories</span>
              <span className="sm:hidden">Browse</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
          </div>
        </div>
      </div>

      {open && (
        <div className="absolute inset-x-0 md:inset-x-auto md:right-0 md:w-[min(92vw,960px)] mt-2 bg-white border border-[#E8DED0] rounded-xl shadow-[0_12px_40px_rgba(62,39,35,0.18)] p-3 sm:p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            <div className="rounded-lg bg-[#FCFAF7] border border-[#EFE6DA] p-2.5">
              <div className="text-[11px] uppercase tracking-wide font-bold text-[#8B5A2B] mb-2 flex items-center gap-1.5">
                <Grid3X3 className="w-3.5 h-3.5" /> Categories
              </div>
              <div className="space-y-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => selectCategory(cat)}
                    className={`${navBtnBase} ${selectedCategory === cat ? 'bg-[#8B5A2B] text-white border-[#8B5A2B]' : 'bg-white text-[#5D4037] border-[#E8DED0] hover:border-[#C8A47A]'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-[#FCFAF7] border border-[#EFE6DA] p-2.5">
              <div className="text-[11px] uppercase tracking-wide font-bold text-[#8B5A2B] mb-2 flex items-center gap-1.5">
                <Leaf className="w-3.5 h-3.5" /> Diet & Specials
              </div>
              <div className="space-y-1">
                <button onClick={() => selectVeg('all')} className={`${navBtnBase} ${filterVeg === 'all' ? 'bg-[#3E2723] text-white border-[#3E2723]' : 'bg-white text-[#5D4037] border-[#E8DED0] hover:border-[#3E2723]/40'}`}>All</button>
                <button onClick={() => selectVeg('veg')} className={`${navBtnBase} ${filterVeg === 'veg' ? 'bg-green-700 text-white border-green-700' : 'bg-white text-[#5D4037] border-[#E8DED0] hover:border-green-700'}`}>Veg</button>
                <button onClick={() => selectVeg('non-veg')} className={`${navBtnBase} ${filterVeg === 'non-veg' ? 'bg-red-700 text-white border-red-700' : 'bg-white text-[#5D4037] border-[#E8DED0] hover:border-red-700'}`}>Non-Veg</button>
                <button onClick={() => selectVeg('special')} className={`${navBtnBase} inline-flex items-center gap-1.5 ${filterVeg === 'special' ? 'bg-[#C8A47A] text-[#2D1B10] border-[#C8A47A]' : 'bg-white text-[#5D4037] border-[#E8DED0] hover:border-[#C8A47A]'}`}><Sparkles className="w-3 h-3" /> Special</button>
              </div>
            </div>

            <div className="rounded-lg bg-[#FCFAF7] border border-[#EFE6DA] p-2.5">
              <div className="text-[11px] uppercase tracking-wide font-bold text-[#8B5A2B] mb-2 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" /> Cuisine
              </div>
              <div className="space-y-1">
                {cuisines.map((cuisine) => (
                  <button
                    key={cuisine}
                    onClick={() => selectCuisine(cuisine)}
                    className={`${navBtnBase} ${filterCuisine === cuisine ? 'bg-[#8B5A2B] text-white border-[#8B5A2B]' : 'bg-white text-[#5D4037] border-[#E8DED0] hover:border-[#C8A47A]'}`}
                  >
                    {cuisine === 'all' ? 'All Cuisines' : cuisine}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}