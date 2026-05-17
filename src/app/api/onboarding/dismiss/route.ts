import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dismissOnboarding } from "@/lib/onboarding";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  await dismissOnboarding(session.user.orgId);
  return NextResponse.json({ ok: true });
}
