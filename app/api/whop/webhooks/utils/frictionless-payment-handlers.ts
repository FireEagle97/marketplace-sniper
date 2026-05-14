/**
 * Frictionless Payment Handlers
 * 
 * This file contains handlers specifically for the "Pay First, Create Account Later" flow.
 * These functions are used when a user makes a purchase with just their email address
 * without having a Clerk account yet.
 */

import { getProfileByEmail } from "@/db/queries/profiles-queries";
import { createPendingProfile, getPendingProfileByEmail } from "@/db/queries/pending-profiles-queries";
import { PRO_TIER_CREDITS, CREDIT_RENEWAL_DAYS } from "./constants";
import { determinePlanType } from "./plan-utils";
import { convertTimestampToDate } from "./plan-utils";
import { revalidateAfterPayment } from "./path-utils";
import { eq } from "drizzle-orm";
import { db } from "@/db/db";
import { profilesTable } from "@/db/schema/profiles-schema";
import { pendingProfilesTable } from "@/db/schema/pending-profiles-schema";
import { v4 as uuidv4 } from "uuid";

/**
 * Determines if a webhook payload should be handled by the frictionless flow
 * 
 * @param data The webhook event data from Whop
 * @returns Boolean indicating if this is a frictionless payment
 */
export function isFrictionlessPayment(data: any): boolean {
  // Debug log the structure to make sure we know what we're working with
  console.log("Checking for frictionless payment with data structure:", 
    JSON.stringify({
      hasMetadata: !!data.metadata,
      hasMembershipMetadata: !!data.membership_metadata,
      metadataKeys: data.metadata ? Object.keys(data.metadata) : [],
      membershipMetadataKeys: data.membership_metadata ? Object.keys(data.membership_metadata) : []
    }, null, 2)
  );

  // For payment.succeeded events, we need to check membership_metadata
  if (data.membership_metadata) {
    const hasEmail = !!data.membership_metadata.email;
    const isExplicitlyUnauthenticated = !!data.membership_metadata.isUnauthenticated;
    
    console.log("Checking membership_metadata:", {
      hasEmail,
      isExplicitlyUnauthenticated,
      metadata: data.membership_metadata
    });
    
    if (hasEmail || isExplicitlyUnauthenticated) {
      console.log("DETECTED FRICTIONLESS PAYMENT from membership_metadata");
      return true;
    }
  }
  
  // For other events, check regular metadata
  if (data.metadata) {
    const hasEmail = !!data.metadata.email;
    const hasClerkUserId = !!data.metadata.clerkUserId;
    const isExplicitlyUnauthenticated = !!data.metadata.isUnauthenticated;
    
    console.log("Checking metadata:", {
      hasEmail,
      hasClerkUserId,
      isExplicitlyUnauthenticated,
      metadata: data.metadata
    });
    
    if ((hasEmail && !hasClerkUserId) || isExplicitlyUnauthenticated) {
      console.log("DETECTED FRICTIONLESS PAYMENT from regular metadata");
      return true;
    }
  }
  
  // Not a frictionless payment
  console.log("NOT a frictionless payment");
  return false;
}

/**
 * Handle frictionless payment success
 * This is for users who pay with email before creating an account
 * 
 * @param data The webhook event data
 * @param eventId The event ID for logging
 * @returns Boolean indicating success
 */
