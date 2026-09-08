import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';
import { calculateOrderPricing } from '../services/pricing';
import { orderScope, canTransitionOrder, deliveryTransitions } from '../services/access';
import { JWT_SECRET } from '../middleware/auth';
import orders from '../routes/orders';
import deliveries from '../routes/deliveries';
import { initSocketIO } from '../socket';
const { io: connect } = require('../../../client/node_modules/socket.io-client');

const settings = { minimumOrder: 0, deliveryFee: 100, freeDeliveryThreshold: 2000 };
const product = { id: 'p1', name: 'Meal', basePrice: 500, isAvailable: true, optionGroups: [{ tenantId: 't1', name: 'Size', minSelect: 1, maxSelect: 1, isRequired: true, options: [{ id: 'o1', name: 'Large', priceModifier: 100 }, { id: 'o2', name: 'Small', priceModifier: 0 }] }] };
function db(voucher: any = null): any { return {
  tenantSettings: { findUnique: async () => settings },
  branch: { findFirst: async ({where}: any) => where.id === 'b1' ? { isOpen: true, minimumOrder: 0, deliveryFee: 100 } : null },
  product: { findFirst: async ({where}: any) => where.id === 'p1' && where.tenantId === 't1' ? product : null },
  voucher: { findFirst: async () => voucher },
}; }
const item = { productId: 'p1', quantity: 2, optionIds: ['o1'] };
test('pricing ignores client prices and charges database option modifiers', async () => {
  const q = await calculateOrderPricing('t1', [{ ...item, unitPrice: 1 } as any], 'b1', 'DELIVERY', undefined, db());
  assert.equal(q.total, 1300); assert.equal(q.items[0].unitPrice, 600);
});
test('required, foreign, duplicate, excessive options and invalid quantities fail', async () => {
  for (const optionIds of [[], ['foreign'], ['o1','o1'], ['o1','o2']]) await assert.rejects(calculateOrderPricing('t1', [{ ...item, optionIds }], 'b1', 'DELIVERY', undefined, db()));
  for (const quantity of [0,-1,1.5,Infinity,100,'2']) await assert.rejects(calculateOrderPricing('t1', [{ ...item, quantity } as any], 'b1', 'DELIVERY', undefined, db()));
  await assert.rejects(calculateOrderPricing('t1', [], 'b1', 'DELIVERY', undefined, db()));
});
test('foreign products, missing branches and unsupported modes fail', async () => {
  await assert.rejects(calculateOrderPricing('t1', [item], 'foreign', 'DELIVERY', undefined, db()));
  await assert.rejects(calculateOrderPricing('t1', [{...item,productId:'foreign'}], 'b1', 'DELIVERY', undefined, db()));
  await assert.rejects(calculateOrderPricing('t1', [item], 'b1', 'PICKUP' as any, undefined, db()));
});
test('free delivery is applied once and expired vouchers fail', async () => {
  const voucher = { code:'FREE', discountType:'FREE_DELIVERY', discountValue:0, minimumOrder:0, maximumDiscount:null, usageLimit:null };
  const q = await calculateOrderPricing('t1', [item], 'b1', 'DELIVERY', 'FREE', db(voucher));
  assert.equal(q.total,1200); assert.equal(q.deliveryFee,0); assert.equal(q.discount,0);
  await assert.rejects(calculateOrderPricing('t1', [item], 'b1', 'DELIVERY', 'FREE', db({...voucher,endDate:new Date(0)})));
  await assert.rejects(calculateOrderPricing('t1', [item], 'b1', 'DELIVERY', 'FREE', db({...voucher,minimumOrder:1500})));
});
test('pickup and delivery thresholds', async () => {
  assert.equal((await calculateOrderPricing('t1',[item],'b1','TAKEAWAY',undefined,db())).total,1200);
  assert.equal((await calculateOrderPricing('t1',[{...item,quantity:4}],'b1','DELIVERY',undefined,db())).deliveryFee,0);
});
test('workflow prevents skipping and reopening delivered orders', () => {
  assert.equal(canTransitionOrder('PENDING','DELIVERED','DELIVERY','TENANT_ADMIN'),false);
  assert.equal(canTransitionOrder('DELIVERED','PREPARING','DELIVERY','TENANT_ADMIN'),false);
  assert.equal(canTransitionOrder('READY','DELIVERED','TAKEAWAY','KITCHEN_STAFF'),true);
  assert.equal(canTransitionOrder('PENDING','PREPARING','DELIVERY','CUSTOMER'),false);
  assert.deepEqual(deliveryTransitions.ASSIGNED,['ACCEPTED']);
});

