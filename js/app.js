/**
 * CHEEZIOUS WEBSITE CLONE - CORE LOGIC
 * High Performance Vanilla ES6+ Application
 */

// Application State
const state = {
  categories: [],
  products: [],
  banners: [],
  branches: [],
  cities: [],
  selectedCity: 'Islamabad',
  selectedBranch: null,
  orderMode: 'DELIVERY', // 'DELIVERY' or 'PICKUP'
  cart: [],
  voucher: null,
  activeModalProduct: null,
  customization: {
    size: null,
    crust: null,
    flavor: null,
    drink: null,
    addons: [],
    instructions: '',
    quantity: 1,
    unitPrice: 0
  },
  currentBannerIndex: 0,
  bannerInterval: null,
  searchQuery: ''
};

// Default Voucher Codes
const VOUCHERS = {
  'CHEEZY10': { type: 'percent', value: 10, label: '10% OFF Cheezious Special' },
  'WELCOME50': { type: 'flat', value: 50, label: 'Rs. 50 OFF Welcome Treat' },
  'SUPERCHEESE': { type: 'percent', value: 15, label: '15% OFF Pizza Lover Deal' }
};

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  loadCartFromStorage();
  await loadCatalogData();
  setupEventListeners();
  initBannerCarousel();
  renderCategoryNav();
  renderMenu();
  renderBranchesModal();
  updateCartUI();
});

// Load Catalog Data (from local data/catalog.json or pre-bundled script)
async function loadCatalogData() {
  if (window.CHEEZIOUS_CATALOG) {
    applyCatalog(window.CHEEZIOUS_CATALOG);
  }
  try {
    const res = await fetch('data/catalog.json');
    if (res.ok) {
      const data = await res.json();
      applyCatalog(data);
    }
  } catch (err) {
    console.log('Running from file protocol or offline cache.');
  }
}

function applyCatalog(data) {
  state.categories = data.categories || [];
  state.products = data.products || [];
  state.banners = data.banners || [];
  state.branches = data.branches || [];

  // Extract unique cities from branches
  const citySet = new Set();
  state.branches.forEach(b => { if (b.city) citySet.add(b.city); });
  state.cities = Array.from(citySet).sort();

  // Set default branch if not already set
  if (!state.selectedBranch) {
    const defaultBranch = state.branches.find(b => b.city === 'Islamabad') || state.branches[0];
    if (defaultBranch) {
      state.selectedBranch = defaultBranch;
      updateLocationDisplay();
    }
  }
}

// Local Storage for Shopping Cart
function loadCartFromStorage() {
  try {
    const saved = localStorage.getItem('cheezious_cart');
    if (saved) {
      state.cart = JSON.parse(saved);
    }
    const savedBranch = localStorage.getItem('cheezious_branch');
    if (savedBranch) {
      state.selectedBranch = JSON.parse(savedBranch);
    }
  } catch (e) {
    state.cart = [];
  }
}

function saveCartToStorage() {
  try {
    localStorage.setItem('cheezious_cart', JSON.stringify(state.cart));
    if (state.selectedBranch) {
      localStorage.setItem('cheezious_branch', JSON.stringify(state.selectedBranch));
    }
  } catch (e) {
    console.warn('Storage failed', e);
  }
}

// Update Top Bar Location Display
function updateLocationDisplay() {
  const locEl = document.getElementById('currentLocationText');
  if (locEl && state.selectedBranch) {
    locEl.textContent = `${state.selectedBranch.city} - ${state.selectedBranch.name}`;
  }
  const bannerBranch = document.getElementById('cartBranchInfo');
  if (bannerBranch && state.selectedBranch) {
    bannerBranch.textContent = `${state.orderMode === 'DELIVERY' ? 'Delivering from' : 'Pick up at'}: ${state.selectedBranch.name}, ${state.selectedBranch.city}`;
  }
}

