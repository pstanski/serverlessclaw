import { SYSTEM } from '../core/lib/constants/system';

interface DeployerContext {
  stagingBucket: sst.aws.Bucket;
  githubToken?: sst.Secret;
}

/**
 * Creates the CodeBuild deployer project and associated IAM roles.
 * Provides the core CI/CD mechanism for deploying the serverlessclaw infrastructure.
 * @param ctx The deployment context containing necessary AWS resources.
 */
export function createDeployer(ctx: DeployerContext) {
  const { stagingBucket, githubToken } = ctx;

  const deployerRole = new aws.iam.Role('DeployerRole', {
    assumeRolePolicy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Principal: { Service: 'codebuild.amazonaws.com' },
        },
      ],
    }),
  });

  // 1.7 Scoped IAM policy for deployment
  new aws.iam.RolePolicy('DeployerScopedPolicy', {
    role: deployerRole.name,
    policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            'cloudformation:*',
            's3:*',
            'lambda:*',
            'apigateway:*',
            'route53:*',
            'acm:*',
            'dynamodb:*',
            'events:*',
            'ssm:GetParameters',
            'ssm:GetParameter',
            'ecr:*',
            'codebuild:*',
            'kms:*',
            'iot:*',
            'scheduler:*',
            'cloudfront:*',
            'sns:*',
            'budgets:*',
            'iam:PassRole',
            'iam:GetRole',
            'iam:ListRolePolicies',
            'iam:GetRolePolicy',
            'iam:PutRolePolicy',
            'iam:DeleteRolePolicy',
          ],
          Resource: '*',
        },
        // Dedicated statement for CloudWatch Logs (untagged)
        {
          Effect: 'Allow',
          Action: ['logs:*'],
          Resource: '*',
        },
        // Exception: IAM management and global listing
        {
          Effect: 'Allow',
          Action: [
            'iam:CreateServiceLinkedRole',
            'route53:ListHostedZones',
            'acm:ListCertificates',
            's3:ListAllMyBuckets',
            'ecr:GetAuthorizationToken',
          ],
          Resource: '*',
        },
      ],
    }),
  });

  const githubRepo = process.env.GITHUB_REPO || SYSTEM.DEFAULT_GITHUB_REPO;
  const envVars = [
    { name: 'SST_STAGE', value: $app.stage },
    { name: 'STAGING_BUCKET_NAME', value: stagingBucket.name },
    { name: 'GITHUB_REPO', value: githubRepo },
    { name: 'TRUNK_SYNC_ENABLED', value: process.env.TRUNK_SYNC_ENABLED || 'true' },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const link: any[] = [stagingBucket];

  if (githubToken) {
    envVars.push({ name: 'GITHUB_TOKEN', value: githubToken.value });
    link.push(githubToken);
  }

  const deployer = new aws.codebuild.Project('Deployer', {
    name: `${$app.name}-${$app.stage}-Deployer`,
    serviceRole: deployerRole.arn,
    artifacts: { type: 'NO_ARTIFACTS' },
    environment: {
      computeType: 'BUILD_GENERAL1_LARGE',
      image: 'aws/codebuild/standard:7.0',
      type: 'LINUX_CONTAINER',
      environmentVariables: envVars,
    },
    source: {
      type: 'GITHUB',
      location: `https://github.com/${githubRepo}.git`,
      buildspec: 'buildspec.yml',
      reportBuildStatus: true,
    },
  });

  /* Temporarily disabled to unblock deployment without GitHub token linkage
  new aws.codebuild.Webhook('DeployerWebhook', {
    projectName: deployer.name,
    buildType: 'BUILD',
    filterGroups: [
      {
        filters: [
          {
            type: 'EVENT',
            pattern: 'PUSH',
          },
          {
            type: 'HEAD_REF',
            pattern: '^refs/heads/main$',
          },
        ],
      },
    ],
  });
  */

  // Enable event-driven deployments via S3 asset upload (requested pattern)
  const s3TriggerRule = new aws.cloudwatch.EventRule('DeployerS3Trigger', {
    eventPattern: $util.jsonStringify({
      source: ['aws.s3'],
      'detail-type': ['Object Created'],
      detail: {
        bucket: {
          name: [stagingBucket.name],
        },
        object: {
          key: [{ prefix: 'staged_' }, { prefix: 'workspaces/' }],
        },
      },
    }),
  });

  // Role for EventBridge to trigger CodeBuild
  const triggerRole = new aws.iam.Role('DeployerTriggerRole', {
    assumeRolePolicy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Principal: { Service: 'events.amazonaws.com' },
        },
      ],
    }),
  });

  new aws.iam.RolePolicy('DeployerTriggerPolicy', {
    role: triggerRole.name,
    policy: $util.jsonStringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['codebuild:StartBuild'],
          Resource: [deployer.arn],
        },
      ],
    }),
  });

  new aws.cloudwatch.EventTarget('DeployerS3TriggerTarget', {
    rule: s3TriggerRule.name,
    arn: deployer.arn,
    roleArn: triggerRole.arn,
    inputTransformer: {
      inputPaths: {
        key: '$.detail.object.key',
      },
      inputTemplate: $util.jsonStringify({
        environmentVariablesOverride: [
          {
            name: 'STAGING_ZIP_KEY',
            value: '<key>',
          },
          {
            name: 'DEPLOY_REASON',
            value: 'Event-driven S3 upload trigger',
          },
        ],
      }),
    },
  });

  // Linkable wrapper to expose Deployer.name and Deployer.arn to other resources via Resource.Deployer
  const linkable = new sst.Linkable('Deployer', {
    properties: {
      name: deployer.name,
      arn: deployer.arn,
    },
  });

  return { deployer, linkable };
}
