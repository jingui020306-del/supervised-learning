/**
 * Super Productivity Plugin — 学习监督
 *
 * Syncs tasks to the supervision backend and receives alert notifications.
 */

interface PluginConfig {
  backendUrl: string;
  apiToken: string;
  syncInterval: number;
}

let config: PluginConfig;
let syncTimer: ReturnType<typeof setInterval> | null = null;

export async function onLoad(api: any) {
  config = api.loadSyncedData() as PluginConfig;

  // Register hooks
  api.registerHook("taskCreated", onTaskChange);
  api.registerHook("taskComplete", onTaskChange);
  api.registerHook("currentTaskChange", onTaskChange);
  api.registerHook("anyTaskUpdate", onTaskChange);
  api.registerHook("finishDay", onFinishDay);

  // Start periodic sync
  syncTimer = setInterval(() => syncTasks(api), (config.syncInterval || 60) * 1000);

  // Initial sync
  setTimeout(() => syncTasks(api), 2000);

  api.showSnack({ message: "学习监督插件已启动" });
}

export function onUnload(api: any) {
  if (syncTimer) clearInterval(syncTimer);
}

async function onTaskChange(context: any, api: any) {
  // Debounce: sync after a short delay
  setTimeout(() => syncTasks(api), 1000);
}

async function onFinishDay(context: any, api: any) {
  const tasks = api.getTasks();
  const done = tasks.filter((t: any) => t.isDone).length;

  await fetch(`${config.backendUrl}/api/v1/sync/sp-hook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiToken}`,
    },
    body: JSON.stringify({
      event: "finish_day",
      taskCount: tasks.length,
      doneCount: done,
    }),
  });

  api.showSnack({ message: `今日完成 ${done}/${tasks.length} 项任务` });
}

async function syncTasks(api: any) {
  try {
    const tasks = api.getTasks();
    const activeTasks = tasks.filter((t: any) => !t.isDone);

    await fetch(`${config.backendUrl}/api/v1/sync/sp-hook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiToken}`,
      },
      body: JSON.stringify({
        userId: "student-1",
        tasks: activeTasks.map((t: any) => ({
          id: t.id,
          title: t.title,
          timeEstimate: t.timeEstimate,
          tagIds: t.tagIds,
        })),
      }),
    });
  } catch (err) {
    // Silent — network may be unavailable
  }
}
