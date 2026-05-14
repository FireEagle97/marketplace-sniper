# FlipAlert — Implementation Tasks
**Version:** 1.1
**Last Updated:** 2026-05-14

The project starts from the **CodeSpring Boilerplate**, which already provides: Next.js 14, Tailwind, shadcn/ui, Clerk auth, Supabase + Drizzle, Stripe, and Vercel deployment — all configured and working.

**Every task below is net-new FlipAlert work only.** Do not re-implement anything the boilerplate already provides.

Tasks are ordered by dependency. Complete each phase before starting the next.

---

## Phase 0 — Setup & Schema

- [ ] **T-001** Install worker service dependencies
  - Create `workers/` directory at project root
  - `workers/package.json` with dependencies: `playwright`, `playwright-extra`, `puppeteer-extra-plugin-stealth`, `bullmq`, `ioredis`, `node-cron`, `resend`, `drizzle-orm`, `postgres`
  - `workers/tsconfig.json` extending base TS config with `"strict": true`
  - `workers/src/index.ts` entry point (empty shell to start)

- [ ] **T-002** Add `REDIS_URL`, `RESEND_API_KEY`, `STRIPE_PAID_PRICE_ID` to `.env.local` and `.env.example`
  - Provision a Redis instance on Railway, copy connection string to `REDIS_URL`
  - Do not touch existing boilerplate env vars

- [ ] **T-003** Add new Drizzle tables
  - Create `db/schema/alerts.ts` — full schema from ARCHITECTURE.md §3
  - Create `db/schema/listings.ts` — including `unique([alertId, listingUrl])` constraint
  - Create `db/schema/userListingStates.ts`
  - Create `db/schema/digestLogs.ts`
  - Export all from `db/schema/index.ts` (append — do not remove existing exports)
  - Run `drizzle-kit generate` then `drizzle-kit migrate` to apply to Supabase

- [ ] **T-004** Create Drizzle query files
  - `db/queries/alerts.ts` — `getAlertsByUser`, `getAlertById`, `getActiveAlerts`, `countAlertsByUser`
  - `db/queries/listings.ts` — `getListingsByAlert`, `getListingsFeed`, `upsertListingState`

---

## Phase 1 — Stripe Webhook Extension

- [ ] **T-005** Extend existing Stripe webhook handler (`app/api/webhooks/stripe/route.ts`)
  - Locate the existing handler — do not replace it, extend it
  - In `checkout.session.completed`: call `clerkClient.users.updateUserMetadata(userId, { publicMetadata: { plan: "paid" } })`
  - In `customer.subscription.deleted`: call `clerkClient.users.updateUserMetadata(userId, { publicMetadata: { plan: "free" } })`
  - In `invoice.payment_failed`: send a plain Resend email to the user notifying of failure
  - Extract `userId` from Stripe session metadata (ensure it is passed in the checkout session on creation)

- [ ] **T-006** Ensure checkout session passes Clerk `userId` in metadata
  - Find where the boilerplate creates the Stripe checkout session
  - Add `metadata: { userId: userId }` to the session creation call so the webhook can read it
  - Verify the `STRIPE_PAID_PRICE_ID` env var is used as the price

---

## Phase 2 — Alert API

- [ ] **T-007** `GET /api/alerts`
  ```typescript
  // app/api/alerts/route.ts
  import { auth } from "@clerk/nextjs/server";
  import { getAlertsByUser } from "@/db/queries/alerts";

  export async function GET() {
    const { userId } = auth();
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const alerts = await getAlertsByUser(userId);
    return Response.json(alerts);
  }
  ```

- [ ] **T-008** `POST /api/alerts` with freemium enforcement
  ```typescript
  export async function POST(req: Request) {
    const { userId } = auth();
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const user = await currentUser();
    const isPaid = user?.publicMetadata?.plan === "paid";

    if (!isPaid) {
      const count = await countAlertsByUser(userId);
      if (count >= 3) {
        return Response.json({ error: "UPGRADE_REQUIRED" }, { status: 403 });
      }
    }

    const body = await req.json();
    // Zod validate body (keywords min 1, location required)
    const alert = await createAlert({ ...body, userId });
    // Enqueue first scrape job immediately
    await scrapeQueue.add("scrape", buildScrapeJobData(alert));
    return Response.json(alert, { status: 201 });
  }
  ```

