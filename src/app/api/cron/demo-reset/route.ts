import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DEMO_ORG_SLUG,
  DEMO_OWNER_EMAIL,
  DEMO_OPERATOR_EMAIL,
  resetDemoCases,
} from "@/lib/demo-data";

/**
 * Scheduled reset of the public demo org's cases so prospects always see a
 * consistent environment regardless of what the previous visitor clicked.
 * Gated by DEMO_ENABLED so it never fires in customer environments.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; the same
 * header works for manual triggers.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (process.env.DEMO_ENABLED !== "true") {
    return NextResponse.json({ skipped: "DEMO_ENABLED not set" });
  }

  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const org = await prisma.organization.findUnique({
      where: { slug: DEMO_ORG_SLUG },
      select: { id: true },
    });
    if (!org) {
      return NextResponse.json({ error: "Demo org not found" }, { status: 404 });
    }

    const [owner, operator] = await Promise.all([
      prisma.user.findUnique({ where: { email: DEMO_OWNER_EMAIL }, select: { id: true } }),
      prisma.user.findUnique({ where: { email: DEMO_OPERATOR_EMAIL }, select: { id: true } }),
    ]);
    if (!owner) {
      return NextResponse.json({ error: "Demo owner not found" }, { status: 404 });
    }

    const result = await resetDemoCases(org.id, owner.id, operator?.id ?? null);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("Demo reset error:", err);
    return NextResponse.json(
      { ok: false, error: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
