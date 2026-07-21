# Elements — Infra

AWS CDK v2 stack that publishes the built frontend to a subdomain, plus the GitHub Actions workflow that deploys updates.

See [`spec.md`](spec.md) for the contract and [`claude.md`](claude.md) for working notes.

## Status

**Code-complete, never deployed.** `cdk synth` passes. Deployment is deliberately deferred by the developer — no AWS resources have been created, and the prerequisites below are not yet in place.

## What the stack creates

A single `site-stack`:

- Private S3 bucket, fronted by CloudFront via Origin Access Control
- CloudFront distribution
- Route53 alias record for the subdomain

The Route53 hosted zone and the ACM certificate are **referenced, not created** — they are expected to exist already and are supplied through `.env`.

## Layout

```
infra/
├── bin/infra.ts        CDK app entry point
├── lib/site-stack.ts   the stack
├── lib/config.ts       .env loading and validation
├── lib/constants.ts    non-magic values
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

`synth` and `diff` are read-only. **`deploy` is gated**: per the spec it requires explicit developer authorization and has not been run.

## Continuous deployment

`.github/workflows/deploy.yml` builds the frontend, syncs `dist/` to S3 and issues a full CloudFront invalidation.

- Authentication is via **OIDC** — no long-lived AWS keys. The OIDC provider and the IAM deploy role are prerequisites that this stack does **not** create.
- The workflow currently runs **only** through `workflow_dispatch`, which supports a dry-run input. The `push` trigger is commented out on purpose; enabling automatic deploys needs explicit authorization.

Required repository configuration once deployment is enabled: secret `AWS_DEPLOY_ROLE_ARN`, and variables `AWS_REGION`, `S3_BUCKET_NAME`, `CLOUDFRONT_DISTRIBUTION_ID`.

## Before the first deploy

1. Populate `infra/.env`.
2. Create the OIDC provider and IAM deploy role in AWS.
3. `npm run synth`, then review `npm run diff`.
4. Deploy the stack locally with `npm run deploy`.
5. Add the GitHub secret and variables.
6. Dry-run the workflow via `workflow_dispatch` before enabling the `push` trigger.
