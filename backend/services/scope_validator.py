"""
Scope Validation Service for Help Chat System
Ensures responses stay within PPM domain boundaries and enforces content filtering
"""

import os
import re
import json
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from enum import Enum
from openai import OpenAI
from supabase import Client

logger = logging.getLogger(__name__)

class ScopeViolationType(Enum):
    """Types of scope violations"""
    COMPETITOR_MENTION = "competitor_mention"
    EXTERNAL_TOOL = "external_tool"
    OFF_TOPIC = "off_topic"
    CORA_METHODOLOGY = "cora_methodology"
    GENERAL_BUSINESS_ADVICE = "general_business_advice"
    INAPPROPRIATE_CONTENT = "inappropriate_content"
    PERSONAL_INFORMATION = "personal_information"

class ScopeValidationResult:
    """Result of scope validation"""
    def __init__(self, is_valid: bool, confidence: float, violations: List[Dict] = None,
                 filtered_content: str = None, reasoning: str = None):
        self.is_valid = is_valid
        self.confidence = confidence
        self.violations = violations or []
        self.filtered_content = filtered_content
        self.reasoning = reasoning

class ScopeValidator:
    """Component that ensures responses stay within PPM domain boundaries"""
    
    def __init__(self, supabase_client: Client, openai_api_key: str):
        self.supabase = supabase_client
        self.openai_client = OpenAI(api_key=openai_api_key)
        self.validation_model = "gpt-3.5-turbo"
        
        # PPM domain keywords (allowed)
        self.ppm_domain_keywords = [
            "project", "portfolio", "resource", "budget", "schedule", "risk", "issue",
            "milestone", "task", "allocation", "utilization", "variance", "baseline",
            "what-if", "simulation", "monte carlo", "dashboard", "report", "analytics",
            "gantt", "timeline", "deliverable", "stakeholder", "scope", "quality",
            "cost", "time", "procurement", "vendor", "contract", "change request",
            "approval", "workflow", "template", "methodology", "best practice",
            "kpi", "metric", "performance", "optimization", "efficiency", "capacity",
            "workload", "assignment", "dependency", "critical path", "buffer",
            "contingency", "escalation", "governance", "compliance", "audit"
        ]
        
        # Competitor and external tool patterns (forbidden)
        self.competitor_patterns = [
            r'\b(microsoft project|ms project)\b',
            r'\b(primavera|p6)\b',
            r'\b(smartsheet)\b',
            r'\b(monday\.com|monday)\b',
            r'\b(asana)\b',
            r'\b(trello)\b',
            r'\b(jira)\b',
            r'\b(confluence)\b',
            r'\b(slack)\b',
            r'\b(teams)\b',
            r'\b(zoom)\b',
            r'\b(salesforce)\b',
            r'\b(workday)\b',
            r'\b(sap)\b',
            r'\b(oracle)\b',
            r'\b(atlassian)\b',
            r'\b(basecamp)\b',
            r'\b(wrike)\b',
            r'\b(clickup)\b',
            r'\b(notion)\b'
        ]
        
        # Cora methodology patterns (forbidden)
        self.cora_patterns = [
            r'\bcora\b',
            r'\bcora methodology\b',
            r'\bcora framework\b',
            r'\bcora approach\b',
            r'\bcora principles\b',
            r'\bcora best practices\b'
        ]
        
        # Off-topic patterns (forbidden)
        self.off_topic_patterns = [
            r'\b(weather|climate|temperature)\b',
            r'\b(sports|football|basketball|soccer)\b',
            r'\b(entertainment|movies|tv shows|music)\b',
            r'\b(cooking|recipe|food)\b',
            r'\b(travel|vacation|holiday)\b',
            r'\b(health|medical|doctor|medicine)\b',
            r'\b(legal advice|lawyer|attorney)\b',
            r'\b(personal life|family|relationship)\b',
            r'\b(politics|political|election)\b',
            r'\b(religion|religious|spiritual)\b',
            r'\b(news|current events|breaking news)\b'
        ]
        
        # General business advice patterns (context-dependent)
        self.general_business_patterns = [
            r'\b(general business strategy)\b',
            r'\b(market analysis)\b',
            r'\b(competitive analysis)\b',
            r'\b(business model)\b',
            r'\b(startup advice)\b',
            r'\b(investment advice)\b',
            r'\b(financial planning)\b',
            r'\b(tax advice)\b',
            r'\b(legal compliance)\b',
            r'\b(hr policies)\b'
        ]
    
    async def validate_query(self, query: str, context: Dict[str, Any] = None) -> ScopeValidationResult:
        """Validate if a query is within PPM domain scope"""
        try:
            # Normalize query for analysis
            query_lower = query.lower().strip()
            
            # Check for explicit violations
            violations = []
            
            # Check for competitor mentions
            competitor_violations = self._check_competitor_mentions(query_lower)
            violations.extend(competitor_violations)
            
            # Check for Cora methodology mentions
            cora_violations = self._check_cora_mentions(query_lower)
            violations.extend(cora_violations)
            
            # Check for off-topic content
            off_topic_violations = self._check_off_topic_content(query_lower)
            violations.extend(off_topic_violations)
            
            # Check for general business advice (context-dependent)
            business_violations = self._check_general_business_advice(query_lower, context)
            violations.extend(business_violations)
            
            # Check for PPM domain relevance
            ppm_relevance = self._check_ppm_relevance(query_lower)
            
            # Use AI validation for complex cases
            ai_validation = await self._ai_validate_scope(query, context)
            
            # Combine results
            is_valid = (
                len(violations) == 0 and 
                (ppm_relevance or ai_validation.get("is_ppm_related", False))
            )
            
            # Calculate confidence score
            confidence = self._calculate_validation_confidence(
                violations, ppm_relevance, ai_validation
            )
            
            # Generate reasoning
            reasoning = self._generate_validation_reasoning(
                violations, ppm_relevance, ai_validation
            )
            
            # Log validation result
            await self._log_validation_result(query, is_valid, violations, confidence)
            
            return ScopeValidationResult(
                is_valid=is_valid,
                confidence=confidence,
                violations=violations,
                reasoning=reasoning
            )
            
        except Exception as e:
            logger.error(f"Query validation failed: {e}")
            # Default to allowing the query with low confidence
            return ScopeValidationResult(
                is_valid=True,
                confidence=0.3,
                reasoning=f"Validation error: {str(e)}"
            )
    
    async def validate_response(self, response: str, original_query: str, 
                              context: Dict[str, Any] = None) -> ScopeValidationResult:
        """Validate if a response stays within PPM domain boundaries"""
        try:
            # Normalize response for analysis
            response_lower = response.lower().strip()
            
            # Check for violations in response
            violations = []
            
            # Check for competitor mentions in response
            competitor_violations = self._check_competitor_mentions(response_lower)
            violations.extend(competitor_violations)
            
            # Check for Cora methodology mentions
            cora_violations = self._check_cora_mentions(response_lower)
            violations.extend(cora_violations)
            
            # Check for inappropriate external references
            external_violations = self._check_external_references(response_lower)
            violations.extend(external_violations)
            
            # Use AI to validate response appropriateness
            ai_validation = await self._ai_validate_response(response, original_query, context)
            
            # Filter content if violations found
            filtered_content = response
            if violations:
                filtered_content = await self._filter_response_content(response, violations)
            
            # Determine if response is valid
            is_valid = len(violations) == 0 and ai_validation.get("is_appropriate", True)
            
            # Calculate confidence
            confidence = self._calculate_response_confidence(violations, ai_validation)
            
            # Generate reasoning
            reasoning = self._generate_response_reasoning(violations, ai_validation)
            
            # Log validation result
            await self._log_validation_result(
                f"Response to: {original_query}", is_valid, violations, confidence
            )
            
            return ScopeValidationResult(
                is_valid=is_valid,
                confidence=confidence,
                violations=violations,
                filtered_content=filtered_content,
                reasoning=reasoning
            )
            
        except Exception as e:
            logger.error(f"Response validation failed: {e}")
            # Default to allowing the response
            return ScopeValidationResult(
                is_valid=True,
                confidence=0.3,
                filtered_content=response,
                reasoning=f"Validation error: {str(e)}"
            )
    
    async def filter_content(self, content: str, filter_type: str = "response") -> str:
        """Filter content to remove scope violations"""
        try:
            # Use AI to intelligently filter content
            filter_prompt = f"""
            Filter the following {filter_type} to ensure it stays within PPM (Project Portfolio Management) domain boundaries.
            
            Remove or replace any mentions of:
            - Competitor tools or software
            - Cora methodology references
            - Off-topic content not related to PPM
            - General business advice not specific to PPM
            - External tools or services
            
            Keep the helpful, professional tone while focusing on PPM platform features only.
            
            Content to filter:
            {content}
            
            Provide the filtered version:
            """
            
            response = self.openai_client.chat.completions.create(
                model=self.validation_model,
                messages=[
                    {"role": "system", "content": "You are a content filter for a PPM platform help system. Filter content to stay within PPM domain boundaries."},
                    {"role": "user", "content": filter_prompt}
                ],
                temperature=0.1,
                max_tokens=800
            )
            
            filtered_content = response.choices[0].message.content.strip()
            
            # Fallback filtering using regex if AI filtering fails
            if not filtered_content or len(filtered_content) < len(content) * 0.3:
                filtered_content = self._regex_filter_content(content)
            
            return filtered_content
            
        except Exception as e:
            logger.error(f"Content filtering failed: {e}")
            # Fallback to regex filtering
            return self._regex_filter_content(content)
    
    def _check_competitor_mentions(self, text: str) -> List[Dict]:
        """Check for competitor tool mentions"""
        violations = []
        
        for pattern in self.competitor_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                violations.append({
                    "type": ScopeViolationType.COMPETITOR_MENTION.value,
                    "matched_text": match.group(),
                    "position": match.span(),
                    "severity": "high",
                    "description": f"Mention of competitor tool: {match.group()}"
                })
        
        return violations
    
    def _check_cora_mentions(self, text: str) -> List[Dict]:
        """Check for Cora methodology mentions"""
        violations = []
        
        for pattern in self.cora_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                violations.append({
                    "type": ScopeViolationType.CORA_METHODOLOGY.value,
                    "matched_text": match.group(),
                    "position": match.span(),
                    "severity": "critical",
                    "description": f"Cora methodology reference: {match.group()}"
                })
        
        return violations
    
    def _check_off_topic_content(self, text: str) -> List[Dict]:
        """Check for off-topic content"""
        violations = []
        
        for pattern in self.off_topic_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                violations.append({
                    "type": ScopeViolationType.OFF_TOPIC.value,
                    "matched_text": match.group(),
                    "position": match.span(),
                    "severity": "medium",
                    "description": f"Off-topic content: {match.group()}"
                })
        
        return violations
    
    def _check_general_business_advice(self, text: str, context: Dict[str, Any] = None) -> List[Dict]:
        """Check for general business advice not specific to PPM"""
        violations = []
        
        # Only flag as violation if no PPM context is present
        has_ppm_context = self._check_ppm_relevance(text)
        
        if not has_ppm_context:
            for pattern in self.general_business_patterns:
                matches = re.finditer(pattern, text, re.IGNORECASE)
                for match in matches:
                    violations.append({
                        "type": ScopeViolationType.GENERAL_BUSINESS_ADVICE.value,
                        "matched_text": match.group(),
                        "position": match.span(),
                        "severity": "low",
                        "description": f"General business advice without PPM context: {match.group()}"
                    })
        
        return violations
    
    def _check_external_references(self, text: str) -> List[Dict]:
        """Check for inappropriate external references in responses"""
        violations = []
        
        # Patterns for external references that should be avoided
        external_patterns = [
            r'\b(visit|check out|go to) [a-zA-Z0-9.-]+\.(com|org|net|io)\b',
            r'\b(download|install) [a-zA-Z]+ from\b',
            r'\b(contact|call|email) [a-zA-Z]+ support\b',
            r'\b(try|use|consider) [a-zA-Z]+ instead\b'
        ]
        
        for pattern in external_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                violations.append({
                    "type": ScopeViolationType.EXTERNAL_TOOL.value,
                    "matched_text": match.group(),
                    "position": match.span(),
                    "severity": "medium",
                    "description": f"External reference: {match.group()}"
                })
        
        return violations
    
    def _check_ppm_relevance(self, text: str) -> bool:
        """Check if text has PPM domain relevance"""
        # Count PPM domain keywords
        ppm_keyword_count = sum(1 for keyword in self.ppm_domain_keywords if keyword in text)
        
        # Check for PPM-related phrases
        ppm_phrases = [
            "project management", "portfolio management", "resource management",
            "budget tracking", "risk assessment", "schedule management",
            "project planning", "resource allocation", "cost management",
            "project monitoring", "portfolio optimization", "project delivery"
        ]
        
        phrase_count = sum(1 for phrase in ppm_phrases if phrase in text)
        
        # Consider relevant if has multiple PPM keywords or phrases
        return ppm_keyword_count >= 2 or phrase_count >= 1
    
    async def _ai_validate_scope(self, query: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """Use AI to validate query scope for complex cases"""
        try:
            validation_prompt = f"""
            Analyze if this query is appropriate for a PPM (Project Portfolio Management) platform help system.
            
            Query: "{query}"
            
            Consider:
            1. Is it related to project management, portfolio management, or resource management?
            2. Is it asking about platform features or functionality?
            3. Does it avoid mentioning competitor tools or external services?
            4. Is it professional and appropriate for a business context?
            
            Respond with JSON:
            {{
                "is_ppm_related": true/false,
                "confidence": 0.0-1.0,
                "reasoning": "explanation",
                "suggested_redirect": "optional suggestion if not appropriate"
            }}
            """
            
            response = self.openai_client.chat.completions.create(
                model=self.validation_model,
                messages=[
                    {"role": "system", "content": "You are a scope validator for a PPM platform. Analyze queries for appropriateness and domain relevance."},
                    {"role": "user", "content": validation_prompt}
                ],
                temperature=0.1,
                max_tokens=300
            )
            
            result_text = response.choices[0].message.content.strip()
            
            # Try to parse JSON response
            try:
                result = json.loads(result_text)
                return result
            except json.JSONDecodeError:
                # Fallback parsing
                return {
                    "is_ppm_related": "ppm" in result_text.lower() or "project" in result_text.lower(),
                    "confidence": 0.5,
                    "reasoning": result_text,
                    "suggested_redirect": None
                }
            
        except Exception as e:
            logger.error(f"AI scope validation failed: {e}")
            return {
                "is_ppm_related": True,
                "confidence": 0.3,
                "reasoning": f"AI validation error: {str(e)}",
                "suggested_redirect": None
            }
    
    async def _ai_validate_response(self, response: str, original_query: str, 
                                  context: Dict[str, Any] = None) -> Dict[str, Any]:
        """Use AI to validate response appropriateness"""
        try:
            validation_prompt = f"""
            Validate if this response is appropriate for a PPM platform help system.
            
            Original Query: "{original_query}"
            Response: "{response}"
            
            Check if the response:
            1. Stays focused on PPM platform features
            2. Avoids mentioning competitor tools
            3. Doesn't reference external services inappropriately
            4. Maintains professional, helpful tone
            5. Provides actionable PPM-specific guidance
            
            Respond with JSON:
            {{
                "is_appropriate": true/false,
                "confidence": 0.0-1.0,
                "issues": ["list of any issues found"],
                "reasoning": "explanation"
            }}
            """
            
            response_obj = self.openai_client.chat.completions.create(
                model=self.validation_model,
                messages=[
                    {"role": "system", "content": "You are a response validator for a PPM platform help system. Ensure responses are appropriate and on-topic."},
                    {"role": "user", "content": validation_prompt}
                ],
                temperature=0.1,
                max_tokens=300
            )
            
            result_text = response_obj.choices[0].message.content.strip()
            
            # Try to parse JSON response
            try:
                result = json.loads(result_text)
                return result
            except json.JSONDecodeError:
                # Fallback parsing
                return {
                    "is_appropriate": "appropriate" in result_text.lower(),
                    "confidence": 0.5,
                    "issues": [],
                    "reasoning": result_text
                }
            
        except Exception as e:
            logger.error(f"AI response validation failed: {e}")
            return {
                "is_appropriate": True,
                "confidence": 0.3,
                "issues": [],
                "reasoning": f"AI validation error: {str(e)}"
            }
    
    async def _filter_response_content(self, response: str, violations: List[Dict]) -> str:
        """Filter response content based on violations"""
        filtered_response = response
        
        # Sort violations by position (reverse order to maintain positions)
        violations_sorted = sorted(violations, key=lambda x: x["position"][0], reverse=True)
        
        for violation in violations_sorted:
            start, end = violation["position"]
            violation_type = violation["type"]
            
            # Replace with appropriate alternatives
            if violation_type == ScopeViolationType.COMPETITOR_MENTION.value:
                replacement = "our PPM platform"
            elif violation_type == ScopeViolationType.CORA_METHODOLOGY.value:
                replacement = "PPM best practices"
            elif violation_type == ScopeViolationType.EXTERNAL_TOOL.value:
                replacement = "platform features"
            else:
                replacement = "[content filtered]"
            
            # Replace the violating text
            filtered_response = (
                filtered_response[:start] + 
                replacement + 
                filtered_response[end:]
            )
        
        return filtered_response
    
    def _regex_filter_content(self, content: str) -> str:
        """Fallback regex-based content filtering"""
        filtered_content = content
        
        # Remove competitor mentions
        for pattern in self.competitor_patterns:
            filtered_content = re.sub(pattern, "[PPM platform]", filtered_content, flags=re.IGNORECASE)
        
        # Remove Cora methodology mentions
        for pattern in self.cora_patterns:
            filtered_content = re.sub(pattern, "PPM best practices", filtered_content, flags=re.IGNORECASE)
        
        # Remove off-topic content (replace with generic message)
        for pattern in self.off_topic_patterns:
            filtered_content = re.sub(pattern, "[topic not covered]", filtered_content, flags=re.IGNORECASE)
        
        return filtered_content
    
    def _calculate_validation_confidence(self, violations: List[Dict], 
                                       ppm_relevance: bool, ai_validation: Dict) -> float:
        """Calculate confidence score for validation result"""
        confidence_factors = []
        
        # Base confidence on violation count
        if len(violations) == 0:
            confidence_factors.append(0.9)
        elif len(violations) <= 2:
            confidence_factors.append(0.6)
        else:
            confidence_factors.append(0.3)
        
        # Factor in PPM relevance
        if ppm_relevance:
            confidence_factors.append(0.8)
        else:
            confidence_factors.append(0.4)
        
        # Factor in AI validation confidence
        ai_confidence = ai_validation.get("confidence", 0.5)
        confidence_factors.append(ai_confidence)
        
        # Calculate weighted average
        final_confidence = sum(confidence_factors) / len(confidence_factors)
        return min(max(final_confidence, 0.0), 1.0)
    
    def _calculate_response_confidence(self, violations: List[Dict], 
                                     ai_validation: Dict) -> float:
        """Calculate confidence score for response validation"""
        confidence_factors = []
        
        # Base confidence on violation severity
        critical_violations = [v for v in violations if v["severity"] == "critical"]
        high_violations = [v for v in violations if v["severity"] == "high"]
        
        if len(critical_violations) > 0:
            confidence_factors.append(0.2)
        elif len(high_violations) > 0:
            confidence_factors.append(0.5)
        elif len(violations) > 0:
            confidence_factors.append(0.7)
        else:
            confidence_factors.append(0.9)
        
        # Factor in AI validation
        ai_confidence = ai_validation.get("confidence", 0.5)
        confidence_factors.append(ai_confidence)
        
        # Calculate final confidence
        final_confidence = sum(confidence_factors) / len(confidence_factors)
        return min(max(final_confidence, 0.0), 1.0)
    
    def _generate_validation_reasoning(self, violations: List[Dict], 
                                     ppm_relevance: bool, ai_validation: Dict) -> str:
        """Generate human-readable reasoning for validation result"""
        if len(violations) == 0 and ppm_relevance:
            return "Query is within PPM domain scope and contains no violations."
        
        reasoning_parts = []
        
        if violations:
            violation_types = [v["type"] for v in violations]
            reasoning_parts.append(f"Found {len(violations)} scope violations: {', '.join(set(violation_types))}")
        
        if not ppm_relevance:
            reasoning_parts.append("Query lacks clear PPM domain relevance")
        
        ai_reasoning = ai_validation.get("reasoning", "")
        if ai_reasoning:
            reasoning_parts.append(f"AI analysis: {ai_reasoning}")
        
        return ". ".join(reasoning_parts) if reasoning_parts else "No specific issues identified."
    
    def _generate_response_reasoning(self, violations: List[Dict], 
                                   ai_validation: Dict) -> str:
        """Generate reasoning for response validation result"""
        if len(violations) == 0:
            return "Response stays within PPM domain boundaries."
        
        reasoning_parts = []
        
        violation_descriptions = [v["description"] for v in violations]
        reasoning_parts.append(f"Response contains scope violations: {'; '.join(violation_descriptions)}")
        
        ai_issues = ai_validation.get("issues", [])
        if ai_issues:
            reasoning_parts.append(f"AI identified issues: {', '.join(ai_issues)}")
        
        return ". ".join(reasoning_parts)
    
    async def _log_validation_result(self, content: str, is_valid: bool, 
                                   violations: List[Dict], confidence: float):
        """Log validation results for monitoring and improvement"""
        try:
            # Store validation log in database
            self.supabase.table("scope_validation_logs").insert({
                "content_hash": hash(content),
                "content_preview": content[:200],
                "is_valid": is_valid,
                "confidence_score": confidence,
                "violations": violations,
                "violation_count": len(violations),
                "timestamp": datetime.now().isoformat()
            }).execute()
            
        except Exception as e:
            logger.error(f"Failed to log validation result: {e}")
    
    async def get_validation_statistics(self, days: int = 7) -> Dict[str, Any]:
        """Get validation statistics for monitoring"""
        try:
            # Get validation logs from the last N days
            start_date = (datetime.now() - timedelta(days=days)).isoformat()
            
            logs_response = self.supabase.table("scope_validation_logs").select("*").gte(
                "timestamp", start_date
            ).execute()
            
            logs = logs_response.data or []
            
            if not logs:
                return {"message": "No validation data available"}
            
            # Calculate statistics
            total_validations = len(logs)
            valid_count = len([log for log in logs if log["is_valid"]])
            invalid_count = total_validations - valid_count
            
            # Violation statistics
            all_violations = []
            for log in logs:
                all_violations.extend(log.get("violations", []))
            
            violation_types = {}
            for violation in all_violations:
                v_type = violation["type"]
                violation_types[v_type] = violation_types.get(v_type, 0) + 1
            
            # Average confidence
            avg_confidence = sum(log["confidence_score"] for log in logs) / total_validations
            
            return {
                "period_days": days,
                "total_validations": total_validations,
                "valid_count": valid_count,
                "invalid_count": invalid_count,
                "validation_rate": round(valid_count / total_validations * 100, 1),
                "average_confidence": round(avg_confidence, 3),
                "violation_types": violation_types,
                "most_common_violation": max(violation_types.items(), key=lambda x: x[1])[0] if violation_types else None
            }
            
        except Exception as e:
            logger.error(f"Failed to get validation statistics: {e}")
            return {"error": str(e)}