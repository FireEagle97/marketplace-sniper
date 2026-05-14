# Stripe Integration PRD: Notes App

## Overview
This document outlines the current implementation of Stripe payment processing in the Notes app. It details how the application handles subscriptions, payment processing, and access control based on membership status.

## Current Implementation

### Database Structure
The application uses a `profiles` table in Supabase with the following Stripe-related fields:
- `userId`: Primary key linking to the Clerk authentication user ID
- `membership`: Enum with values "free" or "pro" (default: "free")
- `stripeCustomerId`: Stores the Stripe customer ID for reference
- `stripeSubscriptionId`: Stores the Stripe subscription ID for reference

### Authentication Flow
1. User authentication is handled by Clerk
2. The middleware protects routes matching "/notes(.*)"
3. Authenticated users without a "pro" membership are redirected to the pricing page

### Subscription Management
The app uses Stripe Payment Links for subscription checkout:
- Environment variables store the payment links:
  - `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_MONTHLY`
  - `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_YEARLY`
- These links direct users to Stripe-hosted checkout pages
- The user's ID is passed as a `client_reference_id` parameter

### Pricing Page
The pricing page (`app/(marketing)/pricing/page.tsx`) displays:
- Two subscription options: Monthly ($10) and Yearly ($100)
- Payment links that redirect to Stripe checkout
- The user ID is appended to the checkout URL as a reference

### Webhook Integration
The app has a webhook endpoint (`app/api/stripe/webhooks/route.ts`) that listens for Stripe events:
1. `checkout.session.completed`: When a user completes checkout
2. `customer.subscription.updated`: When a subscription status changes
3. `customer.subscription.deleted`: When a subscription is canceled

### Subscription Status Management
The `stripe-actions.ts` file contains functions to:
1. Update a user's profile with Stripe customer and subscription IDs
2. Manage subscription status changes based on Stripe events
3. Determine membership status based on subscription status

### Access Control
The Notes page (`app/notes/page.tsx`) implements access control:
1. Checks if the user is authenticated
2. Retrieves the user's profile
3. Redirects to the pricing page if the user has a "free" membership

### Security Measures
1. Stripe API key is stored as an environment variable (`STRIPE_SECRET_KEY`)
2. Webhook signatures are verified using a secret key (`STRIPE_WEBHOOK_SECRET`)
3. Clerk handles user authentication and protects routes

## Environment Variables
The following environment variables are required:
```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PORTAL_LINK=
NEXT_PUBLIC_STRIPE_PAYMENT_LINK_YEARLY=
NEXT_PUBLIC_STRIPE_PAYMENT_LINK_MONTHLY=
```

## Technical Implementation Details

### Stripe Client
- A Stripe client is initialized in `lib/stripe.ts` using the API key

### Webhook Processing
1. Incoming webhook requests have their signatures verified
2. Relevant events are processed depending on the event type
3. Customer profiles are updated accordingly

### Subscription Status Logic
The app uses Stripe product metadata to determine membership levels:
1. Products in Stripe should have a `membership` metadata field with value "pro"
2. Subscription status affects membership level:
   - "active" or "trialing" subscriptions maintain membership level
   - All other statuses (canceled, incomplete, etc.) revert to "free"

### Customer Portal
The app uses Stripe Customer Portal for subscription management:
- Environment variable `NEXT_PUBLIC_STRIPE_PORTAL_LINK` stores the portal URL
- This allows users to manage their subscription, change payment methods, etc.

## Security Analysis

### Authentication and Authorization
- Clerk handles authentication securely
- Route protection via middleware ensures unauthorized access is prevented
- Server-side checks verify membership status before displaying protected content

### API Key Management
- Stripe API keys are stored as environment variables
- Secret keys are only used server-side
- Public keys are namespaced with NEXT_PUBLIC_ prefix

### Webhook Security
- Stripe webhook signatures are verified to prevent spoofing
- Webhook secret is stored as an environment variable
- Error handling prevents exposing sensitive information

### Data Protection
- Sensitive subscription data is stored server-side in Supabase
- Client-side code only receives membership status, not payment details
- Clerk's security measures protect user authentication

## Integration Flow

1. User signs up with Clerk authentication
2. User profile is created with default "free" membership
3. User is directed to the pricing page to choose a plan
4. User selects a plan and is redirected to Stripe checkout
5. After successful payment, Stripe sends a webhook notification
6. The webhook handler updates the user's profile with subscription details
7. User now has access to protected content based on their membership status

## Limitations and Considerations

1. The current implementation relies on Stripe Payment Links rather than a custom checkout
2. There's no automatic handling of failed payments beyond Stripe's built-in retry logic
3. The system doesn't currently support multiple subscription tiers beyond "free" and "pro"
4. Users are redirected to pricing page for upgrades rather than having in-app upgrade flows

## Migration Considerations for Whop Payments

When migrating to Whop payments, the following components will need to be modified:
1. Profile schema to accommodate Whop-specific identifiers
2. Integration with Whop API instead of Stripe
3. Webhook handlers for Whop events
4. Pricing page to use Whop checkout links
5. Membership status determination based on Whop subscription status
