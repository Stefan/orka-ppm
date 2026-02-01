/**
 * Cucumber/BDD configuration for frontend E2E
 * Enterprise Test Strategy - Task 1.3
 * Requirements: 2.2, 2.3
 *
 * Use with @cucumber/cucumber or similar runner.
 * Example feature files in features/*.feature
 */

module.exports = {
  default: {
    paths: ['features/**/*.feature'],
    format: ['progress', 'html:test-reports/cucumber-html/report.html'],
    formatOptions: { snippetInterface: 'async-await' },
    require: ['features/step_definitions/**/*.js', 'features/support/**/*.js'],
    requireModule: [],
    tags: 'not @wip',
    publishQuiet: true,
  },
};
