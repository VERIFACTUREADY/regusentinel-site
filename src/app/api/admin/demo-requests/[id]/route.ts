import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const VALID_STATUSES = ["NEW", "CONTACTED", "MEETING", "PILOT", "CUSTOMER", "LOST"] as const;

const patchSchema = z.object({
  leadStatus: z.enum(VALID_STATUSES).optional(),
  internalNotes: z.string().max(2000).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "OWNER") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
  }

  const updated = await prisma.demoRequest.update({
    where: { id: params.id },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}
