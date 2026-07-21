#!/usr/bin/env node
/**
 * CDK app entrypoint for the Elements infra.
 *
 * Loads the validated `.env` configuration and instantiates the single
 * `SiteStack`, pinned to the account/region declared in `.env`. The ACM
 * certificate it references must independently live in us-east-1.
 */

import { App } from 'aws-cdk-lib';
import { loadSiteConfig } from '../lib/config';
import { SiteStack } from '../lib/site-stack';
import { STACK } from '../lib/constants';

const config = loadSiteConfig();

const app = new App();

new SiteStack(app, STACK.ID, {
  config,
  env: {
    account: config.awsAccountId,
    region: config.awsRegion,
  },
});

app.synth();
