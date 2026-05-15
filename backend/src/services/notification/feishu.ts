import { createHmac } from "node:crypto";
import { config } from "../../config.js";

function sign(secret: string): { timestamp: string; sign: string } {
  const ts = Math.floor(Date.now() / 1000).toString();
  const h = createHmac("sha256", secret).update(`${ts}\n${secret}`).digest("base64");
  return { timestamp: ts, sign: h };
}

/** Send via Feishu/Lark bot webhook */
export async function sendFeishu(title: string, content: string) {
  if (!config.feishu.webhookUrl) return { sent: false, reason: "No Feishu webhook configured" };

  try {
    const body: any = {
      msg_type: "interactive",
      card: {
        header: { title: { tag: "plain_text", content: title }, template: "red" },
        elements: [{ tag: "div", text: { tag: "lark_md", content } }],
      },
    };
    if (config.feishu.secret) {
      body.timestamp = sign(config.feishu.secret).timestamp;
      body.sign = sign(config.feishu.secret).sign;
    }

    const res = await fetch(config.feishu.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json() as any;
    return { sent: data.code === 0, data };
  } catch (err: any) {
    return { sent: false, reason: err.message };
  }
}
