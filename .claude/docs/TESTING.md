# FlipAlert — Testing Framework
**Version:** 1.0
**Last Updated:** 2026-05-14

---

## Philosophy

Every task in TASKS.md is only complete when its verification steps pass.
Claude Code must run the relevant checks before marking a task `[x]`.

There are 4 layers of verification, applied depending on what the task touches:

| Layer | What it covers | Tool |
|---|---|---|
| 1. Type check | No TypeScript errors | `tsc --noEmit` |
| 2. Unit test | Logic in isolation (matching, parsing, URL building) | Vitest |
| 3. Integration test | API routes + DB queries against real Supabase (test schema) | Vitest + test DB |
| 4. Manual smoke test | End-to-end flow a human or script walks through | Checklist in `docs/smoke-test.md` |

Not every task needs all 4 layers. The matrix below maps tasks to required layers.

---

## Setup

### Install test dependencies (run once)
```bash
npm install -D vitest @vitest/coverage-v8 supertest @types/supertest
```

### `vitest.config.ts` (root)
```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      reporter: ["text", "html"],
      include: ["app/api/**", "lib/**", "workers/src/**"],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

### `tests/setup.ts`
```typescript
import { beforeAll, afterAll } from "vitest";

// Point to test schema in Supabase (set TEST_DATABASE_URL in .env.test)
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL!;

beforeAll(async () => {
  // Seed minimal test data if needed
});

afterAll(async () => {
  // Clean up test data
});
```

### `.env.test`
```bash
# Separate Supabase schema for tests — never run tests against production DB
TEST_DATABASE_URL="postgresql://..."   # same Supabase project, schema: "test"
CLERK_SECRET_KEY="sk_test_..."         # Clerk test instance
REDIS_URL="redis://localhost:6379/1"   # DB index 1 to isolate from dev
RESEND_API_KEY="re_test_..."
PROXY_POOL="http://fake:fake@proxy.test:8080"
```

---

## Layer 1 — Type Check (every task)

Run after every task before marking complete:
```bash
npx tsc --noEmit
```

Claude Code must fix all type errors before proceeding. Zero type errors is the baseline requirement for every task.

---

## Layer 2 — Unit Tests

These test pure logic functions with no DB or network calls.

### File location convention
```
tests/
  unit/
    scraper/
      parser.test.ts
      url-builder.test.ts
      matching.test.ts
    email/
      digest-template.test.ts
    api/
      freemium-limit.test.ts
```

### Tests to write per task group

---

#### T-003 / T-004 — Schema & Queries
No unit tests needed — covered by integration tests.

---

#### T-007 / T-008 — Alert API (freemium logic)

**`tests/unit/api/freemium-limit.test.ts`**
```typescript
import { describe, it, expect } from "vitest";
import { canCreateAlert } from "@/lib/freemium";

describe("canCreateAlert", () => {
  it("allows free user with 0 alerts", () => {
    expect(canCreateAlert({ plan: "free", alertCount: 0 })).toBe(true);
  });

  it("allows free user with 2 alerts", () => {
    expect(canCreateAlert({ plan: "free", alertCount: 2 })).toBe(true);
  });

  it("blocks free user at 3 alerts", () => {
    expect(canCreateAlert({ plan: "free", alertCount: 3 })).toBe(false);
  });

  it("allows paid user with 100 alerts", () => {
    expect(canCreateAlert({ plan: "paid", alertCount: 100 })).toBe(true);
  });
});
```

Extract the limit logic into `lib/freemium.ts` so it's testable in isolation:
```typescript
// lib/freemium.ts
export function canCreateAlert({ plan, alertCount }: { plan: string; alertCount: number }) {
  if (plan === "paid") return true;
  return alertCount < 3;
}
```

---

#### T-030 — DOM Parser

**`tests/unit/scraper/parser.test.ts`**
```typescript
import { describe, it, expect } from "vitest";
import { parseListings } from "@/workers/src/scraper/parser";
import { readFileSync } from "fs";
import path from "path";

// Save a real FB Marketplace HTML snapshot to tests/fixtures/marketplace-sample.html
const sampleHtml = readFileSync(
  path.join(__dirname, "../../fixtures/marketplace-sample.html"),
  "utf-8"
);

