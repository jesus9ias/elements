/**
 * Loads and validates every environment-specific / secret value from `.env`.
 *
 * Per the monorepo contract, sensitive and environment-specific values live
 * exclusively in `.env` (never committed) and are surfaced ONLY through this
 * module. If any required key is missing, we fail loudly here rather than
 * letting CDK synthesize an incomplete stack.
 */

import * as path from 'node:path';
import * as dotenv from 'dotenv';

/** Load `infra/.env` regardless of the current working directory. */
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

/** Every `.env` key this stack consumes. */
export const ENV_KEYS = {
  AWS_REGION: 'AWS_REGION',
  AWS_ACCOUNT_ID: 'AWS_ACCOUNT_ID',
  AWS_CERTIFICATE_ARN: 'AWS_CERTIFICATE_ARN',
  ROUTE53_HOSTED_ZONE_ID: 'ROUTE53_HOSTED_ZONE_ID',
  ROUTE53_DOMAIN: 'ROUTE53_DOMAIN',
  SUBDOMAIN: 'SUBDOMAIN',
} as const;

type EnvKey = (typeof ENV_KEYS)[keyof typeof ENV_KEYS];

/** Fully resolved, validated configuration consumed by the stack. */
export interface SiteConfig {
  readonly awsRegion: string;
  readonly awsAccountId: string;
  readonly certificateArn: string;
  readonly hostedZoneId: string;
  /** Apex/registered domain that owns the hosted zone, e.g. `example.com`. */
  readonly zoneDomain: string;
  /** Subdomain label, e.g. `elements`. */
  readonly subdomain: string;
  /** Full site domain, e.g. `elements.example.com`. */
  readonly siteDomain: string;
}

/** Read a required env var or throw with the offending key named. */
function requireEnv(key: EnvKey): string {
  const value = process.env[key];
  if (value === undefined || value.trim() === '') {
    throw new Error(
      `Missing required environment variable "${key}". ` +
        `Copy infra/.env.example to infra/.env and populate every key before running CDK.`,
    );
  }
  return value.trim();
}

/** Build the validated site configuration from `.env`. */
export function loadSiteConfig(): SiteConfig {
  const zoneDomain = requireEnv(ENV_KEYS.ROUTE53_DOMAIN);
  const subdomain = requireEnv(ENV_KEYS.SUBDOMAIN);

  return {
    awsRegion: requireEnv(ENV_KEYS.AWS_REGION),
    awsAccountId: requireEnv(ENV_KEYS.AWS_ACCOUNT_ID),
    certificateArn: requireEnv(ENV_KEYS.AWS_CERTIFICATE_ARN),
    hostedZoneId: requireEnv(ENV_KEYS.ROUTE53_HOSTED_ZONE_ID),
    zoneDomain,
    subdomain,
    siteDomain: `${subdomain}.${zoneDomain}`,
  };
}
