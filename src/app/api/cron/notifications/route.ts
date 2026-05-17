import { NextRequest, NextResponse } from "next/server";
import { runDeadlineNotifications } from "@/lib/notifications";

/**
 * Scheduled (Vercel Cron) endpoint that dispatches ISD deadline alerts
 * and family pending-doc reminders. Idempotent via NotificationLog.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; the
 * same header works for manual triggers.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const result = await runDeadlineNotifications();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("Cron notifications error:", err);
    return NextResponse.json(
      { ok: false, error: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
