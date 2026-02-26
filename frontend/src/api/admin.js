import client from "./client.js";

export async function getAdminSettings() {
  const response = await client.get("/admin/settings");
  return response.data;
}

export async function updateAdminSettings(payload) {
  const response = await client.put("/admin/settings", payload);
  return response.data;
}
