import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Minus, Search, X, Sparkles, Flame, Clock, Tag, ShoppingBag, ArrowRight, RotateCcw, ChevronDown, Grid3X3, Leaf, Globe } from 'lucide-react';
import type { MenuItem } from '@/client/app/data/menuData';
import { categories as sampleCategories, menuData } from '@/client/app/data/menuData';
import { fetchMenuCategories, fetchMenuItems } from '@/client/api/menu';
import { MenuItemImage } from '@/client/app/components/MenuItemImage';
import TopAppBar from '@/client/app/components/TopAppBar';
import type { CartItem } from '@/client/app/App';
import menuBg from '@/client/assets/4b8f78df70182590282085e8c94bb5315bb0108c.png';

interface KioskMenuProps {
  onAddToCart: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  onGoToCart: () => void;
  cartCount: number;
  cart: CartItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
}

type VegFilter = 'all' | 'veg' | 'non-veg' | 'special';
type CuisineFilter = 'all' | 'North Indian' | 'South Indian' | 'Chinese' | 'Italian' | 'Continental';

const cuisines: CuisineFilter[] = ['all', 'North Indian', 'South Indian', 'Chinese', 'Italian', 'Continental'];
const navBtnBase = 'w-full text-left px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors';

export default function KioskMenu({ onAddToCart, onGoToCart, cartCount, cart, onUpdateQuantity, onRemoveItem }: KioskMenuProps) {
  const [categories, setCategories] = useState<string[]>(['All']);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [filterVeg, setFilterVeg] = useState<VegFilter>('all');
  const [filterCuisine, setFilterCuisine] = useState<CuisineFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [mounted, setMounted] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterWrapRef = useRef<HTMLDivElement>(null);
  const [customization, setCustomization] = useState({
    spiceLevel: 'medium',
    addons: [] as string[],
    specialInstructions: '',
    quantity: 1,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onDocClick = (ev: MouseEvent) => {
      if (!filterWrapRef.current) return;
      if (!filterWrapRef.current.contains(ev.target as Node)) {
        setFiltersOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cuisineLookup = new Map<string, MenuItem['cuisine']>(
      menuData.map((m) => [m.name.toLowerCase(), m.cuisine]),
    );

    Promise.all([fetchMenuCategories(), fetchMenuItems()])
      .then(([cats, items]) => {
        if (cancelled) return;
        setCategories(cats);
        const enriched = items.map((item) =>
          item.cuisine ? item : { ...item, cuisine: cuisineLookup.get(item.name.toLowerCase()) },
        );
        setMenuItems(enriched);
      })
      .catch(() => {
        if (cancelled) return;
        setCategories(sampleCategories);
        setMenuItems(menuData);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const categoryMatch = selectedCategory === 'All' || item.category === selectedCategory;
      const vegMatch =
        filterVeg === 'all' ||
        (filterVeg === 'veg' && item.isVeg) ||
        (filterVeg === 'non-veg' && !item.isVeg) ||
        (filterVeg === 'special' && item.todaysSpecial);
      const cuisineMatch = filterCuisine === 'all' || item.cuisine === filterCuisine;
      const searchMatch =
        searchQuery === '' ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return categoryMatch && vegMatch && cuisineMatch && searchMatch && item.available;
    });
  }, [filterCuisine, filterVeg, menuItems, searchQuery, selectedCategory]);

  const cartTotal = useMemo(() => cart.reduce((sum, c) => sum + c.price * c.quantity, 0), [cart]);

  const allAddons = [
    { id: 'extra-cheese', name: 'Extra Cheese', price: 50 },
    { id: 'extra-paneer', name: 'Extra Paneer', price: 80 },
    { id: 'extra-chicken', name: 'Extra Chicken', price: 100 },
    { id: 'butter-on-top', name: 'Butter on Top', price: 30 },
  ];

  const addons = allAddons.filter((addon) => {
    if (!selectedItem) return true;
    const cat = selectedItem.category;
    const isVeg = selectedItem.isVeg;
    const foodCats = ['Starters', 'Main Course', 'Breads', 'Sides'];
    if (!foodCats.includes(cat)) return false;
    if (addon.id === 'extra-cheese') return ['Starters', 'Main Course', 'Breads'].includes(cat);
    if (addon.id === 'extra-paneer') return isVeg && ['Starters', 'Main Course'].includes(cat);
    if (addon.id === 'extra-chicken') return !isVeg && ['Starters', 'Main Course'].includes(cat);
    if (addon.id === 'butter-on-top') return ['Breads', 'Main Course'].includes(cat);
    return true;
  });

  const handleAddToCart = () => {
    if (!selectedItem) return;
    const cartItem: Omit<CartItem, 'quantity'> & { quantity?: number } = {
      id: `${selectedItem.id}-${Date.now()}`,
      name: selectedItem.name,
      price: selectedItem.price,
      image: selectedItem.image,
      isVeg: selectedItem.isVeg,
      spiceLevel: customization.spiceLevel,
      addons: customization.addons,
      specialInstructions: customization.specialInstructions,
      quantity: customization.quantity,
    };

    onAddToCart(cartItem);
    setSelectedItem(null);
    setCustomization({ spiceLevel: 'medium', addons: [], specialInstructions: '', quantity: 1 });
  };

  const handleQuickAdd = (item: MenuItem) => {
    onAddToCart({
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.image,
      isVeg: item.isVeg,
      quantity: 1,
    });
  };

  const getCartQuantity = (itemId: string) => {
    const c = cart.find((ci) => ci.id === itemId);
    return c ? c.quantity : 0;
  };

  const resetFilters = () => {
    setSelectedCategory('All');
    setFilterVeg('all');
    setFilterCuisine('all');
    setSearchQuery('');
  };

  const selectCategory = (value: string) => {
    setSelectedCategory(value);
    setFiltersOpen(false);
  };

  const selectVeg = (value: VegFilter) => {
    setFilterVeg(value);
    setFiltersOpen(false);
  };

  const selectCuisine = (value: CuisineFilter) => {
    setFilterCuisine(value);
    setFiltersOpen(false);
  };

  const renderFiltersMenu = (isSidebar = false) => {
    const wrapperClass = isSidebar
      ? 'space-y-3'
      : 'grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4';
    const sectionClass = isSidebar
      ? 'rounded-xl bg-[#FCFAF7] border border-[#EFE6DA] p-3'
      : 'rounded-lg bg-[#FCFAF7] border border-[#EFE6DA] p-2.5';

    return (
      <div className={wrapperClass}>
        <div className={sectionClass}>
          <div className="text-[11px] uppercase tracking-wide font-bold text-[#8B5A2B] mb-2 flex items-center gap-1.5">
            <Grid3X3 className="w-3.5 h-3.5" /> Categories
          </div>
          <div className="space-y-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => selectCategory(cat)}
                className={`${navBtnBase} hover:bg-[#f5f5f5] ${selectedCategory === cat ? 'bg-[#8B5A2B] text-white border-[#8B5A2B]' : 'bg-white text-[#5D4037] border-[#E8DED0] hover:border-[#C8A47A]'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className={sectionClass}>
          <div className="text-[11px] uppercase tracking-wide font-bold text-[#8B5A2B] mb-2 flex items-center gap-1.5">
            <Leaf className="w-3.5 h-3.5" /> Diet & Specials
          </div>
          <div className="space-y-1">
            <button onClick={() => selectVeg('all')} className={`${navBtnBase} hover:bg-[#f5f5f5] ${filterVeg === 'all' ? 'bg-[#3E2723] text-white border-[#3E2723]' : 'bg-white text-[#5D4037] border-[#E8DED0] hover:border-[#3E2723]/40'}`}>All</button>
            <button onClick={() => selectVeg('veg')} className={`${navBtnBase} hover:bg-[#f5f5f5] ${filterVeg === 'veg' ? 'bg-green-700 text-white border-green-700' : 'bg-white text-[#5D4037] border-[#E8DED0] hover:border-green-700'}`}>Veg</button>
            <button onClick={() => selectVeg('non-veg')} className={`${navBtnBase} hover:bg-[#f5f5f5] ${filterVeg === 'non-veg' ? 'bg-red-700 text-white border-red-700' : 'bg-white text-[#5D4037] border-[#E8DED0] hover:border-red-700'}`}>Non-Veg</button>
            <button onClick={() => selectVeg('special')} className={`${navBtnBase} inline-flex items-center gap-1.5 hover:bg-[#f5f5f5] ${filterVeg === 'special' ? 'bg-[#C8A47A] text-[#2D1B10] border-[#C8A47A]' : 'bg-white text-[#5D4037] border-[#E8DED0] hover:border-[#C8A47A]'}`}><Sparkles className="w-3 h-3" /> Special</button>
          </div>
        </div>

        <div className={sectionClass}>
          <div className="text-[11px] uppercase tracking-wide font-bold text-[#8B5A2B] mb-2 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" /> Cuisine
          </div>
          <div className="space-y-1">
            {cuisines.map((cuisine) => (
              <button
                key={cuisine}
                onClick={() => selectCuisine(cuisine)}
                className={`${navBtnBase} hover:bg-[#f5f5f5] ${filterCuisine === cuisine ? 'bg-[#8B5A2B] text-white border-[#8B5A2B]' : 'bg-white text-[#5D4037] border-[#E8DED0] hover:border-[#C8A47A]'}`}
              >
                {cuisine === 'all' ? 'All Cuisines' : cuisine}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen bg-[#FAF7F2] transition-opacity duration-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
      <section className="relative py-4 sm:py-6 px-3 sm:px-5 min-h-screen overflow-hidden">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-[#FAF7F2]" />
          <div className="absolute inset-0 opacity-15 saturate-[1.2]">
            <img src={menuBg} alt="Menu background" className="w-full h-full object-cover scale-105" />
          </div>
          <div className="absolute inset-0 bg-[#EADBC8]/30 mix-blend-multiply" />
          <div className="absolute inset-0 backdrop-blur-[1px]" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#FAF7F2] via-transparent to-[#FAF7F2]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="space-y-4">
            {/* Top App Bar */}
            <TopAppBar
              title="Urban Bites"
              centerSlot={
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B5A2B]/60" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for your favorite dish..."
                    className="w-full pl-9 pr-9 py-2 border border-[#E8DED0] bg-white rounded-lg focus:outline-none focus:border-[#8B5A2B] focus:ring-2 focus:ring-[#8B5A2B]/10 transition-all text-sm"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B5A2B]/60 hover:text-[#8B5A2B]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              }
              rightSlot={
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={() => setFiltersOpen((v) => !v)}
                    className={`md:hidden inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap ${
                      filtersOpen
                        ? 'bg-[#8B5A2B] text-white border-[#8B5A2B]'
                        : 'bg-[#FCFAF7] text-[#6D4C41] border-[#E8DED0] hover:border-[#C8A47A] hover:text-[#8B5A2B]'
                    }`}
                  >
                    <span className="hidden sm:inline">Browse Categories</span>
                    <span className="sm:hidden">Browse</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <button
                    onClick={onGoToCart}
                    disabled={cartCount === 0}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg border font-semibold text-[10px] sm:text-xs transition-all whitespace-nowrap ${
                      cartCount > 0
                        ? 'bg-[#3E2723] text-white border-[#3E2723] hover:bg-[#5D4037]'
                        : 'bg-[#FAF7F2] text-[#8B5A2B]/50 border-[#E8DED0] cursor-not-allowed'
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>{cartCount}</span>
                    <span className="hidden sm:inline">₹{cartTotal}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              }
            />

            {/* Mobile Filter Dropdown */}
            <div ref={filterWrapRef} className="relative md:hidden">
              {filtersOpen && (
                <div className="absolute inset-x-0 mt-2 bg-white border border-[#E8DED0] rounded-xl shadow-[0_12px_40px_rgba(62,39,35,0.18)] p-3 sm:p-4 z-30">
                  {renderFiltersMenu(false)}
                </div>
              )}
            </div>

            <div className="flex gap-5 items-start mt-3">
              <aside className="hidden md:block w-[260px] shrink-0">
                <div className="sticky top-20 h-[calc(100vh-80px)] overflow-y-auto bg-white p-4 rounded-xl border border-[#E8DED0] shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
                  {renderFiltersMenu(true)}
                </div>
              </aside>

              <div className="flex-1 min-w-0">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-5">
            {filteredItems.map((item) => {
              const qty = getCartQuantity(item.id);
              return (
                <div
                  key={item.id}
                  className="group relative bg-[#2D1B10] rounded-2xl overflow-hidden border border-[#C8A47A]/30 shadow-xl hover:shadow-[#C8A47A]/20 transition-all duration-300 flex flex-col min-h-[420px] hover:-translate-y-1"
                >
                  <div className="relative h-52 bg-[#1A110D] overflow-hidden">
                    <MenuItemImage
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
                    />

                    <div className="absolute top-2.5 left-2.5 z-10">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
                          item.isVeg ? 'bg-green-600/90 text-white' : 'bg-red-600/90 text-white'
                        }`}
                      >
                        {item.isVeg ? 'Vegetarian' : 'Non-Veg'}
                      </span>
                    </div>

                    <div className="absolute top-2.5 right-2.5 z-10 flex flex-col gap-1">
                      {item.todaysSpecial && (
                        <span className="bg-[#C8A47A] text-[#2D1B10] px-2.5 py-1 rounded-full text-[10px] font-semibold shadow-md flex items-center gap-1 uppercase tracking-wide">
                          <Sparkles className="w-3 h-3" />
                          Special
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-3 flex flex-col flex-grow">
                    <h3 className="font-semibold text-base text-[#FAF7F2] group-hover:text-[#C8A47A] transition-colors duration-300 line-clamp-1">
                      {item.name}
                    </h3>
                    <p className="text-xs text-[#EADBC8]/70 mt-1.5 mb-3.5 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>

                    <div className="flex items-center gap-3 mb-3.5 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Flame className="w-4 h-4 text-[#C8A47A]/70" strokeWidth={1.5} />
                        <span className="text-xs text-[#EADBC8]/60 font-medium">{item.calories} kcal</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-[#C8A47A]/70" strokeWidth={1.5} />
                        <span className="text-xs text-[#EADBC8]/60 font-medium">{item.prepTime}</span>
                      </div>
                      {item.offer && (
                        <div className="flex items-center gap-1.5">
                          <Tag className="w-4 h-4 text-[#C8A47A]/70" strokeWidth={1.5} />
                          <span className="text-xs text-[#C8A47A] font-semibold">{item.offer}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-auto flex items-end justify-between border-t border-[#C8A47A]/20 pt-3 gap-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-[#C8A47A] uppercase tracking-wide font-bold mb-1">Price</span>
                        <span className="text-xl font-bold text-[#FAF7F2]">₹{item.price}</span>
                      </div>

                      <div className="flex gap-1.5 min-w-0">
                        {qty > 0 ? (
                          <div className="flex items-center border border-[#C8A47A]/30 rounded-xl overflow-hidden">
                            <button
                              onClick={() => {
                                if (qty <= 1) onRemoveItem(item.id);
                                else onUpdateQuantity(item.id, qty - 1);
                              }}
                              className="w-7.5 h-7.5 flex items-center justify-center bg-[#3E2723] text-[#C8A47A] hover:bg-[#C8A47A] hover:text-[#2D1B10] transition-all"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-7.5 h-7.5 flex items-center justify-center text-[#FAF7F2] font-semibold text-xs bg-[#3E2723]">
                              {qty}
                            </span>
                            <button
                              onClick={() => onUpdateQuantity(item.id, qty + 1)}
                              className="w-7.5 h-7.5 flex items-center justify-center bg-[#3E2723] text-[#C8A47A] hover:bg-[#C8A47A] hover:text-[#2D1B10] transition-all"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleQuickAdd(item)}
                            className="w-7.5 h-7.5 flex-shrink-0 flex items-center justify-center bg-[#3E2723] text-[#C8A47A] border border-[#C8A47A]/30 rounded-xl hover:bg-[#C8A47A] hover:text-[#2D1B10] transition-all"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={() => setSelectedItem(item)}
                          className="px-2 py-1.5 bg-gradient-to-r from-[#8B5A2B] to-[#C8A47A] text-[#FAF7F2] rounded-xl hover:shadow-[0_10px_20px_-10px_rgba(200,164,122,0.5)] transition-all text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap"
                        >
                          Customize
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
                </div>

                {filteredItems.length === 0 && (
                  <div className="text-center py-14 bg-white/10 backdrop-blur-md rounded-3xl border-2 border-dashed border-[#E8DED0] mt-4">
                    <div className="flex flex-col items-center">
                      <Search className="w-8 h-8 text-[#8B5A2B] mb-5" />
                      <h3 className="text-2xl font-semibold text-[#3E2723] mb-2">No dishes found</h3>
                      <p className="text-[#6D4C41] text-sm mb-6 max-w-md">We could not find any menu items matching these filters.</p>
                      <button
                        onClick={resetFilters}
                        className="px-6 py-3 bg-[#8B5A2B] text-white rounded-full font-semibold uppercase tracking-wider hover:bg-[#3E2723] transition-all inline-flex items-center gap-2 text-xs"
                      >
                        <RotateCcw className="w-4 h-4" />
                        View Full Menu
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {selectedItem && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto animate-[slideUp_0.3s_ease-out]">
            <div className="relative h-48 sm:h-56 overflow-hidden sm:rounded-t-2xl">
              <MenuItemImage
                src={selectedItem.image}
                alt={selectedItem.name}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setSelectedItem(null)}
                className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full p-2 hover:bg-white transition-colors"
              >
                <X className="w-5 h-5 text-[#3E2723]" />
              </button>
              <div className={`absolute bottom-3 left-3 w-5 h-5 rounded-sm border-2 flex items-center justify-center bg-white ${selectedItem.isVeg ? 'border-green-600' : 'border-red-600'}`}>
                <div className={`w-2.5 h-2.5 rounded-full ${selectedItem.isVeg ? 'bg-green-600' : 'bg-red-600'}`} />
              </div>
            </div>

            <div className="p-5">
              <div className="flex items-start justify-between mb-2">
                <h2 className="text-xl font-bold text-[#3E2723]">{selectedItem.name}</h2>
                <span className="text-lg font-bold text-[#8B5A2B]">₹{selectedItem.price}</span>
              </div>
              <p className="text-sm text-gray-500 mb-4">{selectedItem.description}</p>
              <div className="flex items-center gap-4 text-xs text-gray-400 mb-5">
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{selectedItem.prepTime}</span>
                <span>{selectedItem.calories} kcal</span>
              </div>

              <div className="mb-4">
                <p className="text-sm font-semibold text-[#3E2723] mb-2">Spice Level</p>
                <div className="flex gap-2">
                  {['mild', 'medium', 'spicy', 'extra-spicy'].map((level) => (
                    <button
                      key={level}
                      onClick={() => setCustomization((p) => ({ ...p, spiceLevel: level }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize border transition-all ${
                        customization.spiceLevel === level
                          ? 'bg-[#8B5A2B] text-white border-[#8B5A2B]'
                          : 'bg-white text-[#5D4037] border-[#E8D5B5] hover:bg-[#FAF0E4]'
                      }`}
                    >
                      {level.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {addons.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-semibold text-[#3E2723] mb-2">Add-ons</p>
                  <div className="space-y-2">
                    {addons.map((addon) => (
                      <label key={addon.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#FAF0E4] cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={customization.addons.includes(addon.name)}
                          onChange={() => {
                            setCustomization((p) => ({
                              ...p,
                              addons: p.addons.includes(addon.name)
                                ? p.addons.filter((a) => a !== addon.name)
                                : [...p.addons, addon.name],
                            }));
                          }}
                          className="w-4 h-4 rounded border-[#E8D5B5] text-[#8B5A2B] focus:ring-[#C8A47A]"
                        />
                        <span className="text-sm text-[#3E2723] flex-1">{addon.name}</span>
                        <span className="text-xs text-[#8B5A2B] font-semibold">+₹{addon.price}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-5">
                <p className="text-sm font-semibold text-[#3E2723] mb-2">Special Instructions</p>
                <textarea
                  value={customization.specialInstructions}
                  onChange={(e) => setCustomization((p) => ({ ...p, specialInstructions: e.target.value }))}
                  placeholder="Any special requests? (optional)"
                  rows={2}
                  className="w-full px-3 py-2 border border-[#E8D5B5] rounded-lg text-sm text-[#3E2723] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C8A47A] resize-none"
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 bg-[#FAF0E4] rounded-xl px-3 py-2">
                  <button
                    onClick={() => setCustomization((p) => ({ ...p, quantity: Math.max(1, p.quantity - 1) }))}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-[#8B5A2B] font-bold hover:bg-[#E8D5B5] transition-colors"
                  >
                    -
                  </button>
                  <span className="w-8 text-center font-bold text-[#3E2723]">{customization.quantity}</span>
                  <button
                    onClick={() => setCustomization((p) => ({ ...p, quantity: p.quantity + 1 }))}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-[#8B5A2B] font-bold hover:bg-[#E8D5B5] transition-colors"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={handleAddToCart}
                  className="flex-1 py-3 bg-[#3E2723] text-white rounded-xl font-bold text-sm hover:bg-[#5D4037] transition-all active:scale-95 shadow-lg"
                >
                  Add to Cart - ₹{selectedItem.price * customization.quantity}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
