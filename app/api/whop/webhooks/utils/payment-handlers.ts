/**
 * Payment event handlers for webhook processing
 * Handles payment success and failure events
 * 
 * Processes payment events by updating a user's profile with payment details - when a payment succeeds, it upgrades the 
 * user to PRO and gives them credits; when a payment fails, it marks their account with a payment_failed status.
 * 
 */

import { getProfileByUserId, updateProfile, getProfileByWhopUserId, getProfileByEmail } from "@/db/queries/profiles-queries";
import { PRO_TIER_CREDITS, CREDIT_RENEWAL_DAYS } from "./constants";
import { determinePlanType } from "./plan-utils";
import { extractUserId } from "./user-utils";
import { revalidateAfterPayment } from "./path-utils";
import { convertTimestampToDate } from "./plan-utils";
import { eq } from "drizzle-orm";
import { db } from "@/db/db";
import { profilesTable } from "@/db/schema/profiles-schema";
import { isFrictionlessPayment, handleFrictionlessPayment, createOrUpdatePendingProfile } from "./frictionless-payment-handlers";

/**
 * Handle payment success events
 * Updates user profile with Whop IDs, billing cycle information, membership status, and credits
 * Now delegates to frictionless-payment-handlers.ts for email-based purchases
 * 
 * @param data The webhook event data
 */
