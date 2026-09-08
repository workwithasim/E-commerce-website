import React, { useState, useEffect, useMemo } from 'react';
import { api, socket } from './api';
import { Product, Category, Branch, CartItem, Order } from './types';
import { AdminDashboard } from './admin/AdminDashboard';

export const App: React.FC = () => {
  // Navigation Routing: 'menu' | 'deals' | 'branches' | 'track' | 'account' | 'admin'
  const [currentPage, setCurrentPage] = useState<'menu' | 'deals' | 'branches' | 'track' | 'account' | 'admin'>('menu');

  // Master Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  // User & Location State
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(() => {
    const saved = localStorage.getItem('cheezious_branch');
    return saved ? JSON.parse(saved) : null;
  });
  const [selectedCity, setSelectedCity] = useState<string>('Islamabad');
  const [orderMode, setOrderMode] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('Islamabad');
  const [isLocationModalOpen, setIsLocationModalOpen] = useState<boolean>(false);

  // Authenticated User State
  const [user, setUser] = useState<{ name: string; phone: string } | null>(() => {
    const saved = localStorage.getItem('cheezious_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [loginPhone, setLoginPhone] = useState<string>('');
  const [loginName, setLoginName] = useState<string>('');
  const [otpStep, setOtpStep] = useState<boolean>(false);
  const [otpCode, setOtpCode] = useState<string>('');

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [branchSearch, setBranchSearch] = useState<string>('');

  // Cart State (Persisted in localStorage)
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('cheezious_fullstack_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [voucherCode, setVoucherCode] = useState<string>('');
  const [voucherDiscount, setVoucherDiscount] = useState<number>(0);
  const [voucherMessage, setVoucherMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Modals & Active Order
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [trackSearchQuery, setTrackSearchQuery] = useState<string>('');
  const [userOrders, setUserOrders] = useState<Order[]>([]);

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

  // Synchronize localStorage
  useEffect(() => {
    localStorage.setItem('cheezious_fullstack_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (selectedBranch) {
      localStorage.setItem('cheezious_branch', JSON.stringify(selectedBranch));
    }
  }, [selectedBranch]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('cheezious_user', JSON.stringify(user));
      setCustName(user.name);
      setCustPhone(user.phone);
    }
  }, [user]);

  // Initial Data Load & WebSockets Setup
  useEffect(() => {
    loadInitialData();

    // If user has not selected location yet, open welcome location modal automatically!
    const savedBranch = localStorage.getItem('cheezious_branch');
    if (!savedBranch) {
      setIsLocationModalOpen(true);
    }

    // Socket.io listeners
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

    socket.on('order:status_updated', (updatedOrder: Order) => {
      if (activeOrder && (activeOrder.id === updatedOrder.id || activeOrder.orderNumber === updatedOrder.orderNumber)) {
        setActiveOrder(updatedOrder);
        showToast(`🔔 Order Update: Status is now "${updatedOrder.status}"!`);
      }
      setUserOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
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

      if (!selectedBranch && branchList.length) {
        const defaultBranch = branchList.find((b) => b.city === 'Islamabad') || branchList[0];
        setSelectedBranch(defaultBranch);
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };

  // Load orders for track / account
  const loadUserOrders = async () => {
    try {
      const allOrders = await api.getOrders();
      setUserOrders(allOrders);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (currentPage === 'track' || currentPage === 'account') {
      loadUserOrders();
    }
  }, [currentPage]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    let result = products;
    if (currentPage === 'deals') {
      result = result.filter((p) => p.isDeal || p.name.toLowerCase().includes('deal'));
    } else if (activeCategory !== 'all') {
      result = result.filter((p) => p.categoryId === activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) => p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q))
      );
    }
    return result;
  }, [products, activeCategory, searchQuery, currentPage]);

  // Cart Calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [cart]);

  const deliveryFee = orderMode === 'PICKUP' ? 0 : cartSubtotal > 2000 ? 0 : 100;
  const grandTotal = Math.max(0, cartSubtotal + deliveryFee - voucherDiscount);

  // Customizer Handler
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
        deliveryAddress: custAddress || 'Takeaway Pickup',
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

      // Join real-time WebSocket room
      socket.emit('join:order', createdOrder.id);
      socket.emit('join:order', createdOrder.orderNumber);

      // Reset cart & modal
      setCart([]);
      setVoucherDiscount(0);
      setVoucherMessage(null);
      setIsCheckoutOpen(false);
      showToast(`🎉 Order #${createdOrder.orderNumber} placed successfully!`);
    } catch (err) {
      alert('Failed to place order. Please try again.');
    }
  };

  // Login with Phone OTP
  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginPhone || loginPhone.length < 10) {
      alert('Please enter a valid Pakistani mobile number (e.g. 0300-1234567)');
      return;
    }
    setOtpStep(true);
    showToast(`SMS OTP sent to ${loginPhone}! (Use code 1234 for demo)`);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode !== '1234' && otpCode.length < 4) {
      alert('Please enter valid 4-digit code (Use 1234)');
      return;
    }
    const loggedUser = {
      name: loginName || 'Cheezious Customer',
      phone: loginPhone,
    };
    setUser(loggedUser);
    setIsLoginModalOpen(false);
    setOtpStep(false);
    setOtpCode('');
    showToast(`Welcome back, ${loggedUser.name}!`);
  };

  // Switch to Admin
  if (currentPage === 'admin') {
    return <AdminDashboard onBackToStore={() => setCurrentPage('menu')} />;
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
          <div className="brand-logo-wrap" onClick={() => setCurrentPage('menu')} style={{ cursor: 'pointer' }}>
            <img className="brand-logo" src="/assets/cheezious.svg" alt="Cheezious Logo" />
          </div>

          {/* Location / Order Type Pill */}
          <button className="location-btn" onClick={() => setIsLocationModalOpen(true)}>
            <span className="location-icon">{orderMode === 'DELIVERY' ? '🛵' : '🛍️'}</span>
            <span className="location-text">
              {orderMode === 'DELIVERY' ? `Delivery: ${deliveryAddress}` : `Pickup: ${selectedBranch?.name || 'Islamabad'}`}
            </span>
            <span className="location-arrow">▼</span>
          </button>

          {/* Navigation Links */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setCurrentPage('menu')}
              style={{
                padding: '8px 14px',
                borderRadius: '9999px',
                fontWeight: 700,
                fontSize: '0.88rem',
                color: currentPage === 'menu' ? '#F15B25' : '#4E5D78',
                background: currentPage === 'menu' ? '#FFF2ED' : 'transparent',
              }}
            >
              🍕 Menu
            </button>

            <button
              onClick={() => setCurrentPage('deals')}
              style={{
                padding: '8px 14px',
                borderRadius: '9999px',
                fontWeight: 700,
                fontSize: '0.88rem',
                color: currentPage === 'deals' ? '#F15B25' : '#4E5D78',
                background: currentPage === 'deals' ? '#FFF2ED' : 'transparent',
              }}
            >
              🔥 Deals & Offers
            </button>

            <button
              onClick={() => setCurrentPage('branches')}
              style={{
                padding: '8px 14px',
                borderRadius: '9999px',
                fontWeight: 700,
                fontSize: '0.88rem',
                color: currentPage === 'branches' ? '#F15B25' : '#4E5D78',
                background: currentPage === 'branches' ? '#FFF2ED' : 'transparent',
              }}
            >
              🏢 Branches ({branches.length})
            </button>

            <button
              onClick={() => setCurrentPage('track')}
              style={{
                padding: '8px 14px',
                borderRadius: '9999px',
                fontWeight: 700,
                fontSize: '0.88rem',
                color: currentPage === 'track' ? '#F15B25' : '#4E5D78',
                background: currentPage === 'track' ? '#FFF2ED' : 'transparent',
              }}
            >
              📦 Track My Order
            </button>
          </nav>

          {/* Search Box */}
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search pizza, burger, deals..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (currentPage !== 'menu') setCurrentPage('menu');
              }}
            />
          </div>

          {/* Right Header Actions */}
          <div className="header-actions">
            {/* User Account / Login Button */}
            {user ? (
              <button
                onClick={() => setCurrentPage('account')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '9999px',
                  border: '1px solid #E5E7EB',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#18191F',
                  background: '#F3F4F6',
                }}
              >
                <span>👤 {user.name.split(' ')[0]}</span>
              </button>
            ) : (
              <button
                onClick={() => setIsLoginModalOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '9999px',
                  border: '1px solid #E5E7EB',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#18191F',
                }}
              >
                <span>👤 Sign In</span>
              </button>
            )}

            {/* Admin Portal Switcher */}
            <button
              onClick={() => setCurrentPage('admin')}
              style={{
                background: '#0F172A',
                color: '#38BDF8',
                border: '1px solid #38BDF8',
                padding: '8px 16px',
                borderRadius: '9999px',
                fontWeight: 700,
                fontSize: '0.82rem',
              }}
            >
              ⚡ Kitchen Feed
            </button>

            {/* Cart Trigger */}
            <button className="cart-trigger-btn" onClick={() => setIsCartOpen(true)}>
              <span>🛒</span>
              <span className="cart-badge">{cart.reduce((s, i) => s + i.quantity, 0)}</span>
              <span className="cart-price-divider">|</span>
              <span>Rs. {cartSubtotal.toLocaleString('en-PK')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* VIEW 1: MENU & HOME */}
      {(currentPage === 'menu' || currentPage === 'deals') && (
        <>
          {/* Hero Banner Carousel */}
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

          {/* Products Grid */}
          <main className="container menu-container" style={{ minHeight: '500px', marginTop: '24px' }}>
            <div className="section-header">
              <div className="section-title-wrap">
                <h2 className="section-title">
                  {currentPage === 'deals'
                    ? 'Cheezious Special Deals & Offers'
                    : activeCategory === 'all'
                    ? 'Featured Cheezious Menu'
                    : categories.find((c) => c.id === activeCategory)?.name || 'Menu'}
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
                    {p.isDeal && <span className="card-badge">Special Deal</span>}
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
        </>
      )}

      {/* VIEW 2: BRANCHES LOCATOR (/branches) */}
      {currentPage === 'branches' && (
        <div className="container" style={{ padding: '40px 24px', minHeight: '600px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#18191F' }}>Cheezious Nationwide Outlets</h1>
            <p style={{ color: '#4E5D78', marginTop: '8px' }}>Find your nearest Cheezious outlet across 13 cities in Pakistan</p>
            
            <div style={{ maxWidth: '400px', margin: '20px auto 0', position: 'relative' }}>
              <input
                type="text"
                className="search-input"
                placeholder="Search branch name or address..."
                value={branchSearch}
                onChange={(e) => setBranchSearch(e.target.value)}
                style={{ width: '100%', padding: '12px 18px', borderRadius: '9999px' }}
              />
            </div>
          </div>

          {/* City Tabs */}
          <div className="city-pills-bar" style={{ justifyContent: 'center', marginBottom: '30px' }}>
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

          {/* Branches Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {branches
              .filter((b) => b.city === selectedCity)
              .filter((b) => !branchSearch || b.name.toLowerCase().includes(branchSearch.toLowerCase()) || b.address.toLowerCase().includes(branchSearch.toLowerCase()))
              .map((b) => (
                <div key={b.id} className="branch-item-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#18191F' }}>{b.name}</h3>
                    <p style={{ fontSize: '0.85rem', color: '#4E5D78', marginTop: '4px' }}>📍 {b.address}</p>
                    <p style={{ fontSize: '0.8rem', color: '#8C96A6', marginTop: '6px' }}>🕒 {b.timing} • 📞 {b.phone}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                    <button
                      className="add-card-btn"
                      style={{ flex: 1, background: selectedBranch?.id === b.id ? '#10B981' : '#F15B25', color: '#fff', justifyContent: 'center' }}
                      onClick={() => {
                        setSelectedBranch(b);
                        showToast(`Selected branch: ${b.name}`);
                      }}
                    >
                      {selectedBranch?.id === b.id ? '✓ Current Branch' : 'Select Branch'}
                    </button>
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(b.name + ' ' + b.address)}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ padding: '8px 14px', borderRadius: '9999px', border: '1px solid #CBD5E1', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center' }}
                    >
                      Maps ➔
                    </a>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* VIEW 3: TRACK MY ORDER (/track-my-order) */}
      {currentPage === 'track' && (
        <div className="container" style={{ padding: '40px 24px', minHeight: '600px', maxWidth: '780px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 800 }}>Live Order Tracking</h1>
            <p style={{ color: '#4E5D78', marginTop: '8px' }}>Real-time updates directly from the Cheezious kitchen & rider GPS</p>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <input
                type="text"
                placeholder="Enter Order ID (e.g. #CHZ-XXXXXX) or Phone Number"
                value={trackSearchQuery}
                onChange={(e) => setTrackSearchQuery(e.target.value)}
                style={{ flex: 1, padding: '12px 18px', borderRadius: '12px' }}
              />
              <button
                className="add-order-btn"
                style={{ padding: '0 24px' }}
                onClick={() => {
                  const found = userOrders.find(
                    (o) => o.orderNumber.toLowerCase().includes(trackSearchQuery.toLowerCase()) || o.customerPhone.includes(trackSearchQuery)
                  );
                  if (found) {
                    setActiveOrder(found);
                    socket.emit('join:order', found.id);
                  } else {
                    alert('No active order found with this Order ID or Phone number.');
                  }
                }}
              >
                Track Now
              </button>
            </div>
          </div>

          {/* Active Order Card */}
          {activeOrder ? (
            <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', border: '1px solid #E5E7EB', boxShadow: '0 10px 30px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #F3F4F6', paddingBottom: '16px', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#F15B25' }}>{activeOrder.orderNumber}</h3>
                  <p style={{ fontSize: '0.85rem', color: '#4E5D78' }}>Placed by {activeOrder.customerName} • {activeOrder.customerPhone}</p>
                </div>
                <span style={{ background: '#FFF2ED', color: '#F15B25', fontWeight: 800, padding: '6px 14px', borderRadius: '9999px', fontSize: '0.85rem' }}>
                  {activeOrder.status}
                </span>
              </div>

              {/* Real-time Stepper */}
              <div className="order-tracker-stepper">
                <div className={`tracker-step ${['PENDING', 'PREPARING', 'ON_THE_WAY', 'DELIVERED'].includes(activeOrder.status) ? 'completed' : ''}`}>
                  <div className="step-circle">✓</div>
                  <div className="step-info">
                    <h5>Order Placed</h5>
                    <p>Verified and sent to kitchen</p>
                  </div>
                </div>

                <div className={`tracker-step ${['PREPARING', 'ON_THE_WAY', 'DELIVERED'].includes(activeOrder.status) ? (activeOrder.status === 'PREPARING' ? 'active' : 'completed') : ''}`}>
                  <div className="step-circle">👨‍🍳</div>
                  <div className="step-info">
                    <h5>Kitchen Preparing</h5>
                    <p>Baking hot in oven with melted mozzarella</p>
                  </div>
                </div>

                <div className={`tracker-step ${['ON_THE_WAY', 'DELIVERED'].includes(activeOrder.status) ? (activeOrder.status === 'ON_THE_WAY' ? 'active' : 'completed') : ''}`}>
                  <div className="step-circle">🛵</div>
                  <div className="step-info">
                    <h5>Rider Dispatched</h5>
                    <p>Hot in insulated thermal bag heading to you</p>
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

              <div style={{ marginTop: '20px', background: '#F8F9FA', padding: '16px', borderRadius: '12px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '8px' }}>Order Summary</h4>
                {activeOrder.items.map((it, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                    <span>{it.quantity}x {it.productName}</span>
                    <span style={{ fontWeight: 600 }}>Rs. {(it.unitPrice * it.quantity).toLocaleString('en-PK')}</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #E5E7EB', marginTop: '10px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                  <span>Total Payable:</span>
                  <span style={{ color: '#F15B25' }}>Rs. {activeOrder.total.toLocaleString('en-PK')} ({activeOrder.paymentMethod})</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: '16px', padding: '40px', textAlign: 'center', border: '1px solid #E5E7EB' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📦</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>No Active Tracked Order Selected</h3>
              <p style={{ color: '#4E5D78', marginTop: '6px' }}>Place an order or enter your Order ID above to see live progress.</p>
            </div>
          )}
        </div>
      )}

      {/* VIEW 4: CUSTOMER ACCOUNT & ORDER HISTORY (/account) */}
      {currentPage === 'account' && (
        <div className="container" style={{ padding: '40px 24px', minHeight: '600px', maxWidth: '800px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', border: '1px solid #E5E7EB', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{user ? user.name : 'Guest Customer'}</h2>
              <p style={{ color: '#4E5D78' }}>📱 {user ? user.phone : 'Not logged in'}</p>
            </div>
            {user ? (
              <button
                onClick={() => {
                  setUser(null);
                  localStorage.removeItem('cheezious_user');
                  showToast('Logged out');
                }}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
              >
                Sign Out
              </button>
            ) : (
              <button className="add-order-btn" onClick={() => setIsLoginModalOpen(true)}>
                Sign In with Mobile
              </button>
            )}
          </div>

          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '16px' }}>Recent Order History</h3>
          {userOrders.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: '16px', padding: '40px', textAlign: 'center', border: '1px solid #E5E7EB' }}>
              <p style={{ color: '#8C96A6' }}>No orders found yet. Start ordering to build your history!</p>
              <button className="add-order-btn" style={{ marginTop: '14px' }} onClick={() => setCurrentPage('menu')}>
                Browse Menu
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {userOrders.map((ord) => (
                <div key={ord.id} style={{ background: '#fff', borderRadius: '14px', padding: '18px', border: '1px solid #E5E7EB' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 800, color: '#F15B25' }}>{ord.orderNumber}</span>
                    <span style={{ fontSize: '0.78rem', background: '#F3F4F6', padding: '4px 10px', borderRadius: '9999px', fontWeight: 700 }}>
                      {ord.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#4E5D78', marginBottom: '8px' }}>
                    {ord.items.map((it) => `${it.quantity}x ${it.productName}`).join(', ')}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F3F4F6', paddingTop: '8px' }}>
                    <span style={{ fontWeight: 700 }}>Rs. {ord.total.toLocaleString('en-PK')}</span>
                    <button
                      style={{ color: '#F15B25', fontWeight: 700, fontSize: '0.85rem' }}
                      onClick={() => {
                        setActiveOrder(ord);
                        setCurrentPage('track');
                      }}
                    >
                      Track Live ➔
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: FIRST-VISIT / ORDER TYPE SELECTOR */}
      {isLocationModalOpen && (
        <div className="modal-overlay open" onClick={() => setIsLocationModalOpen(false)}>
          <div className="location-modal" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
            <div className="checkout-modal-header">
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Welcome to Cheezious</h3>
              <button className="modal-close-btn" style={{ position: 'static' }} onClick={() => setIsLocationModalOpen(false)}>✕</button>
            </div>

            <div style={{ padding: '24px' }}>
              <p style={{ color: '#4E5D78', fontSize: '0.9rem', marginBottom: '18px' }}>Please select your order mode to see the live menu & deals in your area:</p>
              
              {/* Order Mode Switcher */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div
                  onClick={() => setOrderMode('DELIVERY')}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: orderMode === 'DELIVERY' ? '2px solid #F15B25' : '1px solid #E5E7EB',
                    background: orderMode === 'DELIVERY' ? '#FFF2ED' : '#fff',
                    textAlign: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: '2rem' }}>🛵</div>
                  <div style={{ fontWeight: 800, marginTop: '4px', color: orderMode === 'DELIVERY' ? '#F15B25' : '#18191F' }}>Delivery</div>
                  <div style={{ fontSize: '0.75rem', color: '#8C96A6' }}>Doorstep delivery in 35-45 mins</div>
                </div>

                <div
                  onClick={() => setOrderMode('PICKUP')}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: orderMode === 'PICKUP' ? '2px solid #F15B25' : '1px solid #E5E7EB',
                    background: orderMode === 'PICKUP' ? '#FFF2ED' : '#fff',
                    textAlign: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: '2rem' }}>🛍️</div>
                  <div style={{ fontWeight: 800, marginTop: '4px', color: orderMode === 'PICKUP' ? '#F15B25' : '#18191F' }}>Takeaway</div>
                  <div style={{ fontSize: '0.75rem', color: '#8C96A6' }}>Pick up hot from restaurant</div>
                </div>
              </div>

              {/* City Selection */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4E5D78' }}>Select City</label>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', marginTop: '4px' }}
                >
                  {Array.from(new Set(branches.map((b) => b.city))).sort().map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              {orderMode === 'DELIVERY' ? (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4E5D78' }}>Delivery Address / Sector</label>
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="e.g. Sector F-7/2, Street 4, Islamabad"
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', marginTop: '4px' }}
                  />
                </div>
              ) : (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4E5D78' }}>Select Pickup Branch</label>
                  <select
                    value={selectedBranch?.id || ''}
                    onChange={(e) => {
                      const found = branches.find((b) => b.id === e.target.value);
                      if (found) setSelectedBranch(found);
                    }}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', marginTop: '4px' }}
                  >
                    {branches.filter((b) => b.city === selectedCity).map((b) => (
                      <option key={b.id} value={b.id}>{b.name} - {b.address}</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                className="add-order-btn"
                style={{ width: '100%', padding: '14px' }}
                onClick={() => {
                  setIsLocationModalOpen(false);
                  showToast(`Location set: ${orderMode} in ${selectedCity}`);
                }}
              >
                Start Ordering ➔
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PHONE OTP AUTHENTICATION */}
      {isLoginModalOpen && (
        <div className="modal-overlay open" onClick={() => setIsLoginModalOpen(false)}>
          <div className="checkout-modal" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="checkout-modal-header">
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Sign In to Cheezious</h3>
              <button className="modal-close-btn" style={{ position: 'static' }} onClick={() => setIsLoginModalOpen(false)}>✕</button>
            </div>

            <div className="checkout-modal-body">
              {!otpStep ? (
                <form onSubmit={handleSendOtp}>
                  <p style={{ color: '#4E5D78', fontSize: '0.88rem', marginBottom: '16px' }}>
                    Enter your Pakistani mobile number to receive a verification code.
                  </p>
                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label>Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Asim Khalid"
                      value={loginName}
                      onChange={(e) => setLoginName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '20px' }}>
                    <label>Mobile Number (Pakistan)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ padding: '10px 14px', background: '#F3F4F6', borderRadius: '8px', fontWeight: 700 }}>🇵🇰 +92</span>
                      <input
                        type="tel"
                        placeholder="300-1234567"
                        value={loginPhone}
                        onChange={(e) => setLoginPhone(e.target.value)}
                        style={{ flex: 1 }}
                        required
                      />
                    </div>
                  </div>
                  <button type="submit" className="checkout-action-btn">
                    Send Verification Code ➔
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp}>
                  <p style={{ color: '#4E5D78', fontSize: '0.88rem', marginBottom: '16px' }}>
                    We sent a 4-digit code to <strong>+92 {loginPhone}</strong>. (Use <strong>1234</strong>)
                  </p>
                  <div className="form-group" style={{ marginBottom: '20px' }}>
                    <label>Enter 4-Digit Code</label>
                    <input
                      type="text"
                      placeholder="1234"
                      maxLength={4}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      style={{ textAlign: 'center', fontSize: '1.4rem', letterSpacing: '8px', fontWeight: 800 }}
                      required
                    />
                  </div>
                  <button type="submit" className="checkout-action-btn">
                    Verify & Continue ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => setOtpStep(false)}
                    style={{ width: '100%', textAlign: 'center', marginTop: '12px', fontSize: '0.82rem', color: '#4E5D78' }}
                  >
                    Change phone number
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PRODUCT CUSTOMIZATION */}
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

      {/* MODAL: CART DRAWER */}
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
              {orderMode === 'DELIVERY' ? `🛵 Delivery to ${deliveryAddress}` : `🛍️ Pick up at ${selectedBranch?.name || 'Islamabad'}`}
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

      {/* MODAL: CHECKOUT */}
      {isCheckoutOpen && (
        <div className="modal-overlay open" onClick={() => setIsCheckoutOpen(false)}>
          <div className="checkout-modal" onClick={(e) => e.stopPropagation()}>
            <div className="checkout-modal-header">
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Complete Your Cheezious Order</h3>
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
                <li><a href="#" onClick={() => setCurrentPage('menu')}>Menu</a></li>
                <li><a href="#" onClick={() => setCurrentPage('deals')}>Special Offers</a></li>
                <li><a href="#" onClick={() => setCurrentPage('branches')}>61 Nationwide Branches</a></li>
                <li><a href="#" onClick={() => setCurrentPage('track')}>Track My Order</a></li>
                <li><a href="#" onClick={() => setCurrentPage('admin')}>Kitchen / Admin Dashboard</a></li>
              </ul>
            </div>
            <div className="footer-column">
              <h4>Support & Customer Care</h4>
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
