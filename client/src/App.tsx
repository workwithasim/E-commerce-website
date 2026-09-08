import React, { useState, useEffect, useMemo } from 'react';
import { api, socket } from './api';
import { Product, Category, Branch, CartItem, Order } from './types';
import { AdminDashboard } from './admin/AdminDashboard';

export const App: React.FC = () => {
  // Navigation State (Store vs Admin)
  const [viewMode, setViewMode] = useState<'store' | 'admin'>('store');

  // Application State
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [selectedCity, setSelectedCity] = useState<string>('Islamabad');
  const [orderMode, setOrderMode] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Cart State (Persisted in localStorage)
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('cheezious_fullstack_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [voucherCode, setVoucherCode] = useState<string>('');
  const [voucherDiscount, setVoucherDiscount] = useState<number>(0);
  const [voucherMessage, setVoucherMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Modals State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState<boolean>(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  // Product Customizer State
  const [customSize, setCustomSize] = useState<string>('Regular');
  const [customCrust, setCustomCrust] = useState<string>('Pan Crust');
  const [customFlavor, setCustomFlavor] = useState<string>('Chicken Tikka');
  const [customDrink, setCustomDrink] = useState<string>('Pepsi (345ml)');
  const [customAddons, setCustomAddons] = useState<{ name: string; extra: number }[]>([]);
  const [customNotes, setCustomNotes] = useState<string>('');
  const [customQty, setCustomQty] = useState<number>(1);

  // Checkout Form State
  const [custName, setCustName] = useState<string>('');
  const [custPhone, setCustPhone] = useState<string>('');
  const [custAddress, setCustAddress] = useState<string>('');
  const [custLandmark, setCustLandmark] = useState<string>('');
  const [custNotes, setCustNotes] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('COD');

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('cheezious_fullstack_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    loadInitialData();

    // Listen for live product updates from admin
    socket.on('product:added', (newProd: Product) => {
      setProducts((prev) => [newProd, ...prev]);
      showToast(`✨ New product added to menu: "${newProd.name}"`);
    });

    socket.on('product:updated', (updated: Product) => {
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    });

    socket.on('product:deleted', (id: string) => {
      setProducts((prev) => prev.filter((p) => p.id !== id));
    });

    // Listen for live order updates
    socket.on('order:status_updated', (updatedOrder: Order) => {
      if (activeOrder && activeOrder.id === updatedOrder.id) {
        setActiveOrder(updatedOrder);
        showToast(`🔔 Order Update: Status is now "${updatedOrder.status}"!`);
      }
    });

    return () => {
      socket.off('product:added');
      socket.off('product:updated');
      socket.off('product:deleted');
      socket.off('order:status_updated');
    };
  }, [activeOrder]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadInitialData = async () => {
    try {
      const [cats, prods, branchList] = await Promise.all([
        api.getCategories(),
        api.getProducts(),
        api.getBranches(),
      ]);
      setCategories(cats);
      setProducts(prods);
      setBranches(branchList);

      const defaultBranch = branchList.find((b) => b.city === 'Islamabad') || branchList[0];
      if (defaultBranch) setSelectedBranch(defaultBranch);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    let result = products;
    if (activeCategory !== 'all') {
      result = result.filter((p) => p.categoryId === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) => p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q))
      );
    }
    return result;
  }, [products, activeCategory, searchQuery]);

  // Cart Calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [cart]);

  const deliveryFee = orderMode === 'PICKUP' ? 0 : cartSubtotal > 2000 ? 0 : 100;
  const grandTotal = Math.max(0, cartSubtotal + deliveryFee - voucherDiscount);

  // Open Customizer Modal
  const handleOpenProduct = (product: Product) => {
    setSelectedProduct(product);
    setCustomSize('Regular');
    setCustomCrust('Pan Crust');
    setCustomFlavor('Chicken Tikka');
    setCustomDrink('Pepsi (345ml)');
    setCustomAddons([]);
    setCustomNotes('');
    setCustomQty(1);
  };

  // Add Customized Item to Cart
  const handleAddToCart = () => {
    if (!selectedProduct) return;

    let calculatedUnitPrice = selectedProduct.price;
    if (customSize === 'Large') calculatedUnitPrice += 450;
    if (customSize === 'Jumbo') calculatedUnitPrice += 850;
    if (customCrust === 'Cheesy Stuffed Crust') calculatedUnitPrice += 250;
    if (customCrust === 'Crown Crust Special') calculatedUnitPrice += 300;

    customAddons.forEach((a) => {
      calculatedUnitPrice += a.extra;
    });

    const newItem: CartItem = {
      cartItemId: Date.now().toString(),
      productId: selectedProduct.id,
      name: selectedProduct.name,
      image: selectedProduct.image,
      unitPrice: calculatedUnitPrice,
      quantity: customQty,
      size: customSize,
      crust: customCrust,
      flavor: customFlavor,
      drink: customDrink,
      addons: customAddons,
      instructions: customNotes,
    };

    setCart((prev) => [...prev, newItem]);
    setSelectedProduct(null);
    setIsCartOpen(true);
    showToast(`Added "${newItem.name}" to cart!`);
  };

  // Voucher verification
  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) return;
    try {
      const res = await api.verifyVoucher(voucherCode.trim(), cartSubtotal);
      if (res.valid) {
        setVoucherDiscount(res.discountAmount);
        setVoucherMessage({ text: res.message, isError: false });
      } else {
        setVoucherDiscount(0);
        setVoucherMessage({ text: res.message, isError: true });
      }
    } catch (err: any) {
      setVoucherDiscount(0);
      setVoucherMessage({ text: 'Invalid promo code. Try "CHEEZY10"!', isError: true });
    }
  };

  // Place Order
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName || !custPhone || (!custAddress && orderMode === 'DELIVERY')) {
      alert('Please fill in all required fields.');
      return;
    }

    try {
      const orderPayload = {
        customerName: custName,
        customerPhone: custPhone,
        deliveryAddress: custAddress,
        landmark: custLandmark,
        notes: custNotes,
        orderMode,
        branchId: selectedBranch?.id,
        paymentMethod,
        items: cart,
        subtotal: cartSubtotal,
        deliveryFee,
        discount: voucherDiscount,
        total: grandTotal,
      };

      const createdOrder = await api.createOrder(orderPayload);
      setActiveOrder(createdOrder);

      // Join WebSocket room for real-time tracking
      socket.emit('join:order', createdOrder.id);
      socket.emit('join:order', createdOrder.orderNumber);

      // Reset cart & forms
      setCart([]);
      setVoucherDiscount(0);
      setVoucherMessage(null);
      setIsCheckoutOpen(false);
      showToast(`🎉 Order #${createdOrder.orderNumber} placed successfully!`);
    } catch (err) {
      alert('Failed to place order. Please try again.');
    }
  };

  if (viewMode === 'admin') {
    return <AdminDashboard onBackToStore={() => setViewMode('store')} />;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>
      
      {/* Toast Alert */}
      {toastMessage && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: '#11141A', color: '#fff', padding: '14px 24px', borderRadius: '9999px', zIndex: 9999, fontWeight: 700, boxShadow: '0 10px 30px rgba(0,0,0,0.3)', borderLeft: '4px solid #F15B25' }}>
          {toastMessage}
        </div>
      )}

      {/* Top Announcement Bar */}
      <aside className="top-announcement">
        <span className="badge">Special Offer</span>
        <span>🔥 Use promo code <strong>CHEEZY10</strong> for 10% OFF | Free Delivery on orders over Rs. 2,000!</span>
      </aside>

      {/* Main Header */}
      <header className="header">
        <div className="container header-inner">
          <div className="brand-logo-wrap">
            <img className="brand-logo" src="/assets/cheezious.svg" alt="Cheezious Logo" />
          </div>

          {/* Mode Switcher */}
          <div className="order-mode-toggle">
            <button
              className={`mode-btn ${orderMode === 'DELIVERY' ? 'active' : ''}`}
              onClick={() => setOrderMode('DELIVERY')}
            >
              🛵 Delivery
            </button>
            <button
              className={`mode-btn ${orderMode === 'PICKUP' ? 'active' : ''}`}
              onClick={() => setOrderMode('PICKUP')}
            >
              🛍️ Takeaway
            </button>
          </div>

          {/* Location Selector */}
          <button className="location-btn" onClick={() => setIsBranchModalOpen(true)}>
            <span className="location-icon">📍</span>
            <span className="location-text">
              {selectedBranch ? `${selectedBranch.city} - ${selectedBranch.name}` : 'Select Branch'}
            </span>
            <span className="location-arrow">▼</span>
          </button>

          {/* Search Box */}
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search pizza, burger, deals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Header Actions */}
          <div className="header-actions">
            {/* Direct Admin Portal Switcher */}
            <button
              onClick={() => setViewMode('admin')}
              style={{
                background: '#0F172A',
                color: '#38BDF8',
                border: '1px solid #38BDF8',
                padding: '9px 18px',
                borderRadius: '9999px',
                fontWeight: 700,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>⚡ Admin / Kitchen Feed</span>
            </button>

            {/* Cart Trigger Button */}
            <button className="cart-trigger-btn" onClick={() => setIsCartOpen(true)}>
              <span>🛒</span>
              <span className="cart-badge">{cart.reduce((s, i) => s + i.quantity, 0)}</span>
              <span className="cart-price-divider">|</span>
              <span>Rs. {cartSubtotal.toLocaleString('en-PK')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="hero-section container">
        <div className="carousel-container">
          <div className="carousel-track">
            <div className="carousel-slide">
              <img
                src="https://s3-ap-southeast-1.amazonaws.com/prod-cheezious-content/banners/website/1787912722952-Web (3040x920).png"
                alt="Cheezious Banner"
                style={{ height: '360px', width: '100%', objectFit: 'cover' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Sticky Category Bar */}
      <nav className="category-nav-wrapper">
        <div className="container">
          <div className="category-nav-inner">
            <button
              className={`cat-pill ${activeCategory === 'all' ? 'active' : ''}`}
              onClick={() => setActiveCategory('all')}
            >
              🔥 All Menu ({products.length})
            </button>

            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`cat-pill ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.image && <img src={cat.image} alt={cat.name} onError={(e: any) => (e.target.style.display = 'none')} />}
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Products Grid */}
      <main className="container menu-container" style={{ minHeight: '500px', marginTop: '24px' }}>
        <div className="section-header">
          <div className="section-title-wrap">
            <h2 className="section-title">
              {activeCategory === 'all' ? 'Featured Cheezious Menu' : categories.find((c) => c.id === activeCategory)?.name || 'Menu'}
            </h2>
            <span className="section-count-badge">{filteredProducts.length} Items</span>
          </div>
        </div>

        <div className="products-grid">
          {filteredProducts.map((p) => (
            <div key={p.id} className="product-card" onClick={() => handleOpenProduct(p)}>
              <div className="card-img-wrap">
                <img className="card-img" src={p.image} alt={p.name} loading="lazy" />
                {p.isBestSeller && <span className="card-badge bestseller">★ Bestseller</span>}
                {p.isDeal && <span className="card-badge">Deal</span>}
              </div>
              <div className="card-content">
                <h3 className="product-name">{p.name}</h3>
                <p className="product-desc">{p.description || 'Prepared fresh with signature Cheezious recipes.'}</p>
                <div className="card-footer">
                  <div className="price-wrap">
                    <span className="price-label">Price</span>
                    <span className="product-price">Rs. {p.price.toLocaleString('en-PK')}</span>
                  </div>
                  <button
                    className="add-card-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenProduct(p);
                    }}
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* MODAL 1: PRODUCT CUSTOMIZATION */}
      {selectedProduct && (
        <div className="modal-overlay open" onClick={() => setSelectedProduct(null)}>
          <div className="product-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-img">
              <img src={selectedProduct.image} alt={selectedProduct.name} />
              <button className="modal-close-btn" onClick={() => setSelectedProduct(null)}>✕</button>
            </div>
            <div className="modal-body">
              <h3 className="modal-product-title">{selectedProduct.name}</h3>
              <p className="modal-product-desc">{selectedProduct.description}</p>
              <div className="modal-base-price">Rs. {selectedProduct.price.toLocaleString('en-PK')}</div>

              {/* Pizza Sizes */}
              <div className="option-group">
                <div className="option-group-title">
                  <span>Select Size</span>
                  <span className="option-required-badge">Required</span>
                </div>
                <div className="option-choices">
                  {[
                    { label: 'Small (6")', extra: 0 },
                    { label: 'Regular (9")', extra: 450 },
                    { label: 'Large (12")', extra: 850 },
                  ].map((s) => (
                    <label key={s.label} className="option-label">
                      <div className="option-left">
                        <input
                          type="radio"
                          name="size"
                          checked={customSize === s.label}
                          onChange={() => setCustomSize(s.label)}
                        />
                        <span>{s.label}</span>
                      </div>
                      <span className="option-extra-price">{s.extra > 0 ? `+Rs. ${s.extra}` : 'Included'}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Crusts */}
              <div className="option-group">
                <div className="option-group-title">
                  <span>Select Crust</span>
                  <span className="option-required-badge">Required</span>
                </div>
                <div className="option-choices">
                  {[
                    { label: 'Pan Crust (Classic Fluffy)', extra: 0 },
                    { label: 'Cheesy Stuffed Crust', extra: 250 },
                    { label: 'Crown Crust Special', extra: 300 },
                  ].map((c) => (
                    <label key={c.label} className="option-label">
                      <div className="option-left">
                        <input
                          type="radio"
                          name="crust"
                          checked={customCrust === c.label}
                          onChange={() => setCustomCrust(c.label)}
                        />
                        <span>{c.label}</span>
                      </div>
                      <span className="option-extra-price">{c.extra > 0 ? `+Rs. ${c.extra}` : 'Included'}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Special Instructions */}
              <div className="option-group special-instructions-wrap">
                <div className="option-group-title">Special Instructions</div>
                <textarea
                  placeholder="Less spicy, extra napkins please..."
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <div className="quantity-stepper">
                <button className="stepper-btn" onClick={() => setCustomQty(Math.max(1, customQty - 1))}>-</button>
                <span className="stepper-value">{customQty}</span>
                <button className="stepper-btn" onClick={() => setCustomQty(customQty + 1)}>+</button>
              </div>
              <button className="add-order-btn" onClick={handleAddToCart}>
                Add to Cart • Rs. {(selectedProduct.price * customQty).toLocaleString('en-PK')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CART DRAWER */}
      {isCartOpen && (
        <div className="cart-drawer-overlay open" onClick={() => setIsCartOpen(false)}>
          <div className="cart-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="cart-drawer-header">
              <div className="cart-drawer-title">
                <span>🛒 Your Order</span>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>({cart.length})</span>
              </div>
              <button className="cart-drawer-close" onClick={() => setIsCartOpen(false)}>✕</button>
            </div>

            <div className="cart-delivery-banner">
              {orderMode === 'DELIVERY' ? '🛵 Delivering from' : '🛍️ Pick up at'}: {selectedBranch?.name || 'Islamabad'}
            </div>

            <div className="cart-items-list">
              {cart.length === 0 ? (
                <div className="empty-cart-view">
                  <div className="empty-cart-icon">🍕</div>
                  <h3>Your Cart is Empty</h3>
                  <p>Explore our menu and add your favorite Cheezious pizzas, burgers, and deals!</p>
                  <button className="add-order-btn" onClick={() => setIsCartOpen(false)}>Start Ordering</button>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.cartItemId} className="cart-item-row">
                    <img className="cart-item-img" src={item.image} alt={item.name} />
                    <div className="cart-item-info">
                      <h4 className="cart-item-name">{item.name}</h4>
                      <p className="cart-item-customizations">{[item.size, item.crust, item.instructions].filter(Boolean).join(' • ')}</p>
                      <div className="cart-item-price">Rs. {(item.unitPrice * item.quantity).toLocaleString('en-PK')}</div>
                      <div className="cart-item-stepper">
                        <button onClick={() => {
                          if (item.quantity <= 1) {
                            setCart((prev) => prev.filter((i) => i.cartItemId !== item.cartItemId));
                          } else {
                            setCart((prev) => prev.map((i) => i.cartItemId === item.cartItemId ? { ...i, quantity: i.quantity - 1 } : i));
                          }
                        }}>-</button>
                        <span>{item.quantity}</span>
                        <button onClick={() => {
                          setCart((prev) => prev.map((i) => i.cartItemId === item.cartItemId ? { ...i, quantity: i.quantity + 1 } : i));
                        }}>+</button>
                      </div>
                    </div>
                    <button className="cart-item-remove" onClick={() => setCart((prev) => prev.filter((i) => i.cartItemId !== item.cartItemId))}>✕</button>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <>
                <div className="voucher-section">
                  <div className="voucher-form">
                    <input
                      type="text"
                      className="voucher-input"
                      placeholder="Promo Code (e.g. CHEEZY10)"
                      value={voucherCode}
                      onChange={(e) => setVoucherCode(e.target.value)}
                    />
                    <button className="voucher-btn" onClick={handleApplyVoucher}>Apply</button>
                  </div>
                  {voucherMessage && (
                    <div className={`voucher-feedback ${voucherMessage.isError ? 'error' : 'success'}`}>
                      {voucherMessage.text}
                    </div>
                  )}
                </div>

                <div className="cart-bill-section">
                  <div className="bill-row">
                    <span>Subtotal</span>
                    <span>Rs. {cartSubtotal.toLocaleString('en-PK')}</span>
                  </div>
                  <div className="bill-row">
                    <span>Delivery Fee</span>
                    <span>{deliveryFee === 0 ? 'FREE' : `Rs. ${deliveryFee}`}</span>
                  </div>
                  {voucherDiscount > 0 && (
                    <div className="bill-row discount-row">
                      <span>Discount</span>
                      <span>-Rs. {voucherDiscount.toLocaleString('en-PK')}</span>
                    </div>
                  )}
                  <div className="bill-row grand-total">
                    <span>Total Payable</span>
                    <span>Rs. {grandTotal.toLocaleString('en-PK')}</span>
                  </div>
                  <button
                    className="checkout-action-btn"
                    onClick={() => {
                      setIsCartOpen(false);
                      setIsCheckoutOpen(true);
                    }}
                  >
                    Proceed to Checkout ➔
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL 3: CHECKOUT */}
      {isCheckoutOpen && (
        <div className="modal-overlay open" onClick={() => setIsCheckoutOpen(false)}>
          <div className="checkout-modal" onClick={(e) => e.stopPropagation()}>
            <div className="checkout-modal-header">
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Complete Your Order</h3>
              <button className="modal-close-btn" style={{ position: 'static' }} onClick={() => setIsCheckoutOpen(false)}>✕</button>
            </div>
            <div className="checkout-modal-body">
              <form onSubmit={handlePlaceOrder}>
                <div className="form-section-title">👤 Contact Information</div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input type="text" required placeholder="Ali Khan" value={custName} onChange={(e) => setCustName(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Phone Number *</label>
                    <input type="tel" required placeholder="0300-1234567" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} />
                  </div>
                </div>

                <div className="form-section-title">📍 Delivery Address</div>
                <div className="form-grid">
                  <div className="form-group full-width">
                    <label>Street Address / House No. *</label>
                    <input type="text" required placeholder="House 12, Street 4, Sector F-7/2" value={custAddress} onChange={(e) => setCustAddress(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Nearest Landmark</label>
                    <input type="text" placeholder="Near Jinnah Super / Park" value={custLandmark} onChange={(e) => setCustLandmark(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Rider Instructions</label>
                    <input type="text" placeholder="Ring bell, do not knock" value={custNotes} onChange={(e) => setCustNotes(e.target.value)} />
                  </div>
                </div>

                <div className="form-section-title">💳 Payment Method</div>
                <div className="payment-methods">
                  {['COD', 'Card', 'JazzCash'].map((m) => (
                    <label key={m} className={`payment-card ${paymentMethod === m ? 'active' : ''}`} onClick={() => setPaymentMethod(m)}>
                      <span className="payment-card-icon">{m === 'COD' ? '💵' : m === 'Card' ? '💳' : '📱'}</span>
                      <span className="payment-card-name">{m === 'COD' ? 'Cash on Delivery' : m === 'Card' ? 'Debit/Credit Card' : 'JazzCash / Easypaisa'}</span>
                    </label>
                  ))}
                </div>

                <button type="submit" className="checkout-action-btn" style={{ marginTop: '24px' }}>
                  Confirm & Place Order (Rs. {grandTotal.toLocaleString('en-PK')}) ✓
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: LIVE ORDER TRACKING (POWERED BY REAL-TIME WEBSOCKETS) */}
      {activeOrder && (
        <div className="modal-overlay open">
          <div className="checkout-modal" style={{ maxWidth: '520px' }}>
            <div className="checkout-modal-body order-success-card">
              <div className="success-check-icon">✓</div>
              <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Order Confirmed!
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
                Thank you, <strong>{activeOrder.customerName}</strong>! Your order is placed.
              </p>

              <div style={{ background: 'var(--surface-alt)', padding: '12px', borderRadius: '8px', margin: '16px 0', fontSize: '0.9rem' }}>
                <div>Order Number: <strong style={{ color: 'var(--primary)' }}>{activeOrder.orderNumber}</strong></div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>
                  Total: <strong>Rs. {activeOrder.total.toLocaleString('en-PK')}</strong> • Status: <strong style={{ color: '#F15B25' }}>{activeOrder.status}</strong>
                </div>
              </div>

              {/* Real-time Stepper */}
              <div className="order-tracker-stepper">
                <div className={`tracker-step ${['PENDING', 'PREPARING', 'ON_THE_WAY', 'DELIVERED'].includes(activeOrder.status) ? 'completed' : ''}`}>
                  <div className="step-circle">✓</div>
                  <div className="step-info">
                    <h5>Order Placed</h5>
                    <p>Received by Cheezious Database</p>
                  </div>
                </div>

                <div className={`tracker-step ${['PREPARING', 'ON_THE_WAY', 'DELIVERED'].includes(activeOrder.status) ? (activeOrder.status === 'PREPARING' ? 'active' : 'completed') : ''}`}>
                  <div className="step-circle">👨‍🍳</div>
                  <div className="step-info">
                    <h5>Kitchen Preparing</h5>
                    <p>Baking hot in oven at restaurant</p>
                  </div>
                </div>

                <div className={`tracker-step ${['ON_THE_WAY', 'DELIVERED'].includes(activeOrder.status) ? (activeOrder.status === 'ON_THE_WAY' ? 'active' : 'completed') : ''}`}>
                  <div className="step-circle">🛵</div>
                  <div className="step-info">
                    <h5>Rider Dispatched</h5>
                    <p>Heading to your address in thermal bag</p>
                  </div>
                </div>

                <div className={`tracker-step ${activeOrder.status === 'DELIVERED' ? 'completed' : ''}`}>
                  <div className="step-circle">🎉</div>
                  <div className="step-info">
                    <h5>Delivered</h5>
                    <p>Enjoy your Cheezy feast!</p>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="add-order-btn"
                  style={{ width: '100%', background: '#334155' }}
                  onClick={() => setActiveOrder(null)}
                >
                  Close Tracker
                </button>
                <button
                  className="add-order-btn"
                  style={{ width: '100%' }}
                  onClick={() => setViewMode('admin')}
                >
                  Open Kitchen Feed (Update Status)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: BRANCH SELECTOR */}
      {isBranchModalOpen && (
        <div className="modal-overlay open" onClick={() => setIsBranchModalOpen(false)}>
          <div className="location-modal" onClick={(e) => e.stopPropagation()}>
            <div className="checkout-modal-header">
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Select Branch ({branches.length} Outlets)</h3>
              <button className="modal-close-btn" style={{ position: 'static' }} onClick={() => setIsBranchModalOpen(false)}>✕</button>
            </div>
            <div className="city-pills-bar">
              {Array.from(new Set(branches.map((b) => b.city))).sort().map((city) => (
                <button
                  key={city}
                  className={`city-pill ${selectedCity === city ? 'active' : ''}`}
                  onClick={() => setSelectedCity(city)}
                >
                  {city}
                </button>
              ))}
            </div>
            <div className="branches-list">
              {branches.filter((b) => b.city === selectedCity).map((b) => (
                <div
                  key={b.id}
                  className="branch-item-card"
                  onClick={() => {
                    setSelectedBranch(b);
                    setIsBranchModalOpen(false);
                    showToast(`Selected branch: ${b.name}`);
                  }}
                >
                  <div>
                    <h4 className="branch-name">{b.name}</h4>
                    <p className="branch-addr">📍 {b.address}</p>
                    <p className="branch-timing">🕒 {b.timing} • 📞 {b.phone}</p>
                  </div>
                  <button className="add-card-btn" style={{ background: 'var(--primary)', color: '#fff' }}>Select</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <img src="/assets/cheezious.svg" alt="Cheezious Logo" style={{ height: '44px', marginBottom: '16px', filter: 'brightness(0) invert(1)' }} />
              <h3>The Cheeziest Food in Town</h3>
              <p>Full-Stack PERN Platform with PostgreSQL, Node.js, Express, React, TypeScript and WebSockets.</p>
            </div>
            <div className="footer-column">
              <h4>Quick Navigation</h4>
              <ul className="footer-links">
                <li><a href="#" onClick={() => setViewMode('admin')}>Kitchen / Admin Dashboard</a></li>
                <li><a href="#" onClick={() => setIsBranchModalOpen(true)}>61 Nationwide Branches</a></li>
              </ul>
            </div>
            <div className="footer-column">
              <h4>Support</h4>
              <p style={{ color: '#A0AEC0', fontSize: '0.9rem' }}>📞 UAN: 051-111-44-66-99</p>
              <p style={{ color: '#A0AEC0', fontSize: '0.9rem' }}>Email: support@cheezious.com</p>
            </div>
          </div>
          <div className="footer-bottom">
            <div>© 2026 Cheezious PERN Edition. 110% Dynamic Full-Stack.</div>
          </div>
        </div>
      </footer>
    </div>
  );
};
