"use client";

import { useEffect, useState } from "react";
import { SingleSelectDropdown } from "@/components/Dropdown";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function parse(value: string | null): { day: number | null; month: number | null; year: number | null } {
  if (!value) return { day: null, month: null, year: null };
  const [y, m, d] = value.split("-").map(Number);
  return { year: y || null, month: m || null, day: d || null };
}

/**
 * Day/month/year selection as three dropdowns — never a free-text date
 * field. `value`/`onChange` use the same "YYYY-MM-DD" shape the API already
 * expects (z.string().date()), so this drops in wherever a date input used
 * to be.
 *
 * Built on SingleSelectDropdown rather than native `<select>`s: a native
 * select's open list always includes its own placeholder option ("Day"
 * sitting above "1", "2", "3"...) mixed in with the real values, which reads
 * as a 32nd/13th choice rather than a hint. SingleSelectDropdown's list only
 * ever shows real values — the placeholder text lives in the closed box.
 *
 * Day/month/year are tracked as local state, NOT derived fresh from `value`
 * every render — `onChange` only fires once all three are picked (the parent
 * can't hold a valid date until then), so if day/month/year were derived
 * straight from `value`, picking just the month while day/year are still
 * empty would round-trip through the parent as `value = null` and the select
 * would visually snap back to "Month" on the next render. Local state lets a
 * partial pick (e.g. month only) persist on screen while waiting for the rest.
 */
export function DateDropdownPicker({
  value,
  onChange,
  minYear = 1950,
  maxYear = new Date().getFullYear() + 1,
  disabled = false,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  minYear?: number;
  maxYear?: number;
  disabled?: boolean;
}) {
  const [day, setDay] = useState<number | null>(() => parse(value).day);
  const [month, setMonth] = useState<number | null>(() => parse(value).month);
  const [year, setYear] = useState<number | null>(() => parse(value).year);

  // Follow the parent only when it actually changes `value` out from under
  // us (e.g. a form reset) — doesn't fight an in-progress partial pick,
  // since a partial pick never changes `value` (it stays null until complete).
  useEffect(() => {
    const p = parse(value);
    setDay(p.day);
    setMonth(p.month);
    setYear(p.year);
  }, [value]);

  const maxDay = month && year ? daysInMonth(year, month) : 31;

  function update(nextDay: number | null, nextMonth: number | null, nextYear: number | null) {
    setDay(nextDay);
    setMonth(nextMonth);
    setYear(nextYear);
    if (nextDay && nextMonth && nextYear) {
      const cappedDay = Math.min(nextDay, daysInMonth(nextYear, nextMonth));
      onChange(`${nextYear}-${pad(nextMonth)}-${pad(cappedDay)}`);
    } else {
      onChange(null);
    }
  }

  const dayOptions = Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => ({ value: String(d), label: String(d) }));
  const monthOptions = MONTHS.map((label, i) => ({ value: String(i + 1), label }));
  const years: number[] = [];
  for (let y = maxYear; y >= minYear; y--) years.push(y);
  const yearOptions = years.map((y) => ({ value: String(y), label: String(y) }));

  return (
    <div className="grid grid-cols-3 gap-1.5">
      <SingleSelectDropdown
        value={day !== null ? String(day) : null}
        options={dayOptions}
        placeholder="Day"
        disabled={disabled}
        searchable={false}
        onChange={(v) => update(v ? Number(v) : null, month, year)}
      />
      <SingleSelectDropdown
        value={month !== null ? String(month) : null}
        options={monthOptions}
        placeholder="Month"
        disabled={disabled}
        searchable={false}
        onChange={(v) => update(day, v ? Number(v) : null, year)}
      />
      <SingleSelectDropdown
        value={year !== null ? String(year) : null}
        options={yearOptions}
        placeholder="Year"
        disabled={disabled}
        searchable={false}
        onChange={(v) => update(day, month, v ? Number(v) : null)}
      />
    </div>
  );
}
