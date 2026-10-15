import {
  aiOverview,
  updateAIControl,
  aiTrainingQueue,
  reviewAITraining,
  aiReleaseOverview,
  proposeAIRelease,
  publishAIRelease,
  rollbackAIRelease,
  listFineTuneJobs,
  triggerFineTune,
} from "./ai-operations";
import { aiAgentCatalog, updateAIAgent } from "./agent-catalog";
import { managementRoutes, AdminError } from "./management";
import { can, routePermission } from "./permissions";
import { Router } from "../shared/router";
import { getVerifiedUser } from "../shared/auth";
import type { ApiGatewayEvent } from "../shared/http";
import {
  ok,
  unauthorized,
  forbidden,
  serverError,
  handlePreflight,
  extractBearerToken,
} from "../shared/http";

import {
  handleListUsers,
  handleSuspendUser,
  handleUnsuspendUser,
  handleRefund,
  handlePayments,
  handleGrantCredits,
} from "./users";
import {
  handleMetrics,
  handleTokenUsageAdmin,
  handleRealtimeTelemetry,
  handleDeviceAnalytics,
  handleTrackSession,
  handleAITopicAnalytics,
  handleCommunityAnalytics,
  handleSubscriptionAnalytics,
} from "./analytics";
import {
  handleFinance,
  handleGetCreditStats,
  handleGetStripeConfig,
  handleUpdateStripeConfig,
  handleGetPlans,
  handleUpdatePlan,
  handleGetCreditPacks,
  handleUpdateCreditPack,
} from "./finance";
import {
  handleGetSystemConfig,
  handleUpdateSystemConfig,
  handleGetModuleConfig,
  handleUpdateModuleConfig,
  handleSystemHealth,
  handleAgentCoreStatus,
} from "./system";
import {
  handleListReports,
  handleResolveReport,
  handleAuditLogs,
  handleAdminListRoutes,
  handleAdminRouteAction,
} from "./moderation";

type Handler = (
  event: ApiGatewayEvent,
) => Promise<{ statusCode: number; headers: Record<string, string>; body: string }>;

const routes: Record<string, Handler> = {
  "GET /admin/ai-operations": aiOverview,
  "POST /admin/ai-control": updateAIControl,
  "GET /admin/ai-agents": aiAgentCatalog,
  "POST /admin/ai-agents/{id}/config": updateAIAgent,
  "GET /admin/ai-training": aiTrainingQueue,
  "POST /admin/ai-training/{id}/review": reviewAITraining,
  "GET /admin/ai-training/jobs": listFineTuneJobs,
  "POST /admin/ai-training/fine-tune": triggerFineTune,
  "GET /admin/ai-release": aiReleaseOverview,
  "POST /admin/ai-release/propose": proposeAIRelease,
  "POST /admin/ai-release/publish": publishAIRelease,
  "POST /admin/ai-release/rollback": rollbackAIRelease,
  "GET /admin/metrics": handleMetrics,
  "GET /admin/users": handleListUsers,
  "GET /admin/analytics/devices": handleDeviceAnalytics,
  "GET /admin/analytics/ai-topics": handleAITopicAnalytics,
  "GET /admin/analytics/community": handleCommunityAnalytics,
  "GET /admin/analytics/subscriptions": handleSubscriptionAnalytics,
  "POST /admin/analytics/track": handleTrackSession,
  "GET /admin/finance": handleFinance,
  "GET /admin/token-usage": handleTokenUsageAdmin,
  "POST /admin/users/{id}/suspend": handleSuspendUser,
  "POST /admin/users/{id}/unsuspend": handleUnsuspendUser,
  "POST /admin/users/{id}/refund": handleRefund,
  "POST /admin/users/{id}/grant-credits": handleGrantCredits,
  "GET /admin/payments": handlePayments,
  "GET /admin/system-health": handleSystemHealth,
  "GET /admin/agentcore-status": handleAgentCoreStatus,
  "GET /admin/reports": handleListReports,
  "POST /admin/reports/{id}/resolve": handleResolveReport,
  "GET /admin/audit-logs": handleAuditLogs,
  "GET /admin/realtime": handleRealtimeTelemetry,
  "GET /admin/routes": handleAdminListRoutes,
  "POST /admin/routes/{id}/action": handleAdminRouteAction,
  "GET /admin/system-config": handleGetSystemConfig,
  "POST /admin/system-config": handleUpdateSystemConfig,
  "GET /admin/module-config": handleGetModuleConfig,
  "POST /admin/module-config": handleUpdateModuleConfig,
  "GET /admin/credit-stats": handleGetCreditStats,
  "GET /admin/stripe-config": handleGetStripeConfig,
  "POST /admin/stripe-config": handleUpdateStripeConfig,
  "GET /admin/plans": handleGetPlans,
  "POST /admin/plans/{id}": handleUpdatePlan,
  "GET /admin/credit-packs": handleGetCreditPacks,
  "POST /admin/credit-packs/{id}": handleUpdateCreditPack,
};

