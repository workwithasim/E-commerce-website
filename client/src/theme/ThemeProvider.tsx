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
}

const defaultBranding: TenantBranding = {
  primaryColor: '#D80032',
  secondaryColor: '#FFE600',
  accentColor: '#1A1A1A',
  backgroundColor: '#FFFFFF',
  surfaceColor: '#FFFDF0',
  textColor: '#1A1A1A',
  mutedTextColor: '#71717A',
  logo: 'https://images.deliveryhero.io/image/fd-pk/LH/w3ws-listing.jpg',
  buttonRadius: '8px',
  cardRadius: '14px',
};

const defaultSettings: TenantSettings = {
  currency: 'PKR',
  currencySymbol: 'Rs.',
  minimumOrder: 500,
  deliveryFee: 100,
  freeDeliveryThreshold: 2000,
  hotline: '051-111-44-66-99',
  whatsapp: '+923001234567',
  deliveryEnabled: true,
  takeawayEnabled: true,
  riderTrackingEnabled: true,
};

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  branding: defaultBranding,
  settings: defaultSettings,
  allTenants: [],
  currentSlug: 'cheezious',
  switchTenant: () => {},
  refreshTenant: async () => {},
  loading: true,
});

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentSlug, setCurrentSlug] = useState<string>(() => {
    // Check URL query ?tenant=slug or localStorage or default to cheezious
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('tenant');
    if (fromUrl) return fromUrl.toLowerCase();
    return localStorage.getItem('platform_tenant_slug') || 'cheezious';
  });

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [allTenants, setAllTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

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

    // Also update favicon and page title
    if (branding.logo) {
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link) link.href = branding.logo;
    }
  };

  const fetchTenantData = async (slug: string) => {
    setLoading(true);
    try {
      // 1. Fetch public tenant data
      const res = await fetch(`http://localhost:5000/api/v1/tenants/${slug}/public`, {
        headers: { 'x-tenant-slug': slug },
      });
      const json = await res.json();

      if (json.success && json.data) {
        setTenant(json.data);
        const branding = json.data.branding || defaultBranding;
        applyTheme(branding);
        document.title = `${json.data.name} | Food Ordering Platform`;
      } else {
        // Fallback default
        applyTheme(defaultBranding);
      }

      // 2. Fetch list of all active tenants (for the tenant switcher bar)
      const listRes = await fetch('http://localhost:5000/api/v1/tenants');
      const listJson = await listRes.json();
      if (listJson.success && Array.isArray(listJson.data)) {
        setAllTenants(listJson.data);
      }
    } catch (err) {
      console.warn('Tenant load fallback to defaults:', err);
      applyTheme(defaultBranding);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenantData(currentSlug);
  }, [currentSlug]);

  const switchTenant = (slug: string) => {
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
        loading,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => useContext(TenantContext);
