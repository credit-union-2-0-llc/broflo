/**
 * Cross-browser login smoke config.
 *
 * Complements the main `playwright.config.ts`:
 *   - Main config: 20+ use-case specs on chromium + mobile-ios (fast feedback)
 *   - This config: ONE login smoke spec on Chromium, Firefox, WebKit, Edge,
 *     Mobile iOS, Mobile Android (engine coverage)
 *
 * Run:
 *   pnpm test:cross-browser
 */

import {
  createPlaywrightConfig,
  FULL_MATRIX,
} from '@cu2/shared-lib/testing';

const BASE_URL = process.env.BROFLO_BASE_URL || 'http://localhost:4000';
const API_URL = process.env.BROFLO_API_URL || 'http://localhost:3001';

export default createPlaywrightConfig({
  baseUrl: BASE_URL,
  apiUrl: API_URL,
  testDir: './tests/e2e-cross-browser',
  matrix: FULL_MATRIX,
  extend: {
    timeout: 90_000,
    expect: { timeout: 15_000 },
  },
});
