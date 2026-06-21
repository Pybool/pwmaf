export { C as ConfigValidationError, V as ValidationIssue, a as ValidationLevel, v as validateConfig } from '../validate-config-BphwjBWm.mjs';
import { I as IAuthConfig } from '../types-B7XcHCt8.mjs';
import '@playwright/test';

declare function findProjectRoot(startDir?: string): string;
declare function createAuthConfig(usersPath: string): Promise<IAuthConfig>;

export { createAuthConfig, findProjectRoot };
