# Example BDD feature - API health
# Enterprise Test Strategy - Task 1.3
# Demonstrates Gherkin syntax for backend API tests

Feature: API health and availability
  As a system integrator
  I want the API to respond to health checks
  So that I can verify the service is running

  Scenario: Health endpoint returns 200
    Given the API base URL is "http://localhost:8000"
    When I GET "/health"
    Then the response status code should be 200
    And the response body should contain "ok"

  @wip
  Scenario: API version is exposed
    When I GET "/api/version"
    Then the response status code should be 200
