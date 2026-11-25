const KEY="myDailyAttendanceRecordsV1", SETTINGS_KEY="myDailyAttendanceSettingsV1";
const $=id=>document.getElementById(id);
const keyOf=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const dateText=k=>new Date(`${k}T12:00:00`).toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long",year:"numeric"});
const timeText=v=>v?new Date(v).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"}):"--:--:--";
const readRecords=()=>{try{return JSON.parse(localStorage.getItem(KEY)||"{}")}catch{return {}}};
const readSettings=()=>{try{return JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}")}catch{return {}}};
let settings={startTime:"09:30",endTime:"18:00",graceMinutes:15,monthlySalary:0,holidays:[],...readSettings()};
let viewMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1), selectedDate=keyOf(new Date());

function durationFor(r,live=false){
 if(!r?.in)return 0;
 const start=new Date(r.in).getTime(),end=r.out?new Date(r.out).getTime():(live?Date.now():start);
 return Math.max(0,Math.floor((end-start)/60000));
}
function durationText(min){return `${Math.floor(min/60)}h ${min%60}m`;}
function isOff(k){const d=new Date(`${k}T12:00:00`);return d.getDay()===0||settings.holidays.includes(k);}
function isLate(r){if(!r?.in)return false;const t=new Date(r.in),[h,m]=settings.startTime.split(":").map(Number);const expected=new Date(t);expected.setHours(h,m,0,0);return t.getTime()>expected.getTime()+Number(settings.graceMinutes)*60000;}
function monthKeys(y,m){const n=new Date(y,m+1,0).getDate();return Array.from({length:n},(_,i)=>keyOf(new Date(y,m,i+1)));}
function statsFor(keys,all){
 let present=0,absent=0,late=0,minutes=0,workingDays=0;
 const today=keyOf(new Date());
 for(const k of keys){
  if(isOff(k))continue;
  if(k<=today)workingDays++;
  const r=all[k];
  if(r?.in){present++;if(isLate(r))late++;minutes+=durationFor(r,k===today);}
  else if(k<today)absent++;
 }
 return {present,absent,late,minutes,workingDays,percent:workingDays?Math.round(present/workingDays*100):0};
}
function punch(kind){
 const all=readRecords(),k=keyOf(new Date()),r=all[k]||{in:null,out:null};
 if(kind==="in"&&r.in)return alert("Punch In is already recorded for today.");
 if(kind==="out"&&!r.in)return alert("Please Punch In first.");
 if(kind==="out"&&r.out)return alert("Punch Out is already recorded for today.");
 r[kind]=new Date().toISOString();all[k]=r;localStorage.setItem(KEY,JSON.stringify(all));selectedDate=k;render();
}
function renderToday(){
 const now=new Date(),k=keyOf(now),r=readRecords()[k]||{in:null,out:null};
 $("todayDate").textContent=now.toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long",year:"numeric"});
 $("punchInTime").textContent=timeText(r.in);$("punchOutTime").textContent=timeText(r.out);
 $("workingHours").textContent=durationText(durationFor(r,!!r.in&&!r.out));
 $("status").textContent=!r.in?"Ready to start your day":!r.out?"You are currently punched in":"Today's attendance is complete";
 $("lateStatus").textContent=r.in?(isLate(r)?"Late arrival":"On time"):"";
 $("outStatus").textContent=r.out?`Punch out recorded · Office end ${settings.endTime||"18:00"}`:`Office end ${settings.endTime||"18:00"}`;
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
 let detail=off?(settings.holidays.includes(selectedDate)?"Holiday":"Sunday · Weekly off"):future?"Future date · No attendance expected":r?.in?`Punch In: ${timeText(r.in)} · Punch Out: ${timeText(r.out)} · Working time: ${durationText(durationFor(r,selectedDate===today))} · ${isLate(r)?"Late":"On time"}`:selectedDate<today?"Absent · No Punch In recorded":"No Punch In recorded yet";
 $("selectedDay").innerHTML=`<strong>${dateText(selectedDate)}</strong><p>${detail}</p>`;
 $("presentCount").textContent=s.present;$("absentCount").textContent=s.absent;$("lateCount").textContent=s.late;$("attendancePercent").textContent=`${s.percent}%`;
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
 $("historyList").innerHTML=keys.length?keys.map(k=>{const r=all[k];return `<div class="record"><div class="record-date">${dateText(k)}${isLate(r)?" · Late":""}</div><div class="record-detail">In: ${timeText(r.in)} · Out: ${timeText(r.out)}<br>Working time: ${durationText(durationFor(r,k===keyOf(new Date())))}</div></div>`}).join(""):'<div class="empty">No attendance records yet. Tap Punch In to begin.</div>';
}
function render(){renderToday();renderCalendar();renderHistory();}
$("punchInBtn").addEventListener("click",()=>punch("in"));$("punchOutBtn").addEventListener("click",()=>punch("out"));
$("prevMonth").addEventListener("click",()=>{viewMonth=new Date(viewMonth.getFullYear(),viewMonth.getMonth()-1,1);renderCalendar();});
$("nextMonth").addEventListener("click",()=>{viewMonth=new Date(viewMonth.getFullYear(),viewMonth.getMonth()+1,1);renderCalendar();});
$("settingsToggle").addEventListener("click",()=>{const p=$("settingsPanel"),show=p.hidden;p.hidden=!show;$("settingsToggle").setAttribute("aria-expanded",String(show));});
function fillSettings(){$("startTime").value=settings.startTime;$("endTime").value=settings.endTime||"18:00";$("graceMinutes").value=settings.graceMinutes;$("monthlySalary").value=settings.monthlySalary;$("holidayDates").value=settings.holidays.join("\n");}
$("saveSettings").addEventListener("click",()=>{
 const holidays=$("holidayDates").value.split(/\s+/).map(s=>s.trim()).filter(Boolean);
 const invalid=holidays.find(k=>!/^\d{4}-\d{2}-\d{2}$/.test(k)||Number.isNaN(new Date(`${k}T12:00:00`).getTime()));
 if(invalid)return alert(`Please check holiday date: ${invalid}. Use YYYY-MM-DD.`);
 settings={startTime:$("startTime").value||"09:30",endTime:$("endTime").value||"18:00",graceMinutes:Math.max(0,Number($("graceMinutes").value)||0),monthlySalary:Math.max(0,Number($("monthlySalary").value)||0),holidays:[...new Set(holidays)]};
 localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));render();alert("Settings saved.");
});
$("exportBtn").addEventListener("click",()=>{
 const all=readRecords(),keys=Object.keys(all).sort(),rows=[["Date","Punch In","Punch Out","Working Minutes","Late"]];
 keys.forEach(k=>{const r=all[k];rows.push([k,r.in?new Date(r.in).toLocaleString():"",r.out?new Date(r.out).toLocaleString():"",durationFor(r,k===keyOf(new Date())),isLate(r)?"Yes":"No"]);});
 if(!keys.length)return alert("No attendance records to export.");
 const csv=rows.map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n"),url=URL.createObjectURL(new Blob([csv],{type:"text/csv"})),a=document.createElement("a");a.href=url;a.download="my-attendance.csv";a.click();URL.revokeObjectURL(url);
});
fillSettings();render();
setInterval(()=>{renderToday();renderCalendar();},1000);
if("serviceWorker"in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("./sw.js").catch(()=>{});
