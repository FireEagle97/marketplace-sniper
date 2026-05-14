# FlipAlert — Architecture
**Version:** 1.1
**Last Updated:** 2026-05-14

---

## 1. Foundation: CodeSpring Boilerplate

This project starts from the **CodeSpring Boilerplate**, which pre-wires:
- **Next.js 14** App Router + Tailwind CSS + shadcn/ui + Framer Motion
- **Clerk** for all authentication (sessions, email verification, password reset)
- **Supabase** (PostgreSQL) + **Drizzle ORM** for the database
- **Stripe** for payments (checkout, webhooks, customer portal)
- **Vercel** for deployment

The boilerplate folder structure is:
```
.
├── actions/        # Server actions (already has auth + billing actions)
├── app/            # Next.js App Router
├── components/     # shadcn/ui based components
├── db/             # Drizzle config, schema, migrations, queries
│   ├── schema/     # Table definitions
│   └── queries/    # Reusable query functions
└── lib/            # Utility helpers
```

**Do not move, rename, or restructure the boilerplate's existing files.** All FlipAlert additions extend this structure.

---

## 2. What FlipAlert Adds

```
(boilerplate, already exists)          (FlipAlert additions)
─────────────────────────────          ──────────────────────────────────
app/
  (auth)/                              app/
  (dashboard)/              →            (dashboard)/
  api/                                     alerts/
    webhooks/stripe/                         page.tsx         ← alert list
                                             new/
                                               page.tsx       ← wizard
                                         dashboard/
                                           page.tsx           ← listing feed
                                       api/
                                         alerts/
                                           route.ts           ← CRUD
                                           [id]/route.ts
                                         listings/
                                           route.ts           ← paginated feed
                                           [id]/state/route.ts
                                         unsubscribe/
                                           route.ts           ← no-auth unsubscribe

db/
  schema/                   →          db/
    (existing tables)                    schema/
                                           alerts.ts          ← new
                                           listings.ts        ← new
                                           userListingStates.ts ← new
                                           digestLogs.ts      ← new
                                         queries/
                                           alerts.ts          ← new
                                           listings.ts        ← new

components/                 →          components/
  ui/ (shadcn)                           alerts/
                                           AlertCard.tsx
                                           AlertList.tsx
                                           wizard/
                                             WizardShell.tsx
                                             Step1Keywords.tsx
                                             Step2Filters.tsx
                                             Step3Schedule.tsx
                                         dashboard/
                                           ListingCard.tsx
                                           ListingGrid.tsx
                                           FilterBar.tsx
                                         billing/
                                           UpgradePrompt.tsx

actions/                    →          actions/
  (existing)                             alert-actions.ts     ← new
                                         listing-actions.ts   ← new

lib/                        →          lib/
  (existing)                             email.ts             ← Resend client
                                         queue.ts             ← BullMQ enqueue
                                         scraper-url.ts       ← URL builder

workers/                               workers/               ← NEW SERVICE
  (does not exist in boilerplate)        src/
                                           index.ts
                                           queues/definitions.ts
                                           workers/
                                             scrapeWorker.ts
                                             digestWorker.ts
                                           scraper/
                                             browser.ts
                                             proxy.ts
                                             marketplace.ts
                                             parser.ts
                                           email/
                                             sender.ts
                                             templates/digest.ts
                                           scheduler/cron.ts
                                           lib/
                                             db.ts
                                             logger.ts
                                         package.json
                                         tsconfig.json
```

---

## 3. Database Schema (Drizzle — additions only)

Add these files to `db/schema/`. The boilerplate already has its own schema files — do not modify them, only add new ones.

### `db/schema/alerts.ts`
```typescript
import { pgTable, text, integer, real, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const frequencyEnum = pgEnum("frequency", ["daily", "weekly"]);

export const alerts = pgTable("alerts", {
  id:           text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId:       text("user_id").notNull(),           // Clerk userId
  name:         text("name").notNull(),
  keywords:     text("keywords").array().notNull(),  // ["vintage lamp", "ps5"]
  minPrice:     real("min_price"),
  maxPrice:     real("max_price"),
  location:     text("location").notNull(),
  radiusMiles:  integer("radius_miles").notNull().default(25),
  conditions:   text("conditions").array().notNull().default([]), // [] = Any
  frequency:    frequencyEnum("frequency").notNull().default("daily"),
  isActive:     boolean("is_active").notNull().default(true),
  lastScrapedAt: timestamp("last_scraped_at"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
  updatedAt:    timestamp("updated_at").notNull().defaultNow(),
});

export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;
```

