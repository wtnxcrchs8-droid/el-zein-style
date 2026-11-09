import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-push-cron-secret","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
 if(req.method!=='POST') return json({error:'POST required'},405);
 const url=Deno.env.get('SUPABASE_URL')!, service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const pub=Deno.env.get('VAPID_PUBLIC_KEY')!, priv=Deno.env.get('VAPID_PRIVATE_KEY')!, subject=Deno.env.get('VAPID_SUBJECT')||'mailto:admin@salon-anas.de';
 webpush.setVapidDetails(subject,pub,priv);
 const admin=createClient(url,service);
 const body=await req.json().catch(()=>({}));
 const cronSecret=Deno.env.get('PUSH_CRON_SECRET');
 const isCron=!!cronSecret && req.headers.get('x-push-cron-secret')===cronSecret;
 const auth=req.headers.get('Authorization')||'';
 let isAdmin=false;
 if(!isCron && auth.startsWith('Bearer ')){
   const jwt=auth.replace(/^Bearer\s+/i,'');
   const {data:{user}}=await admin.auth.getUser(jwt);
   if(user){const {data}=await admin.from('admins').select('user_id').eq('user_id',user.id).maybeSingle();isAdmin=!!data;}
 }
 if(!isCron && !isAdmin) return json({error:'Not authorized'},401);
 const sendOne=async(sub:any,payload:any)=>{try{await webpush.sendNotification(sub,JSON.stringify(payload));return true;}catch(e){const status=(e as any)?.statusCode;if(status===404||status===410){await admin.from('customer_push_subscriptions').update({active:false}).eq('endpoint',sub.endpoint);await admin.from('admin_push_subscriptions').update({active:false}).eq('endpoint',sub.endpoint);}return false;}};
 if(body.action==='test'){
   const {data:subs}=await admin.from('admin_push_subscriptions').select('subscription').eq('active',true);
   let sent=0;for(const s of subs||[]) if(await sendOne(s.subscription,{title:'SALON ANAS 1',body:'Testbenachrichtigung erfolgreich!'}))sent++;
   return json({sent});
 }
 if(body.action==='broadcast'){
   if(!isAdmin) return json({error:'Admin required'},401);
   const title=String(body.title||'SALON ANAS 1').slice(0,80), message=String(body.message||'').slice(0,240);
   if(!message) return json({error:'Nachricht fehlt'},400);
   const {data:subs}=await admin.from('customer_push_subscriptions').select('subscription').eq('active',true);
   let sent=0;for(const s of subs||[]) if(await sendOne(s.subscription,{title,body:message}))sent++;
   return json({sent,total:(subs||[]).length});
 }
 if(body.action==='daily-reminders' && isCron){
   const {data:cards,error}=await admin.from('loyalty_cards').select('id,created_at,stamp_events(created_at)').order('created_at');
   if(error) return json({error:error.message},500);
   let sent=0;
   for(const card of cards||[]){
     const events=(card as any).stamp_events||[];
     const lastVisit=events.length?events.map((e:any)=>new Date(e.created_at)).sort((a:Date,b:Date)=>b.getTime()-a.getTime())[0]:new Date(card.created_at);
     const cycle=lastVisit.toISOString(); const days=(Date.now()-lastVisit.getTime())/86400000;
     if(days<10) continue;
     const {data:existing}=await admin.from('push_notification_log').select('reminder_number,notification_type').eq('card_id',card.id).eq('cycle_visit_at',cycle);
     const rows=existing||[];let type='initial',number=0,title='SALON ANAS 1',message='Zeit für deinen nächsten Besuch! Wir freuen uns auf dich.';
     if(rows.length===0){ if(days<10)continue; }
     else {const reminders=rows.filter((r:any)=>r.notification_type==='reminder').map((r:any)=>r.reminder_number);number=(reminders.length?Math.max(...reminders):0)+1;type='reminder';if(days<10+number*2)continue;title='Wir vermissen dich!';message='Besuche uns bald wieder. Wir freuen uns auf dich!';}
     const {data:subs}=await admin.from('customer_push_subscriptions').select('subscription').eq('card_id',card.id).eq('active',true);
     let any=false;for(const s of subs||[]) if(await sendOne(s.subscription,{title,body:message}))any=true;
     if(any){await admin.from('push_notification_log').insert({card_id:card.id,cycle_visit_at:cycle,notification_type:type,reminder_number:number,title,body:message});sent++;}
   }
   return json({sent});
 }
 return json({error:'Unknown action'},400);
});
