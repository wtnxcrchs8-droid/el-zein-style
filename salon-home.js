/* SALON ANAS 1 · functional customer home actions.
 * Keeps existing QR, stamps, push opt-in/out and booking workflows intact. */
(function(){
 "use strict";
 const root=document.getElementById("publicView");
 if(!root)return;
 const byId=id=>document.getElementById(id);
 function showDialog(id){
  const dialog=byId(id);
  if(!dialog)return;
  if(dialog.open)return;
  if(typeof dialog.showModal==="function"){
   try{dialog.showModal();return}catch(e){console.warn("Dialog unavailable",e)}
  }
  // Basic browser fallback: keep dialogs functional in older embedded browsers.
  dialog.setAttribute("open","");
 }
 function closeDialog(dialog){
  if(!dialog)return;
  if(typeof dialog.close==="function"&&dialog.open){dialog.close();return}
  dialog.removeAttribute("open");
 }
 root.querySelectorAll("[data-sa-dialog-close]").forEach(button=>{
  button.addEventListener("click",()=>closeDialog(button.closest("dialog")));
 });
 for(const id of ["saPriceDialog","saContactDialog"]){
  const d=byId(id);if(!d)continue;
  d.addEventListener("click",event=>{
   const bounds=d.getBoundingClientRect();
   if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)closeDialog(d);
  });
 }
 byId("vipPriceTile")?.addEventListener("click",()=>showDialog("saPriceDialog"));
 byId("vipContactTile")?.addEventListener("click",()=>showDialog("saContactDialog"));
 function bookAppointment(){
  closeDialog(byId("saPriceDialog"));
  if(typeof window.vipShowTab==="function")window.vipShowTab("termine");
  else byId("vipAppointmentLink")?.click();
 }
 byId("vipBookTile")?.addEventListener("click",bookAppointment);
 byId("saPriceBook")?.addEventListener("click",bookAppointment);
 byId("vipAddHomeTile")?.addEventListener("click",()=>byId("installCardBtn")?.click());
 // Keep aria-friendly state on the existing push tile. The old handler
 // still handles opt-in and requires a warning before disabling opt-out.
 const push=byId("vipPushShortcut");
 if(push&&"serviceWorker" in navigator&&"PushManager" in window){
  navigator.serviceWorker.ready.then(reg=>reg.pushManager.getSubscription()).then(sub=>{
   if(sub)push.setAttribute("aria-label","Benachrichtigungen aktiviert: Klicken zum Ändern (mit Bestätigung beim Ausschalten)");
  }).catch(()=>{});
 }
})();
