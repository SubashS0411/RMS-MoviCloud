import { useEffect, useState } from "react";
import { LoadingMenu } from '@/admin/components/ui/loading-spinner';
import {
  Card,
  CardContent,
} from "@/admin/components/ui/card";
import { Button } from "@/admin/components/ui/button";
import { Input } from "@/admin/components/ui/input";
import { Label } from "@/admin/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/admin/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/admin/components/ui/select";
import { Badge } from "@/admin/components/ui/badge";
import { Switch } from "@/admin/components/ui/switch";
import { Checkbox } from "@/admin/components/ui/checkbox";
import { cn } from "@/admin/components/ui/utils";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Clock,
  Pizza,
  Flame,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { menuApi, catalogApi } from "@/admin/utils/api";

type CuisineType = "South Indian" | "North Indian" | "Chinese" | "Italian" | "Continental";

interface MenuItem {
  id: string;
  name: string;
  category: string;
  cuisine: CuisineType;
  price: number;
  description: string;
  image: string;
  available: boolean;
  prepTime: string;
  dietType: "veg" | "non-veg";
  calories: number;
  spiceLevel: string;
  addons: string[];
  offerLabel?: string;
  offerDiscount?: string;
  badges?: string[];
  ingredients: { name: string; quantity: number; unit: string }[];
  cookingStation?: string;
}

interface ComboMeal {
  id: string;
  name: string;
  description: string;
  cuisine: CuisineType;
  category?: string;
  originalPrice: number;
  discountedPrice: number;
  image: string;
  available: boolean;
  calories: number;
  prepTime: string;
  items?: string[]; // Array of menu item IDs included in this combo
}

const SPICE_LEVELS = ["None", "Mild", "Medium", "Hot", "Extra Hot"];
const AVAILABLE_ADDONS = ["Ketchup", "Mayonnaise", "Green Sauce", "Pepper Dip", "Raita", "Sweet Chili"];

const DEFAULT_CUISINES = [
  { name: "North Indian" },
  { name: "South Indian" },
  { name: "Chinese" },
  { name: "Italian" },
  { name: "Continental" },
];
const COOKING_STATIONS = [
  { value: "FRY", label: "Fry Station" },
  { value: "CURRY", label: "Curry Station" },
  { value: "RICE", label: "Rice Station" },
  { value: "PREP", label: "Prep Station" },
  { value: "GRILL", label: "Grill Station" },
  { value: "DESSERT", label: "Dessert Station" },
];

/** Return a reliable Unsplash image URL based on the item name / category keyword. */
function getDefaultMenuImage(name: string, category: string = ""): string {
  const n = (name || "").toLowerCase();
  const c = (category || "").toLowerCase();
  if (n.includes("watermelon") || n.includes("melon"))
    return "https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=600&h=400&fit=crop";
  if (n.includes("juice") || n.includes("smoothie") || n.includes("shake") || n.includes("lassi") || n.includes("lemonade") || n.includes("mocktail") || n.includes("mojito"))
    return "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=600&h=400&fit=crop";
  if (n.includes("fries") || n.includes("french fry") || n.includes("chips"))
    return "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&h=400&fit=crop";
  if (n.includes("greek salad") || n.includes("salad"))
    return "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&h=400&fit=crop";
  if (n.includes("pizza"))
    return "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=400&fit=crop";
  if (n.includes("burger") || n.includes("sandwich") || n.includes("wrap"))
    return "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=400&fit=crop";
  if (n.includes("pasta") || n.includes("noodle") || n.includes("spaghetti") || n.includes("hakka"))
    return "https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?w=600&h=400&fit=crop";
  if (n.includes("biryani") || n.includes("fried rice") || n.includes("pulao") || n.includes("rice"))
    return "https://images.unsplash.com/photo-1563379091339-03246963d21a?w=600&h=400&fit=crop";
  if (n.includes("chicken") || n.includes("tikka") || n.includes("tandoori") || n.includes("kebab") || n.includes("kabab"))
    return "https://images.unsplash.com/photo-1562967914-608f82629710?w=600&h=400&fit=crop";
  if (n.includes("soup") || n.includes("dal") || n.includes("curry") || n.includes("gravy"))
    return "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&h=400&fit=crop";
  if (n.includes("coffee") || n.includes("espresso") || n.includes("cappuccino") || n.includes("latte"))
    return "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&h=400&fit=crop";
  if (n.includes("tea") || n.includes("chai"))
    return "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600&h=400&fit=crop";
  if (n.includes("cake") || n.includes("ice cream") || n.includes("dessert") || n.includes("gulab") || n.includes("halwa") || n.includes("kheer") || n.includes("pudding"))
    return "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=600&h=400&fit=crop";
  if (n.includes("bread") || n.includes("naan") || n.includes("roti") || n.includes("paratha"))
    return "https://images.unsplash.com/photo-1547050605-2b268d10b7d9?w=600&h=400&fit=crop";
  if (c.includes("beverage") || c.includes("drink"))
    return "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=600&h=400&fit=crop";
  if (c.includes("starter") || c.includes("appetizer"))
    return "https://images.unsplash.com/photo-1541014741259-de529411b96a?w=600&h=400&fit=crop";
  if (c.includes("dessert"))
    return "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=600&h=400&fit=crop";
  return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=400&fit=crop";
}

const normalizeCategory = (value?: string): string => {
  const raw = (value ?? "").toString().trim();
  if (!raw) return "main-course";

  const key = raw.toLowerCase();
  const map: Record<string, string> = {
    "starters": "starters",
    "starter": "starters",
    "main course": "main-course",
    "main-course": "main-course",
    "maincourse": "main-course",
    "breads": "breads",
    "bread": "breads",
    "desserts": "desserts",
    "dessert": "desserts",
    "beverages": "beverages",
    "beverage": "beverages",
    "drinks": "beverages",
  };

  return map[key] ?? key.replace(/\s+/g, "-");
};

