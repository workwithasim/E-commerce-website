import React from 'react';
import { useTenant } from '../theme/ThemeProvider';

export const TenantSwitcher: React.FC<{ onOpenSuperAdmin?: () => void }> = ({ onOpenSuperAdmin }) => {
  const { tenant, currentSlug, switchTenant, allTenants } = useTenant();

  // If only 1 tenant loaded, default fallback to the two seeded brands
  const brands = allTenants.length > 0 ? allTenants : [
    { id: '1', name: 'Cheezious', slug: 'cheezious' },
    { id: '2', name: 'Savour Foods', slug: 'savour-foods' },
  ];

  return (
    <div
      style={{
        background: '#0F172A',
        color: '#E2E8F0',
        padding: '6px 16px',
        fontSize: '13px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        borderBottom: '1px solid #1E293B',
        zIndex: 9999,
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          style={{
            background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
            color: '#FFF',
            padding: '2px 8px',
            borderRadius: '4px',
            fontWeight: 800,
            fontSize: '11px',
            letterSpacing: '0.5px',
          }}
        >
          WHITE-LABEL SAAS
        </span>
        <span style={{ color: '#94A3B8' }}>Active Restaurant Tenant:</span>
        <strong style={{ color: '#F8FAFC', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-primary)',
            }}
          />
          {tenant?.name || currentSlug.toUpperCase()}
        </strong>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#64748B', fontSize: '12px' }}>Switch Brand:</span>
        {brands.map((b) => {
          const isSelected = currentSlug.toLowerCase() === b.slug.toLowerCase();
          const isCheezious = b.slug.includes('cheezious');
          return (
            <button
              key={b.slug}
              onClick={() => switchTenant(b.slug)}
              style={{
                background: isSelected ? 'var(--color-primary)' : '#1E293B',
                color: isSelected ? '#FFFFFF' : '#CBD5E1',
                border: isSelected ? '1px solid var(--color-primary)' : '1px solid #334155',
                padding: '3px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: isSelected ? 700 : 500,
                fontSize: '12px',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span>{isCheezious ? '🍕' : '🍗'}</span>
              <span>{b.name}</span>
              {isSelected && <span style={{ fontSize: '10px' }}>✓</span>}
            </button>
          );
        })}

        {onOpenSuperAdmin && (
          <button
            onClick={onOpenSuperAdmin}
            style={{
              background: '#334155',
              color: '#38BDF8',
              border: '1px solid #475569',
              padding: '3px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '12px',
            }}
          >
            ⚙️ Super Admin
          </button>
        )}
      </div>
    </div>
  );
};
