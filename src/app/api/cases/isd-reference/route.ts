import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getReferenceBonification, type ParentescoGroup } from "@/lib/isd-calculator";

export async function GET(req: NextRequest) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  const { searchParams } = new URL(req.url);
  const province = searchParams.get("province");
  const group = (searchParams.get("group") || "II") as ParentescoGroup;
  if (!["I", "II", "III", "IV"].includes(group)) {
    return NextResponse.json({ error: "Grupo inválido" }, { status: 400 });
  }
  const referencePct = getReferenceBonification(province, group);
  return NextResponse.json({ referencePct });
}
