# Whop Webhook System: Technical Documentation

## Overview

The Whop webhook system is a critical component that handles payment and membership events from Whop's payment processing system. It updates user profiles, manages subscription statuses, allocates premium credits, and maintains billing cycle information.

## Key Components and Files

- **`app/api/whop/webhooks/route.ts`**: The main webhook handler that receives and processes events from Whop
- **`actions/whop-actions.ts`**: Contains functions for managing Whop membership status changes
- **`db/queries/profiles-queries.ts`**: Database operations for user profiles 
- **`actions/credits-actions.ts`**: Manages the credit system for premium features
- **`app/api/user/status/route.ts`**: API endpoint for checking user subscription status
- **`app/api/whop/create-checkout/route.ts`**: Creates checkout sessions with proper metadata

## Constants and Configuration

```typescript
// In app/api/whop/webhooks/route.ts
const DEFAULT_USAGE_CREDITS = 1000; // Pro users get 1000 credits per subscription cycle
const CREDIT_RENEWAL_DAYS = 28; // Used credits reset every 4 weeks (28 days)
```

These constants define the credit allocation model:
- Pro users receive 1000 credits per subscription cycle
- Credits reset every 28 days (independent of billing cycle)

## Webhook Handler Initialization

```typescript
// Create the webhook handler at the module level
const handleWebhook = makeWebhookHandler();
```

The webhook handler is created using the Whop SDK's `makeWebhookHandler()` function. This handler processes different webhook event types with specific callback functions.

## User ID Extraction

The `extractUserId` function is critical for connecting Whop events to user accounts:

```typescript
function extractUserId(data: any): string | undefined {
  // Checks multiple possible locations for the Clerk userId
  // 1. data.metadata.clerkUserId or data.metadata.userId
  // 2. data.membership_metadata
  // 3. Direct userId
  // 4. data.membership.metadata
  // 5. data.customer.metadata
  // 6. URL parameters in checkout_options.checkout_url
}
```

This function carefully checks various locations in the webhook data where the user ID might be found, as different webhook events structure data differently.

## Plan Type Determination

```typescript
function determinePlanType(planId: string): "monthly" | "yearly" {
  const monthlyPlanId = process.env.WHOP_PLAN_ID_MONTHLY;
  const yearlyPlanId = process.env.WHOP_PLAN_ID_YEARLY;
  
  if (planId === yearlyPlanId) {
    return "yearly";
  } else if (planId === monthlyPlanId) {
    return "monthly";
  } else {
    // Default to monthly if we can't determine
    return "monthly";
  }
}
```

This function maps Whop plan IDs to internal plan durations by comparing against environment variables.

## Event Handlers

### Payment Success Handler

The `handlePaymentSuccess` function processes successful payment events:

1. **Extract User ID**: Gets the Clerk user ID from various metadata fields
2. **Fetch User Profile**: Retrieves the current user profile from the database
3. **Calculate Billing Cycle**:
   - Uses dates from webhook data if available
   - Calculates based on plan type if not provided
4. **Set Credit Renewal Date**: Always 28 days from current date
5. **Update User Profile**:
   - Set membership to "pro"
   - Reset used credits to 0
   - Set payment provider to "whop"
   - Update status to "active"
   - Set plan duration (monthly/yearly)
   - Update billing cycle dates
   - Allocate credits if user doesn't already have pro-level credits
6. **Revalidate Paths**: Refresh cached data on relevant pages

### Membership Change Handler

The `handleMembershipChange` function handles membership status changes:

1. **Extract IDs**: Gets membership ID and Whop user ID
2. **Find Clerk User ID**: Attempts to extract the Clerk user ID from metadata
3. **Handle Activation (isValid = true)**:
   - Determine plan duration
   - Calculate credit renewal date
   - Set up billing cycle dates
   - Update profile with pro membership status
4. **Handle Cancellation (isValid = false)**:
   - Check if user is still in active billing cycle
   - If yes: Mark as canceled but preserve credits until cycle ends
   - If no: Downgrade immediately (reset credits to free tier)
5. **Fallback to Whop User ID**: If Clerk ID not found, search by Whop user ID
6. **Revalidate Paths**: Force client-side refreshes

## Main Webhook Processing Flow

The `POST` function is the entry point for all webhook events:

```typescript
export async function POST(req: Request) {
  // Process incoming webhook request
  try {
    // Log request body
    // Check database connection
    // Handle different event types using the handleWebhook function
  } catch (error) {
    // Error handling
  }
}
```

The function:
1. Logs the raw webhook data
2. Checks database connection health
3. Passes the request to the Whop SDK webhook handler
4. Specifies callback functions for different event types

