import { Router } from '../shared/router';
import crypto from 'node:crypto';
import { verifyAuth } from '../shared/auth';

interface SlackRequest {
  type: string;
  trigger_id?: string;
  user_id?: string;
  command?: string;
  text?: string;
  channel_id?: string;
  response_url?: string;
  actions?: Array<{ action_id: string; value?: string }>;
}

interface SlackResponse {
  response_type?: string;
  text?: string;
  blocks?: any[];
  thread_ts?: string;
}

const router = new Router();

// Verify Slack request signature
function verifySlackSignature(
  req: any
): boolean {
  const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
  if (!slackSigningSecret) return false;

  const timestamp = req.headers['x-slack-request-timestamp'];
  const signature = req.headers['x-slack-signature'];

  // Verify timestamp is not older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) return false;

  // Verify signature
  const baseString = `v0:${timestamp}:${req.body}`;
  const hmac = crypto
    .createHmac('sha256', slackSigningSecret)
    .update(baseString)
    .digest('hex');
  const computedSignature = `v0=${hmac}`;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computedSignature)
  );
}

// Format deployment status
async function getDeploymentStatus(): Promise<string> {
  try {
    const response = await fetch(
      `${process.env.AWS_LAMBDA_LOG_GROUP}/latest`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        },
      }
    );
    const data = await response.json();
    return data.conclusion || 'unknown';
  } catch {
    return 'unknown';
  }
}

// Get system health
async function getSystemHealth(): Promise<{
  site: string;
  api: string;
  lambda: string;
}> {
  const results = {
    site: 'unknown',
    api: 'unknown',
    lambda: 'unknown',
  };

  try {
    // Check site
    const siteRes = await fetch('https://mapsbridge.com', {
      method: 'HEAD',
    });
    results.site = siteRes.status === 200 ? '✅ healthy' : '❌ down';
  } catch {
    results.site = '❌ down';
  }

  try {
    // Check API
    const apiRes = await fetch(`${process.env.API_BASE_URL}/health`);
    results.api = apiRes.status === 200 ? '✅ healthy' : '⚠️ unhealthy';
  } catch {
    results.api = '❌ down';
  }

  try {
    // Check Lambda
    const lambdaRes = await fetch(`${process.env.API_BASE_URL}/health`);
    results.lambda =
      lambdaRes.status === 200 ? '✅ active' : '⚠️ unhealthy';
  } catch {
    results.lambda = '❌ down';
  }

  return results;
}

// Slash command: /deploy
router.post('/slack-bot/deploy', async (req) => {
  if (!verifySlackSignature(req)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const body: SlackRequest = JSON.parse(req.body);
  const response_url = body.response_url;
  const user_id = body.user_id;
  const text = body.text || 'main';

  // Send acknowledge response
  setTimeout(() => {
    fetch(response_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response_type: 'in_channel',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🚀 *Deployment Triggered* by <@${user_id}>\n\nBranch: \`${text}\`\nStatus: Starting deployment workflow...`,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: '*Workflow:*\nDeploy',
              },
              {
                type: 'mrkdwn',
                text: '*Duration:*\n25-35 min',
              },
            ],
          },
          {
            type: 'divider',
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Triggered at <!date^${Math.floor(Date.now() / 1000)}^{date_pretty_short} {time_secs}|${new Date().toISOString()}>`,
              },
            ],
          },
        ],
      }),
    });

    // Trigger GitHub deployment
    fetch(`https://api.github.com/repos/sahinbolukbasi/mapsbridge/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'manual-deploy',
        client_payload: { branch: text, triggered_by: user_id },
      }),
    });
  }, 0);

  return {
    statusCode: 200,
    body: JSON.stringify({ response_type: 'ephemeral', text: 'Deployment triggered...' }),
  };
});

