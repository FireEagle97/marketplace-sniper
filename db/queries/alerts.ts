"use server";

import { db } from "@/db/db";
import { alerts, type Alert, type NewAlert } from "@/db/schema/alerts";
import { eq, and, count } from "drizzle-orm";

export async function getAlertsByUser(userId: string): Promise<Alert[]> {
  return db.select().from(alerts).where(eq(alerts.userId, userId));
}

export async function getAlertById(alertId: string): Promise<Alert | undefined> {
  const rows = await db.select().from(alerts).where(eq(alerts.id, alertId));
  return rows[0];
}

export async function getActiveAlerts(): Promise<Alert[]> {
  return db.select().from(alerts).where(eq(alerts.isActive, true));
}

export async function countAlertsByUser(userId: string): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(alerts)
    .where(and(eq(alerts.userId, userId), eq(alerts.isActive, true)));
  return rows[0]?.value ?? 0;
}

export async function createAlert(data: NewAlert): Promise<Alert> {
  const rows = await db.insert(alerts).values(data).returning();
  return rows[0];
}

export async function updateAlert(
  alertId: string,
  userId: string,
  data: Partial<Omit<NewAlert, "id" | "userId" | "createdAt">>
): Promise<Alert | undefined> {
  const rows = await db
    .update(alerts)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(alerts.id, alertId), eq(alerts.userId, userId)))
    .returning();
  return rows[0];
}

export async function deleteAlert(alertId: string, userId: string): Promise<void> {
  await db
    .delete(alerts)
    .where(and(eq(alerts.id, alertId), eq(alerts.userId, userId)));
}
