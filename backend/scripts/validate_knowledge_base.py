#!/usr/bin/env python3
"""
Knowledge Base Validation and Completeness Checking Script
Validates documentation coverage and identifies gaps in the knowledge base
"""

import os
import sys
import asyncio
from pathlib import Path
from typing import Dict, List, Any, Set
from collections import defaultdict
import json

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.vector_store import VectorStore
from services.document_parser import DocumentParser
from config.database import get_db


class KnowledgeBaseValidator:
    """Validates knowledge base completeness and coverage"""

    def __init__(self):
        self.db_connection = get_db()
        self.vector_store = VectorStore(self.db_connection)
        self.document_parser = DocumentParser()

        # Expected feature categories and their critical workflows
        self.expected_categories = {
            "dashboard": [
                "overview", "metrics", "navigation", "customization",
                "real-time updates", "export"
            ],
            "projects": [
                "create project", "edit project", "delete project",
                "assign resources", "track progress", "budget management",
                "schedule management", "risk assessment"
            ],
            "resources": [
                "resource allocation", "capacity planning", "skill matching",
                "resource optimization", "availability tracking", "cost tracking"
            ],
            "financial": [
                "budget creation", "budget tracking", "variance analysis",
                "forecasting", "cost control", "financial reporting"
            ],
            "risks": [
                "risk identification", "risk assessment", "mitigation planning",
                "risk monitoring", "risk reporting", "contingency planning"
            ],
            "reports": [
                "generate reports", "customize reports", "schedule reports",
                "export reports", "share reports", "report templates"
            ],
            "user_management": [
                "user roles", "permissions", "user creation", "user deactivation",
                "role assignment", "access control"
            ],
            "collaboration": [
                "real-time editing", "comments", "notifications",
                "version control", "conflict resolution"
            ],
            "audit_trail": [
                "view history", "audit logs", "compliance reporting",
                "change tracking", "data integrity"
            ],
            "ai_features": [
                "resource optimization", "predictive analytics",
                "risk forecasting", "automated insights"
            ],
            "multi_language": [
                "language switching", "supported languages",
                "translation accuracy", "cultural adaptation"
            ]
        }

        # Critical user workflows that must be documented
        self.critical_workflows = [
            "create new project",
            "assign resources to project",
            "track project progress",
            "generate project report",
            "manage project budget",
            "assess project risks",
            "create user account",
            "configure user permissions",
            "export project data",
            "import project data",
            "set up automated reports",
            "configure dashboard",
            "manage resource allocation",
            "analyze financial variances",
            "conduct risk assessment"
        ]

    async def validate_knowledge_base(self) -> Dict[str, Any]:
        """
        Perform comprehensive validation of the knowledge base.

        Returns:
            Validation results with coverage metrics and gaps
        """
        print("🔍 Starting Knowledge Base Validation...")

        # Get all documents from the knowledge base
        documents = await self._get_all_documents()

        # Analyze coverage by category
        category_coverage = await self._analyze_category_coverage(documents)

        # Analyze critical workflow coverage
        workflow_coverage = await self._analyze_workflow_coverage(documents)

        # Calculate overall completeness score
        completeness_score = self._calculate_completeness_score(
            category_coverage, workflow_coverage
        )

        # Identify gaps and recommendations
        gaps = self._identify_gaps(category_coverage, workflow_coverage)

        results = {
            "timestamp": "2024-01-01T00:00:00Z",  # Would be datetime.now().isoformat()
            "total_documents": len(documents),
            "completeness_score": completeness_score,
            "category_coverage": category_coverage,
            "workflow_coverage": workflow_coverage,
            "identified_gaps": gaps,
            "recommendations": self._generate_recommendations(gaps)
        }

        return results

    async def _get_all_documents(self) -> List[Dict[str, Any]]:
        """Get all documents from the knowledge base"""
        try:
            # This would query the actual knowledge base
            # For now, return mock data
            return [
                {"title": "Dashboard Overview", "category": "dashboard", "content": "..."},
                {"title": "Project Creation Guide", "category": "projects", "content": "..."},
                {"title": "Resource Allocation", "category": "resources", "content": "..."},
                {"title": "Budget Management", "category": "financial", "content": "..."},
                {"title": "Risk Assessment", "category": "risks", "content": "..."},
                {"title": "Report Generation", "category": "reports", "content": "..."},
            ]
        except Exception as e:
            print(f"⚠️ Warning: Could not retrieve documents: {e}")
            return []

    async def _analyze_category_coverage(self, documents: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze documentation coverage by category"""
        category_stats = {}

        for category, required_features in self.expected_categories.items():
            category_docs = [doc for doc in documents if doc.get("category") == category]
            covered_features = set()

            # Analyze each document in the category
            for doc in category_docs:
                content = doc.get("content", "").lower()
                title = doc.get("title", "").lower()

                # Check which required features are covered
                for feature in required_features:
                    if feature.replace(" ", "") in title or feature in content:
                        covered_features.add(feature)

            coverage_percentage = (len(covered_features) / len(required_features)) * 100 if required_features else 0

            category_stats[category] = {
                "total_documents": len(category_docs),
                "required_features": len(required_features),
                "covered_features": len(covered_features),
                "coverage_percentage": coverage_percentage,
                "missing_features": list(set(required_features) - covered_features)
            }

        return category_stats

    async def _analyze_workflow_coverage(self, documents: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze coverage of critical user workflows"""
        workflow_coverage = {}

        for workflow in self.critical_workflows:
            covered = False
            covering_docs = []

            # Search for workflow coverage in documents
            for doc in documents:
                content = doc.get("content", "").lower()
                title = doc.get("title", "").lower()

                # Check if workflow is mentioned
                if workflow in content or any(word in content for word in workflow.split()):
                    covered = True
                    covering_docs.append(doc.get("title", "Unknown"))

            workflow_coverage[workflow] = {
                "covered": covered,
                "covering_documents": covering_docs
            }

        covered_count = sum(1 for w in workflow_coverage.values() if w["covered"])
        coverage_percentage = (covered_count / len(self.critical_workflows)) * 100

        return {
            "workflows": workflow_coverage,
            "covered_count": covered_count,
            "total_workflows": len(self.critical_workflows),
            "coverage_percentage": coverage_percentage
        }

    def _calculate_completeness_score(self, category_coverage: Dict, workflow_coverage: Dict) -> float:
        """Calculate overall completeness score"""
        # Weight category coverage at 60% and workflow coverage at 40%
        category_avg = sum(cat["coverage_percentage"] for cat in category_coverage.values()) / len(category_coverage) if category_coverage else 0
        workflow_pct = workflow_coverage.get("coverage_percentage", 0)

        return (category_avg * 0.6) + (workflow_pct * 0.4)

    def _identify_gaps(self, category_coverage: Dict, workflow_coverage: Dict) -> Dict[str, Any]:
        """Identify gaps in documentation coverage"""
        gaps = {
            "missing_categories": [],
            "under_documented_features": [],
            "uncovered_workflows": [],
            "low_coverage_categories": []
        }

        # Find categories with low coverage
        for category, stats in category_coverage.items():
            if stats["coverage_percentage"] < 50:
                gaps["low_coverage_categories"].append({
                    "category": category,
                    "coverage": stats["coverage_percentage"],
                    "missing_features": stats["missing_features"]
                })

        # Find uncovered workflows
        for workflow, coverage in workflow_coverage["workflows"].items():
            if not coverage["covered"]:
                gaps["uncovered_workflows"].append(workflow)

        return gaps

    def _generate_recommendations(self, gaps: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on identified gaps"""
        recommendations = []

        if gaps["low_coverage_categories"]:
            recommendations.append(
                f"Focus on improving documentation for {len(gaps['low_coverage_categories'])} "
                "categories with coverage below 50%"
            )

        if gaps["uncovered_workflows"]:
            recommendations.append(
                f"Create documentation for {len(gaps['uncovered_workflows'])} critical user workflows"
            )

        # Add specific recommendations
        for category_gap in gaps["low_coverage_categories"]:
            recommendations.append(
                f"Document missing features in '{category_gap['category']}': "
                f"{', '.join(category_gap['missing_features'][:3])}"
            )

        if len(recommendations) == 0:
            recommendations.append("Knowledge base appears comprehensive. Continue monitoring for new features.")

        return recommendations

    def generate_report(self, validation_results: Dict[str, Any]) -> str:
        """Generate a human-readable validation report"""
        report = []
        report.append("=" * 60)
        report.append("KNOWLEDGE BASE VALIDATION REPORT")
        report.append("=" * 60)
        report.append("")

        report.append(f"Total Documents: {validation_results['total_documents']}")
        report.append(".1f"        report.append("")

        # Category coverage summary
        report.append("CATEGORY COVERAGE:")
        report.append("-" * 30)
        for category, stats in validation_results["category_coverage"].items():
            report.append("30")

        report.append("")
        report.append("CRITICAL WORKFLOW COVERAGE:")
        report.append("-" * 35)
        workflow_stats = validation_results["workflow_coverage"]
        report.append(".1f"        report.append(f"Covered Workflows: {workflow_stats['covered_count']}/{workflow_stats['total_workflows']}")

        report.append("")
        report.append("IDENTIFIED GAPS:")
        report.append("-" * 20)
        gaps = validation_results["identified_gaps"]

        if gaps["low_coverage_categories"]:
            report.append(f"Categories with <50% coverage: {len(gaps['low_coverage_categories'])}")
            for cat in gaps["low_coverage_categories"]:
                report.append(f"  - {cat['category']}: {cat['coverage']:.1f}%")

        if gaps["uncovered_workflows"]:
            report.append(f"Uncovered critical workflows: {len(gaps['uncovered_workflows'])}")
            for workflow in gaps["uncovered_workflows"][:5]:  # Show first 5
                report.append(f"  - {workflow}")

        report.append("")
        report.append("RECOMMENDATIONS:")
        report.append("-" * 20)
        for rec in validation_results["recommendations"]:
            report.append(f"• {rec}")

        return "\n".join(report)


async def main():
    """Main validation function"""
    print("🔍 Knowledge Base Validator")
    print("=" * 40)

    validator = KnowledgeBaseValidator()

    try:
        results = await validator.validate_knowledge_base()

        # Generate and display report
        report = validator.generate_report(results)
        print(report)

        # Save detailed results to file
        output_file = "knowledge_base_validation_report.json"
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)

        print(f"\n📄 Detailed results saved to: {output_file}")

        # Exit with code based on completeness score
        score = results["completeness_score"]
        if score >= 80:
            print("✅ Knowledge base validation PASSED")
            sys.exit(0)
        elif score >= 60:
            print("⚠️ Knowledge base validation PASSED with warnings")
            sys.exit(0)
        else:
            print("❌ Knowledge base validation FAILED - coverage too low")
            sys.exit(1)

    except Exception as e:
        print(f"❌ Validation failed: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())