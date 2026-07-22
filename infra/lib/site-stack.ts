/**
 * Elements site stack.
 *
 * Provisions the publishing surface for the static `frontend/` build:
 *   - a private S3 bucket (no public access), fronted by CloudFront via OAC
 *   - a CloudFront distribution served over the configured subdomain
 *   - a Route53 A (alias) record pointing the subdomain at the distribution
 *
 * The Route53 hosted zone and the ACM certificate are assumed to already
 * exist and are referenced (never created) — see infra/spec.md assumptions.
 * The certificate must live in us-east-1, as required by CloudFront.
 */

import * as path from 'path';

import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import {
  Distribution,
  FunctionCode,
  Function as CloudFrontFunction,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { Certificate, ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import {
  ARecord,
  HostedZone,
  IHostedZone,
  RecordTarget,
} from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';

import { SiteConfig } from './config';
import {
  BUCKET,
  CONSTRUCT_IDS,
  DISTRIBUTION,
  OUTPUT_IDS,
  STACK,
  URL_REWRITE,
} from './constants';

export interface SiteStackProps extends StackProps {
  /** Validated configuration sourced from `.env` via `loadSiteConfig()`. */
  readonly config: SiteConfig;
}

export class SiteStack extends Stack {
  constructor(scope: Construct, id: string, props: SiteStackProps) {
    super(scope, id, { ...props, description: STACK.DESCRIPTION });

    const { config } = props;

    // Private origin bucket: no public access, OAC is the only reader.
    const siteBucket = new Bucket(this, CONSTRUCT_IDS.SITE_BUCKET, {
      encryption: BUCKET.ENCRYPTION,
      blockPublicAccess: BUCKET.BLOCK_PUBLIC_ACCESS,
      enforceSSL: BUCKET.ENFORCE_SSL,
      removalPolicy: BUCKET.REMOVAL_POLICY,
    });

    // Referenced (not created) ACM certificate — must be in us-east-1.
    const certificate: ICertificate = Certificate.fromCertificateArn(
      this,
      CONSTRUCT_IDS.CERTIFICATE,
      config.certificateArn,
    );

    // Referenced (not created) Route53 hosted zone for the apex domain.
    const hostedZone: IHostedZone = HostedZone.fromHostedZoneAttributes(
      this,
      CONSTRUCT_IDS.HOSTED_ZONE,
      {
        hostedZoneId: config.hostedZoneId,
        zoneName: config.zoneDomain,
      },
    );

    // Rewrites extensionless URIs (e.g. `/molecules`) to their static file
    // path (`/molecules/index.html`) — `defaultRootObject` alone only covers
    // the exact `/` request, not sub-paths.
    const urlRewriteFunction = new CloudFrontFunction(
      this,
      CONSTRUCT_IDS.URL_REWRITE_FUNCTION,
      {
        code: FunctionCode.fromFile({
          filePath: path.join(__dirname, '..', URL_REWRITE.CODE_FILE_PATH),
        }),
        runtime: URL_REWRITE.RUNTIME,
      },
    );

    // CloudFront in front of the private bucket, served over the subdomain.
    const distribution = new Distribution(this, CONSTRUCT_IDS.DISTRIBUTION, {
      defaultRootObject: DISTRIBUTION.DEFAULT_ROOT_OBJECT,
      domainNames: [config.siteDomain],
      certificate,
      priceClass: DISTRIBUTION.PRICE_CLASS,
      httpVersion: DISTRIBUTION.HTTP_VERSION,
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: DISTRIBUTION.VIEWER_PROTOCOL_POLICY,
        allowedMethods: DISTRIBUTION.ALLOWED_METHODS,
        cachePolicy: DISTRIBUTION.CACHE_POLICY,
        compress: DISTRIBUTION.COMPRESS,
        functionAssociations: [
          {
            function: urlRewriteFunction,
            eventType: URL_REWRITE.EVENT_TYPE,
          },
        ],
      },
    });

    // Point the subdomain at the distribution.
    new ARecord(this, CONSTRUCT_IDS.ALIAS_RECORD, {
      zone: hostedZone,
      recordName: config.siteDomain,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
    });

    new CfnOutput(this, OUTPUT_IDS.BUCKET_NAME, {
      value: siteBucket.bucketName,
      description: 'Name of the private origin bucket the frontend syncs to',
    });
    new CfnOutput(this, OUTPUT_IDS.DISTRIBUTION_ID, {
      value: distribution.distributionId,
      description: 'CloudFront distribution ID (used by CI for invalidation)',
    });
    new CfnOutput(this, OUTPUT_IDS.DISTRIBUTION_DOMAIN_NAME, {
      value: distribution.distributionDomainName,
      description: 'CloudFront-assigned domain name',
    });
    new CfnOutput(this, OUTPUT_IDS.SITE_URL, {
      value: `https://${config.siteDomain}`,
      description: 'Public site URL',
    });
  }
}
