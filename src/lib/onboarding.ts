/**
 * Onboarding guiado. Los pasos se derivan del estado real de la org
 * para evitar desincronizaciones entre lo que el usuario ha hecho y
 * lo que el panel muestra.
 */

import { prisma } from "./prisma";

export type OnboardingStepId =
  | "first_case"
  | "deceased_data"
  | "invite_team"
  | "brand_portal"
  | "share_portal";

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  description: string;
  cta: string;
  ctaHref: string;
  done: boolean;
}

export interface OnboardingState {
  steps: OnboardingStep[];
  completed: number;
  total: number;
  dismissed: boolean;
  show: boolean;
  firstCaseId: string | null;
}

export async function getOnboardingState(orgId: string): Promise<OnboardingState> {
  const [org, caseCount, caseWithDeceased, memberCount, caseWithContact, firstCase] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: {
        onboardingDismissedAt: true,
        brandDisplayName: true,
        brandLogoUrl: true,
        brandPrimaryColor: true,
      },
    }),
    prisma.case.count({ where: { orgId, deletedAt: null } }),
    prisma.case.count({
      where: { orgId, deletedAt: null, deceased: { deathDate: { not: null } } },
    }),
    prisma.membership.count({ where: { orgId } }),
    prisma.case.count({
      where: { orgId, deletedAt: null, contact: { email: { not: null } } },
    }),
    prisma.case.findFirst({
      where: { orgId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }),
  ]);

  const hasBranding = Boolean(
    org.brandDisplayName || org.brandLogoUrl || org.brandPrimaryColor
  );

  const caseHref = firstCase ? `/cases/${firstCase.id}` : "/cases/new";

  const steps: OnboardingStep[] = [
    {
      id: "first_case",
      title: "Crea tu primer expediente",
      description:
        "Registra el expediente de herencia. BARITUR genera automaticamente tareas, plazos y checklist.",
      cta: caseCount > 0 ? "Ver expediente" : "Crear expediente",
      ctaHref: caseCount > 0 ? caseHref : "/cases/new",
      done: caseCount > 0,
    },
    {
      id: "deceased_data",
      title: "Anade la fecha de fallecimiento",
      description:
        "Sin fecha no hay motor de plazos: el Modelo 650 necesita esta fecha para calcular los 6 meses.",
      cta: "Completar datos",
      ctaHref: caseHref,
      done: caseWithDeceased > 0,
    },
    {
      id: "invite_team",
      title: "Invita a tu equipo",
      description:
        "Anade a socios o gestores. Cada usuario ve su actividad auditada y pueden coordinarse por expediente.",
      cta: "Invitar usuario",
      ctaHref: "/settings/users",
      done: memberCount > 1,
    },
    {
      id: "brand_portal",
      title: "Personaliza la marca del portal",
      description:
        "Logo, color y nombre de tu despacho. Lo primero que ven las familias es tu identidad, no la nuestra.",
      cta: "Configurar marca",
      ctaHref: "/settings/branding",
      done: hasBranding,
    },
    {
      id: "share_portal",
      title: "Comparte el portal con la familia",
      description:
        "Anade el email de contacto del expediente para enviar el enlace del portal y recibir documentos.",
      cta: "Abrir expediente",
      ctaHref: caseHref,
      done: caseWithContact > 0,
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const dismissed = !!org.onboardingDismissedAt;
  const show = !dismissed && completed < total;

  return { steps, completed, total, dismissed, show, firstCaseId: firstCase?.id ?? null };
}

export async function dismissOnboarding(orgId: string): Promise<void> {
  await prisma.organization.update({
    where: { id: orgId },
    data: { onboardingDismissedAt: new Date() },
  });
}
