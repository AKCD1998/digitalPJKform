import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const routeFallbacks = ["login", "form"];

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(currentDir, "..", "dist");
const indexPath = path.join(distDir, "index.html");

async function createRouteFallbacks() {
  const indexHtml = await fs.readFile(indexPath, "utf8");

  await Promise.all(
    routeFallbacks.map((route) => fs.writeFile(path.join(distDir, route), indexHtml, "utf8"))
  );
}

createRouteFallbacks().catch((error) => {
  console.error("Failed to create Render route fallbacks:", error);
  process.exitCode = 1;
});
