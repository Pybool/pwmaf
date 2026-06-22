import { IAuthConfig, IUser } from "../types";
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";
import { validateUserEndpoints } from "../utils/helpers";

dotenv.config();

export function findProjectRoot(startDir: string = process.cwd()): string {
  let dir = path.resolve(startDir);

  while (true) {
    const pkg = path.join(dir, "package.json");

    if (fs.existsSync(pkg)) {
      return dir;
    }

    const parent = path.dirname(dir);

    if (parent === dir) {
      throw new Error(
        `[auth-config] Cannot locate project root (no package.json found above "${startDir}")`,
      );
    }

    dir = parent;
  }
}

function registerTsNode(projectRoot: string): void {
  const tsNodeModule = require.resolve("ts-node", {
    paths: [projectRoot],
  });

  try {
    require(tsNodeModule).register({
      transpileOnly: true,
      files: false,
      compilerOptions: {
        module: "commonjs",
      },
    });
  } catch (err) {
    throw new Error(
      `[auth-config] Failed to register ts-node.\n` +
        `${(err as Error).message}`,
    );
  }
}

function loadAuthConfigFile(projectRoot: string): IAuthConfig {
  const tsPath = path.join(projectRoot, "base.config.ts");
  const jsPath = path.join(projectRoot, "base.config.js");

  const configPath = fs.existsSync(tsPath)
    ? tsPath
    : fs.existsSync(jsPath)
      ? jsPath
      : null;

  if (!configPath) {
    throw new Error(
      `[auth-config] Missing base.config.ts or base.config.js in project root.\n` +
        `Expected: ${tsPath}`,
    );
  }

  // Enable TS support only if needed
  if (configPath.endsWith(".ts")) {
    registerTsNode(projectRoot);
  }

  let mod: any;

  try {
    mod = require(configPath);
  } catch (err) {
    throw new Error(
      `[auth-config] Failed to load config: "${configPath}"\n` +
        `${(err as Error).message}`,
    );
  }

  const config = mod?.default ?? mod?.BASE_CONFIG ?? mod;

  if (!config || typeof config !== "object") {
    throw new Error(
      `[auth-config] Invalid config export in "${configPath}".\n` +
        `Expected: export const BASE_CONFIG or export default`,
    );
  }

  return config as IAuthConfig;
}

function loadJsonFile(filePath: string): IUser[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      throw new Error("Users JSON must be an array");
    }

    return parsed as IUser[];
  } catch (err) {
    throw new Error(
      `[auth-config] Failed to parse users JSON: "${filePath}"\n` +
        `${(err as Error).message}`,
    );
  }
}

export async function createAuthConfig(
  usersPath: string,
): Promise<IAuthConfig> {
  if (!usersPath) {
    throw new Error("[auth-config] usersPath is required");
  }

  const projectRoot = findProjectRoot();

  const config = loadAuthConfigFile(projectRoot);

  const absoluteUsersPath = path.resolve(projectRoot, usersPath);

  const users = loadJsonFile(absoluteUsersPath);

  if (process.env.VALIDATE_USER_URLS === "1") {
    await validateUserEndpoints(users);
  }

  return {
    ...config,
    users,
  };
}
