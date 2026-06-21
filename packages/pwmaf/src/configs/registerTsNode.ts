import fs from "fs";
import path from "path";

export function registerTsNodeIfNeeded(projectRoot: string) {
  const tsNodePath = path.join(
    projectRoot,
    "node_modules",
    "ts-node",
    "register"
  );

  if (!fs.existsSync(tsNodePath)) {
    throw new Error(
      `[auth-config] ts-node not installed in project.\n` +
      `Run: npm install -D ts-node`
    );
  }

  try {
    require(tsNodePath);
  } catch {
    throw new Error(
      `[auth-config] Failed to load ts-node from project.\n` +
      `Path: ${tsNodePath}`
    );
  }
}