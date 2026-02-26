import { Router } from "express";
import {
  generateDocumentPdf,
  getDocumentByIdHandler,
  getRecentDocumentsHandler,
} from "../controllers/documents.controller.js";
import { authRequired } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/documents/generate", authRequired, generateDocumentPdf);
router.get("/documents/recent", authRequired, getRecentDocumentsHandler);
router.get("/documents/:id", authRequired, getDocumentByIdHandler);

export default router;
