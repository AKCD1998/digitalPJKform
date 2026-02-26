export function notFoundHandler(_req, res) {
  return res.status(404).json({ error: "Not found" });
}

export function errorHandler(err, _req, res, _next) {
  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}
