import type { FastifyInstance } from "fastify";
import * as XLSX from "xlsx";
import prisma from "../db.js";
import { ensureUser } from "../services/user.service.js";
import { fetchICalFeed, findFreeSlots, autoSchedule } from "../services/calendar.service.js";
import { parseCourseSchedule } from "../services/course-schedule.service.js";

export async function excelRoutes(app: FastifyInstance) {
  /**
   * Fetch iCal feed and return events for a date range.
   * GET /api/v1/excel/calendar?icalUrl=...&date=2026-05-15
   */
  app.get("/calendar", async (request) => {
    const { icalUrl, date } = request.query as { icalUrl?: string; date?: string };
    if (!icalUrl) return { events: [], freeSlots: [], tip: "请提供日历 iCal 链接" };

    try {
      const events = await fetchICalFeed(icalUrl);
      const targetDate = date ? new Date(date) : new Date();
      const freeSlots = findFreeSlots(events, targetDate);

      // Filter events that overlap with the target day
      const dayStart = new Date(targetDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(targetDate);
      dayEnd.setHours(23, 59, 59, 999);

      const dayEvents = events
        .filter((e) => e.end > dayStart && e.start < dayEnd)
        .map((e) => ({
          title: e.title,
          start: e.start.toISOString(),
          end: e.end.toISOString(),
        }));

      return {
        events: dayEvents,
        freeSlots: freeSlots.map((s) => ({
          start: `${String(s.start.getHours()).padStart(2, "0")}:${String(s.start.getMinutes()).padStart(2, "0")}`,
          end: `${String(s.end.getHours()).padStart(2, "0")}:${String(s.end.getMinutes()).padStart(2, "0")}`,
          durationMin: s.durationMin,
        })),
      };
    } catch (e: any) {
      return { error: "无法获取日历，请检查链接是否正确", detail: e.message };
    }
  });

  /**
   * Upload Excel file, parse tasks, auto-schedule into calendar gaps.
   *
   * Excel format expected:
   *   Column A: 任务名称 (Task title)
   *   Column B: 时长(分钟) (Duration in minutes)
   *   Column C: 关联App (Optional — app name for tracking)
   */
  app.post("/upload", async (request) => {
    const data = await (request as any).file();
    if (!data) return { error: "No file uploaded" };

    const buffer = await data.toBuffer();
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return { error: "Empty workbook" };

    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
    const tasks: Array<{ title: string; durationMin: number; appName?: string }> = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0]) continue;
      const title = String(row[0]).trim();
      const durationMin = parseInt(String(row[1] || "30"), 10) || 30;
      const appName = row[2] ? String(row[2]).trim() : undefined;
      if (title) tasks.push({ title, durationMin, appName });
    }

    if (tasks.length === 0) {
      return { error: "Excel 文件中未找到有效任务" };
    }

    return { status: "parsed", taskCount: tasks.length, tasks };
  });

  /**
   * Full pipeline: upload Excel + iCal URL → auto-schedule → create plans.
   *
   * Body (multipart):
   *   - file: Excel file
   *   - userId: string
   *   - icalUrl?: string (iPad Calendar shared link)
   *   - date?: string (YYYY-MM-DD, default today)
   */
  app.post("/auto-schedule", async (request) => {
    const data = await (request as any).file();
    if (!data) return { error: "No Excel file uploaded" };

    const buffer = await data.toBuffer();
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return { error: "Empty workbook" };

    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
    const tasks: Array<{ title: string; durationMin: number; appName?: string }> = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0]) continue;
      const title = String(row[0]).trim();
      const durationMin = parseInt(String(row[1] || "30"), 10) || 30;
      const appName = row[2] ? String(row[2]).trim() : undefined;
      if (title) tasks.push({ title, durationMin, appName });
    }

    if (tasks.length === 0) {
      return { error: "Excel 文件中未找到有效任务" };
    }

    // Get userId and date from query or form fields
    const userId = (request.query as any).userId || "student-1";
    const icalUrl = (request.query as any).icalUrl;
    const dateStr = (request.query as any).date || new Date().toISOString().slice(0, 10);

    await ensureUser(userId);

    // Get busy events from iPad Calendar
    let busyEvents: Array<{ title: string; start: Date; end: Date }> = [];

    if (icalUrl) {
      try {
        busyEvents = await fetchICalFeed(icalUrl);
      } catch (e: any) {
        // Calendar fetch failed — proceed without it
      }
    }

    // Also get existing plans for today (treated as busy)
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay();
    const existingPlans = await prisma.plan.findMany({
      where: {
        userId,
        status: "active",
        OR: [{ dayOfWeek }, { dayOfWeek: -1, specificDate: dateStr }],
      },
    });

    // Convert existing plans to "busy" events
    for (const plan of existingPlans) {
      const [sh, sm] = plan.startTime.split(":").map(Number);
      const [eh, em] = plan.endTime.split(":").map(Number);
      const pStart = new Date(date);
      pStart.setHours(sh, sm, 0, 0);
      const pEnd = new Date(date);
      pEnd.setHours(eh, em, 0, 0);
      busyEvents.push({ title: plan.title, start: pStart, end: pEnd });
    }

    // Find free slots
    const freeSlots = findFreeSlots(busyEvents, date);

    // Auto-assign tasks to free slots
    const scheduled = autoSchedule(tasks, freeSlots);

    // Create plans from scheduled tasks
    const createdPlans = [];
    for (const s of scheduled) {
      const plan = await prisma.plan.create({
        data: {
          userId,
          title: s.title,
          startTime: s.startTime,
          endTime: s.endTime,
          durationMin: s.durationMin,
          dayOfWeek: date.getDay(),
          specificDate: dateStr,
          status: "active",
        },
      });
      createdPlans.push(plan);
    }

    return {
      status: "scheduled",
      date: dateStr,
      totalTasks: tasks.length,
      scheduled: scheduled.length,
      unscheduled: tasks.length - scheduled.length,
      freeSlots: freeSlots.map((s) => ({
        start: `${String(s.start.getHours()).padStart(2, "0")}:${String(s.start.getMinutes()).padStart(2, "0")}`,
        end: `${String(s.end.getHours()).padStart(2, "0")}:${String(s.end.getMinutes()).padStart(2, "0")}`,
        durationMin: s.durationMin,
      })),
      plans: scheduled,
      createdPlans,
    };
  });

  // Parse course schedule Excel (grid format)
  app.post("/course-schedule", async (request) => {
    const data = await (request as any).file();
    if (!data) return { error: "No file uploaded" };

    const buffer = await data.toBuffer();
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return { error: "Empty workbook" };

    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
    const { courses, freeSlots } = parseCourseSchedule(rows);

    // Create plans from course schedule
    const userId = (request.query as any).userId || "student-1";
    await ensureUser(userId);

    const createdPlans = [];
    for (const c of courses) {
      const plan = await prisma.plan.create({
        data: {
          userId,
          title: c.title,
          startTime: c.startTime,
          endTime: c.endTime,
          durationMin: timeToMinutes(c.startTime, c.endTime),
          dayOfWeek: c.dayOfWeek,
          status: "active",
        },
      });
      createdPlans.push(plan);
    }

    return {
      status: "parsed",
      coursesFound: courses.length,
      freeSlots,
      createdPlans,
    };
  });
}

function timeToMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}
