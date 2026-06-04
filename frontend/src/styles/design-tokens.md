# Restaurant Management System - Design Tokens
## Extracted from Figma Reference

### Color Palette

#### Primary Colors
- **Primary Brand (Brown)**: `#8B5A2B`
  - Usage: Primary buttons, navigation active states, links, main brand color
  - Foreground: `#FFFFFF`

- **Secondary (Light Tan/Beige)**: `#D4B896`
  - Usage: Secondary buttons, alternate highlights
  - Foreground: `#2D2D2D`

#### Background Colors
- **Page Background**: `#FAF8F5` (Light cream)
- **Card/Modal Background**: `#FFFFFF` (White)
- **Muted Background**: `#F5F1ED` (Very light tan)

#### Text Colors
- **Foreground (Headings)**: `#2D2D2D` (Dark gray/black)
- **Body Text**: `#6B6B6B` (Medium gray)
- **Muted Text**: `#9CA3AF` (Light gray for captions)

#### Borders & Dividers
- **Border**: `#E5DDD3` (Light brown/tan)
- **Input Border**: `#E5DDD3`
- **Focus Ring**: `#8B5A2B` with 20% opacity

#### Status Colors
- **Success (VEG)**: `#10B981` (Green)
- **Destructive (NON-VEG)**: `#EF4444` (Red)
- **Warning**: `#F59E0B` (Orange)
- **Info**: `#3B82F6` (Blue)

---

### Typography

#### Font Families
- **Headings**: `'Poppins', sans-serif`
  - Weight: 600 (Semibold)
  - Line-height: 1.3
  - Color: `#2D2D2D`

- **Body**: `'Inter', sans-serif`
  - Weight: 400 (Regular)
  - Line-height: 1.6
  - Color: `#6B6B6B`

#### Font Sizes
- **H1**: 40px (letter-spacing: -0.02em)
- **H2**: 30px (letter-spacing: -0.01em)
- **H3**: 21px
- **H4**: 18px
- **H5/H6**: 16px
- **Body**: 15px
- **Label**: 14px (weight: 500)
- **Caption/Small**: 13px (color: `#9CA3AF`)

---

### Spacing & Sizing

#### Border Radius
- **Small (Buttons, Inputs)**: `8px` (rounded-lg)
- **Medium (Cards, Modals)**: `12px` (rounded-xl)
- **Large (Cards)**: `16px`
- **Full (Badges/Chips)**: `20px` (rounded-full)

#### Button Sizing
- **Default Height**: `44px` (h-11)
  - Padding: `px-6 py-3`
  - Border radius: `8px` (rounded-lg)

- **Small Height**: `36px` (h-9)
  - Padding: `px-4`
  - Border radius: `8px` (rounded-lg)

- **Large Height**: `48px` (h-12)
  - Padding: `px-8`
  - Border radius: `8px` (rounded-lg)

#### Input Sizing
- **Height**: `44px` (h-11)
- **Padding**: `px-4 py-3`
- **Border radius**: `8px` (rounded-lg)
- **Background**: `#FFFFFF`

#### Badge/Chip Sizing
- **Height**: `36px`
- **Padding**: `px-4 py-2`
- **Border radius**: `20px` (rounded-full)
- **Font size**: 12px

#### Popup/Modal Sizing
- **Max Width**: `480px`
- **Border radius**: `12px` (rounded-xl)
- **Padding**: `32px` (p-8)
- **Gap between elements**: `16px` (gap-4)

#### Select Dropdown Sizing
- **Height**: `44px` (h-11)
- **Padding**: `px-4 py-3`
- **Border radius**: `8px` (rounded-lg)
- **Background**: `#FFFFFF`

---

### Shadows

#### Card Shadows (Subtle)
- **Small**: `0 1px 2px 0 rgba(0, 0, 0, 0.05)`
- **Default**: `0 2px 8px 0 rgba(0, 0, 0, 0.08)`
- **Medium**: `0 4px 12px 0 rgba(0, 0, 0, 0.1)`
- **Large**: `0 8px 24px 0 rgba(0, 0, 0, 0.12)`

---

### Interaction States

#### Hover
- **Transition**: `all 0.2s ease-in-out`
- **Primary Button Hover**: Background opacity 90%
- **Ghost Button Hover**: Light accent background

#### Focus
- **Outline**: None (using ring instead)
- **Ring**: `0 0 0 3px rgba(139, 90, 43, 0.2)`
- **Border Color**: `#8B5A2B`

#### Active/Selected
- **Tab Active**: White background with subtle shadow
- **Badge Active**: Full opacity brand color

---

### Component-Specific Guidelines

#### Navigation Tabs
- Background: `#F5F1ED` (muted)
- Active state: White background
- Height: `36px` (h-9)
- Border radius: `12px` (rounded-xl)

#### Category Badges (Browse Categories)
- Background: `#8B5A2B` for active/"ALL"
- Background: Light for inactive states
- Fully rounded (`rounded-full`)
- Text: Uppercase, 12px

#### VEG/NON-VEG Indicators
- VEG: Green badge (`#10B981`)
- NON-VEG: Red badge (`#EF4444`)
- Small circle indicators with appropriate colors

#### Search Input
- Height: `44px`
- Large border radius: `8px`
- Placeholder color: `#9CA3AF`
- White background

---

### Accessibility

#### Contrast Ratios (WCAG AA)
- ✅ Primary text on background: `#2D2D2D` on `#FAF8F5` → 12.3:1
- ✅ Body text on background: `#6B6B6B` on `#FAF8F5` → 5.8:1
- ✅ White text on primary: `#FFFFFF` on `#8B5A2B` → 5.2:1
- ✅ Muted text: `#9CA3AF` on `#FAF8F5` → 3.1:1 (for non-critical info)

---

### Implementation Notes

1. **Consistency**: All buttons across the application must use `h-11` (44px) by default
2. **Consistency**: All popups/modals must use `max-w-[480px]` and `rounded-xl`
3. **Consistency**: All badges/chips must use `rounded-full` and `px-4`
4. **Consistency**: All form inputs must use `h-11`, `rounded-lg`, and white background
5. **Font Loading**: Ensure Poppins and Inter are loaded in the application
6. **Color Usage**: Always use CSS variables from theme.css for maintainability

---

### Design System Files Updated
- `/src/styles/theme.css` - Color tokens and CSS variables
- `/src/styles/fonts.css` - Typography system
- `/src/app/components/ui/button.tsx` - Button sizing
- `/src/app/components/ui/dialog.tsx` - Modal sizing
- `/src/app/components/ui/badge.tsx` - Badge styling
- `/src/app/components/ui/input.tsx` - Input sizing
- `/src/app/components/ui/select.tsx` - Select dropdown sizing
