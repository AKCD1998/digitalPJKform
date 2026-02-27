import client from "./client.js";

export async function listBranches() {
  const response = await client.get("/branches");
  return response.data;
}

export async function getBranchById(branchId) {
  const response = await client.get(`/branches/${branchId}`);
  return response.data;
}
