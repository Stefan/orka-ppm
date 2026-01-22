#!/bin/bash

# Generate documentation template for a new feature
# Usage: ./scripts/generate-feature-docs.sh "Feature Name" "feature-slug"

if [ $# -lt 2 ]; then
    echo "Usage: $0 \"Feature Name\" \"feature-slug\""
    echo "Example: $0 \"Schedule Management\" \"schedule-management\""
    exit 1
fi

FEATURE_NAME="$1"
FEATURE_SLUG="$2"
DOC_FILE="docs/${FEATURE_SLUG}.md"

if [ -f "$DOC_FILE" ]; then
    echo "❌ Documentation file already exists: $DOC_FILE"
    exit 1
fi

cat > "$DOC_FILE" << EOF
# ${FEATURE_NAME} Guide

**Last Updated:** $(date +"%B %Y")  
**Status:** Draft  
**Version:** 1.0

---

## Overview

Brief description of the ${FEATURE_NAME} feature.

### Key Capabilities
- Capability 1
- Capability 2
- Capability 3

### Use Cases
- Use case 1
- Use case 2
- Use case 3

---

## Getting Started

### Prerequisites
- Prerequisite 1
- Prerequisite 2

### Basic Setup
1. Step 1
2. Step 2
3. Step 3

### First Steps
1. Step 1
2. Step 2
3. Step 3

---

## Core Concepts

### Key Terminology
- **Term 1**: Definition
- **Term 2**: Definition
- **Term 3**: Definition

### Architecture Overview
Describe the architecture of this feature.

### Data Models
Describe the data models used.

---

## How-To Guides

### Common Task 1
1. Step 1
2. Step 2
3. Step 3

### Common Task 2
1. Step 1
2. Step 2
3. Step 3

### Best Practices
- Best practice 1
- Best practice 2
- Best practice 3

---

## API Reference

### Endpoints

#### GET /api/${FEATURE_SLUG}
Get all items.

**Request:**
\`\`\`http
GET /api/${FEATURE_SLUG}
Authorization: Bearer <token>
\`\`\`

**Response:**
\`\`\`json
{
  "data": [],
  "total": 0
}
\`\`\`

#### POST /api/${FEATURE_SLUG}
Create a new item.

**Request:**
\`\`\`http
POST /api/${FEATURE_SLUG}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Example"
}
\`\`\`

**Response:**
\`\`\`json
{
  "id": "123",
  "name": "Example"
}
\`\`\`

### Error Codes
- \`400\` - Bad Request
- \`401\` - Unauthorized
- \`404\` - Not Found
- \`500\` - Internal Server Error

---

## Examples

### Example 1: Basic Usage
\`\`\`typescript
// Frontend example
import { use${FEATURE_NAME} } from '@/hooks/use${FEATURE_SLUG}'

function MyComponent() {
  const { data, loading } = use${FEATURE_NAME}()
  
  if (loading) return <div>Loading...</div>
  
  return <div>{/* Your component */}</div>
}
\`\`\`

### Example 2: Advanced Usage
\`\`\`python
# Backend example
from services.${FEATURE_SLUG}_service import ${FEATURE_NAME}Service

service = ${FEATURE_NAME}Service(supabase)
result = await service.process()
\`\`\`

---

## Troubleshooting

### Common Issue 1
**Problem:** Description of the problem

**Solution:** Description of the solution

### Common Issue 2
**Problem:** Description of the problem

**Solution:** Description of the solution

### Debug Procedures
1. Step 1
2. Step 2
3. Step 3

---

## Related Documentation

- [Project Structure](PROJECT_STRUCTURE.md)
- [API Documentation](backend/API_DOCUMENTATION.md)
- [Testing Guide](TESTING_GUIDE.md)

---

## Changelog

### Version 1.0 ($(date +"%B %Y"))
- Initial documentation

---

*Documentation generated: $(date +"%Y-%m-%d %H:%M:%S")*
EOF

echo "✅ Documentation template created: $DOC_FILE"
echo ""
echo "Next steps:"
echo "1. Edit $DOC_FILE and fill in the details"
echo "2. Add code examples"
echo "3. Add screenshots if needed"
echo "4. Run: python backend/scripts/index_documentation.py"
echo "5. Commit the documentation"
