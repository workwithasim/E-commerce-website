/// <reference types="vite/client" />
import { io } from 'socket.io-client';
import {
  Category,
  Product,
  Branch,
  Order,
  AnalyticsStats,
  Tenant,
  Delivery,
  Rider,
  VoucherVerification,
  Banner,
  StaffMember,
} from './types';

export const API_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.port === '5173'
    ? 'http://localhost:5000'
    : '');

export const socket = io(API_URL || undefined, { autoConnect: false });
export function reconnectSocket() {
  socket.disconnect();
  socket.auth = { token: getToken(), tenantSlug: getActiveTenantSlug() };
  socket.connect();
}

// ── Multi-Tenant Slug Helper ─────────────────────────────────────────
export const getActiveTenantSlug = (): string => {
  if (typeof window === 'undefined') return import.meta.env.VITE_DEFAULT_TENANT_SLUG || '';
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('tenant');
  if (fromUrl) return fromUrl.toLowerCase();
  return localStorage.getItem('platform_tenant_slug') || import.meta.env.VITE_DEFAULT_TENANT_SLUG || '';
};

// ── JWT Token Helpers ────────────────────────────────────────────────
export const getToken = (): string | null => localStorage.getItem('platform_auth_token');
export const getRefreshToken = (): string | null => localStorage.getItem('platform_refresh_token');
export const setSession = (token: string, refreshToken?: string) => {
  localStorage.setItem('platform_auth_token', token);
  if (refreshToken) localStorage.setItem('platform_refresh_token', refreshToken);
  reconnectSocket();
};
export const setToken = (token: string) => setSession(token);
export const removeToken = () => {
  localStorage.removeItem('platform_auth_token');
  localStorage.removeItem('platform_refresh_token');
  reconnectSocket();
};

export const getHeaders = () => {
  const token = getToken();
  const slug = getActiveTenantSlug();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-tenant-slug': slug,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// Standard response unpacker helper
async function handleResponse<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || 'Request failed');
  if (json.success !== undefined) {
    if (!json.success) {
      throw new Error(json.error?.message || 'API request failed');
    }
    return json.data;
  }
  return json;
}

let refreshRequest: Promise<boolean> | null = null;
async function refreshSession() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  if (!refreshRequest) {
    refreshRequest = fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).then(async res => {
      if (!res.ok) return false;
      const json = await res.json();
      if (!json.success) return false;
      setSession(json.data.token, json.data.refreshToken);
      localStorage.setItem('platform_auth_user', JSON.stringify(json.data.user));
      return true;
    }).catch(() => false).finally(() => { refreshRequest = null; });
  }
  return refreshRequest;
}

async function authenticatedFetch(input: string, init: RequestInit = {}) {
  let res = await fetch(input, { ...init, headers: { ...getHeaders(), ...(init.headers || {}) } });
  if (res.status === 401 && getRefreshToken()) {
    if (await refreshSession()) {
      res = await fetch(input, { ...init, headers: { ...getHeaders(), ...(init.headers || {}) } });
    } else {
      removeToken();
      localStorage.removeItem('platform_auth_user');
      window.dispatchEvent(new Event('platform:logout'));
    }
  }
  return res;
}

