import fs from "fs";
import path from "path";

export function findProjectRoot(startDir: string = process.cwd()): string {
  let dir = startDir;

  while (true) {
    const pkgPath = path.join(dir, "package.json");

    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

        // optional safety: ensure it's a real app root
        // (not inside node_modules of a dependency)
        if (pkg && typeof pkg === "object") {
          return dir;
        }
      } catch {
        // ignore invalid json and continue upward
      }
    }

    const parent = path.dirname(dir);

    if (parent === dir) {
      // reached filesystem root
      return startDir;
    }

    dir = parent;
  }
}