import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';

export interface CartItemInput {
  productId: string;
  quantity: number;
  optionIds?: string[];
  addons?: string[];
  instructions?: string;
}

export interface PricingCalculationResult {
  subtotal: number;
  discount: number;
  tax: number;
  deliveryFee: number;
  total: number;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    size?: string;
    variant?: string;
    addons?: string;
    instructions?: string;
    optionsJson: string;
  }>;
  voucher?: {
    code: string;
    discountType: string;
    discountValue: number;
    discountAmount: number;
  };
}

export async function calculateOrderPricing(
  tenantId: string,
  items: CartItemInput[],
  branchId?: string,
  orderMode: 'DELIVERY' | 'TAKEAWAY' | 'DINE_IN' = 'DELIVERY',
  voucherCode?: string,
  db: Prisma.TransactionClient = prisma
): Promise<PricingCalculationResult> {
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
    throw new Error('Cart cannot be empty');
  }

  // 1. Fetch tenant settings & branch
  const tenantSettings = await db.tenantSettings.findUnique({
    where: { tenantId },
  });

  const branch = branchId
    ? await db.branch.findFirst({ where: { id: branchId, tenantId } })
    : null;

  if (!branch || !branch.isOpen) throw new Error('Select an open branch in this restaurant');
  if (!['DELIVERY', 'TAKEAWAY', 'DINE_IN'].includes(orderMode)) throw new Error('Invalid order mode');
  if (orderMode === 'DINE_IN') throw new Error('Dine-in ordering is not available yet');
  if ((orderMode === 'DELIVERY' && tenantSettings?.deliveryEnabled === false) || (orderMode === 'TAKEAWAY' && tenantSettings?.takeawayEnabled === false)) throw new Error('This order mode is disabled');
  // 2. Authoritatively resolve every product and option from database
  let subtotal = 0;
  const processedItems = [];

  for (const item of items) {
    if (!item || typeof item.productId !== 'string' || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) throw new Error('Quantity must be an integer between 1 and 99');
    const quantity = item.quantity;
    const product = await db.product.findFirst({
      where: { id: item.productId, tenantId },
      include: { optionGroups: { include: { options: true } } },
    });

    if (!product) {
      throw new Error(`Product with ID "${item.productId}" does not exist in this restaurant catalog`);
    }

    if (!product.isAvailable) {
      throw new Error(`Product "${product.name}" is currently out of stock`);
    }

    const basePrice = product.discountedPrice ?? product.basePrice;
    let optionPriceModifier = 0;
    const selectedOptionsDetails: Array<{ id: string; name: string; priceModifier: number }> = [];

    const ids = item.optionIds ?? [];
    if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) throw new Error('Invalid option selection');
    const available = product.optionGroups.flatMap(g => g.options);
    if (ids.some(id => !available.some(opt => opt.id === id))) throw new Error('Option does not belong to this product');
    for (const group of product.optionGroups) {
      if (group.tenantId !== tenantId) throw new Error('Invalid product configuration');
      const selected = group.options.filter(opt => ids.includes(opt.id));
      if (selected.length < Math.max(group.minSelect, group.isRequired ? 1 : 0) || selected.length > group.maxSelect) throw new Error(`Select ${group.minSelect}-${group.maxSelect} options for ${group.name}`);
      for (const opt of selected) {
        optionPriceModifier += opt.priceModifier;
        selectedOptionsDetails.push({ id: opt.id, name: `${group.name}: ${opt.name}`, priceModifier: opt.priceModifier });
      }
    }

    const unitPrice = Math.max(0, basePrice + optionPriceModifier);
    const totalPrice = unitPrice * quantity;
    subtotal += totalPrice;

    // Detect size / variant names from options for easy display
    const sizeOpt = selectedOptionsDetails.find(o => o.name.toLowerCase().includes('size') || o.name.toLowerCase().includes('portion'));
    const crustOpt = selectedOptionsDetails.find(o => o.name.toLowerCase().includes('crust') || o.name.toLowerCase().includes('piece'));

    processedItems.push({
      productId: product.id,
      productName: product.name,
      quantity,
      unitPrice,
      totalPrice,
      size: sizeOpt?.name,
      variant: crustOpt?.name,

      instructions: item.instructions || undefined,
      optionsJson: JSON.stringify(selectedOptionsDetails),
    });
  }

  // 3. Minimum order validation
  const minOrder = branch?.minimumOrder ?? tenantSettings?.minimumOrder ?? 0;
  if (subtotal < minOrder) {
    throw new Error(`Minimum order amount of ${tenantSettings?.currencySymbol || ""} ${minOrder} required (current subtotal: ${subtotal})`);
  }

  // 4. Delivery fee calculation
  let deliveryFee = 0;
  if (orderMode === 'DELIVERY') {
    const freeThreshold = tenantSettings?.freeDeliveryThreshold ?? 2000;
    const defaultFee = branch?.deliveryFee ?? tenantSettings?.deliveryFee ?? 100;
    deliveryFee = subtotal >= freeThreshold ? 0 : defaultFee;
  }

  // 5. Authoritative Voucher calculation
  let discount = 0;
  let voucherData = undefined;

  if (voucherCode) {
    const voucher = await db.voucher.findFirst({
      where: {
        tenantId,
        code: String(voucherCode).trim().toUpperCase(),
        isActive: true,
      },
    });

    if (!voucher) throw new Error('Invalid voucher');
    if (voucher) {
      const now = new Date();
      const isStarted = !voucher.startDate || voucher.startDate <= now;
      const isNotExpired = !voucher.endDate || voucher.endDate >= now;
      const meetsMinOrder = subtotal >= voucher.minimumOrder;

      if (!isStarted || !isNotExpired || !meetsMinOrder) throw new Error('Voucher is expired, not started, or minimum order is not met');
      if (voucher.usageLimit !== null) throw new Error('Usage-limited vouchers are not supported yet');
      if (isStarted && isNotExpired && meetsMinOrder) {
        if (voucher.discountType === 'PERCENT') {
          discount = Math.round((subtotal * voucher.discountValue) / 100);
        } else if (voucher.discountType === 'FIXED') {
          discount = voucher.discountValue;
        } else if (voucher.discountType === 'FREE_DELIVERY') {
          deliveryFee = Math.max(0, deliveryFee - (voucher.maximumDiscount ?? deliveryFee));
        }

        if (voucher.maximumDiscount !== null && discount > voucher.maximumDiscount) {
          discount = voucher.maximumDiscount;
        }

        discount = Math.min(discount, subtotal);

        voucherData = {
          code: voucher.code,
          discountType: voucher.discountType,
          discountValue: voucher.discountValue,
          discountAmount: discount,
        };
      }
    }
  }

  // 6. Tax calculation
  let tax = 0;
  if (tenantSettings?.taxEnabled && tenantSettings.taxRate > 0) {
    tax = Math.round((subtotal - discount) * (tenantSettings.taxRate / 100));
  }

  // 7. Authoritative Total
  const total = Math.max(0, subtotal - discount + deliveryFee + tax);
  if (!Number.isFinite(total)) throw new Error('Invalid price configuration');

  return {
    subtotal,
    discount,
    tax,
    deliveryFee,
    total,
    items: processedItems,
    voucher: voucherData,
  };
}
