/**
 * Cypress E2E configuration (optional alternative to Playwright)
 * Enterprise Test Strategy - Task 5.4
 * Requirements: 8.1, 8.7
 */

import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: '**/*.cy.ts',
    video: true,
    screenshotOnRunFailure: true,
    viewportWidth: 1280,
    viewportHeight: 720,
  },
});
