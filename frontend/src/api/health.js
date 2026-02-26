export async function fetchHealth() {
  const response = await fetch("/api/health");
  if (!response.ok) {
    throw new Error(`Health check failed (${response.status})`);
  }
  return response.json();
}
