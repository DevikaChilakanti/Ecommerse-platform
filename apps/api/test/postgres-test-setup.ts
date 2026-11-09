const TEST_DATABASE_NAME = "ecommerse_test_db";
const TEST_DATABASE_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
]);
const TEST_DATABASE_PORT = "5432";

function assertSafeTestDatabaseUrl(value: string | undefined): string {
  if (!value) {
    throw new Error("DATABASE_URL_TEST is required for PostgreSQL cart tests.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DATABASE_URL_TEST must be a valid PostgreSQL URL.");
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  } catch {
    throw new Error("DATABASE_URL_TEST must contain a valid database name.");
  }
  const allowedParameters = [...url.searchParams.entries()].every(
    ([key, value]) => key === "schema" && value === "public",
  );
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !TEST_DATABASE_HOSTS.has(url.hostname.toLowerCase()) ||
    url.port !== TEST_DATABASE_PORT ||
    databaseName !== TEST_DATABASE_NAME ||
    !allowedParameters ||
    url.hash.length > 0
  ) {
    throw new Error(
      "PostgreSQL cart tests only permit localhost:5432/ecommerse_test_db.",
    );
  }

  return value;
}

process.env.DATABASE_URL = assertSafeTestDatabaseUrl(
  process.env.DATABASE_URL_TEST,
);
