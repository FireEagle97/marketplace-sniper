import { db } from "@/db/db";
import { alerts } from "@/db/schema/alerts";
import { eq } from "drizzle-orm";

export async function seedAlert(userId: string, overrides: Record<string, unknown> = {}) {
  const [alert] = await db
    .insert(alerts)
    .values({
      userId,
      name: "Test Alert",
      keywords: ["test"],
      location: "montreal",
      radiusMiles: 25,
      conditions: [],
      frequency: "daily",
      isActive: true,
      ...overrides,
    })
    .returning();
  return alert;
}

export async function cleanupUser(userId: string) {
  await db.delete(alerts).where(eq(alerts.userId, userId));
}
