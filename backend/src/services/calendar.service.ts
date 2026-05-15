/**
 * Calendar integration — reads busy/free slots from iCal/CalDAV feeds.
 * Supports iPad Calendar export and standard iCal URLs.
 */

interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
}

interface TimeSlot {
  start: Date;
  end: Date;
  durationMin: number;
}

/**
 * Parse an iCal feed URL and extract busy events.
 * iPad Calendar can export a read-only iCal share link.
 */
export async function fetchICalFeed(url: string): Promise<CalendarEvent[]> {
  const res = await fetch(url);
  const raw = await res.text();
  return parseICal(raw);
}

/**
 * Simple iCal parser — extracts VEVENT blocks.
 */
function parseICal(raw: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const blocks = raw.split("BEGIN:VEVENT");

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split("END:VEVENT")[0];
    if (!block) continue;

    const titleMatch = block.match(/SUMMARY(?::|;.*?):(.+)/);
    const dtStartMatch = block.match(/DTSTART(?::|;.*?):(\d{8}T\d{6}Z?)/);
    const dtEndMatch = block.match(/DTEND(?::|;.*?):(\d{8}T\d{6}Z?)/);

    if (dtStartMatch && dtEndMatch) {
      events.push({
        title: titleMatch?.[1]?.trim() || "Busy",
        start: parseICalDate(dtStartMatch[1]),
        end: parseICalDate(dtEndMatch[1]),
      });
    }
  }

  return events;
}

function parseICalDate(raw: string): Date {
  // Format: 20260515T090000Z or 20260515T090000
  const year = parseInt(raw.slice(0, 4), 10);
  const month = parseInt(raw.slice(4, 6), 10) - 1;
  const day = parseInt(raw.slice(6, 8), 10);
  const hour = parseInt(raw.slice(9, 11), 10);
  const min = parseInt(raw.slice(11, 13), 10);
  const sec = parseInt(raw.slice(13, 15), 10);
  return new Date(Date.UTC(year, month, day, hour, min, sec));
}

/**
 * Given busy events and a date, find free time slots.
 */
export function findFreeSlots(
  busyEvents: CalendarEvent[],
  date: Date,
  dayStartHour = 8,
  dayEndHour = 22,
  minSlotMin = 30
): TimeSlot[] {
  const dayStart = new Date(date);
  dayStart.setHours(dayStartHour, 0, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setHours(dayEndHour, 0, 0, 0);

  // Filter events that overlap with this day
  const dayEvents = busyEvents
    .filter((e) => e.end > dayStart && e.start < dayEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const freeSlots: TimeSlot[] = [];
  let cursor = dayStart;

  for (const event of dayEvents) {
    if (event.start > cursor) {
      const gapMin = (event.start.getTime() - cursor.getTime()) / 60000;
      if (gapMin >= minSlotMin) {
        freeSlots.push({
          start: new Date(cursor),
          end: new Date(event.start),
          durationMin: Math.round(gapMin),
        });
      }
    }
    if (event.end > cursor) {
      cursor = new Date(event.end);
    }
  }

  // Remaining time after last event
  if (dayEnd > cursor) {
    const gapMin = (dayEnd.getTime() - cursor.getTime()) / 60000;
    if (gapMin >= minSlotMin) {
      freeSlots.push({
        start: new Date(cursor),
        end: new Date(dayEnd),
        durationMin: Math.round(gapMin),
      });
    }
  }

  return freeSlots;
}

/**
 * Auto-assign tasks to free time slots (greedy first-fit).
 */
export function autoSchedule(
  tasks: Array<{ title: string; durationMin: number }>,
  freeSlots: TimeSlot[]
): Array<{ title: string; startTime: string; endTime: string; durationMin: number }> {
  const slots = freeSlots.map((s) => ({ ...s }));
  const scheduled: Array<{ title: string; startTime: string; endTime: string; durationMin: number }> = [];

  for (const task of tasks) {
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (slot.durationMin >= task.durationMin) {
        const taskStart = new Date(slot.start);
        const taskEnd = new Date(taskStart.getTime() + task.durationMin * 60000);

        scheduled.push({
          title: task.title,
          startTime: fmtTime(taskStart),
          endTime: fmtTime(taskEnd),
          durationMin: task.durationMin,
        });

        // Shrink the slot
        slot.start = taskEnd;
        slot.durationMin = Math.round((slot.end.getTime() - slot.start.getTime()) / 60000);
        if (slot.durationMin < 30) {
          slots.splice(i, 1);
          i--;
        }
        break;
      }
    }
  }

  return scheduled;
}

function fmtTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
