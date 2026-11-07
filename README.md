This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Feedback deployment configuration

Keep the existing project-root `.env` and set `DATABASE_URL` to the real Neon Postgres connection string from the Neon dashboard. Do not use the placeholder in `.env.example` as a connection string. Keep the configured `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET`; set `BOSS_WHATSAPP_NUMBER` to the boss's international-format number for the prefilled WhatsApp chat. Keep `.env` and customer feedback data private; both are excluded from Git.

The Neon state table is created automatically on first use. `database/schema.sql` contains the same schema for manual setup. The admin inbox is protected by a signed, HTTP-only session cookie and requires the server-side admin credentials.

If `data/feedback-store.json` exists, preserve it as a local backup. After configuring `DATABASE_URL`, run `node scripts/import-local-feedback.mjs --dry-run` from the project root to check the backup counts, then run `node scripts/import-local-feedback.mjs` to merge it into Neon. The import adds only IDs that are missing and keeps existing database records.

## WhatsApp replies

Feedback submissions are saved in Neon, then the visitor is sent to a prefilled WhatsApp chat addressed to `BOSS_WHATSAPP_NUMBER`. The visitor must press Send in WhatsApp. To sync agent replies from WhatsApp back into the admin inbox, configure the Twilio credentials and set `TWILIO_WEBHOOK_URL` to the public HTTPS URL for `/api/whatsapp/webhook`, then configure the same URL as the inbound webhook for the Twilio WhatsApp sender. Localhost is not reachable by Twilio; use a deployed site or HTTPS tunnel during development.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
