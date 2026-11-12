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
})();
