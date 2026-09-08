import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Cheezious PostgreSQL database...');

  const catalogPath = path.resolve(__dirname, '../../data/catalog.json');
  if (!fs.existsSync(catalogPath)) {
    console.error('catalog.json not found at', catalogPath);
    return;
  }

  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));

  // 1. Seed Categories
  console.log(`Seeding ${catalog.categories.length} categories...`);
  const catIdMap: Record<string, string> = {};

  for (const cat of catalog.categories) {
    const slug = cat.slug || cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const upserted = await prisma.category.upsert({
      where: { slug },
      update: {
        name: cat.name,
        image: cat.image || null,
      },
      create: {
        id: cat.id,
        name: cat.name,
        image: cat.image || null,
        slug,
      },
    });
    catIdMap[cat.id] = upserted.id;
  }

  // 2. Seed Branches
  console.log(`Seeding ${catalog.branches.length} branches...`);
  for (const b of catalog.branches) {
    await prisma.branch.upsert({
      where: { id: b.id },
      update: {
        name: b.name,
        city: b.city,
        address: b.address || b.name,
        phone: b.phone || '051-111-44-66-99',
        isOpen: b.isOpen ?? true,
        timing: b.timing || '11:00 AM - 03:00 AM',
      },
      create: {
        id: b.id,
        name: b.name,
        city: b.city,
        address: b.address || b.name,
        phone: b.phone || '051-111-44-66-99',
        isOpen: b.isOpen ?? true,
        timing: b.timing || '11:00 AM - 03:00 AM',
      },
    });
  }

  // 3. Seed Products
  console.log(`Seeding ${catalog.products.length} products...`);
  for (const p of catalog.products) {
    const primaryCatId = (p.categoryIds && p.categoryIds[0]) ? catIdMap[p.categoryIds[0]] : null;

    await prisma.product.upsert({
      where: { id: p.id },
      update: {
        name: p.name,
        description: p.description || '',
        price: p.price || 450,
        discountedPrice: p.discountedPrice || null,
        image: p.image,
        isBestSeller: p.isBestSeller || false,
        isDeal: p.isDeal || false,
        inStock: true,
        categoryId: primaryCatId || undefined,
      },
      create: {
        id: p.id,
        name: p.name,
        description: p.description || '',
        price: p.price || 450,
        discountedPrice: p.discountedPrice || null,
        image: p.image,
        isBestSeller: p.isBestSeller || false,
        isDeal: p.isDeal || false,
        inStock: true,
        categoryId: primaryCatId || undefined,
      },
    });
  }

  // 4. Seed Vouchers
  console.log('Seeding default promo vouchers...');
  const vouchers = [
    { code: 'CHEEZY10', discountType: 'PERCENT', discountValue: 10, minOrder: 0 },
    { code: 'WELCOME50', discountType: 'FLAT', discountValue: 50, minOrder: 500 },
    { code: 'SUPERCHEESE', discountType: 'PERCENT', discountValue: 15, minOrder: 1500 },
  ];

  for (const v of vouchers) {
    await prisma.voucher.upsert({
      where: { code: v.code },
      update: v,
      create: v,
    });
  }

  console.log('✅ PostgreSQL Database seeded successfully with authentic Cheezious catalog!');

  // 4. Seed Default User Accounts
  const bcrypt = await import('bcryptjs');
  const defaultUsers = [
    { name: 'Super Admin',   email: 'admin@cheezious.com',    password: 'Admin@123',    role: 'ADMIN'    as const, phone: '03001234567' },
    { name: 'Kitchen Staff', email: 'kitchen@cheezious.com',  password: 'Kitchen@123',  role: 'KITCHEN'  as const, phone: '03011234567' },
    { name: 'Delivery Rider',email: 'rider@cheezious.com',    password: 'Rider@123',    role: 'RIDER'    as const, phone: '03021234567' },
    { name: 'Test Customer', email: 'customer@cheezious.com', password: 'Customer@123', role: 'CUSTOMER' as const, phone: '03031234567' },
  ];

  for (const u of defaultUsers) {
    const hashed = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, phone: u.phone },
      create: { name: u.name, email: u.email, password: hashed, role: u.role, phone: u.phone },
    });
    console.log(`  👤 ${u.role}: ${u.email} / ${u.password}`);
  }
  console.log('✅ Default user accounts seeded!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
