import "dotenv/config";
import cors from "cors";
import express from "express";
import adminRoutes from "./routes/admin.routes.js";
import authRoutes from "./routes/auth.routes.js";
import branchesRoutes from "./routes/branches.routes.js";
import documentsRoutes from "./routes/documents.routes.js";
import healthRoutes from "./routes/health.routes.js";
import pharmacistsRoutes from "./routes/pharmacists.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";

const app = express();
const corsOrigin = process.env.CORS_ORIGIN || "*";

app.use(
  cors({
    origin: corsOrigin === "*" ? true : corsOrigin.split(","),
  })
);
app.use(express.json());

app.use("/api", healthRoutes);
app.use("/api", authRoutes);
app.use("/api", branchesRoutes);
app.use("/api", adminRoutes);
app.use("/api", documentsRoutes);
app.use("/api", pharmacistsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
