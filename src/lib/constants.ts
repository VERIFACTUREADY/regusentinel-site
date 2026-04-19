export const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  OPERATOR: "Operador",
  VIEWER: "Viewer",
  MANAGED_OPS: "Managed Ops",
};

export const ROLE_BADGE_COLORS: Record<string, string> = {
  OWNER: "bg-purple-100 text-purple-700",
  MANAGER: "bg-blue-100 text-blue-700",
  OPERATOR: "bg-green-100 text-green-700",
  VIEWER: "bg-gray-100 text-gray-600",
  MANAGED_OPS: "bg-orange-100 text-orange-700",
};

export const ALL_ROLES = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));

export const INVITABLE_ROLES = ALL_ROLES.filter((r) => r.value !== "OWNER");

export const PLAN_LABELS: Record<string, string> = {
  INICIA: "Inicia",
  DESPACHO: "Despacho",
  FIRMA: "Firma",
};

export const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  email: "Email",
  carta: "Carta",
  solicitud: "Solicitud",
};

export const CATEGORY_LABELS: Record<string, string> = {
  BANCOS: "Bancos",
  SUMINISTROS: "Suministros",
  TELECOM: "Telecomunicaciones",
  SUSCRIPCIONES: "Suscripciones",
  SEGUROS: "Seguros",
  VIDA_DIGITAL: "Vida digital",
  FISCAL: "Fiscal",
  OTROS: "Otros",
};

export const ALL_CATEGORIES = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

export const TASK_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  BLOCKED: "bg-red-100 text-red-700",
  READY: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  DONE: "bg-green-200 text-green-800",
  SKIPPED: "bg-gray-100 text-gray-400",
};

export const CASE_STATUS_COLORS: Record<string, string> = {
  INTAKE: "bg-gray-100 text-gray-700",
  VALIDATION: "bg-yellow-100 text-yellow-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  PENDING_DOCS: "bg-orange-100 text-orange-700",
  READY_TO_SEND: "bg-purple-100 text-purple-700",
  SENT: "bg-indigo-100 text-indigo-700",
  FOLLOW_UP: "bg-cyan-100 text-cyan-700",
  CLOSED: "bg-green-100 text-green-700",
  ARCHIVED: "bg-gray-100 text-gray-500",
};
