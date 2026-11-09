import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflow = Bun.YAML.parse(readFileSync('.github/workflows/publish-stores.yml', 'utf8')) as any;
test('store submission is manual, opt-in and gated by verification', () => {
  expect(Object.keys(workflow.on)).toEqual(['workflow_dispatch']);
  expect(workflow.on.workflow_dispatch.inputs.publish_to_stores.default).toBe(false);
  expect(workflow.jobs.verify.steps.some((s: any) => s.if === 'inputs.publish_to_stores' && s.run === 'bun run release:check')).toBe(true);
  for (const store of ['chrome', 'edge']) {
    expect(workflow.jobs[store].needs).toBe('verify');
    expect(workflow.jobs[store].if).toContain('inputs.publish_to_stores &&');
    expect(workflow.jobs[store].environment).toBe('store-publishing');
  }
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
