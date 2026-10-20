import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createAppServer } from "../src/server.js";

async function withServer(run) {
  const directory = await mkdtemp(join(tmpdir(), "task-engine-server-"));
  const server = createAppServer({ dataFile: join(directory, "tasks.json") });
  server.listen(0, "127.0.0.1");

  try {
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    if (server.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
    await rm(directory, { recursive: true, force: true });
  }
}

async function sendJson(url, method, body) {
  return fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

test("serves the HTML, CSS, and browser JavaScript", async () => {
  await withServer(async (baseUrl) => {
    const page = await fetch(baseUrl);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type"), /text\/html/);
    assert.match(await page.text(), /Task Engine/);

    const stylesheet = await fetch(`${baseUrl}/styles.css`);
    assert.equal(stylesheet.status, 200);
    assert.match(stylesheet.headers.get("content-type"), /text\/css/);

    const script = await fetch(`${baseUrl}/app.js`);
    assert.equal(script.status, 200);
    assert.match(script.headers.get("content-type"), /javascript/);
  });
});

test("supports listing, creating, completing, and deleting tasks", async () => {
  await withServer(async (baseUrl) => {
    const initialTasks = await fetch(`${baseUrl}/api/tasks`);
    assert.equal(initialTasks.status, 200);
    assert.deepEqual(await initialTasks.json(), []);

    const createdResponse = await sendJson(`${baseUrl}/api/tasks`, "POST", {
      title: "Test the API"
    });
    assert.equal(createdResponse.status, 201);
    const createdTask = await createdResponse.json();
    assert.equal(createdTask.title, "Test the API");
    assert.equal(createdTask.completed, false);
    assert.ok(createdTask.id);

    const updatedResponse = await sendJson(
      `${baseUrl}/api/tasks/${encodeURIComponent(createdTask.id)}`,
      "PATCH",
      { completed: true }
    );
    assert.equal(updatedResponse.status, 200);
    assert.equal((await updatedResponse.json()).completed, true);

    const listedResponse = await fetch(`${baseUrl}/api/tasks`);
    assert.deepEqual(await listedResponse.json(), [
      { ...createdTask, completed: true }
    ]);

    const deletedResponse = await fetch(
      `${baseUrl}/api/tasks/${encodeURIComponent(createdTask.id)}`,
      { method: "DELETE" }
    );
    assert.equal(deletedResponse.status, 200);
    assert.deepEqual(await deletedResponse.json(), { deleted: true });

    const finalResponse = await fetch(`${baseUrl}/api/tasks`);
    assert.deepEqual(await finalResponse.json(), []);
  });
});

test("returns a client error when the task title is blank", async () => {
  await withServer(async (baseUrl) => {
    const response = await sendJson(`${baseUrl}/api/tasks`, "POST", { title: "  " });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Task title is required." });
  });
});

test("returns a client error for malformed JSON", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{invalid json"
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Request body must be valid JSON." });
  });
});

test("returns not found for unknown API routes and task IDs", async () => {
  await withServer(async (baseUrl) => {
    const unknownRoute = await fetch(`${baseUrl}/api/unknown`);
    assert.equal(unknownRoute.status, 404);
    assert.deepEqual(await unknownRoute.json(), { error: "Not found." });

    const unknownTask = await sendJson(`${baseUrl}/api/tasks/missing`, "PATCH", {
      completed: true
    });
    assert.equal(unknownTask.status, 404);
    assert.deepEqual(await unknownTask.json(), { error: "Task not found." });

    const unknownDelete = await fetch(`${baseUrl}/api/tasks/missing`, {
      method: "DELETE"
    });
    assert.equal(unknownDelete.status, 404);
    assert.deepEqual(await unknownDelete.json(), { error: "Task not found." });
  });
});
