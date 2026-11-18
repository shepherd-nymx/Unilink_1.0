-- Leave room for astral Unicode characters without truncating invoice totals.
do $fix$
declare definition text;
begin
 definition:=pg_get_functiondef('public.whatsapp_bot_message(text,text,text,text,numeric,numeric,text,timestamptz)'::regprocedure);
 definition:=replace(definition,'left(r.name,60)','left(r.name,32)');
 definition:=replace(definition,$old$left(line->>'name',60)$old$,$new$left(line->>'name',32)$new$);
 execute definition;
end $fix$;
