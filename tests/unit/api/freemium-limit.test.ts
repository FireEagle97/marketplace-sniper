import { describe, it, expect } from "vitest";
import { canCreateAlert } from "@/lib/freemium";

describe("canCreateAlert", () => {
  it("allows free user with 0 alerts", () => {
    expect(canCreateAlert({ plan: "free", alertCount: 0 })).toBe(true);
  });

  it("allows free user with 2 alerts", () => {
    expect(canCreateAlert({ plan: "free", alertCount: 2 })).toBe(true);
  });

  it("blocks free user at 3 alerts", () => {
    expect(canCreateAlert({ plan: "free", alertCount: 3 })).toBe(false);
  });

  it("blocks free user above 3 alerts", () => {
    expect(canCreateAlert({ plan: "free", alertCount: 10 })).toBe(false);
  });

  it("allows paid user with 100 alerts", () => {
    expect(canCreateAlert({ plan: "paid", alertCount: 100 })).toBe(true);
  });

  it("allows paid user with 0 alerts", () => {
    expect(canCreateAlert({ plan: "paid", alertCount: 0 })).toBe(true);
  });
});
