import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

import { shouldPublish, versionIncreased } from '../scripts/release-policy.mjs';
const workflow = Bun.YAML.parse(readFileSync('.github/workflows/release.yml', 'utf8')) as any;
test('release workflow matches reference triggers and requires verification', () => {
  expect(workflow.on.push.branches).toEqual(['main', 'develop']);
  expect(workflow.on.push.tags).toEqual(['v*']);
  expect(workflow.on.workflow_dispatch.inputs.publish_to_stores.default).toBe('no');
  expect(workflow.jobs.verify.steps.some((s: any) => s.run === 'bun run release:check')).toBe(true);
  for (const store of ['chrome', 'edge']) {
    expect(workflow.jobs['publish-' + store].needs).toBe('verify');
    expect(workflow.jobs['publish-' + store].if).toContain("needs.verify.outputs.publish == 'true'");
    expect(workflow.jobs['publish-' + store].environment).toBe('store-publishing');
  }
});
test('only version increases on main or explicit manual retries submit to stores', () => {
  const base = {event:'push',ref:'refs/heads/main',previous:'1.0.0',current:'1.0.1',manual:'no'};
  expect(shouldPublish(base)).toBe(true);
  for (const current of ['1.0.0','0.9.9']) expect(shouldPublish({...base,current})).toBe(false);
  for (const ref of ['refs/heads/develop','refs/heads/feature/test','refs/tags/v1.0.1']) expect(shouldPublish({...base,ref})).toBe(false);
  expect(shouldPublish({...base,event:'pull_request'})).toBe(false);
  expect(shouldPublish({...base,event:'workflow_dispatch',manual:'no'})).toBe(false);
  expect(shouldPublish({...base,event:'workflow_dispatch',manual:'yes'})).toBe(true);
  expect(versionIncreased('1.9.9','1.10.0')).toBe(true);
  expect(()=>versionIncreased('invalid','1.0.0')).toThrow();
});
test('publishing scripts refuse direct calls without opt-in, before credentials or network', () => {
  const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
  for (const store of ['chrome', 'edge']) {
    const result = spawnSync(bash, [`scripts/publish-${store}.sh`], {encoding:'utf8',env:{...process.env,PUBLISH_TO_STORES:'false'}});
    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe('Publishing is disabled.');
    const wrongBranch = spawnSync(bash, [`scripts/publish-${store}.sh`], {encoding:'utf8',env:{...process.env,PUBLISH_TO_STORES:'true',GITHUB_REF:'refs/heads/feature/test'}});
    expect(wrongBranch.status).toBe(1);
    expect(wrongBranch.stderr.trim()).toBe('Publishing requires main.');
  }
});
