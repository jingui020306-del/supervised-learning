import { config } from "../config.js";
import prisma from "../db.js";

/**
 * Poll ActivityWatch API for recent window events.
 * Called periodically to import desktop activity into tracking sessions.
 */
export async function pollActivityWatch(userId: string) {
  if (!config.activityWatch.enabled) return [];

  const base = config.activityWatch.baseUrl;

  try {
    // Get buckets
    const bucketsRes = await fetch(`${base}/api/0/buckets/`);
    const buckets = await bucketsRes.json() as Record<string, any>;

    const windowBucket = Object.values(buckets).find(
      (b: any) => b.id?.startsWith("aw-watcher-window-")
    ) as any;

    if (!windowBucket) return [];

    // Get recent events (last 60 seconds)
    const now = new Date();
    const oneMinAgo = new Date(now.getTime() - 60 * 1000);
    const eventsRes = await fetch(
      `${base}/api/0/buckets/${windowBucket.id}/events?start=${oneMinAgo.toISOString()}&end=${now.toISOString()}`
    );
    const events = await eventsRes.json() as any[];

    const results = [];
    for (const evt of events) {
      const appName = evt.data?.app || "";
      // Only track learning-related apps
      const learningApps = ["新东方大学考试", "小鹅通学员版", "网易有道词典", "Youdao", "新东方"];
      const isMatch = learningApps.some((a) => appName.includes(a));
      if (!isMatch) continue;

      const session = await prisma.trackingSession.create({
        data: {
          userId,
          appName,
          source: "activitywatch",
          startTime: new Date(evt.timestamp),
          endTime: new Date(new Date(evt.timestamp).getTime() + (evt.duration || 0) * 1000),
          durationSec: Math.round(evt.duration || 0),
          rawData: JSON.stringify(evt.data),
        },
      });

      const { matchSessionToPlan } = await import("../services/comparator.service.js");
      await matchSessionToPlan(session.id);
      results.push(session);
    }

    return results;
  } catch (err: any) {
    // ActivityWatch may not be running — silent fail
    return [];
  }
}
