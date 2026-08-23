import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireOrgPermission("templates.read");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const body = await req.json();
  const { caseId, versionId } = body;

  const caseData = await prisma.case.findFirst({
    where: { id: caseId, orgId: session.user.orgId },
    include: { deceased: true, contact: true },
  });
  if (!caseData) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  let version;
  if (versionId) {
    version = await prisma.templateVersion.findUnique({ where: { id: versionId } });
  } else {
    version = await prisma.templateVersion.findFirst({
      where: { templateId: params.id },
      orderBy: { version: "desc" },
    });
  }
  if (!version) return NextResponse.json({ error: "Version no encontrada" }, { status: 404 });

  const variables: Record<string, string> = {
    "deceased.fullName": caseData.deceased?.fullName || "",
    "deceased.dni": caseData.deceased?.dni || "",
    "deceased.deathDate": caseData.deceased?.deathDate
      ? new Date(caseData.deceased.deathDate).toLocaleDateString("es-ES")
      : "",
    "contact.fullName": caseData.contact?.fullName || "",
    "contact.phone": caseData.contact?.phone || "",
    "contact.email": caseData.contact?.email || "",
    "contact.relationship": caseData.contact?.relationship || "",
    "case.province": caseData.province || "",
    "case.ref": caseData.ref,
    "date.today": new Date().toLocaleDateString("es-ES"),
  };

  let rendered = version.body;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`\\{\\{${key.replace(".", "\\.")}\\}\\}`, "g"), value);
  }

  return NextResponse.json({ rendered, subject: version.subject });
}
