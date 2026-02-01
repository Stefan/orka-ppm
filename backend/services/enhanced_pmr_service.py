"""
Enhanced PMR Service - Main Orchestration Service
Coordinates AI insight generation, Monte Carlo analysis, and RAG-powered executive summaries
"""

import os
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, date
from decimal import Decimal
from uuid import UUID, uuid4
from supabase import Client

# Import models
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models.pmr import (
    EnhancedPMRReport, EnhancedPMRGenerationRequest, EnhancedPMRResponse,
    AIInsightCategory, MonteCarloResults, RealTimeMetrics,
    PMRStatus, AIInsightEngine as AIInsightEngineModel
)

# Import services
from services.ai_insights_engine import AIInsightsEngine
from services.help_rag_agent import HelpRAGAgent, PageContext

logger = logging.getLogger(__name__)


class EnhancedPMRService:
    """
    Main orchestration service for Enhanced PMR generation
    Integrates AI insights, Monte Carlo analysis, and RAG-powered content generation
    """
    
    def __init__(self, supabase_client: Client, openai_api_key: str):
        """Initialize Enhanced PMR Service with dependencies"""
        self.supabase = supabase_client
        self.openai_api_key = openai_api_key
        
        # Initialize AI Insights Engine
        self.ai_insights_engine = AIInsightsEngine(supabase_client, openai_api_key)
        
        # Initialize RAG Agent for executive summary generation
        self.rag_agent = HelpRAGAgent(supabase_client, openai_api_key)
        
        logger.info("Enhanced PMR Service initialized")
    
    async def generate_enhanced_pmr(
        self,
        request: EnhancedPMRGenerationRequest,
        user_id: UUID
    ) -> EnhancedPMRReport:
        """
        Generate an Enhanced PMR with AI insights and predictive analytics
        
        Args:
            request: Enhanced PMR generation request with configuration
            user_id: UUID of the user generating the report
            
        Returns:
            EnhancedPMRReport with AI insights, Monte Carlo analysis, and executive summary
        """
        start_time = datetime.utcnow()
        
        try:
            logger.info(f"Starting Enhanced PMR generation for project {request.project_id}")
            
            # Step 1: Create base PMR report structure
            report = await self._create_base_report(request, user_id)
            
            # Step 2: Generate AI insights if enabled
            if request.include_ai_insights:
                logger.info("Generating AI insights...")
                ai_insights = await self._generate_ai_insights(
                    report_id=report.id,
                    project_id=request.project_id,
                    categories=request.ai_insight_categories
                )
                for insight in ai_insights:
                    report.add_ai_insight(insight)
                logger.info(f"Generated {len(ai_insights)} AI insights")
            
            # Step 3: Run Monte Carlo analysis if enabled
            if request.include_monte_carlo:
                logger.info("Running Monte Carlo analysis...")
                monte_carlo_results = await self._run_monte_carlo_analysis(
                    project_id=request.project_id,
                    iterations=request.monte_carlo_iterations,
                    confidence_levels=request.monte_carlo_confidence_levels
                )
                report.monte_carlo_analysis = monte_carlo_results
                report.monte_carlo_enabled = True
                logger.info("Monte Carlo analysis completed")
            
            # Step 4: Generate executive summary using RAG agent
            logger.info("Generating executive summary...")
            executive_summary = await self._generate_executive_summary(
                report=report,
                project_id=request.project_id
            )
            report.ai_generated_summary = executive_summary
            report.executive_summary = executive_summary
            
            # Step 5: Collect real-time metrics if enabled
            if request.enable_real_time_metrics:
                logger.info("Collecting real-time metrics...")
                real_time_metrics = await self._collect_real_time_metrics(
                    project_id=request.project_id
                )
                report.update_real_time_metrics(real_time_metrics)
                report.metrics_refresh_interval_seconds = request.metrics_refresh_interval_seconds
            
            # Step 6: Calculate performance metrics
            generation_time = (datetime.utcnow() - start_time).total_seconds()
            report.generation_time_seconds = Decimal(str(round(generation_time, 2)))
            
            # Step 7: Set report status
            report.status = PMRStatus.draft
            report.last_modified = datetime.utcnow()
            
            # Step 8: Store report in database
            await self._store_report(report)
            
            logger.info(
                f"Enhanced PMR generation completed in {generation_time:.2f}s "
                f"for project {request.project_id}"
            )
            
            return report
            
        except Exception as e:
            logger.error(f"Failed to generate Enhanced PMR: {e}")
            raise
    
    async def _create_base_report(
        self,
        request: EnhancedPMRGenerationRequest,
        user_id: UUID
    ) -> EnhancedPMRReport:
        """Create base PMR report structure"""
        try:
            # Get project details
            project_response = self.supabase.table("projects").select(
                "*"
            ).eq("id", str(request.project_id)).execute()
            
            if not project_response.data:
                raise ValueError(f"Project {request.project_id} not found")
            
            project = project_response.data[0]
            
            # Get template if specified
            template_data = {}
            if request.template_id:
                template_response = self.supabase.table("pmr_templates").select(
                    "*"
                ).eq("id", str(request.template_id)).execute()
                
                if template_response.data:
                    template_data = template_response.data[0]
            
            # Create base report
            report = EnhancedPMRReport(
                id=uuid4(),
                project_id=request.project_id,
                report_month=request.report_month,
                report_year=request.report_year,
                template_id=request.template_id,
                title=request.title,
                executive_summary=None,  # Will be generated
                sections=request.custom_sections or template_data.get("sections", []),
                metrics={},
                visualizations=[],
                status=PMRStatus.draft,
                generated_by=user_id,
                collaboration_enabled=request.enable_collaboration,
                monte_carlo_enabled=request.include_monte_carlo,
                ai_insight_engine=AIInsightEngineModel(
                    insight_categories_enabled=request.ai_insight_categories or [
                        AIInsightCategory.budget,
                        AIInsightCategory.schedule,
                        AIInsightCategory.resource,
                        AIInsightCategory.risk
                    ]
                )
            )
            
            return report
            
        except Exception as e:
            logger.error(f"Failed to create base report: {e}")
            raise
    
    async def _generate_ai_insights(
        self,
        report_id: UUID,
        project_id: UUID,
        categories: Optional[List[AIInsightCategory]] = None
    ) -> List:
        """Generate AI insights using the AI Insights Engine"""
        try:
            # Get project context data
            context_data = await self._get_project_context(project_id)
            
            # Generate insights
            insights = await self.ai_insights_engine.generate_insights(
                report_id=report_id,
                project_id=project_id,
                categories=categories,
                context_data=context_data
            )
            
            return insights
            
        except Exception as e:
            logger.error(f"Failed to generate AI insights: {e}")
            return []
    
    async def _run_monte_carlo_analysis(
        self,
        project_id: UUID,
        iterations: int = 1000,
        confidence_levels: List[Decimal] = None
    ) -> MonteCarloResults:
        """
        Run Monte Carlo analysis for predictive analytics
        Integrates with existing Monte Carlo engine
        """
        try:
            if confidence_levels is None:
                confidence_levels = [Decimal("0.5"), Decimal("0.8"), Decimal("0.95")]
            
            # Get project financial and schedule data
            project_data = await self._get_project_data_for_monte_carlo(project_id)
            
            # Import Monte Carlo engine
            try:
                from monte_carlo.engine import MonteCarloEngine
                from monte_carlo.models import SimulationConfig, RiskDistribution
                
                # Create simulation configuration
                config = SimulationConfig(
                    num_iterations=iterations,
                    confidence_levels=[float(cl) for cl in confidence_levels],
                    random_seed=None  # Use random seed for variability
                )
                
                # Initialize engine
                engine = MonteCarloEngine(config)
                
                # Run budget variance simulation
                budget_results = await self._run_budget_simulation(
                    engine=engine,
                    project_data=project_data,
                    iterations=iterations
                )
                
                # Run schedule variance simulation
                schedule_results = await self._run_schedule_simulation(
                    engine=engine,
                    project_data=project_data,
                    iterations=iterations
                )
                
                # Compile results
                monte_carlo_results = MonteCarloResults(
                    analysis_type="comprehensive",
                    iterations=iterations,
                    budget_completion=budget_results,
                    schedule_completion=schedule_results,
                    confidence_intervals={
                        "budget": {
                            "p50": budget_results.get("p50", Decimal("1.0")),
                            "p80": budget_results.get("p80", Decimal("1.0")),
                            "p95": budget_results.get("p95", Decimal("1.0"))
                        },
                        "schedule": {
                            "p50": Decimal("1.0"),
                            "p80": Decimal("1.05"),
                            "p95": Decimal("1.10")
                        }
                    },
                    parameters_used={
                        "iterations": iterations,
                        "confidence_levels": [float(cl) for cl in confidence_levels],
                        "budget_uncertainty": 0.15,
                        "schedule_uncertainty": 0.20
                    },
                    recommendations=self._generate_monte_carlo_recommendations(
                        budget_results, schedule_results
                    )
                )
                
                return monte_carlo_results
                
            except ImportError:
                # Fallback: Use simplified Monte Carlo simulation
                logger.warning("Monte Carlo engine not available, using simplified simulation")
                return await self._run_simplified_monte_carlo(
                    project_id=project_id,
                    iterations=iterations,
                    confidence_levels=confidence_levels
                )
            
        except Exception as e:
            logger.error(f"Failed to run Monte Carlo analysis: {e}")
            # Return empty results rather than failing
            return MonteCarloResults(
                analysis_type="error",
                iterations=0,
                parameters_used={"error": str(e)},
                recommendations=["Monte Carlo analysis unavailable"]
            )
    
    async def _generate_executive_summary(
        self,
        report: EnhancedPMRReport,
        project_id: UUID
    ) -> str:
        """
        Generate executive summary using RAG agent
        Leverages existing RAG patterns for natural language generation
        """
        try:
            # Build context for executive summary
            context = await self._build_executive_summary_context(report, project_id)
            
            # Create page context for RAG agent
            page_context = PageContext(
                route="/reports/pmr",
                page_title="Project Monthly Report",
                user_role="project_manager",
                current_project=str(project_id),
                relevant_data=context
            )
            
            # Generate summary using RAG agent
            summary_prompt = self._build_executive_summary_prompt(report, context)
            
            # Use RAG agent's OpenAI client directly for summary generation
            # Use the configured model from the RAG agent
            import os
            model = os.getenv("OPENAI_MODEL", "grok-beta")
            response = self.rag_agent.openai_client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": """You are an expert project management analyst creating executive summaries.
                        Generate a concise, professional executive summary that highlights:
                        - Overall project health and status
                        - Key achievements and milestones
                        - Critical issues and risks
                        - Budget and schedule performance
                        - AI-generated insights and predictions
                        - Recommended actions
                        
                        Keep the summary clear, data-driven, and actionable.
                        Use professional business language suitable for executives."""
                    },
                    {
                        "role": "user",
                        "content": summary_prompt
                    }
                ],
                temperature=0.7,
                max_tokens=800
            )
            
            executive_summary = response.choices[0].message.content
            
            logger.info("Executive summary generated successfully")
            return executive_summary
            
        except Exception as e:
            logger.error(f"Failed to generate executive summary: {e}")
            return "Executive summary generation failed. Please review the detailed sections below."
    
    async def _collect_real_time_metrics(
        self,
        project_id: UUID
    ) -> RealTimeMetrics:
        """Collect real-time metrics for the project"""
        try:
            # Get latest project metrics
            metrics_response = self.supabase.table("project_metrics").select(
                "*"
            ).eq("project_id", str(project_id)).order(
                "created_at", desc=True
            ).limit(1).execute()
            
            # Get financial data
            financial_response = self.supabase.table("financial_data").select(
                "*"
            ).eq("project_id", str(project_id)).order(
                "period_start", desc=True
            ).limit(1).execute()
            
            # Get schedule data
            schedule_response = self.supabase.table("schedule_data").select(
                "*"
            ).eq("project_id", str(project_id)).order(
                "created_at", desc=True
            ).limit(1).execute()
            
            # Get risk data
            risk_response = self.supabase.table("risks").select(
                "*"
            ).eq("project_id", str(project_id)).eq(
                "status", "open"
            ).execute()
            
            # Get milestone data
            milestone_response = self.supabase.table("milestones").select(
                "*"
            ).eq("project_id", str(project_id)).execute()
            
            # Calculate metrics
            budget_utilization = None
            schedule_performance_index = None
            cost_performance_index = None
            
            if financial_response.data:
                financial = financial_response.data[0]
                planned_cost = financial.get("planned_cost", 0)
                actual_cost = financial.get("actual_cost", 0)
                if planned_cost > 0:
                    budget_utilization = Decimal(str(actual_cost / planned_cost))
                    cost_performance_index = Decimal(str(planned_cost / actual_cost if actual_cost > 0 else 1.0))
            
            if schedule_response.data:
                schedule = schedule_response.data[0]
                schedule_performance_index = Decimal(str(schedule.get("schedule_performance_index", 1.0)))
            
            # Calculate risk score
            risk_score = None
            if risk_response.data:
                risks = risk_response.data
                high_risks = sum(1 for r in risks if r.get("severity") == "high")
                total_risks = len(risks)
                risk_score = Decimal(str(min(high_risks / max(total_risks, 1), 1.0)))
            
            # Count milestones
            completed_milestones = 0
            upcoming_milestones = 0
            if milestone_response.data:
                milestones = milestone_response.data
                completed_milestones = sum(1 for m in milestones if m.get("status") == "completed")
                upcoming_milestones = sum(1 for m in milestones if m.get("status") in ["planned", "in_progress"])
            
            # Create metrics object
            metrics = RealTimeMetrics(
                last_updated=datetime.utcnow(),
                budget_utilization=budget_utilization,
                schedule_performance_index=schedule_performance_index,
                cost_performance_index=cost_performance_index,
                risk_score=risk_score,
                active_issues_count=len(risk_response.data) if risk_response.data else 0,
                completed_milestones=completed_milestones,
                upcoming_milestones=upcoming_milestones,
                data_freshness_minutes=0  # Just collected
            )
            
            return metrics
            
        except Exception as e:
            logger.error(f"Failed to collect real-time metrics: {e}")
            return RealTimeMetrics(last_updated=datetime.utcnow())
    
    async def _store_report(self, report: EnhancedPMRReport) -> None:
        """Store the generated report in the database"""
        try:
            # Convert report to dict for storage
            report_data = {
                "id": str(report.id),
                "project_id": str(report.project_id),
                "report_month": report.report_month.isoformat(),
                "report_year": report.report_year,
                "template_id": str(report.template_id) if report.template_id else None,
                "title": report.title,
                "executive_summary": report.executive_summary,
                "ai_generated_summary": report.ai_generated_summary,
                "sections": report.sections,
                "metrics": report.metrics,
                "visualizations": report.visualizations,
                "status": report.status.value,
                "version": report.version,
                "generated_by": str(report.generated_by),
                "approved_by": str(report.approved_by) if report.approved_by else None,
                "generated_at": report.generated_at.isoformat(),
                "last_modified": report.last_modified.isoformat(),
                "is_active": report.is_active,
                "collaboration_enabled": report.collaboration_enabled,
                "monte_carlo_enabled": report.monte_carlo_enabled,
                "generation_time_seconds": float(report.generation_time_seconds) if report.generation_time_seconds else None,
                "total_edits": report.total_edits,
                "total_collaborators": report.total_collaborators,
                "created_at": report.created_at.isoformat(),
                "updated_at": report.updated_at.isoformat()
            }
            
            # Store in database
            self.supabase.table("enhanced_pmr_reports").insert(report_data).execute()
            
            # Store AI insights separately
            if report.ai_insights:
                for insight in report.ai_insights:
                    insight_data = {
                        "id": str(insight.id),
                        "report_id": str(report.id),
                        "insight_type": insight.insight_type.value,
                        "category": insight.category.value,
                        "title": insight.title,
                        "content": insight.content,
                        "confidence_score": float(insight.confidence_score),
                        "supporting_data": insight.supporting_data,
                        "predicted_impact": insight.predicted_impact,
                        "recommended_actions": insight.recommended_actions,
                        "priority": insight.priority.value,
                        "validated": insight.validated,
                        "validation_status": insight.validation_status.value,
                        "generated_at": insight.generated_at.isoformat(),
                        "created_at": insight.created_at.isoformat(),
                        "updated_at": insight.updated_at.isoformat()
                    }
                    self.supabase.table("ai_insights").insert(insight_data).execute()
            
            # Store Monte Carlo results if present
            if report.monte_carlo_analysis:
                mc_data = {
                    "report_id": str(report.id),
                    "analysis_type": report.monte_carlo_analysis.analysis_type,
                    "iterations": report.monte_carlo_analysis.iterations,
                    "budget_completion": report.monte_carlo_analysis.budget_completion,
                    "schedule_completion": report.monte_carlo_analysis.schedule_completion,
                    "confidence_intervals": report.monte_carlo_analysis.confidence_intervals,
                    "parameters_used": report.monte_carlo_analysis.parameters_used,
                    "recommendations": report.monte_carlo_analysis.recommendations,
                    "generated_at": report.monte_carlo_analysis.generated_at.isoformat()
                }
                self.supabase.table("monte_carlo_results").insert(mc_data).execute()
            
            # Store real-time metrics if present
            if report.real_time_metrics:
                metrics_data = {
                    "report_id": str(report.id),
                    "last_updated": report.real_time_metrics.last_updated.isoformat(),
                    "budget_utilization": float(report.real_time_metrics.budget_utilization) if report.real_time_metrics.budget_utilization else None,
                    "schedule_performance_index": float(report.real_time_metrics.schedule_performance_index) if report.real_time_metrics.schedule_performance_index else None,
                    "cost_performance_index": float(report.real_time_metrics.cost_performance_index) if report.real_time_metrics.cost_performance_index else None,
                    "risk_score": float(report.real_time_metrics.risk_score) if report.real_time_metrics.risk_score else None,
                    "active_issues_count": report.real_time_metrics.active_issues_count,
                    "completed_milestones": report.real_time_metrics.completed_milestones,
                    "upcoming_milestones": report.real_time_metrics.upcoming_milestones
                }
                self.supabase.table("pmr_real_time_metrics").insert(metrics_data).execute()
            
            logger.info(f"Report {report.id} stored successfully")
            
        except Exception as e:
            logger.error(f"Failed to store report: {e}")
            raise
    
    # Helper methods
    
    async def _get_project_context(self, project_id: UUID) -> Dict[str, Any]:
        """Get comprehensive project context for AI insight generation"""
        try:
            context = {}
            
            # Get project details
            project_response = self.supabase.table("projects").select("*").eq(
                "id", str(project_id)
            ).execute()
            if project_response.data:
                context["project"] = project_response.data[0]
            
            # Get recent metrics
            metrics_response = self.supabase.table("project_metrics").select("*").eq(
                "project_id", str(project_id)
            ).order("created_at", desc=True).limit(10).execute()
            context["recent_metrics"] = metrics_response.data or []
            
            # Get financial data
            financial_response = self.supabase.table("financial_data").select("*").eq(
                "project_id", str(project_id)
            ).order("period_start", desc=True).limit(6).execute()
            context["financial_data"] = financial_response.data or []
            
            # Get schedule data
            schedule_response = self.supabase.table("schedule_data").select("*").eq(
                "project_id", str(project_id)
            ).order("created_at", desc=True).limit(6).execute()
            context["schedule_data"] = schedule_response.data or []
            
            # Get risks
            risk_response = self.supabase.table("risks").select("*").eq(
                "project_id", str(project_id)
            ).execute()
            context["risks"] = risk_response.data or []
            
            return context
            
        except Exception as e:
            logger.error(f"Failed to get project context: {e}")
            return {}
    
    async def _get_project_data_for_monte_carlo(self, project_id: UUID) -> Dict[str, Any]:
        """Get project data needed for Monte Carlo simulation"""
        try:
            data = {}
            
            # Get budget data
            financial_response = self.supabase.table("financial_data").select("*").eq(
                "project_id", str(project_id)
            ).order("period_start", desc=True).limit(12).execute()
            
            if financial_response.data:
                data["financial_history"] = financial_response.data
                latest = financial_response.data[0]
                data["current_budget"] = latest.get("planned_cost", 0)
                data["actual_cost"] = latest.get("actual_cost", 0)
                data["budget_variance"] = latest.get("actual_cost", 0) - latest.get("planned_cost", 0)
            
            # Get schedule data
            schedule_response = self.supabase.table("schedule_data").select("*").eq(
                "project_id", str(project_id)
            ).order("created_at", desc=True).limit(12).execute()
            
            if schedule_response.data:
                data["schedule_history"] = schedule_response.data
                latest = schedule_response.data[0]
                data["schedule_variance"] = latest.get("schedule_variance", 0)
            
            return data
            
        except Exception as e:
            logger.error(f"Failed to get Monte Carlo data: {e}")
            return {}
    
    async def _run_budget_simulation(
        self,
        engine: Any,
        project_data: Dict[str, Any],
        iterations: int
    ) -> Dict[str, Decimal]:
        """Run budget variance simulation"""
        try:
            # Extract budget parameters
            current_budget = project_data.get("current_budget", 1000000)
            actual_cost = project_data.get("actual_cost", 800000)
            budget_variance = project_data.get("budget_variance", 0)
            
            # Calculate budget completion percentiles
            # Simplified simulation - in production, use full Monte Carlo engine
            import random
            random.seed()
            
            results = []
            for _ in range(iterations):
                # Simulate budget completion with normal distribution
                variance_factor = random.gauss(0, 0.15)  # 15% standard deviation
                completion_ratio = (actual_cost / current_budget) * (1 + variance_factor) if current_budget > 0 else 1.0
                results.append(completion_ratio)
            
            # Calculate percentiles
            results.sort()
            p50_idx = int(iterations * 0.50)
            p80_idx = int(iterations * 0.80)
            p95_idx = int(iterations * 0.95)
            
            return {
                "p50": Decimal(str(round(results[p50_idx], 2))),
                "p80": Decimal(str(round(results[p80_idx], 2))),
                "p95": Decimal(str(round(results[p95_idx], 2)))
            }
            
        except Exception as e:
            logger.error(f"Failed to run budget simulation: {e}")
            return {
                "p50": Decimal("1.0"),
                "p80": Decimal("1.05"),
                "p95": Decimal("1.10")
            }
    
    async def _run_schedule_simulation(
        self,
        engine: Any,
        project_data: Dict[str, Any],
        iterations: int
    ) -> Dict[str, Any]:
        """Run schedule variance simulation"""
        try:
            # Simplified schedule simulation
            import random
            from datetime import timedelta
            
            random.seed()
            base_date = datetime.utcnow()
            
            results = []
            for _ in range(iterations):
                # Simulate schedule completion with normal distribution
                days_variance = random.gauss(0, 15)  # 15 days standard deviation
                completion_date = base_date + timedelta(days=days_variance)
                results.append(completion_date)
            
            # Calculate percentiles
            results.sort()
            p50_idx = int(iterations * 0.50)
            p80_idx = int(iterations * 0.80)
            p95_idx = int(iterations * 0.95)
            
            return {
                "p50": results[p50_idx].isoformat(),
                "p80": results[p80_idx].isoformat(),
                "p95": results[p95_idx].isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to run schedule simulation: {e}")
            base_date = datetime.utcnow()
            return {
                "p50": base_date.isoformat(),
                "p80": (base_date + timedelta(days=7)).isoformat(),
                "p95": (base_date + timedelta(days=14)).isoformat()
            }
    
    async def _run_simplified_monte_carlo(
        self,
        project_id: UUID,
        iterations: int,
        confidence_levels: List[Decimal]
    ) -> MonteCarloResults:
        """Simplified Monte Carlo simulation fallback"""
        try:
            project_data = await self._get_project_data_for_monte_carlo(project_id)
            
            budget_results = await self._run_budget_simulation(None, project_data, iterations)
            schedule_results = await self._run_schedule_simulation(None, project_data, iterations)
            
            return MonteCarloResults(
                analysis_type="simplified",
                iterations=iterations,
                budget_completion=budget_results,
                schedule_completion=schedule_results,
                confidence_intervals={
                    "budget": budget_results,
                    "schedule": {"p50": Decimal("1.0"), "p80": Decimal("1.05"), "p95": Decimal("1.10")}
                },
                parameters_used={
                    "iterations": iterations,
                    "method": "simplified_simulation"
                },
                recommendations=[
                    "Review budget variance trends",
                    "Monitor schedule performance closely",
                    "Consider risk mitigation strategies"
                ]
            )
            
        except Exception as e:
            logger.error(f"Failed to run simplified Monte Carlo: {e}")
            raise
    
    def _generate_monte_carlo_recommendations(
        self,
        budget_results: Dict[str, Decimal],
        schedule_results: Dict[str, Any]
    ) -> List[str]:
        """Generate recommendations based on Monte Carlo results"""
        recommendations = []
        
        # Budget recommendations
        p95_budget = budget_results.get("p95", Decimal("1.0"))
        if p95_budget > Decimal("1.1"):
            recommendations.append(
                "High budget risk detected (95th percentile > 110%). "
                "Consider implementing cost control measures."
            )
        elif p95_budget < Decimal("0.9"):
            recommendations.append(
                "Project trending under budget. "
                "Consider reallocating surplus to quality improvements or scope expansion."
            )
        
        # Schedule recommendations
        # Add schedule-based recommendations here
        recommendations.append(
            "Monitor schedule performance closely and update forecasts regularly."
        )
        
        return recommendations
    
    async def _build_executive_summary_context(
        self,
        report: EnhancedPMRReport,
        project_id: UUID
    ) -> Dict[str, Any]:
        """Build context for executive summary generation"""
        try:
            context = {}
            
            # Add project details
            project_response = self.supabase.table("projects").select("*").eq(
                "id", str(project_id)
            ).execute()
            if project_response.data:
                context["project"] = project_response.data[0]
            
            # Add AI insights summary
            if report.ai_insights:
                context["ai_insights_count"] = len(report.ai_insights)
                context["high_priority_insights"] = [
                    insight for insight in report.ai_insights
                    if insight.priority.value in ["high", "critical"]
                ]
            
            # Add Monte Carlo summary
            if report.monte_carlo_analysis:
                context["monte_carlo_summary"] = {
                    "budget_p50": report.monte_carlo_analysis.budget_completion.get("p50") if report.monte_carlo_analysis.budget_completion else None,
                    "budget_p95": report.monte_carlo_analysis.budget_completion.get("p95") if report.monte_carlo_analysis.budget_completion else None,
                    "recommendations": report.monte_carlo_analysis.recommendations
                }
            
            # Add real-time metrics
            if report.real_time_metrics:
                context["current_metrics"] = {
                    "budget_utilization": report.real_time_metrics.budget_utilization,
                    "schedule_performance": report.real_time_metrics.schedule_performance_index,
                    "risk_score": report.real_time_metrics.risk_score,
                    "active_issues": report.real_time_metrics.active_issues_count
                }
            
            return context
            
        except Exception as e:
            logger.error(f"Failed to build executive summary context: {e}")
            return {}
    
    def _build_executive_summary_prompt(
        self,
        report: EnhancedPMRReport,
        context: Dict[str, Any]
    ) -> str:
        """Build prompt for executive summary generation"""
        prompt = f"Generate an executive summary for the following project monthly report:\n\n"
        
        # Add project info
        if "project" in context:
            project = context["project"]
            prompt += f"Project: {project.get('name')}\n"
            prompt += f"Status: {project.get('status')}\n"
            prompt += f"Priority: {project.get('priority')}\n\n"
        
        # Add current metrics
        if "current_metrics" in context:
            metrics = context["current_metrics"]
            prompt += "Current Performance:\n"
            if metrics.get("budget_utilization"):
                prompt += f"- Budget Utilization: {float(metrics['budget_utilization']):.1%}\n"
            if metrics.get("schedule_performance"):
                prompt += f"- Schedule Performance Index: {float(metrics['schedule_performance']):.2f}\n"
            if metrics.get("risk_score"):
                prompt += f"- Risk Score: {float(metrics['risk_score']):.2f}\n"
            if metrics.get("active_issues"):
                prompt += f"- Active Issues: {metrics['active_issues']}\n"
            prompt += "\n"
        
        # Add AI insights
        if "high_priority_insights" in context and context["high_priority_insights"]:
            prompt += "Key AI Insights:\n"
            for insight in context["high_priority_insights"][:3]:  # Top 3
                prompt += f"- {insight.title}: {insight.content[:100]}...\n"
            prompt += "\n"
        
        # Add Monte Carlo predictions
        if "monte_carlo_summary" in context:
            mc = context["monte_carlo_summary"]
            prompt += "Predictive Analytics:\n"
            if mc.get("budget_p50"):
                prompt += f"- Budget Completion (50% confidence): {float(mc['budget_p50']):.1%}\n"
            if mc.get("budget_p95"):
                prompt += f"- Budget Completion (95% confidence): {float(mc['budget_p95']):.1%}\n"
            if mc.get("recommendations"):
                prompt += f"- Key Recommendations: {', '.join(mc['recommendations'][:2])}\n"
            prompt += "\n"
        
        prompt += """
        Please generate a concise executive summary (3-4 paragraphs) that:
        1. Summarizes overall project health and status
        2. Highlights key achievements and concerns
        3. Presents AI-driven insights and predictions
        4. Provides clear recommendations for stakeholders
        
        Use professional business language suitable for executive leadership.
        """
        
        return prompt
    
    async def get_report(self, report_id: UUID) -> Optional[EnhancedPMRReport]:
        """Retrieve an Enhanced PMR report by ID"""
        try:
            # Get report data
            report_response = self.supabase.table("enhanced_pmr_reports").select(
                "*"
            ).eq("id", str(report_id)).execute()
            
            if not report_response.data:
                return None
            
            report_data = report_response.data[0]
            
            # Get AI insights
            insights_response = self.supabase.table("ai_insights").select(
                "*"
            ).eq("report_id", str(report_id)).execute()
            
            # Get Monte Carlo results
            mc_response = self.supabase.table("monte_carlo_results").select(
                "*"
            ).eq("report_id", str(report_id)).execute()
            
            # Get real-time metrics
            metrics_response = self.supabase.table("pmr_real_time_metrics").select(
                "*"
            ).eq("report_id", str(report_id)).execute()
            
            # Reconstruct report object
            # This would need proper deserialization logic
            # For now, return basic structure
            
            logger.info(f"Retrieved report {report_id}")
            return None  # Placeholder - implement full deserialization
            
        except Exception as e:
            logger.error(f"Failed to get report: {e}")
            return None
