#!/usr/bin/env node
/**
 * init.ts  (compiled to init.js, exposed as `npx pwmaf init`)
 * ─────────────────────────────────────────────────────────────────────────────
 * Interactive CLI that walks a QA through picking their auth setup and writes
 * ready-to-fly config files to disk.
 *
 * Usage:
 *   npx pwmaf init                        → interactive prompts
 *   npx pwmaf init --preset browser-email-password   → skip prompts, use preset
 *   npx pwmaf init --list-presets         → print all available presets
 *   npx pwmaf init --dry-run              → print config, don't write files
 *
 * No dependencies beyond Node built-ins — readline is used for prompts so
 * this works in any environment without installing enquirer/inquirer.
 */
declare function writeFiles(output: ReturnType<any>, args: string[]): Promise<void>;

export { writeFiles };
