# Whop Payments Integration PRD: NextJS Web App (Updated)

## Overview
This document outlines the enhanced implementation for integrating Whop payment processing into our NextJS web application. The updated approach addresses previous issues with user identification and provides a comprehensive system for tracking usage credits and payment cycles.

## Current Implementation

### Key Components

1. **API-Based Checkout Creation** (`app/api/whop/create-checkout/route.ts`)
   - Creates checkout sessions with proper metadata
   - Securely stores Clerk userId in the membership metadata
   - Handles redirects back to the application

2. **Enhanced Webhook Handler** (`app/api/whop/webhooks/route.ts`)
   - Processes events: `membershipWentValid`, `membershipWentInvalid`, `paymentSucceeded`, `paymentFailed`
   - Robust userId extraction from multiple metadata locations
   - Implements billing cycle and usage credit tracking
   - Manages payment failure status

3. **Whop API Utilities** (`lib/whop.ts`)
   - Server-side helpers for interacting with Whop API
   - Separate functions for app-level, company-level, and user-level operations

4. **Whop Actions** (`actions/whop-actions.ts`)
   - Server actions for updating user profiles with Whop data
   - Handling membership status changes
   - Checking premium feature access

5. **Credit System** (`actions/credits-actions.ts`)
   - Secure server-side validation for premium features
   - Credit tracking and usage monitoring
   - Billing cycle awareness

### Environment Variables

The current implementation requires these environment variables:

```
# Whop API Access
WHOP_API_KEY=xxx
WHOP_WEBHOOK_KEY=xxx

# Whop Plan IDs (new)
WHOP_PLAN_ID_MONTHLY=plan_xxx
WHOP_PLAN_ID_YEARLY=plan_yyy

# Portal and Redirect
NEXT_PUBLIC_WHOP_PORTAL_LINK=https://whop.com/portal
NEXT_PUBLIC_WHOP_REDIRECT_URL=https://your-app.com/notes

# Active Payment Provider
ACTIVE_PAYMENT_PROVIDER=whop
```

> Note: The previous payment link environment variables are no longer needed as we use plan IDs directly with the API.

## Checkout Flow

The new checkout flow works as follows:

1. **User initiates checkout**
   - User clicks "Subscribe" on the pricing page
   - The `WhopPricingCard` component (client component) is triggered

2. **API creates checkout session**
   - `create-checkout` API endpoint is called with:
     - `planId`: The Whop plan ID (monthly/yearly)
     - `redirectUrl`: Where to send the user after payment
   - API endpoint creates a checkout session with Whop including:
     - Clerk userId stored in metadata
     - Proper redirect URL configuration
     - Direct-to-checkout enabled

3. **User completes payment**
   - User is redirected to Whop checkout
   - After payment, user is redirected back to the app

4. **Webhook processes payment**
   - Whop sends webhook event to our endpoint
   - `extractUserId` function finds the Clerk userId in metadata
   - Profile is updated with:
     - Whop user ID and membership ID
     - Pro membership status
     - New billing cycle dates
     - Reset usage credits
     - Email (if not already stored)

## Credit System

The system includes a full usage credit tracking implementation:

1. **Credit Allocation**
   - 250 credits are assigned on initial payment
   - Credits reset with each billing cycle renewal

2. **Billing Cycle Tracking**
   - Start and end dates for each billing period are stored
   - Extracted from webhook payloads
   - Used to display "resets on" information to users

3. **Credit Usage**
   - `useCredits()` increments a user's "used credits" counter
   - `checkCredits()` verifies if user can perform premium actions
   - All validation happens server-side for security

4. **Subscription Status Tracking**
   - Uses a flexible `status` text field with values like:
     - "active" for active subscriptions
     - "payment_failed" when payment issues occur
     - "canceled" for canceled subscriptions
     - "trialing" for trial periods (future capability)
   - Status drives notifications and access permissions

5. **Secure Premium Features**
   - The `withPremiumFeature()` wrapper provides a secure way to gate features
   - Server-side verification prevents client-side hacking attempts
   - Returns helpful error messages when credits are insufficient

## Payment Failure Handling

1. **Detection**
   - Webhook listens for `payment.failed` events
   - Sets `status: "payment_failed"` in user profile

2. **User Notification**
   - `PaymentFailedAlert` component displays a banner
   - User is prompted to update payment information

3. **UI Component**
   - Implemented with ShadCN Alert components for consistent styling
   - Only shows on relevant pages (not pricing page)
   - Refreshes status automatically

## Dashboard Integration

Add the following components to display credit usage:

```tsx
// In your dashboard or notes page
import { CreditUsageDisplay } from "@/components/credit-usage-display";

export default function Dashboard() {
  return (
    <div>
      <CreditUsageDisplay />
      {/* Rest of your dashboard */}
    </div>
  );
}
```

## Whop Dashboard Configuration

The same configuration applies:

1. **Enable Direct to Consumer Mode**
   - For all plans in the Whop dashboard
   - Set the redirect URL to match your app

2. **Webhook Configuration**
   - URL: `https://your-app.com/api/whop/webhooks`
   - Events: `membership.went_valid`, `membership.went_invalid`, `payment.succeeded`, `payment.failed`
   - Store webhook secret in environment variables

## Debugging

For troubleshooting:

1. Check webhook logs in the Whop dashboard
2. Review server logs for detailed information about webhook processing
3. Verify that plan IDs match between environment variables and Whop dashboard
4. Ensure the webhook URL is correctly configured and accessible

## Testing

Test the system with:

1. **Manual checkout flow testing**
   - Complete a real purchase with test mode
   - Verify profile is updated correctly

2. **Webhook testing via Whop dashboard**
   - Trigger test webhook events
   - Verify credit allocation and membership changes

3. **Credit usage testing**
   - Attempt to use premium features with both sufficient and insufficient credits
   - Verify credit counters update correctly

4. **Payment failure handling**
   - Trigger a payment.failed webhook
   - Verify the alert banner appears

## Timeline
1. **Environment Configuration**: 1 day
2. **Whop Dashboard Setup**: 1 day
3. **Code Implementation**: 3 days
   - Schema updates
   - Pricing page enhancements
   - Webhook handler improvements
   - Action function updates
4. **Testing**: 2 days
5. **Deployment and Verification**: 1 day

## Success Criteria
1. Users complete checkout and are automatically redirected back to the app
2. User profiles are properly updated in Supabase after payment
3. Membership status changes are reflected in the app immediately
4. No user intervention required to complete the payment flow