# ECN591 Matching

Clean starter app for a market design matching website.

## Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- ESLint
- `src/` directory structure

## Development

Install dependencies (already done during scaffolding) and run:

```bash
npm run dev
```

Open http://localhost:3000.

## Setup and Deployment

1. Copy `.env.local.example` to `.env.local`.
2. Fill in:
	- `NEXT_PUBLIC_SUPABASE_URL`
	- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Run locally:

```bash
npm run dev
```

This app can be deployed to Vercel. Add the same two environment variables in Vercel project settings before deploying.

## Project Notes

- Main page: `src/app/page.tsx`
- Root layout and metadata: `src/app/layout.tsx`
- Global styles: `src/app/globals.css`

## Suggested Next Implementation Steps

1. Add typed domain models for students, schools, and preferences.
2. Implement baseline algorithms (e.g., deferred acceptance).
3. Build a comparison view for outcomes and fairness metrics.
