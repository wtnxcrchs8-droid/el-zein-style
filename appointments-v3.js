/* SA Club Admin Termine v3 — small customer-style date & hairstyle selector.
   UI-only enhancement; original authenticated appointment save remains in index.html. */
(function(){
"use strict";
const root=document.querySelector("#adminView .sa10-appointments");
if(!root)return;
const byId=id=>document.getElementById(id);
const dateInput=byId("appointmentDate"),timeInput=byId("appointmentTime"),serviceSelect=byId("appointmentService");
const calendar=byId("sa10CalendarDays"),monthTitle=byId("sa10MonthTitle");
const prev=byId("sa10PrevMonth"),next=byId("sa10NextMonth");
const timeBox=byId("sa10Times"),serviceBox=byId("sa10Services");
if(!dateInput||!timeInput||!serviceSelect||!calendar||!monthTitle||!prev||!next||!timeBox||!serviceBox)return;
const pad=n=>String(n).padStart(2,"0");
const iso=d=>d.getUTCFullYear()+"-"+pad(d.getUTCMonth()+1)+"-"+pad(d.getUTCDate());
function utcDay(s){
 const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
 return m?new Date(Date.UTC(+m[1],+m[2]-1,+m[3])):new Date();
}
function addDays(s,days){const d=utcDay(s);d.setUTCDate(d.getUTCDate()+days);return iso(d)}
function inBerlin(){
 const date=new Date(),parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date);
 const pick=k=>parts.find(p=>p.type===k)?.value||"00";
 return {date:pick("year")+"-"+pick("month")+"-"+pick("day"),minute:+pick("hour")*60+(+pick("minute"))};
}
const today=inBerlin().date;
function openDay(s){return utcDay(s).getUTCDay()!==0}
function firstOpen(s){let x=s;while(!openDay(x))x=addDays(x,1);return x}
let selected=dateInput.value&&dateInput.value>=today&&openDay(dateInput.value)?dateInput.value:firstOpen(today);
let viewDate=selected,mode="week";
const modeToggle=document.createElement("button");
modeToggle.id="sa10CalendarMode";modeToggle.type="button";modeToggle.className="sa10-cal-toggle";
modeToggle.setAttribute("aria-controls","sa10CalendarDays");
byId("sa10Calendar")?.append(modeToggle);
function validDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&s>=today&&openDay(s)}
function drawCalendar(){
 calendar.replaceChildren();
 const anchor=utcDay(viewDate);
 const weekStart=utcDay(viewDate);
 weekStart.setUTCDate(weekStart.getUTCDate()-((weekStart.getUTCDay()+6)%7));
 const dates=[];
 if(mode==="week"){
  for(let i=0;i<7;i++)dates.push(iso(new Date(weekStart.getTime()+i*86400000)));
 }else{
  const y=anchor.getUTCFullYear(),month=anchor.getUTCMonth();
  const startOffset=(new Date(Date.UTC(y,month,1)).getUTCDay()+6)%7;
  const days=new Date(Date.UTC(y,month+1,0)).getUTCDate();
  for(let i=0;i<startOffset;i++)dates.push(null);
  for(let d=1;d<=days;d++)dates.push(iso(new Date(Date.UTC(y,month,d))));
 }
 const shown=mode==="week"?weekStart:anchor;
 monthTitle.textContent=new Intl.DateTimeFormat("de-DE",{timeZone:"UTC",month:"long",year:"numeric"}).format(shown);
 dates.forEach(value=>{
  if(!value){const filler=document.createElement("span");filler.className="sa10-day-empty";calendar.append(filler);return}
  const day=utcDay(value),isSunday=day.getUTCDay()===0;
  const button=document.createElement("button");
  button.type="button";button.dataset.date=value;
  button.textContent=String(day.getUTCDate());
  button.className=isSunday?"sa10-sunday":"";
  button.disabled=!validDate(value);
  button.setAttribute("aria-pressed",String(value===selected));
  button.setAttribute("aria-label",new Intl.DateTimeFormat("de-DE",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(day)+(isSunday?", geschlossen":""));
  button.addEventListener("click",()=>{
   if(button.disabled)return;
   selected=value;viewDate=value;dateInput.value=value;
   dateInput.dispatchEvent(new Event("change",{bubbles:true}));
   timeInput.value="";drawCalendar();drawTimes();
  });
  calendar.append(button);
 });
 const previous=mode==="week"?
  addDays(iso(weekStart),-1)<today:
  iso(new Date(Date.UTC(anchor.getUTCFullYear(),anchor.getUTCMonth(),0)))<today;
 prev.disabled=previous;
 modeToggle.textContent=mode==="week"?"Ganzer Monat anzeigen ▾":"Woche anzeigen ▴";
 modeToggle.setAttribute("aria-expanded",String(mode==="month"));
}
function changeView(delta){
 if(mode==="week"){
  viewDate=addDays(viewDate,7*delta);
 }else{
  const d=utcDay(viewDate);
  const month=d.getUTCMonth()+delta;
  const y=d.getUTCFullYear();
  const day=d.getUTCDate();
  // Keep date within the new month (avoid overflow e.g. 31st -> next next month).
  const last=new Date(Date.UTC(y,month+1,0)).getUTCDate();
  viewDate=iso(new Date(Date.UTC(y,month,Math.min(day,last))));
 }
 drawCalendar();
}
prev.addEventListener("click",()=>changeView(-1));
next.addEventListener("click",()=>changeView(1));
modeToggle.addEventListener("click",()=>{
 mode=mode==="week"?"month":"week";
 viewDate=selected;drawCalendar();
});
dateInput.value=selected;
dateInput.min=today;
let occupied=new Set(),availabilityDay="",availabilityLoading=false,availabilitySeq=0;
async function refreshAvailability(){
 const day=dateInput.value,request=++availabilitySeq;
 availabilityLoading=true;drawTimes();
 try{
  const {data,error}=await db.from("salon_appointments").select("start_time").eq("appointment_date",day).in("status",["pending","confirmed"]);
  if(request!==availabilitySeq||day!==dateInput.value)return false;
  if(error)throw error;
  occupied=new Set((data||[]).map(a=>a.start_time.slice(0,5)));
  availabilityDay=day;return true;
 }catch(error){
  availabilityDay="";
  const box=byId("appointmentMsg");if(box)box.textContent="Verfügbarkeit konnte nicht geladen werden. Bitte erneut versuchen.";
  return false;
 }finally{if(request===availabilitySeq){availabilityLoading=false;drawTimes()}}
}
dateInput.addEventListener("change",refreshAvailability);
function drawTimes(){
 timeBox.replaceChildren();
 const now=inBerlin(),sameDay=selected===now.date;
 const chosen=timeInput.value.slice(0,5);
 let validChosen=false;
 for(let mins=9*60+30;mins<=18*60+30;mins+=30){
  const time=pad(Math.floor(mins/60))+":"+pad(mins%60);
  const b=document.createElement("button");
  b.type="button";b.textContent=time;b.dataset.time=time;
  const tooEarly=sameDay&&mins<=now.minute;
  const booked=availabilityDay===selected&&occupied.has(time);
  b.disabled=tooEarly||booked||availabilityLoading||availabilityDay!==selected;
  b.classList.toggle("sa10-booked",booked);
  b.title=booked?"Bereits gebucht":b.disabled?"Nicht verfügbar":"Verfügbar";
  if(booked){const label=document.createElement("small");label.textContent="Belegt";b.append(label)}
  if(chosen===time&&!b.disabled)validChosen=true;
  b.setAttribute("aria-pressed",String(chosen===time&&!b.disabled));
  b.addEventListener("click",()=>{
   if(b.disabled)return;
   timeInput.value=time;
   timeInput.dispatchEvent(new Event("change",{bubbles:true}));
   drawTimes();
  });
  timeBox.append(b);
 }
 if(!validChosen&&!availabilityLoading)timeInput.value="";
}
function syncServices(){
 const current=serviceSelect.value||"Haarschnitt";
 for(const b of serviceBox.querySelectorAll("[data-sa10-service]")){
  const on=b.dataset.sa10Service===current;
  b.setAttribute("aria-pressed",String(on));
  b.classList.toggle("selected",on);
  b.querySelector(".sa10-style-check").textContent=on?"✓":"○";
 }
}
serviceBox.querySelectorAll("[data-sa10-service]").forEach(b=>b.addEventListener("click",()=>{
 serviceSelect.value=b.dataset.sa10Service;
 serviceSelect.dispatchEvent(new Event("change",{bubbles:true}));
 syncServices();
}));
serviceSelect.addEventListener("change",syncServices);
syncServices();drawCalendar();drawTimes();refreshAvailability();
/* Support previous quick-action links and show the selected service when
   an admin returns to this page. */
window.sa10RefreshAppointments=function(){
 const date=dateInput.value;
 if(date&&validDate(date)&&date!==selected){selected=date;viewDate=date;drawCalendar();}
 syncServices();drawTimes();refreshAvailability();
};
// Ensure the original save handler never receives a past/Sunday date or
// unselected/expired time. Capture before existing inline click handler.
byId("appointmentSave")?.addEventListener("click",event=>{
 const d=dateInput.value,t=timeInput.value,c=byId("appointmentCustomer")?.value;
 const now=inBerlin(),mins=t?Number(t.slice(0,2))*60+Number(t.slice(3,5)):-1;
 let error="";
 if(!c)error="Bitte zuerst einen Kunden auswählen.";
 else if(!validDate(d))error="Bitte ein Datum von Montag bis Samstag wählen.";
 else if(!t||mins<570||mins>1110||mins%30!==0)error="Bitte eine Uhrzeit zwischen 09:30 und 18:30 wählen.";
 else if(d===now.date&&mins<=now.minute)error="Die gewählte Uhrzeit liegt bereits in der Vergangenheit.";
 if(error){
  event.preventDefault();event.stopImmediatePropagation();
  const box=byId("appointmentMsg");
  if(box){box.replaceChildren();const p=document.createElement("div");p.className="notice error";p.textContent=error;box.append(p)}
 }
},{capture:true});
let saving=false;
byId("appointmentSave")?.addEventListener("click",async event=>{
 event.preventDefault();event.stopImmediatePropagation();
 if(saving)return;
 const day=dateInput.value,time=timeInput.value;
 if(!time)return;
 saving=true;
 try{
  const ok=await refreshAvailability();
  if(!ok||day!==dateInput.value)return;
  if(occupied.has(time)){
   timeInput.value="";drawTimes();
   byId("appointmentMsg").textContent="Diese Uhrzeit ist bereits gebucht. Bitte eine andere wählen.";
   return;
  }
  timeInput.value=time;
  await byId("appointmentSave").onclick?.call(byId("appointmentSave"),event);
  await refreshAvailability();
 }finally{saving=false}
},{capture:true});
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refreshAvailability()});
setInterval(()=>{if(!document.hidden&&root.getClientRects().length)refreshAvailability()},15000);
const style=document.createElement("style");style.textContent="#sa10Times button.sa10-booked{opacity:.65;background:#41251c;border-color:#a86649;color:#e5b49b;cursor:not-allowed}#sa10Times button.sa10-booked small{display:block;font-size:8px;line-height:1.1;font-weight:600}";document.head.append(style);
})();
