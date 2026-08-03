# Elements — Infra Spec

> Inherits the full contract defined in the monorepo `spec.md` at the repository root. In case of conflict, the monorepo `spec.md` takes precedence unless a deviation is explicitly declared below.

## Deviations from Monorepo Contract

None at this time.

## Objective

Publish the `frontend/` static build to a subdomain via AWS CDK v2, following the same strategy already established in prior projects (Arcade, Textual): deploy is triggered from local, all environment-specific values live in `.env`, and CI (GitHub Actions) only handles frontend build + deploy + CloudFront invalidation, not infra provisioning.

## Stack

- AWS CDK v2 (latest available at implementation time)
- Node 24
- TypeScript (CDK app itself, consistent with the rest of the monorepo)

## Assumptions (flagged for confirmation)

- The Route53 hosted zone and ACM certificate already exist and are **not** created by this stack — they are referenced via ARN/zone ID from `.env`. No `dns-stack` is needed.
- A single CDK stack (`site-stack`) provisions: S3 bucket (private, OAC-fronted) + CloudFront distribution + Route53 alias record for the subdomain.
- The stack is deployed once from local via `cdk deploy`; subsequent frontend updates go through GitHub Actions (build + sync to S3 + CloudFront invalidation), not through `cdk deploy` again, unless infra itself changes.

If any of these assumptions don't match the intended setup, flag it before Stage 1 begins.

## Environment Variables

```
# .env (never committed)
AWS_REGION=
AWS_CERTIFICATE_ARN=
ROUTE53_HOSTED_ZONE_ID=
ROUTE53_DOMAIN=
SUBDOMAIN=
AWS_ACCOUNT_ID=
```

## Data Model

Not applicable — this subproject has no domain data of its own.

## Gherkin Feature Specifications

```gherkin
Feature: Subdomain publishing
  Scenario: First-time stack deployment
    Given valid AWS credentials and a populated .env file
    When the developer runs the CDK deploy command locally
    Then an S3 bucket, CloudFront distribution, and Route53 alias record are created
    And the subdomain resolves to the CloudFront distribution

  Scenario: Frontend redeploy without infra changes
    Given the stack is already deployed
    When GitHub Actions runs on a push to main
    Then the frontend build is synced to the S3 bucket
    And a full CloudFront invalidation is triggered
```

## Unit Test Definitions

Infra code is validated through `cdk synth` snapshot review and manual `cdk diff` inspection before deploy, not through a conventional unit test suite. No `T-INFRA-NN` table applies — CDK constructs are reviewed, not unit-tested, consistent with prior projects.

## Implementation Stages

### Stage 1 — CDK Stack

**Scope:** single `site-stack` (S3 + CloudFront + Route53 alias), `.env` wiring, `cdk.json` config.

**Deliverables:**
- `infra/lib/site-stack.ts`
- `infra/bin/infra.ts`
- `.env.example`

**Validation:** `cdk synth` succeeds without hardcoded values; `cdk diff` reviewed manually before first deploy.

**STOP — await explicit developer authorization before running `cdk deploy` against real AWS resources.** *(Cleared 2026-07-21: developer deployed the stack.)*

### Stage 2 — GitHub Actions Deploy Pipeline

**Scope:** workflow that builds `frontend/`, syncs the build output to S3, and triggers a full CloudFront invalidation on push to `main`.

**Deliverables:** `.github/workflows/deploy.yml`

**Validation:** dry-run against a manually triggered workflow dispatch before enabling on every push.

**STOP — await explicit developer authorization before enabling automatic deploy on push.** *(Cleared 2026-07-21: developer authorized enabling the `push` trigger.)*

## Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-07-17 | Single `site-stack`, no separate `dns-stack` | Hosted zone/certificate already exist per established convention; avoids unnecessary region-coupling complexity for a single-site project |
| 2026-07-17 | Deploy stack from local, frontend updates via GitHub Actions | Matches the pattern already used in Arcade/Textual |
| 2026-07-21 | Deploy workflow auth switched from OIDC role assumption to IAM user access keys (temporary) | OIDC `AssumeRoleWithWebIdentity` kept failing authorization even after the trust policy's `sub`/`aud` were verified to match the actual token exactly (repo's public visibility makes GitHub emit an ID-qualified `sub`, which the policy was updated to match) — root cause not found. Access keys unblock publishing now; OIDC remains the intended long-term method and should be revisited in a later session |
| 2026-07-22 | Added a viewer-request CloudFront Function (`lib/functions/url-rewrite.js`) to the default behavior | Astro's clean URLs (e.g. `/molecules`) don't resolve against the private S3 origin — `defaultRootObject` only covers the exact `/` request, not sub-paths, so every non-root route 403'd. The function rewrites extensionless URIs to their `index.html` file before the origin lookup. Requires a `cdk deploy` to take effect on the already-deployed stack; not yet run |
| 2026-08-03 | Split caching by file type: immutable `Cache-Control` (1y) for hashed assets (`_astro/*`, `fonts/*`) via `additionalBehaviors` using `CACHING_OPTIMIZED`; `no-cache` for HTML via a new custom `CachePolicy` (Min=Default=Max=1y) on the default behavior | Content-hashed filenames make long caching safe for assets at both CloudFront and the browser — a changed file gets a new URL. HTML has no hash and references those asset URLs, so browsers must always revalidate it; but CloudFront's own edge copy can still be cached for a year and rely on the full invalidation already triggered on every deploy, maximizing the edge hit ratio without risking a stale HTML response for new visitors. Requires a `cdk deploy` to take effect; not yet run |