describe("parseListings", () => {
  it("extracts at least one listing from sample HTML", () => {
    const results = parseListings(sampleHtml);
    expect(results.length).toBeGreaterThan(0);
  });

  it("each listing has a listingUrl", () => {
    const results = parseListings(sampleHtml);
    results.forEach(l => expect(l.listingUrl).toBeTruthy());
  });

  it("normalizes price string to float", () => {
    const results = parseListings(sampleHtml);
    const withPrice = results.filter(l => l.price !== null);
    withPrice.forEach(l => expect(typeof l.price).toBe("number"));
  });

  it("returns null for missing fields, never throws", () => {
    expect(() => parseListings("<html></html>")).not.toThrow();
  });
});
```

> **How to get the fixture:** After T-031 is working, run the scraper once manually, save `page.content()` to `tests/fixtures/marketplace-sample.html`. All parser tests run against this static snapshot — no live network calls.

---

#### T-031 — Marketplace URL Builder

**`tests/unit/scraper/url-builder.test.ts`**
```typescript
import { describe, it, expect } from "vitest";
import { buildSearchUrl } from "@/workers/src/scraper/marketplace";

describe("buildSearchUrl", () => {
  it("includes keywords in query param", () => {
    const url = buildSearchUrl({ keywords: ["ps5", "playstation"], location: "montreal", radiusMiles: 25 });
    expect(url).toContain("query=ps5+playstation");
  });

  it("includes price range when set", () => {
    const url = buildSearchUrl({ keywords: ["lamp"], location: "toronto", radiusMiles: 10, minPrice: 20, maxPrice: 200 });
    expect(url).toContain("minPrice=20");
    expect(url).toContain("maxPrice=200");
  });

  it("omits price params when not set", () => {
    const url = buildSearchUrl({ keywords: ["lamp"], location: "toronto", radiusMiles: 10 });
    expect(url).not.toContain("minPrice");
    expect(url).not.toContain("maxPrice");
  });

  it("includes radius", () => {
    const url = buildSearchUrl({ keywords: ["bike"], location: "vancouver", radiusMiles: 50 });
    expect(url).toContain("radius=50");
  });
});
```

---

#### T-032 — Matching Logic

**`tests/unit/scraper/matching.test.ts`**
```typescript
import { describe, it, expect } from "vitest";
import { matchesAlert } from "@/workers/src/scraper/scrapeWorker";

const baseListing = {
  title: "Vintage Yamaha Road Bike",
  price: 150,
  condition: "used_good",
  listingUrl: "https://facebook.com/marketplace/item/123",
};

const baseAlert = {
  keywords: ["road bike", "yamaha"],
  minPrice: 50,
  maxPrice: 300,
  conditions: ["used_good", "used_fair"],
};

describe("matchesAlert", () => {
  it("matches when keyword found in title", () => {
    expect(matchesAlert(baseListing, baseAlert)).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(matchesAlert({ ...baseListing, title: "VINTAGE YAMAHA ROAD BIKE" }, baseAlert)).toBe(true);
  });

  it("rejects when no keyword matches", () => {
    expect(matchesAlert({ ...baseListing, title: "iPhone 13" }, baseAlert)).toBe(false);
  });

  it("rejects when price below min", () => {
    expect(matchesAlert({ ...baseListing, price: 10 }, baseAlert)).toBe(false);
  });

  it("rejects when price above max", () => {
    expect(matchesAlert({ ...baseListing, price: 999 }, baseAlert)).toBe(false);
  });

  it("matches when conditions is empty (Any)", () => {
    expect(matchesAlert(baseListing, { ...baseAlert, conditions: [] })).toBe(true);
  });

  it("rejects when condition not in allowed list", () => {
    expect(matchesAlert({ ...baseListing, condition: "for_parts" }, baseAlert)).toBe(false);
  });

  it("passes when price is null and no price filter set", () => {
    expect(matchesAlert(
      { ...baseListing, price: null },
      { ...baseAlert, minPrice: undefined, maxPrice: undefined }
    )).toBe(true);
  });
});
```

---

#### T-033 — Email Template

**`tests/unit/email/digest-template.test.ts`**
```typescript
import { describe, it, expect } from "vitest";
import { buildDigestEmail } from "@/workers/src/email/templates/digest";

const mockListings = [
  {
    id: "1",
    title: "PS5 Console",
    price: 350,
    location: "Montreal, QC",
    condition: "used_good",
    imageUrl: "https://example.com/img.jpg",
    listingUrl: "https://facebook.com/marketplace/item/1",
    scrapedAt: new Date(),
  },
];

describe("buildDigestEmail", () => {
  it("includes alert name in subject", () => {
    const { subject } = buildDigestEmail("PS5 Alert", mockListings);
    expect(subject).toContain("PS5 Alert");
  });

  it("includes listing count in subject", () => {
    const { subject } = buildDigestEmail("PS5 Alert", mockListings);
    expect(subject).toContain("1");
  });

  it("includes listing title in HTML", () => {
    const { html } = buildDigestEmail("PS5 Alert", mockListings);
    expect(html).toContain("PS5 Console");
  });

  it("includes listing URL in HTML", () => {
    const { html } = buildDigestEmail("PS5 Alert", mockListings);
    expect(html).toContain("https://facebook.com/marketplace/item/1");
  });

  it("includes unsubscribe link", () => {
    const { html } = buildDigestEmail("PS5 Alert", mockListings);
    expect(html).toContain("/api/unsubscribe");
  });

  it("handles missing image gracefully", () => {
    const listingsNoImg = [{ ...mockListings[0], imageUrl: null }];
    expect(() => buildDigestEmail("Test", listingsNoImg)).not.toThrow();
  });
});
```

---

## Layer 3 — Integration Tests

These test API routes against a real test database. They require `TEST_DATABASE_URL` to point to a test schema in Supabase.

### File location convention
```
tests/
  integration/
    alerts.test.ts
    listings.test.ts
    stripe-webhook.test.ts
