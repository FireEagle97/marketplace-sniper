import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getAlertsByUser,
  countAlertsByUser,
  createAlert,
} from "@/db/queries/alerts";
import { getScrapeQueue, buildScrapeJobData } from "@/lib/queue";

const FREE_ALERT_LIMIT = 3;

const createAlertSchema = z.object({
  name: z.string().min(1, "Name is required"),
  keywords: z.array(z.string().min(1)).min(1, "At least one keyword is required"),
  location: z.string().min(1, "Location is required"),
  minPrice: z.number().positive().nullable().optional(),
  maxPrice: z.number().positive().nullable().optional(),
  radiusMiles: z.number().int().positive().optional(),
  conditions: z.array(z.string()).optional(),
  frequency: z.enum(["daily", "weekly"]).optional(),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const alerts = await getAlertsByUser(userId);
    return NextResponse.json(alerts);
  } catch (error) {
    console.error("GET /api/alerts error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const isPaid = user?.publicMetadata?.plan === "paid";

  if (!isPaid) {
    const count = await countAlertsByUser(userId);
    if (count >= FREE_ALERT_LIMIT) {
      return NextResponse.json(
        { error: "UPGRADE_REQUIRED" },
        { status: 403 }
      );
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createAlertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const data = parsed.data;

  try {
    const alert = await createAlert({
      userId,
      name: data.name,
      keywords: data.keywords,
      location: data.location,
      minPrice: data.minPrice ?? null,
      maxPrice: data.maxPrice ?? null,
      radiusMiles: data.radiusMiles ?? 25,
      conditions: data.conditions ?? [],
      frequency: data.frequency ?? "daily",
      isActive: true,
    });

    try {
      const queue = getScrapeQueue();
      await queue.add("scrape", buildScrapeJobData(alert));
    } catch (queueError) {
      console.error("Failed to enqueue scrape job:", queueError);
    }

    return NextResponse.json(alert, { status: 201 });
  } catch (error) {
    console.error("POST /api/alerts error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
