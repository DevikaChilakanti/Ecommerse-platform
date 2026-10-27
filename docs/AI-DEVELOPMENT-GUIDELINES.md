# AI Development Guidelines

## 1. Project Context

We are building a full-stack e-commerce platform using Next.js, TypeScript, NestJS, PostgreSQL, Prisma, and REST APIs.

The developer is responsible for understanding, reviewing, testing, and approving all changes.

## 2. AI Responsibilities

AI tools may assist with:
- Requirements analysis and clarification
- Architecture research and review
- Implementation of small, well-defined tasks
- Test scenario generation
- Debugging and error analysis
- Code review and security analysis
- Documentation

## 3. Rules Before Coding

Before implementing a feature, AI must:
1. Read the relevant project documentation.
2. Understand the existing code and architecture.
3. Identify requirements and acceptance criteria.
4. Explain the proposed approach.
5. Identify files that may need modification.
6. Identify dependencies that may be required.

Do not implement until the developer approves the proposed approach.

## 4. Implementation Rules

- Make small, focused changes.
- Follow existing naming conventions and folder structure.
- Avoid unnecessary dependencies.
- Do not modify unrelated files.
- Do not rewrite working code without a clear reason.
- Explain important implementation decisions.
- Ask before changing architecture or database design.

## 5. Testing Rules

For each feature:
1. Identify positive and negative scenarios.
2. Add suitable automated tests.
3. Run relevant tests.
4. Report actual results without claiming unexecuted tests passed.
5. Fix failures before considering the feature complete.

## 6. Security Rules

- Never hardcode credentials or secrets.
- Never store passwords in plain text.
- Validate input on the server.
- Enforce authorization on protected operations.
- Avoid exposing internal errors or sensitive data.
- Review dependencies before adding them.
- Never run destructive commands without explicit approval.

## 7. Code Review

Review important changes for:
- Correctness
- Security
- Error handling
- Performance
- Maintainability
- Type safety
- Test coverage

Report issues before proposing a rewrite.

## 8. Git Rules

- Keep changes focused on one task.
- Review `git diff` before committing.
- Never commit secrets or generated dependency folders.
- Use meaningful commit messages.
- Do not push or publish changes without developer approval.

## 9. AI Output Format

For every implementation task, report:
1. What changed
2. Files created or modified
3. Dependencies added, if any
4. Tests performed and their actual results
5. Remaining risks or limitations
6. Suggested next step

## 10. Developer Approval

The developer makes final decisions about architecture, dependencies, implementation, testing, and releases. AI suggestions are advisory until reviewed and approved.