// ==========================================================================
// BANNER CAROUSEL
// ==========================================================================
function initBannerCarousel() {
  const track = document.getElementById('carouselTrack');
  const dotsContainer = document.getElementById('carouselDots');
  if (!track || !state.banners.length) return;

  track.innerHTML = '';
  dotsContainer.innerHTML = '';

  state.banners.forEach((banner, idx) => {
    // Slide
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';
    slide.innerHTML = `<img src="${banner.image}" alt="${banner.name || 'Cheezious Deal'}" loading="${idx === 0 ? 'eager' : 'lazy'}">`;
    slide.addEventListener('click', () => {
      // Scroll to deals or first category
      const firstSec = document.querySelector('.category-section');
      if (firstSec) firstSec.scrollIntoView({ behavior: 'smooth' });
    });
    track.appendChild(slide);

    // Dot
    const dot = document.createElement('div');
    dot.className = `carousel-dot ${idx === 0 ? 'active' : ''}`;
    dot.addEventListener('click', () => goToBanner(idx));
    dotsContainer.appendChild(dot);
  });

  // Next / Prev buttons
  const prevBtn = document.getElementById('carouselPrev');
  const nextBtn = document.getElementById('carouselNext');
  if (prevBtn) prevBtn.onclick = prevBanner;
  if (nextBtn) nextBtn.onclick = nextBanner;

  // Auto rotate every 5 seconds
  startBannerTimer();

  // Pause on hover
  const container = document.getElementById('carouselContainer');
  if (container) {
    container.addEventListener('mouseenter', stopBannerTimer);
    container.addEventListener('mouseleave', startBannerTimer);
  }
}

function startBannerTimer() {
  stopBannerTimer();
  state.bannerInterval = setInterval(() => {
    nextBanner();
  }, 5000);
}

function stopBannerTimer() {
  if (state.bannerInterval) clearInterval(state.bannerInterval);
}

function goToBanner(index) {
  state.currentBannerIndex = index;
  updateBannerPosition();
}

function nextBanner() {
  state.currentBannerIndex = (state.currentBannerIndex + 1) % state.banners.length;
  updateBannerPosition();
}

function prevBanner() {
  state.currentBannerIndex = (state.currentBannerIndex - 1 + state.banners.length) % state.banners.length;
  updateBannerPosition();
}

function updateBannerPosition() {
  const track = document.getElementById('carouselTrack');
  if (!track) return;
  track.style.transform = `translateX(-${state.currentBannerIndex * 100}%)`;

  const dots = document.querySelectorAll('.carousel-dot');
  dots.forEach((dot, idx) => {
    dot.classList.toggle('active', idx === state.currentBannerIndex);
  });
}

// ==========================================================================
// CATEGORY NAVIGATION & SCROLL-SPY
// ==========================================================================
function renderCategoryNav() {
  const navInner = document.getElementById('categoryNavInner');
  if (!navInner) return;
  navInner.innerHTML = '';

  // "All" pill
  const allPill = document.createElement('button');
  allPill.className = 'cat-pill active';
  allPill.dataset.catId = 'all';
  allPill.innerHTML = `<span>🔥 All Menu</span>`;
  allPill.onclick = () => {
    setActiveCategoryPill('all');
    window.scrollTo({ top: 380, behavior: 'smooth' });
  };
  navInner.appendChild(allPill);

  // Group products to know which categories actually have items
  const catItemCounts = {};
  state.products.forEach(p => {
    (p.categoryIds || []).forEach(cid => {
      catItemCounts[cid] = (catItemCounts[cid] || 0) + 1;
    });
  });

  state.categories.forEach(cat => {
    if (!catItemCounts[cat.id]) return; // Only show categories that have items

    const pill = document.createElement('button');
    pill.className = 'cat-pill';
    pill.dataset.catId = cat.id;
    
    let iconHtml = cat.image ? `<img src="${cat.image}" alt="${cat.name}" onerror="this.style.display='none'">` : '';
    pill.innerHTML = `${iconHtml}<span>${cat.name}</span>`;
    
    pill.onclick = () => {
      setActiveCategoryPill(cat.id);
      const targetSec = document.getElementById(`cat-sec-${cat.id}`);
      if (targetSec) {
        targetSec.scrollIntoView({ behavior: 'smooth' });
      }
    };
    navInner.appendChild(pill);
  });

  initScrollSpy();
}

function setActiveCategoryPill(catId) {
  document.querySelectorAll('.cat-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.catId === catId);
    if (p.dataset.catId === catId) {
      p.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  });
}

function initScrollSpy() {
  window.addEventListener('scroll', () => {
    const sections = document.querySelectorAll('.category-section');
    let currentId = 'all';
    const scrollPos = window.scrollY + 180;

    sections.forEach(sec => {
      const top = sec.offsetTop;
      const height = sec.offsetHeight;
      if (scrollPos >= top && scrollPos < top + height) {
        currentId = sec.id.replace('cat-sec-', '');
      }
    });

    if (window.scrollY < 350) {
      setActiveCategoryPill('all');
    } else if (currentId !== 'all') {
      setActiveCategoryPill(currentId);
    }
  }, { passive: true });
}

