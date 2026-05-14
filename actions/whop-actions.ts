"use server"; // Ensure this only runs on the server

import { getProfileByUserId, updateProfile, updateProfileByWhopUserId, getProfileByEmail, createProfile, deleteProfileById } from "@/db/queries/profiles-queries";
import { whopApp } from "@/lib/whop";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getPendingProfileByEmail, markPendingProfileAsClaimed, deletePendingProfile } from "@/db/queries/pending-profiles-queries";

// Convert Whop membership status to our app's membership status
const getMembershipStatus = (whopStatus: string): "free" | "pro" => {
  switch (whopStatus) {
    case "active":
      return "pro";
    default:
      return "free";
  }
};

// Update user profile with Whop customer data
// Follows same pattern as updateStripeCustomer for consistency
export const updateWhopCustomer = async (
  userId: string, 
  whopUserId: string, 
  whopMembershipId: string
): Promise<void> => {
  try {
    // Log the operation for audit purposes
    console.log(`Updating profile for user ${userId} with Whop customer data`);
    console.log(`Associating Clerk user ID: ${userId} with Whop user ID: ${whopUserId}`);
    
    if (!userId || !whopUserId || !whopMembershipId) {
      throw new Error("Missing required parameters for updateWhopCustomer");
    }

    // Update profile with Whop information
    const updatedProfile = await updateProfile(userId, {
      whopUserId,
      whopMembershipId,
      paymentProvider: "whop",
      membership: "pro" // Set to pro immediately after successful payment
    });
    
    if (!updatedProfile) {
      throw new Error("Failed to update profile with Whop customer data");
    }
    
    console.log(`Successfully updated profile for user ${userId} with Whop data`);
    
    // Revalidate any cached data
    revalidatePath("/");
    revalidatePath("/notes");
  } catch (error) {
    console.error("Error in updateWhopCustomer:", error);
    // Only log the error, don't throw it (same pattern as Stripe)
  }
};

// For compatibility with existing code
export const updateWhopUser = updateWhopCustomer;

// Handle membership status changes
export const manageWhopMembershipStatusChange = async (
  whopMembershipId: string,
  whopUserId: string,
  status: string
): Promise<void> => {
  try {
    // DEPRECATION WARNING
    console.warn("DEPRECATED: manageWhopMembershipStatusChange is deprecated due to connection timeouts");
    console.warn("Use direct updateProfile with Clerk user ID from metadata instead");
    
    // Log the membership status change for audit purposes
    console.log(`Processing membership status change for Whop user ${whopUserId}: status=${status}`);
    console.log("NOTE: This is using the Whop user ID (not a Clerk user ID) as a lookup key");
    
    if (!whopMembershipId || !whopUserId) {
      throw new Error("Missing required parameters for manageWhopMembershipStatusChange");
    }

    const membershipStatus = getMembershipStatus(status);
    
    // Attempt to find and update the profile
    // This uses a special lookup function that maps Whop user IDs to Clerk user IDs
    console.log(`Looking up profile by Whop user ID (fallback method): ${whopUserId}`);
    const updatedProfile = await updateProfileByWhopUserId(whopUserId, {
      whopMembershipId,
      membership: membershipStatus
    });
    
    if (!updatedProfile) {
      console.error(`No profile found with Whop user ID: ${whopUserId}`);
      console.error("This is a fallback method and should rarely be needed");
      console.error("Ensure Clerk user IDs are included in metadata for direct lookups");
    } else {
      console.log(`Successfully updated membership status to ${membershipStatus} for Clerk user ID: ${updatedProfile.userId}`);
      console.log(`This was found by looking up Whop user ID: ${whopUserId}`);
    }

    // Revalidate any cached data
    revalidatePath("/");
    revalidatePath("/notes");
  } catch (error) {
    console.error("Error in manageWhopMembershipStatusChange:", error);
    // Only log the error, don't throw it
  }
};

// Check if the current user can access a premium feature
export async function canAccessPremiumFeatures() {
  const { userId } = auth();
  
  if (!userId) {
    return false;
  }
  
  try {
    const profile = await getProfileByUserId(userId);
    return profile?.membership === "pro";
  } catch (error) {
    console.error("Error checking premium access:", error);
    return false;
  }
}

/**
 * FRICTIONLESS PAYMENT FLOW
 * 
 * The following functions support the "Pay First, Create Account Later" flow
 * where users can make a purchase with just their email address, then
 * later create an account and claim their purchase.
 */

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
    
    // IMPORTANT: We intentionally do NOT delete the pending profile.
    // Instead, we mark it as claimed and keep it for:
    // 1. Analytics and conversion tracking
    // 2. Audit trail for customer support
    // 3. Historical record of frictionless purchases
    console.log(`Preserving pending profile record for analytics and support`);
    
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
    console.log(`LEGACY FLOW: User ${userId} claiming old temporary profile`);
    
    if (pendingProfile.userId && pendingProfile.userId !== userId && !pendingProfile.userId.startsWith('temp_')) {
      console.log(`Profile for email ${email} is already claimed by user ${pendingProfile.userId}`);
      return { success: false, error: "This profile has already been claimed by another account" };
    }
    
    // If the user already has a profile, merge the pending profile's data into it
    const existingUserProfile = await getProfileByUserId(userId);
    
    if (existingUserProfile) {
      console.log(`LEGACY MERGE: User ${userId} already has a profile, merging temp profile data`);
      
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
      
      const updatedProfile = await updateProfile(userId, updateData);
      console.log(`Existing profile updated through legacy flow`);
      
      // Clean up the temporary profile
      try {
        if (pendingProfile.userId && pendingProfile.userId.startsWith('temp_')) {
          console.log(`Cleaning up temporary profile: ${pendingProfile.userId}`);
          const deleted = await deleteProfileById(pendingProfile.userId);
          console.log(`Temporary profile deletion result: ${deleted ? 'Success' : 'Failed'}`);
        }
      } catch (cleanupError) {
        console.error(`Failed to cleanup pending profile: ${cleanupError}`);
      }
    } else {
      // Create a new profile based on the temporary one
      console.log(`LEGACY CREATE: Creating new profile from temporary one`);
      
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
      
      const result = await createProfile(profileData);
      console.log(`New profile created through legacy flow`);
      
      // Clean up the temporary profile
      try {
        console.log(`Cleaning up temporary profile: ${pendingProfile.userId}`);
        const deleted = await deleteProfileById(pendingProfile.userId);
        console.log(`Temporary profile deletion result: ${deleted ? 'Success' : 'Failed'}`);
      } catch (cleanupError) {
        console.error(`Failed to cleanup temporary profile: ${cleanupError}`);
      }
    }
    
    // Revalidate paths
    revalidatePath("/");
    revalidatePath("/notes");
    revalidatePath("/dashboard");
    
    console.log(`Successfully claimed profile through legacy flow`);
    return { success: true };
  } catch (error) {
    console.error("Error in legacy profile claiming:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error claiming profile" 
    };
  }
} 