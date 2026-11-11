# Rovix

Personal fitness coach: weekly meal and workout plans, a coach chat that can change the plan, animated exercise technique, a shopping list and progress tracking. Interface in English, Ukrainian and Russian.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Run only one dev server at a time: two of them share the `.next` folder and break each other's pages.

## Environment

Create `.env.local` in the project root:

```env
# Server-side key for plan and coach generation. Never commit it and never prefix it with NEXT_PUBLIC_.
GEMINI_API_KEY=your_key
# Optional: override the main model
# GEMINI_MODEL=gemini-3.5-flash
```

Without a key the app still works, with template plans instead of personal ones.

## Deploy

Import the repository into Vercel (or any Node host), add `GEMINI_API_KEY` to the environment variables and deploy. On a phone, open the site and choose "Add to Home screen".

User data is stored in the browser only. To move it to another device use Profile → "Save a backup file" and load that file on the other device.

## Stack

Next.js 14 (App Router), TypeScript, Tailwind CSS, next-intl, Framer Motion, Recharts.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint
