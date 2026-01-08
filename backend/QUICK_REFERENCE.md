# Pre-Startup Testing - Quick Reference

## 🚀 Quick Start

```bash
# Start server with tests
./start_with_testing.sh

# Skip tests (emergency)
SKIP_PRE_STARTUP_TESTS=true ./start.sh

# Run tests only
python run_pre_startup_tests.py
```

## 🔧 Common Commands

| Command | Purpose |
|---------|---------|
| `./start_with_testing.sh` | Full startup with tests |
| `./start.sh` | Basic startup with tests |
| `python run_pre_startup_tests.py` | Run all tests |
| `python run_pre_startup_tests.py --critical-only` | Critical tests only |
| `python run_pre_startup_tests.py --json` | JSON output |

## 🌍 Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `SKIP_PRE_STARTUP_TESTS` | `false` | Skip all tests |
| `PRE_STARTUP_TEST_TIMEOUT` | `30` | Test timeout (seconds) |
| `BASE_URL` | `http://localhost:8000` | API base URL |
| `ENVIRONMENT` | Auto-detect | Force environment |

## ❌ Quick Fixes

### Database Connection Failed
```bash
# Check variables
echo $SUPABASE_URL $SUPABASE_ANON_KEY

# Test connection
curl -H "apikey: $SUPABASE_ANON_KEY" "$SUPABASE_URL/rest/v1/"
```

### Missing Database Functions
```bash
# Run migrations
python apply_migration_direct.py
python apply_vector_functions.py
```

### Tests Timeout
```bash
# Increase timeout
PRE_STARTUP_TEST_TIMEOUT=60 ./start_with_testing.sh

# Critical only
python run_pre_startup_tests.py --critical-only
```

### Authentication Failed
```bash
# Development mode
export DEVELOPMENT_MODE=true

# Check JWT
python -c "import jwt,os; print(jwt.decode(os.getenv('SUPABASE_ANON_KEY'), options={'verify_signature': False}))"
```

## 🔍 Diagnostics

```bash
# System status
curl http://localhost:8000/debug

# Test results
python run_pre_startup_tests.py --json | jq '.validation_results[] | select(.status != "PASS")'

# Clear cache
rm -f .pre_startup_test_cache.json
```

## 🚨 Emergency

```bash
# Skip everything and start
SKIP_PRE_STARTUP_TESTS=true uvicorn main:app --host 0.0.0.0 --port 8000

# Direct uvicorn
uvicorn main:app --reload
```

## 📚 Documentation

- **Full Guide**: `PRE_STARTUP_TESTING_GUIDE.md`
- **Troubleshooting**: `TROUBLESHOOTING.md`
- **Design**: `.kiro/specs/pre-startup-testing/design.md`