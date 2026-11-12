/* SA Club Live loyalty summary in manager home. Read-only, no database mutations. */
(function(){
"use strict";
const host=document.getElementById("sa7MemberList");if(!host)return;
const get=id=>document.getElementById(id);
const open=(page,target)=>typeof window.saAdminGo==="function"&&window.saAdminGo(page,target);
const all=get("sa7AllCards"),create=get("sa7CreateCard"),stamp=get("sa7StampCard");
all?.addEventListener("click",()=>open("customers"));
create?.addEventListener("click",()=>open("customers","customerName"));
stamp?.addEventListener("click",()=>open("customers","search"));
function renderClub(){
 const cards=Array.isArray(window.cards)?window.cards:[];
 const badge=get("sa7CardTotal"),label=get("sa7ClubStatus");
 if(badge)badge.textContent=String(cards.length);
 if(label)label.textContent=cards.length+" "+(cards.length===1?"KARTE":"KARTEN");
 const sorted=[...cards].sort((a,b)=>{
  const ap=Math.min(1,Number(a.stamps||0)/Math.max(1,Number(a.stamp_goal||6)));
  const bp=Math.min(1,Number(b.stamps||0)/Math.max(1,Number(b.stamp_goal||6)));
  return bp-ap || String(b.created_at||"").localeCompare(String(a.created_at||""));
 }).slice(0,3);
 host.replaceChildren();
 if(!sorted.length){
  const el=document.createElement("div");el.className="sa7-empty";
  el.textContent="Noch keine Treuekarten. Erstelle deine erste Kundenkarte.";
  host.append(el);return;
 }
 sorted.forEach(card=>{
  const name=(card.customers?.full_name||"Kunde").trim();
  const count=Math.max(0,Number(card.stamps)||0);
  const goal=Math.max(1,Number(card.stamp_goal)||6);
  const button=document.createElement("button");button.type="button";button.className="sa7-member";
  button.setAttribute("aria-label",name+": "+count+" von "+goal+" Stempeln, Karte öffnen");
  const avatar=document.createElement("span");avatar.className="sa7-avatar";
  avatar.textContent=name[0]?.toUpperCase()||"S";
  const person=document.createElement("span");person.className="sa7-person";
  const title=document.createElement("b");title.textContent=name;
  const track=document.createElement("span");track.className="sa7-track";
  const fill=document.createElement("span");fill.className="sa7-fill";
  fill.style.width=Math.min(100,100*count/goal)+"%";
  track.append(fill);person.append(title,track);
  const value=document.createElement("span");value.className="sa7-count";
  value.textContent=count+"/"+goal;
  button.append(avatar,person,value);
  button.addEventListener("click",()=>{
   open("customers");
   const search=get("search");
   if(search){search.value=name==="Kunde"?"":name;search.dispatchEvent(new Event("input",{bubbles:true}));}
  });
  host.append(button);
 });
}
for(const id of ["saCustomers","saStamps","saRewards"]){
 const node=get(id);
 if(node)new MutationObserver(renderClub).observe(node,{childList:true,characterData:true,subtree:true});
}
renderClub();
})();