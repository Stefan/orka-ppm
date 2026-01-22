#!/bin/bash

# RAG System Setup Script
# Installiert Dependencies und führt initiales Setup durch

set -e  # Exit on error

echo "=================================================="
echo "RAG System Setup"
echo "=================================================="
echo ""

# Check if we're in the backend directory
if [ ! -f "requirements.txt" ]; then
    echo "❌ Error: Must be run from backend directory"
    echo "   cd backend && bash scripts/setup_rag_system.sh"
    exit 1
fi

# Check Python version
echo "🔍 Checking Python version..."
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo "   Python version: $python_version"

# Install sentence-transformers for local embeddings
echo ""
echo "📦 Installing sentence-transformers..."
pip install sentence-transformers

# Verify installation
echo ""
echo "✅ Verifying installation..."
python3 -c "from sentence_transformers import SentenceTransformer; print('   sentence-transformers installed successfully')"

# Download the embedding model
echo ""
echo "📥 Downloading embedding model (all-MiniLM-L6-v2)..."
python3 -c "from sentence_transformers import SentenceTransformer; model = SentenceTransformer('all-MiniLM-L6-v2'); print('   Model downloaded successfully')"

# Check environment variables
echo ""
echo "🔍 Checking environment configuration..."

if [ -f ".env" ]; then
    echo "   ✅ .env file found"
    
    if grep -q "OPENAI_API_KEY" .env; then
        echo "   ✅ OPENAI_API_KEY configured"
    else
        echo "   ⚠️  OPENAI_API_KEY not found in .env"
    fi
    
    if grep -q "USE_LOCAL_EMBEDDINGS=true" .env; then
        echo "   ✅ USE_LOCAL_EMBEDDINGS=true"
    else
        echo "   ⚠️  USE_LOCAL_EMBEDDINGS not set to true"
        echo "      Add to .env: USE_LOCAL_EMBEDDINGS=true"
    fi
    
    if grep -q "SUPABASE_URL" .env; then
        echo "   ✅ SUPABASE_URL configured"
    else
        echo "   ❌ SUPABASE_URL not found in .env"
    fi
else
    echo "   ❌ .env file not found"
    echo "      Create .env file with required variables"
    exit 1
fi

echo ""
echo "=================================================="
echo "Setup Complete!"
echo "=================================================="
echo ""
echo "Next steps:"
echo "1. Apply database migration via Supabase SQL Editor"
echo "   See: migrations/APPLY_RAG_MIGRATION_GUIDE.md"
echo ""
echo "2. Index existing content:"
echo "   python scripts/index_content_for_rag.py --batch"
echo ""
echo "3. Test the RAG system:"
echo "   python scripts/test_rag_system.py"
echo ""
