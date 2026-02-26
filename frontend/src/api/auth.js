import client from "./client.js";

export async function login(payload) {
  const response = await client.post("/auth/login", payload);
  return response.data;
}

export async function me() {
  const response = await client.get("/me");
  return response.data;
}
