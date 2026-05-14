# Product Requirements Document
## FlipAlert — Facebook Marketplace Deal Alert SaaS
**Version:** 1.1 (MVP)
**Status:** Draft
**Last Updated:** 2026-05-14

---

## 1. Product Overview

### 1.1 Vision
FlipAlert is a SaaS tool that monitors Facebook Marketplace on behalf of flippers and resellers, delivering curated deal digests via email so users never miss an underpriced listing.

### 1.2 Problem Statement
Flippers and resellers must constantly and manually refresh Facebook Marketplace to catch underpriced listings before competitors do. This is time-consuming, inefficient, and means users frequently miss deals simply because they weren't watching at the right moment.

### 1.3 Solution
Users define keyword-based alerts with filters (price range, location, condition). FlipAlert scrapes Facebook Marketplace on a scheduled basis, matches new listings against those alerts, and delivers a formatted email digest on a daily or weekly schedule chosen by the user. Matched listings are also visible in a web dashboard as browsable cards.

### 1.4 Target User
**Primary:** Facebook Marketplace flippers and resellers — people who buy underpriced items locally and resell them at a profit. Non-technical users who need a simple, guided setup experience.

### 1.5 Boilerplate Foundation
This app is built on the **CodeSpring Boilerplate**, which ships a fully wired production-ready foundation. The following are already implemented and must not be rebuilt:

| Concern | Solution (already wired) |
|---|---|
| Authentication | Clerk (register, login, sessions, email verification, password reset) |
| Database | Supabase (PostgreSQL) via Drizzle ORM |
| Payments | Stripe (checkout, webhooks, customer portal) |
| UI Framework | Next.js 14 App Router + Tailwind CSS + shadcn/ui + Framer Motion |
| Deployment | Vercel |

**All FlipAlert work builds on top of this foundation. Do not replace or re-implement any of the above.**

---

## 2. Goals & Success Metrics

| Metric | Target |
|---|---|
| Onboarding completion rate | > 80% |
| Alert setup time (median) | < 3 min |
| Email open rate | > 40% |
| Free → Paid conversion | > 10% at 6 months |

---

## 3. Scope

### 3.1 New Work (FlipAlert-specific)
- Drizzle schema additions: alerts, listings, user_listing_states, digest_logs tables
- Alert creation wizard (3-step: keywords → filters → schedule)
- Alert management page (list, edit, pause, delete)
- Facebook Marketplace scraping engine (Playwright + proxy rotation)
- BullMQ + Redis background worker service (separate Railway deployment)
- Email digest system (Resend)
- Dashboard feed (card grid, filter bar, save/dismiss)
- Freemium enforcement logic (extend existing Clerk + Stripe wiring)

### 3.2 Already Done — Do Not Rebuild
- User registration, login, email verification, password reset → **Clerk**
- Stripe checkout, webhook handler, customer portal → **Stripe + boilerplate**
- Base UI shell, layout, shadcn/ui components → **boilerplate**
- Vercel deployment pipeline → **boilerplate**

### 3.3 Out of Scope — V2
- Facebook OAuth + Groups monitoring
- Craigslist / eBay integration
- Push / mobile notifications

---

## 4. User Stories

### Auth (Clerk — already done)
- Register, login, verify email, reset password → handled by Clerk out of the box.
- FlipAlert addition: after first login with 0 alerts, redirect to `/alerts/new`.

### Alert Management
- **US-01:** Create an alert with keywords, price range, location + radius, condition, frequency, name.
- **US-02:** Free users limited to 3 active alerts and 1 location.
- **US-03:** Paid users get unlimited alerts and locations.
- **US-04:** Pause, edit, or delete any alert.

### Dashboard
- **US-05:** View matched listings as cards (title, price, thumbnail, location, condition, time posted, link).
- **US-06:** Filter by alert, date, price. Sort newest/price.
- **US-07:** Mark listings as Saved or Dismissed. Dismissed listings never re-appear.

