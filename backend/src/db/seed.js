import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcrypt";
import { closePool, pool } from "./pool.js";
import { syncBranchesFromFiles } from "./syncBranchesFromFiles.js";

const SALT_ROUNDS = 10;

const USER_SEEDS = [
  {
    username: "admin000",
    password: "Admin@123",
    role: "admin",
    branch_code: "001",
    display_name_th: "ผู้ดูแลระบบ",
  },
  {
    username: "user001",
    password: "User@123",
    role: "user",
    branch_code: "001",
    display_name_th: "เภสัชประจำสาขาตลาดแม่กลอง",
  },
  {
    username: "user003",
    password: "User@123",
    role: "user",
    branch_code: "003",
    display_name_th: "เภสัชประจำสาขาวัดช่องลม",
  },
  {
    username: "user004",
    password: "User@123",
    role: "user",
    branch_code: "004",
    display_name_th: "เภสัชประจำสาขาตลาดบางน้อย",
  },
];

async function upsertUser(client, user, branchId) {
  const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);
  const params = [
    user.username,
    passwordHash,
    user.role,
    branchId,
    user.display_name_th,
  ];

  const result = await client.query(
    `
    INSERT INTO users (
      username,
      password_hash,
      role,
      branch_id,
      display_name_th
    )
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (username) DO UPDATE
    SET
      password_hash = EXCLUDED.password_hash,
      role = EXCLUDED.role,
      branch_id = EXCLUDED.branch_id,
      display_name_th = EXCLUDED.display_name_th,
      updated_at = NOW()
    RETURNING id, username;
    `,
    params
  );

  return result.rows[0];
}

export async function runSeed() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to run seed.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const syncedBranches = await syncBranchesFromFiles(client);
    const branchIdByCode = new Map(
      syncedBranches.map((branch) => [branch.branch_code, branch.id])
    );

    let adminUserId = null;
    for (const user of USER_SEEDS) {
      const branchId = branchIdByCode.get(user.branch_code);
      if (!branchId) {
        throw new Error(`Missing branch for code ${user.branch_code}`);
      }

      const row = await upsertUser(client, user, branchId);
      if (row.username === "admin000") {
        adminUserId = row.id;
      }
    }

    await client.query(
      `
      INSERT INTO global_settings (
        id,
        use_system_date,
        forced_date,
        updated_by
      )
      VALUES (1, TRUE, NULL, $1)
      ON CONFLICT (id) DO UPDATE
      SET
        use_system_date = EXCLUDED.use_system_date,
        forced_date = EXCLUDED.forced_date,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW();
      `,
      [adminUserId]
    );

    await client.query("COMMIT");
    console.log("Seed complete.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  runSeed()
    .catch((error) => {
      console.error("Seed failed:", error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await closePool();
    });
}
