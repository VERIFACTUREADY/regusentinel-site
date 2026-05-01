export interface NotifPrefs {
  dailyBriefing: boolean;
  weeklyDigest: boolean;
  taskOverdue: boolean;
  portalMessage: boolean;
  isdAlerts: boolean;
}

export const DEFAULT_PREFS: NotifPrefs = {
  dailyBriefing: true,
  weeklyDigest: true,
  taskOverdue: true,
  portalMessage: true,
  isdAlerts: true,
};

export function parsePrefs(raw: unknown): NotifPrefs {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PREFS };
  const r = raw as Record<string, unknown>;
  return {
    dailyBriefing: r.dailyBriefing !== false,
    weeklyDigest: r.weeklyDigest !== false,
    taskOverdue: r.taskOverdue !== false,
    portalMessage: r.portalMessage !== false,
    isdAlerts: r.isdAlerts !== false,
  };
}
