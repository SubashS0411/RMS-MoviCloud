from pydantic import BaseModel, Field, EmailStr
from typing import Any, Optional, List
from datetime import datetime, date
from enum import Enum


# ============ ENUMS ============
class StaffRole(str, Enum):
    admin = "admin"
    manager = "manager"
    chef = "chef"
    waiter = "waiter"
    cashier = "cashier"


class KitchenStation(str, Enum):
    FRY = "FRY"
    CURRY = "CURRY"
    RICE = "RICE"
    PREP = "PREP"
    GRILL = "GRILL"
    DESSERT = "DESSERT"
    HEAD_CHEF = "HEAD_CHEF"


class ShiftType(str, Enum):
    morning = "morning"
    afternoon = "afternoon"
    evening = "evening"
    night = "night"


class AttendanceStatus(str, Enum):
    present = "present"
    absent = "absent"
    late = "late"
    half_day = "half_day"
    leave = "leave"


# ============ SETTINGS ============
class SettingIn(BaseModel):
    key: str
    value: Any
    description: Optional[str] = None
    category: Optional[str] = "general"


class SettingOut(SettingIn):
    id: Optional[str] = Field(None, alias="_id")
    updatedBy: Optional[str] = None
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None


class SystemConfigIn(BaseModel):
    restaurantName: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    contactNumber: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    operatingHours: Optional[str] = None
    currency: Optional[str] = "INR"
    timezone: Optional[str] = "Asia/Kolkata"
    language: Optional[str] = "English"
    dateFormat: Optional[str] = "DD/MM/YYYY"
    timeFormat: Optional[str] = "12-hour"
    logoUrl: Optional[str] = None


# ============ STAFF MANAGEMENT ============
class LoginIn(BaseModel):
    email: EmailStr
    password: str


class StaffIn(BaseModel):
    name: str
    email: EmailStr
    role: Optional[StaffRole] = StaffRole.waiter
    password: Optional[str] = None
    phone: Optional[str] = None
    shift: Optional[ShiftType] = ShiftType.morning
    department: Optional[str] = None
    salary: Optional[float] = None
    hireDate: Optional[date] = None
    active: Optional[bool] = True
    kitchenStation: Optional[KitchenStation] = None  # only for chefs
    kitchenPin: Optional[str] = None  # 4-digit PIN for KDS terminal login


class StaffUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[StaffRole] = None
    phone: Optional[str] = None
    shift: Optional[ShiftType] = None
    department: Optional[str] = None
    salary: Optional[float] = None
    active: Optional[bool] = None
    password: Optional[str] = None
    kitchenStation: Optional[KitchenStation] = None
    kitchenPin: Optional[str] = None


