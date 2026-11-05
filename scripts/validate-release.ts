import pkg from '../package.json';
import acceptance from '../config/acceptance.json';
import config from '../config/release.json';
import { acceptanceComplete } from './release-acceptance';
import { checkVersions } from './check-versions';
checkVersions();
if (!acceptanceComplete(acceptance, pkg.version)) throw new Error('Release blocked: live acceptance is incomplete. See config/acceptance.json and docs/ACCEPTANCE.md.');
if (!/^[a-p]{32}$/.test(config.chromeItemId) || !/^[a-p]{32}$/.test(config.edgeItemId)) throw new Error('Release blocked: new store listings are not configured.');
console.log('Production release gates passed.');
