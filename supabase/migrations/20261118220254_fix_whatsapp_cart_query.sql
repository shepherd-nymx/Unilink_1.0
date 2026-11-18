-- Disambiguate the cart catalog alias from the product record variable.
do $fix$
declare definition text;
begin
 definition:=pg_get_functiondef('public.whatsapp_bot_message(text,text,text,text,numeric,numeric,text,timestamptz)'::regprocedure);
 definition:=replace(definition,'select p.name,p.price,(c.value->>''qty'')::int as qty from jsonb_array_elements(coalesce(st->''cart'',''[]''))c join public.shop_products p on p.id=(c.value->>''id'')::uuid','select catalog_product.name,catalog_product.price,(c.value->>''qty'')::int as qty from jsonb_array_elements(coalesce(st->''cart'',''[]''))c join public.shop_products catalog_product on catalog_product.id=(c.value->>''id'')::uuid');
 execute definition;
end $fix$;
