import type { Coordinates, MapShop } from '@/lib/shop-map';
export type ShopMapCanvasProps = {
  shops: MapShop[];
  location: Coordinates | null;
  onSelect: (id: string) => void;
  onError: (message: string) => void;
};
