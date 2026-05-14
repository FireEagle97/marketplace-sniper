
# Pending Profiles Migration PRD

## Overview

This document outlines the steps required to migrate the unauthenticated checkout flow from using temporary profiles in the main `profiles` table to using a dedicated `pending-profiles` table. This change will improve data separation, make customer support easier, and streamline the claiming process.

## Migration Steps

### 1. Create Pending Profiles Schema

**File**: `/db/schema/pending-profiles-schema.ts`

Create a new schema file for the pending profiles table with these fields:

```typescript
import { pgTable, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { paymentProviderEnum, membershipEnum } from "./profiles-schema";

export const pendingProfilesTable = pgTable("pending_profiles", {
  id: text("id").primaryKey().notNull(), // UUID or generated ID
  email: text("email").notNull().unique(), // User's email address - unique constraint
  token: text("token"), // Verification token from checkout
  
  // Payment details
  membership: membershipEnum("membership").notNull().default("pro"),
  paymentProvider: paymentProviderEnum("payment_provider").default("whop"),
  
  // Whop specific fields
  whopUserId: text("whop_user_id"),
  whopMembershipId: text("whop_membership_id"),
  
  // Plan details
  planDuration: text("plan_duration"), // "monthly" or "yearly"
  billingCycleStart: timestamp("billing_cycle_start"),
  billingCycleEnd: timestamp("billing_cycle_end"),
  nextCreditRenewal: timestamp("next_credit_renewal"),
  
  // Credits information
  usageCredits: integer("usage_credits").default(0),
  usedCredits: integer("used_credits").default(0),
  
  // Claiming status
  claimed: boolean("claimed").default(false),
  claimedByUserId: text("claimed_by_user_id"),
  claimedAt: timestamp("claimed_at"),
  
  // Standard timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
});

export type InsertPendingProfile = typeof pendingProfilesTable.$inferInsert;
export type SelectPendingProfile = typeof pendingProfilesTable.$inferSelect;
```

**File**: `/db/schema/index.ts`

Update to export the new schema:

```typescript
export * from "./profiles-schema";
export * from "./pending-profiles-schema";
```

### 2. Create Query Functions for Pending Profiles

**File**: `/db/queries/pending-profiles-queries.ts`

Create query functions for the new table:

```typescript
import { db } from "@/db/db";
import { pendingProfilesTable, InsertPendingProfile, SelectPendingProfile } from "@/db/schema/pending-profiles-schema";
import { eq, and } from "drizzle-orm";

// Create a new pending profile
export const createPendingProfile = async (data: InsertPendingProfile): Promise<SelectPendingProfile> => {
  const [pendingProfile] = await db.insert(pendingProfilesTable).values(data).returning();
  return pendingProfile;
};

// Get a pending profile by email
export const getPendingProfileByEmail = async (email: string): Promise<SelectPendingProfile | undefined> => {
  return db.query.pendingProfilesTable.findFirst({
    where: eq(pendingProfilesTable.email, email)
  });
};

// Get unclaimed pending profiles
export const getUnclaimedPendingProfiles = async (): Promise<SelectPendingProfile[]> => {
  return db.query.pendingProfilesTable.findMany({
    where: eq(pendingProfilesTable.claimed, false)
  });
};

// Mark a pending profile as claimed
export const markPendingProfileAsClaimed = async (
  id: string, 
  userId: string
): Promise<SelectPendingProfile | undefined> => {
  const [updated] = await db
    .update(pendingProfilesTable)
    .set({
      claimed: true,
      claimedByUserId: userId,
      claimedAt: new Date()
    })
    .where(eq(pendingProfilesTable.id, id))
    .returning();
  return updated;
};

// Delete a pending profile
export const deletePendingProfile = async (id: string): Promise<boolean> => {
  const [deleted] = await db
    .delete(pendingProfilesTable)
    .where(eq(pendingProfilesTable.id, id))
    .returning();
  return !!deleted;
};
```

### 3. Update Frictionless Payment Handlers

**File**: `/app/api/whop/webhooks/utils/frictionless-payment-handlers.ts`

Update to use the new table:

```typescript
import { v4 as uuidv4 } from "uuid"; // Add this package if not already installed
import { getPendingProfileByEmail, createPendingProfile } from "@/db/queries/pending-profiles-queries";
import { getProfileByEmail } from "@/db/queries/profiles-queries";
// ... existing imports ...

// ... existing code ...

/**
 * Create or update a pending profile for unauthenticated purchases
 * This is used when a user pays with just their email, before creating an account
 * 
 * @param data The webhook data from Whop
 * @param email The user's email address
 * @param token Optional token for purchase verification
 * @param eventId Event ID for logging
 */
export async function createOrUpdatePendingProfile(data: any, email: string, token?: string, eventId?: string) {
  const logPrefix = eventId ? `[Event ${eventId}]` : '[Profile Creation]';
  
  try {
    // Calculate billing cycle details
    let billingCycleStart = new Date();
    let billingCycleEnd = null;
    
    // Check if the webhook provides the cycle start/end dates
    if (data?.renewal_period_start) {
      billingCycleStart = convertTimestampToDate(data.renewal_period_start);
    }
    
    if (data?.renewal_period_end) {
      billingCycleEnd = convertTimestampToDate(data.renewal_period_end);
    } else {
      // Calculate based on plan duration
      const planDuration = determinePlanType(data?.plan_id);
      billingCycleEnd = new Date(billingCycleStart);
      
      if (planDuration === "yearly") {
        billingCycleEnd.setFullYear(billingCycleEnd.getFullYear() + 1);
      } else {
        billingCycleEnd.setDate(billingCycleEnd.getDate() + 30); // 30 days for monthly
      }
    }
    
    // Calculate next credit renewal (4 weeks from now)
    const nextCreditRenewal = new Date();
    nextCreditRenewal.setDate(nextCreditRenewal.getDate() + CREDIT_RENEWAL_DAYS);
    
    // Prepare profile data
    const planDuration = determinePlanType(data?.plan_id);
    
    // First check if we already have a pending profile for this email
    const existingPendingProfile = await getPendingProfileByEmail(email);
    
    // Also check if a regular profile exists with this email (user might already have an account)
    const existingProfile = await getProfileByEmail(email);
    
    if (existingProfile && existingProfile.userId && !existingProfile.userId.startsWith('temp_')) {
      console.log(`${logPrefix} Found existing profile with email ${email} and userId ${existingProfile.userId}`);
      console.log(`${logPrefix} Will update existing profile with payment details`);
      
      // If profile exists with a userId, update it like a normal authenticated payment
      // This handles the case where someone uses the frictionless flow with an email that already has an account
      const updateData = prepareProfileUpdateData(data);
      await updateProfile(existingProfile.userId, updateData);
      console.log(`${logPrefix} Updated existing profile for ${email} with userId ${existingProfile.userId}`);
      return true;
    }
    
    // Build the pending profile data
    const pendingProfileData = {
      id: existingPendingProfile?.id || uuidv4(), // Use existing ID or generate new one
      email: email,
      token: token || null,
      
      // Store Whop identifiers
      whopUserId: data?.user_id || null,
      whopMembershipId: data?.membership_id || data?.id || null,
      
      // Set payment provider and membership
      paymentProvider: "whop",
      membership: "pro",
      
      // Set billing cycle information
      billingCycleStart: billingCycleStart,
      billingCycleEnd: billingCycleEnd,
      planDuration: planDuration,
      
      // Set credit renewal date
      nextCreditRenewal: nextCreditRenewal,
      
      // Set pro-level credits
      usageCredits: PRO_TIER_CREDITS,
      usedCredits: 0,
      
      // Set claiming status
      claimed: false,
      claimedByUserId: null,
      claimedAt: null,
    };
    
    console.log(`${logPrefix} Creating/updating pending profile with data:`, JSON.stringify({
      id: pendingProfileData.id,
      email: pendingProfileData.email,
      planDuration: pendingProfileData.planDuration,
      membership: pendingProfileData.membership,
      hasToken: !!pendingProfileData.token
    }, null, 2));
    
    // If there's an existing pending profile, update it, otherwise create a new one
    if (existingPendingProfile) {
      // Update existing pending profile
      await db.update(pendingProfilesTable)
        .set(pendingProfileData)
        .where(eq(pendingProfilesTable.email, email))
        .returning();
      console.log(`${logPrefix} Updated existing pending profile for email: ${email}`);
    } else {
      // Create a new pending profile
      await createPendingProfile(pendingProfileData);
      console.log(`${logPrefix} Created new pending profile for email: ${email} with ID: ${pendingProfileData.id}`);
    }
    
    console.log(`${logPrefix} Successfully processed unauthenticated payment for email: ${email}`);
    return true;
  } catch (error) {
    console.error(`${logPrefix} Failed to create/update pending profile:`, error);
    return false;
  }
}

// ... rest of file unchanged ...
```