// ==========================================================================
// MENU & PRODUCT RENDERING
// ==========================================================================
function renderMenu() {
  const container = document.getElementById('menuContainer');
  if (!container) return;
  container.innerHTML = '';

  const query = state.searchQuery.trim().toLowerCase();

  // Filter products if search is active
  let filteredProducts = state.products;
  if (query) {
    filteredProducts = state.products.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.description.toLowerCase().includes(query)
    );

    if (filteredProducts.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding: 60px 20px;">
          <h3 style="font-size:1.4rem; color:var(--text-primary); margin-bottom:8px;">No delicious items found for "${state.searchQuery}"</h3>
          <p style="color:var(--text-muted); margin-bottom:16px;">Try searching for Pizza, Burger, Bazinga, Wings or Deals!</p>
          <button class="add-order-btn" style="max-width:200px; margin:0 auto;" onclick="clearSearch()">View Full Menu</button>
        </div>
      `;
      return;
    }

    // Single section for search results
    const searchSec = document.createElement('div');
    searchSec.className = 'category-section';
    searchSec.innerHTML = `
      <div class="section-header">
        <div class="section-title-wrap">
          <h2 class="section-title">Search Results for "${state.searchQuery}"</h2>
          <span class="section-count-badge">${filteredProducts.length} Items</span>
        </div>
      </div>
      <div class="products-grid" id="search-results-grid"></div>
    `;
    container.appendChild(searchSec);
    const grid = searchSec.querySelector('#search-results-grid');
    filteredProducts.forEach(p => grid.appendChild(createProductCard(p)));
    return;
  }

  // Group by Category
  state.categories.forEach(cat => {
    const catProducts = state.products.filter(p => (p.categoryIds || []).includes(cat.id));
    if (!catProducts.length) return;

    const section = document.createElement('section');
    section.className = 'category-section';
    section.id = `cat-sec-${cat.id}`;
    
    section.innerHTML = `
      <div class="section-header">
        <div class="section-title-wrap">
          <h2 class="section-title">${cat.name}</h2>
          <span class="section-count-badge">${catProducts.length}</span>
        </div>
      </div>
      <div class="products-grid"></div>
    `;

    const grid = section.querySelector('.products-grid');
    catProducts.forEach(p => grid.appendChild(createProductCard(p)));
    container.appendChild(section);
  });
}

function createProductCard(product) {
  const card = document.createElement('div');
  card.className = 'product-card';
  card.dataset.productId = product.id;

  let badgeHtml = '';
  if (product.isBestSeller) {
    badgeHtml = `<span class="card-badge bestseller">★ Bestseller</span>`;
  } else if (product.isDeal) {
    badgeHtml = `<span class="card-badge">Special Deal</span>`;
  }

  const formattedPrice = `Rs. ${product.price.toLocaleString('en-PK')}`;

  card.innerHTML = `
    <div class="card-img-wrap">
      <img class="card-img" src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600'">
      ${badgeHtml}
    </div>
    <div class="card-content">
      <h3 class="product-name">${product.name}</h3>
      <p class="product-desc">${product.description || 'Prepared fresh with signature Cheezious recipes and premium ingredients.'}</p>
      <div class="card-footer">
        <div class="price-wrap">
          <span class="price-label">Price</span>
          <span class="product-price">${formattedPrice}</span>
        </div>
        <button class="add-card-btn" onclick="event.stopPropagation(); openProductModal('${product.id}')">
          <span>+ Add</span>
        </button>
      </div>
    </div>
  `;

  card.onclick = () => openProductModal(product.id);
  return card;
}

// ==========================================================================
// PRODUCT DETAIL & CUSTOMIZATION MODAL
// ==========================================================================
function openProductModal(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  state.activeModalProduct = product;
  state.customization = {
    size: null,
    crust: null,
    flavor: null,
    drink: null,
    addons: [],
    instructions: '',
    quantity: 1,
    unitPrice: product.price
  };

  const modalOverlay = document.getElementById('productModalOverlay');
  const modalImg = document.getElementById('modalProductImg');
  const modalTitle = document.getElementById('modalProductTitle');
  const modalDesc = document.getElementById('modalProductDesc');
  const modalPrice = document.getElementById('modalProductPrice');
  const modalDynamicOptions = document.getElementById('modalDynamicOptions');
  const modalStepperVal = document.getElementById('modalStepperValue');

  modalImg.src = product.image;
  modalTitle.textContent = product.name;
  modalDesc.textContent = product.description || 'Freshly baked and handcrafted with rich mozzarella and our secret blend of spices.';
  modalPrice.textContent = `Rs. ${product.price.toLocaleString('en-PK')}`;
  modalStepperVal.textContent = '1';

  // Build Options based on category & name
  modalDynamicOptions.innerHTML = '';
  const isPizza = product.name.toLowerCase().includes('pizza') || product.name.toLowerCase().includes('crust');
  const isDeal = product.isDeal || product.name.toLowerCase().includes('deal') || product.description.toLowerCase().includes('drink');
  const isBurger = product.name.toLowerCase().includes('burger') || product.name.toLowerCase().includes('bazinga');

  // Option 1: Sizes
  if (isPizza) {
    const sizeGroup = createOptionGroup('Select Pizza Size', [
      { name: 'Small (6")', extra: 0, default: true },
      { name: 'Regular (9")', extra: 450 },
      { name: 'Large (12")', extra: 850 },
      { name: 'Jumbo (14")', extra: 1300 }
    ], 'size', 'radio');
    modalDynamicOptions.appendChild(sizeGroup);
    state.customization.size = 'Small (6")';

    // Option 2: Crusts
    const crustGroup = createOptionGroup('Choose Crust Type', [
      { name: 'Pan Crust (Classic Fluffy)', extra: 0, default: true },
      { name: 'Thin & Crispy Crust', extra: 0 },
      { name: 'Cheesy Stuffed Crust', extra: 250 },
      { name: 'Crown Crust Special', extra: 300 }
    ], 'crust', 'radio');
    modalDynamicOptions.appendChild(crustGroup);
    state.customization.crust = 'Pan Crust (Classic Fluffy)';

    // Option 3: Spice Flavor
    const flavorGroup = createOptionGroup('Signature Flavor Profile', [
      { name: 'Chicken Tikka Spicy', extra: 0, default: true },
      { name: 'Chicken Fajita Mild', extra: 0 },
      { name: 'Malai Tikka Creamy', extra: 50 },
      { name: 'Cheezious Special Blend', extra: 50 }
    ], 'flavor', 'radio');
    modalDynamicOptions.appendChild(flavorGroup);
    state.customization.flavor = 'Chicken Tikka Spicy';
  } else if (isBurger) {
    const sizeGroup = createOptionGroup('Select Patty Choice', [
      { name: 'Single Crispy Patty', extra: 0, default: true },
      { name: 'Double Patty Tower', extra: 280 }
    ], 'size', 'radio');
    modalDynamicOptions.appendChild(sizeGroup);
    state.customization.size = 'Single Crispy Patty';
  }

  // Drinks option for deals
  if (isDeal) {
    const drinkGroup = createOptionGroup('Choose Beverage', [
      { name: 'Pepsi (345ml)', extra: 0, default: true },
      { name: '7Up (345ml)', extra: 0 },
      { name: 'Mirinda (345ml)', extra: 0 },
      { name: 'Mountain Dew (345ml)', extra: 0 },
      { name: 'Diet Pepsi (Sugar Free)', extra: 0 }
    ], 'drink', 'radio');
    modalDynamicOptions.appendChild(drinkGroup);
    state.customization.drink = 'Pepsi (345ml)';
  }

  // Universal Addons
  const addonGroup = createOptionGroup('Extra Goodies & Dips', [
    { name: 'Extra Melted Cheese', extra: 150 },
    { name: 'Signature Cheezious Dip Sauce', extra: 70 },
    { name: 'Garlic Mayo Dip Sauce', extra: 70 },
    { name: 'Crispy Fries Regular', extra: 180 }
  ], 'addons', 'checkbox');
  modalDynamicOptions.appendChild(addonGroup);

  // Special Instructions
  const instWrap = document.createElement('div');
  instWrap.className = 'option-group special-instructions-wrap';
  instWrap.innerHTML = `
    <div class="option-group-title">Special Cooking Instructions</div>
    <textarea id="modalSpecialInstructions" placeholder="E.g., Less spicy, extra sauce, napkins please..."></textarea>
  `;
  modalDynamicOptions.appendChild(instWrap);

  updateModalTotalPrice();
  modalOverlay.classList.add('open');
}

function createOptionGroup(title, options, stateKey, type) {
  const group = document.createElement('div');
  group.className = 'option-group';
  
  const titleEl = document.createElement('div');
  titleEl.className = 'option-group-title';
  titleEl.innerHTML = `<span>${title}</span> ${type === 'radio' ? '<span class="option-required-badge">Required</span>' : '<span style="font-size:0.75rem; color:var(--text-muted);">Optional</span>'}`;
  group.appendChild(titleEl);

  const choicesEl = document.createElement('div');
  choicesEl.className = 'option-choices';

  options.forEach(opt => {
    const label = document.createElement('label');
    label.className = 'option-label';
    
    const isChecked = opt.default ? 'checked' : '';
    const extraText = opt.extra > 0 ? `+Rs. ${opt.extra}` : 'Included';

    label.innerHTML = `
      <div class="option-left">
        <input type="${type}" name="${stateKey}" value="${opt.name}" data-extra="${opt.extra}" ${isChecked}>
        <span>${opt.name}</span>
      </div>
      <span class="option-extra-price">${extraText}</span>
    `;

    const input = label.querySelector('input');
    input.addEventListener('change', () => {
      if (type === 'radio') {
        state.customization[stateKey] = opt.name;
      } else {
        // Checkbox addons
        const checkedAddons = [];
        choicesEl.querySelectorAll('input:checked').forEach(cb => {
          checkedAddons.push({ name: cb.value, extra: Number(cb.dataset.extra) });
        });
        state.customization.addons = checkedAddons;
      }
      updateModalTotalPrice();
    });

    choicesEl.appendChild(label);
  });

  group.appendChild(choicesEl);
  return group;
}

function updateModalTotalPrice() {
  if (!state.activeModalProduct) return;
  let base = state.activeModalProduct.price;

  // Extra for radio selections
  document.querySelectorAll('#modalDynamicOptions input[type="radio"]:checked').forEach(r => {
    base += Number(r.dataset.extra || 0);
  });

  // Extra for addons
  state.customization.addons.forEach(a => {
    base += a.extra;
  });

  state.customization.unitPrice = base;
  const total = base * state.customization.quantity;

  const btn = document.getElementById('modalAddOrderBtn');
  if (btn) {
    btn.innerHTML = `Add to Order • Rs. ${total.toLocaleString('en-PK')}`;
  }
}

function adjustModalQuantity(delta) {
  state.customization.quantity = Math.max(1, state.customization.quantity + delta);
  document.getElementById('modalStepperValue').textContent = state.customization.quantity;
  updateModalTotalPrice();
}

function closeProductModal() {
  const modalOverlay = document.getElementById('productModalOverlay');
  if (modalOverlay) modalOverlay.classList.remove('open');
  state.activeModalProduct = null;
}

// Add Item to Cart from Modal
function addCustomizedProductToCart() {
  if (!state.activeModalProduct) return;

  const instructionsEl = document.getElementById('modalSpecialInstructions');
  const instructions = instructionsEl ? instructionsEl.value.trim() : '';

  const cartItem = {
    cartItemId: Date.now().toString(),
    productId: state.activeModalProduct.id,
    name: state.activeModalProduct.name,
    image: state.activeModalProduct.image,
    unitPrice: state.customization.unitPrice,
    quantity: state.customization.quantity,
    size: state.customization.size,
    crust: state.customization.crust,
    flavor: state.customization.flavor,
    drink: state.customization.drink,
    addons: state.customization.addons,
    instructions: instructions
  };

  state.cart.push(cartItem);
  saveCartToStorage();
  updateCartUI();
  closeProductModal();
  openCartDrawer();
  showToast(`Added "${cartItem.name}" to cart!`);
}

// ==========================================================================
// CART & DRAWER MANAGEMENT
// ==========================================================================
function updateCartUI() {
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = state.cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

  // Top header button
  const badge = document.getElementById('cartHeaderBadge');
  const price = document.getElementById('cartHeaderPrice');
  if (badge) badge.textContent = count;
  if (price) price.textContent = `Rs. ${subtotal.toLocaleString('en-PK')}`;

  // Mobile nav badge
  const mobBadge = document.getElementById('mobileCartBadge');
  if (mobBadge) mobBadge.textContent = count;

  // Drawer Title Count
  const drawerCount = document.getElementById('cartDrawerCount');
  if (drawerCount) drawerCount.textContent = `(${count})`;

  renderCartItemsList(subtotal);
}

function renderCartItemsList(subtotal) {
  const list = document.getElementById('cartItemsList');
  const billSec = document.getElementById('cartBillSection');
  const voucherSec = document.getElementById('cartVoucherSection');
  if (!list) return;

  if (state.cart.length === 0) {
    list.innerHTML = `
      <div class="empty-cart-view">
        <div class="empty-cart-icon">🍕</div>
        <h3>Your Cart is Empty</h3>
        <p>Explore our menu and add your favorite Cheezious pizzas, burgers, and deals!</p>
        <button class="add-order-btn" onclick="closeCartDrawer()">Start Ordering</button>
      </div>
    `;
    if (billSec) billSec.style.display = 'none';
    if (voucherSec) voucherSec.style.display = 'none';
    return;
  }

  if (billSec) billSec.style.display = 'block';
  if (voucherSec) voucherSec.style.display = 'block';

  list.innerHTML = '';
  state.cart.forEach(item => {
    const row = document.createElement('div');
    row.className = 'cart-item-row';

    // Customization text
    const custParts = [];
    if (item.size) custParts.push(item.size);
    if (item.crust) custParts.push(item.crust);
    if (item.flavor) custParts.push(item.flavor);
    if (item.drink) custParts.push(item.drink);
    if (item.addons && item.addons.length) {
      custParts.push(item.addons.map(a => a.name).join(', '));
    }
    if (item.instructions) custParts.push(`"${item.instructions}"`);

    const custText = custParts.join(' • ');
    const lineTotal = item.unitPrice * item.quantity;

    row.innerHTML = `
      <img class="cart-item-img" src="${item.image}" alt="${item.name}" onerror="this.src='https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600'">
      <div class="cart-item-info">
        <h4 class="cart-item-name">${item.name}</h4>
        ${custText ? `<p class="cart-item-customizations">${custText}</p>` : ''}
        <div class="cart-item-price">Rs. ${lineTotal.toLocaleString('en-PK')}</div>
        <div class="cart-item-stepper">
          <button onclick="updateCartItemQty('${item.cartItemId}', -1)">-</button>
          <span>${item.quantity}</span>
          <button onclick="updateCartItemQty('${item.cartItemId}', 1)">+</button>
        </div>
      </div>
      <button class="cart-item-remove" onclick="removeCartItem('${item.cartItemId}')" title="Remove Item">✕</button>
    `;

    list.appendChild(row);
  });

  // Calculate fees & discounts
  const deliveryFee = state.orderMode === 'PICKUP' ? 0 : (subtotal > 2000 ? 0 : 100);
  let discount = 0;

  if (state.voucher) {
    if (state.voucher.type === 'percent') {
      discount = Math.round(subtotal * (state.voucher.value / 100));
    } else {
      discount = state.voucher.value;
    }
  }

  const grandTotal = Math.max(0, subtotal + deliveryFee - discount);

  // Update Bill UI
  document.getElementById('billSubtotal').textContent = `Rs. ${subtotal.toLocaleString('en-PK')}`;
  document.getElementById('billDeliveryFee').textContent = deliveryFee === 0 ? 'FREE' : `Rs. ${deliveryFee}`;
  
  const discountRow = document.getElementById('billDiscountRow');
  const discountVal = document.getElementById('billDiscountVal');
  if (state.voucher && discount > 0) {
    discountRow.style.display = 'flex';
    discountVal.textContent = `-Rs. ${discount.toLocaleString('en-PK')} (${state.voucher.code})`;
  } else {
    discountRow.style.display = 'none';
  }

  document.getElementById('billGrandTotal').textContent = `Rs. ${grandTotal.toLocaleString('en-PK')}`;
}

function updateCartItemQty(cartItemId, delta) {
  const item = state.cart.find(i => i.cartItemId === cartItemId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    removeCartItem(cartItemId);
    return;
  }
  saveCartToStorage();
  updateCartUI();
}

function removeCartItem(cartItemId) {
  state.cart = state.cart.filter(i => i.cartItemId !== cartItemId);
  saveCartToStorage();
  updateCartUI();
}

function openCartDrawer() {
  const drawerOverlay = document.getElementById('cartDrawerOverlay');
  if (drawerOverlay) drawerOverlay.classList.add('open');
}

function closeCartDrawer() {
  const drawerOverlay = document.getElementById('cartDrawerOverlay');
  if (drawerOverlay) drawerOverlay.classList.remove('open');
}

// Voucher Application
function applyVoucherCode() {
  const input = document.getElementById('voucherInput');
  const feedback = document.getElementById('voucherFeedback');
  if (!input || !feedback) return;

  const code = input.value.trim().toUpperCase();
  if (!code) {
    feedback.className = 'voucher-feedback error';
    feedback.textContent = 'Please enter a coupon code.';
    return;
  }

  if (VOUCHERS[code]) {
    state.voucher = { ...VOUCHERS[code], code };
    feedback.className = 'voucher-feedback success';
    feedback.textContent = `Applied: ${VOUCHERS[code].label}!`;
    updateCartUI();
  } else {
    feedback.className = 'voucher-feedback error';
    feedback.textContent = 'Invalid promo code. Try "CHEEZY10" for 10% off!';
  }
}

// ==========================================================================
// CHECKOUT & LIVE ORDER TRACKING
// ==========================================================================
function openCheckoutModal() {
  if (state.cart.length === 0) {
    showToast('Your cart is empty. Please add items before checking out.');
    return;
  }
  closeCartDrawer();
  const checkoutModal = document.getElementById('checkoutModalOverlay');
  if (checkoutModal) checkoutModal.classList.add('open');
}

function closeCheckoutModal() {
  const checkoutModal = document.getElementById('checkoutModalOverlay');
  if (checkoutModal) checkoutModal.classList.remove('open');
}

function handleCheckoutSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('custName').value.trim();
  const phone = document.getElementById('custPhone').value.trim();
  const address = document.getElementById('custAddress').value.trim();
  const landmark = document.getElementById('custLandmark').value.trim();
  const notes = document.getElementById('custNotes').value.trim();
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'COD';

  if (!name || !phone || (!address && state.orderMode === 'DELIVERY')) {
    alert('Please fill in all required fields.');
    return;
  }

  // Generate Order
  const orderId = 'CHZ-' + Math.floor(100000 + Math.random() * 900000);
  const orderItems = [...state.cart];
  const subtotal = orderItems.reduce((s, i) => s + (i.unitPrice * i.quantity), 0);
  const deliveryFee = state.orderMode === 'PICKUP' ? 0 : (subtotal > 2000 ? 0 : 100);
  let discount = 0;
  if (state.voucher) {
    discount = state.voucher.type === 'percent' ? Math.round(subtotal * (state.voucher.value / 100)) : state.voucher.value;
  }
  const total = Math.max(0, subtotal + deliveryFee - discount);

  // Clear Cart
  state.cart = [];
  state.voucher = null;
  saveCartToStorage();
  updateCartUI();
  closeCheckoutModal();

  // Show Order Confirmation & Tracking
  showOrderSuccessModal(orderId, name, phone, address, total, paymentMethod);
}

function showOrderSuccessModal(orderId, name, phone, address, total, paymentMethod) {
  const modal = document.getElementById('orderSuccessModalOverlay');
  document.getElementById('successOrderId').textContent = `#${orderId}`;
  document.getElementById('successCustName').textContent = name;
  document.getElementById('successTotal').textContent = `Rs. ${total.toLocaleString('en-PK')}`;
  document.getElementById('successPayment').textContent = paymentMethod === 'COD' ? 'Cash on Delivery' : paymentMethod;
  document.getElementById('successAddress').textContent = state.orderMode === 'DELIVERY' ? address : `Pick Up at ${state.selectedBranch?.name || 'Islamabad'}`;

  // Reset Stepper
  const steps = [
    document.getElementById('trackerStep1'),
    document.getElementById('trackerStep2'),
    document.getElementById('trackerStep3'),
    document.getElementById('trackerStep4')
  ];

  steps.forEach(s => {
    s.classList.remove('active', 'completed');
  });
  steps[0].classList.add('completed');
  steps[1].classList.add('active');

  modal.classList.add('open');

  // Simulated Live Order Progress
  setTimeout(() => {
    steps[1].classList.remove('active');
    steps[1].classList.add('completed');
    steps[2].classList.add('active');
  }, 4000);

  setTimeout(() => {
    steps[2].classList.remove('active');
    steps[2].classList.add('completed');
    steps[3].classList.add('completed');
  }, 8000);
}

function closeOrderSuccessModal() {
  const modal = document.getElementById('orderSuccessModalOverlay');
  if (modal) modal.classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================================================
// LOCATION & BRANCH FINDER MODAL
// ==========================================================================
function openLocationModal() {
  const modal = document.getElementById('locationModalOverlay');
  if (modal) modal.classList.add('open');
}

function closeLocationModal() {
  const modal = document.getElementById('locationModalOverlay');
  if (modal) modal.classList.remove('open');
}

function renderBranchesModal() {
  const cityBar = document.getElementById('modalCityBar');
  const branchList = document.getElementById('modalBranchesList');
  if (!cityBar || !branchList) return;

  cityBar.innerHTML = '';
  state.cities.forEach(city => {
    const pill = document.createElement('button');
    pill.className = `city-pill ${city === state.selectedCity ? 'active' : ''}`;
    pill.textContent = city;
    pill.onclick = () => {
      state.selectedCity = city;
      document.querySelectorAll('.city-pill').forEach(p => p.classList.toggle('active', p.textContent === city));
      filterBranchesByCity(city);
    };
    cityBar.appendChild(pill);
  });

  filterBranchesByCity(state.selectedCity);
}

function filterBranchesByCity(city) {
  const branchList = document.getElementById('modalBranchesList');
  if (!branchList) return;
  branchList.innerHTML = '';

  const cityBranches = state.branches.filter(b => b.city === city);
  if (!cityBranches.length) {
    branchList.innerHTML = `<p style="padding:20px; text-align:center; color:var(--text-muted);">No branches found for ${city}.</p>`;
    return;
  }

  cityBranches.forEach(b => {
    const card = document.createElement('div');
    card.className = 'branch-item-card';
    card.innerHTML = `
      <div>
        <h4 class="branch-name">${b.name}</h4>
        <p class="branch-addr">📍 ${b.address || b.name + ', ' + b.city}</p>
        <p class="branch-timing">🕒 ${b.timing} • 📞 ${b.phone}</p>
      </div>
      <button class="add-card-btn" style="background:var(--primary); color:#fff;">Select</button>
    `;

    card.onclick = () => {
      state.selectedBranch = b;
      saveCartToStorage();
      updateLocationDisplay();
      closeLocationModal();
      showToast(`Selected branch: ${b.name} (${b.city})`);
    };

    branchList.appendChild(card);
  });
}

// ==========================================================================
// SEARCH & EVENT LISTENERS
// ==========================================================================
function setupEventListeners() {
  // Search Input
  const searchInput = document.getElementById('headerSearchInput');
  const searchClear = document.getElementById('searchClearBtn');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      if (searchClear) searchClear.classList.toggle('visible', !!state.searchQuery);
      renderMenu();
    });
  }

  if (searchClear) {
    searchClear.addEventListener('click', clearSearch);
  }

  // Delivery / Takeaway Toggle
  const deliveryBtn = document.getElementById('deliveryModeBtn');
  const pickupBtn = document.getElementById('pickupModeBtn');
  if (deliveryBtn && pickupBtn) {
    deliveryBtn.onclick = () => {
      state.orderMode = 'DELIVERY';
      deliveryBtn.classList.add('active');
      pickupBtn.classList.remove('active');
      updateLocationDisplay();
      updateCartUI();
    };
    pickupBtn.onclick = () => {
      state.orderMode = 'PICKUP';
      pickupBtn.classList.add('active');
      deliveryBtn.classList.remove('active');
      updateLocationDisplay();
      updateCartUI();
    };
  }

  // Payment Method Selection in Checkout
  document.querySelectorAll('.payment-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.payment-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const radio = card.querySelector('input');
      if (radio) radio.checked = true;
    });
  });

  // Close modals on escape
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeProductModal();
      closeCartDrawer();
      closeCheckoutModal();
      closeLocationModal();
      closeOrderSuccessModal();
    }
  });
}

function clearSearch() {
  state.searchQuery = '';
  const searchInput = document.getElementById('headerSearchInput');
  if (searchInput) searchInput.value = '';
  const searchClear = document.getElementById('searchClearBtn');
  if (searchClear) searchClear.classList.remove('visible');
  renderMenu();
}

// Simple Toast Notification
function showToast(msg) {
  let toast = document.getElementById('cheeziousToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'cheeziousToast';
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #11141A;
      color: #FFFFFF;
      padding: 12px 22px;
      border-radius: 9999px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.25);
      font-size: 0.9rem;
      font-weight: 600;
      z-index: 999;
      display: flex;
      align-items: center;
      gap: 10px;
      border-left: 4px solid #F15B25;
      transform: translateY(100px);
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    `;
    document.body.appendChild(toast);
  }

  toast.textContent = msg;
  toast.style.transform = 'translateY(0)';
  toast.style.opacity = '1';

  setTimeout(() => {
    toast.style.transform = 'translateY(100px)';
    toast.style.opacity = '0';
  }, 3000);
}
