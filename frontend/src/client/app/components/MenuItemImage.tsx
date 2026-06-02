import { useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';

/** Return a reliable Unsplash image URL based on item name keywords. */
function getDefaultFoodImage(name: string): string {
  const n = (name || '').toLowerCase();
  if (n.includes('watermelon') || n.includes('melon'))
    return 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=600&h=400&fit=crop';
  if (n.includes('juice') || n.includes('smoothie') || n.includes('shake') || n.includes('lassi') || n.includes('lemonade') || n.includes('mocktail') || n.includes('mojito'))
    return 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=600&h=400&fit=crop';
  if (n.includes('fries') || n.includes('french fry') || n.includes('chips'))
    return 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&h=400&fit=crop';
  if (n.includes('salad'))
    return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&h=400&fit=crop';
  if (n.includes('pizza'))
    return 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=400&fit=crop';
  if (n.includes('burger') || n.includes('sandwich') || n.includes('wrap'))
    return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=400&fit=crop';
  if (n.includes('pasta') || n.includes('noodle') || n.includes('spaghetti'))
    return 'https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?w=600&h=400&fit=crop';
  if (n.includes('biryani') || n.includes('fried rice') || n.includes('pulao') || n.includes('rice'))
    return 'https://images.unsplash.com/photo-1563379091339-03246963d21a?w=600&h=400&fit=crop';
  if (n.includes('chicken') || n.includes('tikka') || n.includes('tandoori') || n.includes('kebab'))
    return 'https://images.unsplash.com/photo-1562967914-608f82629710?w=600&h=400&fit=crop';
  if (n.includes('soup') || n.includes('dal') || n.includes('curry') || n.includes('gravy'))
    return 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&h=400&fit=crop';
  if (n.includes('coffee') || n.includes('espresso') || n.includes('cappuccino') || n.includes('latte'))
    return 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&h=400&fit=crop';
  if (n.includes('tea') || n.includes('chai'))
    return 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600&h=400&fit=crop';
  if (n.includes('cake') || n.includes('ice cream') || n.includes('dessert') || n.includes('pudding'))
    return 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=600&h=400&fit=crop';
  if (n.includes('bread') || n.includes('naan') || n.includes('roti') || n.includes('paratha'))
    return 'https://images.unsplash.com/photo-1547050605-2b268d10b7d9?w=600&h=400&fit=crop';
  return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=400&fit=crop';
}

interface MenuItemImageProps {
  src: string;
  alt: string;
  className?: string;
}

export function MenuItemImage({ src, alt, className }: MenuItemImageProps) {
  const fallbackSrc = getDefaultFoodImage(alt);
  const [currentSrc, setCurrentSrc] = useState(src || fallbackSrc);
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleError = () => {
    // If the primary src failed and we haven't tried the keyword fallback yet, try it
    if (currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      setIsLoading(true);
    } else {
      setImageError(true);
      setIsLoading(false);
    }
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  if (imageError) {
    return (
      <div className={`${className} bg-gradient-to-br from-[#F5F0E8] to-[#E8DED0] flex flex-col items-center justify-center`}>
        <div className="flex flex-col items-center justify-center gap-4 p-8">
          <div className="w-20 h-20 rounded-full bg-white/50 backdrop-blur-sm flex items-center justify-center shadow-lg">
            <UtensilsCrossed className="w-10 h-10 text-[#8B5A2B]/40" strokeWidth={1.5} />
          </div>
          <p className="text-[#8B5A2B]/60 text-sm font-medium tracking-wide text-center">
            Image Not Available
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {isLoading && (
        <div className={`${className} bg-gradient-to-br from-[#F5F0E8] to-[#E8DED0] flex items-center justify-center absolute inset-0`}>
          <div className="w-12 h-12 rounded-full border-4 border-[#8B5A2B]/20 border-t-[#8B5A2B] animate-spin"></div>
        </div>
      )}
      <img
        src={currentSrc}
        alt={alt}
        className={`${className} ${isLoading ? 'hidden' : 'block'}`}
        onError={handleError}
        onLoad={handleLoad}
      />
    </>
  );
}
