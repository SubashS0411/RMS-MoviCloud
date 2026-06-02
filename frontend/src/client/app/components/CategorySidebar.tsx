import { useState } from 'react';
import { Filter, Sparkles, SlidersHorizontal, X } from 'lucide-react';

export type VegFilter = 'all' | 'veg' | 'non-veg' | 'special';
export type CuisineFilter = 'all' | 'North Indian' | 'South Indian' | 'Chinese' | 'Italian' | 'Continental';

interface CategorySidebarProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  filterVeg: VegFilter;
  onFilterVegChange: (value: VegFilter) => void;
  filterCuisine: CuisineFilter;
  onFilterCuisineChange: (value: CuisineFilter) => void;
}

const cuisines: CuisineFilter[] = ['all', 'North Indian', 'South Indian', 'Chinese', 'Italian', 'Continental'];

function SidebarContent({
  categories,
  selectedCategory,
  onSelectCategory,
  filterVeg,
  onFilterVegChange,
  filterCuisine,
  onFilterCuisineChange,
}: CategorySidebarProps) {
  return (
    <div className="space-y-4 bg-white/95 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-[#E8DED0] shadow-[0_8px_24px_rgba(62,39,35,0.08)]">
      <div>
        <div className="flex items-center gap-2 mb-2.5 px-1">
          <div className="p-1.5 bg-[#8B5A2B]/10 rounded-md">
            <Filter className="w-3.5 h-3.5 text-[#8B5A2B]" />
          </div>
          <span className="font-semibold text-[#3E2723] text-sm">Browse Categories</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => onSelectCategory(category)}
              className={`group w-full text-left px-3 py-2 rounded-lg border transition-all duration-200 font-semibold text-[11px] uppercase tracking-wide ${
                selectedCategory === category
                  ? 'bg-[#8B5A2B] text-white border-[#8B5A2B] shadow-sm shadow-[#8B5A2B]/30'
                  : 'bg-[#FCFAF7] text-[#6D4C41] border-[#E8DED0] hover:border-[#C8A47A] hover:bg-[#F8F2EA] hover:text-[#5A3D2A]'
              }`}
              aria-pressed={selectedCategory === category}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-3 border-t border-[#E8DED0]">
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => onFilterVegChange('all')}
            className={`w-full text-left px-3 py-2 rounded-lg border transition-all font-semibold uppercase tracking-wide text-[11px] ${
              filterVeg === 'all'
                ? 'bg-[#3E2723] text-white border-[#3E2723] shadow-sm shadow-[#3E2723]/20'
                : 'bg-[#FCFAF7] text-[#6D4C41] border-[#E8DED0] hover:border-[#3E2723]/40 hover:bg-[#F8F2EA]'
            }`}
          >
            All
          </button>
          <button
            onClick={() => onFilterVegChange('veg')}
            className={`w-full text-left px-3 py-2 rounded-lg border transition-all font-semibold uppercase tracking-wide text-[11px] ${
              filterVeg === 'veg'
                ? 'bg-green-700 text-white border-green-700 shadow-sm shadow-green-700/20'
                : 'bg-[#FCFAF7] text-[#6D4C41] border-[#E8DED0] hover:border-green-700 hover:text-green-700 hover:bg-[#F8F2EA]'
            }`}
          >
            Veg
          </button>
          <button
            onClick={() => onFilterVegChange('non-veg')}
            className={`w-full text-left px-3 py-2 rounded-lg border transition-all font-semibold uppercase tracking-wide text-[11px] ${
              filterVeg === 'non-veg'
                ? 'bg-red-700 text-white border-red-700 shadow-sm shadow-red-700/20'
                : 'bg-[#FCFAF7] text-[#6D4C41] border-[#E8DED0] hover:border-red-700 hover:text-red-700 hover:bg-[#F8F2EA]'
            }`}
          >
            Non-Veg
          </button>
          <button
            onClick={() => onFilterVegChange('special')}
            className={`w-full text-left px-3 py-2 rounded-lg border transition-all font-semibold uppercase tracking-wide text-[11px] flex items-center gap-2 ${
              filterVeg === 'special'
                ? 'bg-[#C8A47A] text-[#2D1B10] border-[#C8A47A] shadow-sm shadow-[#C8A47A]/25'
                : 'bg-[#FCFAF7] text-[#6D4C41] border-[#E8DED0] hover:border-[#C8A47A] hover:text-[#8B5A2B] hover:bg-[#F8F2EA]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Special
          </button>
        </div>
      </div>

      <div className="pt-3 border-t border-[#E8DED0]">
        <div className="flex flex-col gap-1.5">
          {cuisines.map((cuisine) => (
            <button
              key={cuisine}
              onClick={() => onFilterCuisineChange(cuisine)}
              className={`w-full text-left px-3 py-2 rounded-lg border transition-all duration-200 font-semibold text-[11px] uppercase tracking-wide ${
                filterCuisine === cuisine
                  ? 'bg-[#8B5A2B] text-white border-[#8B5A2B] shadow-sm shadow-[#8B5A2B]/30'
                  : 'bg-[#FCFAF7] text-[#6D4C41] border-[#E8DED0] hover:border-[#C8A47A] hover:text-[#8B5A2B] hover:bg-[#F8F2EA]'
              }`}
              aria-pressed={filterCuisine === cuisine}
            >
              {cuisine === 'all' ? 'All Cuisines' : cuisine}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CategorySidebar(props: CategorySidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="lg:hidden mb-3">
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#E8DED0] bg-white/95 text-[#3E2723] text-xs font-semibold shadow-sm"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
        </button>
      </div>

      <aside className="hidden lg:block lg:sticky lg:top-20 h-fit">
        <SidebarContent {...props} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-label="Close filters"
          />
          <div className="absolute left-0 top-0 h-full w-[84%] max-w-sm bg-[#FAF7F2] p-3.5 overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#3E2723]">Filters</h3>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-md bg-white border border-[#E8DED0] text-[#3E2723]"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <SidebarContent {...props} />
          </div>
        </div>
      )}
    </>
  );
}