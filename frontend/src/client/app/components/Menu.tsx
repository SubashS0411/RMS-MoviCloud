import { useEffect, useMemo, useState } from 'react';
import { Plus, Minus, Search, X, Sparkles, Flame, Clock, Tag, Heart, ShoppingBag, ArrowRight } from 'lucide-react';
import type { MenuItem } from '@/client/app/data/menuData';
import { categories as sampleCategories, menuData } from '@/client/app/data/menuData';
import { fetchMenuCategories, fetchMenuItems } from '@/client/api/menu';
import { ImageWithFallback } from '@/client/app/components/figma/ImageWithFallback';
import { MenuItemImage } from '@/client/app/components/MenuItemImage';
import MenuFilterNavbar from '@/client/app/components/MenuFilterNavbar';
import Chatbot from '@/client/app/components/Chatbot';
import type { CartItem, Module, User } from '@/client/app/App';

// SVGs and Assets
import heroBg from "@/client/assets/2c8239e1376971b845c90972145e9e96fe335998.png";
import menuBg from "@/client/assets/4b8f78df70182590282085e8c94bb5315bb0108c.png";
import quoteBg from "@/client/assets/c253e00ec7272fbcda6f2e745e4614e3759cee54.png";

interface MenuProps {
  isLoggedIn: boolean;
  user?: User;
  cart: CartItem[];
  onAddToCart: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
  onNavigate: (module: Module) => void;
  onToggleFavorite: (itemId: string) => void;
}

