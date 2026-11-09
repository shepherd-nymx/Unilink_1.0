import type { AssistantBasket, AssistantProduct, AssistantResponse, ShoppingIntent } from '../../lib/shopping-assistant-types';
import { shopServesLocation } from '../../lib/shop-location-visibility';
import { computeTierDeliveryFee, type DeliveryFeeTier, type Product, type Shop } from '../../components/marketplace/types';

export type Catalog = { location: string; shops: Shop[]; products: Product[]; services: { shop_id: string; location_name: string }[]; tiers: Record<string, DeliveryFeeTier[]>; truncated?: boolean };
const cents = (n: number) => Math.round(n * 100);
const dollars = (n: number) => n / 100;
const canonical = (word: string) => ({ groceries: 'grocery', tomatoes: 'tomato', potatoes: 'potato', eggs: 'egg', litres: 'litre' }[word] || word.replace(/s$/, ''));
function tokens(text: string) {
  return text.toLowerCase().replace(/\b\d+(?:\.\d+)?\s*(?:kg|g|ml|l)\b/g, '').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(word => word && !['of','the','a','an','some','cooking','fresh'].includes(word)).map(canonical);
}
export function shopOpenInHarare(shop: Shop, now: Date) {
  if (!shop.is_available) return false;
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Harare', weekday: 'long' }).format(now).toLowerCase();
  const dayNumber = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].indexOf(day);
  const entry = shop.operating_hours?.[day] ?? shop.operating_hours?.[String(dayNumber)];
  if (entry == null) return true;
  if (entry === false || (typeof entry === 'object' && entry.closed === true)) return false;
  const open = typeof entry === 'string' ? entry : entry.open;
  const close = typeof entry === 'string' ? null : entry.close;
  if (!open) return true;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Harare', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const minute = Number(parts.find(p => p.type === 'hour')?.value) * 60 + Number(parts.find(p => p.type === 'minute')?.value);
  const parse = (v: string) => { const [h, m] = v.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const start = parse(open), end = close ? parse(close) : 1439;
  return end <= start ? minute >= start : minute >= start && minute < end;
}
function packSize(product: Product): { value: number; family: 'mass' | 'volume' } | null {
  // Prefer the actual product name; descriptions can mention unrelated recipe amounts.
  const nameMatches = [...product.name.toLowerCase().matchAll(/\b(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/g)];
  if (nameMatches.length !== 1) return null;
  const m = nameMatches[0];
  const multiple = product.name.toLowerCase().slice(0, m.index).match(/(\d+)\s*[x×]\s*$/);
  const value = Number(m[1]) * (['kg','l'].includes(m[2]) ? 1000 : 1) * Number(multiple?.[1] || 1);
  return value > 0 ? { value, family: ['kg','g'].includes(m[2]) ? 'mass' : 'volume' } : null;
}
function option(product: Product, shop: Shop, request: ShoppingIntent['items'][number], now: Date): AssistantProduct {
  let quantity: number | null = Math.ceil(request.quantity), supplied: string | null = null;
  if (request.unit !== 'item') {
    const size = packSize(product), family = ['kg','g'].includes(request.unit) ? 'mass' : 'volume';
    const needed = request.quantity * (['kg','l'].includes(request.unit) ? 1000 : 1);
    quantity = size?.family === family ? Math.ceil(needed / size.value) : null;
    if (quantity != null && size) supplied = `${Number((quantity * size.value / 1000).toFixed(3))} ${family === 'mass' ? 'kg' : 'L'}`;
  }
  return { id: product.id, shopId: shop.id, shopName: shop.name, name: product.name, price: Number(product.price), stock: Number(product.stock), imageUrl: product.image_url, open: shopOpenInHarare(shop, now), quantity, lineTotal: quantity == null ? null : dollars(cents(Number(product.price)) * quantity), supplied };
}
function basketFor(lines: AssistantProduct[], catalog: Catalog, intent: ShoppingIntent): AssistantBasket | null {
  const merged = new Map<string, AssistantProduct>();
  for (const line of lines) {
    const old = merged.get(line.id), quantity = (old?.quantity || 0) + (line.quantity || 0);
    if (quantity > line.stock) return null;
    merged.set(line.id, { ...line, quantity, lineTotal: dollars(cents(line.price) * quantity), supplied: old ? null : line.supplied });
  }
  const values = [...merged.values()], subtotals = new Map<string, number>();
  for (const line of values) subtotals.set(line.shopId, (subtotals.get(line.shopId) || 0) + cents(line.lineTotal || 0));
  let deliveryCents: number | null = 0;
  for (const [shopId, subtotal] of subtotals) {
    const shop = catalog.shops.find(s => s.id === shopId)!, tiers = catalog.tiers[shopId] || [];
    // Checkout has a user-entered fallback fee when the shop has no saved fee.
    // Do not invent that fee or claim an all-in budget has been met.
    if (shop.delivery_fee == null && !tiers.length) { deliveryCents = null; break; }
    const fee = computeTierDeliveryFee(dollars(subtotal), tiers, Number(shop.delivery_fee ?? NaN));
    if (!Number.isFinite(fee) || fee < 0) { deliveryCents = null; break; }
    deliveryCents += cents(fee);
  }
  const goodsCents = [...subtotals.values()].reduce((a,b) => a+b, 0), total = deliveryCents == null ? null : dollars(goodsCents + deliveryCents);
  const compared = intent.budgetIncludesDelivery ? total : dollars(goodsCents);
  return { lines: values, goodsTotal: dollars(goodsCents), deliveryFee: deliveryCents == null ? null : dollars(deliveryCents), total, budgetStatus: intent.budget == null ? 'none' : compared == null ? 'unconfirmed' : cents(compared) <= cents(intent.budget) ? 'within' : 'over' };
}
const HELP = {
  shopping: 'Tell me the items, quantities and your budget, for example: “2 kg rice and 1 L oil under $10”. I compare real products from shops serving your selected area. You review purchases in the shop before checkout.',
  delivery: 'Shop delivery fees can depend on the shop and basket total. I use the saved fees when available. Confirm the delivery address and final fee at checkout. Request Delivery is currently unavailable; shop ordering remains available.',
  orders: 'Open Orders in the bottom navigation to check your orders. This first version cannot access private order details or cancel orders for you.',
  payments: 'The payment methods available depend on the shops in your basket. Checkout shows the supported methods and any applicable payment fees. I cannot take payments or request your payment PIN.',
  support: 'Open Support in the bottom navigation for help with an order, complaint or refund. I cannot approve refunds or contact a shop on your behalf.',
  other: 'I can help find products, compare a basket with your budget, or explain shopping on UNILINK. Please send up to six items with quantities. I cannot place orders, pay or access private account information.',
};
export function answerRequest(intent: ShoppingIntent, catalog: Catalog, mode: AssistantResponse['mode'], now = new Date()): AssistantResponse {
  const response: AssistantResponse = { mode, message: '', location: catalog.location, budget: intent.budget, budgetIncludesDelivery: intent.budgetIncludesDelivery, matches: [], basket: null, missing: [], checkedAt: now.toISOString() };
  if (intent.currency !== 'USD') return { ...response, message: 'The catalogue uses US dollars. Please give your budget in USD; I cannot assume an exchange rate.' };
  if (intent.kind === 'help') return { ...response, message: HELP[intent.helpTopic] };
  if (!catalog.location.trim()) return { ...response, message: 'Add your service location in Profile, then try again so I can find shops that deliver to you.' };
  const serviceMap: Record<string, {location_name: string}[]> = {};
  for (const service of catalog.services) (serviceMap[service.shop_id] ||= []).push(service);
  const shops = catalog.shops.filter(shop => shopServesLocation(serviceMap[shop.id], catalog.location));
  const shopMap = new Map(shops.map(shop => [shop.id, shop]));
  const choices: AssistantProduct[][] = [];
  for (const request of intent.items) {
    const wanted = tokens(request.query);
    const matches = catalog.products.filter(product => {
      const name = tokens(product.name), description = tokens(product.description || ''), words = new Set([...name, ...description]);
      const requestWords = new Set(wanted);
      // A keyword alone must not turn an appliance, flour or cosmetic into a staple.
      const incompatible = wanted.includes('rice') ? ['flour','cooker','noodle','pasta','cracker','cake'] : wanted.includes('oil') && !wanted.some(word => ['hair','motor','engine','essential'].includes(word)) ? ['hair','motor','engine','essential','perfume'] : [];
      if (incompatible.some(word => words.has(word) && !requestWords.has(word))) return false;
      return shopMap.has(product.shop_id) && product.status === 'active' && Number(product.stock) > 0 && Number.isFinite(Number(product.price)) && Number(product.price) >= 0 && wanted.length > 0 && wanted.every(word => words.has(word));
    }).map(product => option(product, shopMap.get(product.shop_id)!, request, now));
    const ready = matches.filter(p => p.open && p.quantity != null && p.quantity <= p.stock).sort((a,b) => (a.lineTotal || 0) - (b.lineTotal || 0));
    choices.push(ready.slice(0, 12));
    response.matches.push({ requested: `${request.quantity} ${request.unit === 'item' ? '×' : request.unit} ${request.query}`, products: [...ready, ...matches.filter(p => !ready.includes(p))].slice(0, 8) });
    if (!ready.length) response.missing.push(`${request.query}: ${!matches.length ? 'no matching in-stock products' : matches.every(p => !p.open) ? 'matching shops are currently closed or unavailable' : 'check pack size or available quantity'}`);
  }
  if (choices.length && choices.every(options => options.length)) {
    let candidates: AssistantProduct[][] = [[]];
    for (const options of choices) {
      candidates = candidates.flatMap(lines => options.map(product => [...lines, product]))
        .map(lines => ({ lines, basket: basketFor(lines, catalog, intent) })).filter((c): c is {lines: AssistantProduct[]; basket: AssistantBasket} => c.basket != null)
        .sort((a,b) => {
          const aCost = intent.budgetIncludesDelivery ? a.basket.total ?? Infinity : a.basket.goodsTotal;
          const bCost = intent.budgetIncludesDelivery ? b.basket.total ?? Infinity : b.basket.goodsTotal;
          return aCost - bCost || a.basket.goodsTotal - b.basket.goodsTotal;
        }).slice(0,128).map(c => c.lines);
    }
    response.basket = candidates.length ? basketFor(candidates[0], catalog, intent) : null;
    if (!response.basket) response.missing.push('The combined quantities exceed available stock. Try a smaller quantity.');
  }
  const basket = response.basket;
  response.message = basket ? basket.budgetStatus === 'within' ? 'Here is a suggested basket within your budget.' : basket.budgetStatus === 'over' ? 'This suggested basket exceeds your budget. Try a smaller quantity or a different product.' : basket.budgetStatus === 'unconfirmed' ? 'I found the goods, but delivery needs confirmation before I can check your full budget.' : 'Here is a suggested basket from the current catalogue.' : 'I could not build a complete available basket. Check the matches below or adjust your request.';
  if (catalog.truncated) response.notice = 'Results cover part of the catalogue. Narrow your request or browse shops for more options.';
  return response;
}
