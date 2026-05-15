import { config } from "../../config.js";

/** Send via Server酱 (WeChat push to supervisor) */
export async function sendWeChat(title: string, content: string) {
  if (!config.serverChan.sendKey) return { sent: false, reason: "No ServerChan send key configured" };

  const url = `https://sctapi.ftqq.com/${config.serverChan.sendKey}.send`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, desp: content }),
    });
    const data = await res.json() as any;
    return { sent: data.code === 0, data };
  } catch (err: any) {
    return { sent: false, reason: err.message };
  }
}
