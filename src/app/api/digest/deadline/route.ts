import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

// Days thresholds for urgency tiers
const CRITICAL_DAYS = 30;
const WARNING_DAYS = 60;
const UPCOMING_DAYS = 90;

interface DigestCase {
  id: string;
  ref: string;
  deceasedName: string;
  deathDate: string;
  isdDeadline: string;
  daysRemaining: number;
  urgency: "critical" | "warning" | "upcoming";
  province: string | null;
  contactName: string | null;
  contactPhone: string | null;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "cases.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() + UPCOMING_DAYS * 24 * 60 * 60 * 1000);
  const minDeathDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

  const cases = await prisma.case.findMany({
    where: {
      orgId: session.user.orgId,
      deletedAt: null,
      status: { notIn: ["CLOSED", "ARCHIVED"] },
      deceased: {
        deathDate: { gte: minDeathDate },
      },
    },
    include: {
      deceased: { select: { fullName: true, deathDate: true } },
      contact: { select: { fullName: true, phone: true } },
    },
  });

  const digestCases: DigestCase[] = [];

  for (const c of cases) {
    if (!c.deceased?.deathDate) continue;
    const isdDeadline = new Date(c.deceased.deathDate.getTime() + 180 * 24 * 60 * 60 * 1000);
    const daysRemaining = Math.ceil((isdDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0 || isdDeadline > cutoff) continue;

    let urgency: DigestCase["urgency"];
    if (daysRemaining <= CRITICAL_DAYS) urgency = "critical";
    else if (daysRemaining <= WARNING_DAYS) urgency = "warning";
    else urgency = "upcoming";

    digestCases.push({
      id: c.id,
      ref: c.ref,
      deceasedName: c.deceased.fullName,
      deathDate: c.deceased.deathDate.toISOString(),
      isdDeadline: isdDeadline.toISOString(),
      daysRemaining,
      urgency,
      province: c.province || null,
      contactName: c.contact?.fullName || null,
      contactPhone: c.contact?.phone || null,
    });
  }

  digestCases.sort((a, b) => a.daysRemaining - b.daysRemaining);

  const format = req.nextUrl.searchParams.get("format") || "json";

  if (format === "html") {
    const html = buildHtmlDigest(digestCases, now);
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return NextResponse.json({
    generatedAt: now.toISOString(),
    total: digestCases.length,
    critical: digestCases.filter((c) => c.urgency === "critical").length,
    warning: digestCases.filter((c) => c.urgency === "warning").length,
    upcoming: digestCases.filter((c) => c.urgency === "upcoming").length,
    cases: digestCases,
  });
}

function buildHtmlDigest(cases: DigestCase[], now: Date): string {
  const dateStr = now.toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const critical = cases.filter((c) => c.urgency === "critical");
  const warning = cases.filter((c) => c.urgency === "warning");
  const upcoming = cases.filter((c) => c.urgency === "upcoming");

  function caseRow(c: DigestCase): string {
    const bg = c.urgency === "critical" ? "#fff5f5" : c.urgency === "warning" ? "#fffbeb" : "#f0fdf4";
    const badge = c.urgency === "critical"
      ? `<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700">${c.daysRemaining}d — URGENTE</span>`
      : c.urgency === "warning"
      ? `<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600">${c.daysRemaining}d</span>`
      : `<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:999px;font-size:11px">${c.daysRemaining}d</span>`;
    return `
      <tr style="background:${bg}">
        <td style="padding:10px 16px;font-weight:600;font-family:monospace;font-size:13px">${c.ref}</td>
        <td style="padding:10px 16px;font-size:13px">${c.deceasedName}</td>
        <td style="padding:10px 16px;font-size:12px;color:#6b7280">${c.province || "—"}</td>
        <td style="padding:10px 16px;font-size:12px">${new Date(c.isdDeadline).toLocaleDateString("es-ES")}</td>
        <td style="padding:10px 16px">${badge}</td>
        <td style="padding:10px 16px;font-size:12px;color:#6b7280">${c.contactName || "—"}${c.contactPhone ? ` · ${c.contactPhone}` : ""}</td>
      </tr>`;
  }

  function section(title: string, color: string, rows: DigestCase[]): string {
    if (rows.length === 0) return "";
    return `
      <h2 style="color:${color};font-size:16px;margin:24px 0 8px">${title} (${rows.length})</h2>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
        <thead><tr style="background:#f9fafb">
          <th style="padding:8px 16px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Ref</th>
          <th style="padding:8px 16px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Fallecido</th>
          <th style="padding:8px 16px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Provincia</th>
          <th style="padding:8px 16px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Vto. ISD</th>
          <th style="padding:8px 16px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Plazo</th>
          <th style="padding:8px 16px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase">Contacto</th>
        </tr></thead>
        <tbody>${rows.map(caseRow).join("")}</tbody>
      </table>`;
  }

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Digest de plazos ISD</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;max-width:900px;margin:0 auto;padding:24px;color:#111827">
  <div style="background:linear-gradient(135deg,#7c3aed,#2563eb);padding:24px;border-radius:12px;color:white;margin-bottom:24px">
    <h1 style="margin:0;font-size:22px">Digest de Plazos ISD</h1>
    <p style="margin:6px 0 0;opacity:0.85;font-size:14px">${dateStr}</p>
    <div style="margin-top:16px;display:flex;gap:16px">
      <div style="background:rgba(255,255,255,0.15);padding:8px 16px;border-radius:8px">
        <div style="font-size:24px;font-weight:700">${critical.length}</div>
        <div style="font-size:11px;opacity:0.8">URGENTES (≤30d)</div>
      </div>
      <div style="background:rgba(255,255,255,0.15);padding:8px 16px;border-radius:8px">
        <div style="font-size:24px;font-weight:700">${warning.length}</div>
        <div style="font-size:11px;opacity:0.8">AVISO (31-60d)</div>
      </div>
      <div style="background:rgba(255,255,255,0.15);padding:8px 16px;border-radius:8px">
        <div style="font-size:24px;font-weight:700">${upcoming.length}</div>
        <div style="font-size:11px;opacity:0.8">PRÓXIMOS (61-90d)</div>
      </div>
    </div>
  </div>

  ${cases.length === 0 ? '<p style="text-align:center;color:#9ca3af;padding:48px">Sin expedientes con plazos próximos.</p>' : ""}
  ${section("Urgente — menos de 30 días", "#991b1b", critical)}
  ${section("Aviso — 31 a 60 días", "#92400e", warning)}
  ${section("Próximos — 61 a 90 días", "#166534", upcoming)}

  <p style="margin-top:32px;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px">
    Generado automáticamente por BARITUR PRO · ${dateStr}
  </p>
</body>
</html>`;
}