### `db/schema/listings.ts`
```typescript
import { pgTable, text, real, timestamp, unique } from "drizzle-orm/pg-core";

export const listings = pgTable("listings", {
  id:         text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  alertId:    text("alert_id").notNull(),
  title:      text("title").notNull(),
  price:      real("price"),
  location:   text("location"),
  condition:  text("condition"),
  imageUrl:   text("image_url"),
  listingUrl: text("listing_url").notNull(),
  postedAt:   timestamp("posted_at"),
  scrapedAt:  timestamp("scraped_at").notNull().defaultNow(),
}, (t) => ({
  dedup: unique().on(t.alertId, t.listingUrl),   // core deduplication constraint
}));

export type Listing = typeof listings.$inferSelect;
```

### `db/schema/userListingStates.ts`
```typescript
import { pgTable, text, timestamp, pgEnum, unique } from "drizzle-orm/pg-core";

export const listingStateEnum = pgEnum("listing_state", ["new", "saved", "dismissed"]);

export const userListingStates = pgTable("user_listing_states", {
  id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId:    text("user_id").notNull(),
  listingId: text("listing_id").notNull(),
  state:     listingStateEnum("state").notNull().default("new"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  uniq: unique().on(t.userId, t.listingId),
}));
```

### `db/schema/digestLogs.ts`
```typescript
import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const digestLogs = pgTable("digest_logs", {
  id:           text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId:       text("user_id").notNull(),
  alertId:      text("alert_id").notNull(),
  sentAt:       timestamp("sent_at").notNull().defaultNow(),
  listingCount: integer("listing_count").notNull(),
  status:       text("status").notNull(), // "sent" | "skipped_no_matches" | "failed"
});
```

### Export from `db/schema/index.ts`
Add to the existing index (do not remove boilerplate exports):
```typescript
export * from "./alerts";
export * from "./listings";
export * from "./userListingStates";
export * from "./digestLogs";
```

---

## 4. Authentication & Plan Detection

**All auth is Clerk.** Never write custom session logic.

```typescript
// In any server component or API route:
import { auth, currentUser } from "@clerk/nextjs/server";

const { userId } = auth();                        // fast — just the ID
const user = await currentUser();                 // full user object
const plan = user?.publicMetadata?.plan as string ?? "free";
const isPaid = plan === "paid";
```

**Setting the plan** — extend the existing Stripe webhook handler in `app/api/webhooks/stripe/route.ts`:
```typescript
import { clerkClient } from "@clerk/nextjs/server";

// Inside checkout.session.completed handler:
await clerkClient.users.updateUserMetadata(userId, {
  publicMetadata: { plan: "paid" },
});

// Inside customer.subscription.deleted handler:
await clerkClient.users.updateUserMetadata(userId, {
  publicMetadata: { plan: "free" },
});
```

---

## 5. Job Queue Design

The worker service is a **separate Node.js process** deployed on Railway. The Next.js app only enqueues jobs — it never runs workers.

### Queue Names
```
flipalert:scrape    — one job per alert per scrape cycle
flipalert:digest    — one job per alert per send window
```

### Job Types
```typescript
// workers/src/queues/definitions.ts

export type ScrapeJobData = {
  alertId: string;
  userId: string;
  keywords: string[];
  location: string;
  radiusMiles: number;
  minPrice?: number;
  maxPrice?: number;
  conditions: string[];
};

export type DigestJobData = {
  alertId: string;
  userId: string;
  userEmail: string;
  alertName: string;
  sinceDate: string; // ISO datetime — only listings scraped after this
};
```

### Enqueue from Next.js (`lib/queue.ts`)
```typescript
import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

export const scrapeQueue = new Queue("flipalert:scrape", { connection });
export const digestQueue = new Queue("flipalert:digest", { connection });
```

### Cron in Worker Service (`scheduler/cron.ts`)
```
Every 1 hour  → enqueue scrape jobs for all active PAID alerts
Every 6 hours → enqueue scrape jobs for all active FREE alerts
Every 1 hour  → check digest schedule:
                  if current hour = 8 AM in user timezone → enqueue DAILY digest jobs
                  if above + today is Monday → enqueue WEEKLY digest jobs
```

---

## 6. Scraper Design

### Stack
- `playwright` + `playwright-extra` + `puppeteer-extra-plugin-stealth`
- One Playwright browser pool (3 instances) shared across workers
- One rotating proxy per scrape job

### Browser Pool (`scraper/browser.ts`)
```typescript
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

chromium.use(StealthPlugin());

const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/123.0 Safari/537.36",
  // add 8–10 real browser UAs
];

export async function launchBrowser(proxyUrl: string) {
  const viewport = VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)];
  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

  return chromium.launch({
    headless: true,
    proxy: { server: proxyUrl },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}
```

