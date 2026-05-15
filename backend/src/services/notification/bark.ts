import { config } from "../../config.js";

export async function sendBark(title: string, body: string, group = "学习监督") {
  if (!config.bark.deviceKey) return { sent: false, reason: "No Bark device key configured" };

  const url = `${config.bark.url}/${config.bark.deviceKey}/${encodeURIComponent(title)}/${encodeURIComponent(body)}?group=${encodeURIComponent(group)}&isArchive=1`;

  try {
    const res = await fetch(url);
    const data = await res.json() as any;
    return { sent: data.code === 200, data };
  } catch (err: any) {
    return { sent: false, reason: err.message };
  }
}
