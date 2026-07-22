# Elements — Infra

AWS CDK v2 stack that publishes the built frontend to a subdomain, plus the GitHub Actions workflow that deploys updates.

See [`spec.md`](spec.md) for the contract and [`claude.md`](claude.md) for working notes.

## Status

**Deployed.** The stack was deployed by the developer and the frontend was published successfully via the GitHub Actions workflow on 2026-07-21. The clean-URL rewrite function (see below) was added afterward and needs a follow-up `cdk deploy` to take effect on the live distribution.

## What the stack creates

A single `site-stack`:

- Private S3 bucket, fronted by CloudFront via Origin Access Control
- CloudFront distribution, with a viewer-request CloudFront Function that rewrites extensionless URIs (e.g. `/molecules`) to their static file (`/molecules/index.html`) — `defaultRootObject` alone only resolves the exact `/` request
- Route53 alias record for the subdomain

The Route53 hosted zone and the ACM certificate are **referenced, not created** — they are expected to exist already and are supplied through `.env`.

## Layout

```
infra/
├── bin/infra.ts              CDK app entry point
├── lib/site-stack.ts         the stack
├── lib/config.ts             .env loading and validation
├── lib/constants.ts          non-magic values
├── lib/functions/url-rewrite.js   CloudFront Function: clean-URL rewrite
└── cdk.json
```

## Configuration

Copy `.env.example` to `.env` and populate:

| Variable | Notes |
|---|---|
| `AWS_ACCOUNT_ID` | |
| `AWS_REGION` | Region for the bucket/distribution |
| `AWS_CERTIFICATE_ARN` | **Must be in `us-east-1`** — CloudFront requires it |
| `ROUTE53_HOSTED_ZONE_ID` | Existing zone |
| `ROUTE53_DOMAIN` | e.g. `example.com` |
| `SUBDOMAIN` | e.g. `elements` |

`.env` is never committed.

## Commands

```bash
npm install
npm run build    # tsc
npm run synth    # cdk synth — safe, creates nothing
npm run diff     # cdk diff against deployed state
npm run deploy   # cdk deploy — creates real AWS resources
npm run destroy
```

`synth` and `diff` are read-only. **`deploy`/`destroy` are gated**: they touch the live stack and are the developer's to run, never Claude Code's.

## Continuous deployment

`.github/workflows/deploy.yml` builds the frontend, syncs `dist/` to S3 and issues a full CloudFront invalidation.

- `workflow_dispatch` is active, with a dry-run input, for manual runs.
- `push` to `main` (paths `frontend/**` or the workflow file) is active as of 2026-07-21 — every matching push deploys for real.
- Authentication is **IAM user access keys** (temporary, since 2026-07-21) — `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` secrets, not OIDC. OIDC role assumption kept failing on `sts:AssumeRoleWithWebIdentity` even with a verified trust policy; access keys unblocked publishing. OIDC remains the intended long-term method — revisit in a later session. The IAM user + its scoped policy (S3 sync + CloudFront invalidation only) are prerequisites this stack does **not** create.

Required repository configuration: secrets `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`, and variables `AWS_REGION`, `S3_BUCKET_NAME`, `CLOUDFRONT_DISTRIBUTION_ID`.

## Deploying infra changes (e.g. the URL-rewrite function)

The stack is already deployed; routine frontend updates go through GitHub Actions, not `cdk deploy` — only changes to `infra/` itself need a redeploy:

1. `npm run synth`, then review `npm run diff` against the deployed stack.
2. Deploy with `npm run deploy` (developer-run only).
