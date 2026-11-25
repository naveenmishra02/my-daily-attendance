const KEY = "myDailyAttendanceRecordsV1";
const $ = id => document.getElementById(id);
const dateKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const dateLabel = key => new Date(`${key}T12:00:00`).toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long",year:"numeric"});
const timeLabel = value => value ? new Date(value).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : "--:--";
const records = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
const save = data => localStorage.setItem(KEY, JSON.stringify(data));
const today = () => records()[dateKey(new Date())] || {in:null,out:null};

function elapsed(day) {
  if (!day.in) return "--";
  const start = new Date(day.in).getTime();
  const end = day.out ? new Date(day.out).getTime() : Date.now();
  const minutes = Math.max(0, Math.floor((end-start)/60000));
  return `${Math.floor(minutes/60)}h ${minutes%60}m`;
}
function render() {
  const now = new Date(), key = dateKey(now), day = today();
  $("todayDate").textContent = now.toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  $("punchInTime").textContent = timeLabel(day.in);
  $("punchOutTime").textContent = timeLabel(day.out);
  $("workingHours").textContent = elapsed(day);
  $("status").textContent = !day.in ? "Ready to start your day" : !day.out ? "You are currently punched in" : "Today's attendance is complete";
  $("punchInBtn").disabled = !!day.in;
  $("punchOutBtn").disabled = !day.in || !!day.out;
  const all = records();
  const keys = Object.keys(all).sort().reverse();
  $("historyList").innerHTML = keys.length ? keys.map(k => {
    const r=all[k];
    return `<div class="record"><div class="record-date">${dateLabel(k)}</div><div class="record-detail">In: ${timeLabel(r.in)} &nbsp; · &nbsp; Out: ${timeLabel(r.out)}<br>Working time: ${elapsed(r)}</div></div>`;
  }).join("") : '<div class="empty">No attendance records yet. Tap Punch In to begin.</div>';
}
function punch(kind) {
  const all=records(), key=dateKey(new Date()), day=all[key]||{in:null,out:null};
  if(kind==="in" && day.in) return alert("You have already punched in today.");
  if(kind==="out" && !day.in) return alert("Please punch in first.");
  if(kind==="out" && day.out) return alert("You have already punched out today.");
  day[kind]=new Date().toISOString(); all[key]=day; save(all); render();
}
$("punchInBtn").addEventListener("click",()=>punch("in"));
$("punchOutBtn").addEventListener("click",()=>punch("out"));
$("exportBtn").addEventListener("click",()=>{
  const all=records(), keys=Object.keys(all).sort();
  if(!keys.length) return alert("There are no records to export yet.");
  const rows=[["Date","Punch In","Punch Out","Working Time"]];
  keys.forEach(k=>{const r=all[k]; rows.push([k,r.in?new Date(r.in).toLocaleString():"",r.out?new Date(r.out).toLocaleString():"",elapsed(r)]);});
  const csv=rows.map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob), a=document.createElement("a");
  a.href=url;a.download="my-attendance.csv";a.click();URL.revokeObjectURL(url);
});
render();
setInterval(render,60000);
if("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./sw.js").catch(()=>{});
