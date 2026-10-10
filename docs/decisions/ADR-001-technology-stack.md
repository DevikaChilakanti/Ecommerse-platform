# ADR-001: Initial Technology Stack

## Status
Proposed — pending implementation validation.

## Context
We need a maintainable full-stack e-commerce platform that can be developed locally on a laptop with limited storage and memory. We also want to learn industry-standard development practices and use AI tools responsibly.

## Decision

| Area | Selected technology |
|---|---|
| Customer frontend | Next.js |
| Admin frontend | Next.js |
| Language | TypeScript |
| Backend | NestJS |
| API style | REST |
| Database | PostgreSQL |
| ORM | Prisma |
| Package manager | npm |
| Version control | Git and GitHub |
| Unit and integration testing | Jest and Supertest |
| End-to-end testing | Playwright |

## Rationale
- TypeScript provides type checking across frontend and backend code.
- Next.js supports modern web application development.
- NestJS provides a structured backend architecture.
- PostgreSQL supports relational data and transactions.
- Prisma provides schema management and database migrations.
- npm workspaces can manage multiple applications in one repository.
- GitHub provides source control and a path to automated CI/CD.

## Resource Constraints
- Install tools only when needed.
- Avoid duplicate database and API clients.
- Avoid unnecessary dependencies.
- Evaluate Docker's resource usage before installing it.
- Do not add Redis or other infrastructure until a requirement justifies it.
- Keep generated files and dependencies out of Git.

## Consequences
- The repository will use a monorepo structure.
- Frontend and backend applications will be developed and tested separately.
- Database migrations will be version-controlled.
- Technology choices may be revised if laptop constraints or project requirements justify a change.

## Review
Validate these decisions before creating the application scaffolding. Record significant changes in a new ADR rather than silently changing the architecture.