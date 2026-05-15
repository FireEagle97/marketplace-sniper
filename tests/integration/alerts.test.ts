import { describe, it, expect, afterEach, vi } from "vitest";
import { seedAlert, cleanupUser } from "../helpers/db";

const TEST_USER = "test_user_alerts_001";

// vi.mock is hoisted above imports by Vitest, so these mocks are active
// when the route modules are first imported below.
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: TEST_USER }),
  currentUser: async () => ({
    id: TEST_USER,
    emailAddresses: [{ emailAddress: `${TEST_USER}@test.com` }],
    publicMetadata: { plan: "free" },
  }),
}));

vi.mock("@/lib/queue", () => ({
  getScrapeQueue: () => ({ add: vi.fn() }),
  buildScrapeJobData: vi.fn((alert: { id: string; userId: string }) => ({
    alertId: alert.id,
    userId: alert.userId,
  })),
}));

import { GET, POST } from "@/app/api/alerts/route";
import { PATCH, DELETE } from "@/app/api/alerts/[id]/route";

const BASE = "http://localhost/api/alerts";

const validBody = {
  name: "Test Alert",
  keywords: ["ps5"],
  location: "montreal",
  radiusMiles: 25,
  conditions: [],
  frequency: "daily" as const,
};

afterEach(() => cleanupUser(TEST_USER));

// ─── GET /api/alerts ──────────────────────────────────────────────────────────

describe("GET /api/alerts", () => {
  it("returns empty array for new user", async () => {
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });

  it("returns seeded alerts for user", async () => {
    await seedAlert(TEST_USER, { name: "My Alert" });
    const res = await GET();
    const body = await res.json();
    expect(body.length).toBe(1);
    expect(body[0].name).toBe("My Alert");
  });
});

// ─── POST /api/alerts ─────────────────────────────────────────────────────────

describe("POST /api/alerts", () => {
  function postReq(body: object) {
    return new Request(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("creates alert and returns 201", async () => {
    const res = await POST(postReq(validBody));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.name).toBe("Test Alert");
    expect(body.keywords).toEqual(["ps5"]);
  });

  it("returns 422 when keywords is empty", async () => {
    const res = await POST(postReq({ ...validBody, keywords: [] }));
    expect(res.status).toBe(422);
  });

  it("returns 422 when location is missing", async () => {
    const res = await POST(postReq({ ...validBody, location: "" }));
    expect(res.status).toBe(422);
  });

  it("blocks free user at 3 alerts with UPGRADE_REQUIRED", async () => {
    await seedAlert(TEST_USER);
    await seedAlert(TEST_USER);
    await seedAlert(TEST_USER);

    const res = await POST(postReq({ ...validBody, name: "Alert 4" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("UPGRADE_REQUIRED");
  });
});

// ─── PATCH /api/alerts/[id] ───────────────────────────────────────────────────

describe("PATCH /api/alerts/[id]", () => {
  function patchReq(id: string, body: object) {
    return new Request(`${BASE}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("updates alert name", async () => {
    const alert = await seedAlert(TEST_USER, { name: "Original" });
    const res = await PATCH(patchReq(alert.id, { name: "Updated" }), {
      params: Promise.resolve({ id: alert.id }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.name).toBe("Updated");
  });

  it("toggles isActive to false", async () => {
    const alert = await seedAlert(TEST_USER);
    const res = await PATCH(patchReq(alert.id, { isActive: false }), {
      params: Promise.resolve({ id: alert.id }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.isActive).toBe(false);
  });

  it("returns 404 for non-existent alert", async () => {
    const res = await PATCH(patchReq("nonexistent-id", { name: "X" }), {
      params: Promise.resolve({ id: "nonexistent-id" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for empty body", async () => {
    const alert = await seedAlert(TEST_USER);
    const res = await PATCH(patchReq(alert.id, {}), {
      params: Promise.resolve({ id: alert.id }),
    });
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /api/alerts/[id] ──────────────────────────────────────────────────

describe("DELETE /api/alerts/[id]", () => {
  function deleteReq(id: string) {
    return new Request(`${BASE}/${id}`, { method: "DELETE" });
  }

  it("deletes alert and returns success", async () => {
    const alert = await seedAlert(TEST_USER);
    const res = await DELETE(deleteReq(alert.id), {
      params: Promise.resolve({ id: alert.id }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("is idempotent — deleting twice returns 200 both times", async () => {
    const alert = await seedAlert(TEST_USER);
    const res1 = await DELETE(deleteReq(alert.id), {
      params: Promise.resolve({ id: alert.id }),
    });
    const res2 = await DELETE(deleteReq(alert.id), {
      params: Promise.resolve({ id: alert.id }),
    });
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });

  it("deleted alert no longer appears in GET", async () => {
    const alert = await seedAlert(TEST_USER);
    await DELETE(deleteReq(alert.id), {
      params: Promise.resolve({ id: alert.id }),
    });
    const res = await GET();
    const body = await res.json();
    expect(body.find((a: { id: string }) => a.id === alert.id)).toBeUndefined();
  });
});
