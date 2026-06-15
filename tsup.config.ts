// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/cli/init.ts"
  ],
  outDir: "dist",
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  splitting: false,
});