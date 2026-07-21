#!/usr/bin/env node
// Thin CDK wrapper: loads .env and passes AWS_PROFILE as --profile if set.
import 'dotenv/config';
import { spawnSync } from 'child_process';

const [, , command, ...rest] = process.argv;
const profileArgs = process.env.AWS_PROFILE
  ? ["--profile", process.env.AWS_PROFILE]
  : [];

const result = spawnSync(
  "cdk",
  [command, ...profileArgs, ...rest],
  { stdio: "inherit", shell: true }
);

process.exit(result.status ?? 1);
