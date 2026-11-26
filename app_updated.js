const KEY="myDailyAttendanceRecordsV1", SETTINGS_KEY="myDailyAttendanceSettingsV1";
const $=id=>document.getElementById(id);
const keyOf=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const dateText=k=>new Date(`${k}T12:00:00`).toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long",year:"numeric"});
function formatAmPm(date){
 const h=date.getHours(),m=String(date.getMinutes()).padStart(2,"0");
 const hour12=h%12||12,ampm=h>=12?"PM":"AM";
 return `${String(hour12).padStart(2,"0")}:${m} ${ampm}`;
}
const timeText=v=>v?formatAmPm(new Date(v)):"Not punched yet";
const readRecords=()=>{try{return JSON.parse(localStorage.getItem(KEY)||"{}")}catch{return {}}};
const readSettings=()=>{try{return JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}")}catch{return {}}};
let settings={startTime:"09:30",endTime:"18:00",graceMinutes:15,earlyGraceMinutes:0,monthlySalary:0,holidays:[],...readSettings()};
let viewMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1), selectedDate=keyOf(new Date());

function durationFor(r,live=false){
 if(!r?.in)return 0;
 const start=new Date(r.in).getTime(),end=r.out?new Date(r.out).getTime():(live?Date.now():start);
 return Math.max(0,Math.floor((end-start)/60000));
}
function durationText(min){return `${Math.floor(min/60)}h ${min%60}m`;}
function isOff(k){const d=new Date(`${k}T12:00:00`);return d.getDay()===0||settings.holidays.includes(k);}
function isLate(r){if(!r?.in)return false;const t=new Date(r.in),[h,m]=settings.startTime.split(":").map(Number);const expected=new Date(t);expected.setHours(h,m,0,0);return t.getTime()>expected.getTime()+Number(settings.graceMinutes)*60000;}
function isEarlyDeparture(r){
 if(!r?.in||!r?.out)return false;
 const out=new Date(r.out),[h,m]=String(settings.endTime||"18:00").split(":").map(Number);
 const expected=new Date(out);expected.setHours(h,m,0,0);
 return out.getTime()<expected.getTime()-Number(settings.earlyGraceMinutes||0)*60000;
}
function monthKeys(y,m){const n=new Date(y,m+1,0).getDate();return Array.from({length:n},(_,i)=>keyOf(new Date(y,m,i+1)));}
function statsFor(keys,all){
 let present=0,absent=0,late=0,early=0,minutes=0,workingDays=0;
 const today=keyOf(new Date());
 for(const k of keys){
  if(isOff(k))continue;
  if(k<=today)workingDays++;
  const r=all[k];
  if(r?.in){present++;if(isLate(r))late++;if(isEarlyDeparture(r))early++;minutes+=durationFor(r,k===today);}
  else if(k<today)absent++;
 }
 return {present,absent,late,early,minutes,workingDays,percent:workingDays?Math.round(present/workingDays*100):0};
}
async function punch(kind){
 const all=readRecords(),k=keyOf(new Date()),r=all[k]||{in:null,out:null};
 if(kind==="in"&&r.in)return alert("Punch In is already recorded for today.");
 if(kind==="out"&&!r.in)return alert("Please Punch In first.");
 if(kind==="out"&&r.out)return alert("Punch Out is already recorded for today.");
 if(!navigator.geolocation)return alert("GPS is not supported by this browser.");
 $(kind==="in"?"punchInBtn":"punchOutBtn").disabled=true;
 try{
  const position=await getCurrentPosition(),timestamp=new Date().toISOString();
  r[kind]=timestamp;r[kind+"Location"]={latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:Math.round(position.coords.accuracy),capturedAt:timestamp};
  all[k]=r;localStorage.setItem(KEY,JSON.stringify(all));selectedDate=k;render();updateGpsDisplay(position);
  alert(`${kind==="in"?"Punch In":"Punch Out"} saved with GPS location.`);
 }catch(error){
  alert(error.code===1?"Location permission denied. Allow location access in Chrome.":error.code===2?"Location unavailable. Turn on Android Location/GPS.":error.code===3?"GPS timed out. Please try again.":"Could not capture GPS location.");
 }finally{renderToday();}
}
function getCurrentPosition(){return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:20000,maximumAge:0}));}
function clockLabel(value){
 const parts=String(value||"09:30").split(":");
 const h=Number(parts[0]||0),m=Number(parts[1]||0);
 const hour12=h%12||12,ampm=h>=12?"PM":"AM";
 return `${String(hour12).padStart(2,"0")}:${String(m).padStart(2,"0")} ${ampm}`;
}
function renderToday(){
 const now=new Date(),k=keyOf(now),r=readRecords()[k]||{in:null,out:null};
 $("officeStartDisplay").textContent=clockLabel(settings.startTime);
 $("officeEndDisplay").textContent=clockLabel(settings.endTime||"18:00");
 $("punchInBtn").textContent=`☀  PUNCH IN · ${clockLabel(settings.startTime)}`;
 $("punchOutBtn").textContent=`☾  PUNCH OUT · ${clockLabel(settings.endTime||"18:00")}`;
 $("todayDate").textContent=now.toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long",year:"numeric"});
 $("punchInTime").textContent=`Actual: ${timeText(r.in)}`;$("punchOutTime").textContent=`Actual: ${timeText(r.out)}`;
 $("workingHours").textContent=durationText(durationFor(r,!!r.in&&!r.out));
 $("status").textContent=!r.in?"Ready to start your day":!r.out?"You are currently punched in":"Today's attendance is complete";
 $("lateStatus").textContent=r.in?(isLate(r)?"Late arrival":"On time"):"";
 $("outStatus").textContent=r.out?"Punch out recorded":"";
 $("punchInBtn").disabled=!!r.in;$("punchOutBtn").disabled=!r.in||!!r.out;
}
function renderCalendar(){
 const all=readRecords(),y=viewMonth.getFullYear(),m=viewMonth.getMonth(),today=keyOf(new Date());
 $("monthLabel").textContent=viewMonth.toLocaleDateString(undefined,{month:"long",year:"numeric"});
 const grid=$("calendarGrid");grid.innerHTML="";
 const offset=new Date(y,m,1).getDay(),keys=monthKeys(y,m);
 for(let i=0;i<offset;i++){const e=document.createElement("div");e.className="calendar-day empty";grid.appendChild(e);}
 for(const k of keys){
  const r=all[k],off=isOff(k),future=k>today,el=document.createElement("button");el.type="button";el.className="calendar-day";
  if(k===today)el.classList.add("is-today");if(k===selectedDate)el.classList.add("selected");
  if(off)el.classList.add("holiday");else if(r?.in)el.classList.add(isLate(r)?"late":"complete");else if(k<today)el.classList.add("absent");if(future)el.classList.add("future");
  el.innerHTML=`<span>${Number(k.slice(-2))}</span><span class="day-dot"></span>`;
  el.addEventListener("click",()=>{selectedDate=k;renderCalendar();});grid.appendChild(el);
 }
 const s=statsFor(keys,all);
 $("monthSummary").textContent=`Present: ${s.present} · Absent: ${s.absent} · Late: ${s.late} · Attendance: ${s.percent}%`;
 const r=all[selectedDate],off=isOff(selectedDate),future=selectedDate>today;
 let detail=off?(settings.holidays.includes(selectedDate)?"Holiday":"Sunday · Weekly off"):future?"Future date · No attendance expected":r?.in?`Punch In: ${timeText(r.in)} · Punch Out: ${timeText(r.out)} · Working time: ${durationText(durationFor(r,selectedDate===today))} · ${isLate(r)?"Late":"On time"}${isEarlyDeparture(r)?" · Early departure":""}`:selectedDate<today?"Absent · No Punch In recorded":"No Punch In recorded yet";
 $("selectedDay").innerHTML=`<strong>${dateText(selectedDate)}</strong><p>${detail}</p>`;
 $("presentCount").textContent=s.present;$("absentCount").textContent=s.absent;$("lateCount").textContent=s.late;$("earlyCount").textContent=s.early;$("attendancePercent").textContent=`${s.percent}%`;
 const now=new Date(),weekStart=new Date(now);weekStart.setDate(now.getDate()-now.getDay());weekStart.setHours(0,0,0,0);
 const weekKeys=Array.from({length:7},(_,i)=>{const d=new Date(weekStart);d.setDate(d.getDate()+i);return keyOf(d);});
 const weekMins=weekKeys.reduce((n,k)=>n+durationFor(all[k],k===today),0);
 const monthMins=keys.reduce((n,k)=>n+durationFor(all[k],k===today),0);
 $("weeklyHours").textContent=durationText(weekMins);$("monthlyHours").textContent=durationText(monthMins);
 const salary=Number(settings.monthlySalary)||0,perDay=s.workingDays?salary/s.workingDays:0,earned=Math.round(perDay*s.present);
 $("salaryEstimate").textContent=`₹${earned.toLocaleString("en-IN")}`;
 $("salaryNote").textContent=salary?`Estimate: ₹${salary.toLocaleString("en-IN")} monthly ÷ ${s.workingDays} scheduled working days × ${s.present} present days. Excludes deductions/allowances.`:"Set your monthly salary in Settings to calculate an estimate.";
}
function renderHistory(){
 const all=readRecords(),keys=Object.keys(all).sort().reverse();
 $("historyList").innerHTML=keys.length?keys.map(k=>{const r=all[k],flags=[isLate(r)?"Late":"",isEarlyDeparture(r)?"Early departure":""].filter(Boolean).join(" · ");return `<div class="record"><div class="record-date">${dateText(k)}${flags?" · "+flags:""}</div><div class="record-detail">In: ${timeText(r.in)} · Out: ${timeText(r.out)}<br>Working time: ${durationText(durationFor(r,k===keyOf(new Date())))}${r.inLocation?`<br>📍 Punch In GPS: <a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${r.inLocation.latitude},${r.inLocation.longitude}">View location</a> (±${r.inLocation.accuracy} m)`:""}${r.outLocation?`<br>📍 Punch Out GPS: <a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${r.outLocation.latitude},${r.outLocation.longitude}">View location</a> (±${r.outLocation.accuracy} m)`:""}</div></div>`}).join(""):'<div class="empty">No attendance records yet. Tap Punch In to begin.</div>';
}
function render(){renderToday();renderCalendar();renderHistory();}

