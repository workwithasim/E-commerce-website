export interface Category {
  id: string;
  name: string;
  image?: string | null;
  slug: string;
  _count?: {
    products: number;
  };
}

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  discountedPrice?: number | null;
  image: string;
  isBestSeller: boolean;
  isDeal: boolean;
  inStock: boolean;
  categoryId?: string | null;
  category?: Category | null;
  createdAt: string;
}

export interface Branch {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  isOpen: boolean;
  timing: string;
}

export interface CartAddon {
  name: string;
  extra: number;
}

export interface CartItem {
  cartItemId: string;
  productId: string;
  name: string;
  image: string;
  unitPrice: number;
  quantity: number;
  size?: string | null;
  crust?: string | null;
  flavor?: string | null;
  drink?: string | null;
  addons?: CartAddon[];
  instructions?: string;
}

export interface OrderItem {
  id?: string;
  productId?: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  size?: string | null;
  crust?: string | null;
  flavor?: string | null;
  drink?: string | null;
  addons?: string | null;
  instructions?: string | null;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress?: string | null;
  landmark?: string | null;
  notes?: string | null;
  orderMode: 'DELIVERY' | 'PICKUP';
  branchId?: string | null;
  branch?: Branch | null;
  paymentMethod: string;
  status: 'PENDING' | 'PREPARING' | 'ON_THE_WAY' | 'DELIVERED' | 'CANCELLED';
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Voucher {
  code: string;
  discountType: 'PERCENT' | 'FLAT';
  discountValue: number;
  discountAmount: number;
  message: string;
}

export interface AnalyticsStats {
  totalOrders: number;
  pendingOrders: number;
  kitchenOrders: number;
  deliveredOrders: number;
  totalRevenue: number;
}
