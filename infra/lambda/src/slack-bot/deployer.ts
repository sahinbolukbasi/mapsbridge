import { ECSClient, UpdateServiceCommand, DescribeServicesCommand } from "@aws-sdk/client-ecs";
import {
  LambdaClient,
  GetFunctionConfigurationCommand,
  ListAliasesCommand,
  UpdateAliasCommand,
  PublishVersionCommand,
} from "@aws-sdk/client-lambda";
import { CloudWatchLogsClient, FilterLogEventsCommand } from "@aws-sdk/client-cloudwatch-logs";

export interface DeployResult {
  ok: boolean;
  message: string;
  service: string;
}

export interface StatusResult {
  service: string;
  status: string;
  details: string;
}

export interface LogOptions {
  since?: number;
  limit?: number;
  filterPattern?: string;
}

export interface LogResult {
  lines: string[];
  logGroup: string;
}

export interface DeployTarget {
  type: "ecs" | "lambda";
  cluster?: string;
  service?: string;
  name?: string;
  logGroup?: string;
}

export interface Deployer {
  deploy(): Promise<DeployResult>;
  rollback(): Promise<DeployResult>;
  status(): Promise<StatusResult>;
  logs(opts?: LogOptions): Promise<LogResult>;
}

const region = () => process.env.AWS_REGION || "eu-central-1";

class EcsDeployer implements Deployer {
  constructor(private readonly t: DeployTarget) {}

  async deploy(): Promise<DeployResult> {
    const ecs = new ECSClient({ region: region() });
    try {
      await ecs.send(
        new UpdateServiceCommand({
          cluster: this.t.cluster,
          service: this.t.service,
          forceNewDeployment: true,
        }),
      );
      return { ok: true, message: "ECS deployment started", service: this.t.service! };
    } finally {
      ecs.destroy();
    }
  }

  async rollback(): Promise<DeployResult> {
    const ecs = new ECSClient({ region: region() });
    try {
      const desc = await ecs.send(
        new DescribeServicesCommand({ cluster: this.t.cluster, services: [this.t.service!] }),
      );
      const svc = desc.services?.[0];
      const taskDef = svc?.taskDefinition || "";
      const match = taskDef.match(/^(.+):(\d+)$/);
      if (!match) throw new Error(`Cannot parse task definition: ${taskDef}`);
      const prev = `${match[1]}:${Math.max(1, parseInt(match[2]) - 1)}`;
      await ecs.send(
        new UpdateServiceCommand({
          cluster: this.t.cluster,
          service: this.t.service,
          taskDefinition: prev,
        }),
      );
      return { ok: true, message: `ECS rollback to ${prev} started`, service: this.t.service! };
    } finally {
      ecs.destroy();
    }
  }

  async status(): Promise<StatusResult> {
    const ecs = new ECSClient({ region: region() });
    try {
      const desc = await ecs.send(
        new DescribeServicesCommand({ cluster: this.t.cluster, services: [this.t.service!] }),
      );
      const svc = desc.services?.[0];
      if (!svc)
        return { service: this.t.service!, status: "not_found", details: "Service not found" };
      const rollout = svc.deployments?.[0]?.rolloutState ?? svc.status ?? "";
      const details = `running: ${svc.runningCount}/${svc.desiredCount}, rollout: ${rollout}`;
      const status = svc.runningCount === svc.desiredCount ? "healthy" : "deploying";
      return { service: this.t.service!, status, details };
    } finally {
      ecs.destroy();
    }
  }

  async logs(opts?: LogOptions): Promise<LogResult> {
    return fetchCwLogs(this.t.logGroup || `/ecs/${this.t.service}`, opts);
  }
}

class LambdaDeployer implements Deployer {
  constructor(private readonly t: DeployTarget) {}

  async deploy(): Promise<DeployResult> {
    const client = new LambdaClient({ region: region() });
    try {
      await client.send(new PublishVersionCommand({ FunctionName: this.t.name }));
      return { ok: true, message: "Lambda version published", service: this.t.name! };
    } finally {
      client.destroy();
    }
  }

  async rollback(): Promise<DeployResult> {
    const client = new LambdaClient({ region: region() });
    try {
      const aliases = await client.send(new ListAliasesCommand({ FunctionName: this.t.name }));
      const alias = aliases.Aliases?.find((a) => a.Name === "live" || a.Name === "prod");
      if (!alias?.FunctionVersion) {
        return { ok: false, message: "No live alias found for rollback", service: this.t.name! };
      }
      const prevVersion = String(Math.max(1, parseInt(alias.FunctionVersion) - 1));
      await client.send(
        new UpdateAliasCommand({
          FunctionName: this.t.name,
          Name: alias.Name!,
          FunctionVersion: prevVersion,
        }),
      );
      return {
        ok: true,
        message: `Lambda alias rolled back to version ${prevVersion}`,
        service: this.t.name!,
      };
    } finally {
      client.destroy();
    }
  }

  async status(): Promise<StatusResult> {
    const client = new LambdaClient({ region: region() });
    try {
      const cfg = await client.send(
        new GetFunctionConfigurationCommand({ FunctionName: this.t.name }),
      );
      const status = cfg.State === "Active" ? "healthy" : (cfg.State || "unknown").toLowerCase();
      return {
        service: this.t.name!,
        status,
        details: `state: ${cfg.State}, update: ${cfg.LastUpdateStatus}`,
      };
    } finally {
      client.destroy();
    }
  }

  async logs(opts?: LogOptions): Promise<LogResult> {
    return fetchCwLogs(this.t.logGroup || `/aws/lambda/${this.t.name}`, opts);
  }
}

async function fetchCwLogs(logGroup: string, opts?: LogOptions): Promise<LogResult> {
  const since = opts?.since ?? 15 * 60 * 1000;
  const limit = opts?.limit ?? 100;
  const client = new CloudWatchLogsClient({ region: region() });
  try {
    const result = await client.send(
      new FilterLogEventsCommand({
        logGroupName: logGroup,
        startTime: Date.now() - since,
        limit,
        ...(opts?.filterPattern ? { filterPattern: opts.filterPattern } : {}),
      }),
    );
    const lines = (result.events || []).map((e) => {
      const ts = e.timestamp ? new Date(e.timestamp).toISOString() : "";
      return ts ? `[${ts}] ${e.message || ""}` : e.message || "";
    });
    return { lines, logGroup };
  } finally {
    client.destroy();
  }
}

export function parseDeployTargets(): Record<string, DeployTarget> {
  try {
    return JSON.parse(process.env.DEPLOY_TARGETS || "{}");
  } catch {
    return {};
  }
}

export function createDeployer(name: string): Deployer | null {
  const target = parseDeployTargets()[name];
  if (!target) return null;
  if (target.type === "ecs") return new EcsDeployer(target);
  if (target.type === "lambda") return new LambdaDeployer(target);
  return null;
}

export function listTargets(): string[] {
  return Object.keys(parseDeployTargets());
}
