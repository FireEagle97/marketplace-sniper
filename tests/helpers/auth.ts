import { vi } from "vitest";

export function mockAuth(userId: string, plan: "free" | "paid" = "free") {
  vi.mock("@clerk/nextjs/server", () => ({
    auth: async () => ({ userId }),
    currentUser: async () => ({
      id: userId,
      emailAddresses: [{ emailAddress: `${userId}@test.com` }],
      publicMetadata: { plan },
    }),
    clerkClient: async () => ({
      users: {
        updateUserMetadata: vi.fn(),
      },
    }),
  }));
}
