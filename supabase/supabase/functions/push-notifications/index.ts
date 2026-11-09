
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "https://el-zein-style.vercel.app",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

function reply(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}

function cleanVapidKey(value: string | undefined) {
  return (value || "")
    .trim()
    .replace(/^["'`]+|["'`,;]+$/g, "")
    .replace(/\s+/g, "")
    .replace(/=+$/g, "");
}

function configureVapid() {
  const subject = (Deno.env.get("VAPID_SUBJECT") || "").trim();
  const publicKey = cleanVapidKey(Deno.env.get("VAPID_PUBLIC_KEY"));
  const privateKey = cleanVapidKey(Deno.env.get("VAPID_PRIVATE_KEY"));

  if (!/^[A-Za-z0-9_-]{87}$/.test(publicKey)) {
    throw new Error("VAPID_PUBLIC_KEY format invalid");
  }

  if (!/^[A-Za-z0-9_-]{43}$/.test(privateKey)) {
    throw new Error(
      "VAPID_PRIVATE_KEY format invalid. Check the secret value."
    );
  }

  if (!/^mailto:\S+@\S+\.\S+$/.test(subject) &&
      !/^https?:\/\/\S+$/.test(subject)) {
    throw new Error("VAPID_SUBJECT format invalid");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  if (req.method !== "POST") {
    return reply({ error: "POST required" }, 405);
  }

  try {
    const jwt = req.headers.get("Authorization")
      ?.replace(/^Bearer /i, "");

    if (!jwt) {
      return reply({ error: "Login required" }, 401);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(url, anonKey);

    const { data: { user }, error: authError } =
      await authClient.auth.getUser(jwt);

    if (authError || !user) {
      return reply({ error: "Invalid login" }, 401);
    }

    const adminClient = createClient(url, serviceKey);
    const body = await req.json();
    const action = body.action || "send";

    const { data: adminRecord, error: adminError } =
      await adminClient
        .from("admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (adminError) throw adminError;

    const isAdmin = !!adminRecord;

    if (action === "subscribe") {
      if (!isAdmin) {
        return reply({ error: "Admin only" }, 403);
      }

      const sub = body.subscription;

      if (
        typeof sub?.endpoint !== "string" ||
        !sub.endpoint.startsWith("https://") ||
        !sub.keys?.p256dh ||
        !sub.keys?.auth
      ) {
        return reply({ error: "Invalid subscription" }, 400);
      }

      const { error } = await adminClient
        .from("customer_push_subscriptions")
        .upsert({
          endpoint: sub.endpoint,
          subscription: sub,
          active: true,
          updated_at: new Date().toISOString()
        }, { onConflict: "endpoint" });

      if (error) throw error;

      return reply({ success: true, subscribed: true });
    }

    if (action === "test") {
      if (!isAdmin) {
        return reply({ error: "Admin only" }, 403);
      }

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
          title: "Salon Anas 1 🔔",
          body: "Test erfolgreich! Deine Benachrichtigungen funktionieren."
        }),
        { TTL: 60, urgency: "high" }
      );

      return reply({ success: true, sent: true });
    }

    if (action === "send") {
      if (!isAdmin) {
        return reply({ error: "Admin only" }, 403);
      }

      const { subscription, title, message } = body;

      if (
        !subscription?.endpoint ||
        !subscription?.keys?.p256dh ||
        !subscription?.keys?.auth ||
        typeof message !== "string" ||
        !message.trim()
      ) {
        return reply({ error: "Invalid input" }, 400);
      }

      configureVapid();

      await webpush.sendNotification(
        subscription,
        JSON.stringify({
          title: String(title || "EL ZEIN STYLE").slice(0, 80),
          body: message.slice(0, 240)
        })
      );

      return reply({ success: true });
    }

    return reply({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error(error);
    return reply({ error: "Request failed" }, 500);
  }
});
