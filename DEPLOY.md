# KOL Source — Complete Deployment Guide
## Zero experience needed. Takes ~30 minutes.

---

## STEP 1 — Get Your YouTube API Key (10 min)

1. Go to: https://console.cloud.google.com
2. Sign in with your Google account
3. Click **"Select a project"** → **"New Project"** → name it `kol-source` → click **Create**
4. In the search bar at the top, search: `YouTube Data API v3`
5. Click the result → click **Enable**
6. In the left sidebar click **Credentials** → **+ Create Credentials** → **API Key**
7. Copy the key shown — it looks like: `AIzaSyB...xxxx`
8. (Optional security) Click **Restrict Key** → under "API restrictions" select
   **YouTube Data API v3** → Save

✅ You now have your API key. Keep it secret — never paste it in public.

---

## STEP 2 — Put Code on GitHub (5 min)

GitHub is where your code lives. Vercel and Render both pull from it.

1. Go to: https://github.com and create a free account
2. Click **+** (top right) → **New repository**
3. Name it `kol-source`, set to **Private**, click **Create**
4. Download and install Git: https://git-scm.com/downloads
5. Open Terminal (Mac) or Command Prompt (Windows)
6. Run these commands one by one:

```bash
cd path/to/kol-app          # navigate to the kol-app folder
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/kol-source.git
git push -u origin main
```

✅ Your code is now on GitHub.

---

## STEP 3 — Deploy the Backend to Render (10 min)

Render hosts your Express server for free.

1. Go to: https://render.com → Sign up (use GitHub login)
2. Click **+ New** → **Web Service**
3. Connect your GitHub account → select `kol-source` repo
4. Fill in the settings:
   - **Name:** `kol-backend`
   - **Root Directory:** `backend`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** Free
5. Scroll down to **Environment Variables** → click **Add Environment Variable**:
   - Key: `YOUTUBE_API_KEY` → Value: (paste your API key from Step 1)
6. Click **Create Web Service**
7. Wait 2-3 minutes for it to deploy
8. Copy your backend URL — it looks like: `https://kol-backend.onrender.com`

✅ Backend is live. Test it by visiting: `https://kol-backend.onrender.com`
   You should see: `{"status":"KOL Source API running"}`

---

## STEP 4 — Deploy the Frontend to Vercel (5 min)

Vercel hosts your React app for free.

1. Go to: https://vercel.com → Sign up (use GitHub login)
2. Click **Add New** → **Project**
3. Import your `kol-source` repository
4. Fill in the settings:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
5. Expand **Environment Variables** → Add:
   - Key: `VITE_API_URL` → Value: `https://kol-backend.onrender.com`
     (use the URL from Step 3)
6. Click **Deploy**
7. Wait ~1 minute. Copy your frontend URL: `https://kol-source.vercel.app`

✅ Frontend is live!

---

## STEP 5 — Connect Frontend ↔ Backend (2 min)

Tell the backend which frontend is allowed to talk to it.

1. Go back to Render → your `kol-backend` service
2. Click **Environment** tab → Add environment variable:
   - Key: `FRONTEND_URL` → Value: `https://kol-source.vercel.app`
     (your Vercel URL from Step 4)
3. Click **Save Changes** → Render will auto-redeploy

✅ Done! Visit your Vercel URL — the app is fully live.

---

## Making Changes Later

Any time you update the code:

```bash
git add .
git commit -m "your change description"
git push
```

Vercel and Render will **auto-redeploy** within 1-2 minutes.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Backend shows error on Render | Check Render logs → Environment tab → confirm API key is set |
| Search returns no results | YouTube API key may be wrong — check Google Cloud Console |
| CORS error in browser | Check FRONTEND_URL env var on Render matches your Vercel URL exactly |
| "Quota exceeded" error | You've used 10,000 units today. Resets at midnight Pacific time |
| Render is slow first load | Free tier "sleeps" after 15 min. First request takes ~30s to wake up |

---

## Your Free Tier Limits

| Service | Limit |
|---|---|
| Vercel | Unlimited deploys, 100GB bandwidth/month |
| Render | 750 hours/month (enough for 1 service), sleeps after 15min inactivity |
| YouTube API | 10,000 units/day (~99 searches) |

**To avoid Render sleeping:** upgrade to Render Starter ($7/mo) or add a free uptime monitor at https://uptimerobot.com to ping it every 10 minutes.
