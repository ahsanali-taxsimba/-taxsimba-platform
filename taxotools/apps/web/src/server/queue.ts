import { Queue, type ConnectionOptions } from "bullmq";
import { prisma, type Prisma } from "@taxotools/database";
import { JOB_QUEUES, type JobQueueName } from "@taxotools/shared";
import IORedis from "ioredis";

let connection: IORedis | null = null;
const queues = new Map<string, Queue>();

const REDIS_CONNECT_MS = 1_500;
const REDIS_OP_MS = 2_000;

export function getRedisConnection() {
  if (!connection) {
    const url = process.env.REDIS_URL || "redis://127.0.0.1:6380";
    connection = new IORedis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
      connectTimeout: REDIS_CONNECT_MS,
      commandTimeout: REDIS_OP_MS,
      // Fail fast in serverless — do not retry forever when Redis is unreachable.
      retryStrategy: () => null,
    });
    connection.on("error", () => {
      // Swallow reconnect noise; enqueueJob already falls back to DB-only queueing.
    });
  }
  return connection;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function getQueue(name: JobQueueName | string) {
  if (!queues.has(name)) {
    queues.set(
      name,
      new Queue(name, {
        connection: getRedisConnection() as unknown as ConnectionOptions,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      }),
    );
  }
  return queues.get(name)!;
}

export async function enqueueJob(params: {
  queue: JobQueueName | string;
  name: string;
  payload: Record<string, unknown>;
  maxAttempts?: number;
}) {
  // Stable unique jobId up front — avoids Redis id collisions on BackgroundJob.jobId
  const record = await prisma.backgroundJob.create({
    data: {
      queue: params.queue,
      name: params.name,
      status: "QUEUED",
      payload: params.payload as Prisma.InputJsonValue,
      maxAttempts: params.maxAttempts ?? 3,
      jobId: `bq-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    },
  });

  try {
    // Skip Redis when unset/disabled so Vercel serverless never waits on a dead broker.
    if (
      process.env.REDIS_DISABLED === "1" ||
      !process.env.REDIS_URL ||
      process.env.REDIS_URL === ""
    ) {
      throw new Error("Redis not configured");
    }
    const conn = getRedisConnection();
    if (conn.status !== "ready") {
      await withTimeout(conn.connect(), REDIS_CONNECT_MS, "Redis connect");
    }
    await withTimeout(
      getQueue(params.queue).add(params.name, {
        ...params.payload,
        backgroundJobId: record.id,
      }),
      REDIS_OP_MS,
      "Redis enqueue",
    );
  } catch (err) {
    // Redis optional in local/dev/Vercel — worker can poll BackgroundJob table
    await prisma.backgroundJob.update({
      where: { id: record.id },
      data: {
        errorMessage:
          err instanceof Error
            ? `Queued in DB only (Redis unavailable): ${err.message}`
            : "Queued in DB only",
      },
    });
  }

  return record;
}

export { JOB_QUEUES };
