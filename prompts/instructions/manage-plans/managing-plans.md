# Subscription Management PRD: Usage-Based Billing System

## Overview

This document outlines a comprehensive system for managing subscription plans with usage-based credits in a Next.js web application. The system handles the complete payment lifecycle, credits allocation, billing cycles, and premium feature access control. A key feature is the automatic 4-week credit renewal cycle that ensures consistent user experience regardless of subscription length.

## Components & Architecture

### Database Schema (`db/schema/profiles-schema.ts`)

The profile schema includes fields for tracking:

```typescript
export const profilesTable = pgTable("profiles", {
  userId: text("user_id").primaryKey().notNull(),
  email: text("email"),
  membership: membershipEnum("membership").notNull().default("free"),
  paymentProvider: paymentProviderEnum("payment_provider").default("whop"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  whopUserId: text("whop_user_id"),
  whopMembershipId: text("whop_membership_id"),
  // Billing cycle tracking
  billingCycleStart: timestamp("billing_cycle_start"),
  billingCycleEnd: timestamp("billing_cycle_end"),
  // Credit renewal tracking (separate from billing cycle for yearly plans)
  nextCreditRenewal: timestamp("next_credit_renewal"),
  // Usage credits tracking
  usageCredits: integer("usage_credits").default(0),
  usedCredits: integer("used_credits").default(0),
  // Subscription status tracking
  status: text("status").default("active"),
  // Standard timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date())
});
```

### Payment Processing

The system supports two payment providers:

1. **Whop Integration**
   - `app/api/whop/create-checkout/route.ts`: Creates checkout sessions with proper metadata
   - `app/api/whop/webhooks/route.ts`: Processes payment and membership events
   - `actions/whop-actions.ts`: Server actions for updating profiles

2. **Stripe Integration**
   - `app/api/stripe/webhooks/route.ts`: Processes Stripe webhooks
   - `actions/stripe-actions.ts`: Server actions for Stripe-specific operations

### Credit Management System (`actions/credits-actions.ts`)

Core functions:

```typescript
// Constants
const DEFAULT_USAGE_CREDITS = 1000; // Pro users get 1000 credits per cycle
const CREDIT_RENEWAL_DAYS = 28; // Used credits reset every 4 weeks (28 days)

// Automatically check and reset used credits based on renewal date
async function checkAndRenewCredits(profile: any): Promise<any>;

// Check if a user has enough credits for an action
export async function checkCredits(
  requiredCredits: number = 1
): Promise<{ hasCredits: boolean; profile: any | null; error?: string }>;

// Use credits for a premium action
export async function useCredits(
  creditsToUse: number = 1,
  description: string = "Used feature"
): Promise<{ success: boolean; profile?: any; error?: string }>;

// Get the user's credit status
export async function getCreditStatus(): Promise<{
  total: number;
  used: number;
  remaining: number;
  nextBillingDate: Date | null;
  nextCreditRenewal: Date | null;
  error?: string;
}>;

// Secure wrapper for premium features
export async function withPremiumFeature<T>(
  featureFunction: () => Promise<T>,
  options: {
    creditsRequired: number;
    featureName: string;
  }
): Promise<{ 
  success: boolean; 
  data?: T; 
  error?: string;
  creditsRemaining?: number;
}>;
```

### UI Components

1. **Credit Display** (`components/credit-usage-display.tsx`)
   - Shows usage progress bar
   - Displays total, used, and remaining credits
   - Shows next billing date and next credit renewal date

2. **Payment Status Alert** (`components/payment/payment-status-alert.tsx`)
   - Notifies users of payment failures
   - Provides direct link to update payment method
   - Uses server actions to efficiently check payment status

## Subscription Lifecycle

### 1. Initial Subscription

When a user first subscribes:

1. They select a plan on the pricing page
2. They complete checkout with the payment provider
3. A webhook is received by our application
4. The user's profile is updated:
   - Membership set to "pro"
   - Payment provider details stored
   - Initial credit allocation (1000 credits)
   - Billing cycle dates recorded
   - Next credit renewal date set (4 weeks from now)

Code from webhook handler:

