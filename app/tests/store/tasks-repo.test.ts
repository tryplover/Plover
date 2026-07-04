import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { TasksRepo } from "../../src/main/store/repos/tasks";
import { GoalsRepo } from "../../src/main/store/repos/goals";
import { runMigrations } from "../../src/main/store/db";
import { randomUUID } from "node:crypto";

describe("TasksRepo", () => {
  let db: Database.Database;
  let tasksRepo: TasksRepo;
  let goalsRepo: GoalsRepo;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    tasksRepo = new TasksRepo(db);
    goalsRepo = new GoalsRepo(db);
  });

  it("should create and retrieve a task", () => {
    const goal = goalsRepo.create({
      title: "Test Goal",
      status: "active",
    });
    const taskInput = {
      goal_id: goal.id,
      title: "Test Task",
      estimate_minutes: 30,
      status: "todo" as const,
    };
    const task = tasksRepo.create(taskInput);
    const retrieved = tasksRepo.get(task.id);
    expect(retrieved).toEqual(task);
  });

  it("should update task status", () => {
    const goal = goalsRepo.create({
      title: "Test Goal",
      status: "active",
    });
    const task = tasksRepo.create({
      goal_id: goal.id,
      title: "Test Task",
      status: "todo" as const,
    });
    tasksRepo.update(task.id, { status: "done" });
    const updated = tasksRepo.get(task.id);
    expect(updated?.status).toBe("done");
  });

  it("should handle depends_on as an array", () => {
    const goal = goalsRepo.create({
      title: "Test Goal",
      status: "active",
    });
    const dep1 = "task-1";
    const dep2 = "task-2";
    const task = tasksRepo.create({
      goal_id: goal.id,
      title: "Test Task",
      status: "todo" as const,
      depends_on: [dep1, dep2],
    });
    const retrieved = tasksRepo.get(task.id);
    expect(retrieved?.depends_on).toEqual([dep1, dep2]);
  });
});
