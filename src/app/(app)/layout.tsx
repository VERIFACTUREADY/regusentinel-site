import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { prisma } from "@/lib/prisma";
import { DEMO_ORG_SLUG } from "@/lib/demo-data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  let isDemoOrg = false;
  if (process.env.DEMO_ENABLED === "true" && session.user.orgId) {
    const org = await prisma.organization.findUnique({
      where: { id: session.user.orgId },
      select: { slug: true },
    });
    isDemoOrg = org?.slug === DEMO_ORG_SLUG;
  }

  return (
    <AppShell session={session} isDemoOrg={isDemoOrg}>
      {children}
    </AppShell>
  );
}
