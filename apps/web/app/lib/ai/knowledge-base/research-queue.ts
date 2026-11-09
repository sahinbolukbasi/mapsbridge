/**
 * Async research job queue — §5 (Faz 7).
 *
 * Pure in-memory, immutable-update design; persistence is handled by the caller
 * (e.g. DynamoDB or Redis) if durability is needed across Lambda invocations.
 */

import { randomUUID } from "node:crypto";

export type ResearchJobStatus = "pending" | "running" | "done" | "failed" | "cancelled";
export type ResearchJobPriority = "high" | "normal" | "low";

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
  threadId?: string,
): { queue: ResearchQueue; job: ResearchJob } {
  const job: ResearchJob = {
    id: randomUUID(),
    entityRef,
    status: "pending",
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
export function dequeueNext(queue: ResearchQueue): {
  queue: ResearchQueue;
  job: ResearchJob | null;
} {
  const pending = queue.jobs.filter((j) => j.status === "pending");
  if (pending.length === 0) return { queue, job: null };

  const sorted = [...pending].sort((a, b) => {
    const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (pd !== 0) return pd;
    return a.createdAt.localeCompare(b.createdAt);
  });

  const next = sorted[0];
  const running: ResearchJob = {
    ...next,
    status: "running",
    startedAt: new Date().toISOString(),
  };
  return {
    queue: { jobs: queue.jobs.map((j) => (j.id === next.id ? running : j)) },
    job: running,
  };
}

export function markRunning(queue: ResearchQueue, jobId: string): ResearchQueue {
  return {
    jobs: queue.jobs.map((j) =>
      j.id === jobId
        ? { ...j, status: "running" as const, startedAt: j.startedAt ?? new Date().toISOString() }
        : j,
    ),
  };
}

export function markDone(queue: ResearchQueue, jobId: string): ResearchQueue {
  return {
    jobs: queue.jobs.map((j) =>
      j.id === jobId ? { ...j, status: "done" as const, completedAt: new Date().toISOString() } : j,
    ),
  };
}

export function markFailed(queue: ResearchQueue, jobId: string, error: string): ResearchQueue {
  return {
    jobs: queue.jobs.map((j) =>
      j.id === jobId
        ? {
            ...j,
            status: "failed" as const,
            completedAt: new Date().toISOString(),
            error,
            retryCount: j.retryCount + 1,
          }
        : j,
    ),
  };
}

/**
 * Returns false when the same entityRef already has a pending or running job,
 * preventing duplicate research requests.
 */
export function shouldEnqueue(queue: ResearchQueue, entityRef: string): boolean {
  return !queue.jobs.some(
    (j) => j.entityRef === entityRef && (j.status === "pending" || j.status === "running"),
  );
}

export function getJobsForThread(queue: ResearchQueue, threadId: string): ResearchJob[] {
  return queue.jobs.filter((j) => j.requestedByThreadId === threadId);
}

/**
 * entityRef üretici (Faz 2 / görev 10) — "city:kind:slug" biçimi. research-queue
 * ve supervisor aynı biçimi kullansın diye tek yerde. slug normalize edilir.
 */
export function entityRef(city: string, kind: string, slug: string): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9çğıöşü-]/giu, "");
  return `${norm(city)}:${norm(kind)}:${norm(slug)}`;
}

/**
 * Eksik entity'ler için araştırma işlerini SAF biçimde planlar (Faz 2 / görev 10).
 *
 * Amaç (I7): bir rota/sohbet isteği sırasında yeterli gerçek durak bulunamadığında
 * ya da bir entity eksik olduğunda, bu araştırmayı TALEP ANINDA yapıp kullanıcıyı
 * bekletmek yerine yüksek öncelikli bir işe alıp ÖNCEDEN HESAPLAMA kanalına koymak.
 *
 * - `needed`: istenen entityRef listesi (supervisor eksik şehir/entity'den üretir).
 * - `shouldEnqueue` ile zaten pending/running olanlar atlanır (tekrar engelleme).
 * - Mutasyon yok: yeni queue + enqueue edilen işler döner.
 */
export function planResearchJobs(
  queue: ResearchQueue,
  needed: string[],
  priority: ResearchJobPriority = "high",
  threadId?: string,
): { queue: ResearchQueue; enqueued: ResearchJob[] } {
  let q = queue;
  const enqueued: ResearchJob[] = [];
  const seenThisCall = new Set<string>();
  for (const ref of needed) {
    if (seenThisCall.has(ref)) continue; // aynı çağrıda tekrarı da engelle
    seenThisCall.add(ref);
    if (!shouldEnqueue(q, ref)) continue; // zaten pending/running
    const { queue: next, job } = enqueueJob(q, ref, priority, threadId);
    q = next;
    enqueued.push(job);
  }
  return { queue: q, enqueued };
}