// Local reminders: these run while the app is open or active in the browser.
const REMINDER_KEY = "myDailyAttendanceReminderLogV1";
function reminderLog(){
 try { return JSON.parse(localStorage.getItem(REMINDER_KEY) || "{}"); }
 catch { return {}; }
}
async function sendAttendanceNotification(id, title, body){
 if (!("Notification" in window) || Notification.permission !== "granted") return;
 const k = `${keyOf(new Date())}:${id}`;
 const sent = reminderLog();
 if (sent[k]) return;
 try {
  const options = {
   body,
   tag: k,
   icon: "./icon-192.png",
   data: { url: location.href }
  };
  const registration = ("serviceWorker" in navigator)
   ? await navigator.serviceWorker.getRegistration()
   : null;
  if (registration && registration.showNotification) {
   await registration.showNotification(title, options);
  } else {
   new Notification(title, options);
  }
  sent[k] = true;
  localStorage.setItem(REMINDER_KEY, JSON.stringify(sent));
 } catch (err) {
  console.warn("Attendance notification could not be shown:", err);
 }
}
function minutesOfDay(value){
 const [h,m] = String(value || "00:00").split(":").map(Number);
 return h * 60 + m;
}
function checkAttendanceReminders(){
 if (!("Notification" in window) || Notification.permission !== "granted") return;
 const now = new Date(), today = keyOf(now);
 const current = now.getHours() * 60 + now.getMinutes();
 const all = readRecords(), r = all[today] || {in:null,out:null};
 const start = minutesOfDay(settings.startTime);
 const end = minutesOfDay(settings.endTime || "18:00");

 // Five-minute advance warnings.
 if (!r.in && current >= start - 5 && current < start) {
  sendAttendanceNotification("Punch-in reminder", `Office punch-in is at ${clockLabel(settings.startTime)}. Please remember to punch in.`);
 }
 if (r.in && !r.out && current >= end - 5 && current < end) {
  sendAttendanceNotification("Punch-out reminder", `Office punch-out is at ${clockLabel(settings.endTime || "18:00")}. Please remember to punch out.`);
 }

 // One missed-punch reminder, five minutes after the scheduled time.
 if (!r.in && current >= start + 5) {
  sendAttendanceNotification("Missed punch-in", `You have not punched in. Your scheduled time was ${clockLabel(settings.startTime)}.`);
 }
 if (r.in && !r.out && current >= end + 5) {
  sendAttendanceNotification("Missed punch-out", `You have not punched out. Your scheduled time was ${clockLabel(settings.endTime || "18:00")}.`);
 }
}
function setupNotificationControls(){
 const panel = $("settingsPanel");
 const save = $("saveSettings");
 if (!panel || !save || $("enableNotificationsBtn")) return;
 const button = document.createElement("button");
 button.id = "enableNotificationsBtn";
 button.type = "button";
 button.className = "secondary";
 button.style.marginTop = "10px";
 button.textContent = "Enable attendance notifications";
 button.addEventListener("click", async () => {
  if (!("Notification" in window)) {
   alert("Notifications are not supported by this browser. Please use the latest Chrome on Android.");
   return;
  }
  if (Notification.permission === "granted") {
   alert("Attendance notifications are already enabled.");
   checkAttendanceReminders();
   return;
  }
  if (Notification.permission === "denied") {
   alert("Notifications are blocked for this site. Open Android Settings → Apps → Chrome → Notifications, and allow notifications for this website.");
   return;
  }
  const permission = await Notification.requestPermission();
  if (permission === "granted") {
   alert("Notifications enabled. Keep the app/browser active around reminder times.");
   checkAttendanceReminders();
  } else {
   alert("Notification permission was not granted. You can enable it in your browser site settings.");
  }
  button.textContent = permission === "granted" ? "Notifications enabled" : "Enable attendance notifications";
 });
 save.insertAdjacentElement("beforebegin", button);
}

