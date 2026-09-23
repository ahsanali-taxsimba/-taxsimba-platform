import { Queue, type ConnectionOptions } from "bullmq";
import { prisma, type Prisma } from "@taxotools/database";
import { JOB_QUEUES, type JobQueueName } from "@taxotools/shared";
import IORedis from "ioredis";

let connection: IORedis | null = null;
const queues = new Map<string, Queue>();

export function getRedisConnection() {
  if (!connection) {
    const url = process.env.REDIS_URL || "redis://localhost:6380";
    connection = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
  }
  return connection;
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
    const conn = getRedisConnection();
    if (conn.status !== "ready") {
      await conn.connect().catch(() => undefined);
    }
    await getQueue(params.queue).add(params.name, {
      ...params.payload,
      backgroundJobId: record.id,
    });
  } catch (err) {
    // Redis optional in local/dev — worker can poll BackgroundJob table
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