const normalizeMenuItems = (items: any[]): MenuItem[] =>
  items.map((item) => ({
    id: item._id ?? item.id ?? `menu-${Math.random().toString(36).slice(2)}`,
    name: item.name ?? "Unnamed Item",
    category: normalizeCategory(item.category),
    cuisine: item.cuisine ?? "North Indian",
    price: Number(item.price ?? 0),
    description: item.description ?? "",
    image: item.image || getDefaultMenuImage(item.name ?? "", item.category ?? ""),
    available: item.available ?? true,
    prepTime: item.prepTime ?? "",
    dietType: item.dietType ?? "veg",
    calories: Number(item.calories ?? 0),
    spiceLevel: item.spiceLevel ?? "Mild",
    addons: Array.isArray(item.addons) ? item.addons : [],
    offerLabel: item.offerLabel,
    offerDiscount: item.offerDiscount,
    badges: Array.isArray(item.badges) ? item.badges : [],
    ingredients: Array.isArray(item.ingredients)
      ? item.ingredients.map((ing: any) => ({
          name: ing.name ?? "",
          quantity: String(ing.quantity ?? ""),
          unit: ing.unit ?? "grams",
        }))
      : [],
  }));

const normalizeComboMeals = (items: any[]): ComboMeal[] =>
  items.map((combo) => ({
    id: combo._id ?? combo.id ?? `combo-${Math.random().toString(36).slice(2)}`,
    name: combo.name ?? "Unnamed Combo",
    description: combo.description ?? "",
    cuisine: combo.cuisine ?? "North Indian",
    originalPrice: Number(combo.originalPrice) || Number(combo.discountedPrice) || Number(combo.price) || 0,
    discountedPrice: Number(combo.discountedPrice) || Number(combo.price) || Number(combo.originalPrice) || 0,
    image: combo.image ?? "",
    available: combo.available ?? true,
    calories: Number(combo.calories ?? 0),
    prepTime: combo.prepTime ?? "",
    items: Array.isArray(combo.items) ? combo.items : [],
  }));

export function MenuManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("items");
  const [activeCuisine, setActiveCuisine] = useState<"all" | "South Indian" | "North Indian" | "Chinese" | "Italian" | "Continental">("all");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeDiet, setActiveDiet] = useState<"all" | "veg" | "non-veg">("all");
  const [filterByOffer, setFilterByOffer] = useState(false);
  const [filterByChefSpecial, setFilterByChefSpecial] = useState(false);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [comboDialogOpen, setComboDialogOpen] = useState(false);
  const [addCuisineDialogOpen, setAddCuisineDialogOpen] = useState(false);
  const [addCategoryDialogOpen, setAddCategoryDialogOpen] = useState(false);
  const [manageAddonsDialogOpen, setManageAddonsDialogOpen] = useState(false);
  const [newCuisine, setNewCuisine] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newAddon, setNewAddon] = useState("");
  const [cuisineList, setCuisineList] = useState<any[]>([]);
  const [categoryList, setCategoryList] = useState<any[]>([]);
  const [addonsList, setAddonsList] = useState<any[]>([]);
  const [comboDropdownOpen, setComboDropdownOpen] = useState(false);
  const [comboItemSearchQuery, setComboItemSearchQuery] = useState("");
  const [comboCategoryFilter, setComboCategoryFilter] = useState("all");
  
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingCombo, setEditingCombo] = useState<ComboMeal | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [selectedComboItems, setSelectedComboItems] = useState<string[]>([]);
  const [ingredientRows, setIngredientRows] = useState<{ name: string; quantity: string; unit: string }[]>([]);

  // DATA: Menu Items
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [comboMeals, setComboMeals] = useState<ComboMeal[]>([]);
  const [loading, setLoading] = useState(true);

