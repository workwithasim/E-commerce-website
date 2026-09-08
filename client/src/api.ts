/// <reference types="vite/client" />
import { io } from 'socket.io-client';
import { Category, Product, Branch, Order, AnalyticsStats } from './types';

export const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.port === '5173' ? 'http://localhost:5000' : '');
export const socket = io(API_URL || undefined);

// ── JWT Token Helpers ────────────────────────────────────────────────
export const getToken = (): string | null => localStorage.getItem('cheezious_token');
export const setToken = (token: string) => localStorage.setItem('cheezious_token', token);
export const removeToken = () => localStorage.removeItem('cheezious_token');

const authHeaders = () => {
  const token = getToken();
  return token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json' };
};

// API Service
export const api = {
  // ── Auth ──────────────────────────────────────────────────────────
  async login(email: string, password: string) {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },

  async register(name: string, email: string, password: string, phone?: string) {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, phone }),
    });
    return res.json();
  },

  async getMe() {
    const res = await fetch(`${API_URL}/api/auth/me`, { headers: authHeaders() });
    return res.json();
  },

  // ── Categories ────────────────────────────────────────────────────
  async getCategories(): Promise<Category[]> {
    const res = await fetch(`${API_URL}/api/categories`);
    return res.json();
  },

  async createCategory(name: string, image?: string): Promise<Category> {
    const res = await fetch(`${API_URL}/api/categories`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name, image }),
    });
    return res.json();
  },

  // ── Products ──────────────────────────────────────────────────────
  async getProducts(params?: { categoryId?: string; search?: string }): Promise<Product[]> {
    const query = new URLSearchParams();
    if (params?.categoryId) query.set('categoryId', params.categoryId);
    if (params?.search) query.set('search', params.search);
    const res = await fetch(`${API_URL}/api/products?${query.toString()}`);
    return res.json();
  },

  async createProduct(productData: Partial<Product>): Promise<Product> {
    const res = await fetch(`${API_URL}/api/products`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(productData),
    });
    return res.json();
  },

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    const res = await fetch(`${API_URL}/api/products/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(updates),
    });
    return res.json();
  },

  async deleteProduct(id: string): Promise<void> {
    await fetch(`${API_URL}/api/products/${id}`, { method: 'DELETE', headers: authHeaders() });
  },

  // ── Branches ──────────────────────────────────────────────────────
  async getBranches(city?: string): Promise<Branch[]> {
    const query = city ? `?city=${encodeURIComponent(city)}` : '';
    const res = await fetch(`${API_URL}/api/branches${query}`);
    return res.json();
  },

  // ── Orders ────────────────────────────────────────────────────────
  async createOrder(orderData: any): Promise<Order> {
    const res = await fetch(`${API_URL}/api/orders`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(orderData),
    });
    return res.json();
  },

  async getOrders(status?: string): Promise<Order[]> {
    const query = status ? `?status=${status}` : '';
    const res = await fetch(`${API_URL}/api/orders${query}`, { headers: authHeaders() });
    return res.json();
  },

  async updateOrderStatus(id: string, status: string): Promise<Order> {
    const res = await fetch(`${API_URL}/api/orders/${id}/status`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    });
    return res.json();
  },

  // ── Vouchers ──────────────────────────────────────────────────────
  async verifyVoucher(code: string, subtotal: number) {
    const res = await fetch(`${API_URL}/api/vouchers/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, subtotal }),
    });
    return res.json();
  },

  // ── Analytics ─────────────────────────────────────────────────────
  async getStats(): Promise<AnalyticsStats> {
    const res = await fetch(`${API_URL}/api/analytics/stats`, { headers: authHeaders() });
    return res.json();
  },
};