// ── Comprehensive API Service ────────────────────────────────────────
export const api = {
  // ── Auth ──────────────────────────────────────────────────────────
  async login(email: string, password: string) {
    const res = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },

  async register(name: string, email: string, password: string, phone?: string) {
    const res = await fetch(`${API_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, email, password, phone }),
    });
    return res.json();
  },

  async getMe() {
    const res = await authenticatedFetch(`${API_URL}/api/v1/auth/me`);
    return res.json();
  },

  async getStaff(params?: { search?: string; role?: string; status?: string; branchId?: string }): Promise<StaffMember[]> {
    const query = new URLSearchParams(Object.entries(params || {}).filter(([, value]) => Boolean(value)) as string[][]);
    return handleResponse(await authenticatedFetch(`${API_URL}/api/v1/staff?${query}`));
  },

  async createStaff(payload: { name: string; email: string; phone?: string; employeeId?: string; role: string; branchIds: string[] }): Promise<any> {
    return handleResponse(await authenticatedFetch(`${API_URL}/api/v1/staff`, { method: 'POST', body: JSON.stringify(payload) }));
  },

  async acceptStaffInvitation(token: string, password: string): Promise<any> {
    return handleResponse(await fetch(`${API_URL}/api/v1/staff/accept-invitation`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ token, password }) }));
  },

  async updateStaff(id: string, payload: { name?: string; phone?: string; employeeId?: string; role?: string; branchIds?: string[] }): Promise<any> {
    return handleResponse(await authenticatedFetch(`${API_URL}/api/v1/staff/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }));
  },

  async setStaffStatus(id: string, isActive: boolean): Promise<any> {
    return handleResponse(await authenticatedFetch(`${API_URL}/api/v1/staff/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }));
  },

  async logout() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return;
    await fetch(`${API_URL}/api/v1/auth/logout`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  },

  // ── Tenants (Multi-Tenant & Super Admin) ───────────────────────────
  async getAllTenants(): Promise<Tenant[]> {
    const res = await authenticatedFetch(`${API_URL}/api/v1/tenants`);
    return handleResponse<Tenant[]>(res);
  },

  async getPublicTenant(slug: string): Promise<Tenant> {
    const res = await authenticatedFetch(`${API_URL}/api/v1/tenants/${slug}/public`, { headers: getHeaders() });
    return handleResponse<Tenant>(res);
  },

  async createTenant(tenantData: any): Promise<Tenant> {
    const res = await authenticatedFetch(`${API_URL}/api/v1/tenants`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(tenantData),
    });
    return handleResponse<Tenant>(res);
  },

  async updateBranding(tenantId: string, branding: any) {
    const res = await authenticatedFetch(`${API_URL}/api/v1/tenants/${tenantId}/branding`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(branding),
    });
    return handleResponse(res);
  },

  async updateSettings(tenantId: string, settings: any) {
    const res = await authenticatedFetch(`${API_URL}/api/v1/tenants/${tenantId}/settings`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(settings),
    });
    return handleResponse(res);
  },

  // ── Categories ────────────────────────────────────────────────────
  async getCategories(): Promise<Category[]> {
    const res = await authenticatedFetch(`${API_URL}/api/v1/categories`, { headers: getHeaders() });
    return handleResponse<Category[]>(res);
  },

  async createCategory(name: string, image?: string, description?: string): Promise<Category> {
    const res = await authenticatedFetch(`${API_URL}/api/v1/categories`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, image, description }),
    });
    return handleResponse<Category>(res);
  },

  async deleteCategory(id: string): Promise<void> {
    const res = await authenticatedFetch(`${API_URL}/api/v1/categories/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    await handleResponse(res);
  },

  // ── Products & Options ────────────────────────────────────────────
  async getProducts(params?: {
    categoryId?: string;
    search?: string;
    inStockOnly?: boolean;
    isDeal?: boolean;
    isBestSeller?: boolean;
  }): Promise<Product[]> {
    const query = new URLSearchParams();
    if (params?.categoryId) query.set('categoryId', params.categoryId);
    if (params?.search) query.set('search', params.search);
    if (params?.inStockOnly) query.set('inStockOnly', 'true');
    if (params?.isDeal) query.set('isDeal', 'true');
    if (params?.isBestSeller) query.set('isBestSeller', 'true');

    const res = await authenticatedFetch(`${API_URL}/api/v1/products?${query.toString()}`, {
      headers: getHeaders(),
    });
    return handleResponse<Product[]>(res);
  },

  async getProduct(id: string): Promise<Product> {
    const res = await authenticatedFetch(`${API_URL}/api/v1/products/${id}`, { headers: getHeaders() });
    return handleResponse<Product>(res);
  },

  async createProduct(productData: Partial<Product>): Promise<Product> {
    const res = await authenticatedFetch(`${API_URL}/api/v1/products`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(productData),
    });
    return handleResponse<Product>(res);
  },

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    const res = await authenticatedFetch(`${API_URL}/api/v1/products/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    return handleResponse<Product>(res);
  },

  async deleteProduct(id: string): Promise<void> {
    const res = await authenticatedFetch(`${API_URL}/api/v1/products/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    await handleResponse(res);
  },

  async addProductOptionGroup(productId: string, groupData: any) {
    const res = await authenticatedFetch(`${API_URL}/api/v1/products/${productId}/options`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(groupData),
    });
    return handleResponse(res);
  },

  // ── Branches ──────────────────────────────────────────────────────
  async getBranches(city?: string): Promise<Branch[]> {
    const query = city ? `?city=${encodeURIComponent(city)}` : '';
    const res = await authenticatedFetch(`${API_URL}/api/v1/branches${query}`, { headers: getHeaders() });
    return handleResponse<Branch[]>(res);
  },

  async toggleBranch(id: string): Promise<Branch> {
    const res = await authenticatedFetch(`${API_URL}/api/v1/branches/${id}/toggle`, {
      method: 'PATCH',
      headers: getHeaders(),
    });
    return handleResponse<Branch>(res);
  },

  async createBranch(branchData: any): Promise<Branch> {
    const res = await authenticatedFetch(`${API_URL}/api/v1/branches`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(branchData),
    });
    return handleResponse<Branch>(res);
  },

  async quoteOrder(payload: any): Promise<any> {
    return handleResponse(await authenticatedFetch(`${API_URL}/api/v1/orders/quote`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) }));
  },
  async setRiderAvailability(isAvailable: boolean): Promise<Rider> {
    return handleResponse(await authenticatedFetch(`${API_URL}/api/v1/deliveries/riders/availability`, { method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ isAvailable }) }));
  },
  // ── Orders ────────────────────────────────────────────────────────
  async createOrder(orderData: any): Promise<Order> {
    const res = await authenticatedFetch(`${API_URL}/api/v1/orders`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(orderData),
    });
    return handleResponse<Order>(res);
  },

  async getOrders(params?: { status?: string; branchId?: string }): Promise<Order[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.branchId) query.set('branchId', params.branchId);

    const res = await authenticatedFetch(`${API_URL}/api/v1/orders?${query.toString()}`, {
      headers: getHeaders(),
    });
    return handleResponse<Order[]>(res);
  },

  async getOrder(id: string): Promise<Order> {
    const res = await authenticatedFetch(`${API_URL}/api/v1/orders/${id}`, { headers: getHeaders() });
    return handleResponse<Order>(res);
  },

  async getAdminOrderDetail(id: string): Promise<any> {
    return handleResponse(await authenticatedFetch(`${API_URL}/api/v1/orders/admin/${id}`));
  },

  async getOrderMessages(id: string): Promise<any[]> {
    return handleResponse(await authenticatedFetch(`${API_URL}/api/v1/orders/${id}/messages`));
  },

  async sendOrderMessage(id: string, message: string): Promise<any> {
    return handleResponse(await authenticatedFetch(`${API_URL}/api/v1/orders/${id}/messages`, { method: 'POST', body: JSON.stringify({ message }) }));
  },

  async getInternalNotes(id: string): Promise<any[]> {
    return handleResponse(await authenticatedFetch(`${API_URL}/api/v1/orders/${id}/internal-notes`));
  },

  async addInternalNote(id: string, note: string): Promise<any> {
    return handleResponse(await authenticatedFetch(`${API_URL}/api/v1/orders/${id}/internal-notes`, { method: 'POST', body: JSON.stringify({ note }) }));
  },

  async updateOrderStatus(id: string, status: string, note?: string): Promise<Order> {
    const res = await authenticatedFetch(`${API_URL}/api/v1/orders/${id}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status, note }),
    });
    return handleResponse<Order>(res);
  },

  // ── Riders & Deliveries ───────────────────────────────────────────
  async getRiders(): Promise<Rider[]> {
    const res = await authenticatedFetch(`${API_URL}/api/v1/deliveries/riders`, { headers: getHeaders() });
    return handleResponse<Rider[]>(res);
  },

  async getRider(id: string): Promise<Rider> {
    return handleResponse(await authenticatedFetch(`${API_URL}/api/v1/deliveries/riders/${id}`));
  },

  async updateRider(id: string, payload: { branchId?: string | null; vehicleType?: string; vehicleNumber?: string; deliveryZone?: string }): Promise<Rider> {
    return handleResponse(await authenticatedFetch(`${API_URL}/api/v1/deliveries/riders/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }));
  },

  async getAssignedDeliveries(): Promise<Delivery[]> {
    const res = await authenticatedFetch(`${API_URL}/api/v1/deliveries/assigned`, { headers: getHeaders() });
    return handleResponse<Delivery[]>(res);
  },

  async assignRider(orderId: string, riderId: string): Promise<Delivery> {
    const res = await authenticatedFetch(`${API_URL}/api/v1/deliveries/assign`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ orderId, riderId }),
    });
    return handleResponse<Delivery>(res);
  },

  async updateDeliveryStatus(deliveryId: string, status: string): Promise<Delivery> {
    const res = await authenticatedFetch(`${API_URL}/api/v1/deliveries/${deliveryId}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    });
    return handleResponse<Delivery>(res);
  },

  async sendRiderLocation(
    deliveryId: string,
    coords: { latitude: number; longitude: number; heading?: number; speed?: number }
  ) {
    const res = await authenticatedFetch(`${API_URL}/api/v1/deliveries/${deliveryId}/location`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(coords),
    });
    return handleResponse(res);
  },

  // ── Vouchers ──────────────────────────────────────────────────────
  async verifyVoucher(code: string, subtotal: number): Promise<VoucherVerification> {
    const res = await authenticatedFetch(`${API_URL}/api/v1/vouchers/verify`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ code, subtotal }),
    });
    return handleResponse<VoucherVerification>(res);
  },

  // ── Banners ───────────────────────────────────────────────────────
  async getBanners(): Promise<Banner[]> {
    const res = await authenticatedFetch(`${API_URL}/api/v1/banners`, { headers: getHeaders() });
    return handleResponse<Banner[]>(res);
  },

  // ── Analytics ─────────────────────────────────────────────────────
  async getStats(branchId?: string): Promise<AnalyticsStats> {
    const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
    const res = await authenticatedFetch(`${API_URL}/api/v1/analytics/stats${query}`, { headers: getHeaders() });
    return handleResponse<AnalyticsStats>(res);
  },

  async getSuperAdminStats() {
    const res = await authenticatedFetch(`${API_URL}/api/v1/analytics/superadmin`, { headers: getHeaders() });
    return handleResponse(res);
  },
};