Object.assign(routes, managementRoutes);
const router = new Router();
for (const [key, value] of Object.entries(routes)) router.add(key, value);

export const handler = async (event: ApiGatewayEvent) => {
  if (event.requestContext?.http?.method === "OPTIONS") return handlePreflight();
  if (event.requestContext.http.path === "/health" && event.requestContext.http.method === "GET")
    return ok({ status: "ok", service: "admin", timestamp: new Date().toISOString() });

  const token = extractBearerToken(event);
  if (!token) return unauthorized();

  const user = await getVerifiedUser(token);
  if (!user) return unauthorized();

  let role: "admin" | "moderator" | "support" | undefined;
  if (
    process.env.ADMIN_GROUP_NAME ||
    process.env.MODERATOR_GROUP_NAME ||
    process.env.SUPPORT_GROUP_NAME
  ) {
    const { CognitoIdentityProviderClient, AdminListGroupsForUserCommand } =
      await import("@aws-sdk/client-cognito-identity-provider");
    const cognito = new CognitoIdentityProviderClient({
      region: process.env.AWS_REGION || "eu-central-1",
    });
    const poolId = process.env.COGNITO_USER_POOL_ID || "";
    try {
      const groupRes = await cognito.send(
        new AdminListGroupsForUserCommand({
          UserPoolId: poolId,
          Username: user.originalSub || user.sub,
        }),
      );
      const groupNames = (groupRes.Groups || []).map((g: any) => g.GroupName);
      if (process.env.ADMIN_GROUP_NAME && groupNames.includes(process.env.ADMIN_GROUP_NAME)) {
        role = "admin";
      } else if (
        process.env.MODERATOR_GROUP_NAME &&
        groupNames.includes(process.env.MODERATOR_GROUP_NAME)
      ) {
        role = "moderator";
      } else if (
        process.env.SUPPORT_GROUP_NAME &&
        groupNames.includes(process.env.SUPPORT_GROUP_NAME)
      ) {
        role = "support";
      }
    } catch {
      role = undefined;
    }
  } else {
    role = user.staffRole || (user.isAdmin ? "admin" : undefined);
  }

  if (!role) return forbidden();
  user.staffRole = role;
  user.isAdmin = role === "admin";
  const needed = routePermission(
    event.requestContext.http.path.replace(/\/$/, ""),
    event.requestContext.http.method,
  );
  if (needed && !can(role, needed)) return forbidden("Bu bölüm için yetkiniz bulunmuyor.");

  (event as any).verifiedUser = user;

  try {
    return await router.dispatch(event);
  } catch (err) {
    if (err instanceof AdminError)
      return {
        statusCode: err.status,
        headers: ok({}).headers,
        body: JSON.stringify({ error: err.message }),
      };
    console.error(`[Admin] Error:`, err);
    return serverError();
  }
};
