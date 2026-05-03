import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { DocumentsClient } from "./documents-client";

export const metadata = {
  title: "Documentos — BARITUR PRO",
  robots: { index: false },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function DocumentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) redirect("/login");
  if (!hasPermission(session.user.role, "documents.read")) redirect("/dashboard");

  const orgId = session.user.orgId;

  const [initialDocs, initialTotal, stats] = await Promise.all([
    prisma.document.findMany({
      where: { case: { orgId } },
      include: {
        case: { select: { id: true, ref: true, deceased: { select: { fullName: true } } } },
        task: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.document.count({ where: { case: { orgId } } }),
    prisma.document.aggregate({
      where: { case: { orgId } },
      _sum: { fileSize: true },
      _count: { id: true },
    }),
  ]);

  const [portalCount, totalSizeBytes] = [
    await prisma.document.count({ where: { case: { orgId }, isPortalUpload: true } }),
    stats._sum.fileSize ?? 0,
  ];

  const serialized = initialDocs.map((d) => ({
    id: d.id,
    fileName: d.fileName,
    mimeType: d.mimeType,
    fileSize: d.fileSize,
    isPortalUpload: d.isPortalUpload,
    uploadedBy: d.uploadedBy,
    createdAt: d.createdAt.toISOString(),
    case: d.case
      ? { id: d.case.id, ref: d.case.ref, deceasedName: d.case.deceased?.fullName ?? null }
      : null,
    task: d.task ? { id: d.task.id, title: d.task.title } : null,
  }));

  return (
    <DocumentsClient
      initialDocs={serialized}
      initialTotal={initialTotal}
      totalStorageLabel={formatBytes(totalSizeBytes)}
      portalCount={portalCount}
      totalCount={stats._count.id}
    />
  );
}
