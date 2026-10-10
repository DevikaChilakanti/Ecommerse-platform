# Project AI Instructions

## Project
Build a maintainable, secure, full-stack e-commerce platform.

## Read First
Before making changes, review:
- `README.md`
- `docs/requirements/product-requirements.md`
- `docs/AI-DEVELOPMENT-GUIDELINES.md`
- Relevant architecture decisions in `docs/decisions/`

## Technology Stack
## Technology Stack

- Customer and admin frontend: One Next.js application with TypeScript
- Backend: NestJS with TypeScript
- Database: PostgreSQL
- ORM: Prisma
- API: REST
- Package manager: npm workspaces

## Application Architecture

- `apps/web` contains both customer-facing pages and admin routes.
- `apps/api` contains the backend REST API.
- Do not create a separate `apps/admin` application for the initial MVP.
- Admin routes must be protected by proper backend authorization.
- Hiding admin UI is not a substitute for server-side access control.

These are approved architectural decisions. Ask before introducing major architectural changes.

## Development Rules
1. Understand the existing files before making changes.
2. Work on one clearly defined task at a time.
3. Explain the proposed approach before implementation.
4. Avoid unnecessary dependencies and large downloads.
5. Do not modify unrelated files.
6. Ask before changing architecture, database design, or dependencies.
7. Never expose or commit secrets.
8. Never run destructive commands without approval.
9. Write tests for important business logic.
10. Do not claim tests passed unless they were actually run.

## After Each Task
Report:
- Summary of changes
- Files created or modified
- Dependencies added
- Tests run and actual results
- Remaining issues
- Suggested next step

## Developer Control
The developer makes final decisions. AI tools provide assistance and must not independently expand project scope.