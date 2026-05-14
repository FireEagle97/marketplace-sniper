import { pgEnum, pgTable, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const membershipEnum = pgEnum("membership", ["free", "pro"]);
export const paymentProviderEnum = pgEnum("payment_provider", ["stripe", "whop"]);

export const profilesTable = pgTable("profiles", {
  userId: text("user_id").primaryKey().notNull(),
  email: text("email"),
  membership: membershipEnum("membership").notNull().default("free"),
  paymentProvider: paymentProviderEnum("payment_provider").default("whop"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  whopUserId: text("whop_user_id"),
  whopMembershipId: text("whop_membership_id"),
  planDuration: text("plan_duration"), // "monthly" or "yearly"
  // Billing cycle tracking
  billingCycleStart: timestamp("billing_cycle_start"),
  billingCycleEnd: timestamp("billing_cycle_end"),
  // Credit renewal tracking (separate from billing cycle for yearly plans)
  nextCreditRenewal: timestamp("next_credit_renewal"),
  // Usage credits tracking
  usageCredits: integer("usage_credits").default(0),
  usedCredits: integer("used_credits").default(0),
  // Subscription status tracking
  status: text("status").default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
}, (table) => {
  return {
    // Enable RLS on this table
    rls: sql`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`,
    
    // 1. Allow users to read only their own profile
    readPolicy: sql`
      CREATE POLICY "Users can only view their own profile" 
      ON ${table}
      FOR SELECT 
      USING (auth.uid()::text = user_id);
    `,
    
    // 2. Block direct writes from clients
    insertPolicy: sql`
      CREATE POLICY "Block direct client writes" 
      ON ${table}
      FOR INSERT 
      WITH CHECK (false);
    `,
    
    updatePolicy: sql`
      CREATE POLICY "Block direct client updates" 
      ON ${table}
      FOR UPDATE
      USING (false);
    `,
    
    deletePolicy: sql`
      CREATE POLICY "Block direct client deletes" 
      ON ${table}
      FOR DELETE
      USING (false);
    `,
    
    // 3. Create a bypass policy for service role
    serviceRolePolicy: sql`
      CREATE POLICY "Service role has full access" 
      ON ${table}
      USING (auth.role() = 'service_role');
    `,
  };
});

export type InsertProfile = typeof profilesTable.$inferInsert;
export type SelectProfile = typeof profilesTable.$inferSelect;
