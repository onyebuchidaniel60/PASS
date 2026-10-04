/**
 * @pass/worker public API.
 *
 * Importing this package starts nothing. The API imports `startScheduler`
 * when ENABLE_JOBS=true (docs/DECISIONS.md D-020). `main.ts` remains the
 * entry point for the future standalone worker service.
 */
export * from "./jobs.js";
export * from "./schedule.js";