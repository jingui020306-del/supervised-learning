import { config } from "../../config.js";

/** Send via Feishu/Lark bot webhook */
export async function sendFeishu(title: string, content: string) {
  if (!config.feishu.webhookUrl) return { sent: false, reason: "No Feishu webhook configured" };

  try {
    const res = await fetch(config.feishu.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msg_type: "interactive",
        card: {
          header: { title: { tag: "plain_text", content: title }, template: "red" },
          elements: [{ tag: "div", text: { tag: "lark_md", content } }],
        },
      }),
    });
    const data = await res.json() as any;
    return { sent: data.code === 0, data };
  } catch (err: any) {
    return { sent: false, reason: err.message };
  }
}
