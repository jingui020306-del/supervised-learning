/**
 * Frontend API client for the Supervised Learning backend.
 * Used by the dashboard views and external consumers.
 */

const BASE_URL = process.env.API_BASE_URL || "http://localhost:3001";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface Plan {
  id: string;
  userId: string;
  title: string;
  appName?: string;
  startTime: string;
  endTime: string;
  durationMin: number;
  dayOfWeek: number;
  status: string;
}

interface TrackingSession {
  id: string;
  userId: string;
  planId?: string;
  source: string;
  appName: string;
  startTime: string;
  endTime?: string;
  durationSec?: number;
  matched: boolean;
}

interface AlertConfig {
  id: string;
  planId: string;
  userId: string;
  checkTime: string;
  thresholdMin: number;
  notifyStudent: boolean;
  notifySupervisor: boolean;
  supervisorChannel: string;
  enabled: boolean;
}

interface Alert {
  id: string;
  configId: string;
  userId: string;
  planId?: string;
  planTitle: string;
  checkTime: string;
  plannedMin: number;
  actualMin: number;
  deficitMin: number;
  status: "sent" | "acknowledged" | "resolved";
  createdAt: string;
}

interface DashboardToday {
  date: string;
  plans: Array<Plan & { actualMin: number; progress: number }>;
  summary: { totalPlanned: number; totalActual: number; completionRate: number };
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("api_token") || "";
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as any).error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Plans
  getPlans: (userId: string) => fetchApi<Plan[]>(`/api/v1/plans?userId=${userId}`),
  getTodayPlans: (userId: string) => fetchApi<Plan[]>(`/api/v1/plans/today/${userId}`),
  createPlan: (data: Partial<Plan>) => fetchApi<Plan>("/api/v1/plans", { method: "POST", body: JSON.stringify(data) }),
  updatePlan: (id: string, data: Partial<Plan>) => fetchApi<Plan>(`/api/v1/plans/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletePlan: (id: string) => fetchApi<{ ok: boolean }>(`/api/v1/plans/${id}`, { method: "DELETE" }),

  // Tracking
  pushTracking: (data: { userId: string; action: "start" | "end"; appName: string; timestamp: string }) =>
    fetchApi<{ status: string; sessionId: string }>("/api/v1/tracking/push", { method: "POST", body: JSON.stringify(data) }),
  getSessions: (params: { userId?: string; date?: string }) => {
    const qs = new URLSearchParams(params as any).toString();
    return fetchApi<TrackingSession[]>(`/api/v1/tracking/sessions?${qs}`);
  },
  manualLog: (data: Partial<TrackingSession>) =>
    fetchApi<TrackingSession>("/api/v1/tracking/manual", { method: "POST", body: JSON.stringify(data) }),

  // Alerts
  getAlertConfigs: (userId: string) => fetchApi<AlertConfig[]>(`/api/v1/alerts/config?userId=${userId}`),
  createAlertConfig: (data: Partial<AlertConfig>) =>
    fetchApi<AlertConfig>("/api/v1/alerts/config", { method: "POST", body: JSON.stringify(data) }),
  updateAlertConfig: (id: string, data: Partial<AlertConfig>) =>
    fetchApi<AlertConfig>(`/api/v1/alerts/config/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  getAlertHistory: (userId: string, limit = 50) =>
    fetchApi<Alert[]>(`/api/v1/alerts/history?userId=${userId}&limit=${limit}`),
  acknowledgeAlert: (id: string) => fetchApi<Alert>(`/api/v1/alerts/${id}/acknowledge`, { method: "POST" }),
  resolveAlert: (id: string) => fetchApi<Alert>(`/api/v1/alerts/${id}/resolve`, { method: "POST" }),

  // Dashboard
  getDashboardToday: (userId: string) => fetchApi<DashboardToday>(`/api/v1/dashboard/today?userId=${userId}`),
  getDashboardWeekly: (userId: string) => fetchApi<{ days: any[] }>(`/api/v1/dashboard/weekly?userId=${userId}`),
  getDashboardSummary: (userId: string) => fetchApi<any>(`/api/v1/dashboard/summary?userId=${userId}`),

  // Health
  health: () => fetchApi<{ status: string; timestamp: string }>("/health"),
};
