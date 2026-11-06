// Topluluk gönderileri: altyapı katmanı (DynamoDB, single-table `{env}-data`, GSI YOK; chat
// GSI1'e dokunulmaz).
//   Gönderi:  PK=POST#<id>              SK=META
//   Akış:     PK=FEED#GLOBAL            SK=<isoTs>#<id>   { postId }
//   Yazar:    PK=AUTHOR#<username>      SK=<isoTs>#<id>   { postId }
//   Beğeni:   PK=POST#<id>              SK=LIKE#<sub>
//   Kaydetme: PK=POST#<id>              SK=SAVE#<sub>
// Not (plan sapması): yazar akışı ?author=<kullanıcı adı> ile sorgulandığından anahtar
// USER#<sub> değil AUTHOR#<username>; kullanıcı adı→sub eşlemesi için GSI gerekmez.
import {
  BatchGetItemCommand,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  TransactWriteItemsCommand,
  type AttributeValue,
} from "@aws-sdk/client-dynamodb";
import { getDynamoClient, getTableName, marshall, unmarshall } from "../shared/dynamo";
import type { PostRecord } from "./community.service";

const db = () => getDynamoClient();
const T = () => getTableName();
export const FEED_PK = "FEED#GLOBAL";
const postKey = (id: string) => ({ PK: `POST#${id}`, SK: "META" });
const indexSk = (p: Pick<PostRecord, "createdAt" | "id">) => `${p.createdAt}#${p.id}`;
const cancelledByCondition = (err: unknown) =>
  (err as { name?: string })?.name === "TransactionCanceledException" ||
  (err as { name?: string })?.name === "ConditionalCheckFailedException";

export async function getPost(id: string): Promise<PostRecord | null> {
  const r = await db().send(
    new GetItemCommand({ TableName: T(), Key: marshall(postKey(id)), ConsistentRead: true }),
  );
  if (!r.Item) return null;
  const { PK: _pk, SK: _sk, ...post } = unmarshall(r.Item);
  return post as PostRecord;
}

export async function createPost(post: PostRecord): Promise<void> {
  const ref = { postId: post.id };
  await db().send(
    new TransactWriteItemsCommand({
      TransactItems: [
        {
          Put: {
            TableName: T(),
            Item: marshall({ ...postKey(post.id), ...post }, { removeUndefinedValues: true }),
            ConditionExpression: "attribute_not_exists(PK)",
          },
        },
        {
          Put: {
            TableName: T(),
            Item: marshall({ PK: FEED_PK, SK: indexSk(post), ...ref }),
            ConditionExpression: "attribute_not_exists(PK)",
          },
        },
        {
          Put: {
            TableName: T(),
            Item: marshall({ PK: `AUTHOR#${post.authorUsername}`, SK: indexSk(post), ...ref }),
            ConditionExpression: "attribute_not_exists(PK)",
          },
        },
      ],
    }),
  );
}

/** Sahibi service'te doğrulandıktan sonra içerik güncellemesi (sayaçlar korunur). */
export async function savePost(post: PostRecord): Promise<void> {
  await db().send(
    new PutItemCommand({
      TableName: T(),
      Item: marshall({ ...postKey(post.id), ...post }, { removeUndefinedValues: true }),
      ConditionExpression: "attribute_exists(PK)",
    }),
  );
}

export async function deletePost(post: PostRecord): Promise<void> {
  await db().send(
    new TransactWriteItemsCommand({
      TransactItems: [
        {
          Delete: {
            TableName: T(),
            Key: marshall(postKey(post.id)),
            ConditionExpression: "attribute_exists(PK)",
          },
        },
        { Delete: { TableName: T(), Key: marshall({ PK: FEED_PK, SK: indexSk(post) }) } },
        {
          Delete: {
            TableName: T(),
            Key: marshall({ PK: `AUTHOR#${post.authorUsername}`, SK: indexSk(post) }),
          },
        },
      ],
    }),
  );
}

