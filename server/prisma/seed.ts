import { PrismaClient, UserRole, DiscountType, RiderStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Seeding White-Label Multi-Tenant Restaurant Platform...');

  // ==========================================================================
  // 1. SUPER ADMIN (PLATFORM OWNER)
  // ==========================================================================
  const superAdminPassword = await bcrypt.hash('SuperAdmin@123', 10);
  await prisma.user.upsert({
    where: { email: 'superadmin@platform.com' },
    update: {
      name: 'Platform Super Admin',
      role: UserRole.SUPER_ADMIN,
      tenantId: null,
    },
    create: {
      name: 'Platform Super Admin',
      email: 'superadmin@platform.com',
      password: superAdminPassword,
      role: UserRole.SUPER_ADMIN,
      phone: '03000000000',
      tenantId: null,
    },
  });
  console.log('👑 Platform Super Admin: superadmin@platform.com / SuperAdmin@123');

  // ==========================================================================
  // 2. TENANT 1: CHEEZIOUS
  // ==========================================================================
  console.log('\n🍕 Setting up Tenant 1: Cheezious...');
  const cheezious = await prisma.tenant.upsert({
    where: { slug: 'cheezious' },
    update: {
      name: 'Cheezious',
      currency: 'PKR',
      country: 'Pakistan',
      timezone: 'Asia/Karachi',
    },
    create: {
      name: 'Cheezious',
      slug: 'cheezious',
      currency: 'PKR',
      country: 'Pakistan',
      timezone: 'Asia/Karachi',
    },
  });

  // Cheezious Branding
  await prisma.tenantBranding.upsert({
    where: { tenantId: cheezious.id },
    update: {
      primaryColor: '#D80032',
      secondaryColor: '#FFE600',
      accentColor: '#1A1A1A',
      backgroundColor: '#FFFFFF',
      surfaceColor: '#FFFDF0',
      textColor: '#1A1A1A',
      mutedTextColor: '#71717A',
      logo: 'https://images.deliveryhero.io/image/fd-pk/LH/w3ws-listing.jpg',
      logoDark: 'https://images.deliveryhero.io/image/fd-pk/LH/w3ws-listing.jpg',
      buttonRadius: '8px',
      cardRadius: '14px',
    },
    create: {
      tenantId: cheezious.id,
      primaryColor: '#D80032',
      secondaryColor: '#FFE600',
      accentColor: '#1A1A1A',
      backgroundColor: '#FFFFFF',
      surfaceColor: '#FFFDF0',
      textColor: '#1A1A1A',
      mutedTextColor: '#71717A',
      logo: 'https://images.deliveryhero.io/image/fd-pk/LH/w3ws-listing.jpg',
      logoDark: 'https://images.deliveryhero.io/image/fd-pk/LH/w3ws-listing.jpg',
      buttonRadius: '8px',
      cardRadius: '14px',
    },
  });

  // Cheezious Settings
  await prisma.tenantSettings.upsert({
    where: { tenantId: cheezious.id },
    update: {
      currency: 'PKR',
      currencySymbol: 'Rs.',
      minimumOrder: 500,
      deliveryFee: 100,
      freeDeliveryThreshold: 2000,
      hotline: '051-111-44-66-99',
      phone: '051-111-44-66-99',
      whatsapp: '+923001234567',
      email: 'support@cheezious.com',
      deliveryEnabled: true,
      takeawayEnabled: true,
      cashOnDeliveryEnabled: true,
      riderTrackingEnabled: true,
    },
    create: {
      tenantId: cheezious.id,
      currency: 'PKR',
      currencySymbol: 'Rs.',
      minimumOrder: 500,
      deliveryFee: 100,
      freeDeliveryThreshold: 2000,
      hotline: '051-111-44-66-99',
      phone: '051-111-44-66-99',
      whatsapp: '+923001234567',
      email: 'support@cheezious.com',
      deliveryEnabled: true,
      takeawayEnabled: true,
      cashOnDeliveryEnabled: true,
      riderTrackingEnabled: true,
    },
  });

  // Cheezious Users
  const cheeziousUsers = [
    { name: 'Cheezious Admin', email: 'admin@cheezious.com', password: 'Admin@123', role: UserRole.TENANT_ADMIN },
    { name: 'Cheezious Kitchen', email: 'kitchen@cheezious.com', password: 'Kitchen@123', role: UserRole.KITCHEN_STAFF },
    { name: 'Cheezious Rider', email: 'rider@cheezious.com', password: 'Rider@123', role: UserRole.RIDER },
    { name: 'Cheezious Customer', email: 'customer@cheezious.com', password: 'Customer@123', role: UserRole.CUSTOMER },
    { name: 'Cheezious Branch Manager', email: 'manager@cheezious.com', password: 'Manager@123', role: UserRole.BRANCH_MANAGER },
  ];

  for (const u of cheeziousUsers) {
    const hashed = await bcrypt.hash(u.password, 10);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, tenantId: cheezious.id },
      create: { name: u.name, email: u.email, password: hashed, role: u.role, tenantId: cheezious.id },
    });

    if (u.role === UserRole.RIDER) {
      await prisma.rider.upsert({
        where: { userId: user.id },
        update: { tenantId: cheezious.id, isAvailable: true, status: RiderStatus.AVAILABLE },
        create: { tenantId: cheezious.id, userId: user.id, isAvailable: true, status: RiderStatus.AVAILABLE, vehicleType: 'Honda CD 70', vehicleNumber: 'ICT-4421' },
      });
    }
  }

  // Load catalog.json for Cheezious categories, branches, and products
  const catalogPath = path.resolve(__dirname, '../../data/catalog.json');
  if (fs.existsSync(catalogPath)) {
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));

    await prisma.productOptionGroup.deleteMany({ where: { tenantId: cheezious.id } });
    // Categories
    console.log(`Seeding ${catalog.categories.length} Cheezious categories...`);
    const catIdMap: Record<string, string> = {};
    for (const cat of catalog.categories) {
      const slug = cat.slug || cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const upserted = await prisma.category.upsert({
        where: { tenantId_slug: { tenantId: cheezious.id, slug } },
        update: { name: cat.name, image: cat.image || null },
        create: { tenantId: cheezious.id, name: cat.name, image: cat.image || null, slug },
      });
      catIdMap[cat.id] = upserted.id;
    }

    // Branches
    console.log(`Seeding ${catalog.branches.length} Cheezious branches...`);
    for (const b of catalog.branches) {
      await prisma.branch.upsert({
        where: { id: b.id },
        update: {
          tenantId: cheezious.id,
          name: b.name,
          city: b.city,
          address: b.address || b.name,
          phone: b.phone || '051-111-44-66-99',
          isOpen: b.isOpen ?? true,
          openingHours: b.timing || '11:00 AM - 03:00 AM',
        },
        create: {
          id: b.id,
          tenantId: cheezious.id,
          name: b.name,
          city: b.city,
          address: b.address || b.name,
          phone: b.phone || '051-111-44-66-99',
          isOpen: b.isOpen ?? true,
          openingHours: b.timing || '11:00 AM - 03:00 AM',
        },
      });
    }

    // Products
    console.log(`Seeding ${catalog.products.length} Cheezious products...`);
    let pizzaCount = 0;
    for (const p of catalog.products) {
      const primaryCatId = (p.categoryIds && p.categoryIds[0]) ? catIdMap[p.categoryIds[0]] : null;
      const slug = (p.name || p.id).toLowerCase().replace(/[^a-z0-9]+/g, '-');

      const product = await prisma.product.upsert({
        where: { tenantId_slug: { tenantId: cheezious.id, slug } },
        update: {
          name: p.name,
          description: p.description || '',
          basePrice: p.price || 450,
          discountedPrice: p.discountedPrice || null,
          image: p.image,
          isBestSeller: p.isBestSeller || false,
          isDeal: p.isDeal || false,
          isAvailable: true,
          categoryId: primaryCatId || undefined,
        },
        create: {
          tenantId: cheezious.id,
          name: p.name,
          slug,
          description: p.description || '',
          basePrice: p.price || 450,
          discountedPrice: p.discountedPrice || null,
          image: p.image,
          isBestSeller: p.isBestSeller || false,
          isDeal: p.isDeal || false,
          isAvailable: true,
          categoryId: primaryCatId || undefined,
        },
      });

      // Add generic option groups for first 5 pizza products to showcase customization engine!
      if (p.name.toLowerCase().includes('pizza') && pizzaCount < 5) {
        pizzaCount++;
        const sizeGroup = await prisma.productOptionGroup.create({
          data: {
            tenantId: cheezious.id,
            productId: product.id,
            name: 'Select Size',
            minSelect: 1,
            maxSelect: 1,
            isRequired: true,
            sortOrder: 1,
            options: {
              create: [
                { name: 'Small (6")', priceModifier: 0, isDefault: true, sortOrder: 1 },
                { name: 'Regular (9")', priceModifier: 450, sortOrder: 2 },
                { name: 'Large (12")', priceModifier: 950, sortOrder: 3 },
                { name: 'Jumbo (14")', priceModifier: 1450, sortOrder: 4 },
              ],
            },
          },
        });

        const crustGroup = await prisma.productOptionGroup.create({
          data: {
            tenantId: cheezious.id,
            productId: product.id,
            name: 'Choose Crust',
            minSelect: 1,
            maxSelect: 1,
            isRequired: true,
            sortOrder: 2,
            options: {
              create: [
                { name: 'Deep Pan Crust', priceModifier: 0, isDefault: true, sortOrder: 1 },
                { name: 'Thin & Crispy', priceModifier: 0, sortOrder: 2 },
                { name: 'Cheesy Stuffed Crust', priceModifier: 250, sortOrder: 3 },
                { name: 'Crown Crust Kabab', priceModifier: 350, sortOrder: 4 },
              ],
            },
          },
        });

        const extrasGroup = await prisma.productOptionGroup.create({
          data: {
            tenantId: cheezious.id,
            productId: product.id,
            name: 'Extra Toppings',
            minSelect: 0,
            maxSelect: 4,
            isRequired: false,
            sortOrder: 3,
            options: {
              create: [
                { name: 'Extra Mozzarella Cheese', priceModifier: 150, sortOrder: 1 },
                { name: 'Sliced Black Olives', priceModifier: 80, sortOrder: 2 },
                { name: 'Spicy Jalapeños', priceModifier: 80, sortOrder: 3 },
                { name: 'Garlic Mayo Dip Sauce', priceModifier: 90, sortOrder: 4 },
              ],
            },
          },
        });
      }
    }
  }

  // Cheezious Vouchers
  const cheeziousVouchers = [
    { code: 'CHEEZY10', discountType: DiscountType.PERCENT, discountValue: 10, minimumOrder: 0 },
    { code: 'WELCOME50', discountType: DiscountType.FIXED, discountValue: 50, minimumOrder: 500 },
    { code: 'SUPERCHEESE', discountType: DiscountType.PERCENT, discountValue: 15, minimumOrder: 1500 },
  ];
  for (const v of cheeziousVouchers) {
    await prisma.voucher.upsert({
      where: { tenantId_code: { tenantId: cheezious.id, code: v.code } },
      update: v,
      create: { tenantId: cheezious.id, ...v },
    });
  }

  await prisma.banner.deleteMany({ where: { tenantId: cheezious.id } });
  // Cheezious Banners
  await prisma.banner.create({
    data: {
      tenantId: cheezious.id,
      title: 'Cheeziest Deals in Town',
      subtitle: 'Flat 20% off on all Large & Jumbo Pizzas every Friday!',
      desktopImage: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1200',
      buttonText: 'Order Now',
      buttonUrl: '/menu',
      sortOrder: 1,
    },
  });

  // ==========================================================================
  // 3. TENANT 2: SAVOUR FOODS (PROVING 100% WHITE-LABELING!)
  // ==========================================================================
  console.log('\n🍗 Setting up Tenant 2: Savour Foods (White-Label Tenant)...');
  const savour = await prisma.tenant.upsert({
    where: { slug: 'savour-foods' },
    update: {
      name: 'Savour Foods',
      currency: 'PKR',
      country: 'Pakistan',
      timezone: 'Asia/Karachi',
    },
    create: {
      name: 'Savour Foods',
      slug: 'savour-foods',
      currency: 'PKR',
      country: 'Pakistan',
      timezone: 'Asia/Karachi',
    },
  });

  // Savour Foods Branding (Green & Gold theme!)
  await prisma.tenantBranding.upsert({
    where: { tenantId: savour.id },
    update: {
      primaryColor: '#0B6E4F',      // Emerald Green
      secondaryColor: '#D4AF37',    // Royal Gold
      accentColor: '#1A3326',
      backgroundColor: '#FFFFFF',
      surfaceColor: '#F0FDF4',      // Soft mint surface
      textColor: '#0F172A',
      mutedTextColor: '#64748B',
      logo: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300',
      logoDark: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300',
      buttonRadius: '6px',
      cardRadius: '16px',
    },
    create: {
      tenantId: savour.id,
      primaryColor: '#0B6E4F',
      secondaryColor: '#D4AF37',
      accentColor: '#1A3326',
      backgroundColor: '#FFFFFF',
      surfaceColor: '#F0FDF4',
      textColor: '#0F172A',
      mutedTextColor: '#64748B',
      logo: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300',
      logoDark: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300',
      buttonRadius: '6px',
      cardRadius: '16px',
    },
  });

  // Savour Foods Settings
  await prisma.tenantSettings.upsert({
    where: { tenantId: savour.id },
    update: {
      currency: 'PKR',
      currencySymbol: 'Rs.',
      minimumOrder: 300,
      deliveryFee: 80,
      freeDeliveryThreshold: 1500,
      hotline: '051-111-72-86-87',
      phone: '051-111-72-86-87',
      whatsapp: '+923007654321',
      email: 'orders@savourfoods.com',
      deliveryEnabled: true,
      takeawayEnabled: true,
      cashOnDeliveryEnabled: true,
      riderTrackingEnabled: true,
    },
    create: {
      tenantId: savour.id,
      currency: 'PKR',
      currencySymbol: 'Rs.',
      minimumOrder: 300,
      deliveryFee: 80,
      freeDeliveryThreshold: 1500,
      hotline: '051-111-72-86-87',
      phone: '051-111-72-86-87',
      whatsapp: '+923007654321',
      email: 'orders@savourfoods.com',
      deliveryEnabled: true,
      takeawayEnabled: true,
      cashOnDeliveryEnabled: true,
      riderTrackingEnabled: true,
    },
  });

  // Savour Users
  const savourUsers = [
    { name: 'Savour Admin', email: 'admin@savour.com', password: 'Admin@123', role: UserRole.TENANT_ADMIN },
    { name: 'Savour Kitchen', email: 'kitchen@savour.com', password: 'Kitchen@123', role: UserRole.KITCHEN_STAFF },
    { name: 'Savour Rider', email: 'rider@savour.com', password: 'Rider@123', role: UserRole.RIDER },
    { name: 'Savour Customer', email: 'customer@savour.com', password: 'Customer@123', role: UserRole.CUSTOMER },
  ];

  for (const u of savourUsers) {
    const hashed = await bcrypt.hash(u.password, 10);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, tenantId: savour.id },
      create: { name: u.name, email: u.email, password: hashed, role: u.role, tenantId: savour.id },
    });

    if (u.role === UserRole.RIDER) {
      await prisma.rider.upsert({
        where: { userId: user.id },
        update: { tenantId: savour.id, isAvailable: true, status: RiderStatus.AVAILABLE },
        create: { tenantId: savour.id, userId: user.id, isAvailable: true, status: RiderStatus.AVAILABLE, vehicleType: 'Yamaha YBR 125', vehicleNumber: 'RWP-9022' },
      });
    }
  }

  await prisma.productOptionGroup.deleteMany({ where: { tenantId: savour.id } });
  await prisma.banner.deleteMany({ where: { tenantId: savour.id } });
  // Savour Branches
  const savourBranches = [
    { name: 'Blue Area Branch', city: 'Islamabad', address: 'Block H, Commercial Area, Blue Area, Islamabad', phone: '051-2828282' },
    { name: 'Gordon College Road', city: 'Rawalpindi', address: 'Gordon College Road, Liaquat Bagh, Rawalpindi', phone: '051-5555555' },
    { name: 'Peshawar Road Branch', city: 'Rawalpindi', address: 'Main Peshawar Road, Near Charing Cross, Rawalpindi', phone: '051-5464646' },
  ];
  for (const b of savourBranches) {
    const existingBranch = await prisma.branch.findFirst({ where: { tenantId: savour.id, name: b.name } });
    if (existingBranch) continue;
    await prisma.branch.create({
      data: {
        tenantId: savour.id,
        name: b.name,
        city: b.city,
        address: b.address,
        phone: b.phone,
        isOpen: true,
        openingHours: '11:00 AM - 12:00 AM',
        deliveryFee: 80,
        minimumOrder: 300,
      },
    });
  }

  // Savour Categories
  const savourCats = [
    { name: 'Traditional Pulao', slug: 'traditional-pulao', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600' },
    { name: 'Roasts & Steam', slug: 'roasts-steam', image: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=600' },
    { name: 'Traditional Desserts', slug: 'traditional-desserts', image: 'https://images.unsplash.com/photo-1579372786545-d24232daf58c?w=600' },
    { name: 'Beverages & Sides', slug: 'beverages-sides', image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600' },
  ];

  const savourCatMap: Record<string, string> = {};
  for (const c of savourCats) {
    const cat = await prisma.category.upsert({
      where: { tenantId_slug: { tenantId: savour.id, slug: c.slug } },
      update: { name: c.name, image: c.image },
      create: { tenantId: savour.id, name: c.name, slug: c.slug, image: c.image },
    });
    savourCatMap[c.slug] = cat.id;
  }

  // Savour Products with generic option groups
  const savourProducts = [
    {
      name: 'Special Chicken Pulao with Kabab',
      slug: 'special-chicken-pulao',
      description: 'Fragrant basmati rice cooked in rich chicken stock, served with tender chicken piece, Shami kabab, fresh raita and salad.',
      basePrice: 450,
      image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600',
      isBestSeller: true,
      categoryId: savourCatMap['traditional-pulao'],
    },
    {
      name: 'Double Chicken Pulao (2 Shami Kababs)',
      slug: 'double-chicken-pulao',
      description: 'Generous serving of aromatic pulao with 2 succulent chicken pieces and 2 classic Shami kababs.',
      basePrice: 620,
      image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600',
      isBestSeller: true,
      categoryId: savourCatMap['traditional-pulao'],
    },
    {
      name: 'Crispy Quarter Chicken Roast',
      slug: 'crispy-quarter-roast',
      description: 'Golden fried crispy quarter chicken marinated in traditional Pakistani spices.',
      basePrice: 380,
      image: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=600',
      isDeal: true,
      categoryId: savourCatMap['roasts-steam'],
    },
    {
      name: 'Full Steam Roast Chicken',
      slug: 'full-steam-roast',
      description: 'Full whole chicken steam-cooked to perfection with tender aromatic spices.',
      basePrice: 1350,
      image: 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=600',
      isFeatured: true,
      categoryId: savourCatMap['roasts-steam'],
    },
    {
      name: 'Traditional Zarda Sweet Rice',
      slug: 'traditional-zarda',
      description: 'Authentic festive sweet basmati rice garnished with silver vark, raisins, almonds and coconut.',
      basePrice: 220,
      image: 'https://images.unsplash.com/photo-1579372786545-d24232daf58c?w=600',
      categoryId: savourCatMap['traditional-desserts'],
    },
    {
      name: 'Special Kheer Thali',
      slug: 'special-kheer-thali',
      description: 'Slow-cooked creamy rice pudding enriched with condensed milk, cardamom, and roasted pistachios.',
      basePrice: 180,
      categoryId: savourCatMap['traditional-desserts'],
      image: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=600',
    },
    {
      name: 'Fresh Zeera Mint Raita',
      slug: 'fresh-mint-raita',
      description: 'Chilled yogurt tempered with roasted cumin, fresh garden mint, and black salt.',
      basePrice: 70,
      categoryId: savourCatMap['beverages-sides'],
      image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600',
    },
  ];

  for (const p of savourProducts) {
    const prod = await prisma.product.upsert({
      where: { tenantId_slug: { tenantId: savour.id, slug: p.slug } },
      update: {
        name: p.name,
        description: p.description,
        basePrice: p.basePrice,
        image: p.image,
        isBestSeller: p.isBestSeller || false,
        isDeal: p.isDeal || false,
        isFeatured: p.isFeatured || false,
        categoryId: p.categoryId,
      },
      create: {
        tenantId: savour.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        basePrice: p.basePrice,
        image: p.image,
        isBestSeller: p.isBestSeller || false,
        isDeal: p.isDeal || false,
        isFeatured: p.isFeatured || false,
        categoryId: p.categoryId,
      },
    });

    // Add generic option groups for Savour Pulao (demonstrating customizer isn't hardcoded to pizza!)
    if (p.slug.includes('pulao')) {
      await prisma.productOptionGroup.create({
        data: {
          tenantId: savour.id,
          productId: prod.id,
          name: 'Portion Size',
          minSelect: 1,
          maxSelect: 1,
          isRequired: true,
          sortOrder: 1,
          options: {
            create: [
              { name: 'Standard Single Plate', priceModifier: 0, isDefault: true, sortOrder: 1 },
              { name: 'Large Double Plate', priceModifier: 170, sortOrder: 2 },
            ],
          },
        },
      });

      await prisma.productOptionGroup.create({
        data: {
          tenantId: savour.id,
          productId: prod.id,
          name: 'Piece Preference',
          minSelect: 1,
          maxSelect: 1,
          isRequired: true,
          sortOrder: 2,
          options: {
            create: [
              { name: 'Leg Piece', priceModifier: 0, isDefault: true, sortOrder: 1 },
              { name: 'Breast Piece', priceModifier: 30, sortOrder: 2 },
            ],
          },
        },
      });

      await prisma.productOptionGroup.create({
        data: {
          tenantId: savour.id,
          productId: prod.id,
          name: 'Add-ons & Extras',
          minSelect: 0,
          maxSelect: 3,
          isRequired: false,
          sortOrder: 3,
          options: {
            create: [
              { name: 'Extra Shami Kabab', priceModifier: 110, sortOrder: 1 },
              { name: 'Extra Zeera Raita', priceModifier: 70, sortOrder: 2 },
              { name: 'Extra Fresh Salad', priceModifier: 60, sortOrder: 3 },
            ],
          },
        },
      });
    }
  }

  // Savour Vouchers
  await prisma.voucher.upsert({
    where: { tenantId_code: { tenantId: savour.id, code: 'SAVOUR10' } },
    update: {},
    create: {
      tenantId: savour.id,
      code: 'SAVOUR10',
      discountType: DiscountType.PERCENT,
      discountValue: 10,
      minimumOrder: 500,
    },
  });

  // Savour Banner
  await prisma.banner.create({
    data: {
      tenantId: savour.id,
      title: 'Traditional Pulao Kabab',
      subtitle: 'The original and authentic taste of Rawalpindi & Islamabad delivered to your doorstep.',
      desktopImage: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=1200',
      buttonText: 'Order Pulao Now',
      buttonUrl: '/menu',
      sortOrder: 1,
    },
  });

  // Local demo staff have explicit branch memberships; authorization never infers them.
  for (const tenantId of [cheezious.id, savour.id]) {
    const branch = await prisma.branch.findFirst({ where: { tenantId }, orderBy: { name: 'asc' } });
    if (branch) {
      const staff = await prisma.user.findMany({ where: { tenantId, role: { in: ['KITCHEN_STAFF', 'KITCHEN_MANAGER', 'BRANCH_MANAGER'] } } });
      for (const u of staff) await prisma.branchStaff.upsert({ where: { branchId_userId: { branchId: branch.id, userId: u.id } }, update: { role: u.role }, create: { branchId: branch.id, userId: u.id, role: u.role } });
    }
  }
  console.log('\n================================================================');
  console.log('🎉 Multi-Tenant Seed Finished Successfully!');
  console.log('================================================================');
  console.log('1. SUPER ADMIN (Platform Owner):');
  console.log('   Email: superadmin@platform.com  |  Password: SuperAdmin@123');
  console.log('\n2. CHEEZIOUS (Tenant: cheezious - Red/Yellow):');
  console.log('   Admin:    admin@cheezious.com    |  Admin@123');
  console.log('   Kitchen:  kitchen@cheezious.com  |  Kitchen@123');
  console.log('   Rider:    rider@cheezious.com    |  Rider@123');
  console.log('   Customer: customer@cheezious.com |  Customer@123');
  console.log('\n3. SAVOUR FOODS (Tenant: savour-foods - Green/Gold):');
  console.log('   Admin:    admin@savour.com       |  Admin@123');
  console.log('   Kitchen:  kitchen@savour.com     |  Kitchen@123');
  console.log('   Rider:    rider@savour.com       |  Rider@123');
  console.log('   Customer: customer@savour.com    |  Customer@123');
  console.log('================================================================\n');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
