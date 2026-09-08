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
  voucherCode?: string
): Promise<PricingCalculationResult> {
  if (!items || items.length === 0) {
    throw new Error('Cart cannot be empty');
  }

  // 1. Fetch tenant settings & branch
  const tenantSettings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
  });

  const branch = branchId
    ? await prisma.branch.findFirst({ where: { id: branchId, tenantId } })
    : null;

  // 2. Authoritatively resolve every product and option from database
  let subtotal = 0;
  const processedItems = [];

  for (const item of items) {
    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const product = await prisma.product.findFirst({
      where: { id: item.productId, tenantId },
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

    if (item.optionIds && item.optionIds.length > 0) {
      const options = await prisma.productOption.findMany({
        where: { id: { in: item.optionIds } },
        include: { group: true },
      });

      for (const opt of options) {
        // Verify option belongs to this tenant
        if (opt.group.tenantId === tenantId) {
          optionPriceModifier += opt.priceModifier;
          selectedOptionsDetails.push({
            id: opt.id,
            name: `${opt.group.name}: ${opt.name}`,
            priceModifier: opt.priceModifier,
          });
        }
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
      addons: item.addons ? item.addons.join(', ') : undefined,
      instructions: item.instructions || undefined,
      optionsJson: JSON.stringify(selectedOptionsDetails),
    });
  }

  // 3. Minimum order validation
  const minOrder = branch?.minimumOrder ?? tenantSettings?.minimumOrder ?? 0;
  if (subtotal < minOrder) {
    throw new Error(`Minimum order amount of Rs. ${minOrder} required (current subtotal: Rs. ${subtotal})`);
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
    const voucher = await prisma.voucher.findFirst({
      where: {
        tenantId,
        code: voucherCode.toUpperCase(),
        isActive: true,
      },
    });

    if (voucher) {
      const now = new Date();
      const isStarted = !voucher.startDate || voucher.startDate <= now;
      const isNotExpired = !voucher.endDate || voucher.endDate >= now;
      const meetsMinOrder = subtotal >= voucher.minimumOrder;

      if (isStarted && isNotExpired && meetsMinOrder) {
        if (voucher.discountType === 'PERCENT') {
          discount = Math.round((subtotal * voucher.discountValue) / 100);
        } else if (voucher.discountType === 'FIXED') {
          discount = voucher.discountValue;
        } else if (voucher.discountType === 'FREE_DELIVERY') {
          discount = deliveryFee;
          deliveryFee = 0;
        }

        if (voucher.maximumDiscount && discount > voucher.maximumDiscount) {
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
