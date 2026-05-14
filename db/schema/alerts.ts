import { pgTable, text, integer, real, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const frequencyEnum = pgEnum("frequency", ["daily", "weekly"]);

export const alerts = pgTable("alerts", {
  id:            text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId:        text("user_id").notNull(),
  name:          text("name").notNull(),
  keywords:      text("keywords").array().notNull(),
  minPrice:      real("min_price"),
  maxPrice:      real("max_price"),
  location:      text("location").notNull(),
  radiusMiles:   integer("radius_miles").notNull().default(25),
  conditions:    text("conditions").array().notNull().default([]),
  frequency:     frequencyEnum("frequency").notNull().default("daily"),
  isActive:      boolean("is_active").notNull().default(true),
  lastScrapedAt: timestamp("last_scraped_at"),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
  updatedAt:     timestamp("updated_at").notNull().defaultNow(),
});

export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;
