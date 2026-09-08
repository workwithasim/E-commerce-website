import React, { useState, useEffect, useMemo } from 'react';
import { api, socket } from './api';
import { Product, Category, Branch, CartItem, Order } from './types';
import { AuthUser } from './LoginPage';
import { useTenant } from './theme/ThemeProvider';
import { CustomizationModal } from './components/CustomizationModal';
import { AdminDashboard } from './admin/AdminDashboard';

interface AppProps {
  authUser?: AuthUser | null;
  onLogout?: () => void;
  onOpenLogin?: () => void;
}

export const App: React.FC<AppProps> = ({ authUser, onLogout, onOpenLogin }) => {
  const { tenant, branding, settings, currentSlug } = useTenant();
  // Navigation: 'menu' | 'deals' | 'branches' | 'track' | 'account' | 'admin'
  const [currentPage, setCurrentPage] = useState<'menu' | 'deals' | 'branches' | 'track' | 'account' | 'admin'>('menu');

  // Master Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  // Navigation Drawers & Modals
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState<boolean>(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState<boolean>(false);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  // User & Location State
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(() => {
    const saved = localStorage.getItem('cheezious_branch');
    return saved ? JSON.parse(saved) : null;
  });
  const [selectedCity, setSelectedCity] = useState<string>('Islamabad');
  const [orderMode, setOrderMode] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('Enter the Delivery Address');

  // Authenticated User
  const [user, setUser] = useState<{ name: string; phone: string } | null>(() => {
    const saved = localStorage.getItem('cheezious_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loginPhone, setLoginPhone] = useState<string>('');
  const [loginName, setLoginName] = useState<string>('');
  const [otpStep, setOtpStep] = useState<boolean>(false);
  const [otpCode, setOtpCode] = useState<string>('');

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [branchSearch, setBranchSearch] = useState<string>('');
  const [trackSearchQuery, setTrackSearchQuery] = useState<string>('');
  const [userOrders, setUserOrders] = useState<Order[]>([]);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('cheezious_fullstack_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [voucherCode, setVoucherCode] = useState<string>('');
  const [voucherDiscount, setVoucherDiscount] = useState<number>(0);
  const [voucherMessage, setVoucherMessage] = useState<{ text: string; isError: boolean } | null>(null);

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

  // Banner State
  const [activeBannerIdx, setActiveBannerIdx] = useState<number>(0);
  const BANNERS = [
    '/assets/thin_crispy_banner.jpg',
    '/assets/g15_banner.png',
    '/assets/full_house_banner.jpg'
  ];

  useEffect(() => {
    localStorage.setItem('cheezious_fullstack_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (selectedBranch) localStorage.setItem('cheezious_branch', JSON.stringify(selectedBranch));
  }, [selectedBranch]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('cheezious_user', JSON.stringify(user));
      setCustName(user.name);
      setCustPhone(user.phone);
    }
  }, [user]);

  useEffect(() => {
    loadInitialData();

    // Auto rotate banners every 6s
    const timer = setInterval(() => {
      setActiveBannerIdx((prev) => (prev + 1) % BANNERS.length);
    }, 6000);

    socket.on('product:added', (newProd: Product) => {
      setProducts((prev) => [newProd, ...prev]);
      showToast(`✨ New item added to menu: "${newProd.name}"`);
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
      clearInterval(timer);
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
      console.error('Failed to load data:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
    setActiveCategory('all');
  }, [currentSlug]);

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

      socket.emit('join:order', createdOrder.id);
      socket.emit('join:order', createdOrder.orderNumber);

      setCart([]);
      setVoucherDiscount(0);
      setVoucherMessage(null);
      setIsCheckoutOpen(false);
      showToast(`🎉 Order #${createdOrder.orderNumber} placed successfully!`);
    } catch (err) {
      alert('Failed to place order. Please try again.');
    }
  };

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginPhone || loginPhone.length < 10) {
      alert('Please enter a valid Pakistani mobile number (e.g. 0300-1234567)');
      return;
    }
    setOtpStep(true);
    showToast(`SMS code sent to ${loginPhone}! (Demo code: 1234)`);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode !== '1234' && otpCode.length < 4) {
      alert('Please enter valid 4-digit code (Use 1234)');
      return;
    }
    const loggedUser = {
      name: loginName || 'Customer',
      phone: loginPhone,
    };
    setUser(loggedUser);
    setIsLoginModalOpen(false);
    setOtpStep(false);
    setOtpCode('');
    showToast(`Signed in as ${loggedUser.name}!`);
  };

  if (currentPage === 'admin') {
    return <AdminDashboard onBackToStore={() => setCurrentPage('menu')} />;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF' }}>
      
      {/* Toast Alert */}
      {toastMessage && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: '#11141A', color: '#fff', padding: '14px 24px', borderRadius: '9999px', zIndex: 9999, fontWeight: 700, boxShadow: '0 10px 30px rgba(0,0,0,0.3)', borderLeft: '4px solid #E31837' }}>
          {toastMessage}
        </div>
      )}

      {/* =========================================================================
          EXACT CHEEZIOUS NAVBAR (100% IDENTICAL TO SCREENSHOT 1)
          ========================================================================= */}
      <header className="chz-header">
        <div className="container chz-header-inner">
          
          {/* Left: Red Hamburger & Official Cheezious Logo */}
          <div className="header-left">
            <button className="hamburger-btn" onClick={() => setIsLeftDrawerOpen(true)} title="Open navigation menu">
              <span></span>
              <span></span>
              <span></span>
            </button>

            <div className="chz-logo-link" onClick={() => setCurrentPage('menu')} style={{ cursor: 'pointer' }}>
              <img
                className="chz-logo-img"
                src={branding?.logo || '/assets/mainLogo.png'}
                alt={tenant?.name || 'Restaurant'}
                style={{ maxHeight: '42px', maxWidth: '150px', objectFit: 'contain' }}
              />
            </div>
          </div>

          {/* Middle: DELIVERY / PICK-UP Switcher, Search Bar, Address Capsule */}
          <div className="header-middle">
            {/* Delivery vs Pick-Up Pill */}
            <div className="order-switch-capsule">
              <button
                className={`order-switch-btn ${orderMode === 'DELIVERY' ? 'active' : ''}`}
                onClick={() => setOrderMode('DELIVERY')}
              >
                <img src="/assets/pin.1d35bccd.svg" alt="" style={{ width: '16px', height: '16px' }} />
                <span>DELIVERY</span>
              </button>
              <button
                className={`order-switch-btn ${orderMode === 'PICKUP' ? 'active' : ''}`}
                onClick={() => setOrderMode('PICKUP')}
              >
                <img src="/assets/store.a7543dfa.svg" alt="" style={{ width: '16px', height: '16px' }} />
                <span>PICK-UP</span>
              </button>
            </div>

            {/* Find in restaurant Search Bar */}
            <div className="search-capsule">
              <img src="/assets/search.1d0c08c7.svg" alt="" className="search-icon" style={{ width: '16px', height: '16px' }} />
              <input
                type="text"
                placeholder={`Find in ${tenant?.name || 'menu'}...`}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (currentPage !== 'menu') setCurrentPage('menu');
                }}
              />
            </div>

            {/* Enter the Delivery Address Capsule */}
            <div className="address-capsule" onClick={() => setIsLocationModalOpen(true)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <img src="/assets/location.011c956f.svg" alt="" style={{ width: '14px', height: '14px' }} />
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>{deliveryAddress}</span>
              </div>
              <img src="/assets/arrow.d9b04780.svg" alt="" style={{ width: '10px', height: '10px' }} />
            </div>
          </div>

          {/* Right: Yellow CART & Yellow LOGIN Buttons */}
          <div className="header-right">
            {/* CART Button */}
            <button className="chz-yellow-btn" onClick={() => setIsCartOpen(true)} title="View cart">
              <img src="/assets/cart.59a90757.svg" alt="" style={{ width: '18px', height: '18px' }} />
              <span>CART</span>
              <span className="cart-counter-badge">{cart.reduce((s, i) => s + i.quantity, 0)}</span>
            </button>

            {/* LOGIN Button */}
            {authUser || user ? (
              <button className="chz-yellow-btn" onClick={() => setCurrentPage('account')}>
                <img src="/assets/user.5fb6c6b7.svg" alt="" style={{ width: '16px', height: '16px' }} />
                <span>{(authUser?.name || user?.name || 'User').split(' ')[0].toUpperCase()}</span>
              </button>
            ) : (
              <button
                className="chz-yellow-btn"
                onClick={() => (onOpenLogin ? onOpenLogin() : setIsLoginModalOpen(true))}
              >
                <img src="/assets/user.5fb6c6b7.svg" alt="" style={{ width: '16px', height: '16px' }} />
                <span>LOGIN</span>
              </button>
            )}
          </div>

        </div>
      </header>

      {/* ==================================================================           LEFT SLIDE-OUT DRAWER (Opened via Red Hamburger ☰) — Cheezious Exact Style
          ========================================================================= */}
      <div className={`left-drawer-overlay ${isLeftDrawerOpen ? 'open' : ''}`} onClick={() => setIsLeftDrawerOpen(false)}>
        <div className="left-drawer" onClick={(e) => e.stopPropagation()}>

          {/* ── User / Login Section ── */}
          <div className="chz-drawer-user-section">
            <div className="chz-drawer-avatar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"/>
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
            </div>
            <div className="chz-drawer-user-info">
              <span className="chz-drawer-user-sub">
                {user ? `Hello, ${user.name}` : 'Login to explore'}
              </span>
              <span className="chz-drawer-user-title">World of flavors</span>
            </div>
          </div>

          {!user ? (
            <div style={{ padding: '0 24px 20px' }}>
              <button
                className="chz-drawer-login-btn"
                onClick={() => { setIsLoginModalOpen(true); setIsLeftDrawerOpen(false); }}
              >
                LOGIN
              </button>
            </div>
          ) : (
            <div style={{ padding: '0 24px 20px' }}>
              <button
                className="chz-drawer-login-btn chz-drawer-logout-btn"
                onClick={() => { setUser(null); localStorage.removeItem('cheezious_user'); setIsLeftDrawerOpen(false); }}
              >
                LOGOUT
              </button>
            </div>
          )}

          <div className="chz-drawer-divider" />

          {/* ── Main Nav Links ── */}
          <div className="chz-drawer-nav">
            <div className="chz-drawer-nav-item" onClick={() => { setCurrentPage('menu'); setIsLeftDrawerOpen(false); }}>
              <span className="chz-drawer-nav-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
              </span>
              <span>Explore Menu</span>
            </div>

            <div className="chz-drawer-nav-item" onClick={() => { setCurrentPage('branches'); setIsLeftDrawerOpen(false); }}>
              <span className="chz-drawer-nav-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </span>
              <span>Branch Locator</span>
            </div>
          </div>

          <div className="chz-drawer-divider" />

          {/* ── Footer Text Links ── */}
          <div className="chz-drawer-text-links">
            <span className="chz-drawer-text-link">Blog</span>
            <span className="chz-drawer-text-link">Privacy Policy</span>
          </div>

          {/* ── Admin Portal (subtle) ── */}
          <div className="chz-drawer-nav" style={{ marginTop: 'auto' }}>
            <div className="chz-drawer-nav-item chz-drawer-admin-item" onClick={() => { setCurrentPage('admin'); setIsLeftDrawerOpen(false); }}>
              <span className="chz-drawer-nav-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
                </svg>
              </span>
              <span>Admin Portal</span>
            </div>
          </div>

          {/* ── Bottom Yellow Hotline Bar ── */}
          <div className="chz-drawer-hotline-bar">
            <img src="/assets/logo.svg" alt="Cheezious" className="chz-drawer-hotline-logo" />
            <span className="chz-drawer-hotline-text">Cheezious Hotline</span>
            <a href="tel:+922111116666" className="chz-drawer-hotline-btn" aria-label="Call Cheezious Hotline">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
              </svg>
            </a>
          </div>

        </div>
      </div>

      {/* =========================================================================
          VIEW 1: MENU & HOMEPAGE (100% Matching Screenshot 1)
          ========================================================================= */}
      {(currentPage === 'menu' || currentPage === 'deals') && (
        <div>
          {/* Full Width Hero Banner */}
          <div className="hero-full-wrap">
            <img
              className="hero-banner-img"
              src={BANNERS[activeBannerIdx]}
              alt="Cheezious Thin & Crispy"
            />
            {/* Solid Red Bar at bottom with white pagination dots */}
            <div className="banner-red-bar">
              {BANNERS.map((_, idx) => (
                <div
                  key={idx}
                  className={`banner-dot ${idx === activeBannerIdx ? 'active' : ''}`}
                  onClick={() => setActiveBannerIdx(idx)}
                />
              ))}
            </div>
          </div>

          {/* Red Order Now Button Floating Row */}
          <div className="banner-action-row">
            <button className="red-order-btn" onClick={() => {
              const el = document.getElementById('exploreMenuSection');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}>
              ORDER NOW
            </button>
          </div>

          {/* Section: Explore Menu Header & Authentic Carousel */}
          <div className="explore-menu-wrap" id="exploreMenuSection">
            <div className="explore-menu-header">
              <h2 className="explore-menu-title">Explore Menu</h2>
              <span className="view-all-link" onClick={() => { setActiveCategory('all'); setCurrentPage('menu'); }}>
                VIEW ALL
              </span>
            </div>

            {/* Category Carousel with Left/Right Navigation Arrows */}
            <div className="explore-carousel-container">
              <button
                className="carousel-nav-btn prev"
                onClick={() => {
                  const track = document.getElementById('exploreTrack');
                  if (track) track.scrollBy({ left: -320, behavior: 'smooth' });
                }}
                title="Previous categories"
              >
                ‹
              </button>

              <div className="explore-carousel-track" id="exploreTrack">
                {/* 1. Thin Crust Pizza */}
                <div
                  className={`explore-cat-card ${activeCategory.toLowerCase().includes('thin') ? 'active' : ''}`}
                  onClick={() => {
                    const match = categories.find(c => c.name.toLowerCase().includes('thin'));
                    setActiveCategory(match ? match.id : 'all');
                  }}
                >
                  <img className="explore-cat-img" src="/assets/categories/thin_crust.jpg" alt="THIN CRUST PIZZA" />
                  <div className="explore-cat-name">THIN CRUST PIZZA</div>
                </div>

                {/* 2. Malai Tikka */}
                <div
                  className={`explore-cat-card ${activeCategory.toLowerCase().includes('malai') ? 'active' : ''}`}
                  onClick={() => {
                    const match = categories.find(c => c.name.toLowerCase().includes('malai'));
                    setActiveCategory(match ? match.id : 'all');
                  }}
                >
                  <img className="explore-cat-img" src="/assets/categories/malai_tikka.png" alt="MALAI TIKKA" />
                  <div className="explore-cat-name">MALAI TIKKA</div>
                </div>

                {/* 3. Beef Pepperoni Pizza */}
                <div
                  className={`explore-cat-card ${activeCategory.toLowerCase().includes('pepperoni') ? 'active' : ''}`}
                  onClick={() => {
                    const match = categories.find(c => c.name.toLowerCase().includes('pepperoni'));
                    setActiveCategory(match ? match.id : 'all');
                  }}
                >
                  <img className="explore-cat-img" src="/assets/categories/beef_pepperoni.jpg" alt="BEEF PEPPERONI PIZZA" />
                  <div className="explore-cat-name">BEEF PEPPERONI PIZZA</div>
                </div>

                {/* 4. Starters */}
                <div
                  className={`explore-cat-card ${activeCategory.toLowerCase().includes('starter') ? 'active' : ''}`}
                  onClick={() => {
                    const match = categories.find(c => c.name.toLowerCase().includes('starter'));
                    setActiveCategory(match ? match.id : 'all');
                  }}
                >
                  <img className="explore-cat-img" src="/assets/categories/starters.jpg" alt="STARTERS" />
                  <div className="explore-cat-name">STARTERS</div>
                </div>

                {/* Dynamic categories from database */}
                {categories
                  .filter(c => !['thin', 'malai', 'pepperoni', 'starter'].some(k => c.name.toLowerCase().includes(k)))
                  .map(cat => (
                    <div
                      key={cat.id}
                      className={`explore-cat-card ${activeCategory === cat.id ? 'active' : ''}`}
                      onClick={() => setActiveCategory(cat.id)}
                    >
                      {cat.image ? (
                        <img className="explore-cat-img" src={cat.image} alt={cat.name} onError={(e: any) => (e.target.style.display = 'none')} />
                      ) : (
                        <div style={{ fontSize: '3.5rem', height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🍕</div>
                      )}
                      <div className="explore-cat-name">{cat.name.toUpperCase()}</div>
                    </div>
                  ))}
              </div>

              <button
                className="carousel-nav-btn next"
                onClick={() => {
                  const track = document.getElementById('exploreTrack');
                  if (track) track.scrollBy({ left: 320, behavior: 'smooth' });
                }}
                title="Next categories"
              >
                ›
              </button>
            </div>
          </div>

          {/* Products Grid */}
          <div className="container" style={{ padding: '20px 24px 60px' }}>
            <div className="products-grid">
              {filteredProducts.map((p) => (
                <div key={p.id} className="product-card" onClick={() => handleOpenProduct(p)}>
                  <div className="card-img-wrap">
                    <img className="card-img" src={p.image} alt={p.name} loading="lazy" />
                    {p.isBestSeller && <span className="card-badge bestseller">★ Bestseller</span>}
                    {p.isDeal && <span className="card-badge" style={{ background: '#E31837' }}>Special Deal</span>}
                  </div>
                  <div className="card-content">
                    <h3 className="product-name">{p.name}</h3>
                    <p className="product-desc">{p.description || 'Prepared fresh with signature Cheezious recipes.'}</p>
                    <div className="card-footer">
                      <div className="price-wrap">
                        <span className="price-label">Price</span>
                        <span className="product-price" style={{ color: '#E31837' }}>Rs. {p.price.toLocaleString('en-PK')}</span>
                      </div>
                      <button
                        className="add-card-btn"
                        style={{ background: '#FFE600', color: '#1A1A1A', border: 'none', fontWeight: 800 }}
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
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 2: BRANCHES LOCATOR
          ========================================================================= */}
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
                      style={{ flex: 1, background: selectedBranch?.id === b.id ? '#10B981' : '#E31837', color: '#fff', justifyContent: 'center' }}
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

      {/* =========================================================================
          VIEW 3: TRACK ORDER
          ========================================================================= */}
      {currentPage === 'track' && (
        <div className="container" style={{ padding: '40px 24px', minHeight: '600px', maxWidth: '780px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 800 }}>Live Order Tracking</h1>
            <p style={{ color: '#4E5D78', marginTop: '8px' }}>Real-time updates directly from the Cheezious kitchen</p>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <input
                type="text"
                placeholder="Enter Order ID (e.g. #CHZ-XXXXXX) or Phone Number"
                value={trackSearchQuery}
                onChange={(e) => setTrackSearchQuery(e.target.value)}
                style={{ flex: 1, padding: '12px 18px', borderRadius: '12px', border: '1px solid #CBD5E1' }}
              />
              <button
                className="add-order-btn"
                style={{ padding: '0 24px', background: '#E31837' }}
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

          {activeOrder && (
            <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', border: '1px solid #E5E7EB', boxShadow: '0 10px 30px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #F3F4F6', paddingBottom: '16px', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#E31837' }}>{activeOrder.orderNumber}</h3>
                  <p style={{ fontSize: '0.85rem', color: '#4E5D78' }}>Placed by {activeOrder.customerName} • {activeOrder.customerPhone}</p>
                </div>
                <span style={{ background: '#FFF2ED', color: '#E31837', fontWeight: 800, padding: '6px 14px', borderRadius: '9999px', fontSize: '0.85rem' }}>
                  {activeOrder.status}
                </span>
              </div>

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
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          VIEW 4: USER ACCOUNT
          ========================================================================= */}
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
                  showToast('Signed out');
                }}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
              >
                Sign Out
              </button>
            ) : (
              <button className="chz-yellow-btn" onClick={() => setIsLoginModalOpen(true)}>
                Sign In with Mobile
              </button>
            )}
          </div>

          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '16px' }}>Past Orders</h3>
          {userOrders.map((ord) => (
            <div key={ord.id} style={{ background: '#fff', borderRadius: '14px', padding: '18px', border: '1px solid #E5E7EB', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 800, color: '#E31837' }}>{ord.orderNumber}</span>
                <span style={{ fontSize: '0.78rem', background: '#F3F4F6', padding: '4px 10px', borderRadius: '9999px', fontWeight: 700 }}>
                  {ord.status}
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#4E5D78', marginBottom: '8px' }}>
                {ord.items.map((it) => `${it.quantity}x ${it.productName}`).join(', ')}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700 }}>Rs. {ord.total.toLocaleString('en-PK')}</span>
                <button
                  style={{ color: '#E31837', fontWeight: 700, fontSize: '0.85rem' }}
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

      {/* =========================================================================
          MODALS
          ========================================================================= */}
      {/* 1. Address / Location Modal */}
      {isLocationModalOpen && (
        <div className="modal-overlay open" onClick={() => setIsLocationModalOpen(false)}>
          <div className="location-modal" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
            <div className="checkout-modal-header">
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Select Delivery Location</h3>
              <button className="modal-close-btn" style={{ position: 'static' }} onClick={() => setIsLocationModalOpen(false)}>✕</button>
            </div>
            <div style={{ padding: '24px' }}>
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

              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4E5D78' }}>Delivery Address / Area</label>
                <input
                  type="text"
                  placeholder="e.g. F-7 Markaz, Street 12, Islamabad"
                  value={deliveryAddress === 'Enter the Delivery Address' ? '' : deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', marginTop: '4px' }}
                />
              </div>

              <button
                className="chz-yellow-btn"
                style={{ width: '100%', justifyContent: 'center', padding: '14px' }}
                onClick={() => {
                  if (!deliveryAddress || deliveryAddress === 'Enter the Delivery Address') {
                    setDeliveryAddress(`${selectedCity} Area`);
                  }
                  setIsLocationModalOpen(false);
                  showToast(`Location set to: ${deliveryAddress}`);
                }}
              >
                Confirm Location
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Login Modal */}
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
                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label>Your Name</label>
                    <input type="text" placeholder="Asim Khalid" value={loginName} onChange={(e) => setLoginName(e.target.value)} required />
                  </div>
                  <div className="form-group" style={{ marginBottom: '20px' }}>
                    <label>Mobile Number (Pakistan)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ padding: '10px 14px', background: '#F3F4F6', borderRadius: '8px', fontWeight: 700 }}>🇵🇰 +92</span>
                      <input type="tel" placeholder="300-1234567" value={loginPhone} onChange={(e) => setLoginPhone(e.target.value)} required style={{ flex: 1 }} />
                    </div>
                  </div>
                  <button type="submit" className="chz-yellow-btn" style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
                    Send Code ➔
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp}>
                  <p style={{ color: '#4E5D78', fontSize: '0.88rem', marginBottom: '16px' }}>Enter 4-digit code sent to +92 {loginPhone} (Use 1234)</p>
                  <input
                    type="text"
                    maxLength={4}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '8px', fontWeight: 800, width: '100%', padding: '12px', marginBottom: '16px' }}
                    required
                  />
                  <button type="submit" className="chz-yellow-btn" style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
                    Verify & Sign In ✓
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Product Customizer Modal */}
      {selectedProduct && selectedProduct.optionGroups && selectedProduct.optionGroups.length > 0 ? (
        <CustomizationModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={(item) => {
            setCart((prev) => [...prev, item]);
            showToast(`Added "${item.name}" to cart!`);
          }}
        />
      ) : selectedProduct && (
        <div className="modal-overlay open" onClick={() => setSelectedProduct(null)}>
          <div className="product-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-img">
              <img src={selectedProduct.image} alt={selectedProduct.name} />
              <button className="modal-close-btn" onClick={() => setSelectedProduct(null)}>✕</button>
            </div>
            <div className="modal-body">
              <h3 className="modal-product-title">{selectedProduct.name}</h3>
              <p className="modal-product-desc">{selectedProduct.description}</p>
              <div className="modal-base-price" style={{ color: '#E31837' }}>Rs. {selectedProduct.price.toLocaleString('en-PK')}</div>

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
            </div>

            <div className="modal-footer">
              <div className="quantity-stepper">
                <button className="stepper-btn" onClick={() => setCustomQty(Math.max(1, customQty - 1))}>-</button>
                <span className="stepper-value">{customQty}</span>
                <button className="stepper-btn" onClick={() => setCustomQty(customQty + 1)}>+</button>
              </div>
              <button className="add-order-btn" style={{ background: '#FFE600', color: '#1A1A1A', fontWeight: 800 }} onClick={handleAddToCart}>
                Add to Cart • Rs. {(selectedProduct.price * customQty).toLocaleString('en-PK')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Cart Drawer */}
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

            <div className="cart-delivery-banner" style={{ color: '#E31837', background: '#FFF5F6' }}>
              {orderMode === 'DELIVERY' ? `🛵 Delivering to ${deliveryAddress}` : `🛍️ Pick up at ${selectedBranch?.name || 'Islamabad'}`}
            </div>

            <div className="cart-items-list">
              {cart.length === 0 ? (
                <div className="empty-cart-view">
                  <div className="empty-cart-icon">🍕</div>
                  <h3>Your Cart is Empty</h3>
                  <p>Explore our menu and add your favorite Cheezious pizzas, burgers, and deals!</p>
                  <button className="chz-yellow-btn" onClick={() => setIsCartOpen(false)}>Start Ordering</button>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.cartItemId} className="cart-item-row">
                    <img className="cart-item-img" src={item.image} alt={item.name} />
                    <div className="cart-item-info">
                      <h4 className="cart-item-name">{item.name}</h4>
                      <p className="cart-item-customizations">{[item.size, item.crust].filter(Boolean).join(' • ')}</p>
                      <div className="cart-item-price" style={{ color: '#E31837' }}>Rs. {(item.unitPrice * item.quantity).toLocaleString('en-PK')}</div>
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
                    <button className="voucher-btn" style={{ background: '#1A1A1A' }} onClick={handleApplyVoucher}>Apply</button>
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
                    <span style={{ color: '#E31837' }}>Rs. {grandTotal.toLocaleString('en-PK')}</span>
                  </div>
                  <button
                    className="chz-yellow-btn"
                    style={{ width: '100%', justifyContent: 'center', padding: '14px', marginTop: '12px' }}
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

      {/* 5. Checkout Modal */}
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

                <button type="submit" className="chz-yellow-btn" style={{ width: '100%', justifyContent: 'center', padding: '14px', marginTop: '24px' }}>
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
              <img src="/assets/logo.svg" alt="Cheezious Logo" style={{ height: '44px', marginBottom: '16px', filter: 'brightness(0) invert(1)' }} />
              <h3>The Cheeziest Food in Town</h3>
              <p>Full-Stack PERN Platform matching cheezious.com 100%.</p>
            </div>
            <div className="footer-column">
              <h4>Quick Navigation</h4>
              <ul className="footer-links">
                <li><a href="#" onClick={() => setCurrentPage('menu')}>Explore Menu</a></li>
                <li><a href="#" onClick={() => setCurrentPage('deals')}>Special Offers</a></li>
                <li><a href="#" onClick={() => setCurrentPage('branches')}>61 Nationwide Branches</a></li>
                <li><a href="#" onClick={() => setCurrentPage('track')}>Track My Order</a></li>
                <li><a href="#" onClick={() => setCurrentPage('admin')}>Kitchen & Admin Feed</a></li>
              </ul>
            </div>
            <div className="footer-column">
              <h4>Support & Customer Care</h4>
              <p style={{ color: '#A0AEC0', fontSize: '0.9rem' }}>📞 UAN: 051-111-44-66-99</p>
              <p style={{ color: '#A0AEC0', fontSize: '0.9rem' }}>Email: support@cheezious.com</p>
            </div>
          </div>
          <div className="footer-bottom">
            <div>© 2026 Cheezious Official Clone. 100% Identical Experience.</div>
          </div>
        </div>
      </footer>
    </div>
  );
};
