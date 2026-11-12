/* SA Club Admin v4 — isolated client-side presentation, leaves Supabase CRUD intact */
(function(){
"use strict";
const root=document.getElementById("adminView");
if(!root)return;
const byId=id=>document.getElementById(id);
const pages=["overview","appointments","customers","rewards","stats","messages"];
const menu=byId("sa4Menu");
function closeMenu(){if(menu){menu.hidden=true;byId("sa4MenuToggle")?.setAttribute("aria-expanded","false")}}
function go(page,focusId){
  if(!pages.includes(page))page="overview";
  root.querySelectorAll(".sa4-page").forEach(el=>el.classList.toggle("sa4-active",el.dataset.adminPage===page));
  root.querySelectorAll(".sa4-bottomnav [data-admin-target]").forEach(btn=>{
    const active=btn.dataset.adminTarget===page;
    if(active)btn.setAttribute("aria-current","page");else btn.removeAttribute("aria-current");
  });
  closeMenu();closeQr();closeAi();
  if(page==="rewards"||page==="stats")renderExtras();
  if(focusId){
    requestAnimationFrame(()=>{
      const el=byId(focusId);if(!el)return;
      el.scrollIntoView({behavior:"smooth",block:"center"});
      if(el.matches("input,textarea"))setTimeout(()=>el.focus({preventScroll:true}),200);
    });
  }else window.scrollTo({top:0,behavior:"smooth"});
}
window.saAdminGo=go;
root.querySelectorAll(".sa4-bottomnav [data-admin-target]").forEach(btn=>
  btn.addEventListener("click",()=>go(btn.dataset.adminTarget)));
byId("sa4MenuToggle")?.addEventListener("click",()=>{
  if(!menu)return;menu.hidden=!menu.hidden;
  byId("sa4MenuToggle").setAttribute("aria-expanded",String(!menu.hidden));
});
byId("sa4OpenMessages")?.addEventListener("click",()=>go("messages","broadcastTitle"));
root.querySelectorAll("[data-sa4-go]").forEach(btn=>btn.addEventListener("click",()=>{
  go(btn.dataset.sa4Go,btn.dataset.sa4Focus||undefined);
}));
byId("sa4LogoutMenu")?.addEventListener("click",()=>byId("logoutBtn")?.click());
const ai=byId("sa4AiOverlay");
function closeAi(){if(ai)ai.hidden=true}
byId("sa4OpenAi")?.addEventListener("click",()=>{if(ai)ai.hidden=false});
byId("sa4CloseAi")?.addEventListener("click",closeAi);
ai?.addEventListener("click",e=>{if(e.target===ai)closeAi()});
function copyEntries(sourceId,targetId,limit){
  const from=byId(sourceId),to=byId(targetId);if(!from||!to)return;
  const entries=[...from.querySelectorAll(".lux-entry")].slice(0,limit);
  to.replaceChildren();
  if(entries.length)entries.forEach(row=>to.appendChild(row.cloneNode(true)));
  else {const empty=document.createElement("p");empty.className="sa4-empty";empty.textContent=from.textContent.trim()||"Keine Einträge.";to.appendChild(empty)}
}
function syncLists(){
  copyEntries("appointmentList","sa4HomeAppointments",1);
  copyEntries("activityList","sa4HomeActivity",1);
}
["appointmentList","activityList"].forEach(id=>{
  const el=byId(id);
  if(el)new MutationObserver(syncLists).observe(el,{childList:true,subtree:true,characterData:true});
});
function renderExtras(){
  const cards=Array.isArray(window.cards)?window.cards:[];
  const rewardRows=byId("sa4RewardsList");
  if(rewardRows){
    rewardRows.replaceChildren();
    const ready=cards.filter(c=>Number(c.stamps)>=Number(c.stamp_goal)&&Number(c.stamp_goal)>0);
    if(!ready.length){const p=document.createElement("p");p.className="muted";p.textContent="Aktuell keine einlösbaren Belohnungen.";rewardRows.appendChild(p)}
    ready.forEach(c=>{
      const row=document.createElement("div");row.className="sa4-cardline";
      const label=document.createElement("div");const b=document.createElement("b");b.textContent=c.customers?.full_name||"Kunde";
      const sub=document.createElement("small");sub.textContent=c.stamps+"/"+c.stamp_goal+" Stempel · "+(c.reward||"Belohnung");
      label.append(b,sub);
      const btn=document.createElement("button");btn.type="button";btn.textContent="Karte öffnen";
      btn.addEventListener("click",()=>{
        go("customers","search");
        byId("search").value=c.customers?.full_name||c.customers?.phone||"";
        if(typeof window.render==="function")window.render();
      });row.append(label,btn);rewardRows.append(row);
    });
  }
  const totals={
    customers:new Set(cards.map(c=>c.customers?.phone||c.customers?.full_name||c.id)).size,
    cards:cards.length,
    stamps:cards.reduce((n,c)=>n+(Number(c.stamps)||0),0),
    rewards:cards.filter(c=>Number(c.stamps)>=Number(c.stamp_goal)&&Number(c.stamp_goal)>0).length
  };
  root.querySelectorAll("[data-sa4-value]").forEach(el=>{
    const key=el.dataset.sa4Value;
    el.textContent=key==="today"?(byId("saTodayAppointments")?.textContent||"—"):String(totals[key]??0);
  });
  const chart=byId("sa4StampChart");
  if(chart){
    chart.replaceChildren();
    const groups=[["0",c=>Number(c.stamps)===0],["1–2",c=>Number(c.stamps)>=1&&Number(c.stamps)<=2],["3–4",c=>Number(c.stamps)>=3&&Number(c.stamps)<=4],["5–6",c=>Number(c.stamps)>=5]];
    groups.forEach(([title,test])=>{
      const count=cards.filter(test).length;
      const row=document.createElement("div");row.className="sa4-chart-row";
      const lab=document.createElement("span");lab.textContent=title;
      const track=document.createElement("div");track.className="sa4-chart-track";
      const fill=document.createElement("div");fill.className="sa4-chart-fill";fill.style.width=(cards.length?100*count/cards.length:0)+"%";
      track.appendChild(fill);
      const val=document.createElement("strong");val.textContent=String(count);
      row.append(lab,track,val);chart.append(row);
    });
  }
}
["saCustomers","saStamps","saRewards","saTodayAppointments"].forEach(id=>{
  const el=byId(id);if(el)new MutationObserver(renderExtras).observe(el,{childList:true,characterData:true,subtree:true});
});
/* QR scanning uses on-device BarcodeDetector when supported, manual link fallback otherwise. */
const qrOverlay=byId("sa4QrOverlay"),video=byId("sa4Camera"),qrStatus=byId("sa4QrStatus");
let stream=null,scanning=false,qrFrame=0,detector=null;
function closeQr(){
  scanning=false;
  if(qrFrame)cancelAnimationFrame(qrFrame);qrFrame=0;
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}
  if(video)video.srcObject=null;
  if(qrOverlay)qrOverlay.hidden=true;
}
function applyQr(raw){
  let token="";try{const u=new URL(raw.trim(),location.origin);token=u.searchParams.get("card")||""}catch{}
  const card=(window.cards||[]).find(c=>c.public_token===token);
  if(!token||!card){if(qrStatus)qrStatus.textContent="Karte nicht gefunden. Bitte den vollständigen QR-Kartenlink verwenden.";return}
  const q=byId("search");
  if(q)q.value=card.customers?.full_name||card.customers?.phone||"";
  closeQr();go("customers","search");
  if(typeof window.render==="function")window.render();
}
async function qrTick(){
  if(!scanning)return;
  if(detector&&video?.readyState>=2){
    try{const hits=await detector.detect(video);if(hits?.length){applyQr(hits[0].rawValue);return}}catch{}
  }
  if(scanning)qrFrame=requestAnimationFrame(qrTick);
}
async function openQr(){
  if(!qrOverlay)return;
  qrOverlay.hidden=false;
  if(qrStatus)qrStatus.textContent="Kamera wird vorbereitet ...";
  if(!("BarcodeDetector" in window)){
    if(qrStatus)qrStatus.textContent="Dein Browser unterstützt den Kamera-Scan nicht. Bitte den Kartenlink unten einfügen.";
    return;
  }
  try{
    detector=new BarcodeDetector({formats:["qr_code"]});
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});
    video.srcObject=stream;await video.play();scanning=true;
    if(qrStatus)qrStatus.textContent="QR-Code in die Kamera halten.";
    qrTick();
  }catch(e){
    if(qrStatus)qrStatus.textContent="Kamera nicht verfügbar. Bitte den Kartenlink unten einfügen.";
    if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}
  }
}
byId("sa4OpenQr")?.addEventListener("click",openQr);
byId("sa4CloseQr")?.addEventListener("click",closeQr);
qrOverlay?.addEventListener("click",e=>{if(e.target===qrOverlay)closeQr()});
byId("sa4QrApply")?.addEventListener("click",()=>applyQr(byId("sa4QrInput")?.value||""));
byId("sa4QrInput")?.addEventListener("keydown",e=>{if(e.key==="Enter")applyQr(e.target.value)});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeQr();closeAi();closeMenu()}});
syncLists();renderExtras();go("overview");
})();
