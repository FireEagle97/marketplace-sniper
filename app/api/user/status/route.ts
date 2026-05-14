import { auth } from "@clerk/nextjs/server";
import { getProfileByUserId } from "@/db/queries/profiles-queries";
import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

// This API is now only used for occasional status checks
// The main cancellation flow happens through page revalidation
export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ status: null }, { status: 401 });
    }
    
    // Get profile info directly - no need for caching since polling is removed
    const profile = await getProfileByUserId(userId);
    
    // Return minimal profile data
    return NextResponse.json({
      status: profile?.status || null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error fetching user status:", error);
    return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 });
  }
} 