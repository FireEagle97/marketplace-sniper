import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const digestLogs = pgTable("digest_logs", {
  id:           text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId:       text("user_id").notNull(),
  alertId:      text("alert_id").notNull(),
  sentAt:       timestamp("sent_at").notNull().defaultNow(),
  listingCount: integer("listing_count").notNull(),
  status:       text("status").notNull(), // "sent" | "skipped_no_matches" | "failed"
});
