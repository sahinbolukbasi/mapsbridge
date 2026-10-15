import { GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { getDynamoClient, getTableName } from "./dynamo";

export async function read(PK: string, SK: string) {
  const result = await getDynamoClient().send(
    new GetItemCommand({
      TableName: getTableName(),
      Key: marshall({ PK, SK }),
      ConsistentRead: true,
    }),
  );
  return result.Item ? unmarshall(result.Item) : null;
}

export async function subscription(userId: string) {
  const sub = await read(`USER#${userId}`, "SUBSCRIPTION");
  if (
    !sub ||
    sub.status !== "active" ||
    Date.parse(sub.currentPeriodEnd) <= Date.now() ||
    !Number.isFinite(Date.parse(sub.currentPeriodEnd)) ||
    !["explorer", "pro", "agency"].includes(sub.tier)
  )
    return { tier: "free", status: "active" };
  return sub;
}
