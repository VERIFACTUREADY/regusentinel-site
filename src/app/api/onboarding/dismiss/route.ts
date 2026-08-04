import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { dismissOnboarding } from "@/lib/onboarding";

export async function POST() {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  await dismissOnboarding(session.user.orgId);
  return NextResponse.json({ ok: true });
}
