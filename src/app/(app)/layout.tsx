import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { authOptions } from "@/lib/auth";
import { AppShell, type TrialInfo, type BadgeCounts } from "@/components/layout/app-shell";
import { prisma } from "@/lib/prisma";
import { DEMO_ORG_SLUG } from "@/lib/demo-data";
import Link from "next/link";

const SUSPENSION_EXEMPT_PATHS = ["/billing"];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let session;
  try {
    session = await getServerSession(authOptions);
  } catch {
    redirect("/login");
  }
  if (!session) redirect("/login");

  let isDemoOrg = false;
  let trialInfo: TrialInfo | null = null;
  let badgeCounts: BadgeCounts | null = null;
  let suspended = false;

  if (session.user.orgId) {
    try {
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

      const subStatus = org?.subscription?.status;

      if (subStatus === "trialing" && org?.subscription?.currentPeriodEnd) {
        const now = new Date();
        const daysLeft = Math.ceil(
          (org.subscription.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysLeft >= 0) {
          trialInfo = { plan: org.subscription.plan, daysLeft };
        } else {
          suspended = true;
        }
      }

      if (subStatus === "canceled" || subStatus === "past_due") {
        suspended = true;
      }

      // Badge counts for sidebar
      if (session.user.orgId) {
        const [unreadMsgs, pendingApprovals] = await Promise.all([
          prisma.portalMessage.count({
            where: {
              fromFamily: true,
              readAt: null,
              case: { orgId: session.user.orgId, deletedAt: null },
            },
          }).catch(() => 0),
          prisma.approval.count({
            where: { case: { orgId: session.user.orgId }, status: "PENDING" },
          }).catch(() => 0),
        ]);
        if (unreadMsgs > 0 || pendingApprovals > 0) {
          badgeCounts = { messages: unreadMsgs, approvals: pendingApprovals };
        }
      }
    } catch {
      // DB unreachable — let the page render without subscription check
    }
  }

  if (suspended && !isDemoOrg) {
    const headersList = headers();
    const pathname = headersList.get("x-pathname") || "";
    const isExempt = SUSPENSION_EXEMPT_PATHS.some((p) => pathname.startsWith(p));
    if (!isExempt) {
      return <SuspendedView isOwner={session.user.role === "OWNER"} />;
    }
  }

  return (
    <AppShell session={session} isDemoOrg={isDemoOrg} trialInfo={trialInfo} badgeCounts={badgeCounts}>
      {children}
    </AppShell>
  );
}

function SuspendedView({ isOwner }: { isOwner: boolean }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full mx-4 text-center">
        <div className="bg-white rounded-lg border shadow-sm p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Cuenta suspendida</h1>
          <p className="text-gray-600 text-sm mb-6">
            Tu periodo de prueba ha finalizado o tu suscripcion esta inactiva.
            Para seguir usando BARITUR PRO, activa un plan de pago.
          </p>
          {isOwner ? (
            <Link
              href="/billing"
              className="inline-block px-6 py-3 bg-primary text-white font-semibold rounded-md hover:bg-primary/90"
            >
              Activar suscripcion
            </Link>
          ) : (
            <p className="text-sm text-gray-500">
              Contacta al administrador de tu organizacion para reactivar el acceso.
            </p>
          )}
          <p className="mt-6 text-xs text-gray-400">
            Tus datos estan seguros. Al activar un plan, recuperaras acceso completo.
          </p>
        </div>
      </div>
    </div>
  );
}
