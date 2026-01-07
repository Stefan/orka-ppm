#!/bin/bash
set -e

echo "🔍 Verifying dependency resolution..."

# Create a temporary virtual environment
python3 -m venv temp_venv
source temp_venv/bin/activate

# Upgrade pip
pip install --upgrade pip

echo "📦 Installing dependencies..."
pip install -r requirements.txt

echo "✅ Checking cachetools version..."
python -c "import cachetools; print(f'cachetools version: {cachetools.__version__}')"

echo "✅ Checking pyiceberg availability..."
python -c "
try:
    import pyiceberg
    print(f'pyiceberg version: {pyiceberg.__version__}')
except ImportError:
    print('pyiceberg not available (this is OK)')
"

echo "✅ Testing core imports..."
python test_dependencies.py

# Cleanup
deactivate
rm -rf temp_venv

echo "🎉 All dependencies verified successfully!"