```typescript
// In app/api/whop/webhooks/route.ts
// Calculate credit renewal date (always 4 weeks from now, regardless of billing cycle)
const creditRenewalDate = new Date();
creditRenewalDate.setDate(creditRenewalDate.getDate() + CREDIT_RENEWAL_DAYS);

// Prepare update data
const updateData = {
  membership: "pro",
  memberId: data?.id || null,
  usageCredits: DEFAULT_USAGE_CREDITS,
  usedCredits: 0,
  paymentProvider: "whop",
  paymentStatus: "succeeded",
  lastPaymentFailure: null,
  failedPaymentCount: 0,
  nextCreditRenewal: creditRenewalDate
};

// Add billing cycle dates if available
if (renewalDate) {
  updateData.billingCycleEnd = renewalDate;
}

await updateProfile(userId, updateData);
```

### 2. Credit Renewal Cycle

A core feature of this system is how we handle credit usage:

1. **Fixed Credit Allocation**: 
   - Pro users get 1000 total credits (`usageCredits`) 
   - Free users get 5 total credits
   - This total credit amount (`usageCredits`) remains unchanged unless a user changes plan tier

2. **4-Week Used Credit Reset**:
   - Every 4 weeks, the `usedCredits` counter resets to 0
   - This applies to both pro and free users
   - The reset is tracked by the `nextCreditRenewal` field
   - When this date is reached, `usedCredits` resets and a new date is set 4 weeks in the future

This approach ensures all users have a consistent experience with predictable credit reset, while still allowing for different billing cycles (monthly, yearly, etc.).

Example implementation:

```typescript
// In credits-actions.ts
async function checkAndRenewCredits(profile: any): Promise<any> {
  // If there's no nextCreditRenewal date, do nothing
  if (!profile || !profile.nextCreditRenewal) {
    return profile;
  }

  const now = new Date();
  const renewalDate = new Date(profile.nextCreditRenewal);
  
  // If current time has passed the renewal date, reset used credits
  if (now > renewalDate) {
    console.log(`Resetting used credits for user ${profile.userId} based on 4-week cycle`);
    
    // Calculate next renewal date (4 weeks from now)
    const nextRenewal = new Date();
    nextRenewal.setDate(nextRenewal.getDate() + CREDIT_RENEWAL_DAYS);
    
    // Default values for update - only reset used credits, not total allowance
    const updateData: any = {
      usedCredits: 0, // Reset used credits to 0
      nextCreditRenewal: nextRenewal // Update the next renewal date
    };
    
    // Update profile with reset used credits and new renewal date
    const updatedProfile = await updateProfile(profile.userId, updateData);
    
    console.log(`Used credits reset to 0 for ${profile.membership} user. Next renewal: ${nextRenewal.toISOString()}`);
    
    return updatedProfile;
  }
  
  return profile;
}
```

### 3. Usage Tracking

When a user performs a premium action:

1. The system first checks if credits need renewal using `checkAndRenewCredits()`
2. Then calls `checkCredits()` to verify eligibility
3. Finally calls `useCredits()` to increment their usage counter
4. All tracking happens on the server side for security

Example implementation:

```typescript
// Server action to generate an AI image
export async function generateAiImage(prompt: string) {
  return withPremiumFeature(
    async () => {
      // Call your AI service here
      const imageUrl = await aiService.generateImage(prompt);
      return { imageUrl };
    },
    {
      creditsRequired: 5, // This feature costs 5 credits
      featureName: "AI Image Generation"
    }
  );
}

// Client component
function AiGenerator() {
  async function handleSubmit(prompt) {
    const result = await generateAiImage(prompt);
    
    if (result.success) {
      // Show the generated image
      setImage(result.data.imageUrl);
      
      // Update remaining credits display
      setCreditsRemaining(result.creditsRemaining);
    } else {
      // Show error message
      setError(result.error);
    }
  }
  
  // Component JSX
}
```

### 4. Just-in-Time Subscription Downgrade Handling

A key innovation in our system is the "just-in-time" approach to handling subscription cancellations. This provides a seamless user experience without requiring complex cron jobs or scheduled tasks:

1. **Initial Cancellation**: 
   - When a user cancels their subscription, the webhook handler sets their membership to "free"
   - **We preserve their existing credits until the end of their billing cycle**
   - This ensures users get the full value of what they paid for

2. **Just-in-Time Credit Adjustment**:
   - Credits are downgraded to free tier level (5) only when:
     - The user attempts to use a premium feature after cancellation
     - AND their billing cycle has expired
     - AND they still have pro-level credits
   - This check happens in multiple places:
     - Inside the `checkCredits()` function, which runs before any premium feature use
     - On dashboard page load, ensuring a consistent experience