export async function handleFrictionlessPayment(data: any, eventId: string): Promise<boolean> {
  try {
    console.log(`[Event ${eventId}] Processing frictionless payment`);
    
    // Extract email and token, checking both metadata and membership_metadata
    // Prioritize membership_metadata as it seems to be where Whop puts this info in the payment.succeeded event
    let email = null;
    let token = null;
    
    if (data.membership_metadata) {
      email = data.membership_metadata.email || null;
      token = data.membership_metadata.token || null;
      console.log(`[Event ${eventId}] Found in membership_metadata - email: ${email}, token: ${token ? 'present' : 'not present'}`);
    }
    
    // Fall back to regular metadata if no email in membership_metadata
    if (!email && data.metadata) {
      email = data.metadata.email || null;
      token = data.metadata.token || null;
      console.log(`[Event ${eventId}] Found in metadata - email: ${email}, token: ${token ? 'present' : 'not present'}`);
    }
    
    // Try user_email as last resort
    if (!email && data.user_email) {
      email = data.user_email;
      console.log(`[Event ${eventId}] Using user_email as fallback: ${email}`);
    }
    
    if (!email) {
      console.error(`[Event ${eventId}] CRITICAL ERROR: No email found in frictionless payment`);
      console.error(`[Event ${eventId}] Metadata:`, JSON.stringify(data.metadata || {}, null, 2));
      console.error(`[Event ${eventId}] Membership Metadata:`, JSON.stringify(data.membership_metadata || {}, null, 2));
      return false;
    }
    
    console.log(`[Event ${eventId}] Processing frictionless payment for email: ${email}`);
    
    // Check if a regular profile already exists with this email (user already has an account)
    const existingProfile = await getProfileByEmail(email);
    
    if (existingProfile && existingProfile.userId && !existingProfile.userId.startsWith('temp_')) {
      console.log(`[Event ${eventId}] Found existing profile with email ${email} and userId ${existingProfile.userId}`);
      console.log(`[Event ${eventId}] Will update existing profile with payment details`);
      
      // If profile exists with a userId, update it like a normal authenticated payment
      // This handles the case where someone uses the frictionless flow with an email that already has an account
      const updateData = prepareProfileUpdateData(data);
      await updateProfile(existingProfile.userId, updateData);
      console.log(`[Event ${eventId}] Updated existing profile for ${email} with userId ${existingProfile.userId}`);
    } else {
      // No existing regular profile - create a pending profile in the pending_profiles table
      console.log(`[Event ${eventId}] Creating new pending profile in pending_profiles table for email: ${email}`);
      await createOrUpdatePendingProfile(data, email, token, eventId);
    }
    
    // Revalidate paths
    revalidateAfterPayment();
    console.log(`[Event ${eventId}] END: Unauthenticated payment processing complete`);
    return true;
  } catch (error) {
    console.error(`[Event ${eventId}] Error handling frictionless payment:`, error);
    return false;
  }
}

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
    console.log(`${logPrefix} USING NEW PENDING PROFILES SYSTEM - creating in pending_profiles table`);
    
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
    
    // Build the pending profile data
    const pendingProfileData = {
      id: existingPendingProfile?.id || uuidv4(), // Use existing ID or generate new one
      email: email,
      token: token || null,
      
      // Store Whop identifiers
      whopUserId: data?.user_id || null,
      whopMembershipId: data?.membership_id || data?.id || null,
      
      // Set payment provider and membership
      paymentProvider: "whop" as "whop",
      membership: "pro" as "pro",
      
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

/**
 * Update an existing profile for a user with Clerk ID
 * Used when a user with an existing account uses the frictionless flow
 * 
 * @param userId The Clerk user ID
 * @param data The webhook data
 */
async function updateProfile(userId: string, data: any) {
  await db.update(profilesTable).set(data).where(eq(profilesTable.userId, userId)).returning();
}

/**
 * Helper function to prepare profile update data from webhook data
 * Extracts common fields needed for both authenticated and unauthenticated payments
 */
function prepareProfileUpdateData(data: any) {
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
    // Calculate based on plan type
    const planDuration = determinePlanType(data?.plan_id);
    billingCycleEnd = new Date(billingCycleStart);
    
    if (planDuration === "yearly") {
      billingCycleEnd.setFullYear(billingCycleEnd.getFullYear() + 1);
    } else {
      billingCycleEnd.setDate(billingCycleEnd.getDate() + 30); // 30 days for monthly
    }
  }
  
  // Calculate next credit renewal date (always 4 weeks from now)
  const nextCreditRenewal = new Date();
  nextCreditRenewal.setDate(nextCreditRenewal.getDate() + CREDIT_RENEWAL_DAYS);
  
  // Determine plan duration based on the plan ID
  const planDuration = determinePlanType(data?.plan_id);
  
  return {
    // Store Whop identifiers
    whopUserId: data?.user_id || null,
    whopMembershipId: data?.membership_id || data?.id || null,
    
    // Set payment provider
    paymentProvider: "whop" as "whop",
    
    // Set billing cycle information
    billingCycleStart: billingCycleStart,
    billingCycleEnd: billingCycleEnd,
    planDuration: planDuration,
    
    // Set membership status to pro
    membership: "pro" as "pro",
    
    // Set pro-level credits
    usageCredits: PRO_TIER_CREDITS,
    usedCredits: 0,
    
    // Set credit renewal date
    nextCreditRenewal: nextCreditRenewal,
    
    // Set status to active
    status: "active"
  };
} 