import { readFile } from "node:fs/promises";
import { build } from "esbuild";

const pkg = JSON.parse(await readFile(new URL("package.json", import.meta.url)));

const workspaceDeps = new Set(
  Object.entries(pkg.dependencies ?? {})
    .filter(([, version]) => version === "*" || version.startsWith("workspace:"))
    .map(([name]) => name),
);

const external = Object.keys(pkg.dependencies ?? {}).filter(
  (name) => !workspaceDeps.has(name),
);

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: true,
  external,
  logLevel: "info",
});

console.log(
  `bundled ${[...workspaceDeps].join(", ") || "no workspace deps"}; ` +
    `${external.length} packages left external`,
);
