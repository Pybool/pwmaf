import { I as IAuthConfig } from './types-B7XcHCt8.js';

type ValidationLevel = "error" | "warning";
interface ValidationIssue {
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
declare class ConfigValidationError extends Error {
    readonly errors: ValidationIssue[];
    readonly warnings: ValidationIssue[];
    readonly allIssues: ValidationIssue[];
    constructor(issues: ValidationIssue[]);
}

declare function validateConfig(config: IAuthConfig): void;

export { ConfigValidationError as C, type ValidationIssue as V, type ValidationLevel as a, validateConfig as v };
