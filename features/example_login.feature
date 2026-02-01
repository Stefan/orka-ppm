# Example BDD feature - Login flow
# Enterprise Test Strategy - Task 1.3
# Demonstrates Gherkin syntax for frontend E2E

Feature: User login
  As a user
  I want to log in to the application
  So that I can access my dashboard

  Scenario: Login page loads
    Given I am on the login page
    When the page has loaded
    Then I should see "Login" or "Sign in"
    And I should see an email input
    And I should see a password input

  @wip
  Scenario: Successful login redirects to dashboard
    Given I am on the login page
    When I enter valid credentials
    And I submit the login form
    Then I should be redirected to the dashboard
