# CodeSpring Boilerplate

A modern full-stack starter built with Next.js 14, Tailwind CSS, ShadCN UI, Supabase, Drizzle ORM, Clerk authentication and Stripe payments.

---

## 📬 Need help?
If you get stuck or spot an issue, reach out at **usecodespring@gmail.com** – we’re happy to help!

---

## Table of Contents
1. [Why CodeSpring Boilerplate?](#why-codespring-boilerplate)
2. [Tech Stack](#tech-stack)
3. [Prerequisites](#prerequisites)
4. [Getting Started](#getting-started)
   1. [Clone & Detach From This Repository](#clone--detach-from-this-repository)
   2. [Install Dependencies](#install-dependencies)
   3. [Configure Environment Variables](#configure-environment-variables)
   4. [Run Locally](#run-locally)
5. [Deployment](#deployment)
6. [Project Structure](#project-structure)
7. [Troubleshooting](#troubleshooting)
8. [License](#license)

---

## Why CodeSpring Boilerplate?
CodeSpring Boilerplate gives you everything you need to launch a production-ready SaaS or internal tool:

- 📦 **Batteries included** – Auth, payments, database & UI are pre-wired.
- 🖌 **Beautiful UI** – ShadCN + Tailwind ensures design consistency.
- 💨 **Fast iteration** – Opinionated file structure and conventions.
- 🚀 **Deploys to Vercel** in minutes.

---

## Tech Stack
| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14 (App Router, React Server Components) |
| **Styling** | Tailwind CSS, ShadCN UI, Framer Motion |
| **Backend** | Supabase (PostgreSQL) with Drizzle ORM |
| **Auth** | Clerk |
| **Payments** | Stripe |
| **Deployment** | Vercel |

---

## Prerequisites
Before you begin make sure you have:

1. **Node.js ≥ 18**
   - Recommended: install via [nvm](https://github.com/nvm-sh/nvm) so you can switch versions easily.
2. **Git** and a **GitHub** account.
3. **Supabase** account (free tier ok).
4. **Clerk** account.
5. **Stripe** account.
6. **Vercel** account.

> Tip: All listed services have free plans – you can build and test without spending a cent.

### Optional CLI Tools
- [Supabase CLI](https://supabase.com/docs/guides/cli) – database migrations & local dev.
- [Vercel CLI](https://vercel.com/cli) – deploy from terminal.

---

## Getting Started
### 1. Clone & Detach From This Repository
```bash
# Clone the boilerplate (creates a new folder "codespring-boilerplate")
git clone https://github.com/CodeSpringHQ/codespring-boilerplate.git
cd codespring-boilerplate

# Remove the existing Git remote so you can connect your own repo
git remote remove origin

# Create a brand-new repository on GitHub (via web UI or gh CLI) then add it:
git remote add origin https://github.com/<your-username>/<your-repo>.git

git push -u origin main
```

### 2. Install Dependencies
We use **npm** by default – feel free to swap for **pnpm** or **yarn**.
```bash
# Make sure you are using Node ≥ 18
node -v

# Install packages
npm install
```

### 3. Configure Environment Variables
Copy the example file and fill in the blanks:
```bash
cp .env.example .env.local
```
Open `.env.local` and provide the following keys:

```bash
# Database (Supabase)
DATABASE_URL="postgresql://<user>:<password>@db.<project>.supabase.co:6543/postgres"

# Auth (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup

# Payments (Stripe)
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PORTAL_LINK="https://billing.stripe.com/p/session/..."
NEXT_PUBLIC_STRIPE_PAYMENT_LINK_YEARLY="https://buy.stripe.com/..."
NEXT_PUBLIC_STRIPE_PAYMENT_LINK_MONTHLY="https://buy.stripe.com/..."
```

> Keep `.env.local` **private** – never commit it to Git!

### 4. Run Locally
```bash
npm run dev
# Visit http://localhost:3000
```

---

## Deployment
1. Push your code to GitHub (see step 1).
2. Log into [Vercel](https://vercel.com/) and **Import Project**.
3. During setup, add the same environment variables from `.env.local` to Vercel.
4. Click **Deploy** – Vercel will build and deploy your app.

> Supabase URL and anon/public keys can be safely exposed to the client; secrets (service role, database password) must stay server-side.

---

## Project Structure
```
.
├── actions/           # Server actions
├── app/               # Next.js app router structure
├── components/        # UI components (ShadCN based)
├── db/                # Drizzle config & migrations
├── lib/               # Utility helpers
└── ...
```
Key conventions:
- **/components** – name files like `example-component.tsx`.
- **/actions** – name files like `example-actions.ts`.
- **/db/schema** – database table schemas.
- **/db/queries** – reusable query files.

---

## Troubleshooting
| Issue | Fix |
|-------|-----|
| `Module not found` after install | Try deleting `node_modules` & `package-lock.json`, then `npm install` again. |
| Clerk fails locally | Ensure the **publishable key** starts with `pk_` and matches your Clerk instance’s frontend API. |
| Supabase connection errors | Check `DATABASE_URL` format and that your IP is allowed if using direct connections. |
| Stripe webhooks not firing locally | Use [`stripe listen`](https://stripe.com/docs/cli) or a tunnelling tool like [ngrok](https://ngrok.com/). |

If none of these solve your problem, email **usecodespring@gmail.com** with logs and a description of the issue.

---

## License
Distributed under the MIT License. See [`LICENSE`](license) for more information.
