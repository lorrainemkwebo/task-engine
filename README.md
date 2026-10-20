# Task Engine

A small Node.js task-management application with a browser interface and a JSON
HTTP API. The API contract covered by the test suite supports listing,
creating, completing, and deleting tasks.

## Requirements

- Node.js 20 or later
- npm

## Getting started

Install the project dependencies and start the server:

```sh
npm ci
npm start
```

The server serves the web application and its static assets. The application
can also be exercised through the API endpoints below.

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/tasks` | List all tasks |
| `POST` | `/api/tasks` | Create a task with a JSON body such as `{"title":"Plan the week"}` |
| `PATCH` | `/api/tasks/:id` | Update a task, for example with `{"completed":true}` |
| `DELETE` | `/api/tasks/:id` | Delete a task |

Task titles must contain non-whitespace characters. Tasks have an ID, title,
completion status, and creation timestamp. Unknown routes and task IDs return
`404`; invalid request bodies return `400`.

## Tests

Run the Node.js test suite with:

```sh
npm test
```

The tests cover task storage, persistence, validation, the HTTP API, and
serving the HTML, CSS, and browser JavaScript.

## Implementation status

The tests document the intended application behavior, but the current
`src/server.js` and `src/task-store.js` files are empty. As a result, the
application and test suite need those implementations before the commands
above can run successfully.
