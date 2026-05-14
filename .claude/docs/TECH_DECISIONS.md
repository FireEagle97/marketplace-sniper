# FlipAlert — Technical Decisions
**Version:** 1.1
**Last Updated:** 2026-05-14

This document records every major technology choice and the reasoning behind it. Claude Code must treat these as settled — do not substitute alternatives.

---

## 1. CodeSpring Boilerplate (locked — do not change)

The following decisions were made by the boilerplate and are non-negotiable. They are fully wired and working.

| Technology | Role | Why locked |
|---|---|---|
| Next.js 14 App Router | Web framework | Already deployed, routes established |
| Tailwind CSS + shadcn/ui | Styling + components | Already configured, existing components use it |
| Clerk | Authentication | Sessions, email verification, password reset all work out of the box |
| Supabase + Drizzle ORM | Database | Schema migration pipeline established; Supabase connection configured |
| Stripe | Payments | Checkout + webhook + portal already wired |
| Vercel | Hosting | Deployment pipeline live |

**Do not introduce:** NextAuth, Prisma, PlanetScale, custom JWT, CSS Modules, MUI, Chakra, or any other alternative to the above.

---

## 2. Drizzle ORM (extend, don't bypass)

**Decision:** All database access goes through Drizzle. No raw SQL, no Supabase JS client for data queries.

**Why:** The boilerplate establishes Drizzle as the data layer. Mixing in the Supabase JS client or raw SQL would create two competing query patterns in the same codebase. Drizzle's type inference from schema catches query errors at compile time.

**Pattern:** Define schema in `db/schema/[table].ts`, export queries from `db/queries/[table].ts`, import queries in server actions or API routes.

---

## 3. Clerk `publicMetadata.plan` for Plan State

**Decision:** The user's plan ("free" | "paid") is stored in Clerk's `publicMetadata.plan` field, set by the Stripe webhook handler.

**Why:** The boilerplate already uses Clerk as the single source of truth for the user. Adding a separate `users` table in the DB to mirror plan state would create sync issues. Clerk's `publicMetadata` is readable server-side without a DB query, making plan checks in API routes fast and simple.

**Implementation:**
```typescript
// Read plan anywhere server-side:
const user = await currentUser();
const isPaid = user?.publicMetadata?.plan === "paid";

// Set plan in Stripe webhook (extend existing handler):
await clerkClient.users.updateUserMetadata(userId, {
  publicMetadata: { plan: "paid" },
});
```

**Do not:** create a `users` table, mirror Clerk data into Supabase, or check plan via a DB query.

---

## 4. BullMQ + Redis for Job Queue

**Decision:** BullMQ (backed by Redis on Railway) for all background jobs.

**Why:** The scraper and digest sender are long-running async tasks that cannot run inside a Vercel serverless function (15s timeout limit). BullMQ provides retries with backoff, dead-letter queues, concurrency control, and job prioritization. Redis is required by BullMQ and is fast enough for our queue volume.

**The Next.js app only enqueues jobs.** Workers run in a separate always-on Railway service. This separation is intentional — do not attempt to run workers inside Next.js API routes or Vercel functions.

**Do not use:** pg-boss (adds DB load), Inngest (external dependency), raw `setTimeout` (no persistence or retries).

---

## 5. Playwright for Scraping

**Decision:** Playwright headless Chromium, with `playwright-extra` + `puppeteer-extra-plugin-stealth`.

**Why:** Facebook Marketplace is a JS-heavy SPA — pure HTTP requests cannot render it. Playwright runs a real browser. The stealth plugin patches navigator.webdriver, chrome runtime, permissions API, and other common bot-detection vectors.

**Do not use:** Puppeteer (Playwright is the maintained successor), Cheerio + axios (can't handle JS-rendered content), Selenium (slower, heavier).

---

## 6. Proxy Rotation (one proxy per scrape job)

**Decision:** External rotating proxy pool (Webshare to start, Oxylabs residential if block rates rise). One proxy assigned per scrape job, not per request.

**Why:** Facebook blocks IPs that send too many requests. Rotating per job (not per page load) balances cost and effectiveness. Assigning one proxy per job maintains session continuity within a single scrape without extra overhead.

**Proxy format:** Standard HTTP proxies `http://user:pass@host:port`. Store as a comma-separated list in the `PROXY_POOL` environment variable.

**Do not use:** Free proxy lists (unreliable), VPNs (not programmable), a single static IP (will be blocked quickly).

---

## 7. Resend for Email

**Decision:** Resend for transactional digest emails.

**Why:** Clean API, excellent deliverability, free tier covers early-stage volume (3,000 emails/month). Purpose-built for transactional email (not marketing blasts). Has a React Email integration for HTML templates.

**Do not use:** Nodemailer with SMTP (deliverability issues), SendGrid (more complex setup), the Supabase email feature (not suitable for custom HTML digests).

---

## 8. Workers as a Separate Railway Service

**Decision:** The scraper and digest worker run as a standalone always-on Node.js process on Railway, not inside the Next.js app.

**Why:** Vercel functions have a maximum execution time of 15–60 seconds depending on plan. Playwright browser sessions and digest batch processing can run for minutes. Railway supports long-running processes with no timeout. The separation also lets scraper workers scale independently.

**Structure:** `workers/` directory at the project root, with its own `package.json` and `tsconfig.json`. Shares the Supabase `DATABASE_URL` and `REDIS_URL` with the web app via environment variables.

---

## 9. No Monorepo Tooling

**Decision:** Single repository, no Turborepo, no pnpm workspaces — just npm (what the boilerplate uses) with two `package.json` files: one at root (web app) and one at `workers/`.

**Why:** The boilerplate uses npm. Adding Turborepo or pnpm workspaces would require restructuring the existing boilerplate, risking broken imports and configuration. The overhead isn't justified for two services. The workers share DB types by importing directly from the root `db/` directory using a relative path or a simple path alias.

**Shared types between web and workers:** Copy or symlink the Drizzle-generated types into `workers/src/lib/schema-types.ts` as needed, or reference the root `db/` with a relative import.

---

## 10. TypeScript Strict Mode

**Decision:** TypeScript with `"strict": true` everywhere, matching the boilerplate's existing config.

**Why:** Drizzle's type inference, Clerk's typed metadata, and job payload types crossing the queue boundary all benefit from strict typing. A type mismatch between the job enqueuer (web app) and consumer (worker) would cause silent runtime failures — strict TS catches this at build time.

**Rule:** No `any` types without an inline comment explaining why. No `ts-ignore` without a comment.
