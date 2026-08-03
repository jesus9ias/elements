# Infra — working notes for Claude Code

Inherits the root [`claude.md`](../claude.md).

---

## Hard gate: never touch real AWS

`cdk deploy` and `cdk destroy` create and delete real infrastructure, and the workflow deploys a live site. **Never run them.** They are the developer's, and the spec places an explicit STOP before the first deploy.

`cdk synth` and `cdk diff` are read-only and safe, but `diff` queries deployed state — which requires AWS credentials, so it falls under the root rule on external calls and is the developer's to run too.

*Current state: the stack was deployed by the developer and the frontend was published successfully via the GitHub Actions workflow on 2026-07-21.*

## Review method

This subproject has **no `T-*` test suite** and is exempt from the failing-test stage. CDK constructs are validated by reviewing `cdk synth` output and inspecting `cdk diff` before a deploy — not by unit tests. Do not invent a test suite for it.

## Assumptions baked into the stack

- The Route53 hosted zone and ACM certificate **already exist** and are referenced from `.env`. The stack does not create them, and there is no `dns-stack`.
- The ACM certificate **must live in `us-east-1`** regardless of `AWS_REGION` — CloudFront only accepts certificates from that region. This is the most common misconfiguration here.
- The stack is deployed once from local. Routine frontend updates go through GitHub Actions, not `cdk deploy`; only infra changes need a redeploy.

## The deploy workflow

`.github/workflows/deploy.yml`:

- `workflow_dispatch` is active, with a dry-run input, for manual runs.
- `push` to `main` (paths `frontend/**` or the workflow file) is active as of 2026-07-21 — the developer authorized this, clearing the Stage 2 STOP. Every push to `main` touching those paths now deploys for real; treat merges to `main` accordingly.
- Auth is **IAM user access keys** (temporary, since 2026-07-21) — `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` secrets, not OIDC. OIDC role assumption kept failing with a generic `Not authorized to perform sts:AssumeRoleWithWebIdentity` even after the trust policy's `sub`/`aud` were verified to match the token exactly (repo is public, so GitHub emits `repo:owner@id/repo@id:environment:name` rather than the classic format — trust policy was updated for that and still failed). Switched to access keys to unblock; publish confirmed working on 2026-07-21. **Pending: return to OIDC in a later session** — it remains the preferred auth method; the access-key setup is a known temporary stand-in, not the target state. The IAM user + its scoped policy (S3 sync + CloudFront invalidation only) are prerequisites this stack does **not** create.

## Configuration

All environment-specific values live in `infra/.env` (never committed; `.env.example` is the template): `AWS_ACCOUNT_ID`, `AWS_REGION`, `AWS_CERTIFICATE_ARN`, `ROUTE53_HOSTED_ZONE_ID`, `ROUTE53_DOMAIN`, `SUBDOMAIN`.

Constants that are not environment-specific belong in `lib/constants.ts`, per the monorepo no-magic-values rule — not inline in the stack.

## Cache strategy

Two behaviors, two `CachePolicy`s (`infra/lib/site-stack.ts`, `infra/lib/constants.ts`):

- `/_astro/*` and `/fonts/*` (immutable, content-hashed build output): managed `CACHING_OPTIMIZED` policy, honoring the `Cache-Control: public, max-age=31536000, immutable` the deploy workflow sets on those objects — cached for a year at both CloudFront and the browser.
- Default behavior (HTML, including clean-URL routes resolved by the url-rewrite function): custom `HtmlCachePolicy` with Min=Default=Max=1y, so CloudFront keeps its edge copy for a year **regardless** of the `Cache-Control: no-cache` the deploy workflow sets on HTML objects. That header still reaches the browser unchanged (CloudFront forwards origin headers as-is), so browsers always revalidate against CloudFront — but CloudFront itself doesn't have to hit the origin on every request.

This only works because every deploy invalidates the **entire** distribution (below) — CloudFront's long edge TTL is safe precisely because invalidation, not TTL expiry, is what actually refreshes it. Not yet deployed: added 2026-08-03, requires a `cdk deploy` (see spec.md Decisions Log).

## Cache invalidation

Every deploy invalidates the **entire** CloudFront distribution. This is a deliberate MVP simplification; there is no granular invalidation strategy. Revisit only if deploy frequency makes the cost matter.