3. **Implementation**:
   In the webhook handler:
   ```typescript
   if (profile.membership === "free" && profile.billingCycleEnd) {
     const billingCycleEnd = new Date(profile.billingCycleEnd);
     const now = new Date();
     
     if (billingCycleEnd > now) {
       // User still has time left in their billing cycle
       console.log(`User canceled but has active billing until ${billingCycleEnd}`);
       
       // Mark as free but preserve credits until billing cycle ends
       await updateProfile(userId, {
         membership: "free"
         // We don't modify usageCredits here to preserve them
       });
     } else {
       // Billing cycle already ended, downgrade immediately
       await updateProfile(userId, {
         membership: "free",
         usageCredits: 5,
         usedCredits: 0,
         // Set next credit renewal date for free tier (4 weeks)
         nextCreditRenewal: new Date(Date.now() + CREDIT_RENEWAL_DAYS * 24 * 60 * 60 * 1000)
       });
     }
   }
   ```
   
   In the `checkCredits()` function:
   ```typescript
   // Just-in-time check for free users with expired billing cycles
   if (profile.membership === "free" && profile.billingCycleEnd) {
     const billingCycleEnd = new Date(profile.billingCycleEnd);
     const now = new Date();
     
     // If the billing cycle has ended and they still have pro-level credits
     if (now > billingCycleEnd && (profile.usageCredits || 0) > 5) {
       console.log(`User has canceled subscription with expired billing cycle`);
       
       // Update profile with free tier credit limit
       profile = await updateProfile(userId, {
         usageCredits: 5,
         usedCredits: 0,  // Reset to 0 for a clean slate
         billingCycleEnd: null,  // Clear billing cycle since it's no longer relevant
         // Ensure they have a next credit renewal date (4 weeks)
         nextCreditRenewal: new Date(Date.now() + CREDIT_RENEWAL_DAYS * 24 * 60 * 60 * 1000)
       });
     }
   }
   ```

4. **Credit Renewal for Free Users**:
   - Free users also get their `usedCredits` reset to 0 every 4 weeks
   - This allows them to use their 5 credits regularly without being permanently blocked
   - The `nextCreditRenewal` date works the same for both pro and free users

5. **Advantages of This Approach**:
   - **No Scheduled Jobs**: Eliminates need for cron jobs or scheduled tasks
   - **Graceful Degradation**: Users keep their purchased credits until their billing cycle ends
   - **Seamless Experience**: Credit adjustments happen automatically without user input
   - **Fair Usage for Free Tier**: Free users can use features regularly with the 4-week reset
   - **Efficiency**: Credit checks only run when users actually use the system

### 5. Billing Cycle Management

Our system handles billing cycles with these key components:

1. **Webhook-Based Billing**:
   - When a user initially subscribes or renews, Whop sends a webhook
   - If the webhook includes a `renewal_period_end` date, we use that directly
   - If not provided, we calculate it ourselves (30 days from now for monthly plans)
   - Future enhancement: Store the plan type (monthly/yearly) to calculate accurate dates

2. **Fallback Billing Calculation**:
   ```typescript
   // Handle billing cycle end date
   if (data.renewal_period_end) {
     const renewalDate = new Date(data.renewal_period_end);
     updateData.billingCycleEnd = renewalDate;
     console.log(`Setting billing cycle end to ${renewalDate.toISOString()}`);
   } else {
     // Calculate ourselves - assume monthly for now
     // TODO: Add support for plan duration (monthly, yearly)
     const billingCycleEnd = new Date();
     billingCycleEnd.setDate(billingCycleEnd.getDate() + 30); // Assume 30 days
     updateData.billingCycleEnd = billingCycleEnd;
     console.log(`Calculated billing cycle end: ${billingCycleEnd.toISOString()}`);
   }
   ```

3. **Payment Status Handling**:
   - For successful payments, we update billing cycles and set status to "active"
   - For failed payments, we set status to "payment_failed"
   - For canceled subscriptions, we set status to "canceled"
   - Users with failed payments see a notification banner to update payment information

4. **Billing vs. Credit Reset**:
   - Billing cycle: When the user gets charged (monthly or yearly)
   - Credit reset: When `usedCredits` resets to 0 (every 4 weeks)
   - These are intentionally separate to provide consistent usage experience

