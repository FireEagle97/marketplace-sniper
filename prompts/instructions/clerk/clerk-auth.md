# Authentication System PRD: Clerk to Supabase Migration

## Current Authentication Architecture - Clerk

### Overview
The application currently uses Clerk for authentication, providing secure user management with minimal code. The system handles login, signup, session management, and protected routes.

### Key Components

#### 1. Authentication Flow
- **Sign-up Process**: Implemented in `app/(auth)/signup/[[...signup]]/page.tsx` using Clerk's `SignUp` component
- **Sign-in Process**: Implemented in `app/(auth)/login/[[...login]]/page.tsx` using Clerk's `SignIn` component
- **User Session**: Managed by Clerk, with authentication state accessible via Clerk's hooks and server functions
- **Redirect Logic**: Both flows redirect to "/notes" upon success via `forceRedirectUrl` prop

#### 2. Route Protection
- **Middleware Implementation**: `middleware.ts` uses `clerkMiddleware` to protect routes
- **Protected Routes**: All paths matching "/notes(.*)" require authentication
- **Redirect Behavior**: Unauthenticated users attempting to access protected routes are redirected to "/login"
- **Matcher Configuration**: Applied to all routes except static files and Next.js internals

#### 3. UI Components
- **Header Integration**: `components/header.tsx` includes Clerk's `SignInButton`, `UserButton`, and conditional rendering based on auth state using `SignedIn` and `SignedOut` components
- **Theme Adaptation**: Auth pages adapt to the application's theme preference (light/dark)
- **Auth Layout**: `app/(auth)/layout.tsx` provides centered layout for auth pages

#### 4. User Data & Profile Management
- **Profile Schema**: `db/schema/profiles-schema.ts` defines database structure for user profiles
- **Database Queries**: `db/queries/profiles-queries.ts` contains server functions for CRUD operations on profiles
- **Server Actions**: `actions/profiles-actions.ts` wraps queries with standardized error handling and response format
- **Profile Creation**: In `app/layout.tsx`, a profile is automatically created for new users after authentication

#### 5. Protected Content
- **Notes Page**: `app/notes/page.tsx` is protected both by middleware and additional auth checks
- **Membership Checks**: Access is further restricted based on the user's membership level