export default function Menu({ isLoggedIn, user, cart, onAddToCart, onUpdateQuantity, onRemoveItem, onNavigate, onToggleFavorite }: MenuProps) {
  const [categories, setCategories] = useState<string[]>(sampleCategories);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(menuData);

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [filterVeg, setFilterVeg] = useState<'all' | 'veg' | 'non-veg' | 'special'>('all');
  const [filterCuisine, setFilterCuisine] = useState<'all' | 'North Indian' | 'South Indian' | 'Chinese' | 'Italian' | 'Continental'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [customization, setCustomization] = useState({
    spiceLevel: 'medium',
    addons: [] as string[],
    specialInstructions: '',
    quantity: 1
  });

  useEffect(() => {
    let cancelled = false;
    // Build a name→cuisine lookup from the static seed data as a fallback
    const cuisineLookup = new Map<string, MenuItem['cuisine']>(
      menuData.map(m => [m.name.toLowerCase(), m.cuisine])
    );

    // Keep the page responsive immediately using local data.
    setCategories(sampleCategories);
    setMenuItems(menuData);

    // Refresh categories and items in the background when the API responds.
    fetchMenuCategories()
      .then((cats) => {
        if (!cancelled && Array.isArray(cats) && cats.length > 0) {
          setCategories(cats);
        }
      })
      .catch(() => {});

    fetchMenuItems()
      .then((items) => {
        if (cancelled || !Array.isArray(items) || items.length === 0) return;
        // Enrich items that came back without a cuisine field
        const enriched = items.map(item =>
          item.cuisine ? item : { ...item, cuisine: cuisineLookup.get(item.name.toLowerCase()) }
        );
        setMenuItems(enriched);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      const categoryMatch = selectedCategory === 'All' || item.category === selectedCategory;
      const vegMatch =
        filterVeg === 'all' ||
        (filterVeg === 'veg' && item.isVeg) ||
        (filterVeg === 'non-veg' && !item.isVeg) ||
        (filterVeg === 'special' && item.todaysSpecial);
      const cuisineMatch =
        filterCuisine === 'all' || item.cuisine === filterCuisine;
      const searchMatch =
        searchQuery === '' ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return categoryMatch && vegMatch && cuisineMatch && searchMatch;
    });
  }, [filterCuisine, filterVeg, menuItems, searchQuery, selectedCategory]);

  const cartTotal = useMemo(() => cart.reduce((sum, c) => sum + c.price * c.quantity, 0), [cart]);

  const allAddons = [
    { id: 'extra-cheese', name: 'Extra Cheese', price: 50 },
    { id: 'extra-paneer', name: 'Extra Paneer', price: 80 },
    { id: 'extra-chicken', name: 'Extra Chicken', price: 100 },
    { id: 'butter-on-top', name: 'Butter on Top', price: 30 }
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
    if (!selectedItem || !isLoggedIn) return;

    const cartItem: Omit<CartItem, 'quantity'> & { quantity?: number } = {
      id: `${selectedItem.id}-${Date.now()}`,
      name: selectedItem.name,
      price: selectedItem.price,
      image: selectedItem.image,
      isVeg: selectedItem.isVeg,
      spiceLevel: customization.spiceLevel,
      addons: customization.addons,
      specialInstructions: customization.specialInstructions,
      quantity: customization.quantity
    };

    onAddToCart(cartItem);
    setSelectedItem(null);
    setCustomization({
      spiceLevel: 'medium',
      addons: [],
      specialInstructions: '',
      quantity: 1
    });
  };

  const getCartQuantity = (itemId: string) => {
    const cartItem = cart.find(c => c.id === itemId);
    return cartItem ? cartItem.quantity : 0;
  };

  const quickAddToCart = (item: MenuItem) => {
    if (!isLoggedIn) {
      onNavigate('login');
      return;
    }

    const cartItem: Omit<CartItem, 'quantity'> & { quantity?: number } = {
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.image,
      isVeg: item.isVeg,
      quantity: 1
    };

    onAddToCart(cartItem);
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* SECTION 1 — HERO HEADER */}
      <section className="relative w-full min-h-[80vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <ImageWithFallback
            src={heroBg}
            alt="Restaurant Menu Hero"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/50"></div>
        </div>
        <div className="relative z-10 max-w-4xl mx-auto text-center px-6">
          <h1 
            className="text-3xl sm:text-5xl md:text-7xl font-bold mb-4 sm:mb-6 text-white" 
           
          >
            A Menu Crafted for True Food Lovers
          </h1>
          <p className="text-xl md:text-2xl text-white/90 font-light mb-4">
            Where every dish tells a story of flavor, passion, and authenticity.
          </p>
          <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto italic font-light">
            “From carefully selected ingredients to thoughtfully prepared meals, 
            our menu is designed to offer an unforgettable dining experience.”
          </p>
        </div>
      </section>

      {/* SECTION 2 — SUBHEADER (NOW WITH BACKGROUND IMAGE) */}
      <section className="relative py-10 sm:py-14 px-4 sm:px-6 overflow-hidden">
        {/* Background Image with Overlay for Premium feel */}
        <div className="absolute inset-0 z-0">
          <ImageWithFallback
            src={quoteBg}
            alt="Quote Background"
            className="w-full h-full object-cover"
          />
          {/* Subtle gradient overlay to blend with the theme and ensure readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#3E2723]/90 via-[#3E2723]/70 to-transparent"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-left md:text-center md:mx-auto">
          <div className="inline-block mb-6 p-1 bg-[#C8A47A] rounded-full px-4">
             <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#3E2723]">Culinary Philosophy</span>
          </div>
          <h2 
            className="text-2xl sm:text-4xl md:text-5xl italic text-white mb-4 sm:mb-6 leading-tight drop-shadow-lg" 
           
          >
            “People who love to eat are always the best people.”
          </h2>
          <div className="flex items-center md:justify-center gap-4">
            <div className="h-px w-12 bg-[#C8A47A]"></div>
            <p className="text-[#C8A47A] font-black tracking-[0.4em] uppercase text-xs">
              — Julia Child
            </p>
            <div className="h-px w-12 bg-[#C8A47A]"></div>
          </div>
        </div>
        
        {/* Decorative corner accent */}
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-gradient-to-tl from-[#C8A47A]/20 to-transparent pointer-events-none"></div>
      </section>

      {/* SECTION 3 — FOOD MENU LIST (WITH FIXED BACKGROUND) */}
      <section className="relative py-6 sm:py-10 px-3 sm:px-6 min-h-screen overflow-hidden">
        {/* IMPROVED BACKGROUND VISIBILITY */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-[#FAF7F2]"></div>
          
          <div className="absolute inset-0 opacity-15 saturate-[1.2]">
            <ImageWithFallback
              src={menuBg}
              alt="Menu Background"
              className="w-full h-full object-cover scale-105"
            />
          </div>
          
          <div className="absolute inset-0 bg-[#EADBC8]/30 mix-blend-multiply"></div>
          <div className="absolute inset-0 backdrop-blur-[1px]"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-[#FAF7F2] via-transparent to-[#FAF7F2]"></div>
        </div>

        <div className="relative z-10 max-w-[1500px] mx-auto">
          <div className="space-y-4">
            <MenuFilterNavbar
              appName="Urban Bites"
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              filterVeg={filterVeg}
              onFilterVegChange={setFilterVeg}
              filterCuisine={filterCuisine}
              onFilterCuisineChange={setFilterCuisine}
              centerSlot={
                <div className="relative">
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
                <button
                  onClick={() => onNavigate('cart')}
                  disabled={cart.length === 0}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-semibold text-[10px] sm:text-xs transition-all whitespace-nowrap ${
                    cart.length > 0
                      ? 'bg-[#3E2723] text-white border-[#3E2723] hover:bg-[#5D4037]'
                      : 'bg-[#FAF7F2] text-[#8B5A2B]/50 border-[#E8DED0] cursor-not-allowed'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>{cart.length}</span>
                  <span className="hidden sm:inline">₹{cartTotal}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              }
            />

            <div>
              {/* Menu Items Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="group relative bg-[#2D1B10] rounded-2xl overflow-hidden border border-[#C8A47A]/30 shadow-xl hover:shadow-[#C8A47A]/20 transition-all duration-300 flex flex-col min-h-[420px] hover:-translate-y-1"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-[#3E2723] to-[#2D1B10] opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                <div className="relative h-52 bg-[#1A110D] overflow-hidden">
                  <MenuItemImage
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                  
                  <div className="absolute top-3 left-3 z-10">
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide shadow-lg ${
                        item.isVeg
                          ? 'bg-green-600/90 text-white backdrop-blur-md'
                          : 'bg-red-600/90 text-white backdrop-blur-md'
                      }`}
                    >
                      {item.isVeg ? 'Vegetarian' : 'Non-Veg'}
                    </span>
                  </div>

                  {/* Favorite Heart Button */}
                  {isLoggedIn && user && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(item.id);
                      }}
                      className="absolute bottom-3 left-3 z-10 w-9 h-9 bg-white/20 backdrop-blur-md border border-white/40 rounded-full flex items-center justify-center hover:bg-white/30 transition-all duration-300 active:scale-95 shadow-lg"
                    >
                      <Heart
                        className={`w-4 h-4 transition-all duration-300 ${
                          user.favorites.includes(item.id)
                            ? 'fill-red-500 text-red-500'
                            : 'text-white'
                        }`}
                      />
                    </button>
                  )}
                  
                  <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
                    {item.todaysSpecial && (
                      <span className="bg-[#C8A47A] text-[#2D1B10] px-2.5 py-1 rounded-full text-[10px] font-bold shadow-lg flex items-center gap-1 uppercase tracking-wide animate-pulse">
                        <Sparkles className="w-3 h-3" />
                        Chef's Special
                      </span>
                    )}
                    {item.popular && (
                      <span className="bg-white/10 backdrop-blur-md text-[#FAF7F2] border border-white/20 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide shadow-lg">
                        Best Seller
                      </span>
                    )}
                  </div>

                  {!item.available && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center backdrop-blur-sm z-20">
                      <span className="text-[#FAF7F2] px-8 py-3 border-2 border-[#C8A47A] rounded-full font-black uppercase tracking-[0.3em] text-sm shadow-2xl">
                        Unavailable
                      </span>
                    </div>
                  )}
                </div>

                <div className="relative z-10 p-3 flex flex-col flex-grow">
                  <div className="mb-2">
                    <h3 className="font-bold text-base sm:text-lg text-[#FAF7F2] group-hover:text-[#C8A47A] transition-colors duration-300">
                      {item.name}
                    </h3>
                  </div>
                  <p className="text-xs sm:text-sm text-[#EADBC8]/70 mb-4 line-clamp-2 leading-relaxed font-light">
                    {item.description}
                  </p>
                  
                  {/* Info Row: Calories, Prep Time, and Offers */}
                  <div className="flex items-center gap-3 mb-4 flex-wrap">
                    {/* Calories */}
                    <div className="flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-[#C8A47A]/70" strokeWidth={1.5} />
                      <span className="text-xs text-[#EADBC8]/60 font-medium">{item.calories} kcal</span>
                    </div>
                    
                    {/* Preparation Time */}
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-[#C8A47A]/70" strokeWidth={1.5} />
                      <span className="text-xs text-[#EADBC8]/60 font-medium">{item.prepTime}</span>
                    </div>
                    
                    {/* Offer (conditional) */}
                    {item.offer && (
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-4 h-4 text-[#C8A47A]/70" strokeWidth={1.5} />
                        <span className="text-xs text-[#C8A47A] font-bold">{item.offer}</span>
                      </div>
                    )}
                  </div>
                  
                    <div className="mt-auto flex items-center justify-between border-t border-[#C8A47A]/20 pt-3">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-[#C8A47A] uppercase tracking-wide font-bold mb-1">Price</span>
                      <span className="text-2xl font-black text-[#FAF7F2]">₹{item.price}</span>
                    </div>
                    
                    {isLoggedIn ? (
                      <div className="flex gap-2 min-w-0">
                        {getCartQuantity(item.id) > 0 ? (
                          <div className="flex items-center border border-[#C8A47A]/30 rounded-xl overflow-hidden shadow-lg">
                            <button
                              onClick={() => {
                                const qty = getCartQuantity(item.id);
                                if (qty <= 1) onRemoveItem(item.id);
                                else onUpdateQuantity(item.id, qty - 1);
                              }}
                              className="w-8 h-8 flex items-center justify-center bg-[#3E2723] text-[#C8A47A] hover:bg-[#C8A47A] hover:text-[#2D1B10] transition-all duration-300 active:scale-95"
                            >
                                <Minus className="w-4 h-4" />
                            </button>
                              <span className="w-8 h-8 flex items-center justify-center text-[#FAF7F2] font-bold text-sm bg-[#3E2723]">
                              {getCartQuantity(item.id)}
                            </span>
                            <button
                              onClick={() => onUpdateQuantity(item.id, getCartQuantity(item.id) + 1)}
                                className="w-8 h-8 flex items-center justify-center bg-[#3E2723] text-[#C8A47A] hover:bg-[#C8A47A] hover:text-[#2D1B10] transition-all duration-300 active:scale-95"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => quickAddToCart(item)}
                            disabled={!item.available}
                            className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-[#3E2723] text-[#C8A47A] border border-[#C8A47A]/30 rounded-xl hover:bg-[#C8A47A] hover:text-[#2D1B10] transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg active:scale-95 group/btn"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedItem(item)}
                          disabled={!item.available}
                          className="flex-1 min-w-0 px-2 py-1.5 bg-gradient-to-r from-[#8B5A2B] to-[#C8A47A] text-[#FAF7F2] rounded-xl hover:shadow-[0_10px_20px_-10px_rgba(200,164,122,0.5)] transition-all duration-300 disabled:opacity-30 text-[10px] font-bold uppercase tracking-wide active:scale-95 truncate"
                        >
                          Customize
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onNavigate('login')}
                        className="px-8 py-3 bg-[#3E2723] text-[#C8A47A] border border-[#C8A47A]/50 rounded-xl text-xs font-black uppercase tracking-[0.2em] hover:bg-[#C8A47A] hover:text-[#2D1B10] transition-all duration-300 active:scale-95 shadow-xl"
                      >
                        Login
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
              </div>

              {filteredItems.length === 0 && (
                <div className="text-center py-20 bg-white/10 backdrop-blur-md rounded-[28px] border-2 border-dashed border-[#E8DED0] mt-10 relative overflow-hidden group">
                  <div className="relative z-10 flex flex-col items-center">
                    <Search className="w-10 h-10 text-[#8B5A2B] mb-8" />
                    <h3 className="text-4xl font-bold text-[#3E2723] mb-4">A Quiet Kitchen</h3>
                    <p className="text-[#6D4C41] text-xl font-light mb-10 max-w-md mx-auto">We couldn't find any dishes matching your selection.</p>
                    <button 
                      onClick={() => {
                        setSelectedCategory('All');
                        setFilterVeg('all');
                        setFilterCuisine('all');
                        setSearchQuery('');
                      }}
                      className="px-10 py-4 bg-[#8B5A2B] text-white rounded-full font-black uppercase tracking-widest hover:bg-[#3E2723] transition-all shadow-2xl"
                    >
                      View Full Collection
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Customization Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-[#FAF7F2] rounded-t-[32px] sm:rounded-[40px] max-w-3xl w-full max-h-[92vh] sm:max-h-[90vh] overflow-hidden border border-[#C8A47A]/30 shadow-2xl flex flex-col">
            <div className="bg-[#3E2723] px-5 sm:px-10 py-5 sm:py-8 flex items-center justify-between">
              <div>
                <h2 className="text-2xl sm:text-4xl font-bold text-[#C8A47A]">Tailor Your Taste</h2>
                <p className="text-[#FAF7F2]/60 uppercase tracking-widest text-[10px] font-bold mt-1">{selectedItem.name}</p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 sm:p-10 space-y-6 sm:space-y-10 overflow-y-auto">
              <div className="flex flex-col md:flex-row gap-5 sm:gap-8 items-center md:items-start">
                <div className="w-36 h-36 sm:w-56 sm:h-56 rounded-[24px] sm:rounded-[32px] overflow-hidden bg-[#1A110D] flex-shrink-0 shadow-2xl border-4 border-white">
                  <ImageWithFallback src={selectedItem.image} alt={selectedItem.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col justify-center">
                  <h3 className="text-2xl sm:text-4xl font-bold text-[#3E2723] mb-2 sm:mb-3">{selectedItem.name}</h3>
                  <p className="text-[#6D4C41] mb-3 sm:mb-6 leading-relaxed font-light text-base sm:text-lg italic">"{selectedItem.description}"</p>
                  <p className="text-3xl sm:text-5xl font-black text-[#3E2723]">₹{selectedItem.price}</p>
                </div>
              </div>

              {/* Spice Level */}
              <div className="bg-white/60 p-4 sm:p-8 rounded-[32px] border border-[#E8DED0]">
                <label className="block text-base sm:text-xl font-bold mb-3 sm:mb-6 text-[#3E2723]">Select Heat Level</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {['mild', 'medium', 'hot', 'extra-hot'].map((level) => (
                    <button
                      key={level}
                      onClick={() => setCustomization({ ...customization, spiceLevel: level })}
                      className={`px-4 py-4 rounded-2xl border-2 transition-all capitalize font-black text-xs tracking-widest ${
                        customization.spiceLevel === level
                          ? 'bg-[#3E2723] text-[#C8A47A] border-[#3E2723]'
                          : 'bg-white text-[#6D4C41] border-[#E8DED0]'
                      }`}
                    >
                      {level.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Add-ons */}
              {addons.length > 0 && (
              <div className="bg-white/60 p-4 sm:p-8 rounded-[32px] border border-[#E8DED0]">
                <label className="block text-base sm:text-xl font-bold mb-3 sm:mb-6 text-[#3E2723]">Exquisite Enhancements</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {addons.map((addon) => {
                    const isSelected = customization.addons.includes(addon.id);
                    return (
                      <button
                        key={addon.id}
                        onClick={() => {
                          setCustomization({
                            ...customization,
                            addons: isSelected
                              ? customization.addons.filter((a) => a !== addon.id)
                              : [...customization.addons, addon.id]
                          });
                        }}
                        className={`p-3 sm:p-6 rounded-[24px] border-2 text-left transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#3E2723] text-[#C8A47A] border-[#3E2723]'
                            : 'bg-white text-[#3E2723] border-[#E8DED0]'
                        }`}
                      >
                        <div>
                          <p className="font-black uppercase tracking-widest text-xs mb-1">{addon.name}</p>
                          <p className={`text-base sm:text-lg font-black ${isSelected ? 'text-[#FAF7F2]' : 'text-[#8B5A2B]'}`}>
                            +₹{addon.price}
                          </p>
                        </div>
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl border-2 flex items-center justify-center ${isSelected ? 'bg-[#C8A47A] border-[#C8A47A]' : 'border-[#E8DED0]'}`}>
                          {isSelected ? <X className="w-4 h-4 sm:w-5 sm:h-5 text-[#2D1B10]" /> : <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-[#8B5A2B]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-10 items-center bg-[#3E2723]/5 p-5 sm:p-10 rounded-[32px]">
                <div className="flex flex-col items-center md:items-start">
                  <label className="block text-sm font-black uppercase tracking-widest mb-3 sm:mb-6 text-[#3E2723]">Quantity</label>
                  <div className="flex items-center gap-5 sm:gap-8 bg-white p-2 sm:p-3 rounded-full border border-[#E8DED0]">
                    <button
                      onClick={() => setCustomization({ ...customization, quantity: Math.max(1, customization.quantity - 1) })}
                      className="w-11 h-11 sm:w-14 sm:h-14 bg-[#FAF7F2] text-[#3E2723] rounded-full shadow-lg font-black text-xl sm:text-2xl flex items-center justify-center active:scale-90"
                    >
                      -
                    </button>
                    <span className="text-2xl sm:text-3xl font-black w-10 sm:w-12 text-center text-[#3E2723]">
                      {customization.quantity}
                    </span>
                    <button
                      onClick={() => setCustomization({ ...customization, quantity: customization.quantity + 1 })}
                      className="w-11 h-11 sm:w-14 sm:h-14 bg-[#FAF7F2] text-[#3E2723] rounded-full shadow-lg font-black text-xl sm:text-2xl flex items-center justify-center active:scale-90"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="text-center md:text-right border-l-0 md:border-l-2 border-[#8B5A2B]/20 md:pl-10">
                  <span className="text-xs text-[#8B5A2B] uppercase tracking-widest font-black block mb-2">Final Total</span>
                  <p className="text-4xl sm:text-6xl font-black text-[#3E2723]">₹{selectedItem.price * customization.quantity}</p>
                </div>
              </div>

              <button
                onClick={handleAddToCart}
                className="w-full bg-gradient-to-r from-[#3E2723] to-[#8B5A2B] text-white py-5 sm:py-8 rounded-[32px] font-black text-base sm:text-xl uppercase tracking-widest hover:shadow-2xl transition-all"
              >
                Confirm Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chatbot Component */}
      <Chatbot 
        isLoggedIn={isLoggedIn}
        onAddToCart={onAddToCart}
        onNavigate={onNavigate as (module: string) => void}
      />
    </div>
  );
}