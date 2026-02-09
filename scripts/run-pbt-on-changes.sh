#!/bin/bash
#
# Automated Property-Based Test Execution on Code Changes
#
# This script detects code changes and runs relevant property-based tests
# automatically. It can be used as a git hook or in CI/CD pipelines.
#
# Task: 13.2 Add CI/CD integration and automation
# Feature: property-based-testing

set -e

# Configuration
BACKEND_DIR="backend"
FRONTEND_DIR="."
TEST_DIR="backend/tests/property_tests"
OUTPUT_DIR="test-results/pbt-auto"
PYTHON_CMD=$(command -v python3 2>/dev/null || command -v python 2>/dev/null || echo "python3")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to detect changed files
detect_changes() {
    local base_ref="${1:-HEAD~1}"
    local head_ref="${2:-HEAD}"
    
    print_info "Detecting changes between $base_ref and $head_ref"
    
    # Get list of changed files
    CHANGED_FILES=$(git diff --name-only "$base_ref" "$head_ref" 2>/dev/null || echo "")
    
    if [ -z "$CHANGED_FILES" ]; then
        print_warn "No changes detected"
        return 1
    fi
    
    echo "$CHANGED_FILES"
    return 0
}

# Function to determine which tests to run based on changes
determine_test_scope() {
    local changed_files="$1"
    local test_scope="none"
    local backend_changed=false
    local frontend_changed=false
    
    # Check for backend changes
    if echo "$changed_files" | grep -q "^backend/"; then
        backend_changed=true
        print_info "Backend changes detected"
    fi
    
    # Check for frontend changes
    if echo "$changed_files" | grep -qE "^(components/|app/|hooks/|__tests__/)"; then
        frontend_changed=true
        print_info "Frontend changes detected"
    fi
    
    # Determine scope
    if [ "$backend_changed" = true ] && [ "$frontend_changed" = true ]; then
        test_scope="all"
    elif [ "$backend_changed" = true ]; then
        test_scope="backend"
    elif [ "$frontend_changed" = true ]; then
        test_scope="frontend"
    fi
    
    echo "$test_scope"
}

# Function to determine specific test categories based on file changes
determine_test_categories() {
    local changed_files="$1"
    local categories=()
    
    # Financial accuracy tests
    if echo "$changed_files" | grep -qE "(variance|financial|budget)"; then
        categories+=("financial_accuracy")
    fi
    
    # API contract tests
    if echo "$changed_files" | grep -qE "(routers/|api/)"; then
        categories+=("api_contract")
    fi
    
    # Data integrity tests
    if echo "$changed_files" | grep -qE "(models/|schemas/|database)"; then
        categories+=("data_integrity")
    fi
    
    # Business logic tests
    if echo "$changed_files" | grep -qE "(services/|utils/)"; then
        categories+=("business_logic")
    fi
    
    # Filter consistency tests
    if echo "$changed_files" | grep -qE "(filter|search|components/)"; then
        categories+=("filter_consistency")
    fi
    
    # Performance tests
    if echo "$changed_files" | grep -qE "(performance|optimization)"; then
        categories+=("performance")
    fi
    
    # If no specific categories, run all
    if [ ${#categories[@]} -eq 0 ]; then
        categories=("all")
    fi
    
    echo "${categories[@]}"
}

# Function to run property-based tests
run_pbt() {
    local scope="$1"
    local categories="$2"
    
    print_info "Running property-based tests (scope: $scope, categories: $categories)"
    
    # Create output directory
    mkdir -p "$OUTPUT_DIR"
    
    # Build orchestrator command
    local cmd="$PYTHON_CMD $TEST_DIR/pbt_orchestrator.py --output-dir $OUTPUT_DIR"
    
    case "$scope" in
        backend)
            cmd="$cmd --backend-only"
            ;;
        frontend)
            cmd="$cmd --frontend-only"
            ;;
        all)
            # Run both backend and frontend
            ;;
        none)
            print_info "No relevant changes detected, skipping tests"
            return 0
            ;;
    esac
    
    # Add category filter if specific categories detected
    if [ "$categories" != "all" ]; then
        print_info "Filtering tests by categories: $categories"
        # Note: This would require extending the orchestrator to support category filtering
    fi
    
    # Run tests
    print_info "Executing: $cmd"
    
    if eval "$cmd"; then
        print_info "✓ Property-based tests passed"
        return 0
    else
        print_error "✗ Property-based tests failed"
        return 1
    fi
}