- [ ] **T-009** `PATCH /api/alerts/[id]` — edit alert fields or toggle `isActive`
  - Verify `alert.userId === userId` before updating
  - Accept partial body (any subset of alert fields)

- [ ] **T-010** `DELETE /api/alerts/[id]`
  - Verify ownership
  - Delete alert row — Drizzle cascade will remove listings and states

---

## Phase 3 — Listings API

- [ ] **T-011** `GET /api/listings`
  - Query params: `alertId?`, `state?` (default excludes "dismissed"), `showDismissed?`, `minPrice?`, `maxPrice?`, `sort?` (newest|price_asc|price_desc), `page?` (default 1)
  - Join listings with `userListingStates` to attach per-user state
  - Return `{ listings, total, page, totalPages }`

- [ ] **T-012** `PATCH /api/listings/[id]/state`
  - Body: `{ state: "saved" | "dismissed" | "new" }`
  - Upsert `userListingStates` for this userId + listingId

- [ ] **T-013** `GET /api/unsubscribe?token=xxx`
  - Token = HMAC-SHA256 of `userId` using `JWT_SECRET` (or a dedicated `UNSUBSCRIBE_SECRET`)
  - No auth required — this link is included in emails
  - On valid token: set a `digestUnsubscribed: true` flag in Clerk `publicMetadata`
  - Return a plain "You've been unsubscribed" HTML page

---

## Phase 4 — Dashboard Layout & Shell

> The boilerplate already has a dashboard layout. Extend it — do not create a new one from scratch.

- [ ] **T-014** Add FlipAlert nav items to the existing sidebar/nav component
  - Add links: "Dashboard" (`/dashboard`), "My Alerts" (`/alerts`)
  - Add plan badge: show "Free Plan" with upgrade CTA for free users, "Pro" badge for paid users
  - Read plan from `currentUser().publicMetadata.plan`

- [ ] **T-015** Create redirect logic for new users
  - In the root dashboard page or middleware: if `userId` exists and alert count = 0, redirect to `/alerts/new`

---

## Phase 5 — Alert Wizard UI

- [ ] **T-016** Build `WizardShell.tsx` (`components/alerts/wizard/WizardShell.tsx`)
  - Manages step state (1–3) with `useState`
  - Renders step progress indicator: `Step {n} of 3`
  - Back / Continue buttons; Continue disabled if current step invalid
  - On step 3 submit: POST to `/api/alerts`, then `router.push("/dashboard")`
  - Show loading state during submission

- [ ] **T-017** Build `Step1Keywords.tsx`
  - Tag-style input: type keyword + press Enter or comma to add tag
  - Each tag has an × to remove
  - Store as `string[]` in wizard state
  - Continue disabled if `keywords.length === 0`
  - Use shadcn `Badge` for tags, shadcn `Input` for the text field

- [ ] **T-018** Build `Step2Filters.tsx`
  - Location: shadcn `Input`, required
  - Radius: shadcn `Select` with options 5 / 10 / 25 / 50 / 100 miles
  - Min/max price: two shadcn `Input` fields, type="number", optional
  - Condition: shadcn `Checkbox` group — Any, New, Used — Good, Used — Fair, For Parts
    - Selecting "Any" clears all others; selecting any specific condition deselects "Any"

- [ ] **T-019** Build `Step3Schedule.tsx`
  - Alert name: shadcn `Input`, pre-filled with `keywords[0]`, editable
  - Frequency: shadcn `RadioGroup` — Daily / Weekly
  - Read-only summary of step 1 + 2 values (keywords, location, radius, price range, conditions)
  - Submit button: "Create Alert"

