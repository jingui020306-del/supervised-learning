import type { FastifyInstance } from "fastify";
import prisma from "../db.js";
import { ensureUser } from "../services/user.service.js";

/** Default learning apps with Chinese names */
const DEFAULT_APPS = [
  { appName: "新东方大学考试", bundleId: "com.neworiental.college", icon: "" },
  { appName: "小鹅通学员版", bundleId: "com.xiaoetong.student", icon: "" },
  { appName: "网易有道词典", bundleId: "com.youdao.dict", icon: "" },
  { appName: "百度网盘", bundleId: "com.baidu.netdisk", icon: "" },
  { appName: "腾讯课堂", bundleId: "com.tencent.edu", icon: "" },
  { appName: "得到", bundleId: "com.luojilab.dedao", icon: "" },
  { appName: "知乎", bundleId: "com.zhihu.ios", icon: "" },
  { appName: "哔哩哔哩", bundleId: "tv.danmaku.bili", icon: "" },
  { appName: "微信读书", bundleId: "com.tencent.weread", icon: "" },
  { appName: "Notability", bundleId: "com.gingerlabs.Notability", icon: "" },
  { appName: "GoodNotes", bundleId: "com.goodnotesapp.x", icon: "" },
  { appName: "MarginNote", bundleId: "com.marginnote.marginnote3", icon: "" },
];

export async function appPermissionRoutes(app: FastifyInstance) {
  // List permissions for a user (with defaults merged)
  app.get("/", async (request) => {
    const { userId } = request.query as { userId: string };
    if (!userId) return { error: "userId required" };

    const existing = await prisma.appPermission.findMany({
      where: { userId },
    });

    // Merge defaults with existing permissions
    const map = new Map(existing.map((p) => [p.appName, p]));
    const merged = DEFAULT_APPS.map((def) => {
      const saved = map.get(def.appName);
      return saved || {
        id: null,
        userId,
        appName: def.appName,
        bundleId: def.bundleId,
        icon: def.icon,
        enabled: false, // default OFF — user must explicitly enable
        createdAt: null,
        updatedAt: null,
      };
    });

    return merged;
  });

  // Update a single permission
  app.put("/:appName", async (request) => {
    const { appName } = request.params as { appName: string };
    const { userId, enabled, bundleId } = request.body as any;
    await ensureUser(userId);

    const existing = await prisma.appPermission.findUnique({
      where: { userId_appName: { userId, appName } },
    });

    if (existing) {
      return prisma.appPermission.update({
        where: { userId_appName: { userId, appName } },
        data: { enabled: enabled ?? existing.enabled, bundleId: bundleId ?? existing.bundleId },
      });
    }

    const def = DEFAULT_APPS.find((a) => a.appName === appName);
    return prisma.appPermission.create({
      data: {
        userId,
        appName,
        bundleId: bundleId || def?.bundleId || "",
        icon: def?.icon || "",
        enabled: enabled ?? true,
      },
    });
  });

  // Batch update permissions
  app.put("/batch", async (request) => {
    const { userId, permissions } = request.body as {
      userId: string;
      permissions: Array<{ appName: string; enabled: boolean }>;
    };
    await ensureUser(userId);

    const results = [];
    for (const perm of permissions) {
      const result = await prisma.appPermission.upsert({
        where: { userId_appName: { userId, appName: perm.appName } },
        create: { userId, appName: perm.appName, enabled: perm.enabled },
        update: { enabled: perm.enabled },
      });
      results.push(result);
    }

    return results;
  });

  // Check if an app is allowed for tracking
  app.get("/check", async (request) => {
    const { userId, appName } = request.query as { userId: string; appName: string };
    if (!userId || !appName) return { allowed: false };

    const perm = await prisma.appPermission.findUnique({
      where: { userId_appName: { userId, appName } },
    });

    // If never configured, deny by default
    if (!perm) return { allowed: false };
    return { allowed: perm.enabled };
  });

  // Get all enabled app names for a user (used by tracking validation)
  app.get("/enabled", async (request) => {
    const { userId } = request.query as { userId: string };
    if (!userId) return [];

    const permissions = await prisma.appPermission.findMany({
      where: { userId, enabled: true },
      select: { appName: true },
    });

    return permissions.map((p) => p.appName);
  });
}
