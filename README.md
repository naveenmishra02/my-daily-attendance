# My Daily Attendance — Simple Android-friendly app

This is a lightweight installable web app (PWA). It works on Android without Android Studio and can be added to your phone's home screen.

## Features
- Morning Punch In and evening Punch Out
- Saves the date and time automatically
- Calculates elapsed working time
- Attendance history
- Export records as CSV for Excel
- Stores records locally in the browser on your phone

## Quickest way to use it on Android
1. Upload these project files to a static web host using HTTPS (for example, GitHub Pages).
2. Open the hosted `index.html` link in Chrome on your Android phone.
3. Open Chrome's menu (⋮) and choose **Install app** or **Add to Home screen**.
4. Launch **My Daily Attendance** from your home screen.

## Test locally
You can open `index.html` in a desktop browser for a quick preview. Installable/offline PWA features require the files to be served over HTTPS (or localhost).

## Publish with GitHub Pages
1. Create a GitHub repository, for example `my-daily-attendance`.
2. Upload all files in this folder to the repository's root.
3. In repository Settings → Pages, choose **Deploy from a branch**, select `main` and `/ (root)`, then Save.
4. Wait for the Pages URL to appear. Open it on Android Chrome and install it.

## Important
- This is a personal attendance record, not a company attendance integration.
- The app uses your phone's clock and timezone.
- Records stay in browser storage on this device. Clearing browser/site data or changing browsers can remove them. Export CSV regularly as a backup.
- Punch-in/out is limited to one of each per calendar day. Breaks are not deducted from working time.
