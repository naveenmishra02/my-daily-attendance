/* My Daily Attendance - local reminder notifications
   Add <script src="notifications.js"></script> immediately after app.js in index.html.
   Uses the app's existing local attendance records and office-time settings.
*/
(() => {
  "use strict";

  const PREFS_KEY = "myDailyAttendanceNotificationPrefsV1";
  const SENT_KEY = "myDailyAttendanceNotificationSentV1";
  const $id = (id) => document.getElementById(id);

  const readPrefs = () => {
    try { return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}"); }
    catch (_) { return {}; }
  };

  let prefs = { leadMinutes: 10, ...readPrefs() };

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  function readSent() {
    try { return JSON.parse(localStorage.getItem(SENT_KEY) || "{}"); }
    catch (_) { return {}; }
  }

  function markSent(key) {
    const sent = readSent();
    sent[key] = true;
    // Keep only the most recent 45 days of notification flags.
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 45);
    for (const k of Object.keys(sent)) {
      const datePart = k.slice(0, 10);
      if (datePart < cutoff.toISOString().slice(0, 10)) delete sent[k];
    }
    localStorage.setItem(SENT_KEY, JSON.stringify(sent));
  }

  function appSettings() {
    // `settings` is a top-level lexical variable in the existing app.js.
    try { return typeof settings !== "undefined" ? settings : {}; }
    catch (_) { return {}; }
  }

  function minutesOfDay(hhmm) {
    const [h, m] = String(hhmm || "09:30").split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  function currentMinutes() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  function recordsForToday() {
    try {
      const all = JSON.parse(localStorage.getItem("myDailyAttendanceRecordsV1") || "{}");
      return all[todayKey()] || {};
    } catch (_) { return {}; }
  }

  async function notify(title, body, tag) {
    if (!("Notification" in window) || Notification.permission !== "granted") return false;

    const options = {
      body,
      tag,
      renotify: false,
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      vibrate: [200, 100, 200]
    };

    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, options);
      } else {
        new Notification(title, options);
      }
      return true;
    } catch (err) {
      console.warn("Attendance notification could not be displayed:", err);
      return false;
    }
  }

  async function checkReminders() {
    if (Notification.permission !== "granted") return;

    const now = currentMinutes();
    const day = todayKey();
    const rec = recordsForToday();

    const cfg = appSettings();
    const start = minutesOfDay(cfg.startTime || "09:30");
    const end = minutesOfDay(cfg.endTime || "18:00");
    const lead = Math.max(1, Math.min(60, Number(prefs.leadMinutes) || 10));
    const sent = readSent();

    // Morning: warn before start; send a late reminder 5 minutes after start.
    if (!rec.in && now >= start - lead && now < start) {
      const k = `${day}:in-before`;
      if (!sent[k] && await notify(
        "Punch In reminder",
        `Your office Punch In time is ${cfg.startTime || "09:30"}. Please get ready.`,
        k
      )) markSent(k);
    }
    if (!rec.in && now >= start + 5) {
      const k = `${day}:in-missed`;
      if (!sent[k] && await notify(
        "You missed Punch In",
        `It is 5 minutes past your scheduled Punch In time (${cfg.startTime || "09:30"}). Please Punch In now.`,
        k
      )) markSent(k);
    }

    // Evening: warn before end; send a late reminder 5 minutes after end.
    if (!rec.out && now >= end - lead && now < end) {
      const k = `${day}:out-before`;
      if (!sent[k] && await notify(
        "Punch Out reminder",
        `Your office Punch Out time is ${cfg.endTime || "18:00"}. Please remember to Punch Out.`,
        k
      )) markSent(k);
    }
    if (!rec.out && now >= end + 5) {
      const k = `${day}:out-missed`;
      if (!sent[k] && await notify(
        "You missed Punch Out",
        `It is 5 minutes past your scheduled Punch Out time (${cfg.endTime || "18:00"}). Please Punch Out now.`,
        k
      )) markSent(k);
    }
  }

  function addNotificationSettings() {
    const panel = $id("settingsPanel");
    if (!panel || $id("attendanceNotificationSettings")) return;

    const section = document.createElement("div");
    section.id = "attendanceNotificationSettings";
    section.style.cssText = "margin:18px 0;padding:14px;border:1px solid #dce5df;border-radius:12px;background:#f7fbf8;color:#19382d";
    section.innerHTML = `
      <p class="eyebrow">PUNCH REMINDER NOTIFICATIONS</p>
      <label style="display:block;margin:10px 0">
        Warning before office time (minutes)
        <input id="notificationLeadMinutes" type="number" min="1" max="60" value="${prefs.leadMinutes}"
          style="display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:10px;border:1px solid #cbd8d0;border-radius:8px">
      </label>
      <button id="enableAttendanceNotifications" type="button"
        style="width:100%;padding:12px;border:0;border-radius:10px;background:#176b50;color:white;font-weight:700">
        Enable attendance notifications
      </button>
      <p id="attendanceNotificationStatus" style="font-size:12px;line-height:1.5;margin:10px 0 0">
        Notifications need permission from Android/Chrome. Keep the attendance app open for scheduled reminders.
      </p>`;
    panel.insertBefore(section, panel.firstChild);

    $id("notificationLeadMinutes").addEventListener("change", () => {
      prefs.leadMinutes = Math.max(1, Math.min(60, Number($id("notificationLeadMinutes").value) || 10));
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
      $id("notificationLeadMinutes").value = prefs.leadMinutes;
    });

    $id("enableAttendanceNotifications").addEventListener("click", async () => {
      if (!("Notification" in window)) {
        $id("attendanceNotificationStatus").textContent =
          "This browser does not support notifications. Please use Chrome on Android.";
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        $id("attendanceNotificationStatus").textContent =
          "Notifications enabled. You will receive advance warnings and 5-minute missed-punch reminders while the app is running.";
        await notify("Attendance notifications enabled", "Your Punch In and Punch Out reminders are ready.", "attendance-enabled");
        checkReminders();
      } else {
        $id("attendanceNotificationStatus").textContent =
          "Permission was not granted. Enable notifications for this site in Android Chrome site settings.";
      }
    });

    if ("Notification" in window) {
      $id("attendanceNotificationStatus").textContent =
        Notification.permission === "granted"
          ? "Notifications are enabled. Keep the app open for scheduled reminders."
          : "Tap Enable attendance notifications and allow permission when Android/Chrome asks.";
    }
  }

  function start() {
    addNotificationSettings();
    // Check on startup so a missed reminder is raised if the user opens the app late.
    checkReminders();
    // Re-check frequently while the app is open.
    window.setInterval(checkReminders, 30 * 1000);
    // Re-check when the user returns to the app.
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) checkReminders();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
