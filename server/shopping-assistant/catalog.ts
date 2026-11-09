import { createClient } from '@supabase/supabase-js';
import type { Catalog } from './engine';
import type { DeliveryFeeTier, Product, Shop } from '../../components/marketplace/types';

/** Read public storefront data only; never look up customers, payments or orders. */
export async function loadPublicCatalog(universityId: string): Promise<Catalog> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL, key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('catalog_not_configured');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(7000) }) } });
  const [locationResult, shopResult] = await Promise.all([
    client.from('universities').select('name').eq('id', universityId).maybeSingle(),
    client.from('shops').select('id,name,is_available,operating_hours,delivery_fee,offers_free_delivery').eq('status','active').order('id').range(0,499),
  ]);
  if (locationResult.error || shopResult.error) throw new Error('catalog_unavailable');
  const location = locationResult.data?.name || '', shops = (shopResult.data || []) as Shop[];
  if (!location || !shops.length) return { location, shops, products: [], services: [], tiers: {} };
  const ids = shops.map(shop => shop.id);
  const [servicesResult, tierResult] = await Promise.all([
    client.from('shop_service_locations').select('shop_id,location_name').in('shop_id', ids).order('id').range(0,999),
    client.from('shop_delivery_fee_tiers').select('id,shop_id,min_amount,max_amount,fee,label,sort_order').in('shop_id',ids).order('id').range(0,999),
  ]);
  if (servicesResult.error || tierResult.error) throw new Error('catalog_unavailable');
  const products: Product[] = [];
  for (let offset = 0; offset < 2000; offset += 500) {
    const result = await client.from('shop_products').select('id,shop_id,name,description,image_url,price,stock,category,status').eq('status','active').in('shop_id',ids).gt('stock',0).order('id').range(offset,offset+499);
    if (result.error) throw new Error('catalog_unavailable');
    products.push(...(result.data || []) as Product[]);
    if ((result.data?.length || 0) < 500) break;
  }
  const tiers: Catalog['tiers'] = {};
  for (const tier of tierResult.data || []) (tiers[tier.shop_id] ||= []).push(tier as DeliveryFeeTier);
  return { location, shops, products, services: servicesResult.data || [], tiers, truncated: products.length >= 2000 || shops.length >= 500 || (servicesResult.data?.length || 0) >= 1000 || (tierResult.data?.length || 0) >= 1000 };
}
