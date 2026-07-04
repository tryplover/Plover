import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { GoalsRepo } from "../../src/main/store/repos/goals";
import { runMigrations } from "../../src/main/store/db";

describe("GoalsRepo", () => {
  let db: Database.Database;
  let goalsRepo: GoalsRepo;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    goalsRepo = new GoalsRepo(db);
  });

  it("should create and retrieve a goal", () => {
    const goal = goalsRepo.create({
      title: "Test Goal",
      status: "active",
    });
    const retrieved = goalsRepo.get(goal.id);
    expect(retrieved).toEqual(goal);
  });

  it("should update goal status", () => {
    const goal = goalsRepo.create({
      title: "Test Goal",
      status: "active",
    });
    goalsRepo.update(goal.id, { status: "done" });
    const updated = goalsRepo.get(goal.id);
    expect(updated?.status).toBe("done");
  });
});