### 4. Update Claim Pending Profile Function

**File**: `/actions/whop-actions.ts`

Update to use the new table:

```typescript
import { getPendingProfileByEmail, markPendingProfileAsClaimed, deletePendingProfile } from "@/db/queries/pending-profiles-queries";
// ... existing imports ...

/**
 * Claim a pending profile that was created during an unauthenticated checkout
 * This connects a paid profile to a user's account after they sign up
 * 
 * @param userId The Clerk user ID of the authenticated user
 * @param email The email address used during checkout
 * @param token Optional verification token from the checkout process
 * @returns Object with success status and error message if applicable
 */
export async function claimPendingProfile(
  userId: string, 
  email: string,
  token?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`===== CLAIM PROFILE START =====`);
    console.log(`Attempting to claim pending profile for user ${userId} with email ${email}`);
    
    if (!userId || !email) {
      console.log(`Missing required parameters: userId=${!!userId}, email=${!!email}`);
      return { success: false, error: "Missing required parameters for claiming profile" };
    }

    // First, check if the user already has a profile
    console.log(`Checking if user ${userId} already has a profile...`);
    const existingUserProfile = await getProfileByUserId(userId);
    console.log(`Existing profile check result:`, existingUserProfile ? {
      userId: existingUserProfile.userId,
      email: existingUserProfile.email,
      membership: existingUserProfile.membership
    } : 'No profile found');
    
    if (existingUserProfile?.membership === "pro") {
      console.log(`User ${userId} already has a pro membership, no need to claim`);
      return { success: true };
    }

    // Look for a pending profile with matching email from the new table
    console.log(`Looking for pending profile with email: ${email}`);
    const pendingProfile = await getPendingProfileByEmail(email);
    
    console.log(`Pending profile search result:`, pendingProfile ? {
      id: pendingProfile.id,
      email: pendingProfile.email,
      membership: pendingProfile.membership,
      claimed: pendingProfile.claimed,
      claimedByUserId: pendingProfile.claimedByUserId
    } : 'No pending profile found');
    
    if (!pendingProfile) {
      // Fall back to checking the old system (temporary profiles in the profiles table)
      // This is for backward compatibility during migration
      console.log(`No pending profile found in new table, checking old system...`);
      const oldPendingProfile = await getProfileByEmail(email);
      
      if (oldPendingProfile && oldPendingProfile.userId.startsWith('temp_')) {
        console.log(`Found old temporary profile with ID: ${oldPendingProfile.userId}`);
        // Proceed with the old method - use the existing code with minimal changes
        return claimOldPendingProfile(userId, email, oldPendingProfile);
      }
      
      console.log(`No pending profile found for email: ${email} in either system`);
      return { success: false, error: "No pending profile found for this email. Your purchase may not have been processed yet." };
    }
    
    if (pendingProfile.claimed && pendingProfile.claimedByUserId !== userId) {
      console.log(`Profile for email ${email} is already claimed by user ${pendingProfile.claimedByUserId}`);
      return { success: false, error: "This profile has already been claimed by another account" };
    }
    
    // Verify token if provided (optional additional security)
    if (token && pendingProfile.token && token !== pendingProfile.token) {
      console.log(`Token mismatch: provided=${token}, stored=${pendingProfile.token}`);
      return { success: false, error: "Invalid verification token" };
    }

    console.log(`Found pending profile for email ${email}, proceeding to claim...`);
    
    // If the user already has a profile, merge the pending profile's data into it
    if (existingUserProfile) {
      console.log(`MERGE FLOW: User ${userId} already has a profile, merging pending profile data`);
      
      // Copy all pro-related data from pending profile to existing profile
      const updateData = {
        membership: pendingProfile.membership || "pro",
        whopUserId: pendingProfile.whopUserId,
        whopMembershipId: pendingProfile.whopMembershipId,
        paymentProvider: pendingProfile.paymentProvider || "whop",
        billingCycleStart: pendingProfile.billingCycleStart,
        billingCycleEnd: pendingProfile.billingCycleEnd,
        planDuration: pendingProfile.planDuration,
        nextCreditRenewal: pendingProfile.nextCreditRenewal,
        usageCredits: pendingProfile.usageCredits || 1000,
        usedCredits: pendingProfile.usedCredits || 0,
        status: "active",
        email: email // Make sure email is also updated
      };
      
      console.log(`Updating existing profile with data:`, updateData);
      const updatedProfile = await updateProfile(userId, updateData);
      console.log(`Existing profile updated:`, updatedProfile ? { 
        userId: updatedProfile.userId,
        membership: updatedProfile.membership,
        usageCredits: updatedProfile.usageCredits 
      } : 'Failed to update');
    } else {
      // User doesn't have a profile yet, create a new one with data from pending profile
      console.log(`CREATE FLOW: Creating new profile from pending profile`);
      
      // Extract only the fields we need
      const profileData = {
        userId: userId,
        email: email,
        membership: pendingProfile.membership,
        paymentProvider: pendingProfile.paymentProvider,
        whopUserId: pendingProfile.whopUserId,
        whopMembershipId: pendingProfile.whopMembershipId,
        planDuration: pendingProfile.planDuration,
        billingCycleStart: pendingProfile.billingCycleStart,
        billingCycleEnd: pendingProfile.billingCycleEnd,
        nextCreditRenewal: pendingProfile.nextCreditRenewal,
        usageCredits: pendingProfile.usageCredits || 1000,
        usedCredits: pendingProfile.usedCredits || 0,
        status: "active"
      };
      
      console.log(`Creating new profile with data:`, {
        userId: profileData.userId,
        email: profileData.email,
        membership: profileData.membership,
        usageCredits: profileData.usageCredits
      });
      
      const result = await createProfile(profileData);
      console.log(`New profile creation result:`, result ? {
        userId: result.userId,
        membership: result.membership,
        usageCredits: result.usageCredits
      } : 'Failed to create');
    }
    
    // Mark the pending profile as claimed
    await markPendingProfileAsClaimed(pendingProfile.id, userId);
    console.log(`Marked pending profile as claimed by user ${userId}`);
    
    // Note: We don't delete the pending profile to maintain a record for analytics and support
    
    // Revalidate relevant paths
    console.log(`Revalidating paths`);
    revalidatePath("/");
    revalidatePath("/notes");
    revalidatePath("/dashboard");
    
    console.log(`Successfully claimed profile for user ${userId} with email ${email}`);
    console.log(`===== CLAIM PROFILE SUCCESS =====`);
    return { success: true };
  } catch (error) {
    console.error(`===== CLAIM PROFILE ERROR =====`);
    console.error("Error claiming pending profile:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error claiming profile" 
    };
  }
}

/**
 * Legacy function to claim profiles using the old method (temporary profiles in profiles table)
 * This is for backward compatibility during migration
 */
async function claimOldPendingProfile(
  userId: string, 
  email: string, 
  pendingProfile: any
): Promise<{ success: boolean; error?: string }> {
  try {
    // Use the existing logic for backward compatibility
    // [Keep the existing code from lines 144-246 of actions/whop-actions.ts]
    // ...
    
    console.log(`Successfully claimed profile using legacy method`);
    return { success: true };
  } catch (error) {
    console.error("Error in legacy profile claiming:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error claiming profile" 
    };
  }
}
```

