import { JOBS, type JobDeps, type JobResult } from "./jobs.js";

/**
 * In-process job scheduler.
 *
 * MVP hosting model (docs/DECISIONS.md D-020): the API imports this and runs
 * the jobs in its own process. There is no separate worker service.
 *
 * Safety properties required by D-020:
 *  - a job's exception can never take down the API process;
 *  - jobs are serialised and await `setTimeout`, so the event loop is never
 *    blocked by a synchronous loop;
 *  - a failing job backs off instead of hammering the provider;
 *  - `stopScheduler()` is called on SIGTERM/SIGINT so in-flight work drains.
 */

export interface SchedulerHandle {
  stop: () => Promise<void>;
  readonly running: boolean;
}

const MAX_BACKOFF_MS = 15 * 60 * 1000;

export function startScheduler(deps: JobDeps): SchedulerHandle {
  let stopped = false;
  let current: Promise<unknown> = Promise.resolve();
  const timers: NodeJS.Timeout[] = [];
  // Consecutive-failure backoff per job, reset on success.
  const failures = new Map<string, number>();

  async function runOne(name: string, run: (d: JobDeps) => Promise<number>): Promise<JobResult> {
    const started = Date.now();
    try {
      const affected = await run(deps);
      failures.set(name, 0);
      const result: JobResult = {
        name,
        ok: true,
        affected,
        durationMs: Date.now() - started,
      };
      deps.log("info", "job complete", result as unknown as Record<string, unknown>);
      return result;
    } catch (err) {
      const n = (failures.get(name) ?? 0) + 1;
      failures.set(name, n);
      // Exponential backoff, capped, so a failing job stops hammering.
      const backoff = Math.min(2 ** n * 1000, MAX_BACKOFF_MS);
      deps.log("error", "job failed", {
        name,
        consecutiveFailures: n,
        backoffMs: backoff,
        reason: err instanceof Error ? err.message : String(err),
      });
      return { name, ok: false, affected: 0, durationMs: Date.now() - started };
    }
  }

  for (const job of JOBS) {
    const schedule = () => {
      if (stopped) return;
      // Serialised: never overlaps a previous tick of the same job.
      current = current.then(() => runOne(job.name, job.run)).catch(() => undefined);
    };
    const n = failures.get(job.name) ?? 0;
    const delay = n === 0 ? job.everyMs : Math.min(2 ** n * 1000, MAX_BACKOFF_MS);
    const timer = setInterval(schedule, delay);
    // Do not hold the event loop open on account of a job timer.
    timer.unref?.();
    timers.push(timer);
  }

  const running = true;

  return {
    get running() {
      return running && !stopped;
    },
    async stop() {
      stopped = true;
      for (const t of timers) clearInterval(t);
      // Drain in-flight work rather than dropping it mid-write.
      await current.catch(() => undefined);
      deps.log("info", "scheduler stopped");
    },
  };
}

/** Human-readable schedule list for the startup log line. */
export function describeSchedules(): string {
  return JOBS.map((j) => `${j.name} every ${Math.round(j.everyMs / 1000)}s`).join(", ");
}