/* SALON ANAS 1 — manager-controlled service prices and promotions.
   All writes are protected by authenticated manager RLS in Supabase.
   Customer views only SELECT public catalog and current promotions. */
(function(){
"use strict";
const byId=id=>document.getElementById(id);
const publicPrices=byId("sa9PublicPrices");
const publicOffers=byId("sa9PublicOffers");
const adminRoot=byId("adminView");
const managerPage=adminRoot?.querySelector('[data-admin-page="management"]');
if(!managerPage||!publicPrices||!publicOffers)return;
const client=typeof db==="undefined"?null:db;
if(!client)return;
const formatMoney=value=>new Intl.NumberFormat("de-DE",{minimumFractionDigits:0,maximumFractionDigits:2}).format(Number(value)||0);
const todayBerlin=()=>{
 const v=new Intl.DateTimeFormat("de-DE",{timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const part=t=>v.find(x=>x.type===t)?.value||"";
 return part("year")+"-"+part("month")+"-"+part("day");
};
const el=(tag,cls,text)=>{
 const n=document.createElement(tag);
 if(cls)n.className=cls;
 if(text!==undefined)n.textContent=text;
 return n;
};
let services=[],offers=[],editingId=null,loadingAdmin=null,loadingPublic=null;
function announce(message,error=false){
 const target=byId("sa9Info");
 if(!target)return;
 target.textContent=message;
 target.dataset.error=String(error);
}
function validCurrent(offer){
 const day=todayBerlin();
 return offer.is_active===true &&
  (!offer.starts_on||offer.starts_on<=day) &&
  (!offer.ends_on||offer.ends_on>=day);
}
function renderCustomerServices(rows){
 publicPrices.replaceChildren();
 if(!rows.length){publicPrices.append(el("p","sa9-empty","Preisliste zurzeit nicht verfügbar."));return}
 rows.forEach(item=>{
  const line=el("div");
  line.append(el("span","",item.name),el("strong","",(item.is_from_price?"ab ":"")+formatMoney(item.price_eur)+" €"));
  publicPrices.append(line);
 });
}
function renderCustomerOffers(rows){
 publicOffers.replaceChildren();
 const current=rows.filter(validCurrent);
 if(!current.length){
  publicOffers.append(el("p","sa9-empty","Aktuell keine zusätzlichen Angebote. Schau bald wieder vorbei!"));
  return;
 }
 current.forEach(item=>{
  const card=el("article","sa9-offer-public");
  card.append(el("strong","",item.title));
  if(item.description)card.append(el("p","",item.description));
  if(item.price_label)card.append(el("b","",item.price_label));
  if(item.ends_on){
   const d=item.ends_on.split("-");
   card.append(el("small","","Gültig bis "+d[2]+"."+d[1]+"."+d[0]));
  }
  publicOffers.append(card);
 });
}
async function loadCustomerCatalog(){
 if(loadingPublic)return loadingPublic;
 loadingPublic=(async()=>{
  const [pricesResponse,offersResponse]=await Promise.all([
   client.from("salon_services").select("id,name,price_eur,is_from_price,sort_order").order("sort_order",{ascending:true}),
   client.from("salon_offers").select("id,title,description,price_label,starts_on,ends_on,is_active").order("created_at",{ascending:false})
  ]);
  if(pricesResponse.error){
   renderCustomerServices([]);
  }else renderCustomerServices(pricesResponse.data||[]);
  if(offersResponse.error){
   publicOffers.replaceChildren(el("p","sa9-empty","Angebote konnten nicht geladen werden."));
  }else renderCustomerOffers(offersResponse.data||[]);
 })().finally(()=>{loadingPublic=null});
 return loadingPublic;
}
function renderManagerPrices(){
 const list=byId("sa9ServiceList");if(!list)return;
 list.replaceChildren();
 if(!services.length){list.append(el("p","sa9-empty","Keine Leistungen gefunden."));return}
 for(const item of services){
  const row=el("div","sa9-service-row");
  const name=el("div","sa9-service-name",item.name);
  const hint=el("span","",item.is_from_price?"Ab-Preis":"Festpreis");
  name.append(hint);
  const controls=el("div","sa9-service-controls");
  const input=el("input","sa9-service-price");
  input.type="number";input.step="0.01";input.min="0";input.max="10000";
  input.inputMode="decimal";input.value=Number(item.price_eur).toFixed(2);
  input.setAttribute("aria-label","Preis für "+item.name+" in Euro");
  const fromLabel=el("label","sa9-from-label");
  const from=el("input");from.type="checkbox";from.checked=item.is_from_price;
  fromLabel.append(from,document.createTextNode("ab"));
  controls.append(input);
  name.append(fromLabel);
  const save=el("button","","Speichern");
  save.type="button";
  save.addEventListener("click",async()=>{
   const num=Number(String(input.value).replace(",","."));
   if(!Number.isFinite(num)||num<0||num>10000||input.value===""){
    announce("Bitte einen gültigen Preis zwischen 0 und 10.000 € eingeben.",true);return;
   }
   save.disabled=true;
   const {data,error}=await client.from("salon_services")
    .update({price_eur:Math.round(num*100)/100,is_from_price:from.checked,updated_at:new Date().toISOString()})
    .eq("id",item.id).select("id");
   save.disabled=false;
   if(error||!data?.length){announce("Preis konnte nicht gespeichert werden: "+(error?.message||"Keine Berechtigung"),true);return}
   announce(item.name+": Preis gespeichert. Kunden sehen den neuen Preis.");
   await Promise.all([loadManager(),loadCustomerCatalog()]);
  });
  row.append(name,controls,save);
  list.append(row);
 }
}
function labelDate(date){
 if(!date)return"";
 const [y,m,d]=date.split("-");
 return d+"."+m+"."+y;
}
function renderManagerOffers(){
 const list=byId("sa9OfferList");if(!list)return;
 list.replaceChildren();
 const count=byId("sa9OfferTotal");
 if(count)count.textContent=offers.length+" "+(offers.length===1?"Aktion":"Aktionen");
 if(!offers.length){
  list.append(el("p","sa9-empty","Noch keine Angebote. Erstelle deine erste Aktion oben."));
  return;
 }
 offers.forEach(item=>{
  const card=el("article","sa9-offer-row");
  card.append(el("h4","",item.title));
  if(item.description)card.append(el("p","",item.description));
  const period=[item.starts_on?"Ab "+labelDate(item.starts_on):"",item.ends_on?"Bis "+labelDate(item.ends_on):""].filter(Boolean).join(" · ");
  if(item.price_label||period)card.append(el("p","sa9-offer-meta",[item.price_label,period].filter(Boolean).join(" · ")));
  const state=el("span","sa9-offer-state"+(validCurrent(item)?" is-active":""),validCurrent(item)?"Öffentlich sichtbar":item.is_active?"Geplant / abgelaufen":"Deaktiviert");
  card.append(state);
  const actions=el("div","sa9-offer-actions");
  const edit=el("button","","Bearbeiten");
  edit.type="button";edit.addEventListener("click",()=>editOffer(item));
  const toggle=el("button","",item.is_active?"Ausschalten":"Aktivieren");
  toggle.type="button";
  toggle.addEventListener("click",async()=>{
   toggle.disabled=true;
   const {data,error}=await client.from("salon_offers")
    .update({is_active:!item.is_active,updated_at:new Date().toISOString()})
    .eq("id",item.id).select("id");
   toggle.disabled=false;
   if(error||!data?.length){announce("Änderung fehlgeschlagen: "+(error?.message||"Keine Berechtigung"),true);return}
   announce(item.is_active?"Angebot deaktiviert.":"Angebot aktiviert.");
   await Promise.all([loadManager(),loadCustomerCatalog()]);
  });
  const remove=el("button","sa9-delete","Löschen");
  remove.type="button";
  remove.addEventListener("click",async()=>{
   if(!confirm("Angebot „"+item.title+"“ dauerhaft löschen?"))return;
   remove.disabled=true;
   const {data,error}=await client.from("salon_offers").delete().eq("id",item.id).select("id");
   remove.disabled=false;
   if(error||!data?.length){announce("Löschen fehlgeschlagen: "+(error?.message||"Keine Berechtigung"),true);return}
   announce("Angebot gelöscht.");if(editingId===item.id)resetOffer();
   await Promise.all([loadManager(),loadCustomerCatalog()]);
  });
  actions.append(edit,toggle,remove);
  card.append(actions);
  list.append(card);
 });
}
function resetOffer(){
 editingId=null;
 byId("sa9OfferHeading").textContent="Neues Angebot erstellen";
 byId("sa9OfferSave").textContent="✦ Angebot speichern";
 for(const id of ["sa9OfferTitle","sa9OfferDescription","sa9OfferPrice","sa9OfferFrom","sa9OfferUntil"])byId(id).value="";
 byId("sa9OfferActive").checked=true;
 byId("sa9OfferCancel").hidden=true;
}
function editOffer(item){
 editingId=item.id;
 const values={sa9OfferTitle:item.title,sa9OfferDescription:item.description,sa9OfferPrice:item.price_label,
 sa9OfferFrom:item.starts_on,sa9OfferUntil:item.ends_on};
 Object.entries(values).forEach(([key,value])=>byId(key).value=value||"");
 byId("sa9OfferActive").checked=item.is_active;
 byId("sa9OfferHeading").textContent="Angebot bearbeiten";
 byId("sa9OfferSave").textContent="Änderungen speichern";
 byId("sa9OfferCancel").hidden=false;
 byId("sa9OfferForm").scrollIntoView({block:"start",behavior:"smooth"});
}
async function isManager(){
 const {data,error}=await client.auth.getUser();
 if(error||!data?.user)return false;
 const result=await client.from("admins").select("user_id").eq("user_id",data.user.id).maybeSingle();
 return !result.error && Boolean(result.data);
}
async function loadManager(){
 if(loadingAdmin)return loadingAdmin;
 loadingAdmin=(async()=>{
  if(!await isManager()){announce("Nur Administratoren dürfen Preise und Angebote bearbeiten.",true);return}
  const [rs,ro]=await Promise.all([
   client.from("salon_services").select("*").order("sort_order",{ascending:true}),
   client.from("salon_offers").select("*").order("created_at",{ascending:false})
  ]);
  if(rs.error||ro.error){
   announce("Verwaltung konnte nicht geladen werden: "+(rs.error?.message||ro.error?.message),true);
   return;
  }
  services=rs.data||[];offers=ro.data||[];
  renderManagerPrices();renderManagerOffers();
 })().finally(()=>{loadingAdmin=null});
 return loadingAdmin;
}
window.sa9LoadManagement=loadManager;
function showManagerTab(mode){
 const isOffers=mode==="offers";
 byId("sa9PricesPane").hidden=isOffers;
 byId("sa9OffersPane").hidden=!isOffers;
 byId("sa9TabPrices").setAttribute("aria-selected",String(!isOffers));
 byId("sa9TabOffers").setAttribute("aria-selected",String(isOffers));
 if(isOffers)loadManager();
}
byId("sa9TabPrices")?.addEventListener("click",()=>showManagerTab("prices"));
byId("sa9TabOffers")?.addEventListener("click",()=>showManagerTab("offers"));
byId("sa9Refresh")?.addEventListener("click",async()=>{await loadManager();announce("Preise aktualisiert.")});
byId("sa9OfferCancel")?.addEventListener("click",resetOffer);
byId("sa9OfferSave")?.addEventListener("click",async()=>{
 if(!await isManager()){announce("Keine Administratorberechtigung.",true);return}
 const title=byId("sa9OfferTitle").value.trim();
 const description=byId("sa9OfferDescription").value.trim();
 const price_label=byId("sa9OfferPrice").value.trim();
 const starts_on=byId("sa9OfferFrom").value||null;
 const ends_on=byId("sa9OfferUntil").value||null;
 if(!title||title.length>100||description.length>500||price_label.length>45){
  announce("Bitte Titel (max. 100 Zeichen), Beschreibung und Aktionspreis prüfen.",true);return;
 }
 if(starts_on&&ends_on&&starts_on>ends_on){
  announce("Das Enddatum darf nicht vor dem Startdatum liegen.",true);return;
 }
 const payload={title,description,price_label,starts_on,ends_on,is_active:byId("sa9OfferActive").checked,updated_at:new Date().toISOString()};
 const btn=byId("sa9OfferSave");btn.disabled=true;
 const response=editingId?
  await client.from("salon_offers").update(payload).eq("id",editingId).select("id"):
  await client.from("salon_offers").insert(payload).select("id");
 btn.disabled=false;
 if(response.error||!response.data?.length){
  announce("Angebot konnte nicht gespeichert werden: "+(response.error?.message||"Keine Berechtigung"),true);return;
 }
 announce("Angebot gespeichert. Es erscheint bei den Kunden, wenn es aktiviert und gültig ist.");
 resetOffer();
 await Promise.all([loadManager(),loadCustomerCatalog()]);
});
byId("vipPriceTile")?.addEventListener("click",loadCustomerCatalog);
document.querySelectorAll('#publicView [data-vip-tab="angebote"]').forEach(btn=>btn.addEventListener("click",loadCustomerCatalog));
document.addEventListener("visibilitychange",()=>{if(!document.hidden)loadCustomerCatalog()});
// Public data is explicitly readable to anon; no account info is needed.
loadCustomerCatalog();
})();