# Function to analyze results
analyze_results() {
    print_info "Analyzing test results"
    
    # Find latest report
    local latest_report=$(ls -t "$OUTPUT_DIR"/pbt-*_report.json 2>/dev/null | head -1)
    
    if [ -z "$latest_report" ]; then
        print_warn "No test report found"
        return 1
    fi
    
    # Run analysis
    $PYTHON_CMD "$TEST_DIR/pbt_analysis.py" "$latest_report" \
        --reports-dir "$OUTPUT_DIR" \
        --output "$OUTPUT_DIR/analysis.json"
    
    # Extract key metrics
    local success_rate=$(jq -r '.success_rate_trend.current_value' "$OUTPUT_DIR/analysis.json" 2>/dev/null || echo "N/A")
    local trend=$(jq -r '.success_rate_trend.trend_direction' "$OUTPUT_DIR/analysis.json" 2>/dev/null || echo "N/A")
    local failures=$(jq -r '.failure_patterns | length' "$OUTPUT_DIR/analysis.json" 2>/dev/null || echo "0")
    
    print_info "Success Rate: $success_rate%"
    print_info "Trend: $trend"
    
    if [ "$failures" -gt 0 ]; then
        print_warn "Recurring failures detected: $failures"
    fi
    
    return 0
}

# Function to generate summary report
generate_summary() {
    local latest_report=$(ls -t "$OUTPUT_DIR"/pbt-*_report.json 2>/dev/null | head -1)
    
    if [ -z "$latest_report" ]; then
        return 1
    fi
    
    echo ""
    echo "========================================="
    echo "Property-Based Testing Summary"
    echo "========================================="
    
    local total=$(jq -r '.total_tests' "$latest_report")
    local passed=$(jq -r '.total_passed' "$latest_report")
    local failed=$(jq -r '.total_failed' "$latest_report")
    local success_rate=$(jq -r '.overall_success_rate' "$latest_report")
    local exec_time=$(jq -r '.total_execution_time' "$latest_report")
    
    echo "Total Tests: $total"
    echo "Passed: $passed"
    echo "Failed: $failed"
    echo "Success Rate: $success_rate%"
    echo "Execution Time: ${exec_time}s"
    echo "========================================="
    echo ""
}

# Main execution
main() {
    local base_ref="${1:-HEAD~1}"
    local head_ref="${2:-HEAD}"
    local force_all="${3:-false}"
    
    print_info "Property-Based Test Automation"
    print_info "Base: $base_ref, Head: $head_ref"
    
    # Detect changes
    if ! changed_files=$(detect_changes "$base_ref" "$head_ref"); then
        if [ "$force_all" = "true" ]; then
            print_info "No changes detected, but running all tests (forced)"
            test_scope="all"
            test_categories="all"
        else
            print_info "No changes detected, skipping tests"
            exit 0
        fi
    else
        # Determine test scope
        test_scope=$(determine_test_scope "$changed_files")
        test_categories=$(determine_test_categories "$changed_files")
        
        print_info "Test scope: $test_scope"
        print_info "Test categories: $test_categories"
    fi
    
    # Run tests
    if run_pbt "$test_scope" "$test_categories"; then
        # Analyze results
        analyze_results
        
        # Generate summary
        generate_summary
        
        print_info "✓ All tests completed successfully"
        exit 0
    else
        print_error "✗ Tests failed"
        
        # Still analyze and generate summary
        analyze_results || true
        generate_summary || true
        
        exit 1
    fi
}

# Parse command line arguments
FORCE_ALL=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --force-all)
            FORCE_ALL=true
            shift
            ;;
        --base)
            BASE_REF="$2"
            shift 2
            ;;
        --head)
            HEAD_REF="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS] [BASE_REF] [HEAD_REF]"
            echo ""
            echo "Options:"
            echo "  --force-all    Run all tests regardless of changes"
            echo "  --base REF     Base git reference (default: HEAD~1)"
            echo "  --head REF     Head git reference (default: HEAD)"
            echo "  --help         Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                           # Compare HEAD with HEAD~1"
            echo "  $0 main HEAD                 # Compare main with HEAD"
            echo "  $0 --force-all               # Run all tests"
            exit 0
            ;;
        *)
            if [ -z "$BASE_REF" ]; then
                BASE_REF="$1"
            elif [ -z "$HEAD_REF" ]; then
                HEAD_REF="$1"
            fi
            shift
            ;;
    esac
done

# Run main function
main "${BASE_REF:-HEAD~1}" "${HEAD_REF:-HEAD}" "$FORCE_ALL"
