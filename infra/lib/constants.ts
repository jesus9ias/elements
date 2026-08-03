/**
 * Central declaration of every non-secret constant used by the infra stack.
 *
 * Per the monorepo contract ("No magic values"), no literal values may appear
 * inline in `site-stack.ts` or `bin/infra.ts`. Secret / environment-specific
 * values are NOT here — those come exclusively from `.env` via `config.ts`.
 */

import {
  Duration,
  RemovalPolicy,
} from 'aws-cdk-lib';
import {
  BlockPublicAccess,
  BucketEncryption,
} from 'aws-cdk-lib/aws-s3';
import {
  AllowedMethods,
  CachePolicy,
  FunctionEventType,
  FunctionRuntime,
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
  URL_REWRITE_FUNCTION: 'SiteUrlRewriteFunction',
  HTML_CACHE_POLICY: 'HtmlCachePolicy',
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
  /**
   * Applied to the immutable, content-hashed asset paths only (see
   * ASSET_BEHAVIORS) — honors the long `Cache-Control` the deploy workflow
   * sets on those objects. The default (HTML) behavior uses HTML_CACHE_POLICY
   * instead; see its comment for why.
   */
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

/**
 * Path patterns for the immutable, content-hashed build output — matched
 * against the incoming request path, so these must stay in sync with the
 * Astro build's actual output layout (`frontend/dist/_astro/`, `.../fonts/`).
 */
export const ASSET_BEHAVIORS = {
  HASHED_ASSETS_PATH_PATTERN: '/_astro/*',
  FONTS_PATH_PATTERN: '/fonts/*',
} as const;

/**
 * Custom cache policy for the default (HTML) behavior. Min = Default = Max
 * clamps CloudFront's own edge TTL to exactly one year regardless of the
 * `Cache-Control: no-cache` the deploy workflow sets on HTML objects — that
 * header still reaches browsers as-is (CloudFront forwards origin headers
 * unchanged), so browsers always revalidate against CloudFront, while
 * CloudFront itself keeps serving the edge copy until the deploy workflow's
 * full invalidation clears it. See infra/spec.md Decisions Log.
 */
export const HTML_CACHE_POLICY = {
  MIN_TTL: Duration.days(365),
  DEFAULT_TTL: Duration.days(365),
  MAX_TTL: Duration.days(365),
  COMMENT:
    'Edge TTL fixed at 1y regardless of origin Cache-Control; freshness relies on full invalidation per deploy.',
} as const;

/**
 * Viewer-request CloudFront Function that rewrites extensionless URIs
 * (e.g. `/molecules`) to their static file path (`/molecules/index.html`).
 * Required because `defaultRootObject` only resolves the exact `/` request,
 * not sub-paths — the standard gap when serving an Astro static build from
 * a private S3 origin.
 */
export const URL_REWRITE = {
  CODE_FILE_PATH: 'lib/functions/url-rewrite.js',
  RUNTIME: FunctionRuntime.JS_2_0,
  EVENT_TYPE: FunctionEventType.VIEWER_REQUEST,
} as const;
