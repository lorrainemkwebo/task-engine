import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { TaskStore } from "../src/task-store.js";

async function withStore(run) {
  const directory = await mkdtemp(join(tmpdir(), "task-engine-"));

  try {
    await run({
      directory,
      filePath: join(directory, "tasks.json"),
      store: new TaskStore(join(directory, "tasks.json"))
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("starts with an empty task list when no data file exists", async () => {
  await withStore(async ({ store }) => {
    assert.deepEqual(await store.list(), []);
  });
});

test("creates a task with a trimmed title and persists it", async () => {
  await withStore(async ({ filePath, store }) => {
    const task = await store.create("  Write tests  ");

    assert.equal(task.title, "Write tests");
    assert.equal(task.completed, false);
    assert.equal(typeof task.id, "string");
    assert.ok(task.id.length > 0);
    assert.equal(typeof task.createdAt, "string");
    assert.ok(Number.isFinite(Date.parse(task.createdAt)));
    assert.deepEqual(await store.list(), [task]);

    const savedTasks = JSON.parse(await readFile(filePath, "utf8"));
    assert.deepEqual(savedTasks, [task]);
  });
});

test("loads tasks persisted by an earlier store instance", async () => {
  await withStore(async ({ filePath }) => {
    const firstStore = new TaskStore(filePath);
    const task = await firstStore.create("Persist between instances");
    const secondStore = new TaskStore(filePath);

    assert.deepEqual(await secondStore.list(), [task]);
  });
});

test("rejects blank task titles", async () => {
  await withStore(async ({ store }) => {
    await assert.rejects(store.create("  "), {
      name: "TypeError",
      message: "Task title is required."
    });
    assert.deepEqual(await store.list(), []);
  });
});

test("updates an existing task and returns null for an unknown task", async () => {
  await withStore(async ({ store }) => {
    const task = await store.create("Update me");

    const updatedTask = await store.update(task.id, { completed: true });
    assert.equal(updatedTask.id, task.id);
    assert.equal(updatedTask.completed, true);
    assert.equal((await store.list())[0].completed, true);
    assert.equal(await store.update("missing-task", { completed: false }), null);
  });
});

test("rejects a non-boolean completion value", async () => {
  await withStore(async ({ store }) => {
    const task = await store.create("Keep a valid status");

    await assert.rejects(store.update(task.id, { completed: "yes" }), {
      name: "TypeError",
      message: "Task completion status must be a boolean."
    });
    assert.equal((await store.list())[0].completed, false);
  });
});

test("deletes an existing task and returns false when it is already absent", async () => {
  await withStore(async ({ store }) => {
    const task = await store.create("Delete me");

    assert.equal(await store.delete(task.id), true);
    assert.equal(await store.delete(task.id), false);
    assert.deepEqual(await store.list(), []);
  });
});
