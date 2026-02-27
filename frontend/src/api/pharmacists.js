import client from "./client.js";

export async function listPartTimePharmacists() {
  const response = await client.get("/pharmacists/part-time");
  return response.data;
}
