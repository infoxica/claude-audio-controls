import { test, expect } from 'bun:test';
import { normalizedSettings, validSettings } from '../src/shared/validate-settings';
import { getStoredSettings } from '../src/shared/storage';

test('untrusted settings preserve defaults and omit invalid updates', () => {
  expect(validSettings({defaultSpeed: Infinity, defaultVolume: 5, theme: '<script>', language: 'xx', extra: true})).toEqual({});
  expect(normalizedSettings({defaultSpeed: 2, floatingUiHidden: true, enableShortcuts: 'false'})).toMatchObject({defaultSpeed: 2, floatingUiHidden: true, enableShortcuts: true});
  expect(validSettings({tapSeekSeconds: -2, language: 'ar', defaultVolume: 0})).toEqual({language: 'ar', defaultVolume: 0});
});
test('flat settings override legacy preferences only with valid values', () => {
  expect(getStoredSettings({'claude-ra-settings': {defaultSpeed: 2}, 'claude-ra-settings.defaultVolume': .4})).toMatchObject({defaultSpeed: 2, defaultVolume: .4});
  expect(getStoredSettings({'claude-ra-settings.defaultSpeed': '3'}).defaultSpeed).toBe(1);
});
