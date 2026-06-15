import { IAuthConfig, IUser } from "../types";
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Shape of the pwmaf.config.ts the consuming project must provide at its root.
 * Example:
 *   export default {
 *     usersPath: "./test-data/users.json",
 *   } satisfies IAuthConfig;
 */

/**
 * Walks up the directory tree from `startDir` until it finds a folder
 * containing package.json — that folder is the consuming project's root.
 *
 * Starting from process.cwd() (not __dirname) means we always anchor to
 * wherever the QA is running their tests, not deep inside node_modules.
 */
export function findProjectRoot(startDir: string = process.cwd()): string {
  let dir = path.resolve(startDir);

  while (true) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      // Hit the filesystem root without finding package.json
      throw new Error(
        `[auth-config] Cannot locate project root: no package.json found above "${startDir}"`,
      );
    }
    dir = parent;
  }
}

/**
 * Resolves and requires pwmaf.config.ts (preferred) or pwmaf.config.js (fallback)
 * from the given project root. Registers ts-node on demand so .ts configs
 * work without a pre-compile step.
 */
export function loadAuthConfigFile(projectRoot: string): IAuthConfig {
  const tsPath = path.join(projectRoot, "pwmaf.config.ts");
  const jsPath = path.join(projectRoot, "pwmaf.config.js");

  const configPath = fs.existsSync(tsPath)
    ? tsPath
    : fs.existsSync(jsPath)
      ? jsPath
      : null;

  if (!configPath) {
    throw new Error(
      `[auth-config] No pwmaf.config.ts or pwmaf.config.js found in project root: "${projectRoot}"\n` +
        `  Create one at: ${tsPath}`,
    );
  }

  if (configPath.endsWith(".ts")) {
    const alreadyRegistered = !!(process as any)[
      Symbol.for("ts-node.register.instance")
    ];

    if (!alreadyRegistered) {
      try {
        require("ts-node").register({ transpileOnly: true });
      } catch {
        throw new Error(
          `[auth-config] Found "${configPath}" but ts-node is not installed.\n` +
            `  Fix: npm install -D ts-node`,
        );
      }
    }
  }

  let mod: { default?: IAuthConfig } | IAuthConfig;
  try {
    mod = require(configPath);
  } catch (err) {
    throw new Error(
      `[auth-config] Failed to load "${configPath}": ${(err as Error).message}`,
    );
  }

  const resolvedMod = (mod as any).default ?? mod;
  const config = resolvedMod?.BASE_CONFIG;

  if (!config) {
    throw new Error(
      `[auth-config] BASE_CONFIG not found in "${configPath}". Ensure config exports { BASE_CONFIG }`,
    );
  }

  if (!Object.keys(config).length)
    throw new Error("Invalid configuration in pwmaf.config");

  return config;
}

function loadJsonFile(absolutePath: string): IUser[] {
  if (!fs.existsSync(absolutePath)) {
    console.warn(`[auth-config] Users file not found: ${absolutePath}`);
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf-8")) as IUser[];
  } catch {
    throw new Error(
      `[auth-config] Failed to parse users JSON: "${absolutePath}"`,
    );
  }
}

/**
 * Automatically discovers pwmaf.config.ts at the consuming project's root
 * (detected via package.json traversal), loads users from the path it declares,
 * and returns a fully resolved IAuthConfig.
 *
 * QAs no longer pass usersPath manually — it lives in their pwmaf.config.ts.
 */
export function createAuthConfig(usersPath: string): IAuthConfig {
  if (!usersPath) throw new Error("Please provide a valid usersPath store");
  const projectRoot = findProjectRoot();
  const config = loadAuthConfigFile(projectRoot);
  const absoluteUsersPath = path.resolve(projectRoot, usersPath);
  config.users = loadJsonFile(absoluteUsersPath);
  return config;
}

// export function getUsersFilePath(
//   config: IAuthConfig): string {
//   return (
//     (config.isApi
//       ? "src/data/users.api.json"
//       : "src/data/users.json")
//   );
// }



// (process.env.USE_API === 'true') || false