const users: any = { customer:{id:'customer',tenantId:'t1',role:'CUSTOMER',isActive:true}, other:{id:'other',tenantId:'t2',role:'CUSTOMER',isActive:true}, rider:{id:'rider',tenantId:'t1',role:'RIDER',isActive:true} };
let lastWhere: any;
const app = express(); const server = http.createServer(app); const io = initSocketIO(server);
let base: string;
before(async () => {
  (prisma.user.findUnique as any) = async ({where}:any) => users[where.id] || null;
  (prisma.tenant.findUnique as any) = async () => ({id:'t1',status:'ACTIVE'});
  (prisma.tenant.findFirst as any) = async () => ({id:'t1',status:'ACTIVE'});
  (prisma.branchStaff.findMany as any) = async () => [{branchId:'b1'}];
  (prisma.order.findMany as any) = async ({where}:any) => { lastWhere=where; return []; };
  (prisma.order.findFirst as any) = async ({where}:any) => { lastWhere=where; return null; };
  (prisma.delivery.findFirst as any) = async () => null;
  (prisma.rider.findUnique as any) = async () => ({id:'r1'});
  app.use(express.json());
  app.use((req,_res,next) => { req.tenant={id:'t1',status:'ACTIVE',settings} as any; next(); });
  app.use('/orders',orders); app.use('/deliveries',deliveries);
  await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
  base=`http://127.0.0.1:${(server.address() as any).port}`;
});
after(async () => { await new Promise<void>(resolve => io.close(() => resolve())); await prisma.$disconnect(); });
function headers(user:string) { return {'Content-Type':'application/json',Authorization:`Bearer ${jwt.sign({userId:user},JWT_SECRET,{expiresIn:'1h'})}`}; }
test('anonymous order list, detail, update and checkout are blocked', async () => {
  for (const [path,method] of [['/orders','GET'],['/orders/secret','GET'],['/orders/secret/status','PATCH'],['/orders','POST']]) assert.equal((await fetch(base+path,{method})).status,401);
});
test('tenant mismatch and customer status mutations are blocked', async () => {
  assert.equal((await fetch(base+'/orders',{headers:headers('other')})).status,403);
  assert.equal((await fetch(base+'/orders/id/status',{method:'PATCH',headers:headers('customer'),body:JSON.stringify({status:'DELIVERED'})})).status,403);
});
test('customer history and lookup enforce ownership', async () => {
  assert.equal((await fetch(base+'/orders',{headers:headers('customer')})).status,200);
  assert.equal(lastWhere.AND[0].customerId,'customer');
  assert.equal((await fetch(base+'/orders/secret',{headers:headers('customer')})).status,404);
  assert.equal(lastWhere.AND[0].customerId,'customer');
});
test('delivery updates require rider role and assigned delivery', async () => {
  assert.equal((await fetch(base+'/deliveries/d1/status',{method:'PATCH',headers:headers('customer'),body:'{}'})).status,403);
  assert.equal((await fetch(base+'/deliveries/d1/status',{method:'PATCH',headers:headers('rider'),body:'{}'})).status,404);
});
test('branch employees get only assigned branch scope', async () => {
  assert.deepEqual(await orderScope({id:'staff',tenantId:'t1',role:'KITCHEN_STAFF'},'t1'),{tenantId:'t1',branchId:{in:['b1']}});
  assert.deepEqual(await orderScope(users.other,'t1'),{id:{in:[]}});
});
test('public sockets cannot join kitchen or private order rooms', async () => {
  const client=connect(base,{auth:{tenantSlug:'first'},transports:['websocket'],reconnection:false});
  try {
    await new Promise<void>((resolve,reject)=>{client.once('connect',resolve);client.once('connect_error',reject);});
    client.emit('join:kitchen',{tenantId:'t2'}); client.emit('join:tenant','t2');
    const result=await new Promise<any>(resolve=>client.emit('join:order','secret',resolve));
    assert.equal(result.success,false);
    assert.deepEqual([...io.sockets.sockets.get(client.id)!.rooms].sort(),[client.id,'catalog:t1'].sort());
  } finally { client.disconnect(); }
});
test('sockets reject a token for a different tenant', async () => {
  const client=connect(base,{auth:{tenantSlug:'first',token:jwt.sign({userId:'other'},JWT_SECRET)},transports:['websocket'],reconnection:false});
  try { await new Promise<void>((resolve,reject)=>{client.once('connect',()=>reject(new Error('Unexpected authorization')));client.once('connect_error',()=>resolve());}); } finally { client.disconnect(); }
});
