# Infra — working notes for Claude Code

Inherits the root [`claude.md`](../claude.md).

---

## Hard gate: never touch real AWS

`cdk deploy` and `cdk destroy` create and delete real infrastructure, and the workflow deploys a live site. **Never run them.** They are the developer's, and the spec places an explicit STOP before the first deploy.

`cdk synth` and `cdk diff` are read-only and safe, but `diff` queries deployed state — which requires AWS credentials, so it falls under the root rule on external calls and is the developer's to run too.

*Current state: the stack has never been deployed. No AWS resources exist.*

## Review method

This subproject has **no `T-*` test suite** and is exempt from the failing-test stage. CDK constructs are validated by reviewing `cdk synth` output and inspecting `cdk diff` before a deploy — not by unit tests. Do not invent a test suite for it.

## Assumptions baked into the stack

- The Route53 hosted zone and ACM certificate **already exist** and are referenced from `.env`. The stack does not create them, and there is no `dns-stack`.
- The ACM certificate **must live in `us-east-1`** regardless of `AWS_REGION` — CloudFront only accepts certificates from that region. This is the most common misconfiguration here.
- The stack is deployed once from local. Routine frontend updates go through GitHub Actions, not `cdk deploy`; only infra changes need a redeploy.

## The deploy workflow

`.github/workflows/deploy.yml` is intentionally half-armed:

- Only `workflow_dispatch` is active, with a dry-run input.
- The `push` trigger is **commented out**. Uncommenting it enables automatic production deploys and requires explicit developer authorization (spec Stage 2 STOP). Do not uncomment it as part of unrelated work.
- Auth is OIDC. The OIDC provider and IAM deploy role are prerequisites this stack does **not** create — if a deploy fails with a role-assumption error, that is why.

## Configuration

All environment-specific values live in `infra/.env` (never committed; `.env.example` is the template): `AWS_ACCOUNT_ID`, `AWS_REGION`, `AWS_CERTIFICATE_ARN`, `ROUTE53_HOSTED_ZONE_ID`, `ROUTE53_DOMAIN`, `SUBDOMAIN`.

Constants that are not environment-specific belong in `lib/constants.ts`, per the monorepo no-magic-values rule — not inline in the stack.

## Cache invalidation

Every deploy invalidates the **entire** CloudFront distribution. This is a deliberate MVP simplification; there is no granular invalidation strategy. Revisit only if deploy frequency makes the cost matter.
