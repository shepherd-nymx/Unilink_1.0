import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { answerRequest, type Catalog } from '../server/shopping-assistant/engine';
import { parseBasicRequest, parseWithAI } from '../server/shopping-assistant/intent';
import { loadPublicCatalog } from '../server/shopping-assistant/catalog';
import type { ShoppingIntent } from '../lib/shopping-assistant-types';

type Request = IncomingMessage & { body?: unknown };
type Message = { role: 'user' | 'assistant'; content: string };
type Dependencies = { parse: (messages: Message[]) => Promise<ShoppingIntent>; load: (location: string) => Promise<Catalog> };
// Best-effort per-instance throttle. Not a global/distributed spending cap.
const requests = new Map<string, { count: number; until: number }>();
function limited(req: Request) {
  const ip = String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown');
  const key = createHash('sha256').update(ip).digest('hex');
  const now = Date.now();
  for (const [id, value] of requests) if (value.until <= now) requests.delete(id);
  if (requests.size > 2000) return true;
  const bucket = requests.get(key) || { count: 0, until: now + 60000 };
  bucket.count++; requests.set(key,bucket);
  return bucket.count > 8;
}
function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status; res.setHeader('Content-Type','application/json'); res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff'); res.end(JSON.stringify(body));
}
async function bodyOf(req: Request) {
  if (req.body != null) {
    if (Buffer.byteLength(typeof req.body === 'string' ? req.body : JSON.stringify(req.body)) > 8192) throw new Error('size');
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  let body = '';
  for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 8192) throw new Error('size'); }
  return JSON.parse(body);
}
export function freeAIReason(error: unknown): string {
  let current = error as { message?: unknown; responseBody?: unknown; cause?: unknown; statusCode?: number } | undefined;
  const hints: string[] = [];
  for (let depth = 0; current && depth < 4; depth++) {
    if (typeof current.message === 'string') hints.push(current.message);
    if (typeof current.responseBody === 'string') hints.push(current.responseBody);
    current = current.cause && typeof current.cause === 'object' ? current.cause as typeof current : undefined;
  }
  const text = hints.join(' ').toLowerCase();
  if (/customer_verification_required|verify.*account|account.*verif|valid payment method|credit card/.test(text)) return 'account_verification_required';
  if (/insufficient_funds|quota_for_entity_exceeded/.test(text)) return 'free_quota_unavailable';
  if (/api.key|authentication|oidc|unauthorized/.test(text)) return 'gateway_authentication_required';
  if (/free_model_unavailable/.test(text)) return 'zero_price_model_unavailable';
  if (/timeout|timed out|abort/.test(text)) return 'provider_timeout';
  return 'provider_unavailable';
}

export function createShoppingHandler(dependencies: Dependencies) {
  return async function handler(req: Request, res: ServerResponse) {
    if (req.method !== 'POST') { res.setHeader('Allow','POST'); return send(res,405,{error:'Use POST.'}); }
    const origins = new Set(['https://unilinkbase.com','https://www.unilinkbase.com','https://www.unilink.co.zw', ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []), ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:3014','http://localhost:3020'] : [])]);
    if (req.headers.origin && !origins.has(req.headers.origin)) return send(res,403,{error:'This request is not allowed.'});
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) return send(res,415,{error:'Send a JSON request.'});
    if (limited(req)) { res.setHeader('Retry-After','60'); return send(res,429,{error:'Please wait a minute before asking again.'}); }
    let body: { messages?: unknown; universityId?: unknown; basicOnly?: unknown };
    try { body = await bodyOf(req); if (!body || typeof body !== 'object') throw new Error('body'); } catch { return send(res,400,{error:'Please send a shorter valid request.'}); }
    const messages = body.messages as Message[];
    if (!Array.isArray(messages) || !messages.length || messages.length > 6 || messages.some(m => !m || !['user','assistant'].includes(m.role) || typeof m.content !== 'string' || !m.content.trim() || m.content.length > 1000) || messages.at(-1)?.role !== 'user' || messages.reduce((sum,m) => sum+m.content.length,0) > 4000) return send(res,400,{error:'Please keep your request under 1,000 characters and start a new conversation if it is too long.'});
    if (typeof body.universityId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.universityId)) return send(res,400,{error:'Add your service location in Profile before using the shopping assistant.'});
    try {
      let mode: 'ai' | 'catalogue' = 'ai', intent: ShoppingIntent;
      try { if (body.basicOnly === true) throw new Error('basic_requested'); intent = await dependencies.parse(messages); }
      catch (err) {
        // Log categories only, never prompts, credentials or raw upstream responses.
        const failure = err as { name?: string; statusCode?: number; cause?: { name?: string; statusCode?: number } };
        if (body.basicOnly !== true) console.warn('[shopping-assistant] free_ai_unavailable', { name: failure.name, status: failure.statusCode ?? failure.cause?.statusCode, reason: freeAIReason(err) });
        mode = 'catalogue';
        try { intent = parseBasicRequest(messages.at(-1)!.content); }
        catch { return send(res,400,{error:'Please use up to six items with quantities under 1,000, and a budget in US dollars.'}); }
      }
      const catalog = intent.kind === 'help' ? {location:'',shops:[],products:[],services:[],tiers:{}} : await dependencies.load(body.universityId);
      const answer = answerRequest(intent,catalog,mode);
      if (mode === 'catalogue') answer.notice = [answer.notice, 'Basic catalogue search is active. Free AI is unavailable or was not used. Include your complete item list and budget in each message.'].filter(Boolean).join(' ');
      return send(res,200,answer);
    } catch { return send(res,503,{error:'The catalogue could not be checked. Please try again shortly or browse Nearby shops.'}); }
  };
}
export default createShoppingHandler({ parse: parseWithAI, load: loadPublicCatalog });
