// ─────────────────────────────────────────────────────────────────────────────
// ConfigValidationError
//
// Thrown by validateConfig() when the assembled IAuthConfig has structural
// problems.  All issues (errors AND warnings) are collected before throwing so
// the QA sees everything at once instead of fixing one mistake at a time.
// ─────────────────────────────────────────────────────────────────────────────

export type ValidationLevel = "error" | "warning";

export interface ValidationIssue {
  /** Severity — errors abort setup; warnings print but let setup continue. */
  level: ValidationLevel;

  /**
   * Machine-readable code for the specific rule that fired.
   * Useful for suppressing known false-positives in unusual setups.
   * e.g. "OTP_CONFIG_MISSING", "TOKEN_HEADER_NAME_MISSING"
   */
  code: string;

  /**
   * Dot-notation path to the offending field inside IAuthConfig / IUser.
   * e.g. "otpConfig.requestConfig.baseUrl"
   *      "users[\"admin@test.com\"].apiConfig.tokenHeaderName"
   */
  field: string;

  /** Human-readable explanation of what is wrong. */
  message: string;

  /** Optional suggestion for how to fix the issue. */
  hint?: string;

  /**
   * Set when the issue originates from a specific user entry.
   * Matches IUser.username so the QA knows which row in users.json to fix.
   */
  user?: string;
}

// ─── formatting helpers

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";

function formatIssue(issue: ValidationIssue, index: number): string {
  const colour = issue.level === "error" ? RED : YELLOW;
  const tag = issue.level === "error" ? "✖ ERROR" : "⚠ WARNING";
  const counter = `[${index + 1}]`;

  const lines: string[] = [
    `  ${colour}${BOLD}${counter} ${tag}${RESET}  ${DIM}(${issue.code})${RESET}`,
    `     ${BOLD}Field  :${RESET} ${CYAN}${issue.field}${RESET}`,
    `     ${BOLD}Problem:${RESET} ${issue.message}`,
  ];

  if (issue.hint) {
    lines.push(`     ${BOLD}Fix    :${RESET} ${DIM}${issue.hint}${RESET}`);
  }

  if (issue.user) {
    lines.push(`     ${BOLD}User   :${RESET} ${DIM}${issue.user}${RESET}`);
  }

  return lines.join("\n");
}

// ─── error class ─────────────────────────────────────────────────────────────

export class ConfigValidationError extends Error {
  public readonly errors: ValidationIssue[];
  public readonly warnings: ValidationIssue[];
  public readonly allIssues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    const errors = issues.filter((i) => i.level === "error");
    const warnings = issues.filter((i) => i.level === "warning");

    // ── Build the terminal-friendly message ───────────────────────────────

    const header = [
      "",
      `${RED}${BOLD}╔══════════════════════════════════════════════════════════╗${RESET}`,
      `${RED}${BOLD}║         PWMAF — Config Validation Failed                 ║${RESET}`,
      `${RED}${BOLD}╚══════════════════════════════════════════════════════════╝${RESET}`,
      "",
      `  Found ${RED}${BOLD}${errors.length} error(s)${RESET} and ${YELLOW}${warnings.length} warning(s)${RESET}.`,
      `  Errors must be fixed before global setup will run.`,
      `  Warnings will not block setup but may cause subtle test failures.`,
      "",
    ].join("\n");

    const errorSection =
      errors.length > 0
        ? [
            `  ${RED}${BOLD}── Errors ──────────────────────────────────────────────${RESET}`,
            "",
            ...errors.map((issue, i) => formatIssue(issue, i)),
            "",
          ].join("\n")
        : "";

    const warnSection =
      warnings.length > 0
        ? [
            `  ${YELLOW}${BOLD}── Warnings${RESET}`,
            "",
            ...warnings.map((issue, i) =>
              formatIssue(issue, errors.length + i),
            ),
            "",
          ].join("\n")
        : "";

    const footer = [
      `  ${DIM}Config file : pwmaf.config.ts${RESET}`,
      `  ${DIM}Users file  : src/data/users.json (or AUTH_USERS_FILE env var)${RESET}`,
      "",
    ].join("\n");

    super([header, errorSection, warnSection, footer].join("\n"));

    this.name = "ConfigValidationError";
    this.errors = errors;
    this.warnings = warnings;
    this.allIssues = issues;

    // Preserve stack from the calling site
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConfigValidationError);
    }
  }
}
