import { afterAll, beforeAll, describe } from "vitest";
import { PostgresRepository } from "../src/db/postgres-repository.js";
import { migrate } from "../src/db/migrate.js";
import { repositoryContract } from "./repository.contract.test.js";

const databaseUrl = process.env.MERGEPILOT_TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("PostgreSQL persistence", () => {
  let repo: PostgresRepository;

  beforeAll(async () => {
    await migrate(databaseUrl!);
    repo = new PostgresRepository(databaseUrl!);
  });

  repositoryContract("PostgresRepository", async () => repo);

  afterAll(async () => {
    await repo?.close();
  });
});
