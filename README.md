# MERN Todo API (Backend Only)

A well-architected Node.js/Express + MongoDB (Mongoose) Todo API with JWT authentication. This repo contains only the backend API with clear examples for usage.

## Features
- User registration and login with JWT
- Protected routes using `Authorization: Bearer <token>`
- Todo CRUD scoped to authenticated user
- Filtering, pagination, and sorting on list endpoint
- Stats aggregation endpoint
- Centralized error handling, Helmet, CORS, rate limiting

## Tech Stack
- Express, Mongoose, JWT, Bcrypt, Helmet, CORS, express-rate-limit, express-validator

## Project Structure
```
.
├─ server.js
├─ .env (create from .env.example)
├─ routes/
│  ├─ auth.js
│  └─ todos.js
├─ models/
│  ├─ User.js
│  └─ Todo.js
├─ middleware/
│  ├─ auth.js
│  └─ errorHandler.js
└─ utils/
   └─ jwt.js
```

## Getting Started

### 1) Prerequisites
- Node.js LTS (v18+ recommended)
- MongoDB (Atlas or local)

### 2) Environment Variables
Copy `.env.example` to `.env` and set values. Example:
```
NODE_ENV=development
PORT=5000
# Use either local or Atlas connection string
MONGODB_URI=mongodb://localhost:27017/todo-app
# or Atlas e.g.
# MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/<db>?retryWrites=true&w=majority
JWT_SECRET=change-this-secret
JWT_EXPIRE=30d
```

Important: Never commit `.env` to source control.

### 3) Install & Run
```
npm install
npm run dev
```

- Base URL: `http://localhost:5000/api`
- Health check: `GET /api/health`

## Authentication

### Register
- Route: `POST /api/auth/register`
- Body:
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "password123"
}
```
- cURL:
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Doe","email":"jane@example.com","password":"password123"}'
```

### Login
- Route: `POST /api/auth/login`
- Body:
```json
{
  "email": "jane@example.com",
  "password": "password123"
}
```
- cURL:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"password123"}'
```
  - Response includes `token`. Use it for protected routes:
  - Header: `Authorization: Bearer <token>`

### Postman setup: auto-save token

 Use this in the Tests tab of the login request to save the JWT for reuse.

 - Place in: Tests tab (not Pre-request)
 - Scope: environment vs collection vs globals (choose what you need)
 - Status: handles any 2xx (200/201/etc.)
 - Avoid multiple `pm.response.json()` calls; parse once in try/catch

 ```javascript
 if (pm.response.code >= 200 && pm.response.code < 300) {
   let data = {};
   try { data = pm.response.json(); } catch (e) { data = {}; }

   const token = data.token || data.access_token;
   if (token) {
     // Environment-scoped (requires an environment to be selected)
     pm.environment.set("token", token);
     // Collection-scoped (recommended across requests in the same collection)
     pm.collectionVariables.set("token", token);
     // Global-scoped (uncomment if you truly want global availability)
     // pm.globals.set("token", token);
     console.log("Token saved:", token);
   } else {
     console.warn("No token field found in response:", data);
   }

   if (data.user) {
     pm.environment.set("guestUserId", data.user.id);
     pm.environment.set("guestUserEmail", data.user.email);
   }

   if (data.performance) {
     console.log("API execution time:", data.performance.executionTime);
   }
 } else {
   console.error("Request failed:", pm.response.code);
 }
 ```

 Usage in headers for protected routes:
 - Key: `Authorization`
 - Value: `Bearer {{token}}`

### Get Current User
- Route: `GET /api/auth/me`
- cURL:
```bash
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer <token>"
```

### Update Profile
- Route: `PUT /api/auth/profile`
- Body (any subset):
```json
{
  "name": "Jane Updated",
  "email": "jane.updated@example.com"
}
```
- cURL:
```bash
curl -X PUT http://localhost:5000/api/auth/profile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Updated"}'
```

## Todos
All routes below require the `Authorization: Bearer <token>` header.

### Create Todo
- Route: `POST /api/todos`
- Body:
```json
{
  "title": "Buy groceries",
  "description": "Milk, eggs, bread",
  "priority": "high", // low | medium | high
  "dueDate": "2025-12-31",
  "category": "Personal"
}
```
- cURL:
```bash
curl -X POST http://localhost:5000/api/todos \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy groceries","priority":"high"}'
```

### List Todos (Filter, Pagination, Sort)
- Route: `GET /api/todos`
- Query params:
  - `completed` (boolean): `true|false`
  - `priority`: `low|medium|high`
  - `category` (string, partial match)
  - `page` (number, default 1)
  - `limit` (number, default 10)
  - `sort` (string, default `-createdAt`)
- cURL:
```bash
curl "http://localhost:5000/api/todos?priority=high&page=1&limit=5&sort=-dueDate" \
  -H "Authorization: Bearer <token>"
```

### Get Single Todo
- Route: `GET /api/todos/:id`
- cURL:
```bash
curl http://localhost:5000/api/todos/<todoId> \
  -H "Authorization: Bearer <token>"
```

### Update Todo
- Route: `PUT /api/todos/:id`
- Body (any subset):
```json
{
  "title": "Buy groceries (updated)",
  "completed": true,
  "priority": "medium",
  "dueDate": "2025-11-30",
  "category": "Errands"
}
```
- cURL:
```bash
curl -X PUT http://localhost:5000/api/todos/<todoId> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"completed":true}'
```

### Delete Todo
- Route: `DELETE /api/todos/:id`
- cURL:
```bash
curl -X DELETE http://localhost:5000/api/todos/<todoId> \
  -H "Authorization: Bearer <token>"
```

### Stats Overview
- Route: `GET /api/todos/stats/overview`
- cURL:
```bash
curl http://localhost:5000/api/todos/stats/overview \
  -H "Authorization: Bearer <token>"
```
- Returns totals, completed, pending, priority breakdown, overdue count.

## Error Response Format
Most errors return:
```json
{
  "success": false,
  "message": "<error message>",
  "errors": [/* optional validation errors */]
}
```

## Notes
- Auth middleware: `middleware/auth.js` (`protect`, `authorize`)
- JWT helpers: `utils/jwt.js`
- Error handling middleware: `middleware/errorHandler.js` (last in `server.js`)
- Health check: `GET /api/health`

## License
MIT
