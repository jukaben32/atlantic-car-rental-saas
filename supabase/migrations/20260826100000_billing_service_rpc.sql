-- The billing Edge Functions call these through PostgREST's rpc(), which only
-- reaches the exposed `public` schema. The functions themselves live in the
-- private `app` schema, so every call failed silently: the catalogue was never
-- stored and Checkout answered plan_unavailable.
--
-- Each wrapper forwards to the app function with the same arguments and is
-- executable by service_role alone, exactly as the originals are. Nothing a
-- browser can call is added.

do $$
declare
  r record;
  forwarded text;
begin
  for r in
    select p.oid,
           p.proname,
           pg_get_function_arguments(p.oid)          as args,
           pg_get_function_identity_arguments(p.oid) as identity_args,
           pg_get_function_result(p.oid)             as result,
           p.proargnames                             as names
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'app'
       and p.proname in (
         'billing_report_platform_state',
         'billing_replace_catalogue',
         'billing_claim_customer',
         'billing_resolve_plan',
         'billing_open_checkout',
         'billing_record_checkout',
         'billing_apply_subscription',
         'billing_apply_invoice',
         'billing_note_event',
         'billing_claim_webhook_event',
         'billing_finish_webhook_event',
         'billing_fail_webhook_event',
         'billing_mark_customer_deleted'
       )
  loop
    select string_agg(format('%1$I => %1$I', name), ', ')
      into forwarded
      from unnest(r.names) as name;

    execute format(
      'create or replace function public.%I(%s) returns %s '
      'language sql volatile security definer set search_path = '''' '
      'as $body$ select * from app.%I(%s) $body$',
      r.proname, r.args, r.result, r.proname, forwarded
    );

    execute format(
      'revoke all on function public.%I(%s) from public, anon, authenticated',
      r.proname, r.identity_args
    );
    execute format(
      'grant execute on function public.%I(%s) to service_role',
      r.proname, r.identity_args
    );
  end loop;
end
$$;
