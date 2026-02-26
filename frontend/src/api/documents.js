import client from "./client.js";

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
  return generateDocumentPdfWithOptions(formData, { save: false });
}

export async function generateDocumentPdfWithOptions(formData, options = {}) {
  const params = {};
  if (options.save) {
    params.save = "true";
  }

  const response = await client.post(
    "/documents/generate",
    { formData },
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
