import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { updateAlert, deleteAlert } from "@/db/queries/alerts";

const patchAlertSchema = z
  .object({
    name: z.string().min(1).optional(),
    keywords: z.array(z.string().min(1)).min(1).optional(),
    location: z.string().min(1).optional(),
    minPrice: z.number().positive().nullable().optional(),
    maxPrice: z.number().positive().nullable().optional(),
    radiusMiles: z.number().int().positive().optional(),
    conditions: z.array(z.string()).optional(),
    frequency: z.enum(["daily", "weekly"]).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchAlertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const alert = await updateAlert(id, userId, parsed.data);
    if (!alert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }
    return NextResponse.json(alert);
  } catch (error) {
    console.error("PATCH /api/alerts/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await deleteAlert(id, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/alerts/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
