import { readFile } from "node:fs/promises";
import { Pool } from "pg";

export async function migrate(databaseUrl: string): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const sql = await readFile(new URL("./migrations/001_initial.sql", import.meta.url), "utf8");
    await pool.query(sql);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll("\\", "/")}`).href) {
  const databaseUrl = process.env.MERGEPILOT_DATABASE_URL;
  if (!databaseUrl) throw new Error("MERGEPILOT_DATABASE_URL is required");
  await migrate(databaseUrl);
}
