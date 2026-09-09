import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { generateBankPackPdf, generateBankPackZip } from "@/lib/bank-pack-export";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireOrgPermission("cases.read");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const format = (req.nextUrl.searchParams.get("format") || "pdf").toLowerCase();
  if (format !== "pdf" && format !== "zip") {
    return NextResponse.json({ error: "Formato invalido (pdf | zip)" }, { status: 400 });
  }

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId },
    include: {
      deceased: true,
      contact: true,
      org: true,
      documents: { include: { task: true } },
    },
  });
  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  const caseInput = {
    ref: c.ref,
    orgName: c.org.name,
    deceased: c.deceased,
    contact: c.contact,
    province: c.province,
  };

  const documents = c.documents.map((d) => ({
    id: d.id,
    fileName: d.fileName,
    fileKey: d.fileKey,
    mimeType: d.mimeType,
    docTag: d.task?.docTag ?? null,
  }));

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    caseId: params.id,
    action: format === "zip" ? "case.bank_pack_zip" : "case.bank_pack_pdf",
    details: `Pack banco (${format.toUpperCase()}) generado para ${c.ref}`,
  });

  if (format === "zip") {
    const zipBuf = await generateBankPackZip(caseInput, documents);
    return new NextResponse(new Uint8Array(zipBuf), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="pack-banco-${c.ref}.zip"`,
      },
    });
  }

  const { pdf } = await generateBankPackPdf(caseInput, documents);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="pack-banco-${c.ref}.pdf"`,
    },
  });
}
