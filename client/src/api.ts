import { io } from 'socket.io-client';
import { Category, Product, Branch, Order, AnalyticsStats } from './types';

export const API_URL = 'http://localhost:5000';
export const socket = io(API_URL);

// API Service
export const api = {
  // Categories
  async getCategories(): Promise<Category[]> {
    const res = await fetch(`${API_URL}/api/categories`);
    return res.json();
  },

  async createCategory(name: string, image?: string): Promise<Category> {
    const res = await fetch(`${API_URL}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, image }),
    });
    return res.json();
  },

  // Products
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData),
    });
    return res.json();
  },

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    const res = await fetch(`${API_URL}/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return res.json();
  },

  async deleteProduct(id: string): Promise<void> {
    await fetch(`${API_URL}/api/products/${id}`, { method: 'DELETE' });
  },

  // Branches
  async getBranches(city?: string): Promise<Branch[]> {
    const query = city ? `?city=${encodeURIComponent(city)}` : '';
    const res = await fetch(`${API_URL}/api/branches${query}`);
    return res.json();
  },

  // Orders
  async createOrder(orderData: any): Promise<Order> {
    const res = await fetch(`${API_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData),
    });
    return res.json();
  },

  async getOrders(status?: string): Promise<Order[]> {
    const query = status ? `?status=${status}` : '';
    const res = await fetch(`${API_URL}/api/orders${query}`);
    return res.json();
  },

  async updateOrderStatus(id: string, status: string): Promise<Order> {
    const res = await fetch(`${API_URL}/api/orders/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return res.json();
  },

  // Vouchers
  async verifyVoucher(code: string, subtotal: number) {
    const res = await fetch(`${API_URL}/api/vouchers/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, subtotal }),
    });
    return res.json();
  },

  // Analytics
  async getStats(): Promise<AnalyticsStats> {
    const res = await fetch(`${API_URL}/api/analytics/stats`);
    return res.json();
  },
};