// Slash command: /status
router.post('/slack-bot/status', async (req) => {
  if (!verifySlackSignature(req)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const body: SlackRequest = JSON.parse(req.body);
  const response_url = body.response_url;

  const status = await getDeploymentStatus();
  const health = await getSystemHealth();

  setTimeout(() => {
    fetch(response_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response_type: 'in_channel',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '📊 System Status Report',
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Site:*\n${health.site}`,
              },
              {
                type: 'mrkdwn',
                text: `*API:*\n${health.api}`,
              },
              {
                type: 'mrkdwn',
                text: `*Lambda:*\n${health.lambda}`,
              },
              {
                type: 'mrkdwn',
                text: `*Last Deploy:*\n${status}`,
              },
            ],
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'View Logs' },
                url: 'https://github.com/sahinbolukbasi/mapsbridge/actions',
              },
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Refresh' },
                action_id: 'status_refresh',
              },
            ],
          },
        ],
      }),
    });
  }, 0);

  return {
    statusCode: 200,
    body: JSON.stringify({ response_type: 'ephemeral', text: 'Checking status...' }),
  };
});

// Slash command: /health
router.post('/slack-bot/health', async (req) => {
  if (!verifySlackSignature(req)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const body: SlackRequest = JSON.parse(req.body);
  const response_url = body.response_url;

  const health = await getSystemHealth();
  const allHealthy =
    health.site.includes('✅') &&
    health.api.includes('✅') &&
    health.lambda.includes('✅');

  setTimeout(() => {
    fetch(response_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response_type: 'in_channel',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: allHealthy ? '✅ All Systems Healthy' : '⚠️ Issues Detected',
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Website:*\n${health.site}`,
              },
              {
                type: 'mrkdwn',
                text: `*API:*\n${health.api}`,
              },
              {
                type: 'mrkdwn',
                text: `*Lambda:*\n${health.lambda}`,
              },
              {
                type: 'mrkdwn',
                text: `*Time:*\n${new Date().toLocaleTimeString()}`,
              },
            ],
          },
          ...(allHealthy
            ? []
            : [
                {
                  type: 'actions',
                  elements: [
                    {
                      type: 'button',
                      text: { type: 'plain_text', text: 'Auto-Recover' },
                      action_id: 'health_recover',
                      style: 'danger',
                    },
                  ],
                },
              ]),
        ],
      }),
    });
  }, 0);

  return {
    statusCode: 200,
    body: JSON.stringify({ response_type: 'ephemeral', text: 'Checking health...' }),
  };
});

// Slash command: /logs
router.post('/slack-bot/logs', async (req) => {
  if (!verifySlackSignature(req)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const body: SlackRequest = JSON.parse(req.body);
  const response_url = body.response_url;
  const logType = body.text || 'latest';

  setTimeout(() => {
    fetch(response_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response_type: 'in_channel',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `📋 *Logs: ${logType}*\n\nGet logs from:`,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Deploy Logs' },
                url: 'https://github.com/sahinbolukbasi/mapsbridge/actions/workflows/deploy.yml',
              },
              {
                type: 'button',
                text: { type: 'plain_text', text: 'CI Logs' },
                url: 'https://github.com/sahinbolukbasi/mapsbridge/actions/workflows/ci.yml',
              },
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Monitor Logs' },
                url: 'https://github.com/sahinbolukbasi/mapsbridge/actions/workflows/deployment-monitor.yml',
              },
            ],
          },
        ],
      }),
    });
  }, 0);

  return {
    statusCode: 200,
    body: JSON.stringify({ response_type: 'ephemeral', text: 'Getting logs...' }),
  };
});

// Slash command: /rollback
router.post('/slack-bot/rollback', async (req) => {
  if (!verifySlackSignature(req)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const body: SlackRequest = JSON.parse(req.body);
  const response_url = body.response_url;
  const user_id = body.user_id;

  setTimeout(() => {
    fetch(response_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response_type: 'in_channel',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🔄 *Rollback Initiated* by <@${user_id}>\n\nRolling back to previous version...`,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: '*Action:*\nRollback Last Deploy',
              },
              {
                type: 'mrkdwn',
                text: '*Status:*\nIn Progress',
              },
            ],
          },
        ],
      }),
    });

    // Trigger rollback (Lambda aliases, CloudFront)
    fetch(`${process.env.API_BASE_URL}/admin/rollback`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.ADMIN_TOKEN}`,
      },
    });
  }, 0);

  return {
    statusCode: 200,
    body: JSON.stringify({ response_type: 'ephemeral', text: 'Rollback initiated...' }),
  };
};

// Interactive component: button actions
router.post('/slack-bot/interactive', async (req) => {
  if (!verifySlackSignature(req)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const payload = JSON.parse(req.body.payload);
  const action_id = payload.actions?.[0]?.action_id;
  const response_url = payload.response_url;

  if (action_id === 'status_refresh') {
    // Refresh status
    const health = await getSystemHealth();
    const status = await getDeploymentStatus();

    setTimeout(() => {
      fetch(response_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response_type: 'in_channel',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `✅ *Status Refreshed*\n\nSite: ${health.site}\nAPI: ${health.api}\nLambda: ${health.lambda}`,
              },
            },
          ],
        }),
      });
    }, 0);
  } else if (action_id === 'health_recover') {
    // Trigger auto-recovery
    setTimeout(() => {
      fetch(response_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response_type: 'in_channel',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `🔧 *Auto-Recovery Started*\n\nAttempting to recover system health...`,
              },
            },
          ],
        }),
      });
    }, 0);

    // Trigger recovery
    fetch(`${process.env.API_BASE_URL}/admin/recover`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.ADMIN_TOKEN}`,
      },
    });
  }

  return { statusCode: 200, body: JSON.stringify({}) };
});

export const handler = async (event: any) => {
  console.log('Slack Bot Event:', event);

  try {
    if (event.rawPath.startsWith('/slack-bot')) {
      return await router.handle(event);
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Not found' }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
