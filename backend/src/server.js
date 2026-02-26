import "dotenv/config";
import app from "./app.js";
import { loadBranchConfigs } from "./services/branchConfigService.js";

const port = process.env.PORT || 5000;

async function startServer() {
  const branches = await loadBranchConfigs();
  console.log(`Loaded ${branches.length} branch config file(s).`);

  app.listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