```

### Helpers

**`tests/helpers/auth.ts`** — mock Clerk auth for API route tests
```typescript
import { vi } from "vitest";

export function mockAuth(userId: string, plan: "free" | "paid" = "free") {
  vi.mock("@clerk/nextjs/server", () => ({
    auth: () => ({ userId }),
    currentUser: () => ({
      id: userId,
      emailAddresses: [{ emailAddress: `${userId}@test.com` }],
      publicMetadata: { plan },
    }),
  }));
}
```

**`tests/helpers/db.ts`** — seed and clean test data
```typescript
import { db } from "@/db";
import { alerts, listings, userListingStates } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function seedAlert(userId: string, overrides = {}) {
  const [alert] = await db.insert(alerts).values({
    userId,
    name: "Test Alert",
    keywords: ["test"],
    location: "montreal",
    radiusMiles: 25,
    conditions: [],
    frequency: "daily",
    ...overrides,
  }).returning();
  return alert;
}

export async function cleanupUser(userId: string) {
  await db.delete(alerts).where(eq(alerts.userId, userId));
}
```

---

#### Alerts API Integration Tests

**`tests/integration/alerts.test.ts`**
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mockAuth } from "../helpers/auth";
import { seedAlert, cleanupUser } from "../helpers/db";
import { GET, POST } from "@/app/api/alerts/route";

const TEST_USER = "test_user_001";

beforeEach(() => mockAuth(TEST_USER, "free"));
afterEach(() => cleanupUser(TEST_USER));

describe("GET /api/alerts", () => {
  it("returns empty array for new user", async () => {
    const res = await GET(new Request("http://localhost/api/alerts"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });

  it("returns seeded alerts for user", async () => {
    await seedAlert(TEST_USER, { name: "My Alert" });
    const res = await GET(new Request("http://localhost/api/alerts"));
    const body = await res.json();
    expect(body.length).toBe(1);
    expect(body[0].name).toBe("My Alert");
  });
});

describe("POST /api/alerts — free tier limit", () => {
  it("creates alert when under limit", async () => {
    const req = new Request("http://localhost/api/alerts", {
      method: "POST",
      body: JSON.stringify({ name: "Alert 1", keywords: ["ps5"], location: "montreal", radiusMiles: 25, conditions: [], frequency: "daily" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("blocks creation at 3 alerts for free user", async () => {
    await seedAlert(TEST_USER);
    await seedAlert(TEST_USER);
    await seedAlert(TEST_USER);

    const req = new Request("http://localhost/api/alerts", {
      method: "POST",
      body: JSON.stringify({ name: "Alert 4", keywords: ["lamp"], location: "montreal", radiusMiles: 25, conditions: [], frequency: "daily" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("UPGRADE_REQUIRED");
  });

  it("allows creation beyond 3 for paid user", async () => {
    mockAuth(TEST_USER, "paid");
    await seedAlert(TEST_USER);
    await seedAlert(TEST_USER);
    await seedAlert(TEST_USER);

    const req = new Request("http://localhost/api/alerts", {
      method: "POST",
      body: JSON.stringify({ name: "Alert 4", keywords: ["lamp"], location: "montreal", radiusMiles: 25, conditions: [], frequency: "daily" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });
});
```

---

#### Stripe Webhook Integration Test

**`tests/integration/stripe-webhook.test.ts`**
```typescript
import { describe, it, expect, vi } from "vitest";

// Mock Clerk client
const mockUpdateMetadata = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: { users: { updateUserMetadata: mockUpdateMetadata } },
}));

// Mock Stripe signature verification
vi.mock("stripe", () => ({
  default: class {
    webhooks = {
      constructEvent: (_body: any, _sig: any, _secret: any) => ({
        type: "checkout.session.completed",
        data: { object: { metadata: { userId: "user_123" } } },
      }),
    };
  },
}));

describe("Stripe webhook — checkout.session.completed", () => {
  it("sets user plan to paid in Clerk metadata", async () => {
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const req = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "fake_sig" },
      body: JSON.stringify({}),
    });

    await POST(req);

    expect(mockUpdateMetadata).toHaveBeenCalledWith("user_123", {
      publicMetadata: { plan: "paid" },
    });
  });
});
```

