import { API_URL, reconnectSocket, getActiveTenantSlug } from '../api';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Tenant, TenantBranding, TenantSettings } from '../types';

interface TenantContextType {
  tenant: Tenant | null;
  branding: TenantBranding | null;
  settings: TenantSettings | null;
  allTenants: Tenant[];
  currentSlug: string;
  switchTenant: (slug: string) => void;
  refreshTenant: () => Promise<void>;
  loading: boolean;
  error: string;
}

const defaultBranding: TenantBranding = {
  primaryColor: '#D80032',
  secondaryColor: '#FFE600',
  accentColor: '#1A1A1A',
  backgroundColor: '#FFFFFF',
  surfaceColor: '#FFFDF0',
  textColor: '#1A1A1A',
  mutedTextColor: '#71717A',
  logo: '',
  buttonRadius: '8px',
  cardRadius: '14px',
};

const defaultSettings: TenantSettings = {
  currency: 'PKR',
  currencySymbol: 'Rs.',
  minimumOrder: 500,
  deliveryFee: 100,
  freeDeliveryThreshold: 2000,
  hotline: '',
  whatsapp: '',
  deliveryEnabled: true,
  takeawayEnabled: true,
  riderTrackingEnabled: true,
};

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  branding: defaultBranding,
  settings: defaultSettings,
  allTenants: [],
  currentSlug: '',
  switchTenant: () => {},
  refreshTenant: async () => {},
  loading: true, error: '',
});

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentSlug, setCurrentSlug] = useState<string>(getActiveTenantSlug);

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [allTenants, setAllTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Apply CSS custom properties dynamically to :root
  const applyTheme = (branding: TenantBranding) => {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', branding.primaryColor);
    root.style.setProperty('--color-secondary', branding.secondaryColor);
    root.style.setProperty('--color-accent', branding.accentColor || '#1A1A1A');
    root.style.setProperty('--color-background', branding.backgroundColor || '#FFFFFF');
    root.style.setProperty('--color-surface', branding.surfaceColor || '#F8F9FA');
    root.style.setProperty('--color-text', branding.textColor || '#1A1A1A');
    root.style.setProperty('--color-muted', branding.mutedTextColor || '#71717A');
    root.style.setProperty('--radius-btn', branding.buttonRadius || '8px');
    root.style.setProperty('--radius-card', branding.cardRadius || '14px');

    root.style.setProperty('--font-heading', branding.headingFont || 'Inter, sans-serif');
    root.style.setProperty('--font-body', branding.bodyFont || 'Inter, sans-serif');
    // Also update favicon and page title
    if (branding.logo) {
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link) link.href = branding.logo;
    }
  };

  const fetchTenantData = async (slug: string) => {
    setLoading(true);
    setError('');
    setTenant(null);
    try {
      if (!slug) {
        const response = await fetch(`${API_URL}/api/v1/tenants`);
        const available = await response.json();
        const first = available.data?.[0];
        if (!first) throw new Error('No active restaurant is configured');
        slug = first.slug;
        localStorage.setItem('platform_tenant_slug', slug);
        // Resolve the initial restaurant before mounting the storefront.
      }
      // 1. Fetch public tenant data
      const res = await fetch(`${API_URL}/api/v1/tenants/${encodeURIComponent(slug)}/public`, {
        headers: { 'x-tenant-slug': slug },
      });
      const json = await res.json();

      if (json.success && json.data) {
        setTenant(json.data);
        if (currentSlug !== slug) setCurrentSlug(slug);
        const branding = json.data.branding || defaultBranding;
        applyTheme(branding);
        document.title = `${json.data.name} | Food Ordering Platform`;
      } else {
        throw new Error(json.error?.message || 'Restaurant unavailable');
      }

      // 2. Fetch list of all active tenants (for the tenant switcher bar)
      const listRes = await fetch(`${API_URL}/api/v1/tenants`);
      const listJson = await listRes.json();
      if (listJson.success && Array.isArray(listJson.data)) {
        setAllTenants(listJson.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load restaurant');
      applyTheme(defaultBranding);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenantData(currentSlug);
    reconnectSocket();
  }, [currentSlug]);

  const switchTenant = (slug: string) => {
    if (slug === currentSlug) return;
    const saved = localStorage.getItem('platform_auth_user');
    let user: any = null;
    try { user = saved ? JSON.parse(saved) : null; } catch { /* Invalid saved session is discarded on verification. */ }
    if (user && user.role !== 'SUPER_ADMIN' && user.tenantSlug !== slug) {
      localStorage.removeItem('platform_auth_token');
      localStorage.removeItem('platform_auth_user');
      window.dispatchEvent(new Event('platform:logout'));
    }
    localStorage.setItem('platform_tenant_slug', slug);
    setCurrentSlug(slug);
    const url = new URL(window.location.href);
    url.searchParams.set('tenant', slug);
    window.history.replaceState({}, '', url.toString());
  };

  const refreshTenant = async () => {
    await fetchTenantData(currentSlug);
  };

  const branding = tenant?.branding || defaultBranding;
  const settings = tenant?.settings || defaultSettings;

  return (
    <TenantContext.Provider
      value={{
        tenant,
        branding,
        settings,
        allTenants,
        currentSlug,
        switchTenant,
        refreshTenant,
        loading, error,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => useContext(TenantContext);