### Event Type Callbacks

The webhook handler uses these callbacks:

```typescript
return handleWebhook(newReq, {
  // When a membership becomes valid
  membershipWentValid(event, options) {
    handleMembershipChange(event.data, true);
  },
  
  // When a membership becomes invalid
  membershipWentInvalid(event, options) {
    handleMembershipChange(event.data, false);
  },
  
  // When a payment is successfully processed
  paymentSucceeded(event, options) {
    handlePaymentSuccess(event.data);
  },
  
  // When a payment fails
  paymentFailed(event, options) {
    // Mark payment as failed in user profile
  }
});
```

## Integration with Profile System

The webhook handler integrates with the profile system through:

1. **Database Queries (profiles-queries.ts)**:
   - `getProfileByUserId`: Find profile by Clerk user ID
   - `getProfileByWhopUserId`: Find profile by Whop user ID
   - `updateProfile`: Update profile data
   - `updateProfileByWhopUserId`: Update profile using Whop user ID

2. **Whop Actions (whop-actions.ts)**:
   - `manageWhopMembershipStatusChange`: Centralized function for membership changes
   - `updateWhopCustomer`: Associates a Clerk user with Whop customer data

## Credit System Integration

The webhook system manages the credit allocation that powers premium features:

1. **On Successful Payment**:
   - Allocates DEFAULT_USAGE_CREDITS (1000) to the user
   - Sets up nextCreditRenewal (28 days from now)
   - Resets usedCredits to 0

2. **On Cancellation**:
   - If billing cycle active: Preserves credits until cycle ends
   - If billing cycle ended: Resets to free tier (5 credits)

The credit system itself (in credits-actions.ts) uses these values for permissioning premium features.

## Path Revalidation

The webhook system triggers Next.js path revalidation to refresh cached data:

```typescript
// Force client to refresh to see cancellation
revalidatePath("/dashboard");
revalidatePath("/notes");
revalidatePath("/");
revalidatePath("/api/user/status");
```

This ensures that UI components show updated subscription status without requiring a full page reload.

## Error Handling

The webhook system implements comprehensive error handling:

1. **Database Connection Check**: Verifies database availability before processing
2. **Graceful Degradation**: Returns 200 status with error message instead of failing
3. **Extensive Logging**: Logs detailed information about events and errors
4. **Error Catching**: Each function has try/catch blocks to prevent crashes

## Data Flow Diagram

```
┌────────────┐       ┌───────────────────┐       ┌─────────────────┐
│            │       │                   │       │                 │
│  Whop API  ├──────►│ Webhook Handler   ├──────►│ Event Handlers  │
│            │       │ (route.ts)        │       │                 │
└────────────┘       └───────────────────┘       └────┬─────────┬──┘
                                                      │         │
                                                      ▼         ▼
                                           ┌────────────┐   ┌───────────┐
                                           │            │   │           │
                                           │ Database   │   │ Next.js   │
                                           │ Operations │   │ Cache     │
                                           │            │   │           │
                                           └────────────┘   └───────────┘
```

## Refactoring Considerations

When refactoring this system into multiple utility files:

1. **Preserve Constants**: Keep DEFAULT_USAGE_CREDITS and CREDIT_RENEWAL_DAYS consistent
2. **Extract Helpers**: Move extractUserId and determinePlanType to utility files
3. **Preserve Event Handlers**: Keep the logic of handlePaymentSuccess and handleMembershipChange intact
4. **Maintain Database Flow**: Ensure database operations continue to work with the same profile schema
5. **Keep Path Revalidation**: Ensure all path revalidation calls are preserved

## Critical Code Paths

The most critical code paths are:

1. **Payment Success Flow**: 
   - Verifies user identity
   - Updates membership status
   - Allocates credits
   - Sets billing dates

2. **Membership Status Change Flow**:
   - Handles both activation and cancellation
   - Manages graceful downgrades
   - Maintains consistent credit allocation

3. **User ID Resolution Flow**:
   - Robustly extracts user IDs from various metadata locations
   - Falls back to alternative identification methods
   - Ensures users are correctly mapped between systems

## Dependencies

The webhook system depends on:

1. **Environment Variables**:
   - WHOP_PLAN_ID_MONTHLY
   - WHOP_PLAN_ID_YEARLY
   - WHOP_API_KEY (used indirectly)

2. **External Libraries**:
   - @whop-apps/sdk for webhook handling
   - next/cache for revalidatePath
   - next/server for Response handling

3. **Internal Systems**:
   - Database connection and queries
   - Profile schema
   - Credit allocation system
