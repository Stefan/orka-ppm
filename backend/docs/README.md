# PPM SaaS Backend

AI-powered Project Portfolio Management Platform backend built with FastAPI.

## 🚀 Quick Start

### Development

```bash
# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start server with pre-startup testing
./start_with_testing.sh
```

### Production

```bash
# Docker
docker build -t ppm-backend .
docker run -p 8000:8000 ppm-backend

# Direct deployment
uvicorn main:app --host 0.0.0.0 --port 8000
```

## 🧪 Pre-Startup Testing System

This backend includes a comprehensive pre-startup testing system that validates your configuration before the server starts.

### Features

- **Database Connectivity**: Validates Supabase connection and required functions
- **API Endpoints**: Tests critical endpoints for functionality
- **Authentication**: Verifies JWT tokens and user authentication
- **Configuration**: Checks environment variables and settings
- **Automatic Integration**: Runs seamlessly during server startup

### Quick Commands

```bash
# Start with tests (recommended)
./start_with_testing.sh

# Run tests only
python run_pre_startup_tests.py

# Skip tests (emergency)
SKIP_PRE_STARTUP_TESTS=true ./start.sh

# Critical tests only
python run_pre_startup_tests.py --critical-only
```

### Documentation

- **📖 [Complete Guide](PRE_STARTUP_TESTING_GUIDE.md)** - Full documentation
- **🔧 [Troubleshooting](TROUBLESHOOTING.md)** - Common issues and solutions  
- **⚡ [Quick Reference](QUICK_REFERENCE.md)** - Commands and fixes

## 🔧 Configuration

### Required Environment Variables

```bash
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Optional
OPENAI_API_KEY=your-openai-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Optional Configuration

```bash
# Pre-startup testing
SKIP_PRE_STARTUP_TESTS=false
PRE_STARTUP_TEST_TIMEOUT=30
BASE_URL=http://localhost:8000

# Server
HOST=0.0.0.0
PORT=8000
WORKERS=1
```

## 🏗️ Architecture

### Core Components

- **FastAPI Application** (`main.py`) - Main application with all endpoints
- **Pre-Startup Testing** (`pre_startup_testing/`) - Validation system
- **AI Agents** (`ai_agents.py`) - AI-powered features
- **Database Services** - Supabase integration and utilities

### Key Features

- **Role-Based Access Control** - Comprehensive permission system
- **Budget Monitoring** - Automated budget alerts and variance tracking
- **Resource Management** - Advanced resource allocation and optimization
- **Risk Management** - Risk tracking and issue management
- **AI Integration** - RAG queries, resource optimization, risk forecasting
- **CSV Import** - Bulk data import with validation
- **Performance Monitoring** - Caching, rate limiting, and optimization

## 🧪 Testing

### Pre-Startup Tests

Automated tests that run before server startup:

```bash
# All tests
python run_pre_startup_tests.py

# With JSON output
python run_pre_startup_tests.py --json

# Verbose output
python run_pre_startup_tests.py --verbose
```

### Unit Tests

```bash
# Run all tests
pytest

# Run specific test file
pytest test_supabase.py

# Run with coverage
pytest --cov=. --cov-report=html
```

### Property-Based Tests

```bash
# Run property-based tests
pytest backend/pre_startup_testing/test_*_properties.py

# Run specific property test
pytest backend/pre_startup_testing/test_configuration_properties.py -v
```

## 📊 API Documentation

### Interactive Documentation

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Key Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/` | Health check and system info |
| `/health` | Detailed health status |
| `/debug` | System diagnostics (dev only) |
| `/admin/*` | Admin management endpoints |
| `/projects/*` | Project management |
| `/resources/*` | Resource management |
| `/financials/*` | Financial tracking |
| `/risks/*` | Risk management |
| `/ai/*` | AI-powered features |

## 🚀 Deployment

### Supported Platforms

- **Vercel** - Automatic deployment with pre-startup testing
- **Render** - Container deployment with health checks
- **Heroku** - Procfile-based deployment
- **Docker** - Containerized deployment
- **Railway** - Git-based deployment

### Environment-Specific Notes

#### Vercel
```json
{
  "env": {
    "SKIP_PRE_STARTUP_TESTS": "false",
    "BASE_URL": "https://your-app.vercel.app"
  }
}
```

#### Docker
```dockerfile
# Uses docker-start.sh for optimized container startup
CMD ["./docker-start.sh"]
```

#### Render
```yaml
# render.yaml includes pre-startup testing configuration
envVars:
  - key: SKIP_PRE_STARTUP_TESTS
    value: false
```

## 🔍 Monitoring

### Health Checks

```bash
# Basic health
curl http://localhost:8000/health

# Detailed diagnostics
curl http://localhost:8000/debug

# Pre-startup test status
python run_pre_startup_tests.py --json
```

### Logging

- **Application logs**: `backend.log`
- **Test results**: Console output and JSON format
- **Error tracking**: Detailed error messages with resolution steps

## 🛠️ Development

### Project Structure

```
backend/
├── main.py                     # Main FastAPI application
├── pre_startup_testing/        # Pre-startup testing system
├── migrations/                 # Database migrations
├── tests/                      # Unit and integration tests
├── start_with_testing.sh       # Enhanced startup script
├── docker-start.sh            # Docker startup script
├── PRE_STARTUP_TESTING_GUIDE.md # Complete documentation
└── requirements.txt           # Python dependencies
```

### Adding New Features

1. **Add endpoint** to `main.py`
2. **Add tests** to `tests/`
3. **Update pre-startup tests** if needed
4. **Update documentation**

### Database Changes

1. **Create migration** in `migrations/`
2. **Apply migration**: `python apply_migration_direct.py`
3. **Update pre-startup tests** to validate new schema
4. **Test with**: `python run_pre_startup_tests.py`

## 🤝 Contributing

### Development Workflow

1. **Clone repository**
2. **Install dependencies**: `pip install -r requirements.txt`
3. **Set up environment**: Copy and edit `.env`
4. **Run tests**: `python run_pre_startup_tests.py`
5. **Start development**: `./start_with_testing.sh`
6. **Make changes**
7. **Test changes**: `pytest`
8. **Commit and push**

### Code Quality

- **Pre-startup tests** must pass
- **Unit tests** must pass
- **Code formatting** with Black
- **Type hints** where appropriate
- **Documentation** for new features

## 📞 Support

### Getting Help

1. **📖 Check documentation** - Start with the guides above
2. **🔧 Run diagnostics** - Use troubleshooting commands
3. **🐛 Create issue** - Include diagnostic information
4. **💬 Ask questions** - Use project discussions

### Common Issues

- **Database connection failed** → Check `TROUBLESHOOTING.md`
- **Tests timeout** → Increase `PRE_STARTUP_TEST_TIMEOUT`
- **Authentication failed** → Verify JWT tokens
- **Missing functions** → Run database migrations

---

**Built with ❤️ using FastAPI, Supabase, and comprehensive testing**