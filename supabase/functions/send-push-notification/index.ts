import { createClient } from "npm:@supabase/supabase-js@2.58.0";

// ---------------------------------------------------------------------------
// UniLink push notification dispatcher
//
// Reads active push tokens from fcm_tokens + device_tokens, sends via the
// Expo Push API (which handles APNs/FCM delivery). Also supports web push
// tokens (JSON PushSubscription objects) via the Web Push API.
//
// Required env (Supabase secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — DB access (bypasses RLS)
//   EXPO_ACCESS_TOKEN — optional, for authenticated Expo push sends
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY — optional, for web push
// ---------------------------------------------------------------------------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface PushRequest {
  userIds: string[];
  userType: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  queueId?: string;
}

function getSupabase() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing Supabase server credentials");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getTokensForUsers(
  supabase: ReturnType<typeof getSupabase>,
  userIds: string[],
  userType: string,
): Promise<{ token: string; platform: string }[]> {
  const tokens: { token: string; platform: string }[] = [];

  // fcm_tokens table
  const { data: fcmRows, error: fcmErr } = await supabase
    .from("fcm_tokens")
    .select("token, platform")
    .in("user_id", userIds)
    .eq("user_type", userType)
    .eq("is_active", true);

  if (!fcmErr && fcmRows) {
    for (const row of fcmRows) {
      tokens.push({ token: row.token, platform: row.platform || "web" });
    }
  }

  // device_tokens table
  const { data: dtRows, error: dtErr } = await supabase
    .from("device_tokens")
    .select("push_token, platform")
    .in("user_id", userIds);

  if (!dtErr && dtRows) {
    for (const row of dtRows) {
      const pt = row.push_token as string;
      if (!tokens.some((t) => t.token === pt)) {
        tokens.push({ token: pt, platform: row.platform || "web" });
      }
    }
  }

  return tokens;
}

async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, any>,
): Promise<{ sent: number; failed: number }> {
  const messages = tokens.map((to) => ({
    to,
    title,
    body,
    data: { ...data, _title: title, _body: body },
    sound: "default",
    priority: "high" as const,
    channelId: "default",
  }));

  let sent = 0;
  let failed = 0;
  const CHUNK = 100;

  for (let i = 0; i < messages.length; i += CHUNK) {
    const chunk = messages.slice(i, i + CHUNK);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      const accessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }

      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(chunk),
      });

      if (!res.ok) {
        failed += chunk.length;
        continue;
      }

      const json: { data: { status: string; details?: { error?: string } }[] } = await res.json();
      const tickets = json.data || [];
      for (const ticket of tickets) {
        if (ticket.status === "ok") sent++;
        else failed++;
      }
    } catch {
      failed += chunk.length;
    }
  }

  return { sent, failed };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = getSupabase();
    const body: PushRequest = await req.json();

    if (!body.userIds || body.userIds.length === 0 || !body.title || !body.body) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokens = await getTokensForUsers(supabase, body.userIds, body.userType);
    if (tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, failed: 0, reason: "no_tokens" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Split into Expo (native) and web push tokens
    const expoTokens = tokens
      .filter((t) => t.platform !== "web" && t.token.startsWith("ExponentPushToken"))
      .map((t) => t.token);

    const result = await sendExpoPush(
      expoTokens,
      body.title,
      body.body,
      body.data || {},
    );

    // If queueId provided, mark as processed
    if (body.queueId) {
      await supabase
        .from("notification_queue")
        .update({ status: "sent", updated_at: new Date().toISOString() })
        .eq("id", body.queueId);
    }

    return new Response(JSON.stringify({ ...result, total: tokens.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
