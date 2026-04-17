import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AppShell, type TrialInfo } from "@/components/layout/app-shell";
import { prisma } from "@/lib/prisma";
import { DEMO_ORG_SLUG } from "@/lib/demo-data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  let isDemoOrg = false;
  let trialInfo: TrialInfo | null = null;

  if (session.user.orgId) {
    const org = await prisma.organization.findUnique({
      where: { id: session.user.orgId },
      select: {
        slug: true,
        subscription: { select: { status: true, plan: true, currentPeriodEnd: true } },
      },
    });

    if (process.env.DEMO_ENABLED === "true") {
      isDemoOrg = org?.slug === DEMO_ORG_SLUG;
    }

    if (org?.subscription?.status === "trialing" && org.subscription.currentPeriodEnd) {
      const now = new Date();
      const daysLeft = Math.ceil(
        (org.subscription.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysLeft >= 0) {
        trialInfo = { plan: org.subscription.plan, daysLeft };
      }
    }
  }

  return (
    <AppShell session={session} isDemoOrg={isDemoOrg} trialInfo={trialInfo}>
      {children}
    </AppShell>
  );
}
