/**
 * The machine load reported next to every timing measurement (bug-001): a timing test is only
 * meaningful on a quiet machine, so its output says how quiet the machine was.
 */
import { readFileSync } from 'node:fs';
import { cpus, loadavg } from 'node:os';

/** `/proc/loadavg` as read (Linux), else the 1/5/15-minute averages of `os.loadavg()`; with the core count. */
export function loadAverage(): string {
  let text: string;
  try {
    text = readFileSync('/proc/loadavg', 'utf8').trim();
  } catch {
    text = loadavg()
      .map((l) => l.toFixed(2))
      .join(' ');
  }
  return `load average ${text} (${cpus().length} cores)`;
}

/** Print one measurement line with the current load: `<label>: <value> — load average …`. */
export function report(label: string, value: string): void {
  console.info(`${label}: ${value} — ${loadAverage()}`);
}
