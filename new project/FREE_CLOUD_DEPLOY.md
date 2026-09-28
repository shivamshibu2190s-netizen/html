# ☁️ Free Cloud Setup Guide for Bachelor Expense Manager

Deploying Bachelor Expense Manager to the cloud allows **Shivam Kumar, Rishu Kumar, and Raj Kumar** to access the app and add expenses **from anywhere in the world over 4G/5G mobile internet**, even when they are away from the flat Wi-Fi!

All configuration files have already been prepared in this repository:
* [`render.yaml`](file:///Users/shivamkumar/new%20project/render.yaml) – Render.com 1-click cloud Blueprint
* [`Dockerfile`](file:///Users/shivamkumar/new%20project/Dockerfile) – Lightweight container for Docker-based cloud hosts
* [`fly.toml`](file:///Users/shivamkumar/new%20project/fly.toml) – Fly.io configuration with persistent SQLite storage
* [`.dockerignore`](file:///Users/shivamkumar/new%20project/.dockerignore) – Docker ignore rules

---

## 🚀 Option 1: Render.com (Recommended — 100% Free 24/7 Web Hosting)

Render provides free Node.js hosting with automatic Git deployments and a free public HTTPS domain (e.g., `https://bachelor-expense-manager.onrender.com`).

### Steps:
1. **Push your code to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Deploy Bachelor Expense Manager to free cloud"
   git remote add origin https://github.com/<your-username>/bachelor-expense-manager.git
   git branch -M main
   git push -u origin main
   ```
2. Go to **[render.com](https://render.com)** and sign in with GitHub (100% free, no credit card required).
3. Click **New +** -> **Web Service**.
4. Select your `bachelor-expense-manager` repository.
5. Render will automatically detect settings from [`render.yaml`](file:///Users/shivamkumar/new%20project/render.yaml):
   * **Runtime**: Node
   * **Build Command**: `npm install`
   * **Start Command**: `node server.js`
   * **Plan**: Free ($0/month)
6. Click **Create Web Service**.

🎉 In 1–2 minutes, your app will be live at `https://your-app-name.onrender.com`.
* All 3 roommates can bookmark and open this URL on their phones anywhere.
* The Android PWA and APK can connect directly to this cloud URL!

---

## 🗄️ Option 2: Fly.io (Free Cloud with Persistent SQLite Disk)

If you want SQLite database persistence across cloud restarts, Fly.io offers a generous free tier with persistent storage volumes.

### Steps:
1. Install Fly CLI:
   * Mac: `brew install flyctl` or `curl -L https://fly.io/install.sh | sh`
2. Sign up or log in:
   ```bash
   fly auth signup
   ```
3. Create the persistent volume for SQLite:
   ```bash
   fly volumes create bachelor_data --size 1 --region sin
   ```
4. Deploy using the prepared [`fly.toml`](file:///Users/shivamkumar/new%20project/fly.toml):
   ```bash
   fly deploy
   ```
Your app is now live at `https://bachelor-expense-manager.fly.dev`!

---

## ⚡ Option 3: Instant Cloudflare Tunnel (Zero Sign-Up, Live in 10 Seconds)

If you want to keep the database running on your laptop while giving Shivam, Rishu, and Raj instant worldwide internet access over 4G/5G:

1. Make sure your server is running (`node server.js`).
2. Run the tunnel command:
   ```bash
   npm run tunnel
   ```
   *(or run: `npx --yes cloudflared tunnel --url http://localhost:3001`)*
3. Cloudflare will output a public HTTPS URL like:
   ```
   https://random-bachelor-name.trycloudflare.com
   ```
4. Share that link with Shivam, Rishu, and Raj!
   * Works over cellular data and any Wi-Fi.
   * No router configuration, no port-forwarding, 100% free and encrypted.

---

## 📦 Option 4: Koyeb (100% Free Cloud Container)

1. Sign up for free at **[koyeb.com](https://www.koyeb.com)**.
2. Click **Create App** -> **GitHub**.
3. Select your repository.
4. Set build type to **Dockerfile**.
5. Select the **Eco (Free)** plan and click **Deploy**.
6. Koyeb will assign a global HTTPS domain: `https://<app>-<org>.koyeb.app`.

---

## 📱 Connecting the Android App / PWA to Your Cloud URL

Once your cloud service is live (e.g. `https://bachelor-expense-manager.onrender.com`):

1. **On Android Mobile**:
   * Open the cloud URL in Chrome.
   * Tap **"Install App"** to install the PWA on your home screen.
2. **In the Native Android Project (`android/`)**:
   * In [`MainActivity.java`](file:///Users/shivamkumar/new%20project/android/app/src/main/java/com/bachelor/expensemanager/MainActivity.java), update the default URL:
     ```java
     private static final String DEFAULT_SERVER_URL = "https://your-app-name.onrender.com";
     ```
   * Or simply tap **"Change Server IP"** inside the app on first launch and paste your cloud URL!