### 5. Update Root Layout

**File**: `/app/layout.tsx`

Modify the root layout to check for pending profiles:

```typescript
import { getProfileByUserIdAction, createProfileAction } from "@/actions/profiles-actions";
import { claimPendingProfile } from "@/actions/whop-actions";
// ... existing imports ...

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { userId } = auth();

  if (userId) {
    try {
      // First check if the user already has a profile
      const res = await getProfileByUserIdAction(userId);
      
      if (!res.data) {
        // No profile exists for this user, so we might need to create one
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        
        if (email) {
          // Check if there's a pending profile with this email
          console.log(`Checking for pending profile with email ${email} for user ${userId}`);
          
          // Try to claim any pending profile first
          const claimResult = await claimPendingProfile(userId, email);
          
          if (!claimResult.success) {
            // Only create a new profile if we couldn't claim a pending one
            console.log(`No pending profile found, creating new profile for user ${userId} with email ${email}`);
            await createProfileAction({ 
              userId,
              email
            });
          } else {
            console.log(`Successfully claimed pending profile for user ${userId} with email ${email}`);
          }
        } else {
          // No email available, create a basic profile
          console.log(`Creating basic profile for user ${userId} with no email`);
          await createProfileAction({ userId });
        }
      }
    } catch (error) {
      console.error("Error checking/creating user profile:", error);
    }
  }

  // ... rest of the component
```

