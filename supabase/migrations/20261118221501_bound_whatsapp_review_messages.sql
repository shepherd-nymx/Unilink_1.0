-- Keep full totals, delivery details and confirmation choices visible within WhatsApp message limits.
do $fix$
declare definition text; signature text;
begin
 foreach signature in array array['public.whatsapp_bot_review(text)','public.whatsapp_bot_message(text,text,text,text,numeric,numeric,text,timestamptz)'] loop
 definition:=pg_get_functiondef(signature::regprocedure);
 definition:=replace(definition,$old$not between 1 and 50$old$,$new$not between 1 and 30$new$);
 definition:=replace(definition,$old$between 1 and 50 different products$old$,$new$between 1 and 30 different products$new$);
 definition:=replace(definition,$old$jsonb_array_length(choices)>=50$old$,$new$jsonb_array_length(choices)>=30$new$);
 definition:=replace(definition,$old$at most 50 different products$old$,$new$at most 30 different products$new$);
 definition:=replace(definition,$old$answer:=p.name||' costs $'$old$,$new$answer:=left(p.name,60)||' costs $'$new$);
 definition:=replace(definition,$old$||r.name||' — $'$old$,$new$||left(r.name,60)||' — $'$new$);
 definition:=replace(definition,$old$||(line->>'name')||' — $'$old$,$new$||left(line->>'name',60)||' — $'$new$);
 definition:=replace(definition,$old$'Review your order from '||(review->>'shop_name')$old$,$new$'Review your order from '||left(review->>'shop_name',80)$new$);
 definition:=replace(definition,$old$' received by '||(review->>'shop_name')$old$,$new$' received by '||left(review->>'shop_name',80)$new$);
 execute definition;
 end loop;
end $fix$;
