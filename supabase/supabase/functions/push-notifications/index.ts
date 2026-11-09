
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json({ error: "POST required" }, { status: 405 });
    }

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.app_metadata?.role !== "admin") {
      return Response.json({ error: "Admin only" }, { status: 403 });
    }

    const { subscription, title, message } = await req.json();

    if (!subscription?.endpoint || !subscription?.keys?.p256dh ||
        !subscription?.keys?.auth || !message) {
      return Response.json({ error: "Invalid input" }, { status: 400 });
    }

    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT")!,
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!
    );

    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: String(title || "EL ZEIN STYLE").slice(0, 80),
        body: String(message).slice(0, 240)
      })
    );

    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { error: String(error) },
      { status: 500 }
    );
  }
});
