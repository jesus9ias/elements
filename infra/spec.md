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

**STOP — await explicit developer authorization before running `cdk deploy` against real AWS resources.**

### Stage 2 — GitHub Actions Deploy Pipeline

**Scope:** workflow that builds `frontend/`, syncs the build output to S3, and triggers a full CloudFront invalidation on push to `main`.

**Deliverables:** `.github/workflows/deploy.yml`

**Validation:** dry-run against a manually triggered workflow dispatch before enabling on every push.

**STOP — await explicit developer authorization before enabling automatic deploy on push.**

## Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-07-17 | Single `site-stack`, no separate `dns-stack` | Hosted zone/certificate already exist per established convention; avoids unnecessary region-coupling complexity for a single-site project |
| 2026-07-17 | Deploy stack from local, frontend updates via GitHub Actions | Matches the pattern already used in Arcade/Textual |
