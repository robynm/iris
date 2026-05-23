# Nano Banana 🍌

A mobile-friendly image-editing app powered by Google Gemini 3.1 Flash Image (Nano Banana 2). Upload an image, describe an edit, get a result.

## What it does

- Upload a photo from your phone (camera roll or live camera)
- Describe the edit you want in plain English
- Gemini generates a new image based on your instruction
- Download the result

## Setup (local)

1. **Install Node.js 20+** if you don't have it: <https://nodejs.org>

2. **Get a Gemini API key**: <https://aistudio.google.com/apikey> (free tier available)

3. **Install dependencies**:

   ```bash
   npm install
   ```

4. **Create `.env.local`** (copy from `.env.example`) and fill in both values:

   ```
   GEMINI_API_KEY=your_real_key_here
   APP_PASSWORD=choose_a_password
   ```

   `APP_PASSWORD` gates the whole app — anyone visiting the URL has to enter this before they can generate anything.

5. **Run it**:

   ```bash
   npm run dev
   ```

   Open <http://localhost:3000>.

## Deploy to Vercel (so you can use it on your phone)

1. Push this folder to a GitHub repo (private is fine).

2. Go to <https://vercel.com/new> and sign in with GitHub.

3. Import the repo. Vercel auto-detects Next.js.

4. Before clicking Deploy, expand **Environment Variables** and add both:
   - `GEMINI_API_KEY` — your Gemini key
   - `APP_PASSWORD` — a password you choose; anyone visiting the URL has to enter this to use the app

## Optional: turn on usage tracking

The app shows a "today / total" counter in the header if you connect Vercel KV (a free Redis store). Without it, the counter just doesn't appear — the app works fine either way.

To enable it after your first deploy:

1. In your Vercel project, go to the **Storage** tab.
2. Click **Create Database** → choose **KV** (Upstash for Redis on newer Vercel accounts).
3. Connect it to your project. Vercel will automatically add `KV_REST_API_URL` and `KV_REST_API_TOKEN` (and a few related vars) to your environment.
4. Redeploy. The counter will start tracking from zero.

## Image size limits

The app resizes any uploaded image to a max edge of 1536px and re-encodes as JPEG before sending to Gemini. This keeps per-edit costs predictable (~$0.04 each at 1K resolution) and uploads fast even on cellular. The server also rejects anything over ~8MB as a safety net.

5. Click Deploy. After a minute you'll get a URL like `nano-banana-xyz.vercel.app`.

6. On your phone, open that URL in Safari (iOS) or Chrome (Android), then:
   - **iOS**: Tap Share → "Add to Home Screen"
   - **Android**: Tap menu → "Install app" or "Add to home screen"

   It'll launch full-screen like a native app.

## Cost

Gemini 3.1 Flash Image is billed per token. In practice it works out to roughly $0.04 per generated image at 1K resolution, more at higher resolutions. Google AI Studio gives you a free daily quota that may cover personal use entirely.

## Files

- `app/page.tsx` — the UI (upload, prompt, result, usage counter)
- `app/api/edit/route.ts` — the server endpoint that calls Gemini
- `app/api/usage/route.ts` — returns current usage counts
- `app/login/page.tsx` — the password-entry screen
- `app/api/login/route.ts` — checks the password, sets the auth cookie
- `lib/usage.ts` — KV-backed usage helper (gracefully no-ops without KV)
- `middleware.ts` — redirects unauthenticated requests to `/login`
- `app/layout.tsx` — root layout with mobile viewport
- `public/manifest.json` — PWA manifest for home-screen install

## Notes

- The API key never reaches the browser — all Gemini calls happen server-side.
- The password gate is checked server-side via middleware, so hitting `/api/edit` directly without logging in returns 401. The auth cookie is httpOnly and lasts 30 days.
- Images are sent as base64 in JSON. For larger images you may want to switch to multipart/form-data, but base64 works fine for typical phone photos.
- Model ID is `gemini-3.1-flash-image-preview`. As it graduates from preview the ID will change — update `app/api/edit/route.ts` accordingly.
