import { sendBark } from "./bark.js";
import { sendWeChat } from "./wechat.js";
import { sendFeishu } from "./feishu.js";

export type AlertLevel = "behind" | "critical" | "incomplete" | "daily_summary";

interface NotificationRequest {
  level: AlertLevel;
  planTitle: string;
  plannedMin: number;
  actualMin: number;
  deficitMin: number;
  notifyStudent: boolean;
  notifySupervisor: boolean;
  supervisorChannel: string; // "wechat" | "feishu"
}

export async function dispatchAlert(req: NotificationRequest) {
  const results: any[] = [];

  const studentTitle = getStudentTitle(req.level);
  const studentBody = getStudentBody(req);
  const supervisorTitle = "学习监督提醒";
  const supervisorBody = getSupervisorBody(req);

  if (req.notifyStudent) {
    const r = await sendBark(studentTitle, studentBody);
    results.push({ channel: "bark", ...r });
  }

  if (req.notifySupervisor) {
    if (req.supervisorChannel === "wechat" || req.supervisorChannel === "both") {
      const r = await sendWeChat(supervisorTitle, supervisorBody);
      results.push({ channel: "wechat", ...r });
    }
    if (req.supervisorChannel === "feishu" || req.supervisorChannel === "both") {
      const r = await sendFeishu(supervisorTitle, supervisorBody);
      results.push({ channel: "feishu", ...r });
    }
  }

  return results;
}

function getStudentTitle(level: AlertLevel): string {
  switch (level) {
    case "behind": return "进度提醒";
    case "critical": return "严重落后！";
    case "incomplete": return "任务未完成";
    case "daily_summary": return "";
  }
}

function getStudentBody(req: NotificationRequest): string {
  const pct = req.plannedMin > 0 ? Math.round((req.actualMin / req.plannedMin) * 100) : 0;
  switch (req.level) {
    case "behind":
      return `${req.planTitle}：当前进度 ${pct}%，还差 ${req.deficitMin} 分钟`;
    case "critical":
      return `${req.planTitle} 严重落后！已完成 ${pct}%，请立即开始学习`;
    case "incomplete":
      return `${req.planTitle} 未完成，计划 ${req.plannedMin} 分钟，实际 ${req.actualMin} 分钟`;
    default:
      return "";
  }
}

function getSupervisorBody(req: NotificationRequest): string {
  const pct = req.plannedMin > 0 ? Math.round((req.actualMin / req.plannedMin) * 100) : 0;
  const labels: Record<AlertLevel, string> = {
    behind: "进度落后",
    critical: "严重落后",
    incomplete: "未完成",
    daily_summary: "每日汇总",
  };
  return `## ${labels[req.level]}\n\n**计划**：${req.planTitle}\n**计划时长**：${req.plannedMin} 分钟\n**已完成**：${req.actualMin} 分钟 (${pct}%)\n**差额**：${req.deficitMin} 分钟`;
}

/** Send daily summary to supervisor */
export async function dispatchDailySummary(supervisorChannel: string, stats: string) {
  if (supervisorChannel === "wechat") {
    await sendWeChat("每日学习报告", stats);
  } else {
    await sendFeishu("每日学习报告", stats);
  }
}