---

## Layer 4 — Smoke Test (Manual / Scripted)

Run this after each phase is complete to verify the full flow works end-to-end.

**`docs/smoke-test.md`** — Claude Code updates this file with results after each phase.

```markdown
# FlipAlert Smoke Test

## How to run
Run against local dev environment (`npm run dev` + workers running locally).

## Phase 2 — Alert API
- [ ] POST /api/alerts with valid body → 201, alert in DB
- [ ] POST /api/alerts 4th time as free user → 403 UPGRADE_REQUIRED
- [ ] GET /api/alerts → returns created alerts
- [ ] PATCH /api/alerts/[id] → updated fields reflected in GET
- [ ] DELETE /api/alerts/[id] → 200, alert gone from GET

## Phase 5 — Alert Wizard UI
- [ ] Navigate to /alerts/new → wizard renders
- [ ] Step 1: add 2 keywords, continue
- [ ] Step 2: enter location, select radius + conditions, continue
- [ ] Step 3: confirm summary correct, submit → redirected to /dashboard
- [ ] Alert appears in /alerts list

## Phase 7 — Dashboard Feed
- [ ] /dashboard loads with listing cards
- [ ] Filter by alert → only that alert's listings shown
- [ ] Click Save on a card → bookmark fills
- [ ] Click Dismiss on a card → card disappears from default view
- [ ] Toggle "Show Dismissed" → dismissed card reappears greyed

## Phase 8 — Scraper
- [ ] Manually enqueue a scrape job via Redis CLI or test script
- [ ] Worker picks up job, logs output
- [ ] New listings appear in DB (`select * from listings limit 10`)
- [ ] Re-running scrape for same alert → no duplicate listings inserted

## Phase 9 — Email Digest
- [ ] Manually enqueue a digest job
- [ ] Email received at test address within 5 minutes
- [ ] Email subject contains alert name and listing count
- [ ] Each listing card has title, price, image (or placeholder), CTA button
- [ ] Unsubscribe link in footer works (GET /api/unsubscribe?token=...)

## Phase 11 — Billing
- [ ] Free user hits alert limit → UpgradePrompt modal appears
- [ ] Click "Upgrade to Pro" → redirected to Stripe checkout
- [ ] Complete test payment (Stripe test card 4242 4242 4242 4242)
- [ ] Webhook fires → Clerk publicMetadata.plan = "paid"
- [ ] User can now create 4th alert without hitting limit
- [ ] Stripe customer portal opens from Settings page
```

---

## Task → Test Matrix

Use this to know which tests to run before marking a task complete.

| Task | Type check | Unit test | Integration test | Smoke test |
|---|---|---|---|---|
| T-003 Schema | ✓ | — | run migration, verify tables exist | — |
| T-005 Stripe webhook | ✓ | — | stripe-webhook.test.ts | Phase 11 smoke |
| T-007 GET /api/alerts | ✓ | — | alerts.test.ts | Phase 2 smoke |
| T-008 POST /api/alerts | ✓ | freemium-limit.test.ts | alerts.test.ts | Phase 2 smoke |
| T-009 PATCH alert | ✓ | — | alerts.test.ts | Phase 2 smoke |
| T-010 DELETE alert | ✓ | — | alerts.test.ts | Phase 2 smoke |
| T-028 Browser pool | ✓ | — | — | Phase 8 smoke |
| T-029 Proxy pool | ✓ | — | — | — |
| T-030 DOM parser | ✓ | parser.test.ts | — | — |
| T-031 Marketplace scraper | ✓ | url-builder.test.ts | — | Phase 8 smoke |
| T-032 Scrape worker | ✓ | matching.test.ts | — | Phase 8 smoke |
| T-033 Email template | ✓ | digest-template.test.ts | — | Phase 9 smoke |
| T-035 Digest worker | ✓ | — | — | Phase 9 smoke |
| T-036 Scheduler | ✓ | — | — | Phase 8+9 smoke |

---

## Running Tests

```bash
# Type check only
npx tsc --noEmit

# All unit tests
npx vitest run tests/unit

# All integration tests (requires .env.test)
npx vitest run tests/integration

# Specific test file
npx vitest run tests/unit/scraper/matching.test.ts

# Watch mode during development
npx vitest tests/unit

# Coverage report
npx vitest run --coverage
```

## Claude Code instruction

Before marking any task `[x]` in TASKS.md:
1. Run `npx tsc --noEmit` — zero errors required
2. Run any unit tests listed in the task → test matrix above
3. Run any integration tests listed for this task
4. If the task's phase smoke test is newly completable, run it and record results in `docs/smoke-test.md`
