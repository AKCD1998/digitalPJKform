import "dotenv/config";
import { Pool } from "pg";

const isProduction = process.env.NODE_ENV === "production";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

export async function closePool() {
  await pool.end();
}
