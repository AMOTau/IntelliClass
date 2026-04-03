# IntelliClass

AI-assisted academic management platform for South African schools.

## Repository Structure

- `client` - React frontend built with Vite
- `server` - Node.js + Express backend
- `server/db/schema.sql` - PostgreSQL schema for the core platform tables

### Client Structure

- `client/src/App.jsx` - route composition only
- `client/src/pages` - page-level views
- `client/src/components` - shared UI and route guards
- `client/src/components/admin` - admin dashboard widgets
- `client/src/context` - authentication session state
- `client/src/auth` - local session storage helpers
- `client/src/utils` - shared helpers

## Sprint 1 Status

Sprint 1 sets up the base architecture:

- Monorepo workspace with separate client and server folders
- Express API with a health check route
- PostgreSQL pool configuration
- Initial database schema
- React app scaffold with a working startup screen

## Local Setup

1. Install dependencies from the repo root:

```bash
npm install
```

2. Create environment files from the examples:

- `server/.env` from `server/.env.example`
- `client/.env` from `client/.env.example`

3. Create the PostgreSQL database and apply `server/db/schema.sql`.

4. Start the backend:

```bash
npm run dev:server
```

5. Start the frontend in another terminal:

```bash
npm run dev:client
```

## API Check

Once the backend is running, the health endpoint is available at:

- `http://localhost:4000/api/health`

## Sprint 2 Status

Sprint 2 adds authentication and admin provisioning:

- `POST /api/auth/bootstrap-admin` (one-time, only when no admin exists)
- `POST /api/auth/login`
- `GET /api/users/profile`
- `PUT /api/users/profile`
- `POST /api/users` (admin only: create teacher/learner/parent accounts)
- `POST /api/users/link-parent-learner` (admin only)
- `POST /api/users/link-learner-class` (admin only)
- `POST /api/users/link-teacher-class-subject` (admin only)

The backend now uses JWT auth plus bcrypt password hashing.

Self-registration is disabled. Accounts are provisioned by administrators and login details are distributed externally (for example via email workflows).

Set `BOOTSTRAP_ADMIN_KEY` in `server/.env`, then call `POST /api/auth/bootstrap-admin` once to create the first administrator account.

On startup, the backend also auto-seeds a default admin when no admin exists:

- email: `admin@int.com`
- password: `Admin@123`

This seed happens once (only when the `users` table has no admin account).

The server also applies `server/db/schema.sql` automatically on startup, so the tables are created before the admin seed runs.

The schema now includes these relationship tables for practical school onboarding:

- `classes`
- `subjects`
- `class_subject_teachers`
- `class_learners`
- `parent_learners`

The frontend now includes an admin console at `/admin` for:

- creating teacher, learner, and parent accounts
- creating classes and subjects
- linking parents to learners
- linking learners to classes
- linking teachers to class-subject assignments

## Troubleshooting

If the server stops with PostgreSQL error `28P01`, update `server/.env` so `DATABASE_URL` matches your local PostgreSQL username and password. If the password contains characters like `@`, URL-encode them in the connection string.

## Next Sprint

The next step is Sprint 3:

- teacher dashboard
- learner dashboard
- parent dashboard
- admin dashboard