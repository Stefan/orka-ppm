"""
Proactive Tips Engine
Generates contextual tips based on user behavior and context patterns
"""

import os
import json
import asyncio
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import logging
from dataclasses import dataclass, asdict
from enum import Enum
from supabase import Client

logger = logging.getLogger(__name__)

class TipType(Enum):
    WELCOME = "welcome"
    FEATURE_DISCOVERY = "feature_discovery"
    OPTIMIZATION = "optimization"
    BEST_PRACTICE = "best_practice"
    WORKFLOW_EFFICIENCY = "workflow_efficiency"

class TipPriority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class TriggerCondition(Enum):
    NEW_USER = "new_user"
    FIRST_PAGE_VISIT = "first_page_visit"
    TIME_ON_PAGE = "time_on_page"
    BUDGET_THRESHOLD = "budget_threshold"
    RESOURCE_UTILIZATION = "resource_utilization"
    REPEATED_ACTION = "repeated_action"
    FEATURE_UNUSED = "feature_unused"
    ERROR_PATTERN = "error_pattern"

@dataclass
class UserBehaviorPattern:
    """Represents user behavior patterns for tip generation"""
    user_id: str
    recent_pages: List[str]
    time_on_page: int
    frequent_queries: List[str]
    user_level: str
    session_count: int
    last_login: datetime
    feature_usage: Dict[str, int]
    error_patterns: List[str]
    dismissed_tips: List[str]

@dataclass
class PageContext:
    """Current page context for tip generation"""
    route: str
    page_title: str
    user_role: str
    current_project: Optional[str] = None
    current_portfolio: Optional[str] = None
    relevant_data: Optional[Dict[str, Any]] = None

@dataclass
class TipAction:
    """Action that can be taken from a tip"""
    id: str
    label: str
    action: str
    target: Optional[str] = None
    icon: Optional[str] = None
    variant: str = "secondary"

@dataclass
class ProactiveTip:
    """Represents a proactive tip for users"""
    tip_id: str
    tip_type: TipType
    title: str
    content: str
    priority: TipPriority
    trigger_context: List[str]
    actions: List[TipAction]
    dismissible: bool = True
    show_once: bool = False
    expires_at: Optional[datetime] = None
    created_at: datetime = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()

@dataclass
class TipSchedule:
    """Scheduling information for tips"""
    tip_id: str
    user_id: str
    scheduled_for: datetime
    context_conditions: Dict[str, Any]
    max_frequency: timedelta
    last_shown: Optional[datetime] = None
    show_count: int = 0

