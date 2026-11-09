# PostgreSQL cart integration tests

The PostgreSQL cart integration suite is deliberately separate from the mock-backed unit and E2E suites. It never creates or drops a database. It refuses to connect unless `DATABASE_URL_TEST` names `ecommerse_test_db` on localhost port `5432`, and verifies `current_database()` before creating fixtures.

## Requirements

- Local PostgreSQL on `localhost:5432`.
- PostgreSQL client tools (`createdb`, `psql`) available in PowerShell's `PATH`.
- A local role authorized to create the test database and create/alter objects in it.
- Local PostgreSQL authentication configured securely. For Windows, use a suitably ACL-restricted `%APPDATA%\postgresql\pgpass.conf` or an existing trusted local authentication configuration. Never put the password in source code, a command, or test output.
- Node dependencies already installed for this repository.

The test database name is fixed: `ecommerse_test_db`. Do not substitute `ecommerse_db` or another database.

## Provision the isolated database (manual)

These are instructions only; database creation and migrations are not performed automatically by the test suite. First confirm that `ecommerse_test_db` does not already contain data you need. The command creates only this database and fails if it already exists:

```powershell
$env:PGHOST = "localhost"
$env:PGPORT = "5432"
$env:PGUSER = "<local-role-authorized-to-create-databases>"
createdb --maintenance-db=postgres ecommerse_test_db
```

Configure local authentication before running the command so PostgreSQL does not require a password in the command line. Do not remove, reset, or replace any existing database.

## Configure the test connection

Set `DATABASE_URL_TEST` in the current PowerShell process. The example deliberately contains no password; configure the local PostgreSQL password file or trusted authentication separately. Replace only the role placeholder:

```powershell
$env:DATABASE_URL_TEST = "postgresql://<local-role>@localhost:5432/ecommerse_test_db?schema=public"
$testUrl = [System.Uri]$env:DATABASE_URL_TEST
if (
  $testUrl.Scheme -notin @("postgres", "postgresql") -or
  $testUrl.Host -notin @("localhost", "127.0.0.1", "::1") -or
  $testUrl.Port -ne 5432 -or
  $testUrl.AbsolutePath.TrimStart("/") -ne "ecommerse_test_db"
) {
  throw "DATABASE_URL_TEST must target localhost:5432/ecommerse_test_db."
}
```

The Jest setup repeats these checks, requires `DATABASE_URL_TEST`, and assigns it to the process-local `DATABASE_URL` before loading the Nest application. It never falls back to an inherited `DATABASE_URL`. The integration test file also imports the guard directly, and its filename is excluded from the existing unit and mock E2E patterns.

The package script `test:postgres` runs the configuration at `apps/api/test/jest-postgres.json`. This file scopes Jest to the PostgreSQL integration test and installs the URL guard as setup; the existing unit and mock-backed tests remain separate.

## Apply committed migrations

Prisma CLI configuration reads `DATABASE_URL`, so set that variable only after validating the test URL. This command applies committed migrations to the dedicated test database; it does not create/drop/reset a database:

```powershell
$env:DATABASE_URL = $env:DATABASE_URL_TEST
npm exec --workspace=apps/api -- prisma migrate deploy
```

Do not use `prisma migrate reset`, `prisma db push`, or the development `DATABASE_URL`. Review the target in your current PowerShell process before applying migrations. The integration test performs its own database-name assertion immediately after connecting and before fixture writes.

## Run the PostgreSQL-only suite

```powershell
npm run test:postgres --workspace=apps/api -- --runInBand
```

Run in-band only. Do not run this suite until you have explicitly approved PostgreSQL test execution and verified `DATABASE_URL_TEST` points to the local `ecommerse_test_db`. Separate test processes may run concurrently because each test execution uses a random UUID in its fixture emails, slugs, and SKUs, and cleanup targets only IDs captured for that execution.

The suite requires the pre-provisioned `CUSTOMER` role and creates unique users, sessions, a category, and published products. `CUSTOMER` and `ADMIN` are reference data: the suite never creates or deletes either role. Teardown deletes only fixture users, their carts/items/sessions/role assignments, fixture products, and the fixture category by captured IDs. It never deletes shared reference data, and the test database and schema remain in place.

The tests cover simultaneous first additions, no-lost concurrent increments and duplicate-item prevention, concurrent absolute quantity updates, foreign-customer ownership protection, a genuine PostgreSQL SERIALIZABLE conflict, and CartService P2034 retry after a test-coordinated concurrent cart insert. The retry test invokes the production `CartService`, asserts that the first real transaction attempt rejects with Prisma `P2034`, verifies the service makes a second attempt, and checks the resulting persisted cart state. Nest teardown closes the application; `PrismaService.onModuleDestroy()` disconnects its Prisma client, and the suite verifies that teardown invokes `$disconnect`.

## Clean up process variables

After testing, clear only the process-scoped connection values:

```powershell
Remove-Item Env:DATABASE_URL_TEST -ErrorAction SilentlyContinue
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:PGUSER -ErrorAction SilentlyContinue
Remove-Item Env:PGHOST -ErrorAction SilentlyContinue
Remove-Item Env:PGPORT -ErrorAction SilentlyContinue
```

Do not drop the test database as routine cleanup. No cleanup command should target any database other than `ecommerse_test_db`.

## Checks without database access

The API build and `git diff --check` do not require PostgreSQL. The `test:postgres` suite does connect to PostgreSQL and must be run separately with explicit approval.