export async function handlePaymentSuccess(data: any) {
  const eventId = data.id || Date.now().toString();
  console.log(`[Event ${eventId}] START: Processing payment success`);

  try {
    // Debug the frictionless detection
    console.log(`[Event ${eventId}] Debug frictionless detection:`);
    console.log(`[Event ${eventId}] Has metadata:`, !!data.metadata);
    console.log(`[Event ${eventId}] Has membership_metadata:`, !!data.membership_metadata);
    if (data.membership_metadata) {
      console.log(`[Event ${eventId}] membership_metadata:`, data.membership_metadata);
    }
    
    // Test if this is a frictionless payment
    const isUnauthenticated = isFrictionlessPayment(data);
    console.log(`[Event ${eventId}] isFrictionlessPayment result:`, isUnauthenticated);
    
    // First check if this is a frictionless payment (email-based, no Clerk ID)
    if (isUnauthenticated) {
      console.log(`[Event ${eventId}] Identified as a frictionless payment (email-based checkout)`);
      await handleFrictionlessPayment(data, eventId);
      return;
    }
    
    // If not frictionless, proceed with the traditional authenticated flow
    
    // Extract user ID from metadata using the common utility
    const clerkUserId = extractUserId(data);
    
    if (!clerkUserId) {
      console.error(`[Event ${eventId}] CRITICAL ERROR: No Clerk userId found and not a frictionless payment`);
      console.error(`[Event ${eventId}] Cannot process payment without user identification`);
      console.error(`[Event ${eventId}] Metadata:`, JSON.stringify(data.metadata || {}, null, 2));
      return;
    }
    
    console.log(`[Event ${eventId}] Found Clerk userId: ${clerkUserId}, processing as authenticated payment`);
    
    // Calculate billing cycle details
    let billingCycleStart = new Date();
    let billingCycleEnd = null;
    
    // Check if the webhook provides the cycle start/end dates
    if (data?.renewal_period_start) {
      // Convert timestamp to Date
      billingCycleStart = convertTimestampToDate(data.renewal_period_start);
      console.log(`[Event ${eventId}] Billing cycle start: ${billingCycleStart.toISOString()}`);
    }
    
    if (data?.renewal_period_end) {
      // Convert timestamp to Date
      billingCycleEnd = convertTimestampToDate(data.renewal_period_end);
      console.log(`[Event ${eventId}] Billing cycle end: ${billingCycleEnd.toISOString()}`);
    } else {
      // Need to calculate it ourselves based on the plan type
      const planDuration = determinePlanType(data?.plan_id);
      
      if (planDuration === "yearly") {
        billingCycleEnd = new Date(billingCycleStart);
        billingCycleEnd.setFullYear(billingCycleEnd.getFullYear() + 1);
      } else {
        // Default to monthly (30 days)
        billingCycleEnd = new Date(billingCycleStart);
        billingCycleEnd.setDate(billingCycleEnd.getDate() + 30);
      }
      
      console.log(`[Event ${eventId}] Calculated billing cycle end: ${billingCycleEnd.toISOString()}`);
    }

    // Determine plan duration based on the plan ID
    const planDuration = determinePlanType(data?.plan_id);
    console.log(`[Event ${eventId}] Determined plan duration: ${planDuration}`);
    
    // Calculate next credit renewal date (always 4 weeks from now)
    const nextCreditRenewal = new Date();
    nextCreditRenewal.setDate(nextCreditRenewal.getDate() + CREDIT_RENEWAL_DAYS);
    console.log(`[Event ${eventId}] Next credit renewal: ${nextCreditRenewal.toISOString()}`);
    
    // Prepare update data - we need to update all the important fields
    const updateData: any = {
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
    
    console.log(`[Event ${eventId}] Upgrading user to PRO with ${PRO_TIER_CREDITS} credits`);
    console.log(`[Event ${eventId}] Update data:`, JSON.stringify(updateData, null, 2));
    
    // Add retry logic for the database update
    let retries = 0;
    const maxRetries = 3;
    let updateSuccess = false;
    
    while (retries < maxRetries && !updateSuccess) {
      try {
        console.log(`[Event ${eventId}] Update attempt ${retries + 1}: Updating profile for user ${clerkUserId}`);
        await updateProfile(clerkUserId, updateData);
        console.log(`[Event ${eventId}] SUCCESS: Profile updated to PRO status with ${PRO_TIER_CREDITS} credits`);
        updateSuccess = true;
      } catch (error) {
        retries++;
        console.error(`[Event ${eventId}] Update attempt ${retries} failed:`, error);
        
        if (retries < maxRetries) {
          // Wait before retrying (exponential backoff)
          const backoffMs = 1000 * Math.pow(2, retries);
          console.log(`[Event ${eventId}] Waiting ${backoffMs}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }
    
    if (!updateSuccess) {
      console.error(`[Event ${eventId}] CRITICAL: Failed to update profile after ${maxRetries} attempts`);
    }

    // Revalidate paths to refresh data after payment
    try {
      revalidateAfterPayment();
      console.log(`[Event ${eventId}] Revalidation successful`);
    } catch (revalidateError) {
      console.error(`[Event ${eventId}] Error revalidating paths:`, revalidateError);
    }

    console.log(`[Event ${eventId}] END: Authenticated payment success processing complete`);
  } catch (error) {
    console.error(`[Event ${eventId}] Error handling payment success:`, error);
  }
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

/**
 * Handle payment failure events
 * Marks the user's payment as failed in the profile
 * 
 * @param data The webhook event data
 */
export async function handlePaymentFailed(data: any): Promise<void> {
  if (!data) {
    console.error("No data provided to handlePaymentFailed");
    return;
  }
  
  console.log(`Payment failed for membership: ${data.id}`);
  console.log("Processing payment failure event, extracting user ID...");
  
  // Try to get userId from metadata using the common utility
  const userId = extractUserId(data);
  
  if (userId) {
    console.log(`Found Clerk userId ${userId} in payment failure metadata, updating status`);
    try {
      await updateProfile(userId, {
        status: "payment_failed"
      });
      console.log(`Successfully marked payment as failed for user ${userId}`);
    } catch (error) {
      console.error(`Error updating payment failed status for user ${userId}:`, error);
    }
    return;
  } 
  
  console.error("CRITICAL ERROR: No Clerk userId found in payment failure webhook metadata");
  console.error("Payment failure status cannot be applied to user account");
  
  // Fallback: try to find by Whop user ID (this should be rare)
  const whopUserId = data.user_id;
  if (whopUserId) {
    console.log(`Attempting fallback: Looking up profile by Whop user ID: ${whopUserId}`);
    try {
      const profile = await getProfileByWhopUserId(whopUserId);
      if (profile) {
        console.log(`Found profile by Whop user ID, marking payment as failed for user ${profile.userId}`);
        await updateProfile(profile.userId, {
          status: "payment_failed"
        });
        console.log(`Successfully marked payment as failed via Whop user ID fallback`);
      } else {
        console.error(`Cannot mark payment as failed: No profile found with Whop user ID: ${whopUserId}`);
      }
    } catch (error) {
      console.error(`Error looking up profile by Whop user ID ${whopUserId}:`, error);
    }
  } else {
    console.error("Cannot mark payment as failed: No user ID or Whop user ID found");
    console.error("This webhook cannot be processed because no user account can be identified");
  }
} 