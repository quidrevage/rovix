# Quick Setup Guide

## Installation Steps

1. **Install all dependencies:**
   ```bash
   npm install
   ```

2. **Create environment file (optional for demo mode):**
   Create a `.env.local` file in the root directory. The app will work with demo data even without Firebase configuration.

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3000`

## Features Already Implemented

✅ **Landing Page** - Hero section, features, testimonials, pricing
✅ **User Onboarding** - Multi-step form with progress tracking
✅ **Dashboard** - Meal plans, workout plans, coach tabs
✅ **Coach** - Chat that answers questions and edits the plan
✅ **Progress Tracking** - Charts and metrics visualization
✅ **Dark/Light Theme** - Theme switcher in navigation
✅ **Responsive Design** - Works on all devices
✅ **Animations** - Smooth transitions with Framer Motion

## Gemini API Key

Personal plans and the coach need your own Gemini API key (https://aistudio.google.com/apikey). Put it in `.env.local`:
```
GEMINI_API_KEY=your_gemini_api_key
```

The key is used only on the server (`app/api/ai/route.ts`) and never reaches the browser.
Do not commit it and do not prefix it with `NEXT_PUBLIC_`. Without a key the app runs in demo mode.

## Project Structure

- `/app` - Next.js app router pages
- `/components` - React components (UI components and pages)
- `/context` - React Context providers (Theme, User)
- `/lib` - Utility functions (Firebase, Gemini API, calculations)
- `/types` - TypeScript type definitions

## Next Steps

1. Run `npm install` to download all libraries
2. Run `npm run dev` to start the development server
3. Open `http://localhost:3000` in your browser
4. Click "Get My Plan" to start the onboarding flow
5. Complete the onboarding to generate your personalized plans

Enjoy your fitness journey! 🏋️‍♂️💪