class StaffOut(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: str
    email: EmailStr
    role: str
    phone: Optional[str] = None
    shift: Optional[str] = None
    department: Optional[str] = None
    active: bool = True
    hireDate: Optional[date] = None
    createdAt: Optional[datetime] = None
    kitchenStation: Optional[str] = None
    kitchenPin: Optional[str] = None


# ============ SALARY PAYMENTS ============
class SalaryPaymentIn(BaseModel):
    amount: float
    month: str  # e.g. "2026-03"
    paymentMethod: str  # "cash" | "bank_transfer" | "upi"
    notes: Optional[str] = None


# ============ SHIFT & ATTENDANCE ============
class ShiftAssignment(BaseModel):
    staffId: str
    shiftType: ShiftType
    date: date
    startTime: str
    endTime: str
    notes: Optional[str] = None


class AttendanceIn(BaseModel):
    staffId: str
    date: date
    status: AttendanceStatus
    checkIn: Optional[str] = None
    checkOut: Optional[str] = None
    hoursWorked: Optional[float] = None
    notes: Optional[str] = None


class AttendanceUpdate(BaseModel):
    status: Optional[AttendanceStatus] = None
    checkIn: Optional[str] = None
    checkOut: Optional[str] = None
    hoursWorked: Optional[float] = None
    notes: Optional[str] = None


class AttendanceBulkItem(BaseModel):
    staffId: str
    date: date
    status: AttendanceStatus
    checkIn: Optional[str] = None
    checkOut: Optional[str] = None
    hoursWorked: Optional[float] = None
    notes: Optional[str] = None


class AttendanceBulkIn(BaseModel):
    records: list[AttendanceBulkItem]


class AttendanceOut(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    staffId: str
    staffName: Optional[str] = None
    date: date
    status: str
    checkIn: Optional[str] = None
    checkOut: Optional[str] = None
    hoursWorked: Optional[float] = None
    notes: Optional[str] = None
    createdAt: Optional[datetime] = None


# ============ PERFORMANCE LOGGING ============
class PerformanceLogIn(BaseModel):
    staffId: str
    metric: str  # e.g., 'orders_served', 'tables_handled', 'customer_rating', 'attendance_score'
    value: float
    period: Optional[str] = None  # e.g., 'daily', 'weekly', 'monthly'
    notes: Optional[str] = None


class PerformanceLogOut(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    staffId: str
    staffName: Optional[str] = None
    metric: str
    value: float
    period: Optional[str] = None
    notes: Optional[str] = None
    createdAt: Optional[datetime] = None


# ============ PASSWORD MANAGEMENT ============
class PasswordChange(BaseModel):
    userId: str
    currentPassword: str
    newPassword: str


class PasswordReset(BaseModel):
    email: EmailStr


# ============ BACKUP & RECOVERY ============
class BackupCreate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = "manual"  # manual, automatic
    collections: Optional[List[str]] = None  # specific collections, or None for all


class BackupConfig(BaseModel):
    autoBackupEnabled: bool = True
    frequency: Optional[str] = "daily"  # hourly, daily, weekly, monthly
    backupTime: Optional[str] = "02:00"  # HH:MM format for scheduled backups
    retentionDays: int = 30
    backupLocation: Optional[str] = "local"  # local, google_drive, both
    googleDriveFolderId: Optional[str] = None
    googleDriveEnabled: bool = False


class BackupOut(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: str
    size: Optional[str] = None
    date: str
    time: str
    status: str  # completed, failed, in_progress
    type: str  # manual, automatic
    createdAt: Optional[datetime] = None


# ============ AUDIT LOGS ============
class AuditOut(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    action: str
    resource: Optional[str] = None
    resourceId: Optional[str] = None
    userId: Optional[str] = None
    userName: Optional[str] = None
    details: Optional[Any] = None
    ip: Optional[str] = None
    device: Optional[str] = None
    status: Optional[str] = "success"
    createdAt: Optional[datetime] = None


# ============ ROLES & PERMISSIONS ============
class RolePermissions(BaseModel):
    dashboard: bool = False
    menu: bool = False
    orders: bool = False
    kitchen: bool = False
    tables: bool = False
    inventory: bool = False
    staff: bool = False
    billing: bool = False
    offers: bool = False
    reports: bool = False
    notifications: bool = False
    settings: bool = False


class RoleIn(BaseModel):
    name: str
    description: Optional[str] = None
    permissions: RolePermissions


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[RolePermissions] = None


class RoleOut(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: str
    description: Optional[str] = None
    permissions: RolePermissions
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None



# ============ MENU MANAGEMENT ============

class DietType(str, Enum):
    veg = "veg"
    non_veg = "non-veg"


class CuisineType(str, Enum):
    south_indian = "south indian"
    north_indian = "north indian"
    chinese = "chinese"
    italian = "italian"
    continental = "continental"


class MenuCustomization(BaseModel):
    name: str
    price: float


class IngredientEntry(BaseModel):
    name: str
    quantity: float
    unit: str  # e.g. grams, ml, pcs, tbsp


class MenuOffer(BaseModel):
    discount: float
    label: Optional[str] = None


class MenuItemIn(BaseModel):
    name: str
    category: str
    cuisine: str
    price: float
    description: Optional[str] = ""
    image: Optional[str] = ""
    available: Optional[bool] = True

    spiceLevel: Optional[str] = None
    preparationTime: Optional[int] = None
    prepTime: Optional[str] = None
    calories: Optional[int] = None
    dietType: Optional[DietType] = None
    cookingStation: Optional[str] = None

    addons: Optional[List[Any]] = []
    badges: Optional[List[str]] = []
    offerLabel: Optional[str] = None
    offerDiscount: Optional[str] = None

    customizations: Optional[List[MenuCustomization]] = []
    offer: Optional[MenuOffer] = None
    ingredients: Optional[List[Any]] = []


class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    cuisine: Optional[str] = None
    price: Optional[float] = None
    description: Optional[str] = None
    image: Optional[str] = None
    available: Optional[bool] = None

    spiceLevel: Optional[str] = None
    preparationTime: Optional[int] = None
    prepTime: Optional[str] = None
    calories: Optional[int] = None
    dietType: Optional[DietType] = None
    cookingStation: Optional[str] = None

    addons: Optional[List[Any]] = None
    badges: Optional[List[str]] = None
    offerLabel: Optional[str] = None
    offerDiscount: Optional[str] = None

    customizations: Optional[List[MenuCustomization]] = None
    offer: Optional[MenuOffer] = None
    ingredients: Optional[List[Any]] = None


class MenuItemOut(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: str
    category: str
    cuisine: str
    price: float
    description: Optional[str] = ""
    image: Optional[str] = ""
    available: bool

    spiceLevel: Optional[str] = None
    preparationTime: Optional[int] = None

    dietType: Optional[str] = None
    cookingStation: Optional[str] = None
    customizations: Optional[List[MenuCustomization]] = []
    offer: Optional[MenuOffer] = None
    ingredients: Optional[List[IngredientEntry]] = []

    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None


# ==============================
# NOTIFICATIONS
# ==============================

class NotificationType(str, Enum):
    order = "order"
    payment = "payment"
    reservation = "reservation"
    system = "system"
    chat = "chat"
    broadcast = "broadcast"


class NotificationChannel(str, Enum):
    email = "email"
    sms = "sms"
    push = "push"
    internal = "internal"


class NotificationStatus(str, Enum):
    pending = "pending"
    sent = "sent"
    failed = "failed"


class NotificationIn(BaseModel):
    type: NotificationType
    title: str
    message: str
    recipient: str
    channel: NotificationChannel
    status: Optional[NotificationStatus] = NotificationStatus.pending
    senderRole: Optional[str] = None


# ============ TAX & SERVICE CONFIGURATION ============
class TaxConfigIn(BaseModel):
    gstEnabled: bool = True
    gstRate: float = 5.0
    cgstRate: float = 2.5
    sgstRate: float = 2.5
    serviceChargeEnabled: bool = True
    serviceChargeRate: float = 10.0
    packagingChargeEnabled: bool = True
    packagingChargeRate: float = 20.0


class TaxConfigOut(TaxConfigIn):
    id: Optional[str] = Field(None, alias="_id")
    updatedBy: Optional[str] = None
    updatedAt: Optional[datetime] = None


# ============ DISCOUNT RULES ============
class DiscountType(str, Enum):
    percentage = "percentage"
    fixed = "fixed"


class DiscountRuleIn(BaseModel):
    name: str
    type: DiscountType = DiscountType.percentage
    value: float
    minOrderAmount: float = 0
    maxDiscount: float = 0
    enabled: bool = True


class DiscountRuleUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[DiscountType] = None
    value: Optional[float] = None
    minOrderAmount: Optional[float] = None
    maxDiscount: Optional[float] = None
    enabled: Optional[bool] = None


class DiscountRuleOut(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: str
    type: str
    value: float
    minOrderAmount: float
    maxDiscount: float
    enabled: bool
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None


# ============ USER ACCOUNTS ============
class UserAccountIn(BaseModel):
    name: str
    email: EmailStr
    role: str = "Waiter"
    password: str


class UserAccountUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    status: Optional[str] = None
    password: Optional[str] = None


class UserAccountOut(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: str
    email: str
    role: str
    status: str = "active"
    lastLogin: Optional[str] = None
    createdAt: Optional[datetime] = None

# ============ CATALOG MANAGEMENT (Cuisines, Categories, Addons) ============
class CuisineIn(BaseModel):
    name: str
    description: Optional[str] = None


class CuisineOut(CuisineIn):
    id: Optional[str] = Field(None, alias="_id")
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None


class CategoryIn(BaseModel):
    name: str
    displayName: Optional[str] = None
    description: Optional[str] = None


class CategoryOut(CategoryIn):
    id: Optional[str] = Field(None, alias="_id")
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None


class AddonIn(BaseModel):
    name: str
    description: Optional[str] = None
    price: Optional[float] = 0


class AddonOut(AddonIn):
    id: Optional[str] = Field(None, alias="_id")
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None