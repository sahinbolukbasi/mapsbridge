// Topluluk gönderileri: transport (Increment 1.13, M3). İnce: parse, kimlik, yanıt. Okuma
// herkese açık; yazma oturum ister. Route'lar canlıda yok (infra-changes.md §1.13); apply'a
// kadar istemci 404'te yerel kayda düşer ("Yalnız bu cihazda").
import { randomUUID } from "node:crypto";
import { getVerifiedUser } from "../shared/auth";
import {
  extractBearerToken,
  handlePreflight,
  jsonResponse,
  parseBody,
  type ApiGatewayEvent,
} from "../shared/http";
import { Router } from "../shared/router";
import * as repo from "./community.repo";
import {
  CommunityError,
  LIMITS,
  assertOwner,
  authorIdentity,
  decodeCursor,
  encodeCursor,
  toPublicPost,
  validatePostInput,
  type PostRecord,
} from "./community.service";

const router = new Router();
router.add("GET /community/posts", listPosts);
router.add("POST /community/posts", createPost);
router.add("PUT /community/posts/{id}", updatePost);
router.add("DELETE /community/posts/{id}", deletePost);
router.add("POST /community/posts/{id}/like", (e) => mark(e, "LIKE"));
router.add("POST /community/posts/{id}/bookmark", (e) => mark(e, "SAVE"));
router.add("GET /community/profile", getProfile);
router.add("PUT /community/profile", updateProfile);

const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;

async function viewer(event: ApiGatewayEvent) {
  const token = extractBearerToken(event);
  return token ? await getVerifiedUser(token) : null;
}
async function requireUser(event: ApiGatewayEvent) {
  const user = await viewer(event);
  if (!user?.sub) throw new CommunityError(401, "Paylaşım için giriş yapmalısın.");
  return user;
}
function postId(event: ApiGatewayEvent): string {
  const id = event.pathParameters?.id || "";
  if (!ID_RE.test(id)) throw new CommunityError(400, "Geçersiz paylaşım kimliği.");
  return id;
}

async function listPosts(event: ApiGatewayEvent) {
  const q = event.queryStringParameters || {};
  const author = q.author ? q.author.toLowerCase() : undefined;
  if (author && !/^[a-z0-9_.-]{1,40}$/.test(author))
    throw new CommunityError(400, "Geçersiz kullanıcı adı.");
  const page = await repo.listPosts(author, LIMITS.pageSize, decodeCursor(q.cursor));
  const user = await viewer(event).catch(() => null);
  const marks = user?.sub
    ? await repo.viewerMarks(
        page.posts.map((p) => p.id),
        user.sub,
      )
    : undefined;
  return jsonResponse(200, {
    success: true,
    posts: page.posts.map((p) => toPublicPost(p, marks?.get(p.id))),
    ...(page.next ? { cursor: encodeCursor(page.next) } : {}),
  });
}

async function createPost(event: ApiGatewayEvent) {
  const user = await requireUser(event);
  const body = parseBody<Record<string, unknown>>(event);
  const input = validatePostInput(body);
  const who = authorIdentity(await repo.reservedUsername(user.sub), user.email, body?.displayName);
  const post: PostRecord = {
    id: randomUUID().replace(/-/g, ""),
    authorSub: user.sub,
    authorUsername: who.username,
    authorDisplayName: who.displayName,
    content: input.content!,
    category: input.category!,
    hashtags: input.hashtags ?? [],
    ...(input.locationTag ? { locationTag: input.locationTag } : {}),
    ...(input.image ? { image: input.image } : {}),
    ...(input.linkedRoute ? { linkedRoute: input.linkedRoute } : {}),
    likesCount: 0,
    savesCount: 0,
    createdAt: new Date().toISOString(),
  };
  await repo.createPost(post);
  return jsonResponse(201, { success: true, post: toPublicPost(post) });
}

async function updatePost(event: ApiGatewayEvent) {
  const user = await requireUser(event);
  const existing = assertOwner(await repo.getPost(postId(event)), user.sub);
  const patch = validatePostInput(parseBody(event), true);
  const next: PostRecord = { ...existing, ...patch };
  await repo.savePost(next);
  return jsonResponse(200, { success: true, post: toPublicPost(next) });
}

async function deletePost(event: ApiGatewayEvent) {
  const user = await requireUser(event);
  const existing = assertOwner(await repo.getPost(postId(event)), user.sub);
  await repo.deletePost(existing);
  return jsonResponse(200, { success: true });
}

async function mark(event: ApiGatewayEvent, kind: "LIKE" | "SAVE") {
  const user = await requireUser(event);
  const id = postId(event);
  const body = parseBody<{ on?: unknown }>(event);
  if (typeof body?.on !== "boolean") throw new CommunityError(400, "Geçersiz istek.");
  if (!(await repo.getPost(id))) throw new CommunityError(404, "Paylaşım bulunamadı.");
  const changed = await repo.setMark(id, user.sub, kind, body.on);
  const post = await repo.getPost(id);
  return jsonResponse(200, {
    success: true,
    changed,
    on: body.on,
    count: kind === "LIKE" ? (post?.likesCount ?? 0) : (post?.savesCount ?? 0),
  });
}

async function getProfile(event: ApiGatewayEvent) {
  const user = await requireUser(event);
  const profile = await repo.getUserProfile(user.sub);
  return jsonResponse(200, {
    success: true,
    profile: profile || null,
  });
}

async function updateProfile(event: ApiGatewayEvent) {
  const user = await requireUser(event);
  const body = parseBody<Record<string, unknown>>(event);
  const existing = await repo.getUserProfile(user.sub);
  const updated: repo.UserProfileRecord = {
    sub: user.sub,
    email: user.email || existing?.email || "",
    fullName: typeof body?.fullName === "string" ? body.fullName.trim() : (existing?.fullName || user.email?.split("@")[0] || "Gezgin"),
    username: typeof body?.username === "string" ? body.username.trim().toLowerCase() : (existing?.username || user.email?.split("@")[0] || "gezgin"),
    travelTitle: typeof body?.travelTitle === "string" ? body.travelTitle.trim() : existing?.travelTitle,
    bio: typeof body?.bio === "string" ? body.bio.trim() : existing?.bio,
    location: typeof body?.location === "string" ? body.location.trim() : existing?.location,
    avatarUrl: typeof body?.avatarUrl === "string" ? body.avatarUrl.trim() : existing?.avatarUrl,
    updatedAt: new Date().toISOString(),
  };
  await repo.saveUserProfile(updated);
  return jsonResponse(200, {
    success: true,
    profile: updated,
  });
}

export async function handler(event: ApiGatewayEvent) {
  if (event.requestContext?.http?.method === "OPTIONS") return handlePreflight();
  try {
    return await router.dispatch(event);
  } catch (err) {
    if (err instanceof CommunityError) return jsonResponse(err.status, { error: err.message });
    console.error("[community] unhandled", (err as Error)?.name);
    return jsonResponse(503, { error: "Topluluk servisine şu an ulaşılamıyor." });
  }
}
