/** Reserve one of 500 monthly calls before inference. Each call reserves $0.002
 * against a conservative $1 monthly allocation from the existing free credits.
 * No service-role key or billing/top-up API is used. */
export async function reserveAssistantAllowance(): Promise<void> {
  const token = process.env.ASSISTANT_BUDGET_TOKEN, url = process.env.EXPO_PUBLIC_SUPABASE_URL, key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !key) throw new Error('assistant_allowance_not_configured');
  const response = await fetch(`${url}/rest/v1/rpc/reserve_shopping_assistant_request`, {
    method: 'POST', headers: { 'Content-Type':'application/json', apikey:key, Authorization:`Bearer ${key}` },
    body: JSON.stringify({p_token:token}), signal:AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('assistant_allowance_unavailable');
  if (await response.json() !== true) throw new Error('monthly_allowance_exhausted');
}
