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
  const results = await db.select().from(pendingProfilesTable).where(eq(pendingProfilesTable.email, email));
  return results[0];
};

// Get unclaimed pending profiles
export const getUnclaimedPendingProfiles = async (): Promise<SelectPendingProfile[]> => {
  return db.select().from(pendingProfilesTable).where(eq(pendingProfilesTable.claimed, false));
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