### Proxy Rotation (`scraper/proxy.ts`)
```typescript
// Rotate from a pool; mark as degraded on connection failure for 30 min
export class ProxyPool {
  private proxies: string[];
  private degraded: Map<string, number> = new Map(); // proxy → degraded until timestamp
  private index = 0;

  constructor(proxies: string[]) {
    this.proxies = proxies;
  }

  getNext(): string {
    const now = Date.now();
    for (let i = 0; i < this.proxies.length; i++) {
      const proxy = this.proxies[this.index % this.proxies.length];
      this.index++;
      const degradedUntil = this.degraded.get(proxy) ?? 0;
      if (now > degradedUntil) return proxy;
    }
    throw new Error("No healthy proxies available");
  }

  markDegraded(proxy: string) {
    this.degraded.set(proxy, Date.now() + 30 * 60 * 1000); // 30 min
  }
}
```

### Marketplace Scraper (`scraper/marketplace.ts`)
```typescript
import { ScrapeJobData } from "../queues/definitions";
import { launchBrowser } from "./browser";
import { parseListings } from "./parser";
import { ProxyPool } from "./proxy";

export async function scrapeMarketplace(job: ScrapeJobData, pool: ProxyPool) {
  const proxy = pool.getNext();
  const browser = await launchBrowser(proxy);
  const page = await browser.newPage();

  try {
    const url = buildSearchUrl(job);
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

    // Random delay to simulate human behaviour
    await page.waitForTimeout(500 + Math.random() * 1500);

    // Wait for listing grid
    await page.waitForSelector('[data-testid="marketplace-items"]', { timeout: 15000 })
      .catch(() => null); // graceful — page structure may vary

    const html = await page.content();
    return parseListings(html);
  } catch (err: any) {
    if (err.message.includes("net::ERR")) pool.markDegraded(proxy);
    throw err;
  } finally {
    await browser.close();
  }
}

function buildSearchUrl(job: ScrapeJobData): string {
  const params = new URLSearchParams({
    query: job.keywords.join(" "),
    ...(job.minPrice && { minPrice: String(job.minPrice) }),
    ...(job.maxPrice && { maxPrice: String(job.maxPrice) }),
    ...(job.conditions.length && { itemCondition: job.conditions.join(",") }),
    radius: String(job.radiusMiles),
  });
  return `https://www.facebook.com/marketplace/${job.location}/search?${params}`;
}
```

---

## 7. API Routes Reference (new routes only)

The boilerplate already has routes for auth and Stripe webhooks. Add:

| Method | Route | Description |
|---|---|---|
| GET | `/api/alerts` | List user's alerts with listing counts |
| POST | `/api/alerts` | Create alert (enforce free tier limit) |
| PATCH | `/api/alerts/[id]` | Edit alert or toggle isActive |
| DELETE | `/api/alerts/[id]` | Delete alert (cascade) |
| GET | `/api/listings` | Paginated feed with filters |
| PATCH | `/api/listings/[id]/state` | Set state: saved / dismissed / new |
| GET | `/api/unsubscribe` | One-click digest unsubscribe (no auth) |

---

## 8. Environment Variables

### Addition to boilerplate's `.env.local`
```bash
# Already in boilerplate — do not duplicate:
# DATABASE_URL, NEXT_PUBLIC_CLERK_*, CLERK_SECRET_KEY,
# STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_*

# Add for FlipAlert:
REDIS_URL=                        # Railway Redis connection string
RESEND_API_KEY=                   # Resend transactional email
STRIPE_PAID_PRICE_ID=             # $5.99/month Stripe Price ID

# Worker service only (workers/.env):
REDIS_URL=
DATABASE_URL=
RESEND_API_KEY=
PROXY_POOL=                       # Comma-separated proxy URLs
                                  # Format: http://user:pass@host:port,http://...
LOG_LEVEL=info
```

---

## 9. Deployment

| Service | Platform | Notes |
|---|---|---|
| Web app | Vercel | Already configured by boilerplate |
| PostgreSQL | Supabase | Already configured by boilerplate |
| Worker service | Railway | New — always-on Node.js process |
| Redis | Railway | New — required by BullMQ |
| Email | Resend | New — transactional digest emails |
| Proxies | Webshare / Oxylabs | External subscription |

### Railway Setup (new)
1. Create Railway project
2. Add `flipalert-redis` service (Redis plugin)
3. Add `flipalert-workers` service (deploy from `workers/` directory)
4. Copy `REDIS_URL`, `DATABASE_URL` (from Supabase), `RESEND_API_KEY`, `PROXY_POOL` into Railway env vars
5. Confirm cron jobs firing in Railway logs

### First Deploy Checklist
- [ ] Run `drizzle-kit generate` + `drizzle-kit migrate` for new tables
- [ ] Extend Stripe webhook handler to write Clerk `publicMetadata.plan`
- [ ] Register Resend domain / sender address
- [ ] Configure proxy provider, populate `PROXY_POOL` env var
- [ ] Deploy workers to Railway, verify scrape job fires
- [ ] Deploy web to Vercel, verify alert creation end-to-end
- [ ] Send one manual digest to verify email rendering
