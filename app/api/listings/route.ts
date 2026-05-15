import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getListingsFeed } from "@/db/queries/listings";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const alertId       = searchParams.get("alertId") ?? undefined;
  const showDismissed = searchParams.get("showDismissed") === "true";
  const minPrice      = searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : undefined;
  const maxPrice      = searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined;
  const sort          = (searchParams.get("sort") ?? "newest") as "newest" | "price_asc" | "price_desc";
  const page          = parseInt(searchParams.get("page") ?? "1", 10);

  try {
    const result = await getListingsFeed({
      userId,
      alertId,
      excludeDismissed: !showDismissed,
      minPrice,
      maxPrice,
      sort,
      page,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/listings error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
