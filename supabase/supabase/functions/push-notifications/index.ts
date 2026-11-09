import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "https://el-zein-style.vercel.app",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function reply(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value.trim();
}

function configureVapid() {
  const subject = env("VAPID_SUBJECT");
  const publicKey = env("VAPID_PUBLIC_KEY");
  const privateKey = env("VAPID_PRIVATE_KEY");
  if (!/^[A-Za-z0-9_-]{87}$/.test(publicKey)) {
    throw new Error("VAPID_PUBLIC_KEY format invalid. Check the secret value.");
  }
  if (!/^[A-Za-z0-9_-]{43}$/.test(privateKey)) {
    throw new Error("VAPID_PRIVATE_KEY format invalid. Check the secret value.");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return reply({ error: "POST required" }, 405);

  try {
    const url = env("SUPABASE_URL");
    const anonKey = env("SUPABASE_ANON_KEY");
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
    const adminClient = createClient(url, serviceKey);
    const body = await req.json();
    const action = body?.action || "send";

    if (action === "subscribe" && typeof body?.card_token === "string") {
      const cardToken = body.card_token.trim();
      if (!cardToken || cardToken.length > 512) return reply({ error: "Invalid card token" }, 400);

      const sub = body.subscription;
      if (
        typeof sub?.endpoint !== "string" ||
        !sub.endpoint.startsWith("https://") ||
        typeof sub.keys?.p256dh !== "string" || !sub.keys.p256dh ||
        typeof sub.keys?.auth !== "string" || !sub.keys.auth
      ) return reply({ error: "Invalid subscription" }, 400);

      const { data: card, error: cardError } = await adminClient
        .from("loyalty_cards")
        .select("id")
        .eq("public_token", cardToken)
        .maybeSingle();
      if (cardError) throw cardError;
      if (!card) return reply({ error: "Card not found" }, 404);

      const { error } = await adminClient
        .from("customer_push_subscriptions")
        .upsert({
          endpoint: sub.endpoint,
          subscription: sub,
          card_id: card.id,
          active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: "endpoint" });
      if (error) throw error;
      return reply({ success: true, subscribed: true });
    }

    const jwt = req.headers.get("Authorization")?.replace(/^Bearer /i, "");
    if (!jwt) return reply({ error: "Login required" }, 401);
    const authClient = createClient(url, anonKey);
    const { data: { user }, error: authError } = await authClient.auth.getUser(jwt);
    if (authError || !user) return reply({ error: "Invalid login" }, 401);

    const { data: adminRecord, error: adminError } = await adminClient
      .from("admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (adminError) throw adminError;
    if (!adminRecord) return reply({ error: "Admin only" }, 403);

    if (action === "subscribe") {
      const sub = body.subscription;
      if (
        typeof sub?.endpoint !== "string" ||
        !sub.endpoint.startsWith("https://") ||
        typeof sub.keys?.p256dh !== "string" || !sub.keys.p256dh ||
        typeof sub.keys?.auth !== "string" || !sub.keys.auth
      ) return reply({ error: "Invalid subscription" }, 400);

      const { error } = await adminClient
        .from("customer_push_subscriptions")
        .upsert({
          endpoint: sub.endpoint,
          subscription: sub,
          card_id: null,
          active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: "endpoint" });
      if (error) throw error;
      return reply({ success: true, subscribed: true });
    }

    if (action === "test") {
      const { data: rows, error } = await adminClient
        .from("customer_push_subscriptions")
        .select("subscription")
        .is("card_id", null)
        .eq("active", true)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      const subscription = rows?.[0]?.subscription;
      if (!subscription?.endpoint || !subscription?.keys) {
        return reply({ error: "No active admin subscription" }, 404);
      }
      configureVapid();
      await webpush.sendNotification(
        subscription,
        JSON.stringify({
          title: "SALON ANAS 1 🔔",
          body: "Test erfolgreich! Deine Benachrichtigungen funktionieren.",
        }),
        { TTL: 60, urgency: "high" },
      );
      return reply({ success: true, sent: true });
    }

    if (action === "send") {
      const { subscription, title, message } = body;
      if (
        !subscription?.endpoint || !subscription?.keys?.p256dh ||
        !subscription?.keys?.auth || typeof message !== "string" || !message.trim()
      ) return reply({ error: "Invalid input" }, 400);
      configureVapid();
      await webpush.sendNotification(
        subscription,
        JSON.stringify({
          title: String(title || "SALON ANAS 1").slice(0, 80),
          body: message.slice(0, 240),
        }),
      );
      return reply({ success: true });
    }

    if (action === "notify_card") {
      const cardId = body.card_id;
      if (typeof cardId !== "string" ||
          !/^[0-9a-f-]{36}$/i.test(cardId)) {
        return reply({ error: "Invalid card ID" }, 400);
      }

      const { data: card, error: cardError } = await adminClient
        .from("loyalty_cards")
        .select("id, stamps, stamp_goal")
        .eq("id", cardId)
        .single();

      if (cardError || !card) {
        return reply({ error: "Card not found" }, 404);
      }

      const { data: rows, error } = await adminClient
        .from("customer_push_subscriptions")
        .select("subscription")
        .eq("card_id", cardId)
        .eq("active", true);

      if (error) throw error;

      const completed = card.stamps >= card.stamp_goal;
      const message = completed
        ? "🎁 Glückwunsch! Deine Belohnung ist bereit!"
        : `✂️ Neuer Stempel! Du hast jetzt ${card.stamps} von ${card.stamp_goal} Stempeln.`;

      configureVapid();
      // Customer notifications update

      let sent = 0;
      for (const row of rows || []) {
        try {
          await webpush.sendNotification(
            row.subscription,
            JSON.stringify({
              title: "SALON ANAS 1 🔔",
              body: message,
            }),
            { TTL: 3600 }
          );
          sent++;
        } catch (err) {
          console.error("Customer push failed:", err);
        }
      }

      return reply({ success: true, sent });
    }

    return reply({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error(error);
    return reply({ error: "Request failed" }, 500);
  }
});
