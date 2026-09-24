import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { buildHtmlDigest, classifyCases } from "@/lib/digest-builder";

export async function GET(req: NextRequest) {
  const auth = await requireOrgPermission("cases.read");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const now = new Date();
  const minDeathDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

  const cases = await prisma.case.findMany({
    where: {
      orgId: session.user.orgId,
      deletedAt: null,
      status: { notIn: ["CLOSED", "ARCHIVED"] },
      deceased: { deathDate: { gte: minDeathDate } },
    },
    select: {
      id: true,
      ref: true,
      province: true,
      deceased: { select: { fullName: true, deathDate: true } },
      contact: { select: { fullName: true, phone: true } },
    },
  });

  const digestCases = classifyCases(cases as any, now, 90);
  const format = req.nextUrl.searchParams.get("format") || "json";

  if (format === "html") {
    const html = buildHtmlDigest(digestCases, now);
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return NextResponse.json({
    generatedAt: now.toISOString(),
    total: digestCases.length,
    critical: digestCases.filter((c) => c.urgency === "critical").length,
    warning: digestCases.filter((c) => c.urgency === "warning").length,
    upcoming: digestCases.filter((c) => c.urgency === "upcoming").length,
    cases: digestCases,
  });
}
