export type ShoppingUnit = 'item' | 'kg' | 'g' | 'l' | 'ml';
export type ShoppingIntent = {
  kind: 'shopping' | 'help';
  items: { query: string; quantity: number; unit: ShoppingUnit }[];
  budget: number | null;
  budgetIncludesDelivery: boolean;
  currency: 'USD' | 'unsupported';
  helpTopic: 'shopping' | 'delivery' | 'orders' | 'payments' | 'support' | 'other';
};
export type AssistantProduct = {
  id: string; shopId: string; shopName: string; name: string; price: number;
  stock: number; imageUrl: string | null; open: boolean;
  quantity: number | null; lineTotal: number | null; supplied: string | null;
};
export type AssistantBasket = {
  lines: AssistantProduct[]; goodsTotal: number; deliveryFee: number | null;
  total: number | null; budgetStatus: 'within' | 'over' | 'unconfirmed' | 'none';
};
export type AssistantResponse = {
  mode: 'ai' | 'catalogue' | 'help'; message: string; notice?: string;
  location: string; budget: number | null; budgetIncludesDelivery: boolean;
  matches: { requested: string; products: AssistantProduct[] }[];
  basket: AssistantBasket | null; missing: string[]; checkedAt: string;
};
