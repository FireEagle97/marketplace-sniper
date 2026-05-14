# New Table Instructions

Follow these instructions to create a new table in the database.

## Schema Organization

To keep our database organized, we use different schemas for different parts of the application.

-   **Public Schema (default):** For general-purpose tables like `profiles`, `projects`, etc.
    -   Schema files go in: `db/schema/`
    -   Query files go in: `db/queries/`
-   **Validation Schema:** For tables related to idea validation features (e.g., Reddit analysis, keyword validation).
    -   Schema files go in: `db/schema/validation/`
    -   Query files go in: `db/queries/validation/`

When creating a new table, first decide which schema it belongs to.

## Guidelines

- User ids should be like this `userId: text("user_id").notNull()` because we user Clerk

## Step 1: Create the Schema

### Option A: Table in the `public` Schema (Default)

This file should be named like `profiles-schema.ts` and placed in the `db/schema/` folder.

The table is created using `pgTable`, which places it in the default `public` schema.

```typescript:db/schema/profiles-schema.ts
import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const membershipEnum = pgEnum("membership", ["free", "pro"]);

export const profilesTable = pgTable("profiles", {
  userId: text("user_id").primaryKey().notNull(),
  membership: membershipEnum("membership").default("free").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
});

export type InsertProfile = typeof profilesTable.$inferInsert;
export type SelectProfile = typeof profilesTable.$inferSelect;
```

### Option B: Table in the `validation` Schema

This file should be named like `reddit-posts-schema.ts` and placed in the `db/schema/validation/` folder.

To place a table in a specific schema, first define the schema using `pgSchema`, then create the table using `yourSchema.table()`.

```typescript:db/schema/validation/reddit-posts-schema.ts
import { integer, pgEnum, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { projectsTable } from "../projects-schema";

// Create or reference the schema for validation features
export const validationSchema = pgSchema("validation");

export const redditPostsTable = validationSchema.table("reddit_posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  // ... other columns
});
```

**CRITICAL: After creating any schema file, you MUST export it from `db/schema/index.ts` or the application will fail to build in production.**

```typescript
// Add this line to db/schema/index.ts
export * from "./your-new-schema-file";
```

Our database configuration uses `import * as schema from './schema'` which requires all tables to be exported from the index file. Missing exports will cause deployment failures.

## Step 2: Create the Queries

The location of your query file should match the location of your schema file.

-   For `public` schema tables, query files go in `db/queries/`.
-   For `validation` schema tables, query files go in `db/queries/validation/`.

The code inside the query file remains the same, just ensure your imports point to the correct schema file location.

```typescript:db/queries/validation/reddit-posts-queries.ts
import { eq } from "drizzle-orm";
import { db } from "@/db/db";
// Note the updated path to the schema file
import { InsertRedditPost, redditPostsTable, SelectRedditPost } from "@/db/schema/validation/reddit-posts-schema";

export const createRedditPost = async (data: InsertRedditPost) => {
  // ... query logic
};
```

## Step 3: Create the Actions

This is an example of how to create the actions for the table.

This file should be named like `profiles-actions.ts`.

**CRITICAL TYPE SAFETY REQUIREMENT**: All action functions MUST specify the data type for `ActionState<T>`. Using generic `ActionState` without a type parameter will cause production build failures.

```typescript
// ✅ CORRECT: Always specify the data type
Promise<ActionState<SelectProfile>>
Promise<ActionState<SelectProfile[]>>
Promise<ActionState<void>>

// ❌ WRONG: Will cause deployment errors
Promise<ActionState>
```

```typescript
"use server";

import { createProfile, deleteProfile, getAllProfiles, getProfileByUserId, updateProfile } from "@/db/queries/profiles-queries";
import { InsertProfile, SelectProfile } from "@/db/schema/profiles-schema";
import { ActionState } from "@/types";
import console from "console";
import { revalidatePath } from "next/cache";

export async function createProfileAction(data: InsertProfile): Promise<ActionState<SelectProfile>> {
  try {
    const newProfile = await createProfile(data);
    console.log("New profile created", newProfile);
    revalidatePath("/");
    return { status: "success", message: "Profile created successfully", data: newProfile };
  } catch (error) {
    return { status: "error", message: "Error creating profile" };
  }
}

export async function getProfileByUserIdAction(userId: string): Promise<ActionState<SelectProfile | null>> {
  try {
    const profile = await getProfileByUserId(userId);
    if (!profile) {
      return { status: "error", message: "Profile not found" };
    }
    return { status: "success", message: "Profile retrieved successfully", data: profile };
  } catch (error) {
    return { status: "error", message: "Failed to get profile" };
  }
}

export async function getAllProfilesAction(): Promise<ActionState<SelectProfile[]>> {
  try {
    const profiles = await getAllProfiles();
    return { status: "success", message: "Profiles retrieved successfully", data: profiles };
  } catch (error) {
    return { status: "error", message: "Failed to get profiles" };
  }
}

export async function updateProfileAction(userId: string, data: Partial<InsertProfile>): Promise<ActionState<SelectProfile>> {
  try {
    const updatedProfile = await updateProfile(userId, data);
    revalidatePath("/profile");
    return { status: "success", message: "Profile updated successfully", data: updatedProfile };
  } catch (error) {
    return { status: "error", message: "Failed to update profile" };
  }
}

export async function deleteProfileAction(userId: string): Promise<ActionState<void>> {
  try {
    await deleteProfile(userId);
    revalidatePath("/profile");
    return { status: "success", message: "Profile deleted successfully" };
  } catch (error) {
    return { status: "error", message: "Failed to delete profile" };
  }
}
```

