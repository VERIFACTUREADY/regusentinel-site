import { describe, it, expect } from "vitest";

// Inline copy of the ISD bucket ladder from lib/notifications.ts.
// Keep both in sync when changing thresholds.
type NotificationKind =
  | "ISD_60D" | "ISD_30D" | "ISD_7D" | "ISD_1D" | "ISD_PASSED";

function isdBucketFor(daysRemaining: number): NotificationKind | null {
  if (daysRemaining < 0) return "ISD_PASSED";
  if (daysRemaining <= 1) return "ISD_1D";
  if (daysRemaining <= 7) return "ISD_7D";
  if (daysRemaining <= 30) return "ISD_30D";
  if (daysRemaining <= 60) return "ISD_60D";
  return null;
}

describe("ISD deadline bucket", () => {
  it("returns null outside the 60-day window", () => {
    expect(isdBucketFor(180)).toBeNull();
    expect(isdBucketFor(61)).toBeNull();
  });

  it("fires the 60-day alert between 31 and 60 days", () => {
    expect(isdBucketFor(60)).toBe("ISD_60D");
    expect(isdBucketFor(45)).toBe("ISD_60D");
    expect(isdBucketFor(31)).toBe("ISD_60D");
  });

  it("fires the 30-day alert between 8 and 30 days", () => {
    expect(isdBucketFor(30)).toBe("ISD_30D");
    expect(isdBucketFor(15)).toBe("ISD_30D");
    expect(isdBucketFor(8)).toBe("ISD_30D");
  });

  it("fires the 7-day alert between 2 and 7 days", () => {
    expect(isdBucketFor(7)).toBe("ISD_7D");
    expect(isdBucketFor(3)).toBe("ISD_7D");
    expect(isdBucketFor(2)).toBe("ISD_7D");
  });

  it("fires the 1-day alert at 0 and 1 day", () => {
    expect(isdBucketFor(1)).toBe("ISD_1D");
    expect(isdBucketFor(0)).toBe("ISD_1D");
  });

  it("fires the PASSED alert once the deadline is in the past", () => {
    expect(isdBucketFor(-1)).toBe("ISD_PASSED");
    expect(isdBucketFor(-30)).toBe("ISD_PASSED");
  });
});
