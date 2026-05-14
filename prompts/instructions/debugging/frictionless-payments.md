
# Product Requirements Document: Frictionless Payment Flow

## Overview

This document outlines the implementation of a "Pay First, Create Account Later" flow while minimizing codebase changes and leveraging existing files. The goal is to seamlessly integrate this functionality with minimal disruption to the current system.

## Required Changes

### 1. Existing Files to Modify

#### **app/api/whop/create-checkout/route.ts**
```typescript
// Current implementation checks for auth
export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // ...
```

**Changes needed:**
- Modify to support both authenticated and non-authenticated requests
- Add conditional logic to handle email-only checkout
- Implement token generation for tracking
- Example modification:

```typescript
export async function POST(req: Request) {
  try {
    // Get auth state but don't require it
    const { userId } = auth();
    
    // Parse request body
    const { planId, redirectUrl, email } = await req.json();
    
    if (!planId) {
      return NextResponse.json({ error: "Missing planId" }, { status: 400 });
    }
    
    // Determine if this is authenticated or unauthenticated flow
    const isAuthenticatedFlow = !!userId;
    
    // For unauthenticated flow, email is required
    if (!isAuthenticatedFlow && !email) {
      return NextResponse.json({ error: "Email required for unauthenticated checkout" }, { status: 400 });
    }
    
    // Generate token for unauthenticated flow
    const token = !isAuthenticatedFlow ? crypto.randomUUID() : null;
    
    // Build metadata differently based on flow
    const metadata = isAuthenticatedFlow 
      ? { clerkUserId: userId, planDuration: determinePlanDuration(planId) }
      : { email, token, planDuration: determinePlanDuration(planId) };
    
    // Create checkout with appropriate metadata and redirect
    // ...rest of checkout creation logic remains similar
  }
}
```

#### **app/api/whop/webhooks/utils/payment-handlers.ts**
Currently handles payment success for authenticated users only:

**Changes needed:**
- Enhance to handle email-only payments without breaking existing flow
- Implementation approach:

```typescript
export async function handlePaymentSuccess(data: any) {
  const eventId = data.id || Date.now().toString();
  console.log(`[Event ${eventId}] START: Processing payment success`);

  try {
    // First check if this is a traditional flow (with clerkUserId)
    const clerkUserId = extractUserId(data);
    
    if (clerkUserId) {
      // Existing flow - process normally
      // This preserves all current behavior
      // ... existing implementation stays here ...
      return;
    }
    
    // New frictionless flow - check for email in metadata
    const email = data.metadata?.email;
    const token = data.metadata?.token;
    
    if (!email && !token) {
      console.error(`[Event ${eventId}] Payment has no clerkUserId, email or token. Cannot process.`);
      return;
    }
    
    console.log(`[Event ${eventId}] Processing frictionless payment for email: ${email}`);
    
    // Create a pending profile with payment details
    await createPendingProfile({
      email,
      token,
      whopUserId: data.user_id,
      whopMembershipId: data.membership_id || data.id,
      membership: "pro",
      status: "paid_pending_account",
      // ... other payment details
    });
  } catch (error) {
    console.error(`[Event ${eventId}] Error in payment processing:`, error);
  }
}

// Add new helper function to avoid modifying existing logic
async function createPendingProfile(data) {
  // Implementation details for creating/updating profile
}
```

#### **actions/whop-actions.ts**
Add new functions to handle frictionless checkout and profile claiming:

```typescript
// Add to existing whop-actions.ts file
export async function createCheckoutForEmail(email: string, planId: string) {
  // Implementation for creating checkout with email
}

export async function claimPendingProfile(userId: string, email: string, token?: string) {
  // Implementation for claiming a pending profile
}
```

#### **db/queries/profiles-queries.ts**
Leverage existing file by adding email-based lookup:

```typescript
// Already exists - just need to ensure it works properly
export const getProfileByUserEmail = async (email: string) => {
  // Implementation for finding profile by email
}

// Add new function to update a profile with ClerkUserId
export const claimProfileWithEmail = async (email: string, userId: string) => {
  // Implementation for claiming a profile by email
}

// Add new function to claim profile with token
export const claimProfileWithToken = async (token: string, userId: string) => {
  // Implementation for claiming a profile by token
}
```

### 2. New Files Required

#### **app/pay/page.tsx**
A new page for unauthenticated checkout:

```typescript
// New file: Simple pricing page with email collection
// This needs to be a new file as it's a new route
"use client";

import { useState } from "react";
import { createCheckoutForEmail } from "@/actions/whop-actions";

export default function PayPage() {
  const [email, setEmail] = useState("");
  
  // Implementation of checkout UI
  // ...
}
```

