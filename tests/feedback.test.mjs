import { expect, test } from 'bun:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { validFeedbackURL, feedbackURL } from '../src/shared/feedback';
test('feedback links are restricted to the production Worker',()=>{
  expect(validFeedbackURL('https://claude-audio-feedback.example.workers.dev/feedback')).toBe(true);
  expect(validFeedbackURL('https://claude-audio-controls.infoxica.com/feedback')).toBe(true);
  expect(validFeedbackURL('https://claude-audio-controls.infoxica.com.evil.test/feedback')).toBe(false);
  for(const url of ['http://claude-audio-feedback.example.workers.dev/feedback','https://evil.test/feedback','https://claude-audio-feedback-staging.example.workers.dev/feedback','https://claude-audio-feedback.example.workers.dev/feedback?redirect=https://evil.test','https://user@claude-audio-feedback.example.workers.dev/feedback'])expect(validFeedbackURL(url)).toBe(false);
  const url=new URL(feedbackURL('ja','uninstall','Windows'));expect(url.searchParams.get('source')).toBe('uninstall');expect(url.searchParams.get('lang')).toBe('ja');
});