- [ ] **T-020** Create `/alerts/new` page (`app/(dashboard)/alerts/new/page.tsx`)
  - Render `WizardShell` with the 3 step components
  - Page title: "Create your first alert" (new users) or "New Alert" (returning)

---

## Phase 6 — Alert Management Page

- [ ] **T-021** Build `AlertCard.tsx` (`components/alerts/AlertCard.tsx`)
  - Shows: alert name, keywords (as badges), location, radius, frequency, listing count, Active/Paused badge
  - Pause/Resume toggle — PATCH `isActive` on click
  - Edit button — links to `/alerts/[id]/edit` (reuse wizard in edit mode)
  - Delete button — shadcn `AlertDialog` confirmation, then DELETE request

- [ ] **T-022** Build `AlertList.tsx`
  - Renders list of `AlertCard` components
  - Empty state: "No alerts yet — create your first one" with CTA button
  - After 3rd card (free users only): render `UpgradePrompt` inline below the list

- [ ] **T-023** Create `/alerts` page (`app/(dashboard)/alerts/page.tsx`)
  - Server component: fetch alerts from `/api/alerts`
  - Render `AlertList`
  - "Add Alert" button at top right — links to `/alerts/new`

---

## Phase 7 — Dashboard Feed

- [ ] **T-024** Build `ListingCard.tsx` (`components/dashboard/ListingCard.tsx`)
  - Props: `listing` object + `state` ("new" | "saved" | "dismissed")
  - Layout: thumbnail left (64×64px, object-cover, placeholder if no image), details right
  - Shows: title (truncated 2 lines), price (bold, large), location, condition badge, relative time ("2h ago")
  - "View Deal" button — opens `listingUrl` in new tab
  - Save button (bookmark icon) — PATCH state to "saved"; filled when saved
  - Dismiss button (× icon) — PATCH state to "dismissed"; optimistic UI (card fades)
  - Use shadcn `Card`, `Badge`, `Button`

- [ ] **T-025** Build `FilterBar.tsx` (`components/dashboard/FilterBar.tsx`)
  - Alert selector: shadcn `Select` populated from user's alerts + "All Alerts" option
  - Sort: shadcn `Select` — Newest / Price Low→High / Price High→Low
  - "Show Dismissed" toggle: shadcn `Switch`
  - On any change: update URL search params → triggers server refetch

- [ ] **T-026** Build `ListingGrid.tsx`
  - Renders responsive grid: 3 cols desktop, 2 tablet, 1 mobile (Tailwind grid)
  - Accepts `listings[]` + pagination meta
  - Renders shadcn `Pagination` at bottom
  - Loading skeleton: 6 placeholder cards using shadcn `Skeleton`
  - Empty state: "No deals found yet — we'll email you when we find matches"

- [ ] **T-027** Create `/dashboard` page (`app/(dashboard)/dashboard/page.tsx`)
  - Server component: read URL params, fetch listings from `/api/listings`
  - Render `FilterBar` + `ListingGrid`
  - Page title: "Your Deals"

---

## Phase 8 — Scraper (Worker Service)

- [ ] **T-028** Build browser pool (`workers/src/scraper/browser.ts`)
  - `launchBrowser(proxyUrl: string)` using `playwright-extra` + stealth plugin
  - Random viewport from curated list
  - Random user-agent from curated list (8–10 real browser UAs)
  - Headless Chromium with `--no-sandbox` flag

- [ ] **T-029** Build proxy pool (`workers/src/scraper/proxy.ts`)
  - `ProxyPool` class: load from `process.env.PROXY_POOL` (comma-separated URLs)
  - `getNext()`: round-robin, skip degraded proxies
  - `markDegraded(proxy)`: excludes proxy for 30 minutes
  - Full implementation in ARCHITECTURE.md §6

- [ ] **T-030** Build DOM parser (`workers/src/scraper/parser.ts`)
  - Input: raw HTML string from Playwright `page.content()`
  - Extract per listing: title, price (normalize "$1,200" → 1200), location, condition, imageUrl, listingUrl
  - Use `cheerio` or regex on the HTML — choose based on FB Marketplace's actual DOM structure
  - Return `RawListing[]`; missing fields are `null`, never throw

