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
