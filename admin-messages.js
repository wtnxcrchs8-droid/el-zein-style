/* SALON ANAS 1 — Nachrichten luxury UI controls. Sending stays in the existing authenticated push handler. */
(function(){
"use strict";
const root=document.querySelector('#adminView .sa8-messages');
if(!root)return;
const el=id=>document.getElementById(id);
const tabs=[...root.querySelectorAll('[data-sa8-mode]')];
const composer=el('sa8Composer'),testPanel=el('sa8TestPanel');
const recentPanel=el('sa8RecentDetails'),sendLabel=el('sa8SendLabel');
const textarea=el('broadcastMessage'),counter=el('sa8CharCount');
const selectMode=mode=>{
 if(!["all","recent","test"].includes(mode))return;
 window.sa8AudienceMode=mode;
 tabs.forEach(tab=>{
  const active=tab.dataset.sa8Mode===mode;
  tab.setAttribute('aria-selected',String(active));
  tab.tabIndex=active?0:-1;
 });
 if(composer)composer.hidden=mode==="test";
 if(testPanel)testPanel.hidden=mode!=="test";
 if(recentPanel)recentPanel.hidden=mode!=="recent";
 if(sendLabel)sendLabel.textContent=mode==="recent"?"An aktive senden":"An alle senden";
 // Refresh the backend counts and the disabled state for the selected group.
 if(typeof window.refreshAudience==="function")window.refreshAudience();
};
window.sa8UpdateControls=function(){
 // Used after the asynchronous audience check; do not change selection.
 const mode=window.sa8AudienceMode||"all";
 if(sendLabel)sendLabel.textContent=mode==="recent"?"An aktive senden":"An alle senden";
};
tabs.forEach((tab,index)=>{
 tab.addEventListener('click',()=>selectMode(tab.dataset.sa8Mode));
 tab.addEventListener('keydown',event=>{
  if(event.key!=="ArrowRight"&&event.key!=="ArrowLeft")return;
  event.preventDefault();
  const next=tabs[(index+(event.key==="ArrowRight"?1:-1)+tabs.length)%tabs.length];
  selectMode(next.dataset.sa8Mode);next.focus();
 });
});
function updateCounter(){
 const n=textarea?.value.length||0;
 if(counter){counter.textContent=n+'/240';counter.classList.toggle('is-full',n>=240)}
}
textarea?.addEventListener('input',updateCounter);
updateCounter();
el('sa8DoTest')?.addEventListener('click',()=>el('testPushBtn')?.click());
window.sa8AudienceMode="all";
tabs.forEach(tab=>{const active=tab.dataset.sa8Mode==="all";tab.setAttribute("aria-selected",String(active));tab.tabIndex=active?0:-1});
el('sendBroadcastBtn').disabled=true;
// Read-only list of recipients; names are shown only after admin authentication.
const recipientsList=el('sa8MemberList');
const filterButtons=[...root.querySelectorAll('[data-sa8-filter]')];
let currentCustomerFilter="all";
let customerStates=[];
let statusInFlight=null;
function statusDescription(item){
 const enabled=Number(item.enabled_devices)||0;
 const awaiting=Number(item.awaiting_consent_devices)||0;
 const disabled=Number(item.disabled_devices)||0;
 const parts=[];
 if(enabled)parts.push(enabled+" "+(enabled===1?"Push-Anmeldung mit Einwilligung":"Push-Anmeldungen mit Einwilligung"));
 if(awaiting)parts.push(awaiting+" Push-Anmeldungen ohne Einwilligung");
 if(disabled)parts.push(disabled+" deaktivierte Push-Anmeldungen");
 if(!parts.length)parts.push("Keine gespeicherte Push-Anmeldung");
 return parts.join(" · ");
}
const statusLabels={
 enabled:"✓ Aktiviert",
 needs_consent:"Ohne Einwilligung",
 disabled:"Deaktiviert",
 not_registered:"Nicht aktiviert"
};
function renderMembers(){
 if(!recipientsList)return;
 recipientsList.replaceChildren();
 const visible=customerStates.filter(item=>currentCustomerFilter==="all"||
  (currentCustomerFilter==="off"?["disabled","not_registered"].includes(item.status):item.status===currentCustomerFilter));
 if(!visible.length){
  const empty=document.createElement("div");empty.className="sa8-member-empty";
  empty.textContent=customerStates.length?"Keine Kunden mit diesem Status.":"Noch keine Kundenkarten vorhanden.";
  recipientsList.append(empty);
  return;
 }
 visible.forEach(item=>{
  const row=document.createElement("div");row.className="sa8-member";row.setAttribute("role","listitem");
  const avatar=document.createElement("span");avatar.className="sa8-member-icon";
  avatar.textContent=String(item.name||"K").trim().charAt(0).toLocaleUpperCase("de");
  const info=document.createElement("div");info.className="sa8-member-text";
  const name=document.createElement("strong");name.className="sa8-member-name";
  name.textContent=String(item.name||"Kunde");
  const detail=document.createElement("small");detail.className="sa8-member-sub";
  detail.textContent=statusDescription(item);
  info.append(name,detail);
  const state=document.createElement("span");state.className="sa8-member-state";
  state.dataset.state=item.status;
  state.textContent=statusLabels[item.status]||"Nicht bekannt";
  row.append(avatar,info,state);
  recipientsList.append(row);
 });
}
function useCustomerFilter(filter){
 if(!["all","enabled","needs_consent","off"].includes(filter))return;
 currentCustomerFilter=filter;
 filterButtons.forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.sa8Filter===filter)));
 renderMembers();
}
filterButtons.forEach(btn=>btn.addEventListener("click",()=>useCustomerFilter(btn.dataset.sa8Filter)));
async function loadCustomerStates(){
 if(statusInFlight)return statusInFlight;
 const reload=el("sa8ReloadMembers");
 if(reload)reload.disabled=true;
 if(recipientsList){
  recipientsList.replaceChildren();
  const loading=document.createElement("div");loading.className="sa8-member-empty";
  loading.textContent="Kundenstatus wird geladen …";recipientsList.append(loading);
 }
 statusInFlight=(async()=>{
  try{
   if(typeof pushRequest!=="function")throw Error("Push-Dienst nicht erreichbar.");
   const result=await pushRequest("recipients_status");
   if(!Array.isArray(result.customers))throw Error("Ungültige Antwort des Push-Dienstes.");
   customerStates=result.customers;
   // Count actual customers, NOT old device subscriptions. One customer can
   // have many push endpoints; only one active opt-in is needed to count as enabled.
   const enabledCustomers=customerStates.filter(item=>item.status==="enabled").length;
   const withoutActiveConsent=customerStates.length-enabledCustomers;
   const okCount=el("sa8ReadyCount"),needsCount=el("sa8PendingCount");
   if(okCount)okCount.textContent=String(enabledCustomers);
   if(needsCount)needsCount.textContent=String(withoutActiveConsent);
   renderMembers();
  }catch(error){
   // Unknown is preferable to reporting historic subscriptions as real customers.
   if(el("sa8ReadyCount"))el("sa8ReadyCount").textContent="—";
   if(el("sa8PendingCount"))el("sa8PendingCount").textContent="—";
   if(recipientsList){
    recipientsList.replaceChildren();
    const failure=document.createElement("div");failure.className="sa8-member-empty";
    failure.textContent="Kundenstatus konnte nicht geladen werden: "+(error?.message||"Unbekannter Fehler");
    recipientsList.append(failure);
   }
  }finally{
   if(reload)reload.disabled=false;
   statusInFlight=null;
  }
 })();
 return statusInFlight;
}
window.sa8LoadStatus=loadCustomerStates;
el("sa8ReloadMembers")?.addEventListener("click",loadCustomerStates);
el("refreshAudienceBtn")?.addEventListener("click",loadCustomerStates);
// The general audience counter is refreshed by the existing admin handlers.
if(typeof window.refreshAudience==="function")window.refreshAudience();
})();