- [ ] **T-031** Build marketplace scraper (`workers/src/scraper/marketplace.ts`)
  - `scrapeMarketplace(job: ScrapeJobData, pool: ProxyPool): Promise<RawListing[]>`
  - Full implementation from ARCHITECTURE.md §6
  - Construct search URL via `buildSearchUrl(job)`
  - Navigate, wait for listing selector (with graceful timeout), get page HTML, parse
  - Mark proxy degraded on network errors; rethrow for BullMQ retry

- [ ] **T-032** Build scrape worker (`workers/src/workers/scrapeWorker.ts`)
  ```typescript
  import { Worker } from "bullmq";
  import { db } from "../lib/db";
  import { listings } from "../../../db/schema/listings";
  import { scrapeMarketplace } from "../scraper/marketplace";

  export function startScrapeWorker(pool: ProxyPool) {
    return new Worker("flipalert:scrape", async (job) => {
      const raw = await scrapeMarketplace(job.data, pool);

      // Filter to matching listings only
      const matched = raw.filter(l => matchesAlert(l, job.data));

      // Bulk insert — skip duplicates via unique constraint
      if (matched.length > 0) {
        await db.insert(listings).values(
          matched.map(l => ({ ...l, alertId: job.data.alertId }))
        ).onConflictDoNothing();
      }

      // Update lastScrapedAt
      await db.update(alerts)
        .set({ lastScrapedAt: new Date() })
        .where(eq(alerts.id, job.data.alertId));

      console.log(`[scrape] alert=${job.data.alertId} found=${matched.length}`);
    }, {
      connection,
      attempts: 3,
      backoff: { type: "exponential", delay: 60000 },
    });
  }
  ```

---

## Phase 9 — Email Digest (Worker Service)

- [ ] **T-033** Build email template (`workers/src/email/templates/digest.ts`)
  - `buildDigestEmail(alertName: string, listings: Listing[]): { subject: string, html: string }`
  - Subject: `🔔 {N} new deals for "{alertName}"`
  - HTML: inline-CSS email (no external stylesheets — email clients strip them)
  - Card per listing: thumbnail (`<img>`), title, price (bold), location, condition, "View on Marketplace" button
  - Footer: unsubscribe link (`/api/unsubscribe?token=xxx`), "Manage alerts" link
  - If listing has no image: grey placeholder div

- [ ] **T-034** Build email sender (`workers/src/email/sender.ts`)
  - Wrap Resend client
  - `sendDigest(toEmail: string, alertName: string, listings: Listing[]): Promise<void>`
  - Log success/failure; do not throw on Resend error (log and continue)

- [ ] **T-035** Build digest worker (`workers/src/workers/digestWorker.ts`)
  - Consume `flipalert:digest` queue
  - Query: listings for `alertId` scraped after `sinceDate` where state ≠ "dismissed"
  - If 0 matches: log `skipped_no_matches`, insert DigestLog, return
  - If matches: call `sendDigest`, insert DigestLog with status "sent"
  - On Resend failure: insert DigestLog with status "failed"

---

## Phase 10 — Scheduler (Worker Service)

