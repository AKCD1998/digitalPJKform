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
    routeFallbacks.map(async (route) => {
      const routeDirPath = path.join(distDir, route);
      const routeIndexPath = path.join(routeDirPath, "index.html");

      // Remove legacy flat fallback files (e.g. dist/login) to avoid browser download behavior.
      try {
        const routePathStat = await fs.stat(routeDirPath);
        if (routePathStat.isFile()) {
          await fs.rm(routeDirPath, { force: true });
        }
      } catch (_error) {
        // Path does not exist yet, nothing to remove.
      }

      await fs.mkdir(routeDirPath, { recursive: true });
      await fs.writeFile(routeIndexPath, indexHtml, "utf8");
    })
  );
}

createRouteFallbacks().catch((error) => {
  console.error("Failed to create Render route fallbacks:", error);
  process.exitCode = 1;
});