### 6. Server Actions for Pending Profiles

**File**: `/actions/pending-profiles-actions.ts`

Create server actions for the new table:

```typescript
"use server";

import { 
  getPendingProfileByEmail, 
  getUnclaimedPendingProfiles, 
  markPendingProfileAsClaimed,
  deletePendingProfile 
} from "@/db/queries/pending-profiles-queries";

export async function getPendingProfileByEmailAction(email: string) {
  try {
    const profile = await getPendingProfileByEmail(email);
    return { success: true, data: profile };
  } catch (error) {
    console.error("Error getting pending profile by email:", error);
    return { success: false, error: "Failed to get pending profile" };
  }
}

export async function getUnclaimedPendingProfilesAction() {
  try {
    const profiles = await getUnclaimedPendingProfiles();
    return { success: true, data: profiles };
  } catch (error) {
    console.error("Error getting unclaimed pending profiles:", error);
    return { success: false, error: "Failed to get unclaimed profiles" };
  }
}

export async function markPendingProfileAsClaimedAction(id: string, userId: string) {
  try {
    const updated = await markPendingProfileAsClaimed(id, userId);
    return { success: true, data: updated };
  } catch (error) {
    console.error("Error marking pending profile as claimed:", error);
    return { success: false, error: "Failed to mark profile as claimed" };
  }
}

export async function deletePendingProfileAction(id: string) {
  try {
    const deleted = await deletePendingProfile(id);
    return { success: true, data: deleted };
  } catch (error) {
    console.error("Error deleting pending profile:", error);
    return { success: false, error: "Failed to delete pending profile" };
  }
}
```

## Migration Overview and Benefits

This migration moves unauthenticated purchases from temporary entries in the main profiles table to a dedicated pending profiles table. Benefits include:

1. **Cleaner Data Model**: Separate tables for separate concerns
2. **Better Customer Support**: Easily find unclaimed purchases
3. **Improved Analytics**: Track conversion rates from purchase to signup
4. **Easier Maintenance**: No more temporary user IDs in the main table

## Migration Summary

| File | Change | Purpose |
|------|--------|---------|
| `/db/schema/pending-profiles-schema.ts` | New | Define the schema for the pending profiles table |
| `/db/schema/index.ts` | Update | Export the new schema |
| `/db/queries/pending-profiles-queries.ts` | New | CRUD operations for pending profiles |
| `/app/api/whop/webhooks/utils/frictionless-payment-handlers.ts` | Update | Store pending purchases in the new table |
| `/actions/whop-actions.ts` | Update | Update claim function to use new table |
| `/app/layout.tsx` | Update | Check for pending profiles during signup |
| `/actions/pending-profiles-actions.ts` | New | Server actions for pending profiles |

## Migration Strategy

To implement this change safely:

1. First, create the new table and related functions
2. Update the webhook handler to write to both places initially
3. Update the claim function to check both places
4. Once confirmed working, phase out the old approach

This ensures backward compatibility during the transition period.

The frontend components like the pay page (`app/pay/page.tsx`) and signup page (`app/(auth)/signup/[[...signup]]/page.tsx`) don't need changes as they interact through the API endpoints and server actions, which will handle the migration details internally.
