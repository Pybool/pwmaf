import fs from "fs";
import path from "path";

export function findProjectRoot(startDir: string = process.cwd()): string {
  let dir = startDir;

  while (true) {
    const pkgPath = path.join(dir, "package.json");

    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

        if (pkg && typeof pkg === "object") {
          return dir;
        }
      } catch {}
    }

    const parent = path.dirname(dir);

    if (parent === dir) {
      return startDir;
    }

    dir = parent;
  }
}
