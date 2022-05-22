import * as cdk from 'aws-cdk-lib';
import {
  OriginAccessIdentity,
  CloudFrontWebDistributionProps,
  CloudFrontWebDistribution,
} from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';
import { getBuildSpecConfig } from './buildspec-config';
import { envVars } from './config';

export class NoamjacobsonComAwsCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 bucket for a static website
    const bucket = new cdk.aws_s3.Bucket(this, envVars.BUCKET_NAME!, {
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    /* uncomment this if you do not require cloudfront and comment everything related to cloudfront below */
    // bucket.grantPublicAccess('*', 's3:GetObject');

    // cloudfront distribution for cdn & https
    const cloudFrontOAI = new OriginAccessIdentity(this, 'OAI', {
      comment: `OAI for ${envVars.WEBSITE_NAME} website.`,
    });

    //route53
    const zone = cdk.aws_route53.HostedZone.fromLookup(this, 'Zone', {
      domainName: envVars.DOMAIN_NAME!,
    });

    //certificate to cover domain names, like example.com and *.example.com
    const certificate = new cdk.aws_certificatemanager.DnsValidatedCertificate(
      this,
      'Certificate',
      {
        domainName: envVars.DOMAIN_NAME!,
        hostedZone: zone,
        region: envVars.REGION,
      }
    );

    const cloudfrontDist = new CloudFrontWebDistribution(
      this,
      `${envVars.WEBSITE_NAME}-cfd`,
      {
        originConfigs: [
          {
            s3OriginSource: {
              s3BucketSource: bucket,
              originAccessIdentity: cloudFrontOAI,
            },
            behaviors: [{ isDefaultBehavior: true }],
          },
        ],
        viewerCertificate:
          cdk.aws_cloudfront.ViewerCertificate.fromAcmCertificate(certificate, {
            aliases: [envVars.DOMAIN_NAME!, `www.${envVars.DOMAIN_NAME}`],
            securityPolicy: cdk.aws_cloudfront.SecurityPolicyProtocol.TLS_V1, // default
            sslMethod: cdk.aws_cloudfront.SSLMethod.SNI, // default
          }),
      }
    );

    // Route53 alias record for the CloudFront distribution
    new cdk.aws_route53.ARecord(this, 'SiteAliasRecord', {
      recordName: envVars.DOMAIN_NAME!,
      target: cdk.aws_route53.RecordTarget.fromAlias(
        new cdk.aws_route53_targets.CloudFrontTarget(cloudfrontDist)
      ),
      zone,
    });

    // add IAM roles for Cloudfront only access to S3
    const cloudfrontS3Access = new cdk.aws_iam.PolicyStatement();
    cloudfrontS3Access.addActions('s3:GetBucket*');
    cloudfrontS3Access.addActions('s3:GetObject*');
    cloudfrontS3Access.addActions('s3:List*');
    cloudfrontS3Access.addResources(bucket.bucketArn);
    cloudfrontS3Access.addResources(`${bucket.bucketArn}/*`);
    cloudfrontS3Access.addCanonicalUserPrincipal(
      cloudFrontOAI.cloudFrontOriginAccessIdentityS3CanonicalUserId
    );

    bucket.addToResourcePolicy(cloudfrontS3Access);

    // codebuild project setup
    const webhooks: cdk.aws_codebuild.FilterGroup[] = [
      cdk.aws_codebuild.FilterGroup.inEventOf(
        cdk.aws_codebuild.EventAction.PUSH,
        cdk.aws_codebuild.EventAction.PULL_REQUEST_MERGED
      ).andHeadRefIs(envVars.BUILD_BRANCH!),
    ];

    const repo = cdk.aws_codebuild.Source.gitHub({
      owner: envVars.REPO_OWNER!,
      repo: envVars.REPO_NAME!,
      webhook: true,
      webhookFilters: webhooks,
      reportBuildStatus: true,
    });

    const project = new cdk.aws_codebuild.Project(
      this,
      `${envVars.WEBSITE_NAME}-build`,
      {
        buildSpec: cdk.aws_codebuild.BuildSpec.fromObject(
          getBuildSpecConfig(bucket.bucketName, cloudfrontDist.distributionId)
        ),
        projectName: `${envVars.WEBSITE_NAME}-build`,
        environment: {
          buildImage: cdk.aws_codebuild.LinuxBuildImage.STANDARD_3_0,
          computeType: cdk.aws_codebuild.ComputeType.SMALL,
        },
        source: repo,
        timeout: cdk.Duration.minutes(20),
      }
    );

    // iam policy to push your build to S3
    project.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        resources: [bucket.bucketArn, `${bucket.bucketArn}/*`],
        actions: [
          's3:GetBucket*',
          's3:List*',
          's3:GetObject*',
          's3:DeleteObject',
          's3:PutObject',
        ],
      })
    );
    // iam policy to invalidate cloudfront distribution's cache
    project.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        resources: ['*'],
        actions: [
          'cloudfront:CreateInvalidation',
          'cloudfront:GetDistribution*',
          'cloudfront:GetInvalidation',
          'cloudfront:ListInvalidations',
          'cloudfront:ListDistributions',
        ],
      })
    );

    new cdk.CfnOutput(this, 'cloudfronturl', {
      value: cloudfrontDist.distributionDomainName,
    });
  }
}
