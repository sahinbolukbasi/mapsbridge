/**
 * Async research job queue — §5 (Faz 7).
 *
 * Pure in-memory, immutable-update design; persistence is handled by the caller
 * (e.g. DynamoDB or Redis) if durability is needed across Lambda invocations.
 */

import { randomUUID } from 'node:crypto';

export type ResearchJobStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled';
export type ResearchJobPriority = 'high' | 'normal' | 'low';

export interface ResearchJob {
  id: string;
  /** e.g. "istanbul:place:kapalicarsı" or "barcelona:type:airport" */
  entityRef: string;
  status: ResearchJobStatus;
  priority: ResearchJobPriority;
  requestedByThreadId?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  retryCount: number;
}

export interface ResearchQueue {
  jobs: ResearchJob[];
}

const PRIORITY_ORDER: Record<ResearchJobPriority, number> = {
  high: 0,
  normal: 1,
  low: 2,
};

export function createQueue(): ResearchQueue {
  return { jobs: [] };
}

/** Add a new pending job. Returns the updated queue and the new job record. */
export function enqueueJob(
  queue: ResearchQueue,
  entityRef: string,
  priority: ResearchJobPriority,
  threadId?: string
): { queue: ResearchQueue; job: ResearchJob } {
  const job: ResearchJob = {
    id: randomUUID(),
    entityRef,
    status: 'pending',
    priority,
    requestedByThreadId: threadId,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };
  return { queue: { jobs: [...queue.jobs, job] }, job };
}

/**
 * Pick the highest-priority pending job (FIFO within same priority) and
 * transition it to 'running'. Returns null if no pending jobs exist.
 */
export function dequeueNext(
  queue: ResearchQueue
): { queue: ResearchQueue; job: ResearchJob | null } {
  const pending = queue.jobs.filter(j => j.status === 'pending');
  if (pending.length === 0) return { queue, job: null };

  const sorted = [...pending].sort((a, b) => {
    const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (pd !== 0) return pd;
    return a.createdAt.localeCompare(b.createdAt);
  });

  const next = sorted[0];
  const running: ResearchJob = {
    ...next,
    status: 'running',
    startedAt: new Date().toISOString(),
  };
  return {
    queue: { jobs: queue.jobs.map(j => (j.id === next.id ? running : j)) },
    job: running,
  };
}

export function markRunning(queue: ResearchQueue, jobId: string): ResearchQueue {
  return {
    jobs: queue.jobs.map(j =>
      j.id === jobId
        ? { ...j, status: 'running' as const, startedAt: j.startedAt ?? new Date().toISOString() }
        : j
    ),
  };
}

export function markDone(queue: ResearchQueue, jobId: string): ResearchQueue {
  return {
    jobs: queue.jobs.map(j =>
      j.id === jobId
        ? { ...j, status: 'done' as const, completedAt: new Date().toISOString() }
        : j
    ),
  };
}

export function markFailed(
  queue: ResearchQueue,
  jobId: string,
  error: string
): ResearchQueue {
  return {
    jobs: queue.jobs.map(j =>
      j.id === jobId
        ? {
            ...j,
            status: 'failed' as const,
            completedAt: new Date().toISOString(),
            error,
            retryCount: j.retryCount + 1,
          }
        : j
    ),
  };
}

/**
 * Returns false when the same entityRef already has a pending or running job,
 * preventing duplicate research requests.
 */
export function shouldEnqueue(
  queue: ResearchQueue,
  entityRef: string
): boolean {
  return !queue.jobs.some(
    j =>
      j.entityRef === entityRef &&
      (j.status === 'pending' || j.status === 'running')
  );
}

export function getJobsForThread(
  queue: ResearchQueue,
  threadId: string
): ResearchJob[] {
  return queue.jobs.filter(j => j.requestedByThreadId === threadId);
}
