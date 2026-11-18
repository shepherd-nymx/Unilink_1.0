-- Payment URLs must come from the private bot ledger, not legacy browser-writable records.
do $fix$
declare definition text;
begin
 definition:=pg_get_functiondef('public.whatsapp_bot_message(text,text,text,text,numeric,numeric,text,timestamptz)'::regprocedure);
 definition:=replace(definition,$text$    select status into policy from public.paynow_transactions where entity_id=r.id and reference='WA-'||r.id::text order by created_at desc limit 1;
    answer:=answer||E'\nPaynow status: '||coalesce(policy,'awaiting payment link');$text$,$text$    select payment_url into policy from public.whatsapp_bot_orders where order_id=r.id and wa_id=p_wa_id;
    answer:=answer||E'\n'||case when policy is null then 'Payment link not confirmed. Contact UniLink before paying.' else 'Secure Paynow link: '||policy||'. Ask the shop to confirm receipt; a link is not proof of payment.' end;$text$);
 execute definition;
end $fix$;