## Step 4: Generate the SQL file and Migrate the DB

```bash
npm run db:generate
npm run db:migrate
```

## Step 4.5: Test Type Safety Before Deployment

**ALWAYS** run these commands after creating/modifying schemas to catch type errors:

```bash
# Check TypeScript compilation
npx tsc --noEmit

# Run production build (catches deployment errors)
npm run build

# Run linting
npm run lint
```

If any of these fail, fix the errors before deploying. Production builds are stricter than development.

## Step 5: Secure the Table with Row Level Security (RLS)

When applying RLS to a table in a specific schema, you must prefix the table name with the schema name.

**Important:** Execute these SQL commands in your Supabase SQL editor.

1.  **Enable RLS on your table:**
    Replace `your_table_name` with the actual name of your table. For a table in a schema, use `schema_name.table_name`.

    ```sql
    -- For a table in the public schema
    ALTER TABLE public.your_table_name ENABLE ROW LEVEL SECURITY;

    -- For a table in the validation schema
    ALTER TABLE validation.your_table_name ENABLE ROW LEVEL SECURITY;
    ```

2.  **Policy for SELECT operations:**

    ```sql
    -- Example for a table in the validation schema
    CREATE POLICY "Allow individual select access on validation" 
    ON validation.your_table_name
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 
        FROM public.projects -- Assumes projects table is in public
        WHERE projects.id = validation.your_table_name.project_id 
        AND projects.user_id = auth.uid()
      )
    );
    ```

3.  **Policy for INSERT operations:**
    Allows authenticated users to insert new records, automatically associating the record with their `user_id`. Replace `your_table_name` and `user_id_column`.

    ```sql
    CREATE POLICY "Allow individual insert access" 
    ON your_table_name 
    FOR INSERT
    WITH CHECK (auth.uid() = user_id_column);
    ```

4.  **Policy for UPDATE operations:**
    Allows authenticated users to update only their own existing records. Replace `your_table_name` and `user_id_column`.

    ```sql
    CREATE POLICY "Allow individual update access" 
    ON your_table_name 
    FOR UPDATE
    USING (auth.uid() = user_id_column) 
    WITH CHECK (auth.uid() = user_id_column);
    ```

5.  **Policy for DELETE operations:**
    Allows authenticated users to delete only their own records. Replace `your_table_name` and `user_id_column`.

    ```sql
    CREATE POLICY "Allow individual delete access" 
    ON your_table_name 
    FOR DELETE
    USING (auth.uid() = user_id_column);
    ```

**Notes on RLS:**

*   **`auth.uid()`**: This Supabase function returns the ID of the currently authenticated user.
*   **`auth.role()`**: This can be used to check roles, e.g., `auth.role() = 'authenticated'` or `auth.role() = 'anon'`.
*   **Specificity is Key**: The policies above are common for user-owned data. Adjust them based on your application's specific requirements. For example:
    *   Some tables might allow all authenticated users to read all data (`USING (auth.role() = 'authenticated')`).
    *   Some public data tables might allow anonymous read access (`FOR SELECT USING (auth.role() = 'anon' OR auth.role() = 'authenticated')`).
    *   The `webinar_analytics` table, for instance, has a policy to allow anonymous inserts: `CREATE POLICY "Allow public insert access for webinar analytics" ON webinar_analytics FOR INSERT WITH CHECK (true);`
*   **Default Deny**: Once RLS is enabled, access is denied unless a policy explicitly grants it. Ensure you have policies for all intended operations.
*   **Test Thoroughly**: After implementing RLS policies, test them rigorously to ensure they behave as expected and don't inadvertently block legitimate access or allow unauthorized access.