import { SharedContext, getDomainConfig, AGENT_CONFIG, getValidSecrets } from './shared';

/**
 * Deploys the Next.js dashboard for monitoring and managing the agents.
 *
 * @param ctx - The shared context containing system resources.
 * @param options - Optional configuration for infrastructure deployment (e.g., pathPrefix).
 * @returns An object containing the created dashboard resource.
 */
export function createDashboard(
  ctx: SharedContext,
  options: {
    pathPrefix?: string;
    extensionSource?: string;
    theme?: {
      primaryColor?: string;
      primaryColorDark?: string;
      accentColor?: string;
      accentColorDark?: string;
      appTitle?: string;
      logo?: string;
      logoBanner?: string;
    };
  } = {}
): { dashboard: sst.aws.Nextjs } {
  const prefix = options.pathPrefix ?? '';
  const extSource = options.extensionSource ?? '';
  const {
    memoryTable,
    traceTable,
    configTable,
    stagingBucket,
    knowledgeBucket,
    bus,
    deployer,
    deployerLink,
    api,
    schedulerRole,
    heartbeatHandler,
  } = ctx;

  const dashboard = new sst.aws.Nextjs('MissionControl', {
    path: `${prefix}apps/dashboard`,
    domain: getDomainConfig('dashboard'),
    // Disable warmer to save SQS requests/costs
    warm: 0,
    link: [
      memoryTable,
      traceTable,
      configTable,
      stagingBucket,
      knowledgeBucket,
      bus,
      deployerLink, // Added for topology discovery
      ...(api ? [api] : []),
      ...(ctx.realtime ? [ctx.realtime] : []),
      ...(ctx.multiplexer ? [ctx.multiplexer] : []), // Added for topology discovery
      ...getValidSecrets(ctx.secrets),
    ].filter(Boolean),
    environment: {
      DEPLOYER_NAME: deployer.name || 'default',
      DYNAMIC_SCHEDULER_ROLE_ARN: schedulerRole?.arn || '',
      HEARTBEAT_HANDLER_ARN: heartbeatHandler?.arn || '',
      API_URL: api?.url || '',
      STAGING_BUCKET_NAME: stagingBucket.name,
      KNOWLEDGE_BUCKET_NAME: knowledgeBucket.name,
      AGENT_BUS_NAME: bus.name,
      TRACE_TABLE_NAME: traceTable.name,
      MEMORY_TABLE_NAME: memoryTable.name,
      CONFIG_TABLE_NAME: configTable.name,
      WEBHOOK_API_URL: api?.url || '',
      IOT_ENDPOINT: ctx.realtime?.endpoint || '',
      IOT_AUTHORIZER: ctx.realtime?.authorizer || '',
      DASHBOARD_PASSWORD: process.env.DASHBOARD_PASSWORD || '',
      JOBS_CONFIG_PATH: 'apps/dashboard/jobs.config.json',
      AWS_PROFILE: '', // Clear profile to avoid conflict warning as SST injects static credentials
      NEXT_PUBLIC_PRIMARY_COLOR:
        options.theme?.primaryColor || process.env.NEXT_PUBLIC_PRIMARY_COLOR || '',
      NEXT_PUBLIC_PRIMARY_COLOR_DARK:
        options.theme?.primaryColorDark || process.env.NEXT_PUBLIC_PRIMARY_COLOR_DARK || '',
      NEXT_PUBLIC_ACCENT_COLOR:
        options.theme?.accentColor || process.env.NEXT_PUBLIC_ACCENT_COLOR || '',
      NEXT_PUBLIC_ACCENT_COLOR_DARK:
        options.theme?.accentColorDark || process.env.NEXT_PUBLIC_ACCENT_COLOR_DARK || '',
      NEXT_PUBLIC_APP_TITLE: options.theme?.appTitle || process.env.NEXT_PUBLIC_APP_TITLE || '',
      NEXT_PUBLIC_APP_LOGO: options.theme?.logo || process.env.NEXT_PUBLIC_APP_LOGO || '/icon.png',
      NEXT_PUBLIC_APP_LOGO_BANNER:
        options.theme?.logoBanner || process.env.NEXT_PUBLIC_APP_LOGO_BANNER || '',
      ...(options.extensionSource
        ? { NEXT_PUBLIC_ACTIVE_EXTENSIONS: './src/extensions/project/index.tsx' }
        : {}),
    },
    architecture: 'arm64',
    buildCommand: `mkdir -p src/extensions/project && find src/extensions/ -mindepth 1 -maxdepth 1 ! -name 'index.ts' ! -name 'messages' ! -name 'project' -exec rm -rf {} + && ${
      extSource
        ? `([ -d "../../../${extSource}/public" ] && cp -rL ../../../${extSource}/public/* public/) || true && cp -rL ../../../${extSource}/* src/extensions/project/ && cp -L ../../../${extSource}/jobs.config.json . && `
        : ''
    }NODE_OPTIONS=--max-old-space-size=6144 npx open-next build && find .open-next -name "*.map" -delete && cd .open-next/server-functions/default && (rm -rf node_modules/.pnpm node_modules/.cache || true) && (npm install --production --no-package-lock --ignore-scripts || true) && rm -rf .git .github .husky .aiready .sst .turbo docs makefiles scripts e2e reports .kilo .opencode apps/dashboard/src packages/*/src coverage tsconfig.tsbuildinfo node_modules/caniuse-lite node_modules/.pnpm node_modules/next/dist/compiled/webpack node_modules/next/dist/compiled/next-devtools node_modules/next/dist/compiled/babel* node_modules/next/dist/compiled/@babel node_modules/next/dist/compiled/terser node_modules/next/dist/compiled/postcss-preset-env node_modules/next/dist/compiled/cssnano-simple node_modules/next/dist/compiled/react-dom-experimental node_modules/next/dist/compiled/react-server-dom-webpack-experimental node_modules/next/dist/compiled/react-server-dom-turbopack-experimental node_modules/next/dist/compiled/react-server-dom-turbopack node_modules/next/dist/pages node_modules/@aws-sdk node_modules/sst node_modules/typescript node_modules/prettier node_modules/eslint node_modules/puppeteer* node_modules/tree-sitter* node_modules/esbuild node_modules/@swc/core`,
    server: {
      memory: AGENT_CONFIG.memory.LARGE,
      timeout: AGENT_CONFIG.timeout.MEDIUM,
    },

    permissions: [
      {
        actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket', 's3:DeleteObject'],
        resources: [
          stagingBucket.arn,
          $util.interpolate`${stagingBucket.arn}/*`,
          knowledgeBucket.arn,
          $util.interpolate`${knowledgeBucket.arn}/*`,
        ],
      },
      {
        actions: ['events:PutEvents'],
        resources: [bus.arn],
      },
      {
        actions: [
          'scheduler:CreateSchedule',
          'scheduler:DeleteSchedule',
          'scheduler:GetSchedule',
          'scheduler:ListSchedules',
          'scheduler:UpdateSchedule',
        ],
        resources: ['*'],
      },
      ...(schedulerRole
        ? [
            {
              actions: ['iam:PassRole'],
              resources: [schedulerRole.arn],
            },
          ]
        : []),
      {
        actions: ['dynamodb:*'],
        resources: [
          memoryTable.nodes.table.arn,
          $util.interpolate`${memoryTable.nodes.table.arn}/index/*`,
          traceTable.nodes.table.arn,
          $util.interpolate`${traceTable.nodes.table.arn}/index/*`,
          configTable.nodes.table.arn,
          $util.interpolate`${configTable.nodes.table.arn}/index/*`,
        ],
      },
      {
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
      },
    ],
  });

  return { dashboard };
}
