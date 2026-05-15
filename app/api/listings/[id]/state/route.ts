import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { upsertListingState } from "@/db/queries/listings";

const schema = z.object({
  state: z.enum(["new", "saved", "dismissed"]),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  try {
    await upsertListingState(userId, id, parsed.data.state);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/listings/[id]/state error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
