import { pgTable, text, timestamp, pgEnum, unique } from "drizzle-orm/pg-core";

export const listingStateEnum = pgEnum("listing_state", ["new", "saved", "dismissed"]);

export const userListingStates = pgTable("user_listing_states", {
  id:        text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId:    text("user_id").notNull(),
  listingId: text("listing_id").notNull(),
  state:     listingStateEnum("state").notNull().default("new"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  uniq: unique().on(t.userId, t.listingId),
}));
