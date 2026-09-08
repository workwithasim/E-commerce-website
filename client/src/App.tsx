import React, { useEffect, useMemo, useState } from 'react';
import { api, socket } from './api';
import { Product, Category, Branch, CartItem, Order, RiderLocation } from './types';
import { AuthUser } from './LoginPage';
import { useTenant } from './theme/ThemeProvider';
import { CustomizationModal } from './components/CustomizationModal';

interface AppProps { authUser?: AuthUser | null; onLogout?: () => void; onOpenLogin?: () => void }
function stored<T>(key: string, fallback: T): T { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } }

export const App: React.FC<AppProps> = ({ authUser, onLogout, onOpenLogin }) => {
  const { tenant, branding, settings } = useTenant();
  const prefix = `restaurant:${tenant!.id}:`;
  const [page, setPage] = useState<'menu' | 'branches' | 'account' | 'track'>('menu');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState(stored<string>(prefix + 'branch', ''));
  const [mode, setMode] = useState<'DELIVERY' | 'TAKEAWAY'>(settings?.deliveryEnabled === false ? 'TAKEAWAY' : 'DELIVERY');
  const [cart, setCart] = useState<CartItem[]>(stored(prefix + 'cart', []));
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [product, setProduct] = useState<Product | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [name, setName] = useState(authUser?.name || '');
  const [phone, setPhone] = useState(authUser?.phone || '');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [voucher, setVoucher] = useState('');
  const [quote, setQuote] = useState<any>(null);
  const [quoteError, setQuoteError] = useState('');
  const [quoting, setQuoting] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [trackId, setTrackId] = useState('');
  const [location, setLocation] = useState<RiderLocation | null>(null);
  const [banner, setBanner] = useState(0);
  const money = (n: number) => `${settings?.currencySymbol || tenant?.currency || ''} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const branch = branches.find(b => b.id === branchId);
  const banners = tenant?.banners || [];
  const payload = useMemo(() => ({ branchId, orderMode: mode, voucherCode: voucher.trim() || undefined,
    items: cart.map(i => ({ productId: i.productId, quantity: i.quantity, optionIds: i.selectedOptions?.map(o => o.optionId) || [], instructions: i.instructions })) }), [cart, branchId, mode, voucher]);

  useEffect(() => { localStorage.setItem(prefix + 'cart', JSON.stringify(cart)); }, [cart, prefix]);
  useEffect(() => { localStorage.setItem(prefix + 'branch', JSON.stringify(branchId)); }, [branchId, prefix]);
  useEffect(() => { setName(authUser?.name || ''); setPhone(authUser?.phone || ''); }, [authUser]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [p, c, b] = await Promise.all([api.getProducts(), api.getCategories(), api.getBranches()]);
        if (!alive) return;
        setProducts(p); setCategories(c); setBranches(b);
        setBranchId(id => b.some(x => x.id === id && x.isOpen) ? id : b.find(x => x.isOpen)?.id || '');
      } catch (e: any) { if (alive) setError(e.message); }
      finally { if (alive) setLoading(false); }
    };
    load();
    socket.on('product:added', load); socket.on('product:updated', load); socket.on('product:deleted', load); socket.on('branch:status_updated', load);
    return () => { alive = false; socket.off('product:added', load); socket.off('product:updated', load); socket.off('product:deleted', load); socket.off('branch:status_updated', load); };
  }, [tenant?.id]);
  useEffect(() => { if (banners.length < 2) return; const timer = setInterval(() => setBanner(i => (i + 1) % banners.length), 6000); return () => clearInterval(timer); }, [banners.length]);
  useEffect(() => {
    let alive = true;
    setQuote(null); setQuoteError('');
    if (!authUser || !cart.length || !branchId) { setQuoting(false); return; }
    setQuoting(true);
    const timer = setTimeout(() => api.quoteOrder(payload).then(q => { if (alive) setQuote(q); }).catch(e => { if (alive) setQuoteError(e.message); }).finally(() => { if (alive) setQuoting(false); }), 250);
    return () => { alive = false; clearTimeout(timer); };
  }, [payload, authUser]);
  useEffect(() => {
    if (!authUser || (page !== 'account' && page !== 'track')) return;
    let alive = true;
    api.getOrders().then(data => { if (alive) setOrders(data); }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [page, authUser]);
  useEffect(() => {
    if (!activeOrder) return;
    setLocation(null);
    const join = () => { socket.emit('join:order', activeOrder.id); api.getOrder(activeOrder.id).then(setActiveOrder).catch(e => setError(e.message)); };
    const update = (order: Order) => { if (order.id === activeOrder.id) setActiveOrder(prev => prev ? { ...prev, ...order } : order); setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...order } : o)); };
    const gps = (data: any) => { if (data.orderId === activeOrder.id) setLocation(data); };
    join(); socket.on('connect', join); socket.on('order:status_updated', update); socket.on('delivery:location_updated', gps);
    return () => { socket.emit('leave:order', activeOrder.id); socket.off('connect', join); socket.off('order:status_updated', update); socket.off('delivery:location_updated', gps); };
  }, [activeOrder?.id]);
  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setDrawer(false); setCartOpen(false); setCheckout(false); setProduct(null); } }; window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc); }, []);

  const filtered = products.filter(p => (category === 'all' || p.categoryId === category) && `${p.name} ${p.description || ''}`.toLowerCase().includes(search.toLowerCase()));
  const subtotal = cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const changeQty = (id: string, delta: number) => setCart(prev => prev.map(i => i.cartItemId === id ? { ...i, quantity: Math.min(99, i.quantity + delta) } : i).filter(i => i.quantity > 0));
  const place = async (e: React.FormEvent) => {
    e.preventDefault(); if (placing || !quote) return;
    setPlacing(true); setError('');
    try {
      const order = await api.createOrder({ ...payload, customerName: name, customerPhone: phone, deliveryAddress: address, notes, paymentMethod: 'COD' });
      setCart([]); setVoucher(''); setCheckout(false); setCartOpen(false); setActiveOrder(order); setPage('track');
    } catch (e: any) { setError(e.message); } finally { setPlacing(false); }
  };
  const navigate = (target: typeof page) => { setPage(target); setDrawer(false); setError(''); };
  const bill = <div className="cart-bill-section">
    {quote ? <><div className="bill-row"><span>Subtotal</span><span>{money(quote.subtotal)}</span></div><div className="bill-row"><span>Delivery</span><span>{money(quote.deliveryFee)}</span></div><div className="bill-row"><span>Discount</span><span>−{money(quote.discount)}</span></div><div className="bill-row"><span>Tax</span><span>{money(quote.tax)}</span></div><div className="bill-row grand-total"><span>Total</span><span>{money(quote.total)}</span></div></> : <div className="bill-row"><span>Items estimate</span><span>{money(subtotal)}</span></div>}
    {quoting && <p role="status">Updating total…</p>}{quoteError && <p role="alert" className="error-message">{quoteError}</p>}
  </div>;

  return <div className="storefront">
    <header className="chz-header"><div className="container chz-header-inner">
      <div className="header-left"><button className="hamburger-btn" aria-label="Open menu" onClick={() => setDrawer(true)}><span/><span/><span/></button><button className="chz-logo-link" onClick={() => navigate('menu')}>{branding?.logo ? <img className="chz-logo-img" src={branding.logo} alt={tenant?.name}/> : <strong>{tenant?.name}</strong>}</button></div>
      <div className="header-middle"><input aria-label="Search menu" className="search-input" placeholder={`Find in ${tenant?.name}`} value={search} onChange={e => { setSearch(e.target.value); setPage('menu'); }}/></div>
      <div className="header-right"><button className="chz-yellow-btn" onClick={() => setCartOpen(true)}>Cart ({cart.reduce((s,i) => s+i.quantity,0)})</button><button className="chz-yellow-btn" onClick={() => authUser ? navigate('account') : onOpenLogin?.()}>{authUser ? 'Account' : 'Login'}</button></div>
    </div></header>
    {error && <div className="error-message container" role="alert">{error} <button onClick={() => setError('')}>Dismiss</button></div>}
    <div className="store-controls container"><label>Order mode<select value={mode} onChange={e => setMode(e.target.value as any)}>{settings?.deliveryEnabled !== false && <option value="DELIVERY">Delivery</option>}{settings?.takeawayEnabled !== false && <option value="TAKEAWAY">Pickup</option>}</select></label><label>Branch<select aria-label="Select branch" value={branchId} onChange={e => setBranchId(e.target.value)}><option value="">Select branch</option>{branches.filter(b => b.isOpen).map(b => <option key={b.id} value={b.id}>{b.name} · {b.city}</option>)}</select></label></div>
    {drawer && <div className="left-drawer-overlay open" onClick={() => setDrawer(false)}><nav className="left-drawer" aria-label="Main navigation" onClick={e => e.stopPropagation()}><button className="drawer-close" onClick={() => setDrawer(false)}>Close ×</button><h2>{tenant?.name}</h2>{(['menu','branches','track','account'] as const).map(p => <button className="chz-drawer-nav-item" key={p} onClick={() => navigate(p)}>{p === 'menu' ? 'Explore menu' : p === 'track' ? 'Track order' : p === 'account' ? 'My account' : 'Branches'}</button>)}{settings?.hotline && <a className="chz-drawer-nav-item" href={`tel:${settings.hotline}`}>Call {settings.hotline}</a>}</nav></div>}
    {page === 'menu' && <>
      {banners.length > 0 && <section className="hero-full-wrap"><picture>{banners[banner]?.mobileImage && <source media="(max-width: 768px)" srcSet={banners[banner].mobileImage!}/>}<img className="hero-banner-img" src={banners[banner]?.desktopImage} alt={banners[banner]?.title}/></picture><div className="banner-red-bar">{banners.map((b,i) => <button key={b.id} aria-label={`Show banner ${i+1}`} className={`banner-dot ${banner === i ? 'active' : ''}`} onClick={() => setBanner(i)}/>)}</div></section>}
      <main className="container menu-container"><h1>Explore menu</h1><input className="mobile-search" aria-label="Search food" placeholder="Search food…" value={search} onChange={e => setSearch(e.target.value)}/><div className="category-row-scroll"><button className={`category-tile-card ${category === 'all' ? 'active' : ''}`} onClick={() => setCategory('all')}>All items</button>{categories.map(c => <button key={c.id} className={`category-tile-card ${category === c.id ? 'active' : ''}`} onClick={() => setCategory(c.id)}>{c.image && <img className="category-tile-img" src={c.image} alt=""/>}{c.name}</button>)}</div>
      {loading ? <p role="status">Loading menu…</p> : !filtered.length ? <p>No matching items.</p> : <div className="products-grid">{filtered.map(p => <article className="product-card" key={p.id}><div className="card-img-wrap"><img className="card-img" src={p.image} alt={p.name} loading="lazy"/>{p.isBestSeller && <span className="card-badge bestseller">Bestseller</span>}</div><div className="card-content"><h2 className="product-name">{p.name}</h2><p className="product-desc">{p.description}</p><div className="card-footer"><span className="product-price">{money(p.discountedPrice ?? p.basePrice)}</span><button className="add-card-btn" disabled={!p.isAvailable} onClick={() => setProduct(p)}>{p.isAvailable ? '+ Add' : 'Unavailable'}</button></div></div></article>)}</div>}</main>
    </>}
    {page === 'branches' && <main className="container page-content"><h1>Our branches</h1><div className="products-grid">{branches.map(b => <article className="branch-item-card" key={b.id}><div><h2>{b.name}</h2><p>{b.address}, {b.city}</p><p>{b.openingHours}</p><a href={`tel:${b.phone}`}>{b.phone}</a><p>{b.isOpen ? 'Open' : 'Closed'}</p><button className="add-card-btn" disabled={!b.isOpen} onClick={() => { setBranchId(b.id); setPage('menu'); }}>Select branch</button></div></article>)}</div></main>}
    {(page === 'track' || page === 'account') && <main className="container page-content account-content">
      {!authUser ? <><h1>Sign in to view your orders</h1><button className="add-order-btn" onClick={onOpenLogin}>Sign in</button></> : <>
      <h1>{page === 'account' ? `Hello, ${authUser.name}` : 'Track your order'}</h1><p>{authUser.email}</p><button className="text-button" onClick={() => { onLogout?.(); setOrders([]); setActiveOrder(null); }}>Sign out</button>
      {page === 'track' && <form className="tracking-search" onSubmit={async e => { e.preventDefault(); try { setActiveOrder(await api.getOrder(trackId.trim())); } catch (e: any) { setError(e.message); } }}><input aria-label="Order number" required value={trackId} onChange={e => setTrackId(e.target.value)} placeholder="Enter your exact order number"/><button className="add-card-btn">Track</button></form>}
      {activeOrder && <article className="tracking-card"><h2>{activeOrder.orderNumber}</h2><p className="status-badge">{activeOrder.status.replace(/_/g,' ')}</p><p>Total: {money(activeOrder.total)}</p><ol>{activeOrder.statusHistory?.map(h => <li key={h.id}>{h.newStatus.replace(/_/g,' ')} · {new Date(h.timestamp).toLocaleString()}</li>)}</ol>{activeOrder.delivery?.rider && <p>Rider: {activeOrder.delivery.rider.user.name}</p>}{location && settings?.riderTrackingEnabled !== false && <div><p>Last location update: {new Date(location.timestamp!).toLocaleTimeString()}</p><iframe title="Rider location map" className="rider-map" src={`https://www.openstreetmap.org/export/embed.html?bbox=${location.longitude-0.01},${location.latitude-0.01},${location.longitude+0.01},${location.latitude+0.01}&layer=mapnik&marker=${location.latitude},${location.longitude}`}/><a target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=16/${location.latitude}/${location.longitude}`}>Open rider location</a></div>}</article>}
      <h2>Your orders</h2>{!orders.length && <p>No previous orders.</p>}{orders.map(o => <button className="order-history-row" key={o.id} onClick={() => { setActiveOrder(o); setPage('track'); }}><span>{o.orderNumber}</span><span>{o.status.replace(/_/g,' ')} · {money(o.total)}</span></button>)}</>}
    </main>}
    {product && <CustomizationModal product={product} onClose={() => setProduct(null)} onAddToCart={i => { setCart(prev => [...prev,i]); setCartOpen(true); }}/>}
    {cartOpen && <div className="cart-drawer-overlay open" onClick={() => setCartOpen(false)}><aside className="cart-drawer" role="dialog" aria-label="Shopping cart" onClick={e => e.stopPropagation()}><div className="cart-drawer-header"><h2>Your order</h2><button className="cart-drawer-close" aria-label="Close cart" onClick={() => setCartOpen(false)}>×</button></div><p className="cart-delivery-banner">{mode === 'DELIVERY' ? 'Delivery from' : 'Pickup at'} {branch?.name || 'Select a branch'}</p><div className="cart-items-list">{!cart.length ? <p>Your cart is empty.</p> : cart.map(i => <div className="cart-item-row" key={i.cartItemId}><img className="cart-item-img" src={i.image} alt=""/><div className="cart-item-info"><h3>{i.name}</h3><p>{i.selectedOptions?.map(o => o.optionName).join(' · ')}</p><p>{money(i.unitPrice*i.quantity)}</p><div className="cart-item-stepper"><button aria-label={`Decrease ${i.name}`} onClick={() => changeQty(i.cartItemId,-1)}>−</button><span>{i.quantity}</span><button aria-label={`Increase ${i.name}`} onClick={() => changeQty(i.cartItemId,1)}>+</button></div></div></div>)}</div>{cart.length > 0 && <><div className="voucher-section"><label>Promo code<input className="voucher-input" value={voucher} onChange={e => setVoucher(e.target.value)} placeholder="Optional promo code"/></label></div>{bill}<button className="checkout-action-btn" disabled={!!authUser && (!quote || quoting)} onClick={() => { if (!authUser) { setCartOpen(false); onOpenLogin?.(); } else { setCartOpen(false); setCheckout(true); } }}>{authUser ? 'Checkout' : 'Sign in to checkout'}</button></>}</aside></div>}
    {checkout && <div className="modal-overlay open" onClick={() => !placing && setCheckout(false)}><section className="checkout-modal" role="dialog" aria-label="Checkout" onClick={e => e.stopPropagation()}><div className="checkout-modal-header"><h2>Complete your order</h2><button disabled={placing} aria-label="Close checkout" onClick={() => setCheckout(false)}>×</button></div><form className="checkout-modal-body" onSubmit={place}><div className="form-grid"><label className="form-group">Name<input required value={name} onChange={e => setName(e.target.value)}/></label><label className="form-group">Phone<input type="tel" required value={phone} onChange={e => setPhone(e.target.value)}/></label>{mode === 'DELIVERY' && <label className="form-group full-width">Delivery address<input required value={address} onChange={e => setAddress(e.target.value)}/></label>}<label className="form-group full-width">Instructions<input value={notes} onChange={e => setNotes(e.target.value)}/></label></div><p>Payment: Cash {mode === 'DELIVERY' ? 'on delivery' : 'at pickup'}</p>{bill}{error && <p role="alert" className="error-message">{error}</p>}<button className="checkout-action-btn" disabled={placing || quoting || !quote || settings?.cashOnDeliveryEnabled === false}>{placing ? 'Placing order…' : 'Confirm order'}</button></form></section></div>}
    <footer className="footer"><div className="container footer-grid"><div className="footer-brand"><h2>{tenant?.name}</h2><p>Freshly prepared, ready to enjoy.</p></div><nav className="footer-links"><button onClick={() => navigate('menu')}>Menu</button><button onClick={() => navigate('branches')}>Branches</button><button onClick={() => navigate('track')}>Track order</button></nav><div>{settings?.hotline && <p><a href={`tel:${settings.hotline}`}>{settings.hotline}</a></p>}{settings?.email && <p><a href={`mailto:${settings.email}`}>{settings.email}</a></p>}</div></div></footer>
  </div>;
};
