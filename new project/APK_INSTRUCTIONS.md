# 📱 Bachelor Expense Manager - Android APK & Installation Guide

This project can be run on Android phones for **Shivam Kumar, Rishu Kumar, and Raj Kumar** using any of the methods below.

---

## ⚡ Method 1: Instant 1-Tap App Install (Recommended - No Compilation Needed)

The app is now fully configured as a **Progressive Web App (PWA)** with a Web App Manifest, Service Worker, and high-definition Android icons.

1. Keep the server running on your laptop (`node server.js`).
2. Make sure your laptop and Android phones are connected to the same Wi-Fi or mobile hotspot.
3. Open **Google Chrome** on the Android phone and navigate to:
   ```
   http://10.230.121.108:3001
   ```
   *(or check the current Wi-Fi IP shown in the top header badge).*
4. Tap the **"📲 Install App"** button that appears in the top navigation bar, OR:
   * Tap Chrome's menu (**⋮** three dots at top-right).
   * Tap **"Install app"** or **"Add to Home screen"**.
5. Tap **Install**.

🎉 The app is now installed on your Android phone's App Drawer and Home Screen as a native app with:
* Full-screen standalone display (no browser address bar).
* Official Bachelor Expense Manager icon.
* Instant offline launch & live Wi-Fi background sync.

---

## 📦 Method 2: Generate Signed APK via PWABuilder (1-Click Online Tool)

If you need a standalone `.apk` installation file to share over WhatsApp or Bluetooth:

1. Open [https://www.pwabuilder.com](https://www.pwabuilder.com) in your browser.
2. If your server is hosted or tunneled (e.g. via Cloudflare Tunnel or ngrok), enter your URL:
   ```bash
   # Optional: Expose your local server to the internet using free ngrok or cloudflared
   npx cloudflared tunnel --url http://localhost:3001
   ```
3. Enter your URL into **PWABuilder** and click **Start**.
4. Click **Package for Android** -> **Generate APK**.
5. Download the `.apk` file, transfer it to any Android phone, and tap to install!

---

## 🛠️ Method 3: Build APK via Android Studio (Native Project)

A complete Android Studio project has already been generated in the [`android/`](file:///Users/shivamkumar/new%20project/android) folder!

### Features of the Native Android Project:
* **Fullscreen Native WebView**: Loads the flat server or bundled local offline files.
* **Native Single A4 Bill Printing**: Integrated with Android `PrintManager` and `PrintDocumentAdapter` (`ISO_A4` size) — clicking "Print Bill" opens Android's system printer to print or save as PDF.
* **Server IP Configurator**: If you change Wi-Fi networks, simply tap "Change Server IP" in the connection dialog to update the flat server address.

### Steps to Build the APK:
1. Open **Android Studio**.
2. Click **File** -> **Open** and select the folder:
   ```
   /Users/shivamkumar/new project/android
   ```
3. Wait for Gradle sync to complete.
4. Click **Build** -> **Build Bundle(s) / APK(s)** -> **Build APK(s)**.
5. Android Studio will generate the APK at:
   ```
   android/app/build/outputs/apk/debug/app-debug.apk
   ```
6. Copy `app-debug.apk` to your phone and install!

---

## ☁️ Method 4: Automated Free Cloud Build with GitHub Actions

A ready-to-run GitHub Actions workflow has been included in [`.github/workflows/build-apk.yml`](file:///Users/shivamkumar/new%20project/.github/workflows/build-apk.yml).

1. Push this folder to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Add Bachelor Expense Manager Android APK project"
   git remote add origin https://github.com/<your-username>/bachelor-expense-manager.git
   git push -u origin main
   ```
2. Go to the **Actions** tab on your GitHub repository.
3. The **"Build Android APK"** workflow will automatically run on Ubuntu runners.
4. When finished (typically ~2-3 minutes), download the built `BachelorExpenseManager-Debug-APK` directly from the workflow artifacts!
