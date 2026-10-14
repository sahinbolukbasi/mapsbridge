import { getVerifiedUser } from "../shared/auth";
import { Router } from "../shared/router";
import { ok, created, unauthorized, jsonResponse, extractBearerToken, type ApiGatewayEvent } from "../shared/http";
import { AdminError, bodyOf, text, get, scan, commit } from "../admin/management";
const router = new Router();
const safeTicket = (r: any) => ({ id: r.id, subject: r.subject, category: r.category, status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt, messages: r.messages, version: r.version || 0 });
router.add("GET /system/status", async () => {
  const config = await get("SYSTEM#CONFIG");
  const now = new Date().toISOString();
  const announcements = (await scan("begins_with(PK, :pk) AND #status = :published", { ":pk": "ANNOUNCEMENT#", ":published": "published" }, { "#status": "status" }))
    .filter(r => r.startsAt <= now && (!r.endsAt || r.endsAt > now)).map(r => ({ id: r.id, title: r.title, message: r.message, version: r.version }));
  return ok({ maintenanceMode: !!config?.maintenanceMode, maintenanceMessage: config?.maintenanceMessage || "", routeCreationEnabled: config?.routeCreationEnabled !== false, sharesEnabled: config?.sharesEnabled !== false, announcements });
});
router.add("GET /support/tickets", async e => {
  const userId = (e as any).verifiedUser.sub;
  const rows = await scan("begins_with(PK, :pk) AND userId = :user", { ":pk": "TICKET#", ":user": userId });
  return ok({ tickets: rows.map(safeTicket).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
});
router.add("POST /support/tickets", async e => {
  const userId = (e as any).verifiedUser.sub; const b = bodyOf(e);
  const rows = await scan("begins_with(PK, :pk) AND userId = :user", { ":pk": "TICKET#", ":user": userId });
  if (rows.filter(r => ["open", "in_progress"].includes(r.status)).length >= 10) throw new AdminError(429, "En fazla 10 açık destek talebiniz olabilir.");
  if (!["account", "payment", "route", "other"].includes(b.category)) throw new AdminError(400, "Kategori seçin.");
  const id = text(b.requestId, "Talep kimliği", 80); if (!/^[a-zA-Z0-9_-]{16,80}$/.test(id)) throw new AdminError(400, "Geçersiz talep kimliği.");
  const existing = await get(`TICKET#${id}`);
  if (existing) { if (existing.userId !== userId) throw new AdminError(409, "Talep kimliği kullanımda."); return ok({ ticket: safeTicket(existing) }); }
  const ticket = await commit(e, { PK: `TICKET#${id}`, SK: "META", id, userId, subject: text(b.subject, "Konu", 160), category: b.category, status: "open", priority: "normal", createdAt: new Date().toISOString(), messages: [{ author: "user", body: text(b.message, "Mesaj", 4000), createdAt: new Date().toISOString() }] }, "ticket_created", "Kullanıcı destek talebi oluşturdu.");
  return created({ ticket: safeTicket(ticket) });
});
router.add("POST /support/tickets/{id}/reply", async e => {
  const userId = (e as any).verifiedUser.sub; const b = bodyOf(e); const previous = await get(`TICKET#${e.pathParameters!.id}`);
  if (!previous || previous.userId !== userId) throw new AdminError(404, "Talep bulunamadı.");
  if (previous.status === "closed") throw new AdminError(409, "Kapatılmış talep için yeni bir talep oluşturun.");
  if ((previous.version || 0) !== b.version) throw new AdminError(409, "Talep değişti; yenileyin.");
  if ((previous.messages || []).length >= 100) throw new AdminError(400, "Bu talep yanıt sınırına ulaştı.");
  const ticket = await commit(e, { ...previous, status: "open", messages: [...previous.messages, { author: "user", body: text(b.message, "Mesaj", 4000), createdAt: new Date().toISOString() }] }, "ticket_replied", "Kullanıcı yanıtı", previous);
  return ok({ ticket: safeTicket(ticket) });
});
router.add("GET /marketplace/blogs", async () => ok({ blogs: (await scan("begins_with(PK, :pk) AND published = :yes", { ":pk": "BLOG#", ":yes": true })).filter(r => r.adminStatus !== "suspended" && r.status !== "archived").map(r => ({ blogId: r.blogId, title: r.title, content: r.content?.slice(0, 300), tags: r.tags || [], createdAt: r.createdAt })) }));
router.add("GET /marketplace/blogs/{id}", async e => {
  const blog = await get(`BLOG#${e.pathParameters!.id}`);
  if (!blog?.published || blog.adminStatus === "suspended" || blog.status === "archived") throw new AdminError(404, "Yazı bulunamadı.");
  return ok({ blogId: blog.blogId, title: blog.title, content: blog.content, tags: blog.tags || [], createdAt: blog.createdAt });
});

// ─── Deal & Ticket Tracker Engine (10k Concurrency Scalability) ────────────
router.add("GET /tracker/metrics", async () => {
  const { getScalabilityMetrics } = await import("./tracker-worker");
  return ok({ metrics: getScalabilityMetrics() });
});

router.add("GET /tracker/jobs", async e => {
  const { listUserTrackerJobs } = await import("./tracker-worker");
  const userId = (e as any).verifiedUser.sub;
  const jobs = await listUserTrackerJobs(userId);
  return ok({ jobs });
});

router.add("POST /tracker/jobs", async e => {
  const { createTrackerJob } = await import("./tracker-worker");
  const user = (e as any).verifiedUser;
  const b = bodyOf(e);
  if (!b.type || !["flight", "hotel"].includes(b.type)) throw new AdminError(400, "Geçerli bir takip türü seçin ('flight' veya 'hotel').");
  if (!b.destination?.trim()) throw new AdminError(400, "Hedef şehir veya bölge zorunludur.");

  const email = b.userEmail?.trim() || user.email || "";
  const job = await createTrackerJob(user.sub, email, {
    type: b.type,
    origin: b.origin,
    destination: b.destination,
    dates: b.dates,
    targetPrice: b.targetPrice ? Number(b.targetPrice) : undefined,
    title: b.title,
    userEmail: email,
  });
  return created({ job });
});

router.add("DELETE /tracker/jobs/{id}", async e => {
  const { deleteTrackerJob } = await import("./tracker-worker");
  const userId = (e as any).verifiedUser.sub;
  const jobId = e.pathParameters?.id;
  if (!jobId) throw new AdminError(400, "İş kimliği zorunludur.");
  await deleteTrackerJob(userId, jobId);
  return ok({ success: true, deletedId: jobId });
});

router.add("POST /tracker/jobs/{id}/check", async e => {
  const { executeTrackerCheck } = await import("./tracker-worker");
  const userId = (e as any).verifiedUser.sub;
  const jobId = e.pathParameters?.id;
  if (!jobId) throw new AdminError(400, "İş kimliği zorunludur.");
  const updated = await executeTrackerCheck(userId, jobId);
  if (!updated) throw new AdminError(404, "Takip işi bulunamadı.");
  return ok({ job: updated });
});

export async function handler(event: ApiGatewayEvent) {
  try {
    const path = event.requestContext.http.path;
    if (event.requestContext.http.method !== "OPTIONS" && (path.startsWith("/support/") || (path.startsWith("/tracker/") && path !== "/tracker/metrics"))) {
      const user = await getVerifiedUser(extractBearerToken(event));
      if (!user) return unauthorized();
      (event as any).verifiedUser = user;
    }
    return await router.dispatch(event);
  } catch (error) {
    if (error instanceof AdminError) return jsonResponse(error.status, { error: error.message });
    return jsonResponse(500, { error: "İşlem tamamlanamadı. Tekrar deneyin." });
  }
}
