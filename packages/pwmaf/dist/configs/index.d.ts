export { C as ConfigValidationError, V as ValidationIssue, a as ValidationLevel, v as validateConfig } from '../validate-config-vFApfE7o.js';
import { I as IAuthConfig } from '../types-B7XcHCt8.js';
import '@playwright/test';

declare function findProjectRoot(startDir?: string): string;
declare function createAuthConfig(usersPath: string): Promise<IAuthConfig>;

export { createAuthConfig, findProjectRoot };