- [ ] **T-036** Build cron scheduler (`workers/src/scheduler/cron.ts`)
  ```typescript
  import cron from "node-cron";
  import { db } from "../lib/db";
  import { scrapeQueue, digestQueue } from "../queues/definitions";

  export function startScheduler() {
    // Scrape: paid users every hour
    cron.schedule("0 * * * *", async () => {
      const paidAlerts = await db.select().from(alerts)
        .where(and(eq(alerts.isActive, true)))
        // filter by userId where Clerk plan = "paid"
        // Note: query Clerk API or store plan in alerts table for efficient filtering
      for (const alert of paidAlerts) {
        await scrapeQueue.add("scrape", buildScrapeJobData(alert));
      }
    });

    // Scrape: free users every 6 hours
    cron.schedule("0 */6 * * *", async () => {
      // same pattern for free user alerts
    });

    // Digest: check every hour, send if it's 8 AM in user's timezone
    cron.schedule("0 * * * *", async () => {
      const now = new Date();
      const dueAlerts = await getAlertsDueForDigest(now);
      for (const alert of dueAlerts) {
        const lastLog = await getLastDigestLog(alert.id);
        await digestQueue.add("digest", {
          alertId: alert.id,
          userId: alert.userId,
          userEmail: alert.userEmail,
          alertName: alert.name,
          sinceDate: lastLog?.sentAt?.toISOString() ?? new Date(Date.now() - 86400000).toISOString(),
        });
      }
    });
  }
  ```

  > **Note on plan filtering in cron:** To avoid calling Clerk API in a hot loop, consider caching plan status locally (e.g. a simple in-memory map refreshed every 10 minutes, or a `plan` column added to the `alerts` table denormalized from Clerk). Decide and document the approach before implementing.

- [ ] **T-037** Wire everything in `workers/src/index.ts`
  ```typescript
  import { ProxyPool } from "./scraper/proxy";
  import { startScrapeWorker } from "./workers/scrapeWorker";
  import { startDigestWorker } from "./workers/digestWorker";
  import { startScheduler } from "./scheduler/cron";

  const pool = new ProxyPool(process.env.PROXY_POOL!.split(","));

  startScrapeWorker(pool);
  startDigestWorker();
  startScheduler();

  console.log("FlipAlert workers started");
  ```

---

## Phase 11 — Billing UI

- [ ] **T-038** Build `UpgradePrompt.tsx` (`components/billing/UpgradePrompt.tsx`)
  - shadcn `Dialog` or inline banner (use Dialog for alert limit hit, banner for general nudge)
  - Headline: "You've reached the free plan limit"
  - Comparison: Free (3 alerts, 6hr refresh) vs Pro (unlimited, 1hr refresh, $5.99/mo)
  - CTA: "Upgrade to Pro" → POST to existing Stripe checkout endpoint → redirect
  - Use the boilerplate's existing checkout route — do not create a new one

- [ ] **T-039** Trigger `UpgradePrompt` in two places:
  - Alert creation API returns 403 `UPGRADE_REQUIRED` → frontend catches and opens modal
  - After 3rd alert card in `AlertList` → render inline upgrade banner

---

## Phase 12 — Polish

- [ ] **T-040** Toast notifications
  - Use shadcn `Sonner` (or `useToast` already in boilerplate)
  - Show toasts for: alert created, alert deleted, listing saved, listing dismissed, upgrade success

- [ ] **T-041** Loading skeletons
  - `ListingGrid` loading state: 6 shadcn `Skeleton` cards
  - `AlertList` loading state: 3 skeleton rows
  - Use Next.js `loading.tsx` pattern for route-level skeletons

- [ ] **T-042** Rate limiting on alert creation
  - Add simple Redis-based rate limit in `POST /api/alerts`
  - Max 10 alert creates per user per hour
  - Return 429 with `Retry-After` header if exceeded

- [ ] **T-043** End-to-end smoke test
  - Register → wizard → create alert → confirm scrape job in Redis queue → confirm listing in DB → confirm digest email received
  - Document steps in `docs/smoke-test.md`

---

## Dependency Order

```
Phase 0 (Schema + Setup)
  → Phase 1 (Stripe webhook extension)
    → Phase 2 (Alert API)
      → Phase 3 (Listings API)
      → Phase 4 (Dashboard shell)
        → Phase 5 (Alert Wizard UI)      ← can run parallel with Phase 8
        → Phase 6 (Alert Management UI)
        → Phase 7 (Dashboard Feed UI)
      → Phase 8 (Scraper workers)        ← can run parallel with Phases 5–7
        → Phase 9 (Digest workers)
          → Phase 10 (Scheduler)
            → Phase 11 (Billing UI)
              → Phase 12 (Polish)
```

Phases 5–7 (UI) and Phases 8–10 (workers) can be built in parallel once Phases 0–3 are complete.
```
