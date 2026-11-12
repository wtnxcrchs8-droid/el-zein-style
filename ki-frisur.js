/* SA Club KI-Frisur Studio — customer photo stays in browser until explicit consent */
(function(){
"use strict";
const root=document.getElementById("kiFrisurStudio");if(!root)return;
const $=id=>document.getElementById(id);
const state={photo:null,originalUrl:null,style:"fade",result:null,ready:null,busy:false};
const imgFile=$("kiPhotoFile"),photo=$("kiInputPreview"),before=$("kiBefore"),after=$("kiAfter");
const consent=$("kiConsent"),generate=$("kiGenerate"),status=$("kiStatus"),badge=$("kiReadyBadge");
const opts=[...root.querySelectorAll("[data-ki-style]")];
function message(s,type="info"){status.textContent=s;status.dataset.status=type}
function updateButton(){
 generate.disabled=state.busy||!state.photo||!consent.checked;
 $("kiRegenerate").disabled=state.busy||!state.photo||!consent.checked;
 $("kiDownload").disabled=!state.result||state.busy;
 $("kiToAppointment").disabled=!state.result||state.busy;
 generate.textContent=state.busy?"KI analysiert dein Foto …":"✦ KI-Vorschau starten";
}
function clearResult(){
 state.result=null;after.removeAttribute("src");after.classList.remove("has-photo");
 $("kiAfterPlaceholder").style.display="";
 badge.textContent="Noch keine Vorschau";badge.classList.remove("ready");
 updateButton();
}
function chooseStyle(style){
 if(!["haircut","fade","hair_beard","beard"].includes(style))return;
 state.style=style;
 opts.forEach(btn=>btn.setAttribute("aria-pressed",String(btn.dataset.kiStyle===style)));
 clearResult();
 if(state.photo)message("Stil gewählt. Du kannst die Vorschau generieren.");
}
opts.forEach(btn=>btn.addEventListener("click",()=>chooseStyle(btn.dataset.kiStyle)));
function imageAsJpeg(file){
 return new Promise((resolve,reject)=>{
  const objectUrl=URL.createObjectURL(file),image=new Image();
  image.onload=()=>{
   try{
    const limit=1100,scale=Math.min(1,limit/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
    canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const ctx=canvas.getContext("2d");
    if(!ctx)throw Error("Foto konnte nicht verarbeitet werden.");
    ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const jpeg=canvas.toDataURL("image/jpeg",.84);
    URL.revokeObjectURL(objectUrl);
    if(jpeg.length>5600000)throw Error("Foto zu groß. Bitte ein kleineres Bild wählen.");
    resolve(jpeg);
   }catch(e){URL.revokeObjectURL(objectUrl);reject(e)}
  };
  image.onerror=()=>{URL.revokeObjectURL(objectUrl);reject(Error("Dieses Bildformat konnte nicht geladen werden. Bitte JPG oder PNG verwenden."))};
  image.src=objectUrl;
 });
}
imgFile.addEventListener("change",async()=>{
 const file=imgFile.files?.[0];if(!file)return;
 if(file.size>20*1024*1024){message("Foto zu groß. Bitte maximal 20 MB auswählen.","error");imgFile.value="";return}
 try{
  message("Foto wird vorbereitet …");
  const jpeg=await imageAsJpeg(file);
  if(state.originalUrl)URL.revokeObjectURL(state.originalUrl);
  state.originalUrl=URL.createObjectURL(file);state.photo=jpeg;
  photo.src=state.originalUrl;before.src=state.originalUrl;
  photo.parentElement.classList.add("has-photo");before.classList.add("has-photo");
  $("kiBeforePlaceholder").style.display="none";
  $("kiUploadLabel").textContent="✓ Foto hochgeladen";
  $("kiFileName").textContent=file.name;
  clearResult();
  message("Foto bereit. Bitte Einwilligung bestätigen und Stil wählen.");
 }catch(e){state.photo=null;message(e?.message||"Foto konnte nicht geladen werden.","error")}
 updateButton();
});
consent.addEventListener("change",updateButton);
async function invoke(action,payload={}){
 const {data:{session}}=await db.auth.getSession();
 if(!session?.access_token)throw Error("Bitte zuerst als Administrator anmelden.");
 const response=await fetch(SUPABASE_URL+"/functions/v1/hairstyle-preview",{
  method:"POST",
  headers:{"Content-Type":"application/json","apikey":SUPABASE_PUBLISHABLE_KEY,"Authorization":"Bearer "+session.access_token},
  body:JSON.stringify({action,...payload})
 });
 let json={};try{json=await response.json()}catch{}
 if(!response.ok||json.error)throw Error(json.error||"Serverfehler "+response.status);
 return json;
}
async function checkAvailability(){
 try{
  const r=await invoke("status");
  state.ready=!!r.ready;
  if(!r.ready)message("KI-Bildgenerierung noch nicht aktiviert: Dem Server fehlt der OpenAI-API-Schlüssel.","error");
  else if(!state.photo)message("Foto hochladen, Stil wählen und Einwilligung bestätigen.");
  else message("KI ist einsatzbereit.");
 }catch(e){
  state.ready=null;
  message("KI-Verbindung nicht verfügbar: "+(e?.message||"Verbindung fehlgeschlagen"),"error");
 }
 updateButton();
}
window.saKiOnOpen=checkAvailability;
async function runGeneration(){
 if(state.busy)return;
 if(!state.photo){message("Bitte zuerst ein Foto hochladen.","error");return}
 if(!consent.checked){message("Bitte die Einwilligung zur Fotoverarbeitung bestätigen.","error");return}
 if(state.ready===false){message("Die KI-Funktion braucht noch einen serverseitigen API-Schlüssel. Ohne ihn wird kein Foto übertragen.","error");return}
 state.busy=true;clearResult();updateButton();
 message("KI analysiert dein Foto und erstellt die Frisur …");
 try{
  const out=await invoke("generate",{image:state.photo,style:state.style,consent:true});
  if(typeof out.image!=="string"||!out.image.startsWith("data:image/"))throw Error("Keine Bildausgabe erhalten.");
  state.result=out.image;after.src=out.image;after.classList.add("has-photo");
  $("kiAfterPlaceholder").style.display="none";
  badge.textContent="✓ Vorschau bereit";badge.classList.add("ready");
  message("Deine KI-Vorschau ist fertig. Du kannst sie speichern oder einen Termin planen.","success");
  root.querySelector(".ki-result-title")?.scrollIntoView({behavior:"smooth",block:"start"});
 }catch(e){
  message(e?.message||"KI-Vorschau konnte nicht erstellt werden.","error");
 }
 finally{state.busy=false;updateButton()}
}
generate.addEventListener("click",runGeneration);
$("kiRegenerate").addEventListener("click",runGeneration);
$("kiDownload").addEventListener("click",()=>{
 if(!state.result)return;
 const a=document.createElement("a");a.href=state.result;
 a.download="salon-anas-ki-frisur-"+state.style+"-"+Date.now()+".jpg";
 document.body.append(a);a.click();a.remove();
});
$("kiToAppointment").addEventListener("click",()=>{
 if(!state.result)return;
 const desired={haircut:"Haarschnitt",fade:"Fade Cut",hair_beard:"Haarschnitt & Bart",beard:"Bart"}[state.style];
 window.saAdminGo?.("appointments","appointmentForm");
 window.sa6ShowAppointmentTab?.("new");
 const select=$("appointmentService");
 if(select&&desired)select.value=desired;
});
const navBtn=root.querySelector(".ki-topmenu button");
if(navBtn)navBtn.addEventListener("click",()=>window.saAdminGo?.("overview"));
window.addEventListener("pagehide",()=>{if(state.originalUrl)URL.revokeObjectURL(state.originalUrl)});
updateButton();
})();