// Live clock and GPS map. Coordinates are saved locally with each punch.
function setupLiveGpsPanel(){
 if($("liveGpsPanel"))return;
 const panel=document.createElement("section");panel.id="liveGpsPanel";
 panel.style.cssText="margin:16px 0;padding:14px;border:1px solid #d9e2dc;border-radius:14px;background:var(--card,#fff)";
 panel.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><strong>📍 Live Location & Time</strong><span id="liveClock" style="font-weight:700;font-size:1.15rem;font-variant-numeric:tabular-nums">--:--:-- --</span></div><p id="gpsStatus" style="margin:8px 0">Getting your current location…</p><div id="gpsPlaceName" style="font-weight:700;margin:6px 0">Finding nearby place name…</div><div id="gpsCoordinates" style="font-size:.9rem;line-height:1.6">Waiting for GPS permission</div><div id="gpsMapWrap" style="margin-top:10px;display:none"><iframe id="gpsMap" title="Your current GPS location" width="100%" height="220" style="border:0;border-radius:10px" loading="lazy"></iframe><a id="gpsOpenMap" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px">Open location in Maps ↗</a></div><button id="refreshGpsBtn" type="button" class="secondary" style="margin-top:10px">Refresh current location</button>`;
 const anchor=$("punchInBtn");(anchor?.parentElement||$("todayDate")?.parentElement||document.body).insertBefore(panel,anchor||null);
 $("refreshGpsBtn").addEventListener("click",refreshLiveGps);
}
function updateLiveClock(){const el=$("liveClock");if(el)el.textContent=new Date().toLocaleTimeString("en-IN",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:true});}
let lastPlaceLookupAt=0,lastPlaceLookupCoords=null,placeLookupSequence=0;
function distanceMetres(a,b){
 const rad=x=>x*Math.PI/180,R=6371000,dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon);
 const q=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
 return 2*R*Math.asin(Math.sqrt(q));
}
async function fetchJsonWithTimeout(url,timeoutMs=10000){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{const response=await fetch(url,{signal:controller.signal,headers:{Accept:"application/json"}});if(!response.ok)throw new Error(`Geocoding service returned ${response.status}`);return await response.json();}
 finally{clearTimeout(timer);}
}
function readablePlace(data){
 const a=data.address||{};
 const parts=[a.amenity||a.building||a.shop||a.tourism||a.road||a.pedestrian||data.locality,data.suburb||a.suburb||a.neighbourhood||a.residential||a.village||a.town||a.city||data.city||data.localityInfo?.administrative?.[0]?.name,data.state||data.principalSubdivision,a.country||data.countryName].filter(Boolean);
 return [...new Set(parts)].slice(0,4).join(", ")||data.display_name||"";
}
async function lookupPlaceName(lat,lon){
 const now=Date.now(),coords={lat,lon};
 if(lastPlaceLookupCoords&&now-lastPlaceLookupAt<60000&&distanceMetres(lastPlaceLookupCoords,coords)<80)return;
 const seq=++placeLookupSequence,el=$("gpsPlaceName");
 if(el)el.textContent="Finding nearby place name…";
 try{
  let name="";
  // BigDataCloud's browser-friendly reverse-geocoding endpoint (no API key).
  try{
   const data=await fetchJsonWithTimeout(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=en`);
   name=readablePlace(data);
  }catch(firstError){
   // OpenStreetMap Nominatim fallback.
   const data=await fetchJsonWithTimeout(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=18&addressdetails=1`);
   name=readablePlace(data);
  }
  if(seq!==placeLookupSequence)return;
  if(name){lastPlaceLookupAt=Date.now();lastPlaceLookupCoords=coords;if(el)el.textContent=`📍 ${name}`;}
  else if(el)el.textContent="Nearby place name not available for these coordinates";
 }catch(err){
  if(seq===placeLookupSequence&&el)el.textContent="Place name lookup unavailable · Check internet and tap Refresh current location";
  console.warn("Reverse geocoding failed:",err);
 }
}

