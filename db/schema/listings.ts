import { pgTable, text, real, timestamp, unique } from "drizzle-orm/pg-core";

export const listings = pgTable("listings", {
  id:         text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  alertId:    text("alert_id").notNull(),
  title:      text("title").notNull(),
  price:      real("price"),
  location:   text("location"),
  condition:  text("condition"),
  imageUrl:   text("image_url"),
  listingUrl: text("listing_url").notNull(),
  postedAt:   timestamp("posted_at"),
  scrapedAt:  timestamp("scraped_at").notNull().defaultNow(),
}, (t) => ({
  dedup: unique().on(t.alertId, t.listingUrl),
}));

export type Listing = typeof listings.$inferSelect;
