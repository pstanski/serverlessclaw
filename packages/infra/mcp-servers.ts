import {
  SharedContext,
  getValidSecrets,
  LAMBDA_ARCHITECTURE,
  NODEJS_LOADERS,
  LOG_RETENTION_PERIOD,
  AGENT_CONFIG,
} from './shared';
import { dirname, join, relative } from 'path';
import { existsSync, readFileSync, realpathSync } from 'fs';

const repoRoot = (() => {
  let currentDir = process.cwd();
  while (
    currentDir !== dirname(currentDir) &&
    !existsSync(join(currentDir, 'pnpm-workspace.yaml'))
  ) {
    currentDir = dirname(currentDir);
  }
  return existsSync(join(currentDir, 'pnpm-workspace.yaml')) ? currentDir : process.cwd();
})();
const coreNodeModules = join(repoRoot, 'packages/core/node_modules');
const frameworkCoreNodeModules = join(repoRoot, 'framework/packages/core/node_modules');
const frameworkRootNodeModules = join(repoRoot, 'framework/node_modules');
const frameworkPnpmNodeModules = join(repoRoot, 'framework/node_modules/.pnpm/node_modules');
const rootNodeModules = join(repoRoot, 'node_modules');
const rootPnpmNodeModules = join(repoRoot, 'node_modules/.pnpm/node_modules');

function resolvePackageRoot(packageName: string, searchDirs: string[]): string {
  for (const searchDir of searchDirs) {
    const candidate = join(searchDir, ...packageName.split('/'));
    if (!existsSync(candidate)) continue;

    const packageRoot = realpathSync(candidate);
    const packageJsonPath = join(packageRoot, 'package.json');
    if (!existsSync(packageJsonPath)) {
      // If it's a directory and it was exactly what we looked for,
      // but maybe it's just a folder without package.json (unlikely for node_modules but...)
      continue;
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { name?: string };
    // Relaxed check: if folder name matches OR package.json name matches OR packageName ends with -cjs
    if (
      packageJson.name === packageName ||
      candidate.endsWith(packageName) ||
      packageName.endsWith('-cjs')
    ) {
      return packageRoot;
    }
  }

  throw new Error(
    `Unable to resolve package root for ${packageName} (Searched in ${searchDirs.join(', ')})`
  );
}

function getNodeModulesDir(packageRoot: string, packageName: string): string {
  let currentDir = packageRoot;
  for (const _segment of packageName.split('/')) {
    currentDir = dirname(currentDir);
  }
  return currentDir;
}

function collectPackageCopyFiles(packageNames: string[]): { from: string; to: string }[] {
  const queue = packageNames.map((packageName) => ({
    packageName,
    searchDirs: [
      coreNodeModules,
      frameworkCoreNodeModules,
      frameworkRootNodeModules,
      frameworkPnpmNodeModules,
      rootNodeModules,
      rootPnpmNodeModules,
    ],
  }));
  const visited = new Set<string>();
  const copyFiles: { from: string; to: string }[] = [];

  while (queue.length > 0) {
    const next = queue.shift();
    if (!next || visited.has(next.packageName)) continue;
    visited.add(next.packageName);

    const packageRoot = resolvePackageRoot(next.packageName, next.searchDirs);
    const packageJson = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };

    copyFiles.push({
      from: relative(repoRoot, packageRoot),
      to: `node_modules/${next.packageName}`,
    });

    const dependencySearchDirs = [
      getNodeModulesDir(packageRoot, next.packageName),
      coreNodeModules,
      frameworkCoreNodeModules,
      frameworkRootNodeModules,
      frameworkPnpmNodeModules,
      rootNodeModules,
      rootPnpmNodeModules,
    ];
    for (const dependencyName of Object.keys(packageJson.dependencies ?? {})) {
      queue.push({ packageName: dependencyName, searchDirs: dependencySearchDirs });
    }
  }

  return copyFiles;
}

const GENERAL_MULTIPLEXER_COPY_FILES = collectPackageCopyFiles([
  '@modelcontextprotocol/server-filesystem',
  '@aiready/ast-mcp-server',
]);

/**
 * Deploys Granular MCP Multiplexer Lambda functions.
 * Splits tools by permission requirements to enforce least privilege.
 */