class ProactiveTipsEngine:
    """Main engine for generating and managing proactive tips"""

    # Cooldown per (rule_key, user_id) to avoid spamming; key -> last_trigger datetime
    _cooldown: Dict[str, datetime]
    _cooldown_minutes: int = 30

    def __init__(self, supabase_client: Client):
        self.supabase = supabase_client
        self._cooldown = {}
        self.tip_templates = self._load_tip_templates()
        self.tip_rules = self._load_tip_rules()
        self.max_tips_per_session = 3
        self.tip_cooldown_minutes = 30

    def _load_tip_rules(self) -> Dict[str, Dict[str, Any]]:
        """Load rules for data-change triggered tips (variance, overdue, budget). Filter by organization_id in use."""
        return {
            "variance_threshold": {
                "table": "variance_alerts",
                "condition": "new",
                "title": "New variance alert",
                "content": "A variance alert was created. Check your dashboard for details.",
                "priority": TipPriority.HIGH,
                "learn_more_query": "What causes variance alerts and how can I fix them?",
            },
            "overdue": {
                "table": "projects",
                "condition": "end_date_passed",
                "title": "Overdue project",
                "content": "A project is past its end date. Consider updating the timeline or closing it.",
                "priority": TipPriority.MEDIUM,
                "learn_more_query": "How do I update project end dates?",
            },
            "budget_threshold": {
                "table": "projects",
                "condition": "budget_utilization_high",
                "title": "Budget utilization high",
                "content": "A project has high budget utilization. Review spend and forecasts.",
                "priority": TipPriority.MEDIUM,
                "learn_more_query": "How do I reduce budget variance?",
            },
        }

    def _is_in_cooldown(self, rule_key: str, user_id: str) -> bool:
        """Return True if this (rule, user) was triggered recently."""
        key = f"{rule_key}:{user_id}"
        last = self._cooldown.get(key)
        if last is None:
            return False
        return datetime.now() - last < timedelta(minutes=self._cooldown_minutes)

    def _set_cooldown(self, rule_key: str, user_id: str) -> None:
        """Record that this (rule, user) was just triggered."""
        self._cooldown[f"{rule_key}:{user_id}"] = datetime.now()

    def _trigger_tip(
        self,
        rule_key: str,
        organization_id: str,
        user_ids: List[str],
        message: Dict[str, Any],
    ) -> None:
        """Send tip notification to users (broadcast to Realtime channel) and log to help_logs. Sync for use from Realtime callback."""
        for user_id in user_ids:
            if self._is_in_cooldown(rule_key, user_id):
                continue
            self._set_cooldown(rule_key, user_id)
        try:
            channel_name = f"proactive_tips_{organization_id}"
            payload = {
                "event": "proactive_tip",
                "rule_key": rule_key,
                "message": message,
                "user_ids": user_ids,
            }
            if hasattr(self.supabase, "realtime") and self.supabase.realtime:
                channel = self.supabase.realtime.channel(channel_name)
                channel.send_broadcast(payload)
            self._log_tip_event_sync(
                user_ids[0] if user_ids else "",
                "proactive_tip_triggered",
                {"rule_key": rule_key, "organization_id": organization_id, "message": message},
            )
        except Exception as e:
            logger.warning("Proactive tip trigger failed (realtime/log): %s", e)

    def _handle_change(self, organization_id: str, payload: Dict[str, Any]) -> None:
        """Evaluate tip rules on data change (e.g. new variance alert, project update). Sync for Realtime callback."""
        table = payload.get("table") or payload.get("table_name")
        if not table:
            return
        for rule_key, rule in self.tip_rules.items():
            if rule.get("table") != table:
                continue
            condition = rule.get("condition")
            if condition == "new" and payload.get("event_type") in ("INSERT", "insert"):
                pass
            elif condition in ("end_date_passed", "budget_utilization_high"):
                record = payload.get("record") or payload.get("new_record") or {}
                if condition == "end_date_passed" and record.get("end_date"):
                    try:
                        from datetime import datetime as dt
                        end = dt.fromisoformat(str(record["end_date"]).replace("Z", "+00:00"))
                        if end.date() < datetime.now().date():
                            pass
                    except Exception:
                        continue
                elif condition == "budget_utilization_high":
                    b = record.get("budget") or 0
                    s = record.get("spent") or record.get("actual_cost") or 0
                    if b and (s / float(b)) >= 0.8:
                        pass
                    else:
                        continue
            else:
                continue
            try:
                user_ids = self._get_org_user_ids_sync(organization_id)
            except Exception:
                user_ids = []
            if user_ids:
                self._trigger_tip(
                    rule_key,
                    organization_id,
                    user_ids,
                    {"title": rule["title"], "content": rule["content"], "learn_more_query": rule.get("learn_more_query")},
                )

    def _get_org_user_ids_sync(self, organization_id: str) -> List[str]:
        """Return user IDs for organization (for proactive tip delivery). Sync."""
        try:
            r = self.supabase.table("organization_members").select("user_id").eq("organization_id", organization_id).limit(100).execute()
            return [row["user_id"] for row in (r.data or []) if row.get("user_id")]
        except Exception:
            try:
                r = self.supabase.table("user_profiles").select("user_id").eq("organization_id", organization_id).limit(100).execute()
                return [row["user_id"] for row in (r.data or []) if row.get("user_id")]
            except Exception:
                return []

    def _log_tip_event_sync(self, user_id: str, event_type: str, event_data: Dict[str, Any]) -> None:
        """Log tip event (sync). Used by _trigger_tip from Realtime callback."""
        try:
            self.supabase.table("help_analytics").insert({
                "user_id": user_id,
                "event_type": event_type,
                "event_data": event_data,
                "timestamp": datetime.now().isoformat(),
            }).execute()
        except Exception as e:
            logger.debug("Tip event log failed: %s", e)

    def start_monitoring(self, organization_id: str, on_change_callback: Optional[Any] = None) -> None:
        """Start Realtime monitoring for data changes that may trigger tips. Filter by organization_id.
        When a relevant change is received, _handle_change is invoked. Requires Supabase Realtime enabled."""
        try:
            if on_change_callback:
                self._realtime_callback = on_change_callback
            channel = self.supabase.realtime.channel(f"proactive_tips_db_{organization_id}")
            channel.on_postgres_changes(
                event="INSERT",
                schema="public",
                table="variance_alerts",
                callback=lambda p: self._handle_change(organization_id, {"table": "variance_alerts", "event_type": "INSERT", "record": (p or {}).get("new", (p or {}).get("record", {}))}),
            )
            channel.subscribe()
        except Exception as e:
            logger.info("Realtime monitoring not started (optional): %s", e)

    def _load_tip_templates(self) -> Dict[str, Dict]:
        """Load tip templates from configuration"""
        return {
            # Welcome Tips
            "welcome_dashboard": {
                "type": TipType.WELCOME,
                "title": "Welcome to Your PPM Dashboard",
                "content": "Your dashboard provides an overview of all your projects, portfolios, and key metrics. Use the navigation menu to explore different sections.",
                "priority": TipPriority.HIGH,
                "trigger_conditions": [TriggerCondition.NEW_USER, TriggerCondition.FIRST_PAGE_VISIT],
                "context_routes": ["dashboard", "/"],
                "actions": [
                    TipAction("take_tour", "Take a Quick Tour", "start_tour", icon="play-circle"),
                    TipAction("explore_projects", "View Projects", "navigate", "/projects", "folder")
                ],
                "show_once": True
            },
            
            "welcome_projects": {
                "type": TipType.WELCOME,
                "title": "Project Management Made Easy",
                "content": "Create and manage your projects here. Track progress, allocate resources, and monitor budgets all in one place.",
                "priority": TipPriority.HIGH,
                "trigger_conditions": [TriggerCondition.NEW_USER, TriggerCondition.FIRST_PAGE_VISIT],
                "context_routes": ["projects"],
                "actions": [
                    TipAction("create_project", "Create Your First Project", "navigate", "/projects/new", "plus"),
                    TipAction("learn_more", "Learn More", "open_guide", "/help/projects")
                ],
                "show_once": True
            },
            
            # Feature Discovery Tips
            "discover_monte_carlo": {
                "type": TipType.FEATURE_DISCOVERY,
                "title": "Advanced Risk Analysis Available",
                "content": "Did you know you can run Monte Carlo simulations to get probabilistic risk assessments? This provides more accurate project outcome predictions.",
                "priority": TipPriority.MEDIUM,
                "trigger_conditions": [TriggerCondition.FEATURE_UNUSED],
                "context_routes": ["risks", "projects"],
                "actions": [
                    TipAction("try_monte_carlo", "Try Monte Carlo", "navigate", "/monte-carlo", "trending-up"),
                    TipAction("learn_more", "Learn More", "open_guide", "/help/monte-carlo")
                ],
                "feature_requirements": ["risk_management"]
            },
            
            "discover_what_if": {
                "type": TipType.FEATURE_DISCOVERY,
                "title": "Explore What-If Scenarios",
                "content": "Test different project scenarios to see how changes in budget, timeline, or resources affect your outcomes.",
                "priority": TipPriority.MEDIUM,
                "trigger_conditions": [TriggerCondition.BUDGET_THRESHOLD],
                "context_routes": ["financials", "projects"],
                "actions": [
                    TipAction("run_scenario", "Run What-If Scenario", "navigate", "/scenarios", "git-branch"),
                    TipAction("dismiss", "Not Now", "dismiss")
                ]
            },
            
            # Optimization Tips
            "budget_optimization": {
                "type": TipType.OPTIMIZATION,
                "title": "Budget Optimization Opportunity",
                "content": "Your budget utilization is above 80%. Consider reviewing resource allocation or running optimization scenarios.",
                "priority": TipPriority.HIGH,
                "trigger_conditions": [TriggerCondition.BUDGET_THRESHOLD],
                "context_routes": ["financials", "dashboard"],
                "actions": [
                    TipAction("optimize_budget", "Optimize Budget", "navigate", "/scenarios", "dollar-sign"),
                    TipAction("view_details", "View Details", "navigate", "/financials", "bar-chart")
                ],
                "threshold_conditions": {"budget_utilization": 80}
            },
            
            "resource_optimization": {
                "type": TipType.OPTIMIZATION,
                "title": "Resource Utilization Alert",
                "content": "Some resources are over-allocated while others are underutilized. Consider rebalancing for better efficiency.",
                "priority": TipPriority.MEDIUM,
                "trigger_conditions": [TriggerCondition.RESOURCE_UTILIZATION],
                "context_routes": ["resources", "dashboard"],
                "actions": [
                    TipAction("rebalance", "Rebalance Resources", "navigate", "/resources/optimize", "users"),
                    TipAction("view_utilization", "View Utilization", "navigate", "/resources", "activity")
                ]
            },
            
            # Best Practice Tips
            "regular_updates": {
                "type": TipType.BEST_PRACTICE,
                "title": "Keep Your Projects Updated",
                "content": "Regular project updates help maintain accuracy in forecasting and reporting. Consider updating project status weekly.",
                "priority": TipPriority.LOW,
                "trigger_conditions": [TriggerCondition.TIME_ON_PAGE],
                "context_routes": ["projects"],
                "actions": [
                    TipAction("update_project", "Update Project", "action", "update_current_project", "edit"),
                    TipAction("set_reminder", "Set Reminder", "action", "set_update_reminder", "bell")
                ]
            },
            
            "risk_review": {
                "type": TipType.BEST_PRACTICE,
                "title": "Regular Risk Reviews",
                "content": "It's been a while since your last risk assessment. Regular reviews help identify new risks early.",
                "priority": TipPriority.MEDIUM,
                "trigger_conditions": [TriggerCondition.TIME_ON_PAGE],
                "context_routes": ["risks", "projects"],
                "actions": [
                    TipAction("review_risks", "Review Risks", "navigate", "/risks", "alert-triangle"),
                    TipAction("schedule_review", "Schedule Review", "action", "schedule_risk_review", "calendar")
                ]
            },
            
            # Workflow Efficiency Tips
            "keyboard_shortcuts": {
                "type": TipType.WORKFLOW_EFFICIENCY,
                "title": "Speed Up Your Workflow",
                "content": "Use keyboard shortcuts to navigate faster: Ctrl+K for quick search, Ctrl+N for new project, Ctrl+D for dashboard.",
                "priority": TipPriority.LOW,
                "trigger_conditions": [TriggerCondition.REPEATED_ACTION],
                "context_routes": ["*"],
                "actions": [
                    TipAction("show_shortcuts", "Show All Shortcuts", "action", "show_keyboard_shortcuts", "keyboard"),
                    TipAction("dismiss", "Got It", "dismiss")
                ]
            },
            
            "bulk_operations": {
                "type": TipType.WORKFLOW_EFFICIENCY,
                "title": "Bulk Operations Available",
                "content": "You can select multiple items and perform bulk operations like status updates, assignments, or exports.",
                "priority": TipPriority.MEDIUM,
                "trigger_conditions": [TriggerCondition.REPEATED_ACTION],
                "context_routes": ["projects", "resources", "risks"],
                "actions": [
                    TipAction("try_bulk", "Try Bulk Operations", "action", "enable_bulk_mode", "check-square"),
                    TipAction("learn_more", "Learn More", "open_guide", "/help/bulk-operations")
                ]
            }
        }
    
    async def generate_proactive_tips(self, context: PageContext, 
                                    user_behavior: UserBehaviorPattern) -> List[ProactiveTip]:
        """Generate contextual proactive tips based on user behavior and current context"""
        try:
            tips = []
            
            # Get user's tip history and preferences
            tip_history = await self._get_user_tip_history(user_behavior.user_id)
            user_preferences = await self._get_user_preferences(user_behavior.user_id)
            
            # Skip if user has disabled proactive tips
            if not user_preferences.get("proactive_tips", True):
                return []
            
            # Check tip frequency limits
            if not self._should_show_tips(tip_history, user_preferences):
                return []
            
            # Generate tips based on different criteria
            welcome_tips = await self._generate_welcome_tips(context, user_behavior, tip_history)
            feature_tips = await self._generate_feature_discovery_tips(context, user_behavior, tip_history)
            optimization_tips = await self._generate_optimization_tips(context, user_behavior, tip_history)
            best_practice_tips = await self._generate_best_practice_tips(context, user_behavior, tip_history)
            efficiency_tips = await self._generate_efficiency_tips(context, user_behavior, tip_history)
            
            # Combine all tips
            all_tips = welcome_tips + feature_tips + optimization_tips + best_practice_tips + efficiency_tips
            
            # Filter out dismissed tips
            filtered_tips = [tip for tip in all_tips if tip.tip_id not in user_behavior.dismissed_tips]
            
            # Prioritize and limit tips
            prioritized_tips = self._prioritize_tips(filtered_tips, context, user_behavior)
            
            # Limit to max tips per session
            final_tips = prioritized_tips[:self.max_tips_per_session]
            
            # Schedule tips for future display if needed
            await self._schedule_tips(final_tips, user_behavior.user_id)
            
            return final_tips
            
        except Exception as e:
            logger.error(f"Proactive tip generation failed: {e}")
            return []
    
    async def _generate_welcome_tips(self, context: PageContext, 
                                   user_behavior: UserBehaviorPattern,
                                   tip_history: List[Dict]) -> List[ProactiveTip]:
        """Generate welcome tips for new users"""
        tips = []
        
        # Only show welcome tips for new users (less than 5 sessions)
        if user_behavior.session_count > 5:
            return tips
        
        # Check if user is on dashboard for the first time
        if ("dashboard" in context.route or context.route == "/") and user_behavior.session_count <= 2:
            if not self._tip_already_shown("welcome_dashboard", tip_history):
                template = self.tip_templates["welcome_dashboard"]
                tips.append(self._create_tip_from_template("welcome_dashboard", template, context))
        
        # Check if user is on projects page for the first time
        if "projects" in context.route and user_behavior.session_count <= 3:
            if not self._tip_already_shown("welcome_projects", tip_history):
                template = self.tip_templates["welcome_projects"]
                tips.append(self._create_tip_from_template("welcome_projects", template, context))
        
        return tips
    
    async def _generate_feature_discovery_tips(self, context: PageContext,
                                             user_behavior: UserBehaviorPattern,
                                             tip_history: List[Dict]) -> List[ProactiveTip]:
        """Generate feature discovery tips"""
        tips = []
        
        # Monte Carlo discovery for risk management users
        if ("risk" in context.route or "project" in context.route):
            if not self._feature_used("monte_carlo", user_behavior.feature_usage):
                if not self._tip_already_shown("discover_monte_carlo", tip_history):
                    template = self.tip_templates["discover_monte_carlo"]
                    tips.append(self._create_tip_from_template("discover_monte_carlo", template, context))
        
        # What-If scenarios for financial management
        if ("financial" in context.route or "project" in context.route):
            if not self._feature_used("scenarios", user_behavior.feature_usage):
                if not self._tip_already_shown("discover_what_if", tip_history):
                    template = self.tip_templates["discover_what_if"]
                    tips.append(self._create_tip_from_template("discover_what_if", template, context))
        
        return tips
    
    async def _generate_optimization_tips(self, context: PageContext,
                                        user_behavior: UserBehaviorPattern,
                                        tip_history: List[Dict]) -> List[ProactiveTip]:
        """Generate optimization tips based on current data"""
        tips = []
        
        # Get current project/portfolio data for optimization analysis
        optimization_data = await self._get_optimization_data(context, user_behavior.user_id)
        
        # Budget optimization tip
        if optimization_data.get("budget_utilization", 0) > 80:
            if not self._tip_recently_shown("budget_optimization", tip_history, hours=24):
                template = self.tip_templates["budget_optimization"]
                tips.append(self._create_tip_from_template("budget_optimization", template, context))
        
        # Resource optimization tip
        if optimization_data.get("resource_imbalance", False):
            if not self._tip_recently_shown("resource_optimization", tip_history, hours=48):
                template = self.tip_templates["resource_optimization"]
                tips.append(self._create_tip_from_template("resource_optimization", template, context))
        
        return tips
    
    async def _generate_best_practice_tips(self, context: PageContext,
                                         user_behavior: UserBehaviorPattern,
                                         tip_history: List[Dict]) -> List[ProactiveTip]:
        """Generate best practice tips"""
        tips = []
        
        # Regular updates tip for project managers
        if "project" in context.route and user_behavior.user_level in ["intermediate", "advanced"]:
            if user_behavior.time_on_page > 300:  # 5 minutes
                if not self._tip_recently_shown("regular_updates", tip_history, hours=72):
                    template = self.tip_templates["regular_updates"]
                    tips.append(self._create_tip_from_template("regular_updates", template, context))
        
        # Risk review tip
        if "risk" in context.route or "project" in context.route:
            if not self._tip_recently_shown("risk_review", tip_history, hours=168):  # 1 week
                template = self.tip_templates["risk_review"]
                tips.append(self._create_tip_from_template("risk_review", template, context))
        
        return tips
    
    async def _generate_efficiency_tips(self, context: PageContext,
                                      user_behavior: UserBehaviorPattern,
                                      tip_history: List[Dict]) -> List[ProactiveTip]:
        """Generate workflow efficiency tips"""
        tips = []
        
        # Keyboard shortcuts for power users
        if user_behavior.session_count > 10 and user_behavior.user_level == "advanced":
            if not self._tip_already_shown("keyboard_shortcuts", tip_history):
                template = self.tip_templates["keyboard_shortcuts"]
                tips.append(self._create_tip_from_template("keyboard_shortcuts", template, context))
        
        # Bulk operations for users with repetitive actions
        if self._detect_repetitive_actions(user_behavior):
            if not self._tip_recently_shown("bulk_operations", tip_history, hours=168):
                template = self.tip_templates["bulk_operations"]
                tips.append(self._create_tip_from_template("bulk_operations", template, context))
        
        return tips
    
    def _create_tip_from_template(self, tip_id: str, template: Dict, context: PageContext) -> ProactiveTip:
        """Create a ProactiveTip from a template"""
        return ProactiveTip(
            tip_id=tip_id,
            tip_type=template["type"],
            title=template["title"],
            content=template["content"],
            priority=template["priority"],
            trigger_context=[context.route, context.page_title],
            actions=template["actions"],
            dismissible=template.get("dismissible", True),
            show_once=template.get("show_once", False),
            expires_at=datetime.now() + timedelta(hours=24) if not template.get("show_once") else None
        )
    
    def _prioritize_tips(self, tips: List[ProactiveTip], context: PageContext, 
                        user_behavior: UserBehaviorPattern) -> List[ProactiveTip]:
        """Prioritize tips based on context and user behavior"""
        def priority_score(tip: ProactiveTip) -> int:
            score = 0
            
            # Base priority score
            priority_scores = {TipPriority.HIGH: 100, TipPriority.MEDIUM: 50, TipPriority.LOW: 25}
            score += priority_scores[tip.priority]
            
            # Context relevance boost
            if any(route in context.route for route in tip.trigger_context):
                score += 25
            
            # User level relevance
            if tip.tip_type == TipType.WELCOME and user_behavior.session_count <= 3:
                score += 50
            elif tip.tip_type == TipType.FEATURE_DISCOVERY and user_behavior.user_level == "intermediate":
                score += 30
            elif tip.tip_type == TipType.OPTIMIZATION and user_behavior.user_level == "advanced":
                score += 40
            
            # Time sensitivity
            if tip.expires_at and tip.expires_at < datetime.now() + timedelta(hours=6):
                score += 20
            
            return score
        
        # Sort by priority score (descending)
        return sorted(tips, key=priority_score, reverse=True)
    
    async def _get_user_tip_history(self, user_id: str) -> List[Dict]:
        """Get user's tip display history"""
        try:
            response = self.supabase.table("help_analytics").select("*").eq("user_id", user_id).eq("event_type", "tip_shown").order("timestamp", desc=True).limit(50).execute()
            return response.data or []
        except Exception as e:
            logger.error(f"Failed to get user tip history: {e}")
            return []
    
    async def _get_user_preferences(self, user_id: str) -> Dict[str, Any]:
        """Get user preferences for tips"""
        try:
            response = self.supabase.table("user_profiles").select("preferences").eq("user_id", user_id).execute()
            if response.data:
                return response.data[0].get("preferences", {})
            return {}
        except Exception as e:
            logger.error(f"Failed to get user preferences: {e}")
            return {}
    
    async def _get_optimization_data(self, context: PageContext, user_id: str) -> Dict[str, Any]:
        """Get data for optimization analysis"""
        try:
            data = {}
            
            # Get budget utilization
            projects_response = self.supabase.table("projects").select("budget, spent").execute()
            projects = projects_response.data or []
            
            if projects:
                total_budget = sum(p.get("budget", 0) for p in projects)
                total_spent = sum(p.get("spent", 0) for p in projects)
                data["budget_utilization"] = (total_spent / total_budget * 100) if total_budget > 0 else 0
            
            # Check resource imbalance (simplified)
            resources_response = self.supabase.table("resources").select("utilization").execute()
            resources = resources_response.data or []
            
            if resources:
                utilizations = [r.get("utilization", 0) for r in resources]
                avg_util = sum(utilizations) / len(utilizations)
                data["resource_imbalance"] = any(abs(u - avg_util) > 20 for u in utilizations)
            
            return data
        except Exception as e:
            logger.error(f"Failed to get optimization data: {e}")
            return {}
    
    def _should_show_tips(self, tip_history: List[Dict], user_preferences: Dict) -> bool:
        """Check if tips should be shown based on frequency settings"""
        tip_frequency = user_preferences.get("tip_frequency", "medium")
        
        if tip_frequency == "off":
            return False
        
        # Check recent tip display frequency
        recent_tips = [tip for tip in tip_history if 
                      datetime.fromisoformat(tip["timestamp"]) > datetime.now() - timedelta(minutes=self.tip_cooldown_minutes)]
        
        frequency_limits = {"low": 1, "medium": 2, "high": 3}
        return len(recent_tips) < frequency_limits.get(tip_frequency, 2)
    
    def _tip_already_shown(self, tip_id: str, tip_history: List[Dict]) -> bool:
        """Check if a tip has already been shown"""
        return any(tip.get("event_data", {}).get("tip_id") == tip_id for tip in tip_history)
    
    def _tip_recently_shown(self, tip_id: str, tip_history: List[Dict], hours: int = 24) -> bool:
        """Check if a tip was shown recently"""
        cutoff = datetime.now() - timedelta(hours=hours)
        return any(
            tip.get("event_data", {}).get("tip_id") == tip_id and 
            datetime.fromisoformat(tip["timestamp"]) > cutoff
            for tip in tip_history
        )
    
    def _feature_used(self, feature: str, feature_usage: Dict[str, int]) -> bool:
        """Check if a feature has been used"""
        return feature_usage.get(feature, 0) > 0
    
    def _detect_repetitive_actions(self, user_behavior: UserBehaviorPattern) -> bool:
        """Detect if user is performing repetitive actions that could benefit from bulk operations"""
        # Simple heuristic: if user has many similar queries or spends long time on list pages
        return (
            len(user_behavior.frequent_queries) > 5 or
            user_behavior.time_on_page > 600  # 10 minutes
        )
    
    async def _schedule_tips(self, tips: List[ProactiveTip], user_id: str):
        """Schedule tips for future display"""
        try:
            for tip in tips:
                # Log tip generation for analytics
                await self._log_tip_event(user_id, "tip_generated", {
                    "tip_id": tip.tip_id,
                    "tip_type": tip.tip_type.value,
                    "priority": tip.priority.value,
                    "context": tip.trigger_context
                })
        except Exception as e:
            logger.error(f"Failed to schedule tips: {e}")
    
    async def _log_tip_event(self, user_id: str, event_type: str, event_data: Dict[str, Any]):
        """Log tip-related events for analytics"""
        try:
            analytics_data = {
                "user_id": user_id,
                "event_type": event_type,
                "event_data": event_data,
                "timestamp": datetime.now().isoformat()
            }
            
            self.supabase.table("help_analytics").insert(analytics_data).execute()
        except Exception as e:
            logger.error(f"Failed to log tip event: {e}")
    
    async def dismiss_tip(self, user_id: str, tip_id: str) -> bool:
        """Mark a tip as dismissed by the user"""
        try:
            # Log dismissal event
            await self._log_tip_event(user_id, "tip_dismissed", {"tip_id": tip_id})
            
            # Update user's dismissed tips list
            response = self.supabase.table("user_profiles").select("preferences").eq("user_id", user_id).execute()
            
            if response.data:
                preferences = response.data[0].get("preferences", {})
                dismissed_tips = preferences.get("dismissed_tips", [])
                
                if tip_id not in dismissed_tips:
                    dismissed_tips.append(tip_id)
                    preferences["dismissed_tips"] = dismissed_tips
                    
                    self.supabase.table("user_profiles").update({"preferences": preferences}).eq("user_id", user_id).execute()
            
            return True
        except Exception as e:
            logger.error(f"Failed to dismiss tip: {e}")
            return False
    
    async def get_tip_analytics(self, user_id: Optional[str] = None, 
                              days: int = 30) -> Dict[str, Any]:
        """Get analytics data for tips"""
        try:
            cutoff_date = datetime.now() - timedelta(days=days)
            
            query = self.supabase.table("help_analytics").select("*").gte("timestamp", cutoff_date.isoformat())
            
            if user_id:
                query = query.eq("user_id", user_id)
            
            response = query.execute()
            events = response.data or []
            
            # Analyze tip events
            tip_events = [e for e in events if e["event_type"].startswith("tip_")]
            
            analytics = {
                "total_tips_generated": len([e for e in tip_events if e["event_type"] == "tip_generated"]),
                "total_tips_shown": len([e for e in tip_events if e["event_type"] == "tip_shown"]),
                "total_tips_dismissed": len([e for e in tip_events if e["event_type"] == "tip_dismissed"]),
                "tip_types": {},
                "most_dismissed_tips": {},
                "engagement_rate": 0
            }
            
            # Calculate engagement rate
            shown_count = analytics["total_tips_shown"]
            dismissed_count = analytics["total_tips_dismissed"]
            
            if shown_count > 0:
                analytics["engagement_rate"] = ((shown_count - dismissed_count) / shown_count) * 100
            
            # Analyze tip types
            for event in tip_events:
                if event["event_type"] == "tip_shown":
                    tip_data = event.get("event_data", {})
                    tip_type = tip_data.get("tip_type", "unknown")
                    analytics["tip_types"][tip_type] = analytics["tip_types"].get(tip_type, 0) + 1
            
            return analytics
            
        except Exception as e:
            logger.error(f"Failed to get tip analytics: {e}")
            return {}