5. **Future Enhancements**:
   - Add `planType` field to profiles to track monthly vs. yearly subscriptions
   - Use plan type to calculate more accurate billing cycles
   - Support different credit allocations based on plan tier

## Security Considerations

The system implements multiple security layers:

1. **Server-Side Validation**
   - All credit checks occur in server actions (`"use server"`)
   - Client code cannot bypass these checks

2. **Authentication Gate**
   - Every operation verifies the user's authentication
   - Uses Clerk auth to prevent impersonation

3. **Database-Based Verification**
   - Membership status is only read from the database
   - No client-provided data is trusted

4. **Webhook Verification**
   - Payment webhooks are cryptographically verified
   - Prevents fake payment events

5. **Atomic Operations**
   - Credit checking and usage occur in the same transaction
   - Prevents race conditions or manipulation

6. **Automatic Credit Management**
   - Credit renewal is handled server-side
   - Cannot be manipulated by client-side code

7. **Minimal Data Exposure**
   - Payment status checks only return boolean values, not full profiles
   - Reduces risk of sensitive data exposure

## Implementation Guidelines

### Adding a New Premium Feature

1. Create a server action that wraps your feature with `withPremiumFeature`:

```typescript
// In actions/my-feature-actions.ts
"use server";

import { withPremiumFeature } from "@/actions/credits-actions";

export async function myPremiumFeature(param1: string, param2: number) {
  return withPremiumFeature(
    async () => {
      // Your actual feature implementation
      const result = await someOperation(param1, param2);
      return result;
    },
    {
      creditsRequired: 10, // Cost in credits
      featureName: "My Premium Feature"
    }
  );
}
```

2. Create a client component that uses the action:

```tsx
"use client";

import { useState } from "react";
import { myPremiumFeature } from "@/actions/my-feature-actions";

export function MyFeatureComponent() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  async function handleAction() {
    setLoading(true);
    setError(null);
    
    try {
      const response = await myPremiumFeature("param1", 42);
      
      if (response.success) {
        setResult(response.data);
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <div>
      <button 
        onClick={handleAction}
        disabled={loading}
      >
        Execute Premium Feature (10 credits)
      </button>
      
      {error && <div className="error">{error}</div>}
      {result && <div className="result">{JSON.stringify(result)}</div>}
    </div>
  );
}
```

### Displaying Credit Usage

Add the `CreditUsageDisplay` component to relevant pages:

```tsx
// In app/dashboard/page.tsx or any protected page
import { CreditUsageDisplay } from "@/components/credit-usage-display";

export default function DashboardPage() {
  return (
    <div className="container">
      <h1>Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-1">
          <CreditUsageDisplay />
        </div>
        
        <div className="col-span-2">
          {/* Other dashboard content */}
        </div>
      </div>
    </div>
  );
}
```

## Monitoring & Analytics

To track system health:

1. **Usage Patterns**
   - Monitor total credits used across all users
   - Identify popular premium features
   - Track conversion from free to paid

2. **Payment Issues**
   - Monitor payment failure rates
   - Track time to resolution (failed → fixed)
   - Identify patterns in payment failures

3. **User Engagement**
   - Analyze correlation between credit usage and retention
   - Identify optimal credit allocation for different plans
   - Monitor "credit exhaustion" - when users run out before renewal

4. **Credit Renewal Metrics**
   - Track credit renewal patterns
   - Monitor user activity after credit renewal
   - Identify users who consistently exhaust credits before renewal

## Customization Options

The system can be extended with:

1. **Multiple Credit Types**
   - Different credit pools for different feature categories
   - Separate tracking for each type

2. **Credit Purchase**
   - Allow users to buy additional credits mid-cycle
   - Implement top-up mechanisms

3. **Credit Rollover**
   - Allow unused credits to roll over (up to a limit)
   - Incentivize continued subscription

4. **Usage-Based Plan Recommendations**
   - Suggest appropriate plans based on usage patterns
   - Upsell higher tiers when users consistently use all credits

5. **Custom Renewal Cycles**
   - Adjust the 4-week renewal period based on plan type
   - Offer different credit allocations for different plans

## Conclusion

This subscription management system provides a robust foundation for usage-based billing with a user-friendly 4-week credit renewal cycle. It securely tracks and manages credits, handles the complete payment lifecycle, and ensures only authorized users can access premium features. By separating credit renewal from billing cycles, we provide a consistent and predictable experience for all users regardless of their subscription plan length.
