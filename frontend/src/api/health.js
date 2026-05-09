import client from "./client.js";

export async function fetchHealth() {
  const response = await client.get("/health");
  return response.data;
}
