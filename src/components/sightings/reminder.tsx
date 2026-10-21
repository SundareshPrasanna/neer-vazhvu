"use client";

import { CalendarPlus } from "lucide-react";

import { link } from "./ui";

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** A calendar file for the reporter's own calendar: a nudge to update their report, with nothing sent by us. */
function download(days: number) {
  const at = new Date(Date.now() + days * 86_400_000);
  at.setUTCHours(4, 30, 0, 0); // 10:00 in India
  const end = new Date(at.getTime() + 15 * 60_000);
  const url = `${window.location.origin}/mitra`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Neer Vazhvu//Report reminder//EN",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}@neervazhvu.org`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(at)}`,
    `DTEND:${stamp(end)}`,
    "SUMMARY:Check your Neer Vazhvu report",
    `DESCRIPTION:Is it still there\\, or fixed? Update it under My reports: ${url}`,
    `URL:${url}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Check your Neer Vazhvu report",
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = href;
  a.download = "neer-vazhvu-reminder.ics";
  a.click();
  URL.revokeObjectURL(href);
}

export function ReminderLink({ days = 14 }: { days?: number }) {
  return (
    <button type="button" onClick={() => download(days)} className={`inline-flex items-center gap-1.5 text-sm ${link}`}>
      <CalendarPlus className="h-4 w-4" aria-hidden="true" />
      Remind me in {days === 14 ? "two weeks" : `${days} days`}
    </button>
  );
}