#### **app/(auth)/signup/claim-profile.tsx**
Component to handle profile claiming logic (to be used in signup page):

```typescript
"use client";

import { useEffect } from "react";
import { claimPendingProfile } from "@/actions/whop-actions";

export default function ClaimProfile({ userId, email, token }) {
  useEffect(() => {
    if (userId && (email || token)) {
      claimPendingProfile(userId, email, token);
    }
  }, [userId, email, token]);
  
  return null; // This is a logic-only component, no UI
}
```

## Implementation Details

### 1. Pricing Page Flow
The `/pay` page will:
- Display pricing options
- Collect user email
- Generate a checkout URL with email and token in metadata
- Redirect to Whop checkout

### 2. Payment Success Handling
When payment succeeds:
- Webhook checks if clerkUserId exists in metadata
- If not, it checks for email and token
- Creates a profile with email, token, and "paid_pending_account" status
- Stores all payment details (whopUserId, membership, credits, etc.)

### 3. Signup Integration
Modify the Clerk signup component integration to:
- Extract token from URL parameters
- Remember email if present in URL
- After successful signup, check if a profile with matching email exists
- If found, update the profile with the new userId
- If not found, check if a profile with matching token exists
- If neither exists, create a standard free account

```typescript
// Update signup page.tsx
"use client";
import { SignUp } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { ClaimProfile } from "./claim-profile";

export default function SignUpPage() {
  const params = useSearchParams();
  const token = params.get('token');
  const email = params.get('email');
  
  return (
    <>
      <SignUp 
        initialValues={email ? { emailAddress: email } : undefined}
        afterSignUpUrl={`/api/claim-profile?token=${token || ''}&email=${email || ''}`}
      />
      {/* Claim component renders only after successful signup */}
    </>
  );
}
```

### 4. Profile Claiming
Add a new API route to handle post-signup profile claiming:

```typescript
// app/api/claim-profile/route.ts
import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { claimPendingProfile } from "@/actions/whop-actions";

export async function GET(req: Request) {
  const { userId } = auth();
  if (!userId) return redirect("/login");
  
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const email = url.searchParams.get("email");
  
  // Attempt to claim profile
  await claimPendingProfile(userId, email || "", token || "");
  
  return redirect("/notes");
}
```

## Edge Cases & Solutions

### 1. User Pays But Closes Browser Before Signup
**Solution:**
- Email-based matching serves as primary recovery mechanism
- When user eventually signs up with same email, profile is automatically matched
- Token in URL serves as secondary mechanism if redirected directly

### 2. User Pays With One Email, Signs Up With Another
**Solution:**
- After login, add "I already paid" option in account settings
- Allow user to enter email used for payment or token from URL
- Admin can manually link profiles if needed

### 3. User Pays Multiple Times Before Creating Account
**Solution:**
- Use most recent or highest-tier payment as primary profile
- Consolidate credits if applicable
- Store payment history for reference

### 4. Multiple Users Try to Claim Same Purchase
**Solution:**
- First claim wins
- Once a profile has a userId, it's no longer claimable
- Show clear error message if purchase already claimed

### 5. Existing Account Users Try to Use New Flow
**Solution:**
- If signed in user visits /pay, redirect to normal checkout
- Add clear messaging to indicate separate flows

## Compatibility Safeguards

### 1. Dual-Path Processing in Webhook Handlers
- All existing code paths remain untouched
- New logic runs only when clerkUserId is missing
- Each function has clear separation between auth/non-auth flows

### 2. Error Handling and Logging
- Add comprehensive error handling for new paths
- Log all operations clearly to track flow
- Implement fallbacks at each step

### 3. Testing Strategy
- Test both flows independently
- Verify existing flow continues to work
- Test edge cases and transitions between flows

## Technical Implementation Notes

### 1. Code Organization
- Add new functions to existing files where logical
- Create new files only for new UI components and routes
- Keep helper functions close to where they're used

### 2. Database Considerations
- No schema changes needed
- Use existing fields efficiently
- Leverage indexes on email field for performance

### 3. Security Considerations
- Validate all inputs server-side
- Use cryptographically secure tokens
- Implement rate limiting on token claiming

## Integration Plan

1. Implement changes to `payment-handlers.ts` first (non-disruptive)
2. Add profile query functions for email matching
3. Create new checkout function in `whop-actions.ts`
4. Build pricing page with new checkout flow
5. Integrate signup page with profile claiming
6. Build account recovery mechanism as final step

This implementation minimizes disruption to existing code while adding powerful new functionality. By focusing on modularity and separation of concerns, we ensure the frictionless payment flow integrates seamlessly with the current system.