/** Akış sayfası (yeni → eski) + gönderiler. */
export async function listPosts(
  author: string | undefined,
  limit: number,
  cursor?: Record<string, string>,
): Promise<{ posts: PostRecord[]; next?: Record<string, unknown> }> {
  const page = await db().send(
    new QueryCommand({
      TableName: T(),
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: marshall({ ":pk": author ? `AUTHOR#${author}` : FEED_PK }),
      ScanIndexForward: false,
      Limit: limit,
      ...(cursor ? { ExclusiveStartKey: marshall(cursor) } : {}),
    }),
  );
  const ids = (page.Items || []).map((i) => String(unmarshall(i).postId)).filter(Boolean);
  if (ids.length === 0)
    return { posts: [], next: page.LastEvaluatedKey && unmarshall(page.LastEvaluatedKey) };
  const got = await db().send(
    new BatchGetItemCommand({
      RequestItems: { [T()]: { Keys: ids.map((id) => marshall(postKey(id))) } },
    }),
  );
  const byId = new Map(
    (got.Responses?.[T()] || []).map((i: Record<string, AttributeValue>) => {
      const { PK: _pk, SK: _sk, ...p } = unmarshall(i);
      return [String(p.id), p as PostRecord];
    }),
  );
  return {
    posts: ids.map((id) => byId.get(id)).filter((p): p is PostRecord => !!p),
    next: page.LastEvaluatedKey && unmarshall(page.LastEvaluatedKey),
  };
}

/** İzleyicinin beğeni/kaydetme durumları. */
export async function viewerMarks(
  ids: string[],
  sub: string,
): Promise<Map<string, { liked: boolean; saved: boolean }>> {
  const out = new Map(ids.map((id) => [id, { liked: false, saved: false }]));
  if (ids.length === 0) return out;
  const keys = ids.flatMap((id) => [
    marshall({ PK: `POST#${id}`, SK: `LIKE#${sub}` }),
    marshall({ PK: `POST#${id}`, SK: `SAVE#${sub}` }),
  ]);
  const got = await db().send(new BatchGetItemCommand({ RequestItems: { [T()]: { Keys: keys } } }));
  for (const item of got.Responses?.[T()] || []) {
    const { PK, SK } = unmarshall(item) as { PK: string; SK: string };
    const mark = out.get(PK.slice("POST#".length));
    if (!mark) continue;
    if (SK.startsWith("LIKE#")) mark.liked = true;
    if (SK.startsWith("SAVE#")) mark.saved = true;
  }
  return out;
}

/**
 * İdempotent beğeni/kaydetme: istenen durum `on`. Zaten o durumdaysa sayaç değişmez
 * (koşullu işlem iptal edilir). Dönüş: durum değişti mi.
 */
export async function setMark(
  id: string,
  sub: string,
  kind: "LIKE" | "SAVE",
  on: boolean,
): Promise<boolean> {
  const counter = kind === "LIKE" ? "likesCount" : "savesCount";
  const markKey = { PK: `POST#${id}`, SK: `${kind}#${sub}` };
  try {
    await db().send(
      new TransactWriteItemsCommand({
        TransactItems: [
          on
            ? {
                Put: {
                  TableName: T(),
                  Item: marshall({ ...markKey, createdAt: new Date().toISOString() }),
                  ConditionExpression: "attribute_not_exists(PK)",
                },
              }
            : {
                Delete: {
                  TableName: T(),
                  Key: marshall(markKey),
                  ConditionExpression: "attribute_exists(PK)",
                },
              },
          {
            Update: {
              TableName: T(),
              Key: marshall(postKey(id)),
              UpdateExpression: "ADD #c :d",
              ConditionExpression: "attribute_exists(PK)",
              ExpressionAttributeNames: { "#c": counter },
              ExpressionAttributeValues: marshall({ ":d": on ? 1 : -1 }),
            },
          },
        ],
      }),
    );
    return true;
  } catch (err) {
    if (cancelledByCondition(err)) return false;
    throw err;
  }
}

/** auth lambda'nın ayırdığı yayınlanmış profil kullanıcı adı (OWNER#<sub>/PUBLIC_PROFILE). */
export async function reservedUsername(sub: string): Promise<string | undefined> {
  const r = await db().send(
    new GetItemCommand({
      TableName: T(),
      Key: marshall({ PK: `OWNER#${sub}`, SK: "PUBLIC_PROFILE" }),
    }),
  );
  const u = r.Item ? unmarshall(r.Item).username : undefined;
  return typeof u === "string" && /^[a-z0-9_]{3,30}$/.test(u) ? u : undefined;
}
