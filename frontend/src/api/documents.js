import client from "./client.js";

const DEFAULT_TEMPLATE_KEY = "form_gor_gor_1";

function parseFileNameFromContentDisposition(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const basicMatch = value.match(/filename="([^"]+)"/i) || value.match(/filename=([^;]+)/i);
  if (!basicMatch?.[1]) {
    return null;
  }

  return basicMatch[1].trim();
}

export async function generateDocumentPdf(formData) {
  return generateDocumentPdfWithOptions(
    { formData, templateKey: DEFAULT_TEMPLATE_KEY },
    { save: false }
  );
}

export async function generateDocumentPdfWithOptions(payload, options = {}) {
  const formData =
    payload && typeof payload === "object" && "formData" in payload ? payload.formData : payload;
  const templateKey =
    payload && typeof payload === "object" && "templateKey" in payload
      ? payload.templateKey
      : DEFAULT_TEMPLATE_KEY;

  const params = {};
  if (options.save) {
    params.save = "true";
  }

  const response = await client.post(
    "/documents/generate",
    { formData, templateKey },
    { responseType: "blob", params }
  );

  const fileName = parseFileNameFromContentDisposition(
    response.headers["content-disposition"]
  );

  return {
    blob: response.data,
    fileName: fileName || "document.pdf",
    documentId: response.headers["x-document-id"] || null,
  };
}

export async function listRecentDocuments(limit = 10) {
  const response = await client.get("/documents/recent", {
    params: { limit },
  });

  return response.data;
}

export async function generatePdfFromSavedDocument(documentId) {
  const response = await client.get(`/documents/${documentId}`, {
    params: { format: "pdf" },
    responseType: "blob",
  });

  const fileName = parseFileNameFromContentDisposition(
    response.headers["content-disposition"]
  );

  return {
    blob: response.data,
    fileName: fileName || `document-${documentId}.pdf`,
    documentId: response.headers["x-document-id"] || documentId,
  };
}

export async function getTemplateDebugGrid(templateKey = DEFAULT_TEMPLATE_KEY) {
  const response = await client.get("/documents/debug-grid", {
    params: { templateKey },
    responseType: "blob",
  });

  const fileName = parseFileNameFromContentDisposition(
    response.headers["content-disposition"]
  );

  return {
    blob: response.data,
    fileName: fileName || `debug-grid-${templateKey}.pdf`,
  };
}