function updateGpsDisplay(position){
 const lat=position.coords.latitude,lon=position.coords.longitude,accuracy=Math.round(position.coords.accuracy);
 $("gpsStatus").textContent=`GPS location updated · Accuracy approximately ${accuracy} metres`;
 $("gpsCoordinates").textContent=`Latitude: ${lat.toFixed(6)} · Longitude: ${lon.toFixed(6)} · Accuracy: ±${accuracy} m`;
 $("gpsMapWrap").style.display="block";
 $("gpsMap").src=`https://www.openstreetmap.org/export/embed.html?bbox=${lon-0.01}%2C${lat-0.01}%2C${lon+0.01}%2C${lat+0.01}&layer=mapnik&marker=${lat}%2C${lon}`;
 $("gpsOpenMap").href=`https://www.google.com/maps?q=${lat},${lon}`;
 lookupPlaceName(lat,lon);
}
function refreshLiveGps(){
 if(!navigator.geolocation){$("gpsStatus").textContent="GPS is not supported by this browser.";return;}
 $("gpsStatus").textContent="Getting your current GPS location…";
 navigator.geolocation.getCurrentPosition(updateGpsDisplay,error=>{$("gpsStatus").textContent=error.code===1?"Location permission denied. Allow location access in Chrome.":error.code===3?"GPS timed out. Try again.":"Location unavailable. Turn on Android Location/GPS and try again."},{enableHighAccuracy:true,timeout:20000,maximumAge:10000});
}
function startLiveGps(){setupLiveGpsPanel();updateLiveClock();refreshLiveGps();setInterval(updateLiveClock,1000);if(navigator.geolocation)navigator.geolocation.watchPosition(updateGpsDisplay,()=>{},{enableHighAccuracy:true,maximumAge:15000,timeout:20000});}
$("punchInBtn").addEventListener("click",()=>punch("in"));$("punchOutBtn").addEventListener("click",()=>punch("out"));
$("prevMonth").addEventListener("click",()=>{viewMonth=new Date(viewMonth.getFullYear(),viewMonth.getMonth()-1,1);renderCalendar();});
$("nextMonth").addEventListener("click",()=>{viewMonth=new Date(viewMonth.getFullYear(),viewMonth.getMonth()+1,1);renderCalendar();});
$("settingsToggle").addEventListener("click",()=>{const p=$("settingsPanel"),show=p.hidden;p.hidden=!show;$("settingsToggle").setAttribute("aria-expanded",String(show));});
function fillSettings(){$("startTime").value=settings.startTime;$("endTime").value=settings.endTime||"18:00";$("graceMinutes").value=settings.graceMinutes;$("earlyGraceMinutes").value=settings.earlyGraceMinutes??0;$("monthlySalary").value=settings.monthlySalary;$("holidayDates").value=settings.holidays.join("\n");}
$("saveSettings").addEventListener("click",()=>{
 const holidays=$("holidayDates").value.split(/\s+/).map(s=>s.trim()).filter(Boolean);
 const invalid=holidays.find(k=>!/^\d{4}-\d{2}-\d{2}$/.test(k)||Number.isNaN(new Date(`${k}T12:00:00`).getTime()));
 if(invalid)return alert(`Please check holiday date: ${invalid}. Use YYYY-MM-DD.`);
 settings={startTime:$("startTime").value||"09:30",endTime:$("endTime").value||"18:00",graceMinutes:Math.max(0,Number($("graceMinutes").value)||0),earlyGraceMinutes:Math.max(0,Number($("earlyGraceMinutes").value)||0),monthlySalary:Math.max(0,Number($("monthlySalary").value)||0),holidays:[...new Set(holidays)]};
 localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));render();alert("Settings saved.");
});
$("exportBtn").addEventListener("click",()=>{
 const all=readRecords(),keys=Object.keys(all).sort(),rows=[["Date","Punch In","Punch Out","Working Minutes","Late"]];
 keys.forEach(k=>{const r=all[k];rows.push([k,r.in?new Date(r.in).toLocaleString():"",r.out?new Date(r.out).toLocaleString():"",durationFor(r,k===keyOf(new Date())),isLate(r)?"Yes":"No"]);});
 if(!keys.length)return alert("No attendance records to export.");
 const csv=rows.map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n"),url=URL.createObjectURL(new Blob([csv],{type:"text/csv"})),a=document.createElement("a");a.href=url;a.download="my-attendance.csv";a.click();URL.revokeObjectURL(url);
});

