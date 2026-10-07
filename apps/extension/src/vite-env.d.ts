/// <reference types="vite/client" />

/**
 * Build stamp, injected by `define` in both vite configs.
 *
 * This exists because of one specific operational failure: reloading an unpacked
 * extension does NOT re-inject a content script into an already-open tab, so
 * "I reloaded and nothing changed" is indistinguishable from "the new build
 * never shipped". Printing this value in the page console and in the popup makes
 * the running build identifiable instead of assumed.
 */
declare const __PASS_BUILD__: string;
