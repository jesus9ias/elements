/**
 * Central declaration of every non-secret constant used by the infra stack.
 *
 * Per the monorepo contract ("No magic values"), no literal values may appear
 * inline in `site-stack.ts` or `bin/infra.ts`. Secret / environment-specific
 * values are NOT here — those come exclusively from `.env` via `config.ts`.
 */

import {
  RemovalPolicy,
} from 'aws-cdk-lib';
import {
  BlockPublicAccess,
  BucketEncryption,
} from 'aws-cdk-lib/aws-s3';
import {
  AllowedMethods,
  CachePolicy,
  HttpVersion,
  PriceClass,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';

/** Stack-level identity. */
export const STACK = {
  ID: 'ElementsSiteStack',
  DESCRIPTION:
    'Elements static site: private S3 bucket (OAC) + CloudFront distribution + Route53 alias',
} as const;

/** Logical construct IDs. Stable — changing one replaces the resource. */
export const CONSTRUCT_IDS = {
  SITE_BUCKET: 'SiteBucket',
  DISTRIBUTION: 'SiteDistribution',
  CERTIFICATE: 'SiteCertificate',
  HOSTED_ZONE: 'SiteHostedZone',
  ALIAS_RECORD: 'SiteAliasRecord',
} as const;

/** CloudFormation output names. */
export const OUTPUT_IDS = {
  DISTRIBUTION_ID: 'DistributionId',
  DISTRIBUTION_DOMAIN_NAME: 'DistributionDomainName',
  SITE_URL: 'SiteUrl',
  BUCKET_NAME: 'BucketName',
} as const;

/** Private origin bucket configuration. */
export const BUCKET = {
  ENCRYPTION: BucketEncryption.S3_MANAGED,
  BLOCK_PUBLIC_ACCESS: BlockPublicAccess.BLOCK_ALL,
  ENFORCE_SSL: true,
  /**
   * RETAIN so a `cdk destroy` never silently deletes deployed artifacts.
   * The content is reproducible from git, but retaining avoids destructive
   * surprises; flip to DESTROY (+ autoDeleteObjects) only intentionally.
   */
  REMOVAL_POLICY: RemovalPolicy.RETAIN,
} as const;

/** CloudFront distribution configuration. */
export const DISTRIBUTION = {
  DEFAULT_ROOT_OBJECT: 'index.html',
  VIEWER_PROTOCOL_POLICY: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
  ALLOWED_METHODS: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
  CACHE_POLICY: CachePolicy.CACHING_OPTIMIZED,
  COMPRESS: true,
  HTTP_VERSION: HttpVersion.HTTP2_AND_3,
  /**
   * PRICE_CLASS_ALL keeps edge coverage for Latin America (the Spanish-first
   * audience), which the cheaper classes exclude. Cost delta is marginal for a
   * low-traffic educational site.
   */
  PRICE_CLASS: PriceClass.PRICE_CLASS_ALL,
} as const;
