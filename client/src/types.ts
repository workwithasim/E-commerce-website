export type UserRole =
  | 'SUPER_ADMIN'
  | 'TENANT_ADMIN'
  | 'BRANCH_MANAGER'
  | 'KITCHEN_MANAGER'
  | 'KITCHEN_STAFF'
  | 'DISPATCHER'
  | 'SUPPORT_STAFF'
  | 'RIDER'
  | 'CUSTOMER';

export interface TenantBranding {
  id?: string;
  tenantId?: string;
  logo: string;
  logoDark?: string | null;
  mobileLogo?: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedTextColor: string;
  headingFont?: string;
  bodyFont?: string;
  buttonRadius?: string;
  cardRadius?: string;
}

export interface TenantSettings {
  id?: string;
  tenantId?: string;
  currency: string;
  currencySymbol: string;
  minimumOrder: number;
  deliveryFee: number;
  freeDeliveryThreshold: number;
  hotline?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  deliveryEnabled?: boolean;
  takeawayEnabled?: boolean;
  riderTrackingEnabled?: boolean;
  cashOnDeliveryEnabled?: boolean;
  taxEnabled?: boolean;
  taxRate?: number;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  currency: string;
  country: string;
  branding?: TenantBranding | null;
  settings?: TenantSettings | null;
  branches?: Branch[];
  banners?: Banner[];
  _count?: {
    branches: number;
    products: number;
    orders?: number;
    users?: number;
  };
}

export interface Banner {
  id: string;
  title: string;
  subtitle?: string | null;
  desktopImage: string;
  mobileImage?: string | null;
  buttonText?: string | null;
  buttonUrl?: string | null;
  sortOrder: number;
}

export interface Category {
  id: string;
  tenantId?: string;
  name: string;
  slug: string;
  image?: string | null;
  description?: string | null;
  sortOrder?: number;
  _count?: {
    products: number;
  };
}

export interface ProductOption {
  id: string;
  groupId: string;
  name: string;
  priceModifier: number;
  isDefault?: boolean;
  sortOrder?: number;
}

export interface ProductOptionGroup {
  id: string;
  productId: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  sortOrder: number;
  options: ProductOption[];
}

export interface Product {
  id: string;
  tenantId?: string;
  name: string;
  slug?: string;
  description?: string | null;
  basePrice: number;
  price?: number; // fallback alias
  discountedPrice?: number | null;
  image: string;
  isBestSeller: boolean;
  isDeal: boolean;
  isFeatured?: boolean;
  isAvailable: boolean;
  inStock?: boolean; // fallback alias
  categoryId?: string | null;
  category?: Category | null;
  optionGroups?: ProductOptionGroup[];
  createdAt?: string;
}

export interface Branch {
  id: string;
  tenantId?: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  isOpen: boolean;
  openingHours?: string;
  timing?: string; // fallback alias
  deliveryFee?: number;
  minimumOrder?: number;
}

export interface CartItemOptionSelection {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceModifier: number;
}

export interface CartItem {
  cartItemId: string;
  productId: string;
  name: string;
  image: string;
  basePrice?: number;
  unitPrice: number;
  quantity: number;
  selectedOptions?: CartItemOptionSelection[];
  size?: string | null;
  crust?: string | null;
  flavor?: string | null;
  drink?: string | null;
  addons?: any;
  instructions?: string;
}

export interface OrderItem {
  id?: string;
  productId?: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
  size?: string | null;
  variant?: string | null;
  addons?: string | null;
  instructions?: string | null;
  optionsJson?: string | null;
}

export interface OrderStatusHistory {
  id: string;
  oldStatus?: string | null;
  newStatus: string;
  changedBy?: string | null;
  timestamp: string;
}

export interface RiderLocation {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  timestamp?: string;
}

export interface Rider {
  id: string;
  userId: string;
  vehicleType: string;
  vehicleNumber?: string | null;
  deliveryZone?: string | null;
  branchId?: string | null;
  branch?: Branch | null;
  lastActiveAt?: string | null;
  status: 'OFFLINE' | 'AVAILABLE' | 'BUSY' | 'ON_DELIVERY';
  isAvailable: boolean;
  user: {
    id: string;
    name: string;
    phone?: string | null;
    email: string;
  };
  locations?: RiderLocation[];
  deliveries?: Delivery[];
  activity?: Array<{ id: string; action: string; entity: string; entityId: string; timestamp: string }>;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  employeeId?: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
  roleAssignments: Array<{ id: string; role: UserRole; branchId?: string | null; branch?: { id: string; name: string } | null }>;
  staffInvitation?: { status: string; expiresAt: string; createdAt: string } | null;
  riderProfile?: Rider | null;
}

export interface Delivery {
  order?: Order;
  id: string;
  orderId: string;
  riderId?: string | null;
  status: 'PENDING' | 'ASSIGNED' | 'ACCEPTED' | 'PICKED_UP' | 'ON_THE_WAY' | 'DELIVERED' | 'CANCELLED';
  rider?: Rider | null;
  deliveryAddress?: string | null;
  assignedAt?: string | null;
  acceptedAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
}

export interface Order {
  id: string;
  tenantId?: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress?: string | null;
  landmark?: string | null;
  notes?: string | null;
  orderMode: 'DELIVERY' | 'TAKEAWAY' | 'DINE_IN';
  branchId?: string | null;
  branch?: Branch | null;
  paymentMethod: string;
  status: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'RIDER_ASSIGNED' | 'PICKED_UP' | 'ON_THE_WAY' | 'DELIVERED' | 'CANCELLED';
  subtotal: number;
  deliveryFee: number;
  discount: number;
  tax?: number;
  total: number;
  items: OrderItem[];
  statusHistory?: OrderStatusHistory[];
  delivery?: Delivery | null;
  createdAt: string;
  updatedAt?: string;
}

export interface VoucherVerification {
  valid: boolean;
  code: string;
  discountType: string;
  discountValue: number;
  discountAmount: number;
  message: string;
}

export interface AnalyticsStats {
  totalOrders: number;
  pendingOrders: number;
  kitchenOrders: number;
  readyOrders?: number;
  onTheWayOrders?: number;
  deliveredOrders: number;
  activeRiders?: number;
  totalRevenue: number;
}
