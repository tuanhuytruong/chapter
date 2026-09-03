import React from "react";

const APP_TZ = "Asia/Bangkok";

function dateKey(now: Date): string {
  return now.toLocaleDateString("en-CA", { timeZone: APP_TZ });
}

function shiftDate(day: string, amount: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, date + amount));
  return shifted.toISOString().slice(0, 10);
}

export default function QuietStreakStrip({ readingDays, listeningDays }: { readingDays: string[]; listeningDays: string[] }) {
  const reads = new Set(readingDays);
  const listens = new Set(listeningDays);
  const today = dateKey(new Date());
  const states = Array.from({ length: 14 }, (_, index) => {
    const date = shiftDate(today, index - 13);
    const read = reads.has(date);
    const listen = listens.has(date);
    return { date, state: read && listen ? "both" : read ? "read" : listen ? "listen" : "none" };
  });
  const style = { none: "bg-natural-border/50", read: "bg-natural-sage", listen: "bg-amber-300", both: "bg-natural-dark" };
  const label = { none: "No activity", read: "Read", listen: "Listened", both: "Read and listened" };

  return <div aria-label="Active days" className="mt-3">
    <div className="mb-1.5 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[10px] text-natural-stone"><span className="font-bold uppercase tracking-wider">Active days</span><span>14 days · read · listen</span></div>
    <div className="grid grid-cols-14 gap-1" role="list" aria-label="Last 14 active-day states">
      {states.map((day) => <div key={day.date} role="listitem" aria-label={`${day.date}: ${label[day.state]}`} className={`h-6 min-w-0 rounded-[5px] ${style[day.state]}`} />)}
    </div>
  </div>;
}
