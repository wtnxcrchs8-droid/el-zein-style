/* SALON ANAS 1 — premium customer cards interactions */
(function(){
"use strict";
const byId=id=>document.getElementById(id);
const form=byId("sa5CreateForm"),toggle=byId("sa5ToggleNewCard");
function openForm(){
  if(!form||!toggle)return;
  form.hidden=false;toggle.setAttribute("aria-expanded","true");toggle.querySelector("span").textContent="Formular schließen";
}
function closeForm(){
  if(!form||!toggle)return;
  form.hidden=true;toggle.setAttribute("aria-expanded","false");toggle.querySelector("span").textContent="+ Neue Karte";
}
window.sa5OpenForm=openForm;
toggle?.addEventListener("click",()=>{
  if(form.hidden){openForm();requestAnimationFrame(()=>byId("customerName")?.focus({preventScroll:false}))}
  else closeForm();
});
window.sa5CloseMenus=function(){
  document.querySelectorAll("#customerList .sa5-options:not([hidden])").forEach(el=>{
    el.hidden=true;el.closest(".sa5-card")?.classList.remove("sa5-menu-open");
    el.parentElement?.querySelector(".sa5-more")?.setAttribute("aria-expanded","false");
  });
};
document.addEventListener("pointerdown",event=>{
  if(!event.target.closest("#customerList .sa5-more, #customerList .sa5-options"))window.sa5CloseMenus();
});
const modal=byId("sa5QrOverlay"),img=byId("sa5QrImage"),link=byId("sa5QrLink"),name=byId("sa5QrName"),caption=byId("sa5QrUrl");
window.sa5OpenQr=async function(c){
  if(!modal||!c?.public_token)return;
  const url=location.origin+location.pathname+"?card="+encodeURIComponent(c.public_token);
  if(name)name.textContent=c.customers?.full_name||"Kunde";
  if(caption)caption.textContent=url;
  if(link)link.href=url;
  if(img){img.removeAttribute("src");img.alt="QR-Code der Kundenkarte";}
  modal.hidden=false;
  try{
    if(window.QRCode&&typeof window.QRCode.toDataURL==="function"){
      img.src=await window.QRCode.toDataURL(url,{width:230,margin:1,color:{dark:"#101010",light:"#ffffff"}});
    }else{
      img.src="https://api.qrserver.com/v1/create-qr-code/?size=230x230&data="+encodeURIComponent(url);
    }
  }catch{
    img.src="https://api.qrserver.com/v1/create-qr-code/?size=230x230&data="+encodeURIComponent(url);
  }
};
function closeQr(){if(modal)modal.hidden=true;if(img)img.removeAttribute("src")}
byId("sa5QrClose")?.addEventListener("click",closeQr);
modal?.addEventListener("click",event=>{if(event.target===modal)closeQr()});
document.addEventListener("keydown",event=>{if(event.key==="Escape"){closeQr();window.sa5CloseMenus()}});
window.sa5CopyLink=async function(url){
  try{
    if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);return true}
    window.prompt("Kartenlink kopieren:",url);return true;
  }catch{
    window.prompt("Kartenlink kopieren:",url);return false;
  }
};
})();