#### 6. Security Implementation
- **API Keys Management**: Environment variables (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`) stored securely
- **Client/Server Security**: Only public keys exposed to the client, secret keys used server-side
- **Environment Configuration**: Sign-in/sign-up URL paths configured via environment variables
- **JWT Handling**: Authentication tokens managed by Clerk, not requiring manual implementation

### Important Files

1. **Auth Pages**:
   - `app/(auth)/login/[[...login]]/page.tsx`
   - `app/(auth)/signup/[[...signup]]/page.tsx`
   - `app/(auth)/layout.tsx`

2. **Route Protection**:
   - `middleware.ts`

3. **App Configuration**:
   - `app/layout.tsx` (ClerkProvider, auto profile creation)
   - `.env.example` (auth environment variables)

4. **UI Components**:
   - `components/header.tsx` (auth UI elements)

5. **Data Management**:
   - `db/schema/profiles-schema.ts`
   - `db/queries/profiles-queries.ts`
   - `actions/profiles-actions.ts`

### Database & Drizzle ORM Integration

#### 1. Database Schema
- **Profiles Table**: Defined in `db/schema/profiles-schema.ts` using Drizzle's schema definition syntax
- **Schema Design**:
  ```typescript
  export const profilesTable = pgTable("profiles", {
    userId: text("user_id").primaryKey().notNull(),  // Links to Clerk's user ID
    membership: membershipEnum("membership").notNull().default("free"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date())
  });
  ```
- **Clerk Integration**: Uses Clerk's `userId` as the primary key to link profiles with authentication

#### 2. Database Connection
- **Setup**: Configured in `db/db.ts` using Postgres.js client with Drizzle ORM
  ```typescript
  import { drizzle } from "drizzle-orm/postgres-js";
  import postgres from "postgres";
  import { profilesTable } from "./schema";

  const schema = { profiles: profilesTable };
  const client = postgres(process.env.DATABASE_URL!);
  export const db = drizzle(client, { schema });
  ```
- **Environment**: Connects to PostgreSQL database using `DATABASE_URL` from environment variables

#### 3. Database Migrations
- **Configuration**: Defined in `drizzle.config.ts` in the project root
- **Commands**: Managed via npm scripts in `package.json`
  ```json
  "scripts": {
    "db:generate": "npx drizzle-kit generate",
    "db:migrate": "npx drizzle-kit migrate"
  }
  ```

#### 4. Profile Management Flow
- **Creation**: New profile automatically created on first sign-in in `app/layout.tsx`:
  ```typescript
  const { userId } = auth();
  if (userId) {
    const res = await getProfileByUserIdAction(userId);
    if (!res.data) {
      await createProfile({ userId });
    }
  }
  ```
- **Query Layer**: Server functions in `db/queries/profiles-queries.ts` handle direct database operations
- **Action Layer**: Server actions in `actions/profiles-actions.ts` provide standardized interfaces with error handling

## Migration Plan: Clerk to Supabase

### Key Migration Areas

#### 1. Authentication Provider
- **Replace ClerkProvider**: Remove ClerkProvider from `app/layout.tsx`
- **Add Supabase Auth Provider**: Implement Supabase Auth provider wrapper

#### 2. Authentication Components
- **Replace Clerk Components**: `SignIn`, `SignUp`, `UserButton`, `SignInButton`
- **Implement Supabase Auth UI**: Create custom components or use Supabase Auth UI library
- **Google OAuth**: Implement Google sign-in functionality

#### 3. Route Protection
- **Middleware Replacement**: Replace Clerk middleware with Supabase session-based middleware
- **Session Management**: Implement Supabase session management

#### 4. API & Database
- **Profile Management**: Adapt profile creation and management to work with Supabase Auth
- **User ID Integration**: Update references from Clerk's userId to Supabase user IDs
- **Database Schema**: Potentially modify schema to align with Supabase Auth user model

#### 5. Environment Variables
- **Remove Clerk Variables**: Remove all Clerk-related environment variables
- **Add Supabase Variables**: Add Supabase URL, anon key, service role key

### Files Requiring Modification

1. **Auth System**:
   - `middleware.ts` (complete rewrite for Supabase session checking)
   - `app/(auth)/login/[[...login]]/page.tsx` (implement Supabase Auth UI)
   - `app/(auth)/signup/[[...signup]]/page.tsx` (implement Supabase Auth UI)
   - `app/layout.tsx` (replace ClerkProvider with Supabase provider)

2. **Components**:
   - `components/header.tsx` (replace Clerk UI components)
   - Create new auth utility hooks for Supabase

3. **Data Management**:
   - Update profile creation logic to work with Supabase Auth
   - Potentially modify user ID references across the application

4. **Configuration**:
   - Update `.env` with Supabase credentials
   - Update any build configuration that might reference Clerk

### Database Migration Strategy

#### 1. User Data Transfer
- **Create Migration Script**: Develop a script to map Clerk user IDs to Supabase user IDs
- **Profile Data Migration**:
  ```typescript
  // Example migration logic
  for (const profile of clerkProfiles) {
    const supabaseUser = await createSupabaseUser(profile.email);
    await updateProfile(profile.userId, { userId: supabaseUser.id });
  }
  ```

#### 2. Schema Adaptation for Supabase
- **Update Profiles Table**:
  ```typescript
  export const profilesTable = pgTable("profiles", {
    // Change from Clerk userId to Supabase UUID format
    userId: uuid("user_id").primaryKey().notNull(),
    // ... rest of the schema remains similar
  });
  ```
- **Leverage Supabase Auth Tables**: Utilize built-in Supabase `auth.users` table for user data
- **Link Profiles to Auth**: Update foreign key references to link with Supabase auth tables

#### 3. Drizzle with Supabase Integration
- **Supabase Client**: Replace direct Postgres connection with Supabase client in `db/db.ts`
  ```typescript
  import { createClient } from '@supabase/supabase-js';
  import { drizzle } from 'drizzle-orm/supabase-js';
  
  const supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  export const db = drizzle(supabaseClient);
  ```
- **Query Adjustments**: Modify queries to respect Supabase RLS policies and use appropriate client

### Security Considerations for Supabase Implementation

1. **API Key Management**:
   - Keep `service_role_key` server-side only
   - Use `anon_key` for client-side requests with RLS policies

2. **Row Level Security (RLS)**:
   - **Profile Table RLS**: Implement policies to restrict access to user's own profile
     ```sql
     CREATE POLICY "Users can view their own profile"
       ON profiles
       FOR SELECT
       USING (auth.uid() = user_id);
     
     CREATE POLICY "Users can update their own profile"
       ON profiles
       FOR UPDATE
       USING (auth.uid() = user_id);
     ```
   - Create specific policies for profiles and other user-specific data

3. **Auth Hooks Implementation**:
   - Create secure server-side auth checking mechanisms
   - Implement client-side hooks for auth state

4. **Session Management**:
   - Configure appropriate session timeouts
   - Implement secure session refreshing

5. **OAuth Configuration**:
   - Securely set up Google OAuth in Supabase dashboard
   - Configure proper callback URLs and scopes

## Technical Implementation Strategy

1. **Setup Supabase Project**:
   - Create Supabase project
   - Configure authentication providers (email/password, Google)
   - Set up database tables and RLS policies

2. **Auth Components Development**:
   - Develop sign-up, sign-in, and user account components
   - Implement Google OAuth flow

3. **Middleware & Protection**:
   - Create Supabase session-checking middleware
   - Implement protected route strategy

4. **Profile Integration**:
   - Adapt profile creation/management for Supabase user IDs
   - Update queries to work with Supabase Auth

5. **Testing Plan**:
   - Test authentication flows (signup, login, logout)
   - Test protected routes
   - Test profile creation and management
   - Test Google OAuth integration

6. **Data Migration Execution**:
   - Develop and test migration scripts
   - Execute user data migration
   - Verify data integrity post-migration

By following this migration plan, the application can be transitioned from Clerk to Supabase Auth while maintaining security and functionality.