function monthlyReport(){
 const all=readRecords(),y=viewMonth.getFullYear(),m=viewMonth.getMonth(),keys=monthKeys(y,m),s=statsFor(keys,all);
 const monthName=viewMonth.toLocaleDateString("en-IN",{month:"long",year:"numeric"});
 const rows=keys.map(k=>{
  const r=all[k],off=isOff(k),today=keyOf(new Date()),future=k>today;
  let status="Absent";
  if(off)status=settings.holidays.includes(k)?"Holiday":"Weekly off";
  else if(future)status="Upcoming";
  else if(r?.in)status=isLate(r)?"Late":"Present";
  else if(k===today)status="Pending";
  const early=isEarlyDeparture(r);
  if(early)status+=" / Early exit";
  return `<tr><td>${dateText(k)}</td><td>${status}</td><td>${r?.in?timeText(r.in):"—"}</td><td>${r?.out?timeText(r.out):"—"}</td><td>${durationText(durationFor(r,k===today))}</td><td>${isLate(r)?"Yes":"No"}</td><td>${early?"Yes":"No"}</td></tr>`;
 }).join("");
 const totalHours=durationText(s.minutes);
 const report=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Attendance Report - ${monthName}</title><style>
 body{font-family:Arial,sans-serif;color:#182d24;margin:24px}h1{margin:0 0 5px;font-size:24px}.sub{color:#66756d;margin:0 0 20px}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:18px 0}.metric{border:1px solid #dce5df;border-radius:8px;padding:10px}.metric b{display:block;font-size:20px;margin-top:4px}.metric span{font-size:11px;color:#68776f}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #d7dfda;padding:7px 5px;text-align:left}th{background:#eaf2ed}footer{margin-top:18px;color:#68776f;font-size:10px}.actions{margin:15px 0}@media print{body{margin:10mm}.actions{display:none}.summary{grid-template-columns:repeat(4,1fr)}}
 </style></head><body><h1>My Daily Attendance</h1><p class="sub">Monthly attendance report · ${monthName}<br>Office hours: ${clockLabel(settings.startTime)} – ${clockLabel(settings.endTime||"18:00")}</p>
 <div class="summary">
 <div class="metric"><span>Present days</span><b>${s.present}</b></div><div class="metric"><span>Absent days</span><b>${s.absent}</b></div><div class="metric"><span>Late arrivals</span><b>${s.late}</b></div><div class="metric"><span>Early departures</span><b>${s.early}</b></div>
 <div class="metric"><span>Attendance</span><b>${s.percent}%</b></div><div class="metric"><span>Working time</span><b>${totalHours}</b></div><div class="metric"><span>Scheduled working days</span><b>${s.workingDays}</b></div><div class="metric"><span>Monthly salary setting</span><b>${Number(settings.monthlySalary)?`₹${Number(settings.monthlySalary).toLocaleString("en-IN")}`:"Not set"}</b></div>
 </div>
 <div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div>
 <table><thead><tr><th>Date</th><th>Status</th><th>Punch In</th><th>Punch Out</th><th>Working</th><th>Late</th><th>Early</th></tr></thead><tbody>${rows}</tbody></table>
 <footer>Personal attendance record generated from data stored on this device. This is not an employer-certified attendance statement. Absent is counted only for past scheduled working days without a punch-in. PDF export uses your browser's Print / Save as PDF feature.</footer>
 <script>window.addEventListener("load",()=>setTimeout(()=>window.print(),350));<\/script></body></html>`;
 const win=window.open("","_blank");
 if(!win){alert("Please allow pop-ups for this attendance app, then try the PDF report again.");return;}
 win.document.open();win.document.write(report);win.document.close();
}
$("pdfReportBtn").addEventListener("click",monthlyReport);

fillSettings();setupNotificationControls();render();startLiveGps();
setInterval(()=>{renderToday();renderCalendar();checkAttendanceReminders();},15000);
checkAttendanceReminders();
if("serviceWorker"in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("./sw.js").catch(()=>{});
