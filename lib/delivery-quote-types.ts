export type ProductLoad = { weight_kg?: number | null; volume_litres?: number | null; package_size?: 'compact' | 'bag' | 'bulky' | null; fragile?: boolean; two_person_lift?: boolean };
export type DeliveryQuote = { id: string; shop_id: string; customer_id: string; basket: { id: string; qty: number }[]; products: ({id:string;name:string;qty:number;price:number} & ProductLoad)[]; subtotal: number; ecocash_fee_at_quote: number; weight_kg: number | null; volume_litres: number | null; fragile: boolean; two_person_lift: boolean; status: string; delivery_fee: number | null; suggested_fee: number | null; road_km: number | null; transport: string | null; explanation: string | null; route_evidence: string | null; driver_id: string | null; expires_at: string | null };
export function basketKey(items: { id: string; qty: number }[]) { return JSON.stringify([...items].map(i => ({id:i.id,qty:i.qty})).sort((a,b)=>a.id.localeCompare(b.id))); }
export function summarizeLoad(items: { quantity: number; product: ProductLoad }[]) {
  let weight = 0, volume = 0, complete = true, fragile = false, lift = false;
  for (const {quantity,product:p} of items) {
    if (!Number.isInteger(quantity) || quantity<=0) throw new Error('Invalid quantity');
    if (!p.package_size || !Number.isFinite(Number(p.weight_kg)) || Number(p.weight_kg)<=0 || !Number.isFinite(Number(p.volume_litres)) || Number(p.volume_litres)<=0) complete=false;
    weight+=Number(p.weight_kg||0)*quantity; volume+=Number(p.volume_litres||0)*quantity; fragile ||= !!p.fragile; lift ||= !!p.two_person_lift;
  }
  return { weight: complete?weight:null, volume:complete?volume:null,fragile,lift,complete };
}
