import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "./prisma.service";

const MAX_TRANSACTION_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 25;
const RETRY_JITTER_MS = 25;

function isSerializationConflict(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  ) {
    return true;
  }

  if (typeof error !== "object" || error === null) {
    return false;
  }

  const errorRecord = error as Record<string, unknown>;
  if (errorRecord.name !== "DriverAdapterError") {
    return false;
  }

  if (
    typeof errorRecord.cause !== "object" ||
    errorRecord.cause === null
  ) {
    return false;
  }

  const cause = errorRecord.cause as Record<string, unknown>;
  return (
    cause.kind === "TransactionWriteConflict" ||
    cause.originalCode === "40001"
  );
}

function retryDelayMs(attempt: number): number {
  const exponentialDelay = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
  const jitter = Math.floor(Math.random() * RETRY_JITTER_MS);
  return exponentialDelay + jitter;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runSerializableTransaction<T>(
  prisma: PrismaService,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isSerializationConflict(error) || attempt === MAX_TRANSACTION_ATTEMPTS) {
        throw error;
      }
      await wait(retryDelayMs(attempt));
    }
  }

  throw new Error("Unreachable transaction retry state.");
}
