import React, { useState } from 'react';
import { Product, ProductOption, CartItem, CartItemOptionSelection } from '../types';

interface CustomizationModalProps {
  product: Product;
  onClose: () => void;
  onAddToCart: (item: CartItem) => void;
}

export const CustomizationModal: React.FC<CustomizationModalProps> = ({
  product,
  onClose,
  onAddToCart,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [instructions, setInstructions] = useState('');

  // Track chosen options per group: { [groupId: string]: string[] }
  const [selectedOptionIds, setSelectedOptionIds] = useState<{ [groupId: string]: string[] }>(() => {
    const initial: { [groupId: string]: string[] } = {};
    if (product.optionGroups) {
      for (const group of product.optionGroups) {
        // Pick default option or first option if required
        const defaultOpt = group.options.find((o) => o.isDefault) || (group.isRequired ? group.options[0] : null);
        if (defaultOpt) {
          initial[group.id] = [defaultOpt.id];
        } else {
          initial[group.id] = [];
        }
      }
    }
    return initial;
  });

  const basePrice = product.discountedPrice ?? product.basePrice ?? (product as any).price ?? 0;

  // Calculate live option price modifiers
  let extraOptionsTotal = 0;
  const chosenOptionsList: CartItemOptionSelection[] = [];

  if (product.optionGroups) {
    for (const group of product.optionGroups) {
      const chosenIds = selectedOptionIds[group.id] || [];
      for (const optId of chosenIds) {
        const opt = group.options.find((o) => o.id === optId);
        if (opt) {
          extraOptionsTotal += opt.priceModifier;
          chosenOptionsList.push({
            groupId: group.id,
            groupName: group.name,
            optionId: opt.id,
            optionName: opt.name,
            priceModifier: opt.priceModifier,
          });
        }
      }
    }
  }

  const unitPrice = Math.max(0, basePrice + extraOptionsTotal);
  const totalPrice = unitPrice * quantity;

  const handleToggleOption = (group: any, option: ProductOption) => {
    const isSingle = group.maxSelect === 1;
    const current = selectedOptionIds[group.id] || [];

    if (isSingle) {
      setSelectedOptionIds({ ...selectedOptionIds, [group.id]: [option.id] });
    } else {
      if (current.includes(option.id)) {
        setSelectedOptionIds({ ...selectedOptionIds, [group.id]: current.filter((id) => id !== option.id) });
      } else {
        if (current.length < group.maxSelect) {
          setSelectedOptionIds({ ...selectedOptionIds, [group.id]: [...current, option.id] });
        }
      }
    }
  };

  const handleConfirm = () => {
    // Check required option groups
    if (product.optionGroups) {
      for (const g of product.optionGroups) {
        const sel = selectedOptionIds[g.id] || [];
        if (g.isRequired && sel.length === 0) {
          alert(`Please select an option for "${g.name}"`);
          return;
        }
      }
    }

    const cartItem: CartItem = {
      cartItemId: `${product.id}-${Date.now()}`,
      productId: product.id,
      name: product.name,
      image: product.image,
      basePrice,
      unitPrice,
      quantity,
      selectedOptions: chosenOptionsList,
      size: chosenOptionsList.find((o) => o.groupName.toLowerCase().includes('size') || o.groupName.toLowerCase().includes('portion'))?.optionName,
      crust: chosenOptionsList.find((o) => o.groupName.toLowerCase().includes('crust') || o.groupName.toLowerCase().includes('piece'))?.optionName,
      instructions: instructions.trim() || undefined,
    };

    onAddToCart(cartItem);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-card, 16px)',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with image */}
        <div style={{ position: 'relative', height: '180px', backgroundColor: '#F1F5F9' }}>
          <img
            src={product.image}
            alt={product.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: '#FFFFFF',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable options body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 6px', color: 'var(--color-text, #0F172A)' }}>
            {product.name}
          </h2>
          <p style={{ color: '#64748B', fontSize: '0.9rem', margin: '0 0 16px', lineHeight: 1.4 }}>
            {product.description || 'Customizable item freshly prepared to order.'}
          </p>

          <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--color-primary, #E32726)', marginBottom: '18px' }}>
            Base Price: Rs. {basePrice}
          </div>

          {/* Generic Option Groups (PRD Section 15) */}
          {product.optionGroups && product.optionGroups.length > 0 ? (
            product.optionGroups.map((group) => {
              const selected = selectedOptionIds[group.id] || [];
              const isSingle = group.maxSelect === 1;

              return (
                <div key={group.id} style={{ marginBottom: '20px', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1E293B' }}>
                      {group.name} {group.isRequired && <span style={{ color: '#DC2626' }}>*</span>}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#64748B', background: '#F1F5F9', padding: '2px 8px', borderRadius: '4px' }}>
                      {isSingle ? 'Choose 1' : `Up to ${group.maxSelect}`}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
                    {group.options.map((opt) => {
                      const isChecked = selected.includes(opt.id);
                      return (
                        <div
                          key={opt.id}
                          onClick={() => handleToggleOption(group, opt)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: isChecked ? '2px solid var(--color-primary, #E32726)' : '1px solid #E2E8F0',
                            backgroundColor: isChecked ? 'rgba(227,39,38,0.05)' : '#FFFFFF',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div
                              style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: isSingle ? '50%' : '4px',
                                border: isChecked ? '5px solid var(--color-primary, #E32726)' : '2px solid #CBD5E1',
                                background: '#FFFFFF',
                              }}
                            />
                            <span style={{ fontSize: '0.9rem', fontWeight: isChecked ? 600 : 400, color: '#334155' }}>
                              {opt.name}
                            </span>
                          </div>

                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: opt.priceModifier > 0 ? 'var(--color-primary, #E32726)' : '#64748B' }}>
                            {opt.priceModifier > 0 ? `+Rs. ${opt.priceModifier}` : 'Free'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ color: '#94A3B8', fontSize: '0.85rem', fontStyle: 'italic', marginBottom: '16px' }}>
              Standard item (no additional options required).
            </div>
          )}

          {/* Special Instructions */}
          <div style={{ marginTop: '16px', borderTop: '1px solid #F1F5F9', paddingTop: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
              Special Cooking Instructions (Optional)
            </label>
            <input
              type="text"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Less spicy, extra cutlery, well done"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.9rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Footer with quantity & authoritative total */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          {/* Quantity Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '4px' }}>
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#F1F5F9', fontWeight: 800, fontSize: '16px' }}
            >
              -
            </button>
            <span style={{ fontWeight: 700, minWidth: '24px', textAlign: 'center' }}>{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#F1F5F9', fontWeight: 800, fontSize: '16px' }}
            >
              +
            </button>
          </div>

          {/* Add to Cart Button */}
          <button
            onClick={handleConfirm}
            style={{
              flex: 1,
              padding: '13px 20px',
              backgroundColor: 'var(--color-primary, #E32726)',
              color: '#FFFFFF',
              borderRadius: 'var(--radius-btn, 8px)',
              fontWeight: 800,
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(227,39,38,0.25)',
            }}
          >
            <span>Add to Cart</span>
            <span>Rs. {totalPrice}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
