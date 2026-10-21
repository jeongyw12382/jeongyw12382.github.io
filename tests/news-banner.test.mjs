import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { shouldShowBanner } = createRequire(import.meta.url)('../assets/js/news-banner.js');

test('shows when nothing dismissed', () => assert.equal(shouldShowBanner('2026-09-01', null), true));
test('hidden when latest already dismissed', () => assert.equal(shouldShowBanner('2026-09-01', '2026-09-01'), false));
test('shows again when newer news arrives', () => assert.equal(shouldShowBanner('2026-10-01', '2026-09-01'), true));