export interface MCPServerResources {
  multiplexer: sst.aws.Function; // Primary/General multiplexer
  browserMultiplexer: sst.aws.Function;
  devOpsMultiplexer: sst.aws.Function;
}

/**
 * Creates the Granular MCP Multiplexer Lambda functions.
 *
 * @param ctx - The shared infrastructure context.
 * @returns The created MCP multiplexer functions.
 */
export function createMCPServers(
  ctx: SharedContext,
  options: { pathPrefix?: string } = {}
): MCPServerResources {
  const prefix = options.pathPrefix ?? '';
  const { memoryTable, configTable, secrets, stagingBucket } = ctx;
  const validSecrets = getValidSecrets(secrets);

  const baseEnv = {
    PATH: '/var/lang/bin:/usr/local/bin:/usr/bin:/bin:/opt/bin',
    HOME: '/tmp',
    NPM_CONFIG_CACHE: '/tmp/npm-cache',
    XDG_CACHE_HOME: '/tmp/mcp-cache',
    TRACE_SUMMARIES_ENABLED: 'true',
  };

  const commonProps = {
    handler: `${prefix}packages/core/mcp-servers/multiplexer.handler`,
    dev: false as const,
    architecture: LAMBDA_ARCHITECTURE as 'arm64' | 'x86_64',
    nodejs: { loader: NODEJS_LOADERS },
    logging: { retention: LOG_RETENTION_PERIOD as never },
    url: { authorization: 'iam' as const },
  };

  // 1. General Multiplexer (git, filesystem, fetch, google-search, ast)
  // Low privilege: only needs basic links and CloudWatch metrics.
  const generalMultiplexer = new sst.aws.Function('GeneralMCPMultiplexer', {
    ...commonProps,
    copyFiles: GENERAL_MULTIPLEXER_COPY_FILES,
    link: [memoryTable, configTable, ...validSecrets],
    permissions: [
      {
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
      },
    ],
    memory: AGENT_CONFIG.memory.MEDIUM, // 512 MB
    timeout: AGENT_CONFIG.timeout.MEDIUM, // 60s
    environment: baseEnv,
  });

  // 2. Browser Multiplexer (puppeteer)
  // High memory/timeout for headless browser execution.
  const browserMultiplexer = new sst.aws.Function('BrowserMCPMultiplexer', {
    ...commonProps,
    link: [memoryTable, configTable, ...validSecrets],
    permissions: [
      {
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
      },
    ],
    memory: AGENT_CONFIG.memory.MEDIUM_LARGE, // 1024 MB
    timeout: AGENT_CONFIG.timeout.LONG, // 600s
    environment: {
      ...baseEnv,
      PUPPETEER_EXECUTABLE_PATH: '/opt/chromium',
      PLAYWRIGHT_BROWSERS_PATH: '/opt/pw-browsers',
    },
  });

  // 3. DevOps Multiplexer (aws, aws-s3)
  // Higher privilege: access to CodeBuild and S3.
  const devOpsMultiplexer = new sst.aws.Function('DevOpsMCPMultiplexer', {
    ...commonProps,
    link: [memoryTable, configTable, stagingBucket, ...validSecrets],
    permissions: [
      {
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
      },
      {
        actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket', 's3:DeleteObject'],
        resources: [
          stagingBucket.arn,
          $util.interpolate`${stagingBucket.arn}/*`,
          ctx.knowledgeBucket.arn,
          $util.interpolate`${ctx.knowledgeBucket.arn}/*`,
        ],
      },
      {
        actions: [
          'lambda:GetFunction',
          'lambda:ListFunctions',
          'ec2:DescribeInstances',
          'iam:ListRoles',
          'codebuild:StartBuild',
          'codebuild:BatchGetBuilds',
        ],
        resources: ['*'],
      },
    ],
    memory: AGENT_CONFIG.memory.MEDIUM, // 512 MB
    timeout: AGENT_CONFIG.timeout.MEDIUM, // 60s
    environment: baseEnv,
  });

  return {
    multiplexer: generalMultiplexer,
    browserMultiplexer,
    devOpsMultiplexer,
  };
}