### Email Digest
- **US-08:** Receive email digest (daily or weekly) with new matched listings per alert.
- **US-09:** One-click unsubscribe without account deletion.

### Billing (Stripe — already wired, extend only)
- **US-10:** Free users see upgrade prompt at the 3-alert limit.
- **US-11:** Upgrade via existing Stripe checkout. Paid = $5.99/month.
- **US-12:** Manage subscription via Stripe customer portal (already wired).

---

## 5. Functional Requirements

### 5.1 Alert Wizard (3 steps)

**Step 1 — Keywords**
- Tag-style input (comma or Enter to add, × to remove)
- Minimum 1 keyword required to proceed

**Step 2 — Filters**
- Location: text input (city or ZIP) — required
- Radius: select 5 / 10 / 25 / 50 / 100 miles
- Min/max price: optional numeric inputs
- Condition: multi-select (Any, New, Used — Good, Used — Fair, For Parts). Selecting "Any" deselects others.

**Step 3 — Schedule**
- Alert name: auto-filled from first keyword, editable
- Frequency: Daily (8 AM user timezone) or Weekly (Monday 8 AM)
- Summary of all settings before submit

### 5.2 Scraping Engine
- Playwright headless Chromium with `playwright-extra` stealth plugin
- Shared scraper pool — no user Facebook credentials in V1
- Cadence: paid users every 1 hour, free users every 6 hours
- One rotating proxy per scrape job
- Deduplication: `(alertId, listingUrl)` unique constraint — a listing is inserted once per alert
- Retry: 3 attempts, exponential backoff (1 min → 5 min → 15 min)
- Target URL pattern:
  ```
  https://www.facebook.com/marketplace/[LOCATION]/search
    ?query=[KEYWORDS]&minPrice=[MIN]&maxPrice=[MAX]
    &itemCondition=[CONDITION]&radius=[MILES]
  ```

**Extracted per listing:** title, price, location, condition, imageUrl, listingUrl, postedAt

### 5.3 Matching Logic
A listing matches an alert if:
1. Title contains at least one keyword (case-insensitive)
2. Price is within min/max range (if set)
3. Condition matches selected values (if not "Any")

### 5.4 Email Digest
- Provider: Resend
- Skip send if no new matches since last digest
- Subject: `🔔 {N} new deals for "{Alert Name}"`
- Card layout per listing: thumbnail, title, price, location, "View on Marketplace" CTA
- Footer: one-click unsubscribe + "Manage alerts" link
- Grouped by alert if user has multiple

### 5.5 Freemium Enforcement
| Feature | Free | Paid |
|---|---|---|
| Active alerts | 3 | Unlimited |
| Locations | 1 | Unlimited |
| Scrape cadence | Every 6 hours | Every 1 hour |
| Saved listings | 50 | Unlimited |

- Plan stored in Clerk `publicMetadata.plan` ("free" \| "paid")
- Set by extending the existing Stripe webhook handler in the boilerplate
- Alert creation API checks plan + alert count before inserting; returns 403 `{ error: "UPGRADE_REQUIRED" }` if limit hit

---

## 6. Decisions Log

| Question | Decision |
|---|---|
| Paid plan price | $5.99/month |
| Anti-bot detection | Rotating proxy pool (Webshare or Oxylabs) |
| Dismissed listings | Permanently hidden |
| Mobile app | No — responsive web app only |
| Downgrade behavior | Keep data; enforce free limits going forward |
| GDPR at launch | No — not targeting EU users |

---

## 7. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Facebook blocks scraper IP | High | Rotating proxies, stealth mode, conservative rate |
| Facebook ToS violation | High | No user FB credentials; public search only |
| Proxy cost vs $5.99 margin | Medium | Start with Webshare (cheap); upgrade to residential if needed |
| Free users never convert | Medium | Hard limits + upgrade prompt at friction points |

---

*End of PRD v1.1*
