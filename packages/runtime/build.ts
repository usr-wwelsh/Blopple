import { build } from "esbuild";

await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  outfile: "dist/game.js",
});

console.log("runtime build done");
