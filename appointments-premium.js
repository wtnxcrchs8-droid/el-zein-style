/* SALON ANAS 1 — Premium appointments tab navigation */
(function(){
"use strict";
const root=document.getElementById("adminView");
const page=root?.querySelector('.sa6-appointments');
if(!page)return;
const tabs=[...page.querySelectorAll("[data-sa6-tab]")];
const panels={upcoming:document.getElementById("appointmentsPanel"),new:document.getElementById("appointmentForm")};
function showTab(key){
 const active=key==="new"?"new":"upcoming";
 tabs.forEach(button=>{
  const isActive=button.dataset.sa6Tab===active;
  button.setAttribute("aria-selected",String(isActive));
  button.tabIndex=isActive?0:-1;
 });
 Object.entries(panels).forEach(([name,panel])=>{if(panel)panel.hidden=name!==active});
}
window.sa6ShowAppointmentTab=showTab;
tabs.forEach(button=>{
 button.addEventListener("click",()=>showTab(button.dataset.sa6Tab));
 button.addEventListener("keydown",event=>{
  if(event.key!=="ArrowLeft"&&event.key!=="ArrowRight")return;
  event.preventDefault();
  const next=button.dataset.sa6Tab==="new"?"upcoming":"new";
  showTab(next);page.querySelector('[data-sa6-tab="'+next+'"]')?.focus();
 });
});
document.getElementById("sa6NewFromList")?.addEventListener("click",()=>{
 showTab("new");window.scrollTo({top:0,behavior:"smooth"});
});
const date=document.getElementById("appointmentDate");
if(date){const berlin=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());date.min=berlin}
showTab("upcoming");
})();