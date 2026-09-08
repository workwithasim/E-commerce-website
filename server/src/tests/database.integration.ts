import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
const db = new PrismaClient();
const base = 'http://127.0.0.1:5000/api/v1';
const slug = `verify-${randomUUID()}`;
let tenantId: string | undefined;
async function request(path: string, token?: string, method = 'GET', body?: any) {
  const res = await fetch(base + path, { method, headers: { 'Content-Type':'application/json', 'x-tenant-slug':slug, ...(token ? {Authorization:`Bearer ${token}`} : {}) }, body: body ? JSON.stringify(body) : undefined });
  return {status:res.status,json:await res.json() as any};
}
async function main() {
  try {
    const tenant = await db.tenant.create({data:{slug,name:'Temporary verification restaurant',branding:{create:{logo:''}},settings:{create:{minimumOrder:0,deliveryFee:100,freeDeliveryThreshold:2000,taxEnabled:true,taxRate:10}}}});
    tenantId=tenant.id;
    const branch=await db.branch.create({data:{tenantId,name:'Test branch',city:'Test',address:'Test address',phone:'0000000000',minimumOrder:0,deliveryFee:100}});
    const password=await bcrypt.hash('TemporaryPassword123',10);
    const users:any={};
    for (const role of ['TENANT_ADMIN','CUSTOMER','RIDER','KITCHEN_STAFF'] as const) {
      const email=`${role.toLowerCase()}-${slug}@example.test`;
      const user=await db.user.create({data:{tenantId,role,email,name:role,password}});
      if(role==='RIDER') users.rider=await db.rider.create({data:{tenantId,userId:user.id}});
      if(role==='KITCHEN_STAFF') await db.branchStaff.create({data:{userId:user.id,branchId:branch.id,role}});
      const login=await request('/auth/login',undefined,'POST',{email,password:'TemporaryPassword123'});
      assert.equal(login.status,200,JSON.stringify(login.json)); users[role]=login.json.data.token;
    }
    const product=await db.product.create({data:{tenantId,name:'Test meal',slug:'meal',basePrice:500,image:'',optionGroups:{create:{tenantId,name:'Size',minSelect:1,maxSelect:1,isRequired:true,options:{create:{name:'Large',priceModifier:100}}}}},include:{optionGroups:{include:{options:true}}}});
    await db.voucher.create({data:{tenantId,code:'TEN',discountType:'PERCENT',discountValue:10,minimumOrder:0}});
    const payload={branchId:branch.id,orderMode:'DELIVERY',voucherCode:'TEN',items:[{productId:product.id,quantity:2,optionIds:[product.optionGroups[0].options[0].id]}]};
    assert.equal((await request('/orders')).status,401);
    const quote=await request('/orders/quote',users.CUSTOMER,'POST',payload);
    assert.equal(quote.status,200,JSON.stringify(quote.json)); assert.equal(quote.json.data.total,1288);
    const placed=await request('/orders',users.CUSTOMER,'POST',{...payload,customerName:'Verification customer',customerPhone:'0000000000',deliveryAddress:'Test only',paymentMethod:'COD',total:1});
    assert.equal(placed.status,201,JSON.stringify(placed.json)); assert.equal(placed.json.data.total,1288);
    const id=placed.json.data.id;
    const saved=await db.order.findUniqueOrThrow({where:{id},include:{items:true}});
    assert.match(saved.items[0].optionsJson!,/Large/);
    assert.equal((await request(`/orders/${id}/status`,users.CUSTOMER,'PATCH',{status:'DELIVERED'})).status,403);
    for(const status of ['PREPARING','READY']) assert.equal((await request(`/orders/${id}/status`,users.KITCHEN_STAFF,'PATCH',{status})).status,200);
    const assigned=await request('/deliveries/assign',users.TENANT_ADMIN,'POST',{orderId:id,riderId:users.rider.id});
    assert.equal(assigned.status,200,JSON.stringify(assigned.json)); const deliveryId=assigned.json.data.id;
    assert.equal((await request('/deliveries/assigned',users.RIDER)).json.data.length,1);
    for(const status of ['ACCEPTED','PICKED_UP','ON_THE_WAY']) assert.equal((await request(`/deliveries/${deliveryId}/status`,users.RIDER,'PATCH',{status})).status,200);
    assert.equal((await request(`/deliveries/${deliveryId}/location`,users.RIDER,'POST',{latitude:33.68,longitude:73.04})).status,200);
    assert.equal((await request(`/deliveries/${deliveryId}/location`,users.CUSTOMER,'POST',{latitude:33.68,longitude:73.04})).status,403);
    assert.equal((await request(`/deliveries/${deliveryId}/status`,users.RIDER,'PATCH',{status:'DELIVERED'})).status,200);
    const finished=await request(`/orders/${id}`,users.CUSTOMER);
    assert.equal(finished.json.data.status,'DELIVERED'); assert.equal(finished.json.data.delivery.status,'DELIVERED'); assert.equal(finished.json.data.statusHistory.length,7);
    assert.equal(JSON.stringify(finished.json).includes('password'),false);
    const outsider=await db.user.create({data:{tenantId,name:'Other customer',email:`other-${slug}@example.test`,password,role:'CUSTOMER'}});
    const other=await request('/auth/login',undefined,'POST',{email:outsider.email,password:'TemporaryPassword123'});
    assert.equal((await request(`/orders/${id}`,other.json.data.token)).status,404);
    assert.equal((await request('/orders',other.json.data.token)).json.data.length,0);
    const cross=await fetch(base+'/orders',{headers:{'x-tenant-slug':'cheezious',Authorization:`Bearer ${users.CUSTOMER}`}});
    assert.equal(cross.status,403);
    console.log('PASS: database-backed quote, voucher, tax, checkout, kitchen, assignment, GPS, delivery, history, ownership and cross-tenant rejection.');
  } finally {
    if(tenantId) { await db.auditLog.deleteMany({where:{tenantId}}); await db.tenant.delete({where:{id:tenantId}}); console.log('Temporary verification tenant removed.'); }
    await db.$disconnect();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
