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