import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/cli/init.ts",
    "src/configs/index.ts",   // needed for "qa-pwmaf/config" export
    "src/types.ts",           // needed for "qa-pwmaf/types" export
  ],
  outDir: "dist",
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  splitting: false,
});