useEffect(() => {
  const loadAllData = async () => {
    try {
      console.log("🔄 Loading all data...");
      
      const [menuRes, comboRes, cuisinesRes, categoriesRes, addonsRes] = await Promise.all([
        menuApi.list().catch(e => { console.error("❌ menuApi.list() failed:", e); throw e; }),
        menuApi.listCombos().catch(e => { console.error("❌ menuApi.listCombos() failed:", e); throw e; }),
        catalogApi.getCuisines().catch(e => { console.error("❌ catalogApi.getCuisines() failed:", e); throw e; }),
        catalogApi.getCategories().catch(e => { console.error("❌ catalogApi.getCategories() failed:", e); throw e; }),
        catalogApi.getAddons().catch(e => { console.error("❌ catalogApi.getAddons() failed:", e); throw e; })
      ]);

      console.log("✅ All data loaded successfully");
      console.log("   Menu items:", menuRes);
      console.log("   Combos:", comboRes);
      console.log("   Cuisines:", cuisinesRes);
      console.log("   Categories:", categoriesRes);
      console.log("   Addons:", addonsRes);

      const menuData = Array.isArray(menuRes) ? menuRes : (menuRes as any)?.data || [];
      const comboData = Array.isArray(comboRes) ? comboRes : [];

      setMenuItems(normalizeMenuItems(menuData));
      setComboMeals(normalizeComboMeals(comboData));
      
      // Load catalog data
      // If DB has no cuisines, seed the defaults and use them locally
      if (Array.isArray(cuisinesRes) && cuisinesRes.length > 0) {
        setCuisineList(cuisinesRes);
      } else {
        setCuisineList(DEFAULT_CUISINES);
        // Auto-seed the 5 default cuisines into the DB silently
        Promise.all(
          DEFAULT_CUISINES.map(c =>
            catalogApi.createCuisine({ name: c.name }).catch(() => null)
          )
        );
      }
      setCategoryList(Array.isArray(categoriesRes) ? categoriesRes : []);
      setAddonsList(Array.isArray(addonsRes) ? addonsRes : []);

    } catch (error) {
      console.error("❌ Failed to load data from server:", error);
      console.error("   Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
      });
      toast.error("Failed to load data from server - Check browser console for details");
    } finally {
      setLoading(false);
    }
  };

  loadAllData();
}, []);

  // Handlers for adding cuisine, category, and addons
  const handleAddCuisine = async () => {
    if (!newCuisine.trim()) {
      toast.error("Please enter a cuisine name");
      return;
    }
    
    try {
      const result = await catalogApi.createCuisine({ name: newCuisine.trim() });
      setCuisineList([...cuisineList, result]);
      setNewCuisine("");
      setAddCuisineDialogOpen(false);
      toast.success(`Cuisine "${newCuisine.trim()}" added!`);
    } catch (error) {
      toast.error("Failed to add cuisine");
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) {
      toast.error("Please enter a category name");
      return;
    }
    
    try {
      const normalized = newCategory.trim().toLowerCase().replace(/\s+/g, "-");
      const result = await catalogApi.createCategory({ name: normalized, displayName: newCategory.trim() });
      setCategoryList([...categoryList, result]);
      setNewCategory("");
      setAddCategoryDialogOpen(false);
      toast.success(`Category "${newCategory.trim()}" added!`);
    } catch (error) {
      toast.error("Failed to add category");
    }
  };

  const handleAddAddon = async () => {
    if (!newAddon.trim()) {
      toast.error("Please enter an addon name");
      return;
    }
    
    try {
      const result = await catalogApi.createAddon({ name: newAddon.trim() });
      setAddonsList([...addonsList, result]);
      setNewAddon("");
      toast.success(`Addon "${newAddon.trim()}" added!`);
    } catch (error) {
      toast.error("Failed to add addon");
    }
  };

  const handleRemoveAddon = async (addon: any) => {
    try {
      await catalogApi.deleteAddon(addon.id || addon._id);
      setAddonsList(addonsList.filter(a => (a.id || a._id) !== (addon.id || addon._id)));
      setSelectedAddons(selectedAddons.filter(a => a !== addon.name));
      toast.success(`Addon "${addon.name}" removed`);
    } catch (error) {
      toast.error("Failed to remove addon");
    }
  };

  const categories = [
    { id: "all", name: "ALL" },
    ...categoryList.map(cat => ({
      id: cat.name,
      name: cat.displayName || cat.name.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    }))
  ];

  const cuisines = [
    { id: "all", name: "ALL CUISINE" },
    ...cuisineList.map(c => ({ id: c.name, name: c.name }))
  ];

  const handleUpdateItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const dietType = (fd.get("diet") as "veg" | "non-veg") ?? "veg";
    const baseBadges = editingItem?.badges ?? (dietType === "veg" ? ["VEG"] : ["NON-VEG"]);
    const validIngredients = ingredientRows
      .filter(r => r.name.trim() !== "")
      .map(r => ({ name: r.name.trim(), quantity: parseFloat(r.quantity) || 0, unit: r.unit }));
    const payload = {
      name: fd.get("name") as string,
      cuisine: fd.get("cuisine") as CuisineType,
      category: fd.get("category") as string,
      price: parseFloat(fd.get("price") as string),
      calories: parseInt(fd.get("calories") as string),
      prepTime: fd.get("prepTime") as string,
      dietType: dietType,
      description: fd.get("description") as string,
      spiceLevel: fd.get("spiceLevel") as string,
      offerDiscount: (fd.get("offerDiscount") as string) || undefined,
      offerLabel: (fd.get("offerLabel") as string) || undefined,
      addons: selectedAddons,
      image: (fd.get("image") as string) || editingItem?.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800",
      available: editingItem?.available ?? true,
      badges: baseBadges,
      ingredients: validIngredients,
      cookingStation: (fd.get("cookingStation") as string) || undefined,
    };

    try {
      if (editingItem) {
        await menuApi.update(editingItem.id, payload);

        const updated: MenuItem = { ...editingItem, ...payload, ingredients: editingItem.ingredients };
        setMenuItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
        toast.success("Item Updated Successfully!");
      } else {
        const result = await menuApi.create(payload);

        const createdId = result?._id ?? result?.id ?? Date.now().toString();
        const newItem: MenuItem = { id: createdId, ...payload };
        setMenuItems((prev) => [...prev, newItem]);
        toast.success("New Item Added Successfully!");
      }

      setDialogOpen(false);
      setEditingItem(null);
      setSelectedAddons([]);
      setIngredientRows([]);
    } catch (error) {
      console.error("Failed to save menu item:", error);
      toast.error("Failed to save menu item");
    }
  };

  const handleUpdateCombo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    // Parse prices with validation
    const discountedPrice = parseFloat(fd.get("price") as string) || 0;
    const originalPrice = parseFloat(fd.get("originalPrice") as string) || 0;

    if (discountedPrice <= 0 || originalPrice <= 0) {
      toast.error("Please enter valid prices (must be greater than 0)");
      return;
    }

    const payload = {
      name: fd.get("name") as string,
      cuisine: fd.get("cuisine") as CuisineType,
      category: fd.get("category") as string,
      discountedPrice: discountedPrice,
      calories: parseInt(fd.get("calories") as string) || 0,
      prepTime: fd.get("prepTime") as string,
      description: fd.get("desc") as string,
      originalPrice: originalPrice,
      image: (fd.get("image") as string) || editingCombo?.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800",
      available: editingCombo?.available ?? true,
      items: selectedComboItems, // Include selected menu item IDs
    };

    try {
      if (editingCombo) {
        await menuApi.updateCombo(editingCombo.id, payload);

        const updated: ComboMeal = { ...editingCombo, ...payload };
        setComboMeals((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        toast.success("Combo Updated Successfully!");
      } else {
        const result = await menuApi.createCombo(payload);

        const createdId = result?._id ?? result?.id ?? Date.now().toString();
        const newCombo: ComboMeal = { id: createdId, ...payload };
        setComboMeals((prev) => [...prev, newCombo]);
        toast.success("New Combo Added Successfully!");
      }

      setComboDialogOpen(false);
      setEditingCombo(null);
      setSelectedComboItems([]);
      setComboDropdownOpen(false);
      setComboItemSearchQuery("");
    } catch (error) {
      console.error("Failed to save combo:", error);
      toast.error("Failed to save combo");
    }
  };

  const handleToggleItemAvailability = async (item: MenuItem, available: boolean) => {
    try {
      await menuApi.update(item.id, { available });
      setMenuItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, available } : i)));
    } catch (error) {
      console.error("Failed to update availability:", error);
      toast.error("Failed to update item availability");
    }
  };

  const handleToggleComboAvailability = async (combo: ComboMeal, available: boolean) => {
    try {
      await menuApi.updateCombo(combo.id, { available });
      setComboMeals((prev) => prev.map((c) => (c.id === combo.id ? { ...c, available } : c)));
    } catch (error) {
      console.error("Failed to update availability:", error);
      toast.error("Failed to update combo availability");
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await menuApi.delete(itemId);
      setMenuItems((prev) => prev.filter((i) => i.id !== itemId));
      toast.success("Item Deleted Successfully!");
    } catch (error) {
      console.error("Failed to delete item:", error);
      toast.error("Failed to delete item");
    }
  };

  const handleDeleteCombo = async (comboId: string) => {
    try {
      await menuApi.deleteCombo(comboId);
      setComboMeals((prev) => prev.filter((c) => c.id !== comboId));
      toast.success("Combo Deleted Successfully!");
    } catch (error) {
      console.error("Failed to delete combo:", error);
      toast.error("Failed to delete combo");
    }
  };

  const filteredItems = menuItems.filter(i => {
    const searchMatch = i.name.toLowerCase().includes(searchQuery.toLowerCase());
    const cuisineMatch = activeCuisine === "all" || i.cuisine === activeCuisine;
    const categoryMatch = activeCategory === "all" || i.category === activeCategory;
    const dietMatch = activeDiet === "all" || i.dietType === activeDiet;
    const offerMatch = !filterByOffer || (i.offerDiscount && i.offerDiscount.trim() !== "");
    const chefSpecialMatch = !filterByChefSpecial || i.badges?.includes("CHEF'S SPECIAL");
    return searchMatch && cuisineMatch && categoryMatch && dietMatch && offerMatch && chefSpecialMatch;
  });

  const filteredCombos = comboMeals.filter(c => {
    const searchMatch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
    const cuisineMatch = activeCuisine === "all" || c.cuisine === activeCuisine;
    return searchMatch && cuisineMatch;
  });

  if (loading) return <LoadingMenu />;

  return (
    <div className="min-h-screen bg-[#f8f6f3] flex justify-center p-4 sm:p-5">
      <div className="w-full max-w-[1200px] mx-auto">

        {/* Top Action Buttons */}
        <div className="flex justify-end gap-3 flex-wrap mb-3">
            <Button 
              onClick={() => { setEditingItem(null); setSelectedAddons([]); setIngredientRows([]); setDialogOpen(true); }}
              className="h-11 px-6 bg-[#8B5A2B] hover:bg-[#6D421E] text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200"
            >
              <Plus className="mr-2 h-4 w-4" /> Add Item
            </Button>
            <Button 
              onClick={() => { setEditingCombo(null); setSelectedComboItems([]); setComboDropdownOpen(false); setComboItemSearchQuery(""); setComboDialogOpen(true); }}
              className="h-11 px-6 bg-white hover:bg-gray-50 text-[#8B5A2B] border-2 border-[#8B5A2B] rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200"
            >
              <Plus className="mr-2 h-4 w-4" /> Add Combo
            </Button>
          </div>

        {/* Search + Filters */}
        <Card className="bg-white rounded-xl shadow-sm border border-[#ece5dc] overflow-hidden mb-4">
          <div className="p-4 sm:p-5 space-y-4">
            
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input 
                placeholder="Search menu items..." 
                className="pl-12 h-14 text-base rounded-xl border-gray-300 bg-white focus:ring-2 focus:ring-[#8B5A2B] focus:border-[#8B5A2B] shadow-sm"
               
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
              />
            </div>

            {/* Browse Cuisines Section */}
            <div>
              <div className="flex items-center gap-2 text-[#6B6B6B] mb-4 text-sm">
                <Pizza className="h-5 w-5 text-[#8B5A2B]" />
                <span className="font-semibold">Browse Cuisines</span>
              </div>
              
              {/* Cuisine Pills */}
              <div className="flex flex-wrap gap-3">
                {cuisines.map((cuisine) => (
                  <button
                    key={cuisine.id}
                    onClick={() => setActiveCuisine(cuisine.id as any)}
                    className={cn(
                      "px-5 h-10 rounded-full text-sm font-medium transition-all duration-200 shadow-sm",
                      activeCuisine === cuisine.id
                        ? "bg-[#2A1A05] text-white"
                        : "bg-white text-[#6B6B6B] border border-gray-300 hover:bg-gray-50"
                    )}
                   
                  >
                    {cuisine.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Select Categories Section */}
            <div>
              <div className="flex items-center gap-2 text-[#6B6B6B] mb-4 text-sm">
                <ChevronRight className="h-5 w-5 text-[#8B5A2B]" />
                <span className="font-semibold">Select Categories</span>
              </div>
              
              {/* Category Pills - First Row */}
              <div className="flex flex-wrap gap-3 mb-3">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      "px-6 h-10 rounded-full font-medium text-sm transition-all duration-200 shadow-sm",
                      activeCategory === cat.id
                        ? "bg-[#8B5A2B] text-white"
                        : "bg-white text-[#6B6B6B] border border-gray-300 hover:border-[#8B5A2B]"
                    )}
                   
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Diet Type Pills - Second Row */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setActiveDiet("all")}
                  className={cn(
                    "px-5 h-10 rounded-full text-sm font-medium transition-all duration-200 shadow-sm",
                    activeDiet === "all"
                      ? "bg-[#2A1A05] text-white"
                      : "bg-white text-[#6B6B6B] border border-gray-300 hover:bg-gray-50"
                  )}
                 
                >
                  ALL
                </button>
                <button
                  onClick={() => setActiveDiet("veg")}
                  className={cn(
                    "px-5 h-10 rounded-full text-sm font-medium transition-all duration-200 shadow-sm",
                    activeDiet === "veg"
                      ? "bg-[#2A1A05] text-white"
                      : "bg-white text-[#6B6B6B] border border-gray-300 hover:bg-gray-50"
                  )}
                 
                >
                  VEG
                </button>
                <button
                  onClick={() => setActiveDiet("non-veg")}
                  className={cn(
                    "px-5 h-10 rounded-full text-sm font-medium transition-all duration-200 shadow-sm",
                    activeDiet === "non-veg"
                      ? "bg-[#2A1A05] text-white"
                      : "bg-white text-[#6B6B6B] border border-gray-300 hover:bg-gray-50"
                  )}
                 
                >
                  NON-VEG
                </button>
                <button
                  onClick={() => setFilterByOffer(!filterByOffer)}
                  className={cn(
                    "px-5 h-10 rounded-full text-sm font-medium transition-all duration-200 shadow-sm",
                    filterByOffer
                      ? "bg-[#2A1A05] text-white"
                      : "bg-white text-[#6B6B6B] border border-gray-300 hover:bg-gray-50"
                  )}
                 
                >
                  OFFERS
                </button>
                <button
                  onClick={() => setFilterByChefSpecial(!filterByChefSpecial)}
                  className={cn(
                    "px-5 h-10 rounded-full text-sm font-medium transition-all duration-200 shadow-sm",
                    filterByChefSpecial
                      ? "bg-[#2A1A05] text-white"
                      : "bg-white text-[#6B6B6B] border border-gray-300 hover:bg-gray-50"
                  )}
                 
                >
                  CHEF'S SPECIAL
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Tab Switcher */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={() => setActiveTab("items")}
            className={cn(
              "px-8 h-12 rounded-lg font-semibold text-sm transition-all duration-200 shadow-sm",
              activeTab === "items"
                ? "bg-[#8B5A2B] text-white"
                : "bg-white text-[#6B6B6B] hover:bg-gray-50"
            )}
           
          >
            Menu Items ({filteredItems.length})
          </button>
          <button
            onClick={() => setActiveTab("combos")}
            className={cn(
              "px-8 h-12 rounded-lg font-semibold text-sm transition-all duration-200 shadow-sm",
              activeTab === "combos"
                ? "bg-[#8B5A2B] text-white"
                : "bg-white text-[#6B6B6B] hover:bg-gray-50"
            )}
           
          >
            Combo Meals ({filteredCombos.length})
          </button>
        </div>

        {/* Menu Items Grid with Float Effect */}
        {activeTab === "items" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
            {filteredItems.map((item) => (
              <div 
                key={item.id} 
                className="overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 card-float w-full min-h-[424px] rounded-2xl bg-white"
              >
                {/* Image Section */}
                <div className="relative overflow-hidden w-full h-44">
                  <img 
                    src={item.image || getDefaultMenuImage(item.name, item.category)}
                    alt={item.name} 
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = getDefaultMenuImage(item.name, item.category); }}
                  />
                  
                  {/* VEG/NON-VEG Badge - Top Left */}
                  <div className="absolute top-2 left-2">
                    <Badge 
                      className={cn(
                        "text-white text-xs px-3 py-1 font-bold",
                        item.dietType === "veg" ? "bg-green-600" : "bg-red-600"
                      )}
                     
                    >
                      {item.dietType === "veg" ? "VEG" : "NON-VEG"}
                    </Badge>
                  </div>

                  {/* BESTSELLER Badge - Top Right */}
                  {item.badges?.includes("BESTSELLER") && (
                    <Badge className="absolute top-2 right-2 bg-orange-600 text-white text-xs px-3 py-1 font-bold">
                      BESTSELLER
                    </Badge>
                  )}

                  {/* CHEF'S SPECIAL Badge */}
                  {item.badges?.includes("CHEF'S SPECIAL") && (
                    <Badge className="absolute top-10 right-2 bg-purple-600 text-white text-xs px-3 py-1 font-bold">
                      CHEF'S SPECIAL
                    </Badge>
                  )}

                  {/* Offer Discount - Bottom Right */}
                  {item.offerDiscount && (
                    <Badge className="absolute bottom-2 right-2 bg-red-600 text-white text-xs px-3 py-1 font-bold">
                      {item.offerDiscount}
                    </Badge>
                  )}
                </div>

                {/* Dark Brown Container - Bottom Section */}
                <div className="p-4 space-y-2 h-[248px] bg-[#2A1A05]">
                  {/* Title - WHITE COLOR */}
                  <h3 className="text-white font-bold text-base leading-tight">
                    {item.name}
                  </h3>
                  
                  {/* Description */}
                  <p className="text-gray-300 text-sm line-clamp-2 leading-snug">
                    {item.description}
                  </p>

                  {/* Info Row - Calories and Time */}
                  <div className="flex items-center justify-between text-white text-xs pt-1">
                    <div className="flex items-center gap-1">
                      <Flame className="h-4 w-4 text-orange-400" />
                      <span>{item.calories} kcal</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span>{item.prepTime}</span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-white/20 my-2" />

                  {/* Price and Cuisine Section */}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <p className="text-gray-400 text-xs">PRICE</p>
                      <p className="text-white font-bold text-xl leading-none">₹{item.price}</p>
                    </div>
                    
                    {/* Cuisine Badge */}
                    <Badge 
                      className="bg-[#8B5A2B] text-white text-xs px-3 py-1.5"
                     
                    >
                      {item.cuisine}
                    </Badge>
                  </div>

                  {/* Admin Actions Row */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="text-white/80 text-xs">Available</span>
                      <Switch 
                        checked={item.available}
                        onCheckedChange={(checked) => {
                          void handleToggleItemAvailability(item, checked);
                        }}
                        className="data-[state=checked]:bg-green-600"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-white hover:bg-white/10"
                        onClick={() => { 
                          setEditingItem(item); 
                          setSelectedAddons(item.addons);
                          setIngredientRows(item.ingredients?.length ? item.ingredients.map(ing => ({ ...ing, quantity: String(ing.quantity) })) : []);
                          setDialogOpen(true); 
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-white hover:bg-white/10 hover:text-red-400"
                        onClick={() => {
                          void handleDeleteItem(item.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Combo Meals Grid with Float Effect */}
        {activeTab === "combos" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
            {filteredCombos.map((combo) => (
              <div 
                key={combo.id} 
                className="overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 card-float w-full min-h-[424px] rounded-2xl bg-white"
              >
                {/* Image Section */}
                <div className="relative overflow-hidden h-44">
                  <img 
                    src={combo.image || getDefaultMenuImage(combo.name, combo.category ?? "")}
                    alt={combo.name} 
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = getDefaultMenuImage(combo.name, combo.category ?? ""); }}
                  />
                  
                  {/* COMBO DEAL Badge - Top Left */}
                  <div className="absolute top-2 left-2">
                    <Badge 
                      className="bg-purple-600 text-white text-xs px-3 py-1 font-bold"
                     
                    >
                      COMBO DEAL
                    </Badge>
                  </div>
                </div>

                {/* Dark Brown Container - Bottom Section */}
                <div className="p-3 flex flex-col overflow-hidden h-[248px] bg-[#2A1A05]">
                  {/* Title - WHITE COLOR */}
                  <h3 className="text-white font-bold text-sm leading-tight truncate">
                    {combo.name}
                  </h3>
                  
                  {/* Description */}
                  <p className="text-gray-300 text-xs line-clamp-2 leading-snug mt-1">
                    {combo.description}
                  </p>

                  {/* Cuisine and Category Badges */}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {combo.cuisine && (
                      <Badge className="bg-orange-600 text-white text-xs">
                        {combo.cuisine}
                      </Badge>
                    )}
                    {combo.category && (
                      <Badge className="bg-blue-600 text-white text-xs">
                        {combo.category}
                      </Badge>
                    )}
                  </div>

                  {/* Info Row - Calories and Time */}
                  <div className="flex items-center justify-between text-white text-xs mt-2">
                    <div className="flex items-center gap-1">
                      <Flame className="h-3 w-3 text-orange-400" />
                      <span>{combo.calories} kcal</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-gray-400" />
                      <span>{combo.prepTime}</span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-white/20 my-2 flex-shrink-0" />

                  {/* Price Section with Strikethrough */}
                  <div>
                    <div className="flex items-baseline gap-2 mb-1">
                      <p className="text-gray-400 text-xs line-through">₹{combo.originalPrice}</p>
                      <Badge className="bg-green-600 text-white text-[10px] px-1.5 py-0.5">
                        Save ₹{combo.originalPrice - combo.discountedPrice}
                      </Badge>
                    </div>
                    <p className="text-white font-bold text-lg leading-none">₹{combo.discountedPrice}</p>
                  </div>

                  {/* Spacer to push admin actions to bottom */}
                  <div className="flex-grow" />

                  {/* Admin Actions Row */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/10 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white/80 text-xs">Available</span>
                      <Switch 
                        checked={combo.available}
                        onCheckedChange={(checked) => {
                          void handleToggleComboAvailability(combo, checked);
                        }}
                        className="data-[state=checked]:bg-green-600"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-white hover:bg-white/10"
                        onClick={() => { 
                          setEditingCombo(combo); 
                          setSelectedComboItems(combo.items || []);
                          setComboDropdownOpen(false);
                          setComboItemSearchQuery("");
                          setComboDialogOpen(true); 
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-white hover:bg-white/10 hover:text-red-400"
                        onClick={() => {
                          void handleDeleteCombo(combo.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Add/Edit Item Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Menu Item" : "Add New Menu Item"}
            </DialogTitle>
            <DialogDescription>
              {editingItem ? "Update the details of your menu item" : "Add a new item to your menu"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateItem} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Item Name</Label>
                <Input id="name" name="name" defaultValue={editingItem?.name} required />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cuisine">Cuisine</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs text-[#8B5A2B] hover:bg-[#8B5A2B]/10"
                    onClick={() => setAddCuisineDialogOpen(true)}
                  >
                    + Add
                  </Button>
                </div>
                <Select name="cuisine" defaultValue={editingItem?.cuisine}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select cuisine" />
                  </SelectTrigger>
                  <SelectContent>
                    {cuisineList.map((c: any) => (
                      <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="category">Category</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs text-[#8B5A2B] hover:bg-[#8B5A2B]/10"
                    onClick={() => setAddCategoryDialogOpen(true)}
                  >
                    + Add
                  </Button>
                </div>
                <Select name="category" defaultValue={editingItem?.category}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryList.map((c: any) => (
                      <SelectItem key={c.name} value={c.name}>
                        {c.displayName || c.name.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price (₹)</Label>
                <Input id="price" name="price" type="number" defaultValue={editingItem?.price} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" defaultValue={editingItem?.description} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="image">Image URL</Label>
              <Input 
                id="image" 
                name="image" 
                type="url" 
                defaultValue={editingItem?.image} 
                placeholder="https://example.com/image.jpg" 
              />
              <p className="text-xs text-gray-500">Enter the URL of the dish image</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="calories">Calories</Label>
                <Input id="calories" name="calories" type="number" defaultValue={editingItem?.calories} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prepTime">Prep Time</Label>
                <Input id="prepTime" name="prepTime" defaultValue={editingItem?.prepTime} placeholder="e.g., 15-20 mins" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="diet">Diet Type</Label>
                <Select name="diet" defaultValue={editingItem?.dietType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="veg">Vegetarian</SelectItem>
                    <SelectItem value="non-veg">Non-Vegetarian</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cookingStation">Kitchen Station</Label>
              <Select name="cookingStation" defaultValue={editingItem?.cookingStation || ""}>
                <SelectTrigger>
                  <SelectValue placeholder="Select kitchen station" />
                </SelectTrigger>
                <SelectContent>
                  {COOKING_STATIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Assign this item to a specific kitchen sub-station for order routing</p>
            </div>
            
            {/* Customization Section */}
            <div className="border-t pt-4 mt-4">
              <h3 className="text-sm font-semibold mb-3">Customization Options</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Spice Level */}
                <div className="space-y-2">
                  <Label htmlFor="spiceLevel">Spice Level</Label>
                  <Select name="spiceLevel" defaultValue={editingItem?.spiceLevel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select spice level" />
                    </SelectTrigger>
                    <SelectContent>
                      {SPICE_LEVELS.map(level => (
                        <SelectItem key={level} value={level}>{level}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="offerDiscount">Offer Discount</Label>
                  <Input id="offerDiscount" name="offerDiscount" defaultValue={editingItem?.offerDiscount} placeholder="e.g., 10% OFF" />
                </div>
              </div>
              
              {/* Addons as Checkboxes */}
              <div className="space-y-2 mt-4">
                <div className="flex items-center justify-between">
                  <Label>Available Addons</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs text-[#8B5A2B] hover:bg-[#8B5A2B]/10"
                    onClick={() => setManageAddonsDialogOpen(true)}
                  >
                    + Manage
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg">
                  {addonsList.map((addon: any) => (
                    <div key={addon.id || addon._id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={addon.name}
                        checked={selectedAddons.includes(addon.name)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedAddons([...selectedAddons, addon.name]);
                          } else {
                            setSelectedAddons(selectedAddons.filter(a => a !== addon.name));
                          }
                        }}
                      />
                      <label htmlFor={addon.name} className="text-sm cursor-pointer">{addon.name}</label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Ingredients Section */}
            <div className="border-t pt-4 mt-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Ingredients</h3>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIngredientRows(prev => [...prev, { name: '', quantity: '', unit: 'grams' }])}
                  className="h-7 px-2 text-xs gap-1"
                >
                  <Plus className="h-3 w-3" /> Add Ingredient
                </Button>
              </div>
              {ingredientRows.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3 bg-gray-50 rounded-lg">
                  No ingredients added. Click "Add Ingredient" to map ingredients for inventory tracking.
                </p>
              ) : (
                <div className="space-y-2">
                  {ingredientRows.map((row, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        placeholder="Ingredient name"
                        value={row.name}
                        onChange={e => setIngredientRows(prev => prev.map((r, i) => i === idx ? { ...r, name: e.target.value } : r))}
                        className="flex-1 h-8 text-sm"
                      />
                      <Input
                        placeholder="Qty"
                        type="number"
                        min="0"
                        step="any"
                        value={row.quantity}
                        onChange={e => setIngredientRows(prev => prev.map((r, i) => i === idx ? { ...r, quantity: e.target.value } : r))}
                        className="w-20 h-8 text-sm"
                      />
                      <select
                        value={row.unit}
                        onChange={e => setIngredientRows(prev => prev.map((r, i) => i === idx ? { ...r, unit: e.target.value } : r))}
                        className="h-8 text-sm border rounded-md px-2 bg-white"
                      >
                        {['grams', 'kg', 'ml', 'liters', 'pcs', 'tbsp', 'tsp', 'cups'].map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => setIngredientRows(prev => prev.filter((_, i) => i !== idx))}
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 flex-shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button type="submit" className="flex-1 bg-[#8B5A2B] hover:bg-[#6D421E]">
                {editingItem ? "Update Item" : "Add Item"}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setEditingItem(null); setSelectedAddons([]); setIngredientRows([]); }}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Combo Dialog */}
      <Dialog open={comboDialogOpen} onOpenChange={setComboDialogOpen}>
        <DialogContent className="max-w-xl w-[95vw] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingCombo ? "Edit Combo Meal" : "Add New Combo Meal"}
            </DialogTitle>
            <DialogDescription>
              {editingCombo ? "Update the details of your combo" : "Create a new combo meal"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateCombo} className="space-y-4 overflow-y-auto flex-1 pr-1">
            <div className="space-y-2">
              <Label htmlFor="comboName">Combo Name</Label>
              <Input id="comboName" name="name" defaultValue={editingCombo?.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comboDesc">Description</Label>
              <Input id="comboDesc" name="desc" defaultValue={editingCombo?.description} required />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="comboCuisine">Cuisine</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs text-[#8B5A2B] hover:bg-[#8B5A2B]/10"
                  onClick={() => setAddCuisineDialogOpen(true)}
                >
                  + Add
                </Button>
              </div>
              <Select name="cuisine" defaultValue={editingCombo?.cuisine}>
                <SelectTrigger>
                  <SelectValue placeholder="Select cuisine" />
                </SelectTrigger>
                <SelectContent>
                  {cuisineList.map((c: any) => (
                    <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="comboCategory">Category</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs text-[#8B5A2B] hover:bg-[#8B5A2B]/10"
                  onClick={() => setAddCategoryDialogOpen(true)}
                >
                  + Add
                </Button>
              </div>
              <Select name="category" defaultValue={editingCombo?.category}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categoryList.map((c: any) => (
                    <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="originalPrice">Original Price (₹)</Label>
                <Input id="originalPrice" name="originalPrice" type="number" defaultValue={editingCombo?.originalPrice || ''} min="1" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="comboPrice">Discounted Price (₹)</Label>
                <Input id="comboPrice" name="price" type="number" defaultValue={editingCombo?.discountedPrice || ''} min="1" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="comboCalories">Calories</Label>
                <Input id="comboCalories" name="calories" type="number" defaultValue={editingCombo?.calories} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="comboPrepTime">Prep Time</Label>
              <Input id="comboPrepTime" name="prepTime" defaultValue={editingCombo?.prepTime} placeholder="e.g., 25mins" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comboImage">Image URL</Label>
              <Input 
                id="comboImage" 
                name="image" 
                type="url" 
                defaultValue={editingCombo?.image} 
                placeholder="https://example.com/combo-image.jpg" 
              />
            </div>

            {/* Menu Items Selection with Search and Filter */}
            <div className="space-y-3">
              <Label>Select Items for Combo</Label>
              
              {/* Expandable Multi-Select (Works within Modal) */}
              <div className="border-2 border-gray-300 rounded-lg bg-white">
                {/* Header Button */}
                <button
                  type="button"
                  onClick={() => setComboDropdownOpen(!comboDropdownOpen)}
                  className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                 
                >
                  <span className="text-sm font-medium">
                    {selectedComboItems.length === 0 
                      ? "🔍 Click to Select Items" 
                      : `✓ ${selectedComboItems.length} item${selectedComboItems.length !== 1 ? 's' : ''} selected`}
                  </span>
                  <svg className={`w-5 h-5 text-gray-600 transition-transform ${comboDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </button>

                {/* Expandable Content */}
                {comboDropdownOpen && (
                  <div className="border-t border-gray-200">
                    {/* Search Input */}
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                      <input
                        type="text"
                        placeholder="Search items..."
                        value={comboItemSearchQuery}
                        onChange={(e) => setComboItemSearchQuery(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5A2B]"
                       
                        autoFocus
                      />
                    </div>

                    {/* Items List with Fixed Height Scroll */}
                    <div className="max-h-80 overflow-y-auto">
                      {menuItems
                        .filter((item) => item.name.toLowerCase().includes(comboItemSearchQuery.toLowerCase()))
                        .length === 0 ? (
                        <div className="px-4 py-4 text-sm text-gray-500 text-center">
                          No items found
                        </div>
                      ) : (
                        menuItems
                          .filter((item) => item.name.toLowerCase().includes(comboItemSearchQuery.toLowerCase()))
                          .map((item) => (
                            <label
                              key={item.id}
                              className="flex items-center gap-3 px-4 py-2 hover:bg-[#8B5A2B]/5 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0"
                            >
                              <input
                                type="checkbox"
                                checked={selectedComboItems.includes(item.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedComboItems([...selectedComboItems, item.id]);
                                  } else {
                                    setSelectedComboItems(selectedComboItems.filter((id) => id !== item.id));
                                  }
                                }}
                                className="w-4 h-4 rounded border-gray-300 text-[#8B5A2B] cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                                <p className="text-xs text-gray-500">{item.category}</p>
                              </div>
                              <span className="text-sm font-semibold text-[#8B5A2B] whitespace-nowrap">₹{item.price}</span>
                            </label>
                          ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Selected Items Tags */}
              {selectedComboItems.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  {selectedComboItems.map((itemId) => {
                    const item = menuItems.find((m) => m.id === itemId);
                    return item ? (
                      <div
                        key={item.id}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-sm rounded-full"
                      >
                        <span className="truncate">{item.name}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedComboItems(selectedComboItems.filter((id) => id !== itemId))}
                          className="ml-1 hover:opacity-75 transition-opacity"
                        >
                          ✕
                        </button>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="submit" className="flex-1 bg-[#8B5A2B] hover:bg-[#6D421E]">
                {editingCombo ? "Update Combo" : "Add Combo"}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setComboDialogOpen(false); setEditingCombo(null); setSelectedComboItems([]); setComboDropdownOpen(false); setComboItemSearchQuery(""); }}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Cuisine Dialog */}
      <Dialog open={addCuisineDialogOpen} onOpenChange={setAddCuisineDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add New Cuisine</DialogTitle>
            <DialogDescription>
              Add a new cuisine type to your menu
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newCuisine">Cuisine Name</Label>
              <Input
                id="newCuisine"
                placeholder="e.g., Thai, Japanese, Mexican"
                value={newCuisine}
                onChange={(e) => setNewCuisine(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCuisine()}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button onClick={handleAddCuisine} className="flex-1 bg-[#8B5A2B] hover:bg-[#6D421E]">
                Add Cuisine
              </Button>
              <Button type="button" variant="outline" onClick={() => setAddCuisineDialogOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={addCategoryDialogOpen} onOpenChange={setAddCategoryDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
            <DialogDescription>
              Add a new menu category
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newCategory">Category Name</Label>
              <Input
                id="newCategory"
                placeholder="e.g., Appetizers, Soups, Salads"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
              />
              <p className="text-xs text-gray-500">Will be normalized to lowercase with hyphens</p>
            </div>
            <div className="flex gap-3 pt-4">
              <Button onClick={handleAddCategory} className="flex-1 bg-[#8B5A2B] hover:bg-[#6D421E]">
                Add Category
              </Button>
              <Button type="button" variant="outline" onClick={() => setAddCategoryDialogOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Addons Dialog */}
      <Dialog open={manageAddonsDialogOpen} onOpenChange={setManageAddonsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Addons</DialogTitle>
            <DialogDescription>
              Add or remove available addons
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Add new addon */}
            <div className="space-y-2">
              <Label htmlFor="newAddon">Add New Addon</Label>
              <div className="flex gap-2">
                <Input
                  id="newAddon"
                  placeholder="e.g., Extra Cheese, Bacon"
                  value={newAddon}
                  onChange={(e) => setNewAddon(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddAddon()}
                />
                <Button size="sm" onClick={handleAddAddon} className="bg-[#8B5A2B] hover:bg-[#6D421E]">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Current addons list */}
            <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3 bg-gray-50">
              <p className="text-xs font-semibold text-gray-600">Current Addons ({addonsList.length})</p>
              <div className="space-y-2">
                {addonsList.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3">No addons yet. Add one to get started!</p>
                ) : (
                  addonsList.map(addon => (
                    <div key={addon} className="flex items-center justify-between p-2 bg-white rounded border text-sm">
                      <span>{addon}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-red-600 hover:bg-red-50"
                        onClick={() => handleRemoveAddon(addon)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setManageAddonsDialogOpen(false)}
               
              >
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
