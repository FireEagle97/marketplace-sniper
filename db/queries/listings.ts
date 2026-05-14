"use server";

import { db } from "@/db/db";
import { listings, type Listing } from "@/db/schema/listings";
import { userListingStates } from "@/db/schema/userListingStates";
import { eq, and, ne, desc, asc, gte, lte, sql, count } from "drizzle-orm";

export async function getListingsByAlert(alertId: string): Promise<Listing[]> {
  return db
    .select()
    .from(listings)
    .where(eq(listings.alertId, alertId))
    .orderBy(desc(listings.scrapedAt));
}

export type ListingFeedParams = {
  userId: string;
  alertId?: string;
  excludeDismissed?: boolean; // default true
  minPrice?: number;
  maxPrice?: number;
  sort?: "newest" | "price_asc" | "price_desc";
  page?: number;
  pageSize?: number;
};

export type ListingWithState = Listing & { state: "new" | "saved" | "dismissed" };

export type ListingFeedResult = {
  listings: ListingWithState[];
  total: number;
  page: number;
  totalPages: number;
};

export async function getListingsFeed(params: ListingFeedParams): Promise<ListingFeedResult> {
  const {
    userId,
    alertId,
    excludeDismissed = true,
    minPrice,
    maxPrice,
    sort = "newest",
    page = 1,
    pageSize = 20,
  } = params;

  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (alertId) conditions.push(eq(listings.alertId, alertId));
  if (minPrice !== undefined) conditions.push(gte(listings.price, minPrice));
  if (maxPrice !== undefined) conditions.push(lte(listings.price, maxPrice));

  const orderBy =
    sort === "price_asc"
      ? asc(listings.price)
      : sort === "price_desc"
      ? desc(listings.price)
      : desc(listings.scrapedAt);

  // Left join user state, exclude dismissed when requested
  const stateCol = sql<"new" | "saved" | "dismissed">`coalesce(${userListingStates.state}, 'new')`;

  const whereConditions = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id:         listings.id,
      alertId:    listings.alertId,
      title:      listings.title,
      price:      listings.price,
      location:   listings.location,
      condition:  listings.condition,
      imageUrl:   listings.imageUrl,
      listingUrl: listings.listingUrl,
      postedAt:   listings.postedAt,
      scrapedAt:  listings.scrapedAt,
      state:      stateCol,
    })
    .from(listings)
    .leftJoin(
      userListingStates,
      and(
        eq(userListingStates.listingId, listings.id),
        eq(userListingStates.userId, userId)
      )
    )
    .where(
      excludeDismissed
        ? and(whereConditions, ne(userListingStates.state, "dismissed"))
        : whereConditions
    )
    .orderBy(orderBy)
    .limit(pageSize)
    .offset(offset);

  const totalRows = await db
    .select({ value: count() })
    .from(listings)
    .leftJoin(
      userListingStates,
      and(
        eq(userListingStates.listingId, listings.id),
        eq(userListingStates.userId, userId)
      )
    )
    .where(
      excludeDismissed
        ? and(whereConditions, ne(userListingStates.state, "dismissed"))
        : whereConditions
    );

  const total = totalRows[0]?.value ?? 0;

  return {
    listings: rows as ListingWithState[],
    total,
    page,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function upsertListingState(
  userId: string,
  listingId: string,
  state: "new" | "saved" | "dismissed"
): Promise<void> {
  await db
    .insert(userListingStates)
    .values({ userId, listingId, state, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [userListingStates.userId, userListingStates.listingId],
      set: { state, updatedAt: new Date() },
    });
}
