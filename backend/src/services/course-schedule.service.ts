/**
 * Parse a course schedule Excel (grid format).
 *
 * Expected format:
 *   Row 1 (header): [空, "周一", "周二", "周三", "周四", "周五", "周六", "周日"]
 *   Col A (rows 2+): time slots like "08:00-08:45", "09:00-09:45"
 *   Cells: course/subject name (empty = free)
 */

export function parseCourseSchedule(rows: string[][]): {
  courses: Array<{ title: string; dayOfWeek: number; startTime: string; endTime: string }>;
  freeSlots: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
} {
  if (rows.length < 2) return { courses: [], freeSlots: [] };

  const header = rows[0];
  const dayMap: number[] = [];
  for (let c = 1; c < header.length; c++) {
    const h = (header[c] || "").trim();
    if (h.includes("一")) dayMap.push(1);
    else if (h.includes("二")) dayMap.push(2);
    else if (h.includes("三")) dayMap.push(3);
    else if (h.includes("四")) dayMap.push(4);
    else if (h.includes("五")) dayMap.push(5);
    else if (h.includes("六")) dayMap.push(6);
    else if (h.includes("日")) dayMap.push(0);
    else dayMap.push(-1);
  }

  const courses: Array<{ title: string; dayOfWeek: number; startTime: string; endTime: string }> = [];
  const freeSlots: Array<{ dayOfWeek: number; startTime: string; endTime: string }> = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row[0]) continue;

    const timeSlot = String(row[0]).trim();
    const times = parseTimeSlot(timeSlot);
    if (!times) continue;

    for (let c = 1; c < row.length; c++) {
      const day = dayMap[c - 1];
      if (day < 0) continue;

      const courseName = (row[c] || "").trim();
      if (courseName && courseName !== "-" && courseName !== "无") {
        courses.push({
          title: courseName,
          dayOfWeek: day,
          startTime: times.start,
          endTime: times.end,
        });
      } else {
        freeSlots.push({
          dayOfWeek: day,
          startTime: times.start,
          endTime: times.end,
        });
      }
    }
  }

  return { courses, freeSlots };
}

function parseTimeSlot(raw: string): { start: string; end: string } | null {
  // "08:00-08:45" or "8:00-8:45" or "第1-2节"
  const m = raw.match(/(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/);
  if (m) {
    return {
      start: `${m[1].padStart(2, "0")}:${m[2]}`,
      end: `${m[3].padStart(2, "0")}:${m[4]}`,
    };
  }
  return null;
}
