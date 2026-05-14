CREATE TYPE "public"."membership" AS ENUM('free', 'pro');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('stripe', 'whop');--> statement-breakpoint
CREATE TYPE "public"."frequency" AS ENUM('daily', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."listing_state" AS ENUM('new', 'saved', 'dismissed');--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"email" text,
	"membership" "membership" DEFAULT 'free' NOT NULL,
	"payment_provider" "payment_provider" DEFAULT 'whop',
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"whop_user_id" text,
	"whop_membership_id" text,
	"plan_duration" text,
	"billing_cycle_start" timestamp,
	"billing_cycle_end" timestamp,
	"next_credit_renewal" timestamp,
	"usage_credits" integer DEFAULT 0,
	"used_credits" integer DEFAULT 0,
	"status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"token" text,
	"membership" "membership" DEFAULT 'pro' NOT NULL,
	"payment_provider" "payment_provider" DEFAULT 'whop',
	"whop_user_id" text,
	"whop_membership_id" text,
	"plan_duration" text,
	"billing_cycle_start" timestamp,
	"billing_cycle_end" timestamp,
	"next_credit_renewal" timestamp,
	"usage_credits" integer DEFAULT 0,
	"used_credits" integer DEFAULT 0,
	"claimed" boolean DEFAULT false,
	"claimed_by_user_id" text,
	"claimed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pending_profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"keywords" text[] NOT NULL,
	"min_price" real,
	"max_price" real,
	"location" text NOT NULL,
	"radius_miles" integer DEFAULT 25 NOT NULL,
	"conditions" text[] DEFAULT '{}' NOT NULL,
	"frequency" "frequency" DEFAULT 'daily' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_scraped_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" text PRIMARY KEY NOT NULL,
	"alert_id" text NOT NULL,
	"title" text NOT NULL,
	"price" real,
	"location" text,
	"condition" text,
	"image_url" text,
	"listing_url" text NOT NULL,
	"posted_at" timestamp,
	"scraped_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "listings_alert_id_listing_url_unique" UNIQUE("alert_id","listing_url")
);
--> statement-breakpoint
CREATE TABLE "user_listing_states" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"state" "listing_state" DEFAULT 'new' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_listing_states_user_id_listing_id_unique" UNIQUE("user_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "digest_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"alert_id" text NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"listing_count" integer NOT NULL,
	"status" text NOT NULL
);
