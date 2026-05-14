/**
 * Membership cancellation handler for webhook processing
 * Handles membership.went_invalid events
 * 
 * Processes membership cancellation events by updating a user's profile in the database - 
 * it sets a user to FREE when they cancel (either immediately or after their billing period ends)
 * while preserving their credits.
 * 
 */

import { updateProfile, getProfileByUserId, getProfileByWhopUserId } from "@/db/queries/profiles-queries";
import { FREE_TIER_CREDITS, CREDIT_RENEWAL_DAYS } from "./constants";
import { extractUserId } from "./user-utils";
import { revalidateAfterCancellation } from "./path-utils";

/**
 * Handle membership status changes (cancellation only)
 * 
 * @param data The webhook event data from Whop
 * @param isValid Boolean indicating if membership is becoming valid (true) or invalid (false)
 */
export async function handleMembershipChange(data: any, isValid: boolean) {
  // We only handle cancellations now
  if (isValid) {
    console.log("Membership activation is handled by payment success webhook");
    return;
  }

  if (!data.id || !data.user_id) {
    console.error("Missing required data in membership event");
    return;
  }
  
  const eventId = data.id || Date.now().toString();
  console.log(`[Event ${eventId}] Processing membership cancellation`);
  
  try {
    // Extract Clerk user ID from metadata
    console.log(`[Event ${eventId}] Extracting Clerk userId from webhook metadata...`);
    const clerkUserId = extractUserId(data);
    
    if (clerkUserId) {
      console.log(`[Event ${eventId}] Found Clerk userId ${clerkUserId} in metadata, processing cancellation`);
      await handleMembershipCancellation(data);
      console.log(`[Event ${eventId}] Completed membership cancellation processing`);
      return;
    } else {
      console.error(`[Event ${eventId}] No Clerk userId found in webhook metadata. This is a critical issue.`);
      console.error("Cannot reliably link this webhook to a user account without a Clerk userId.");
    }
    
    // FALLBACK PATH: Try to find a profile with this Whop user ID when metadata doesn't have Clerk ID
    const whopUserId = data.user_id;
    console.log(`[Event ${eventId}] Falling back to profile lookup by Whop user ID: ${whopUserId}`);
    const existingProfile = await getProfileByWhopUserId(whopUserId);
    
    if (existingProfile) {
      console.log(`[Event ${eventId}] Found profile for Whop user ${whopUserId} -> Clerk userId ${existingProfile.userId}`);
      
      // For cancellation with the fallback path, we use a modified approach with the found clerk ID
      const cancellationData = { ...data, metadata: { ...data.metadata, clerkUserId: existingProfile.userId } };
      await handleMembershipCancellation(cancellationData);
    } else {
      console.error(`[Event ${eventId}] Cannot process cancellation: No profile found with Whop user ID: ${whopUserId}`);
    }
  } catch (error) {
    console.error(`[Event ${eventId}] Error processing membership cancellation:`, error);
  }
}

/**
 * Handle membership cancellation according to the PRD
 * Uses a completely isolated flow for cancellation logic to avoid overlap with payment logic
 * 
 * @param data The webhook event data from Whop
 */
async function handleMembershipCancellation(data: any) {
  const eventId = data.id || Date.now().toString();
  console.log(`[Event ${eventId}] START: Cancellation for membership ${data.id}`);

  // Extract the clerk user ID
  const clerkUserId = extractUserId(data);
  if (!clerkUserId) {
    console.error(`[Event ${eventId}] Missing clerkUserId in webhook data`);
    return;
  }

  console.log(`[Event ${eventId}] Processing cancellation for Clerk user ${clerkUserId}`);
  
  // Skip profile fetching entirely - just update what we need directly
  
  // Prepare minimal update data - only what's absolutely necessary
  console.log(`[Event ${eventId}] Preparing minimal update data for cancellation`);
  const updateData = {
    membership: "free" as "free",  // Explicitly type as the enum value
    status: "canceled",            // Mark as canceled
    planDuration: null,            // Clear plan duration 
    // We're not touching credits, keeping whatever they currently have
  };
  
  console.log(`[Event ${eventId}] Will directly update user ${clerkUserId} to FREE plan with CANCELED status`);
  console.log(`[Event ${eventId}] Their existing credits will be preserved`);

  // Update profile with retries and timeout
  let updateSuccess = false;
  let retries = 0;
  const maxRetries = 3;
  
  console.log(`[Event ${eventId}] Beginning profile update process`);
  
  while (retries < maxRetries && !updateSuccess) {
    try {
      console.log(`[Event ${eventId}] Update attempt ${retries + 1}: Updating profile for user ${clerkUserId}`);
      
      // Add explicit timeout to the update operation
      const updatePromise = Promise.race([
        updateProfile(clerkUserId, updateData),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Profile update timeout - 10 seconds")), 10000)
        )
      ]);
      
      await updatePromise;
      console.log(`[Event ${eventId}] SUCCESS: Profile updated to free/canceled`);
      console.log(`[Event ${eventId}] User ${clerkUserId} has been downgraded to the FREE plan`);
      updateSuccess = true;
    } catch (error: any) {
      retries++;
      console.error(`[Event ${eventId}] Update attempt ${retries} failed: ${error.message}`);
      
      if (retries < maxRetries) {
        const backoffMs = 1000 * Math.pow(2, retries);
        console.log(`[Event ${eventId}] Waiting ${backoffMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      } else {
        console.error(`[Event ${eventId}] All ${maxRetries} update attempts failed for user ${clerkUserId}`);
      }
    }
  }

  if (!updateSuccess) {
    console.error(`[Event ${eventId}] CRITICAL: Failed to update profile after ${maxRetries} attempts`);
  }

  // Always trigger revalidation, even if update failed
  try {
    revalidateAfterCancellation();
    console.log(`[Event ${eventId}] Revalidation successful`);
  } catch (error) {
    console.error(`[Event ${eventId}] Error revalidating paths:`, error);
  }

  console.log(`[Event ${eventId}] END: Cancellation processing complete`);
} 