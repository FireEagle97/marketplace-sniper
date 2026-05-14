/**
 * Dashboard layout for Template App
 * This layout removes the global header from all dashboard pages
 * and applies the dashboard-specific styling
 */
import React, { ReactNode } from "react";
import { getProfileByUserId, updateProfile } from "@/db/queries/profiles-queries";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/sidebar";
import { revalidatePath } from "next/cache";
import CancellationPopup from "@/components/cancellation-popup";
import WelcomeMessagePopup from "@/components/welcome-message-popup";
import PaymentSuccessPopup from "@/components/payment-success-popup";

/**
 * Check if a free user with an expired billing cycle needs their credits downgraded
 * This function handles users who canceled their subscription but still have pro-level credits
 * When their billing cycle ends, we reduce their credit allowance to the free tier level
 */
async function checkExpiredSubscriptionCredits(profile: any | null): Promise<any | null> {
  if (!profile) return profile;

  // Only check free users with billing cycle info (canceled subscriptions)
  if (profile.membership === "free" && profile.billingCycleEnd) {
    const billingCycleEnd = new Date(profile.billingCycleEnd);
    const now = new Date();
    
    // If billing cycle ended and they still have pro-level credits
    if (now > billingCycleEnd && (profile.usageCredits || 0) > 5) {
      console.log(`User ${profile.userId} has expired billing cycle, downgrading credits to free tier`);
      
      // Set up the update data
      const updateData: any = {
        usageCredits: 5,
        usedCredits: 0,  // Reset to 0 for a clean slate
        status: "canceled" // Update status to reflect canceled subscription
      };
      
      // If they don't have a nextCreditRenewal date, set one
      if (!profile.nextCreditRenewal) {
        const nextRenewal = new Date();
        nextRenewal.setDate(nextRenewal.getDate() + 28); // 4 weeks from now
        updateData.nextCreditRenewal = nextRenewal;
      }
      
      // We keep the billingCycleEnd to remember when they canceled
      // but we'll no longer check it after this point
      
      // Update profile with free tier credit limit
      const updatedProfile = await updateProfile(profile.userId, updateData);
      
      // Revalidate pages that display credit information
      revalidatePath("/dashboard");
      revalidatePath("/notes");
      
      return updatedProfile;
    }
  }
  
  return profile;
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Fetch user profile once at the layout level
  const { userId } = auth();

  if (!userId) {
    return redirect("/login");
  }

  let profile = await getProfileByUserId(userId);

  if (!profile) {
    return redirect("/signup");
  }

  // Run just-in-time credit check for expired subscriptions
  profile = await checkExpiredSubscriptionCredits(profile);
  
  // Verify profile is still valid after check
  if (!profile) {
    return redirect("/signup");
  }

  // Get the current user to extract email
  const user = await currentUser();
  const userEmail = user?.emailAddresses?.[0]?.emailAddress || "";
  
  // Log profile details for debugging
  console.log('Dashboard profile:', {
    userId: profile.userId,
    membership: profile.membership,
    createdAt: profile.createdAt,
    usageCredits: profile.usageCredits
  });

  return (
    <div className="flex h-screen bg-gray-50 relative overflow-hidden">
      {/* Show welcome message popup - component handles visibility logic */}
      <WelcomeMessagePopup profile={profile} />
      
      {/* Show payment success popup - component handles visibility logic */}
      <PaymentSuccessPopup profile={profile} />
      
      {/* Show cancellation popup directly if status is canceled */}
      {profile.status === "canceled" && (
        <CancellationPopup profile={profile} />
      )}
      
      {/* Sidebar component with profile data and user email */}
      <Sidebar 
        profile={profile} 
        userEmail={userEmail} 
        whopMonthlyPlanId={process.env.WHOP_PLAN_ID_MONTHLY || ''}
        whopYearlyPlanId={process.env.WHOP_PLAN_ID_YEARLY || ''}
      />
      
      {/* Main content area */}
      <div className="flex-1 overflow-auto relative">
        {children}
      </div>
    </div>
  );
} 