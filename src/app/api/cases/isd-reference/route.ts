import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getReferenceBonification, type ParentescoGroup } from "@/lib/isd-calculator";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const province = searchParams.get("province");
  const group = (searchParams.get("group") || "II") as ParentescoGroup;
  if (!["I", "II", "III", "IV"].includes(group)) {
    return NextResponse.json({ error: "Grupo inválido" }, { status: 400 });
  }
  const referencePct = getReferenceBonification(province, group);
  return NextResponse.json({ referencePct });
}
