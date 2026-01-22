"""
AI Agents Implementation for PPM Platform
Implements the four core AI agents: RAG Reporter, Resource Optimizer, Risk Forecaster, and Hallucination Validator
Enhanced with comprehensive logging and monitoring
"""

import os
import json
import asyncio
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import numpy as np
from openai import OpenAI
from supabase import Client
import logging
import uuid

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AIAgentBase:
    """Base class for all AI agents with common functionality"""
    
    def __init__(self, supabase_client: Client, openai_api_key: str, base_url: Optional[str] = None):
        self.supabase = supabase_client
        # Initialize OpenAI client with optional custom base URL (for Grok, etc.)
        if base_url:
            self.openai_client = OpenAI(api_key=openai_api_key, base_url=base_url)
        else:
            self.openai_client = OpenAI(api_key=openai_api_key)
        self.agent_type = self.__class__.__name__.lower()
        
        # Import AI model management here to avoid circular imports
        try:
            from ai_model_management import AIModelManager, ModelOperation, ModelOperationType
            self.model_manager = AIModelManager(supabase_client)
            self.ModelOperation = ModelOperation
            self.ModelOperationType = ModelOperationType
        except ImportError:
            logger.warning("AI model management not available - using fallback logging")
            self.model_manager = None
            self.ModelOperation = None
            self.ModelOperationType = None
    
    async def log_operation(self, operation_type: str, user_id: str, inputs: Dict[str, Any], 
                           outputs: Dict[str, Any], response_time_ms: int, success: bool = True, 
                           error_message: str = None, confidence_score: float = None,
                           input_tokens: int = 0, output_tokens: int = 0) -> str:
        """Enhanced operation logging with AI model management"""
        operation_id = str(uuid.uuid4())
        
        try:
            if self.model_manager and self.ModelOperation and self.ModelOperationType:
                # Use new AI model management system
                operation = self.ModelOperation(
                    operation_id=operation_id,
                    model_id=f"{self.agent_type}_v1",
                    operation_type=self.ModelOperationType(operation_type),
                    user_id=user_id,
                    inputs=inputs,
                    outputs=outputs,
                    confidence_score=confidence_score,
                    response_time_ms=response_time_ms,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    success=success,
                    error_message=error_message,
                    timestamp=datetime.now(),
                    metadata={"agent_class": self.__class__.__name__}
                )
                
                await self.model_manager.log_model_operation(operation)
            else:
                # Fallback to legacy logging
                await self.log_metrics(operation_type, user_id, input_tokens, output_tokens, 
                                     response_time_ms, success, error_message, confidence_score)
            
            return operation_id
            
        except Exception as e:
            logger.error(f"Failed to log operation: {e}")
            return operation_id
    
    async def log_metrics(self, operation: str, user_id: str, input_tokens: int = 0, 
                         output_tokens: int = 0, response_time_ms: int = 0, 
                         success: bool = True, error_message: str = None, 
                         confidence_score: float = None):
        """Legacy metrics logging (fallback)"""
        try:
            self.supabase.table("ai_agent_metrics").insert({
                "agent_type": self.agent_type,
                "operation": operation,
                "user_id": user_id,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "response_time_ms": response_time_ms,
                "success": success,
                "error_message": error_message,
                "confidence_score": confidence_score
            }).execute()
        except Exception as e:
            logger.error(f"Failed to log metrics: {e}")

class RAGReporterAgent(AIAgentBase):
    """Natural Language Reporting Agent using RAG (Retrieval-Augmented Generation)"""
    
    def __init__(self, supabase_client: Client, openai_api_key: str, base_url: Optional[str] = None):
        super().__init__(supabase_client, openai_api_key, base_url)
        # Use configurable models from environment or defaults
        import os
        self.embedding_model = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-ada-002")
        self.chat_model = os.getenv("OPENAI_MODEL", "gpt-4")
        self.max_context_length = 8000
        
        # Check if we should use local embeddings (for Grok or when OpenAI embeddings unavailable)
        self.use_local_embeddings = os.getenv("USE_LOCAL_EMBEDDINGS", "false").lower() == "true"
        if self.use_local_embeddings or base_url:
            logger.info("Using local sentence-transformers for embeddings")
            try:
                from sentence_transformers import SentenceTransformer
                self.local_embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
                self.embedding_dimension = 384  # all-MiniLM-L6-v2 dimension
            except ImportError:
                logger.warning("sentence-transformers not installed, falling back to OpenAI")
                self.use_local_embeddings = False
                self.embedding_dimension = 1536
        else:
            self.embedding_dimension = 1536
    
    async def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for text using OpenAI or local model"""
        try:
            if self.use_local_embeddings:
                # Use local sentence-transformers model
                embedding = self.local_embedding_model.encode(text, convert_to_numpy=True)
                return embedding.tolist()
            else:
                # Use OpenAI API
                response = self.openai_client.embeddings.create(
                    model=self.embedding_model,
                    input=text
                )
                return response.data[0].embedding
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            raise
    
    async def store_content_embedding(self, content_type: str, content_id: str, 
                                    content_text: str, metadata: Dict = None):
        """Store content embedding in vector database"""
        try:
            embedding = await self.generate_embedding(content_text)
            
            self.supabase.table("embeddings").upsert({
                "content_type": content_type,
                "content_id": content_id,
                "content_text": content_text,
                "embedding": embedding,
                "metadata": metadata or {}
            }, on_conflict="content_type,content_id").execute()
            
            logger.info(f"Stored embedding for {content_type}:{content_id}")
        except Exception as e:
            logger.error(f"Failed to store embedding: {e}")
            raise
    
    async def search_similar_content(self, query: str, content_types: List[str] = None, 
                                   limit: int = 5) -> List[Dict]:
        """Search for similar content using vector similarity with pgvector"""
        try:
            query_embedding = await self.generate_embedding(query)
            
            # Build the query with proper vector similarity search
            if content_types:
                quoted_types = [f"'{ct}'" for ct in content_types]
                content_filter = f"content_type IN ({','.join(quoted_types)})"
            else:
                content_filter = "TRUE"
            
            # Use pgvector's cosine distance for similarity search
            # Note: We use 1 - cosine_distance to get similarity score (higher = more similar)
            similarity_query = f"""
                SELECT 
                    content_type, 
                    content_id, 
                    content_text, 
                    metadata,
                    (1 - (embedding <=> %s::vector)) as similarity_score
                FROM embeddings 
                WHERE {content_filter}
                ORDER BY embedding <=> %s::vector
                LIMIT %s
            """
            
            # Execute the query using Supabase RPC
            result = self.supabase.rpc('vector_similarity_search', {
                'query_embedding': query_embedding,
                'content_types': content_types or [],
                'similarity_limit': limit
            }).execute()
            
            if result.data:
                return result.data
            
            # Fallback to basic similarity if RPC not available
            return await self._fallback_similarity_search(query_embedding, content_types, limit)
            
        except Exception as e:
            logger.error(f"Vector similarity search failed: {e}")
            # Fallback to basic search
            return await self._fallback_similarity_search(query_embedding if 'query_embedding' in locals() else None, content_types, limit)
    
    async def _fallback_similarity_search(self, query_embedding: List[float] = None, 
                                        content_types: List[str] = None, limit: int = 5) -> List[Dict]:
        """Fallback similarity search using basic filtering"""
        try:
            query_builder = self.supabase.table("embeddings").select(
                "content_type, content_id, content_text, metadata, embedding"
            )
            
            if content_types:
                query_builder = query_builder.in_("content_type", content_types)
            
            response = query_builder.limit(limit * 3).execute()  # Get more to filter
            
            if not response.data:
                return []
            
            # Calculate similarity scores if we have query embedding
            results = []
            for item in response.data:
                if item.get('embedding') and query_embedding:
                    similarity = self._calculate_similarity(query_embedding, item['embedding'])
                    results.append({
                        'content_type': item['content_type'],
                        'content_id': item['content_id'],
                        'content_text': item['content_text'],
                        'metadata': item['metadata'],
                        'similarity_score': similarity
                    })
                else:
                    # If no embedding comparison possible, use basic text matching
                    results.append({
                        'content_type': item['content_type'],
                        'content_id': item['content_id'],
                        'content_text': item['content_text'],
                        'metadata': item['metadata'],
                        'similarity_score': 0.5  # Default similarity
                    })
            
            # Sort by similarity and return top results
            results.sort(key=lambda x: x['similarity_score'], reverse=True)
            return results[:limit]
            
        except Exception as e:
            logger.error(f"Fallback similarity search failed: {e}")
            return []
    
    def _calculate_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors"""
        try:
            vec1_np = np.array(vec1)
            vec2_np = np.array(vec2)
            
            dot_product = np.dot(vec1_np, vec2_np)
            norm1 = np.linalg.norm(vec1_np)
            norm2 = np.linalg.norm(vec2_np)
            
            if norm1 == 0 or norm2 == 0:
                return 0.0
            
            return dot_product / (norm1 * norm2)
        except Exception:
            return 0.0
    
    async def get_context_data(self, user_id: str) -> Dict[str, Any]:
        """Gather contextual data for RAG queries"""
        try:
            context = {}
            
            # Get user's projects
            projects_response = self.supabase.table("projects").select("*").execute()
            context['projects'] = projects_response.data or []
            
            # Get portfolios
            portfolios_response = self.supabase.table("portfolios").select("*").execute()
            context['portfolios'] = portfolios_response.data or []
            
            # Get resources
            resources_response = self.supabase.table("resources").select("*").execute()
            context['resources'] = resources_response.data or []
            
            # Get recent metrics
            context['summary'] = {
                'total_projects': len(context['projects']),
                'total_portfolios': len(context['portfolios']),
                'total_resources': len(context['resources']),
                'timestamp': datetime.now().isoformat()
            }
            
            return context
            
        except Exception as e:
            logger.error(f"Failed to get context data: {e}")
            return {}
    
    async def process_rag_query(self, query: str, user_id: str, 
                              conversation_id: str = None) -> Dict[str, Any]:
        """Process a natural language query using RAG"""
        start_time = datetime.now()
        operation_id = None
        
        try:
            # Generate conversation ID if not provided
            if not conversation_id:
                conversation_id = f"conv_{int(datetime.now().timestamp())}"
            
            # Search for relevant content
            similar_content = await self.search_similar_content(
                query, 
                content_types=['project', 'portfolio', 'resource'],
                limit=5
            )
            
            # Get additional context
            context_data = await self.get_context_data(user_id)
            
            # Build the prompt
            system_prompt = self._build_system_prompt()
            user_prompt = self._build_user_prompt(query, similar_content, context_data)
            
            # Call OpenAI
            response = self.openai_client.chat.completions.create(
                model=self.chat_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1,
                max_tokens=1000
            )
            
            ai_response = response.choices[0].message.content
            
            # Calculate metrics
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            input_tokens = response.usage.prompt_tokens
            output_tokens = response.usage.completion_tokens
            
            # Extract sources and confidence
            sources = [
                {
                    "type": item["content_type"],
                    "id": item["content_id"],
                    "similarity": item["similarity_score"]
                }
                for item in similar_content
            ]
            
            confidence_score = self._calculate_confidence(similar_content, ai_response)
            
            # Enhanced logging
            operation_id = await self.log_operation(
                operation_type="rag_query",
                user_id=user_id,
                inputs={"query": query, "conversation_id": conversation_id},
                outputs={"response": ai_response, "sources": sources},
                response_time_ms=response_time,
                success=True,
                confidence_score=confidence_score,
                input_tokens=input_tokens,
                output_tokens=output_tokens
            )
            
            # Store conversation
            await self._store_conversation(
                user_id, conversation_id, query, ai_response, 
                sources, confidence_score, operation_id
            )
            
            return {
                "response": ai_response,
                "sources": sources,
                "confidence_score": confidence_score,
                "conversation_id": conversation_id,
                "response_time_ms": response_time,
                "operation_id": operation_id
            }
            
        except Exception as e:
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            
            # Log error
            operation_id = await self.log_operation(
                operation_type="rag_query",
                user_id=user_id,
                inputs={"query": query, "conversation_id": conversation_id},
                outputs={},
                response_time_ms=response_time,
                success=False,
                error_message=str(e)
            )
            
            logger.error(f"RAG query failed: {e}")
            raise
    
    def _build_system_prompt(self) -> str:
        """Build the system prompt for RAG queries"""
        return """You are an AI assistant for a Project Portfolio Management (PPM) platform. 
        You help users analyze their projects, portfolios, and resources by providing insights based on their data.
        
        Guidelines:
        - Provide accurate, data-driven responses based on the provided context
        - Include specific numbers and metrics when available
        - Suggest actionable insights and recommendations
        - If data is insufficient, clearly state limitations
        - Format responses clearly with bullet points or sections when appropriate
        - Focus on project management, resource allocation, and portfolio optimization
        
        Always base your responses on the provided context data and similar content."""
    
    def _build_user_prompt(self, query: str, similar_content: List[Dict], 
                          context_data: Dict) -> str:
        """Build the user prompt with context"""
        prompt = f"User Query: {query}\n\n"
        
        # Add similar content
        if similar_content:
            prompt += "Relevant Content:\n"
            for i, content in enumerate(similar_content[:3], 1):
                prompt += f"{i}. {content['content_type']}: {content['content_text'][:200]}...\n"
            prompt += "\n"
        
        # Add context summary
        if context_data.get('summary'):
            summary = context_data['summary']
            prompt += f"Current Portfolio Summary:\n"
            prompt += f"- Total Projects: {summary['total_projects']}\n"
            prompt += f"- Total Portfolios: {summary['total_portfolios']}\n"
            prompt += f"- Total Resources: {summary['total_resources']}\n\n"
        
        prompt += "Please provide a comprehensive response based on this data."
        
        return prompt
    
    def _calculate_confidence(self, similar_content: List[Dict], response: str) -> float:
        """Calculate confidence score for the response"""
        if not similar_content:
            return 0.3  # Low confidence without relevant content
        
        # Base confidence on similarity scores
        avg_similarity = sum(item['similarity_score'] for item in similar_content) / len(similar_content)
        
        # Adjust based on response length and content
        response_length_factor = min(len(response) / 500, 1.0)  # Normalize to 0-1
        
        confidence = (avg_similarity * 0.7) + (response_length_factor * 0.3)
        return min(max(confidence, 0.0), 1.0)
    
    async def index_existing_content(self) -> Dict[str, Any]:
        """Index existing content in the database for vector search"""
        try:
            indexed_count = 0
            errors = []
            
            # Index projects
            projects_response = self.supabase.table("projects").select("*").execute()
            for project in projects_response.data or []:
                try:
                    content_text = f"Project: {project['name']}. Description: {project.get('description', '')}. Status: {project.get('status', '')}. Priority: {project.get('priority', '')}."
                    await self.store_content_embedding(
                        "project", 
                        project["id"], 
                        content_text,
                        {
                            "name": project["name"],
                            "status": project.get("status"),
                            "priority": project.get("priority"),
                            "budget": project.get("budget")
                        }
                    )
                    indexed_count += 1
                except Exception as e:
                    errors.append(f"Project {project['id']}: {str(e)}")
            
            # Index portfolios
            portfolios_response = self.supabase.table("portfolios").select("*").execute()
            for portfolio in portfolios_response.data or []:
                try:
                    content_text = f"Portfolio: {portfolio['name']}. Description: {portfolio.get('description', '')}."
                    await self.store_content_embedding(
                        "portfolio", 
                        portfolio["id"], 
                        content_text,
                        {
                            "name": portfolio["name"],
                            "owner_id": portfolio.get("owner_id")
                        }
                    )
                    indexed_count += 1
                except Exception as e:
                    errors.append(f"Portfolio {portfolio['id']}: {str(e)}")
            
            # Index resources
            resources_response = self.supabase.table("resources").select("*").execute()
            for resource in resources_response.data or []:
                try:
                    skills_text = ", ".join(resource.get("skills", []))
                    content_text = f"Resource: {resource['name']}. Role: {resource.get('role', '')}. Skills: {skills_text}. Location: {resource.get('location', '')}."
                    await self.store_content_embedding(
                        "resource", 
                        resource["id"], 
                        content_text,
                        {
                            "name": resource["name"],
                            "role": resource.get("role"),
                            "skills": resource.get("skills", []),
                            "location": resource.get("location")
                        }
                    )
                    indexed_count += 1
                except Exception as e:
                    errors.append(f"Resource {resource['id']}: {str(e)}")
            
            # Index risks
            risks_response = self.supabase.table("risks").select("*").execute()
            for risk in risks_response.data or []:
                try:
                    content_text = f"Risk: {risk['title']}. Description: {risk.get('description', '')}. Category: {risk.get('category', '')}. Mitigation: {risk.get('mitigation', '')}."
                    await self.store_content_embedding(
                        "risk", 
                        risk["id"], 
                        content_text,
                        {
                            "title": risk["title"],
                            "category": risk.get("category"),
                            "probability": risk.get("probability"),
                            "impact": risk.get("impact"),
                            "status": risk.get("status")
                        }
                    )
                    indexed_count += 1
                except Exception as e:
                    errors.append(f"Risk {risk['id']}: {str(e)}")
            
            # Index issues
            issues_response = self.supabase.table("issues").select("*").execute()
            for issue in issues_response.data or []:
                try:
                    content_text = f"Issue: {issue['title']}. Description: {issue.get('description', '')}. Severity: {issue.get('severity', '')}. Resolution: {issue.get('resolution', '')}."
                    await self.store_content_embedding(
                        "issue", 
                        issue["id"], 
                        content_text,
                        {
                            "title": issue["title"],
                            "severity": issue.get("severity"),
                            "status": issue.get("status"),
                            "assigned_to": issue.get("assigned_to")
                        }
                    )
                    indexed_count += 1
                except Exception as e:
                    errors.append(f"Issue {issue['id']}: {str(e)}")
            
            return {
                "indexed_count": indexed_count,
                "errors": errors,
                "success": len(errors) == 0,
                "message": f"Successfully indexed {indexed_count} items with {len(errors)} errors"
            }
            
        except Exception as e:
            logger.error(f"Content indexing failed: {e}")
            return {
                "indexed_count": 0,
                "errors": [str(e)],
                "success": False,
                "message": f"Content indexing failed: {str(e)}"
            }
    
    async def semantic_search(self, query: str, filters: Dict[str, Any] = None, limit: int = 10) -> Dict[str, Any]:
        """Perform semantic search across all indexed content"""
        try:
            # Apply filters if provided
            content_types = filters.get("content_types") if filters else None
            
            # Search for similar content
            similar_content = await self.search_similar_content(
                query, 
                content_types=content_types,
                limit=limit
            )
            
            # Group results by content type
            grouped_results = {}
            for item in similar_content:
                content_type = item["content_type"]
                if content_type not in grouped_results:
                    grouped_results[content_type] = []
                grouped_results[content_type].append(item)
            
            # Calculate search statistics
            total_results = len(similar_content)
            avg_similarity = sum(item["similarity_score"] for item in similar_content) / total_results if total_results > 0 else 0
            
            return {
                "query": query,
                "results": similar_content,
                "grouped_results": grouped_results,
                "statistics": {
                    "total_results": total_results,
                    "average_similarity": round(avg_similarity, 3),
                    "content_types_found": list(grouped_results.keys()),
                    "filters_applied": filters or {}
                }
            }
            
        except Exception as e:
            logger.error(f"Semantic search failed: {e}")
            return {
                "query": query,
                "results": [],
                "grouped_results": {},
                "statistics": {
                    "total_results": 0,
                    "average_similarity": 0,
                    "content_types_found": [],
                    "filters_applied": filters or {}
                },
                "error": str(e)
            }
    
    async def update_content_embedding(self, content_type: str, content_id: str, 
                                     updated_content: Dict[str, Any]) -> bool:
        """Update embedding for modified content"""
        try:
            # Generate new content text based on content type
            if content_type == "project":
                content_text = f"Project: {updated_content['name']}. Description: {updated_content.get('description', '')}. Status: {updated_content.get('status', '')}. Priority: {updated_content.get('priority', '')}."
                metadata = {
                    "name": updated_content["name"],
                    "status": updated_content.get("status"),
                    "priority": updated_content.get("priority"),
                    "budget": updated_content.get("budget")
                }
            elif content_type == "resource":
                skills_text = ", ".join(updated_content.get("skills", []))
                content_text = f"Resource: {updated_content['name']}. Role: {updated_content.get('role', '')}. Skills: {skills_text}. Location: {updated_content.get('location', '')}."
                metadata = {
                    "name": updated_content["name"],
                    "role": updated_content.get("role"),
                    "skills": updated_content.get("skills", []),
                    "location": updated_content.get("location")
                }
            else:
                # Generic content text generation
                content_text = f"{content_type.title()}: {updated_content.get('name', updated_content.get('title', 'Unknown'))}. {updated_content.get('description', '')}"
                metadata = {k: v for k, v in updated_content.items() if k in ['name', 'title', 'status', 'priority']}
            
            # Store updated embedding
            await self.store_content_embedding(content_type, content_id, content_text, metadata)
            return True
            
        except Exception as e:
            logger.error(f"Failed to update content embedding: {e}")
            return False
    
    async def _store_conversation(self, user_id: str, conversation_id: str, 
                                query: str, response: str, sources: List[Dict], 
                                confidence_score: float, operation_id: str = None):
        """Store conversation in database"""
        try:
            self.supabase.table("rag_contexts").insert({
                "user_id": user_id,
                "conversation_id": conversation_id,
                "query": query,
                "response": response,
                "sources": sources,
                "confidence_score": confidence_score,
                "operation_id": operation_id
            }).execute()
        except Exception as e:
            logger.error(f"Failed to store conversation: {e}")

class ResourceOptimizerAgent(AIAgentBase):
    """AI agent for optimizing resource allocation and utilization"""
    
    def __init__(self, supabase_client: Client, openai_api_key: str, base_url: Optional[str] = None):
        super().__init__(supabase_client, openai_api_key, base_url)
        # Use configurable model from environment or default
        import os
        self.optimization_model = os.getenv("OPENAI_MODEL", "gpt-4")
        self.skill_match_threshold = 0.6
        self.utilization_target_min = 60.0
        self.utilization_target_max = 85.0
    
    async def optimize_resources(
        self,
        organization_id: str,
        user_id: str,
        constraints: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Optimize resource allocations using PuLP linear programming.
        
        Args:
            organization_id: Organization ID for filtering data
            user_id: User ID for audit logging
            constraints: Optional constraints for optimization
            
        Returns:
            Dict containing recommendations, confidence scores, and optimization results
        """
        start_time = datetime.now()
        operation_id = None
        
        try:
            # Retrieve resources and projects from Supabase filtered by organization
            resources = await self._get_resources_by_organization(organization_id)
            projects = await self._get_projects_by_organization(organization_id)
            
            # Check for insufficient data
            if not resources:
                error_msg = "No resources found for organization. Please add resources before optimizing."
                await self._log_audit(user_id, organization_id, "optimize_resources", False, error_msg)
                return {
                    "error": error_msg,
                    "recommendations": [],
                    "total_cost_savings": 0.0,
                    "model_confidence": 0.0,
                    "constraints_satisfied": False
                }
            
            if not projects:
                error_msg = "No projects found for organization. Please add projects before optimizing."
                await self._log_audit(user_id, organization_id, "optimize_resources", False, error_msg)
                return {
                    "error": error_msg,
                    "recommendations": [],
                    "total_cost_savings": 0.0,
                    "model_confidence": 0.0,
                    "constraints_satisfied": False
                }
            
            # Build PuLP linear programming model
            model, allocation_vars = self._build_optimization_model(resources, projects, constraints or {})
            
            # Solve the model
            import pulp
            model.solve(pulp.PULP_CBC_CMD(msg=0))  # Silent solver
            
            # Check solution status
            status = pulp.LpStatus[model.status]
            
            if status != "Optimal":
                # Handle infeasible solutions
                error_msg = self._get_infeasibility_message(model, status, constraints)
                await self._log_audit(user_id, organization_id, "optimize_resources", False, error_msg)
                return {
                    "error": error_msg,
                    "recommendations": [],
                    "total_cost_savings": 0.0,
                    "model_confidence": 0.0,
                    "constraints_satisfied": False,
                    "solver_status": status
                }
            
            # Extract recommendations from solved model
            recommendations = self._extract_recommendations(model, allocation_vars, resources, projects)
            
            # Calculate confidence scores based on solution quality
            confidence_score = self._calculate_confidence(model, recommendations)
            
            # Calculate total cost savings
            total_cost_savings = self._calculate_cost_savings(recommendations, resources, projects)
            
            # Log optimization request and results to audit_logs
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            operation_id = await self.log_operation(
                operation_type="optimize_resources",
                user_id=user_id,
                inputs={
                    "organization_id": organization_id,
                    "num_resources": len(resources),
                    "num_projects": len(projects),
                    "constraints": constraints or {}
                },
                outputs={
                    "num_recommendations": len(recommendations),
                    "total_cost_savings": total_cost_savings,
                    "solver_status": status
                },
                response_time_ms=response_time,
                success=True,
                confidence_score=confidence_score
            )
            
            await self._log_audit(
                user_id, 
                organization_id, 
                "optimize_resources", 
                True, 
                None,
                {
                    "num_recommendations": len(recommendations),
                    "total_cost_savings": total_cost_savings,
                    "operation_id": operation_id
                }
            )
            
            return {
                "recommendations": recommendations,
                "total_cost_savings": total_cost_savings,
                "model_confidence": confidence_score,
                "constraints_satisfied": True,
                "solver_status": status,
                "operation_id": operation_id,
                "response_time_ms": response_time
            }
            
        except Exception as e:
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            error_msg = f"Optimization failed: {str(e)}"
            
            # Log error
            operation_id = await self.log_operation(
                operation_type="optimize_resources",
                user_id=user_id,
                inputs={
                    "organization_id": organization_id,
                    "constraints": constraints or {}
                },
                outputs={},
                response_time_ms=response_time,
                success=False,
                error_message=error_msg
            )
            
            await self._log_audit(user_id, organization_id, "optimize_resources", False, error_msg)
            
            logger.error(f"Resource optimization failed: {e}")
            raise
    
    def _build_optimization_model(
        self,
        resources: List[Dict],
        projects: List[Dict],
        constraints: Dict
    ):
        """
        Build linear programming model for resource optimization.
        
        Objective: Minimize total cost = Σ(resource_cost × allocation_hours)
        
        Constraints:
        - Resource availability: Σ(allocations per resource) ≤ available_hours
        - Project requirements: Σ(allocations per project) ≥ required_hours
        - Skill matching: resource_skills ⊇ project_required_skills
        
        Args:
            resources: List of resource dictionaries
            projects: List of project dictionaries
            constraints: Additional constraints
            
        Returns:
            Tuple of (model, allocation_vars)
        """
        import pulp
        
        # Create the model
        model = pulp.LpProblem("Resource_Optimization", pulp.LpMinimize)
        
        # Define decision variables: allocation[resource_id, project_id] = hours allocated
        allocation_vars = {}
        for resource in resources:
            for project in projects:
                var_name = f"alloc_{resource['id']}_{project['id']}"
                allocation_vars[(resource['id'], project['id'])] = pulp.LpVariable(
                    var_name,
                    lowBound=0,
                    cat='Continuous'
                )
        
        # Set objective: minimize Σ(resource_cost × allocation_hours)
        cost_expr = []
        for resource in resources:
            resource_cost = resource.get('hourly_rate', resource.get('cost_per_hour', 100))
            for project in projects:
                var = allocation_vars[(resource['id'], project['id'])]
                cost_expr.append(resource_cost * var)
        
        model += pulp.lpSum(cost_expr), "Total_Cost"
        
        # Add constraints: resource availability
        for resource in resources:
            available_hours = resource.get('available_hours', resource.get('capacity', 160))
            resource_allocations = [
                allocation_vars[(resource['id'], project['id'])]
                for project in projects
            ]
            model += (
                pulp.lpSum(resource_allocations) <= available_hours,
                f"Resource_Availability_{resource['id']}"
            )
        
        # Add constraints: project requirements
        for project in projects:
            required_hours = project.get('required_hours', project.get('estimated_effort', 160))
            project_allocations = [
                allocation_vars[(resource['id'], project['id'])]
                for resource in resources
            ]
            model += (
                pulp.lpSum(project_allocations) >= required_hours,
                f"Project_Requirements_{project['id']}"
            )
        
        # Add constraints: skill matching
        for resource in resources:
            resource_skills = set(resource.get('skills', []))
            for project in projects:
                required_skills = set(project.get('required_skills', []))
                
                # If project requires skills that resource doesn't have, set allocation to 0
                if required_skills and not required_skills.issubset(resource_skills):
                    model += (
                        allocation_vars[(resource['id'], project['id'])] == 0,
                        f"Skill_Match_{resource['id']}_{project['id']}"
                    )
        
        # Add custom constraints if provided
        if constraints.get('max_allocation_per_resource'):
            max_alloc = constraints['max_allocation_per_resource']
            for resource in resources:
                for project in projects:
                    model += (
                        allocation_vars[(resource['id'], project['id'])] <= max_alloc,
                        f"Max_Allocation_{resource['id']}_{project['id']}"
                    )
        
        if constraints.get('min_allocation_per_project'):
            min_alloc = constraints['min_allocation_per_project']
            for project in projects:
                for resource in resources:
                    var = allocation_vars[(resource['id'], project['id'])]
                    # If allocated, must be at least min_alloc
                    # This is a simplified version; proper implementation would use binary variables
                    pass  # Skip for now as it requires binary variables
        
        return model, allocation_vars
    
    def _extract_recommendations(
        self,
        model,
        allocation_vars: Dict,
        resources: List[Dict],
        projects: List[Dict]
    ) -> List[Dict]:
        """
        Extract recommendations from solved optimization model.
        
        Args:
            model: Solved PuLP model
            allocation_vars: Dictionary of allocation variables
            resources: List of resources
            projects: List of projects
            
        Returns:
            List of recommendation dictionaries
        """
        recommendations = []
        
        for resource in resources:
            for project in projects:
                var = allocation_vars[(resource['id'], project['id'])]
                allocated_hours = var.varValue
                
                if allocated_hours and allocated_hours > 0:
                    resource_cost = resource.get('hourly_rate', resource.get('cost_per_hour', 100))
                    total_cost = allocated_hours * resource_cost
                    
                    # Calculate cost savings compared to average cost
                    avg_cost = sum(r.get('hourly_rate', r.get('cost_per_hour', 100)) for r in resources) / len(resources)
                    cost_savings = (avg_cost - resource_cost) * allocated_hours
                    
                    recommendations.append({
                        "resource_id": resource['id'],
                        "resource_name": resource.get('name', 'Unknown'),
                        "project_id": project['id'],
                        "project_name": project.get('name', 'Unknown'),
                        "allocated_hours": round(allocated_hours, 2),
                        "cost_savings": round(cost_savings, 2),
                        "total_cost": round(total_cost, 2),
                        "confidence": 0.0  # Will be calculated separately
                    })
        
        return recommendations
    
    def _calculate_confidence(
        self,
        model,
        recommendations: List[Dict]
    ) -> float:
        """
        Calculate confidence score based on solution quality.
        
        Confidence levels:
        - 1.0: Optimal solution with all constraints satisfied
        - 0.8: Optimal solution with some constraints relaxed
        - 0.6: Feasible solution found but not optimal
        - 0.4: Partial solution with constraint violations
        - 0.0: No feasible solution
        
        Args:
            model: Solved PuLP model
            recommendations: List of recommendations
            
        Returns:
            Confidence score between 0.0 and 1.0
        """
        import pulp
        
        status = pulp.LpStatus[model.status]
        
        if status == "Optimal":
            # Check if all constraints are satisfied
            # For now, assume optimal means all constraints satisfied
            confidence = 1.0
            
            # Adjust based on number of recommendations
            if len(recommendations) == 0:
                confidence = 0.5
            elif len(recommendations) < 3:
                confidence = 0.9
            
            return confidence
        elif status == "Feasible":
            return 0.6
        elif status == "Infeasible":
            return 0.0
        else:
            return 0.4
    
    def _calculate_cost_savings(
        self,
        recommendations: List[Dict],
        resources: List[Dict],
        projects: List[Dict]
    ) -> float:
        """
        Calculate total cost savings from optimization.
        
        Args:
            recommendations: List of recommendations
            resources: List of resources
            projects: List of projects
            
        Returns:
            Total cost savings
        """
        total_savings = sum(rec.get('cost_savings', 0) for rec in recommendations)
        return round(total_savings, 2)
    
    def _get_infeasibility_message(
        self,
        model,
        status: str,
        constraints: Dict
    ) -> str:
        """
        Generate user-friendly error message for infeasible solutions.
        
        Args:
            model: PuLP model
            status: Solver status
            constraints: Applied constraints
            
        Returns:
            Error message explaining infeasibility
        """
        if status == "Infeasible":
            messages = ["Cannot find feasible resource allocation. Possible reasons:"]
            
            if constraints and constraints.get('required_skills'):
                messages.append("- Required skills not available in resource pool")
            
            messages.append("- Project requirements exceed available resource capacity")
            messages.append("- Skill matching constraints too restrictive")
            messages.append("\nSuggestions:")
            messages.append("- Add more resources to the pool")
            messages.append("- Reduce project requirements")
            messages.append("- Relax skill matching constraints")
            messages.append("- Extend project timelines")
            
            return "\n".join(messages)
        elif status == "Unbounded":
            return "Optimization problem is unbounded. Please check constraints."
        elif status == "Undefined":
            return "Optimization problem is undefined. Please check input data."
        else:
            return f"Optimization failed with status: {status}"
    
    async def _get_resources_by_organization(self, organization_id: str) -> List[Dict]:
        """
        Retrieve resources from Supabase filtered by organization.
        
        Args:
            organization_id: Organization ID
            
        Returns:
            List of resource dictionaries
        """
        try:
            response = self.supabase.table("resources").select("*").eq(
                "organization_id", organization_id
            ).execute()
            
            resources = response.data or []
            
            # Enhance resources with calculated fields
            for resource in resources:
                # Ensure skills is a list
                if not isinstance(resource.get('skills'), list):
                    resource['skills'] = []
                
                # Calculate available hours (default to 160 hours/month if not specified)
                resource['available_hours'] = resource.get('capacity', 160)
                
                # Get hourly rate (default to 100 if not specified)
                if 'hourly_rate' not in resource and 'cost_per_hour' not in resource:
                    resource['hourly_rate'] = 100
            
            return resources
            
        except Exception as e:
            logger.error(f"Failed to get resources by organization: {e}")
            return []
    
    async def _get_projects_by_organization(self, organization_id: str) -> List[Dict]:
        """
        Retrieve projects from Supabase filtered by organization.
        
        Args:
            organization_id: Organization ID
            
        Returns:
            List of project dictionaries
        """
        try:
            response = self.supabase.table("projects").select("*").eq(
                "organization_id", organization_id
            ).execute()
            
            projects = response.data or []
            
            # Enhance projects with calculated fields
            for project in projects:
                # Infer required skills if not specified
                if 'required_skills' not in project:
                    project['required_skills'] = self._infer_required_skills(project)
                
                # Estimate required hours if not specified
                if 'required_hours' not in project and 'estimated_effort' not in project:
                    project['required_hours'] = self._estimate_project_effort(project)
            
            return projects
            
        except Exception as e:
            logger.error(f"Failed to get projects by organization: {e}")
            return []
    
    async def _log_audit(
        self,
        user_id: str,
        organization_id: str,
        action: str,
        success: bool,
        error_message: Optional[str] = None,
        details: Optional[Dict] = None
    ):
        """
        Log operation to audit_logs table.
        
        Args:
            user_id: User ID
            organization_id: Organization ID
            action: Action performed
            success: Whether operation succeeded
            error_message: Error message if failed
            details: Additional details
        """
        try:
            self.supabase.table("audit_logs").insert({
                "user_id": user_id,
                "organization_id": organization_id,
                "action": action,
                "success": success,
                "error_message": error_message,
                "details": details or {},
                "created_at": datetime.now().isoformat()
            }).execute()
        except Exception as e:
            logger.error(f"Failed to log audit: {e}")
    
    async def analyze_resource_allocation(self, user_id: str, project_id: str = None) -> Dict[str, Any]:
        """Analyze current resource allocation and suggest optimizations"""
        start_time = datetime.now()
        
        try:
            # Get comprehensive resource data
            resources_data = await self._get_resources_with_skills()
            
            # Get project requirements and current allocations
            requirements_data = await self._get_project_requirements(project_id)
            current_allocations = await self._get_current_allocations(project_id)
            
            # Get availability data
            availability_data = await self._get_resource_availability()
            
            # Perform skill matching analysis
            skill_matches = await self._analyze_skill_matching(resources_data, requirements_data)
            
            # Detect allocation conflicts
            conflicts = await self._detect_allocation_conflicts(current_allocations, availability_data)
            
            # Generate optimization recommendations
            optimization_results = await self._generate_optimization_recommendations(
                resources_data, requirements_data, availability_data, skill_matches, conflicts
            )
            
            # Calculate confidence scores for recommendations
            optimization_results = await self._calculate_recommendation_confidence(optimization_results)
            
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            
            # Log metrics
            await self.log_metrics(
                "resource_optimization", user_id, 0, 0, response_time, True, None,
                optimization_results.get('overall_confidence', 0.0)
            )
            
            return optimization_results
            
        except Exception as e:
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            await self.log_metrics(
                "resource_optimization", user_id, 0, 0, response_time, False, str(e)
            )
            logger.error(f"Resource optimization failed: {e}")
            raise
    
    async def detect_resource_conflicts(self, user_id: str) -> Dict[str, Any]:
        """Detect conflicts in resource allocations across projects"""
        try:
            current_allocations = await self._get_current_allocations()
            availability_data = await self._get_resource_availability()
            
            conflicts = await self._detect_allocation_conflicts(current_allocations, availability_data)
            
            return {
                "conflicts": conflicts,
                "total_conflicts": len(conflicts),
                "critical_conflicts": len([c for c in conflicts if c.get("severity") == "critical"]),
                "resolution_suggestions": await self._generate_conflict_resolutions(conflicts)
            }
            
        except Exception as e:
            logger.error(f"Conflict detection failed: {e}")
            raise
    
    async def optimize_for_constraints(self, constraints: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """Optimize resource allocation based on specific constraints"""
        try:
            resources_data = await self._get_resources_with_skills()
            requirements_data = await self._get_project_requirements()
            
            # Apply constraints to optimization
            constrained_optimization = await self._apply_optimization_constraints(
                resources_data, requirements_data, constraints
            )
            
            return constrained_optimization
            
        except Exception as e:
            logger.error(f"Constrained optimization failed: {e}")
            raise
    
    async def _get_resources_with_skills(self) -> List[Dict]:
        """Get all resources with their skills and current allocations"""
        try:
            # Get resources
            resources_response = self.supabase.table("resources").select("*").execute()
            resources = resources_response.data or []
            
            # Enhance each resource with additional data
            for resource in resources:
                # Get current project allocations
                allocations_response = self.supabase.table("project_resources").select(
                    "project_id, allocation_percentage, role_in_project"
                ).eq("resource_id", resource["id"]).execute()
                
                resource["current_allocations"] = allocations_response.data or []
                
                # Calculate current utilization
                total_allocation = sum(alloc.get("allocation_percentage", 0) for alloc in resource["current_allocations"])
                resource["current_utilization"] = min(total_allocation, 100)
                resource["available_capacity"] = max(0, 100 - total_allocation)
                
                # Ensure skills is a list
                if not isinstance(resource.get("skills"), list):
                    resource["skills"] = []
            
            return resources
        except Exception as e:
            logger.error(f"Failed to get resources with skills: {e}")
            return []
    
    async def _get_project_requirements(self, project_id: str = None) -> List[Dict]:
        """Get project skill requirements and resource needs"""
        try:
            # Get projects
            query = self.supabase.table("projects").select("*")
            if project_id:
                query = query.eq("id", project_id)
            
            projects_response = query.execute()
            projects = projects_response.data or []
            
            requirements = []
            for project in projects:
                # Generate requirements based on project data
                project_req = {
                    "project_id": project["id"],
                    "project_name": project["name"],
                    "status": project.get("status", "active"),
                    "priority": project.get("priority", "medium"),
                    "required_skills": self._infer_required_skills(project),
                    "estimated_effort": self._estimate_project_effort(project),
                    "deadline": project.get("end_date"),
                    "current_team_size": len(project.get("team_members", []))
                }
                requirements.append(project_req)
            
            return requirements
        except Exception as e:
            logger.error(f"Failed to get project requirements: {e}")
            return []
    
    async def _get_current_allocations(self, project_id: str = None) -> List[Dict]:
        """Get current resource allocations across projects"""
        try:
            query = self.supabase.table("project_resources").select(
                "*, projects(name, status, priority), resources(name, capacity)"
            )
            if project_id:
                query = query.eq("project_id", project_id)
            
            response = query.execute()
            return response.data or []
        except Exception as e:
            logger.error(f"Failed to get current allocations: {e}")
            return []
    
    async def _get_resource_availability(self) -> List[Dict]:
        """Get resource availability for the next 30 days"""
        try:
            start_date = datetime.now().date()
            end_date = start_date + timedelta(days=30)
            
            # Get all resources and calculate their availability
            resources_response = self.supabase.table("resources").select("*").execute()
            resources = resources_response.data or []
            
            availability_data = []
            for resource in resources:
                # Calculate availability based on capacity and current allocations
                capacity_hours = resource.get("capacity", 40)
                availability_percentage = resource.get("availability", 100)
                effective_capacity = capacity_hours * (availability_percentage / 100)
                
                # Get current allocations
                allocations_response = self.supabase.table("project_resources").select(
                    "allocation_percentage"
                ).eq("resource_id", resource["id"]).execute()
                
                total_allocated_percentage = sum(
                    alloc.get("allocation_percentage", 0) 
                    for alloc in allocations_response.data or []
                )
                
                allocated_hours = effective_capacity * (total_allocated_percentage / 100)
                available_hours = max(0, effective_capacity - allocated_hours)
                
                availability_data.append({
                    "resource_id": resource["id"],
                    "resource_name": resource["name"],
                    "total_capacity_hours": capacity_hours,
                    "effective_capacity_hours": effective_capacity,
                    "allocated_hours": allocated_hours,
                    "available_hours": available_hours,
                    "utilization_percentage": min(100, total_allocated_percentage),
                    "availability_status": self._determine_availability_status(total_allocated_percentage)
                })
            
            return availability_data
        except Exception as e:
            logger.error(f"Failed to get resource availability: {e}")
            return []
    
    async def _analyze_skill_matching(self, resources: List[Dict], requirements: List[Dict]) -> List[Dict]:
        """Analyze skill matching between resources and project requirements"""
        try:
            skill_matches = []
            
            for requirement in requirements:
                required_skills = requirement.get("required_skills", [])
                if not required_skills:
                    continue
                
                project_matches = []
                for resource in resources:
                    resource_skills = resource.get("skills", [])
                    
                    # Calculate skill match score
                    match_score = self._calculate_skill_match_score(required_skills, resource_skills)
                    
                    if match_score >= self.skill_match_threshold:
                        project_matches.append({
                            "resource_id": resource["id"],
                            "resource_name": resource["name"],
                            "match_score": match_score,
                            "matching_skills": self._get_matching_skills(required_skills, resource_skills),
                            "missing_skills": self._get_missing_skills(required_skills, resource_skills),
                            "current_utilization": resource.get("current_utilization", 0),
                            "available_capacity": resource.get("available_capacity", 0)
                        })
                
                # Sort by match score and availability
                project_matches.sort(key=lambda x: (x["match_score"], x["available_capacity"]), reverse=True)
                
                skill_matches.append({
                    "project_id": requirement["project_id"],
                    "project_name": requirement["project_name"],
                    "required_skills": required_skills,
                    "matching_resources": project_matches[:5],  # Top 5 matches
                    "total_matches": len(project_matches)
                })
            
            return skill_matches
        except Exception as e:
            logger.error(f"Skill matching analysis failed: {e}")
            return []
    
    async def _detect_allocation_conflicts(self, allocations: List[Dict], availability: List[Dict]) -> List[Dict]:
        """Detect conflicts in resource allocations"""
        try:
            conflicts = []
            
            # Group allocations by resource
            resource_allocations = {}
            for allocation in allocations:
                resource_id = allocation["resource_id"]
                if resource_id not in resource_allocations:
                    resource_allocations[resource_id] = []
                resource_allocations[resource_id].append(allocation)
            
            # Check each resource for conflicts
            for resource_id, resource_allocs in resource_allocations.items():
                # Find availability data for this resource
                resource_availability = next(
                    (av for av in availability if av["resource_id"] == resource_id), 
                    None
                )
                
                if not resource_availability:
                    continue
                
                total_allocation = sum(alloc.get("allocation_percentage", 0) for alloc in resource_allocs)
                utilization = resource_availability.get("utilization_percentage", 0)
                
                # Detect over-allocation
                if total_allocation > 100:
                    conflicts.append({
                        "type": "over_allocation",
                        "resource_id": resource_id,
                        "resource_name": resource_availability["resource_name"],
                        "total_allocation": total_allocation,
                        "over_allocation": total_allocation - 100,
                        "affected_projects": [alloc["project_id"] for alloc in resource_allocs],
                        "severity": "critical" if total_allocation > 120 else "high",
                        "description": f"Resource over-allocated by {total_allocation - 100:.1f}%"
                    })
                
                # Detect scheduling conflicts (same time periods)
                time_conflicts = self._detect_time_conflicts(resource_allocs)
                for conflict in time_conflicts:
                    conflicts.append({
                        "type": "time_conflict",
                        "resource_id": resource_id,
                        "resource_name": resource_availability["resource_name"],
                        "conflicting_projects": conflict["projects"],
                        "time_period": conflict["period"],
                        "severity": "medium",
                        "description": f"Scheduling conflict between projects during {conflict['period']}"
                    })
                
                # Detect skill mismatches
                skill_conflicts = await self._detect_skill_conflicts(resource_id, resource_allocs)
                conflicts.extend(skill_conflicts)
            
            return conflicts
        except Exception as e:
            logger.error(f"Conflict detection failed: {e}")
            return []
    
    async def _generate_optimization_recommendations(self, resources: List[Dict], requirements: List[Dict], 
                                                   availability: List[Dict], skill_matches: List[Dict], 
                                                   conflicts: List[Dict]) -> Dict[str, Any]:
        """Generate comprehensive optimization recommendations"""
        try:
            recommendations = []
            
            # Generate recommendations based on utilization
            for resource_avail in availability:
                utilization = resource_avail["utilization_percentage"]
                resource_id = resource_avail["resource_id"]
                resource_name = resource_avail["resource_name"]
                
                if utilization < self.utilization_target_min:
                    # Under-utilized resource
                    recommendations.append({
                        "type": "increase_utilization",
                        "resource_id": resource_id,
                        "resource_name": resource_name,
                        "current_utilization": utilization,
                        "target_utilization": self.utilization_target_min,
                        "available_hours": resource_avail["available_hours"],
                        "priority": "medium",
                        "reasoning": f"Resource is under-utilized at {utilization:.1f}%. Consider allocating additional work.",
                        "suggested_actions": [
                            f"Allocate {self.utilization_target_min - utilization:.1f}% more work",
                            "Review upcoming project needs",
                            "Consider cross-training opportunities"
                        ]
                    })
                
                elif utilization > self.utilization_target_max:
                    # Over-utilized resource
                    recommendations.append({
                        "type": "reduce_utilization",
                        "resource_id": resource_id,
                        "resource_name": resource_name,
                        "current_utilization": utilization,
                        "target_utilization": self.utilization_target_max,
                        "over_allocation": utilization - self.utilization_target_max,
                        "priority": "high" if utilization > 100 else "medium",
                        "reasoning": f"Resource is over-utilized at {utilization:.1f}%. Risk of burnout and quality issues.",
                        "suggested_actions": [
                            f"Reduce allocation by {utilization - self.utilization_target_max:.1f}%",
                            "Redistribute work to other team members",
                            "Consider hiring additional resources"
                        ]
                    })
            
            # Generate skill-based recommendations
            for skill_match in skill_matches:
                if skill_match["matching_resources"]:
                    best_match = skill_match["matching_resources"][0]
                    
                    recommendations.append({
                        "type": "skill_optimization",
                        "project_id": skill_match["project_id"],
                        "project_name": skill_match["project_name"],
                        "recommended_resource_id": best_match["resource_id"],
                        "recommended_resource_name": best_match["resource_name"],
                        "match_score": best_match["match_score"],
                        "matching_skills": best_match["matching_skills"],
                        "priority": "high",
                        "reasoning": f"Excellent skill match ({best_match['match_score']:.2f}) for {skill_match['project_name']}",
                        "suggested_actions": [
                            f"Assign {best_match['resource_name']} to {skill_match['project_name']}",
                            "Leverage matching skills: " + ", ".join(best_match["matching_skills"]),
                            "Provide training for missing skills if needed"
                        ]
                    })
            
            # Generate conflict resolution recommendations
            for conflict in conflicts:
                if conflict["type"] == "over_allocation":
                    recommendations.append({
                        "type": "resolve_conflict",
                        "conflict_type": "over_allocation",
                        "resource_id": conflict["resource_id"],
                        "resource_name": conflict["resource_name"],
                        "priority": "critical",
                        "reasoning": f"Resource over-allocated by {conflict['over_allocation']:.1f}%",
                        "suggested_actions": [
                            "Redistribute work among team members",
                            "Extend project timelines if possible",
                            "Hire temporary contractors",
                            "Reduce project scope"
                        ]
                    })
            
            # Calculate overall metrics
            total_utilization = sum(av["utilization_percentage"] for av in availability)
            avg_utilization = total_utilization / len(availability) if availability else 0
            
            return {
                "recommendations": recommendations,
                "conflicts": conflicts,
                "skill_matches": skill_matches,
                "summary": {
                    "total_recommendations": len(recommendations),
                    "high_priority": len([r for r in recommendations if r["priority"] == "high"]),
                    "critical_priority": len([r for r in recommendations if r["priority"] == "critical"]),
                    "avg_utilization": round(avg_utilization, 1),
                    "total_conflicts": len(conflicts),
                    "optimization_potential": self._calculate_optimization_potential(recommendations)
                }
            }
            
        except Exception as e:
            logger.error(f"Recommendation generation failed: {e}")
            return {"recommendations": [], "conflicts": [], "skill_matches": [], "summary": {}}
    
    async def _calculate_recommendation_confidence(self, optimization_results: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate confidence scores for optimization recommendations"""
        try:
            recommendations = optimization_results.get("recommendations", [])
            
            for recommendation in recommendations:
                confidence_factors = []
                
                # Base confidence on recommendation type
                type_confidence = {
                    "increase_utilization": 0.8,
                    "reduce_utilization": 0.9,
                    "skill_optimization": 0.85,
                    "resolve_conflict": 0.95
                }.get(recommendation["type"], 0.7)
                confidence_factors.append(type_confidence)
                
                # Adjust based on data quality
                if recommendation.get("match_score"):
                    confidence_factors.append(recommendation["match_score"])
                
                # Adjust based on utilization data
                if recommendation.get("current_utilization"):
                    util = recommendation["current_utilization"]
                    if util < 50 or util > 90:
                        confidence_factors.append(0.9)  # High confidence for extreme cases
                    else:
                        confidence_factors.append(0.7)  # Medium confidence for moderate cases
                
                # Calculate final confidence score
                recommendation["confidence_score"] = sum(confidence_factors) / len(confidence_factors)
                recommendation["confidence_level"] = self._get_confidence_level(recommendation["confidence_score"])
            
            # Calculate overall confidence
            if recommendations:
                overall_confidence = sum(r["confidence_score"] for r in recommendations) / len(recommendations)
            else:
                overall_confidence = 0.0
            
            optimization_results["overall_confidence"] = overall_confidence
            optimization_results["confidence_level"] = self._get_confidence_level(overall_confidence)
            
            return optimization_results
            
        except Exception as e:
            logger.error(f"Confidence calculation failed: {e}")
            return optimization_results
    
    async def _optimize_allocation(self, resources: List[Dict], requirements: List[Dict], 
                                 availability: List[Dict]) -> Dict[str, Any]:
        """Perform resource allocation optimization"""
        try:
            suggestions = []
            utilization_analysis = {}
            
            # Calculate current utilization
            for resource in resources:
                resource_id = resource["id"]
                resource_availability = [a for a in availability if a["resource_id"] == resource_id]
                
                total_available = sum(a["available_hours"] for a in resource_availability)
                total_allocated = sum(a["allocated_hours"] for a in resource_availability)
                
                utilization = (total_allocated / total_available * 100) if total_available > 0 else 0
                
                utilization_analysis[resource_id] = {
                    "resource_name": resource["name"],
                    "utilization_percent": round(utilization, 1),
                    "available_hours": total_available - total_allocated,
                    "skills": [s["skill_name"] for s in resource.get("skills", [])]
                }
                
                # Generate suggestions based on utilization
                if utilization < 60:  # Under-utilized
                    suggestions.append({
                        "type": "underutilized",
                        "resource_id": resource_id,
                        "resource_name": resource["name"],
                        "current_utilization": round(utilization, 1),
                        "available_hours": total_available - total_allocated,
                        "recommendation": f"Consider allocating more work to {resource['name']} who has {total_available - total_allocated:.1f} available hours",
                        "priority": "medium"
                    })
                elif utilization > 90:  # Over-utilized
                    suggestions.append({
                        "type": "overutilized",
                        "resource_id": resource_id,
                        "resource_name": resource["name"],
                        "current_utilization": round(utilization, 1),
                        "recommendation": f"{resource['name']} is over-allocated. Consider redistributing {total_allocated - total_available:.1f} hours",
                        "priority": "high"
                    })
            
            # Skill matching suggestions
            for requirement in requirements:
                matching_resources = []
                for resource in resources:
                    resource_skills = [s["skill_name"] for s in resource.get("skills", [])]
                    if requirement["skill_name"] in resource_skills:
                        skill_data = next((s for s in resource.get("skills", []) if s["skill_name"] == requirement["skill_name"]), None)
                        if skill_data and skill_data["proficiency_level"] >= requirement["required_level"]:
                            matching_resources.append({
                                "resource_id": resource["id"],
                                "resource_name": resource["name"],
                                "proficiency": skill_data["proficiency_level"],
                                "utilization": utilization_analysis.get(resource["id"], {}).get("utilization_percent", 0)
                            })
                
                if matching_resources:
                    # Sort by proficiency and availability
                    matching_resources.sort(key=lambda x: (x["proficiency"], -x["utilization"]), reverse=True)
                    best_match = matching_resources[0]
                    
                    suggestions.append({
                        "type": "skill_match",
                        "requirement": requirement["skill_name"],
                        "project_id": requirement["project_id"],
                        "recommended_resource": best_match["resource_name"],
                        "resource_id": best_match["resource_id"],
                        "match_score": best_match["proficiency"] / 5.0,
                        "recommendation": f"Assign {best_match['resource_name']} to {requirement['skill_name']} tasks (proficiency: {best_match['proficiency']}/5)",
                        "priority": "high" if requirement["priority"] == "critical" else "medium"
                    })
            
            return {
                "suggestions": suggestions,
                "utilization_analysis": utilization_analysis,
                "summary": {
                    "total_suggestions": len(suggestions),
                    "high_priority": len([s for s in suggestions if s["priority"] == "high"]),
                    "avg_utilization": round(sum(u["utilization_percent"] for u in utilization_analysis.values()) / len(utilization_analysis), 1) if utilization_analysis else 0
                }
            }
            
        except Exception as e:
            logger.error(f"Optimization analysis failed: {e}")
            return {"suggestions": [], "utilization_analysis": {}, "summary": {}}
    
    # Helper methods for enhanced functionality
    def _infer_required_skills(self, project: Dict) -> List[str]:
        """Infer required skills based on project data"""
        # This is a simplified implementation - in production, use ML/NLP
        project_name = project.get("name", "").lower()
        description = project.get("description", "").lower()
        
        skill_keywords = {
            "python": ["python", "django", "flask", "fastapi"],
            "javascript": ["javascript", "js", "react", "vue", "angular", "node"],
            "typescript": ["typescript", "ts"],
            "java": ["java", "spring", "hibernate"],
            "sql": ["sql", "database", "mysql", "postgresql"],
            "aws": ["aws", "cloud", "ec2", "s3"],
            "docker": ["docker", "container", "kubernetes"],
            "ui/ux": ["ui", "ux", "design", "figma"],
            "project management": ["project", "management", "scrum", "agile"]
        }
        
        inferred_skills = []
        text = f"{project_name} {description}"
        
        for skill, keywords in skill_keywords.items():
            if any(keyword in text for keyword in keywords):
                inferred_skills.append(skill)
        
        return inferred_skills or ["general"]
    
    def _estimate_project_effort(self, project: Dict) -> int:
        """Estimate project effort in person-hours"""
        # Simplified estimation based on project data
        base_effort = 160  # 4 weeks * 40 hours
        
        # Adjust based on project complexity indicators
        if project.get("priority") == "high":
            base_effort *= 1.5
        
        team_size = len(project.get("team_members", []))
        if team_size > 0:
            base_effort = base_effort * team_size
        
        return int(base_effort)
    
    def _determine_availability_status(self, utilization_percentage: float) -> str:
        """Determine availability status based on utilization"""
        if utilization_percentage >= 100:
            return "fully_allocated"
        elif utilization_percentage >= 80:
            return "mostly_allocated"
        elif utilization_percentage >= 50:
            return "partially_allocated"
        else:
            return "available"
    
    def _calculate_skill_match_score(self, required_skills: List[str], resource_skills: List[str]) -> float:
        """Calculate skill match score between required and available skills"""
        if not required_skills:
            return 1.0
        
        # Normalize skills to lowercase for comparison
        required_normalized = [skill.lower() for skill in required_skills]
        resource_normalized = [skill.lower() for skill in resource_skills]
        
        # Calculate exact matches
        exact_matches = len(set(required_normalized) & set(resource_normalized))
        
        # Calculate partial matches (substring matching)
        partial_matches = 0
        for req_skill in required_normalized:
            for res_skill in resource_normalized:
                if req_skill in res_skill or res_skill in req_skill:
                    partial_matches += 0.5
                    break
        
        # Calculate final score
        total_matches = exact_matches + partial_matches
        match_score = min(total_matches / len(required_skills), 1.0)
        
        return round(match_score, 2)
    
    def _get_matching_skills(self, required_skills: List[str], resource_skills: List[str]) -> List[str]:
        """Get list of matching skills"""
        required_normalized = [skill.lower() for skill in required_skills]
        resource_normalized = [skill.lower() for skill in resource_skills]
        
        matches = []
        for req_skill in required_skills:
            if req_skill.lower() in resource_normalized:
                matches.append(req_skill)
        
        return matches
    
    def _get_missing_skills(self, required_skills: List[str], resource_skills: List[str]) -> List[str]:
        """Get list of missing skills"""
        required_normalized = [skill.lower() for skill in required_skills]
        resource_normalized = [skill.lower() for skill in resource_skills]
        
        missing = []
        for req_skill in required_skills:
            if req_skill.lower() not in resource_normalized:
                missing.append(req_skill)
        
        return missing
    
    def _detect_time_conflicts(self, allocations: List[Dict]) -> List[Dict]:
        """Detect time-based conflicts in allocations"""
        # Simplified implementation - in production, use actual scheduling data
        conflicts = []
        
        if len(allocations) > 1:
            # Assume conflict if multiple high-priority projects
            high_priority_projects = [
                alloc for alloc in allocations 
                if alloc.get("projects", {}).get("priority") == "high"
            ]
            
            if len(high_priority_projects) > 1:
                conflicts.append({
                    "projects": [alloc["project_id"] for alloc in high_priority_projects],
                    "period": "current_sprint",
                    "type": "priority_conflict"
                })
        
        return conflicts
    
    async def _detect_skill_conflicts(self, resource_id: str, allocations: List[Dict]) -> List[Dict]:
        """Detect skill-based conflicts for a resource"""
        conflicts = []
        
        try:
            # Get resource skills
            resource_response = self.supabase.table("resources").select("skills").eq("id", resource_id).execute()
            if not resource_response.data:
                return conflicts
            
            resource_skills = resource_response.data[0].get("skills", [])
            
            # Check if resource has skills for all allocated projects
            for allocation in allocations:
                project_id = allocation["project_id"]
                
                # Get project requirements (simplified)
                project_response = self.supabase.table("projects").select("*").eq("id", project_id).execute()
                if project_response.data:
                    project = project_response.data[0]
                    required_skills = self._infer_required_skills(project)
                    
                    match_score = self._calculate_skill_match_score(required_skills, resource_skills)
                    
                    if match_score < self.skill_match_threshold:
                        conflicts.append({
                            "type": "skill_mismatch",
                            "resource_id": resource_id,
                            "project_id": project_id,
                            "required_skills": required_skills,
                            "match_score": match_score,
                            "severity": "medium",
                            "description": f"Low skill match ({match_score:.2f}) for project requirements"
                        })
            
        except Exception as e:
            logger.error(f"Skill conflict detection failed: {e}")
        
        return conflicts
    
    async def _generate_conflict_resolutions(self, conflicts: List[Dict]) -> List[Dict]:
        """Generate resolution suggestions for conflicts"""
        resolutions = []
        
        for conflict in conflicts:
            if conflict["type"] == "over_allocation":
                resolutions.append({
                    "conflict_id": f"{conflict['resource_id']}_over_allocation",
                    "resolution_type": "redistribute_work",
                    "description": "Redistribute work to other team members",
                    "steps": [
                        "Identify tasks that can be reassigned",
                        "Find available team members with matching skills",
                        "Update project allocations",
                        "Communicate changes to stakeholders"
                    ],
                    "estimated_effort": "2-4 hours",
                    "priority": conflict["severity"]
                })
            
            elif conflict["type"] == "skill_mismatch":
                resolutions.append({
                    "conflict_id": f"{conflict['resource_id']}_skill_mismatch",
                    "resolution_type": "skill_development",
                    "description": "Provide training or reassign to better-matched resource",
                    "steps": [
                        "Assess training requirements",
                        "Provide skill development opportunities",
                        "Consider pairing with experienced team member",
                        "Monitor progress and adjust as needed"
                    ],
                    "estimated_effort": "1-2 weeks",
                    "priority": "medium"
                })
        
        return resolutions
    
    async def _apply_optimization_constraints(self, resources: List[Dict], requirements: List[Dict], 
                                            constraints: Dict[str, Any]) -> Dict[str, Any]:
        """Apply specific constraints to optimization"""
        try:
            # Filter resources based on constraints
            filtered_resources = resources.copy()
            
            if constraints.get("required_skills"):
                filtered_resources = [
                    r for r in filtered_resources 
                    if any(skill in r.get("skills", []) for skill in constraints["required_skills"])
                ]
            
            if constraints.get("max_utilization"):
                max_util = constraints["max_utilization"]
                filtered_resources = [
                    r for r in filtered_resources 
                    if r.get("current_utilization", 0) <= max_util
                ]
            
            if constraints.get("min_availability"):
                min_avail = constraints["min_availability"]
                filtered_resources = [
                    r for r in filtered_resources 
                    if r.get("availability", 0) >= min_avail
                ]
            
            if constraints.get("location"):
                filtered_resources = [
                    r for r in filtered_resources 
                    if r.get("location") == constraints["location"]
                ]
            
            # Generate constrained recommendations
            constrained_recommendations = []
            for resource in filtered_resources:
                if resource.get("available_capacity", 0) > 0:
                    constrained_recommendations.append({
                        "resource_id": resource["id"],
                        "resource_name": resource["name"],
                        "available_capacity": resource["available_capacity"],
                        "skills": resource.get("skills", []),
                        "location": resource.get("location"),
                        "recommendation": f"Available for allocation with {resource['available_capacity']:.1f}% capacity"
                    })
            
            return {
                "constrained_resources": constrained_recommendations,
                "applied_constraints": constraints,
                "total_available_resources": len(constrained_recommendations)
            }
            
        except Exception as e:
            logger.error(f"Constraint application failed: {e}")
            return {"constrained_resources": [], "applied_constraints": constraints}
    
    def _calculate_optimization_potential(self, recommendations: List[Dict]) -> float:
        """Calculate the potential improvement from optimization"""
        if not recommendations:
            return 0.0
        
        # Calculate potential based on recommendation types and priorities
        potential_score = 0.0
        
        for rec in recommendations:
            if rec["priority"] == "critical":
                potential_score += 0.3
            elif rec["priority"] == "high":
                potential_score += 0.2
            elif rec["priority"] == "medium":
                potential_score += 0.1
        
        # Normalize to 0-1 scale
        max_possible_score = len(recommendations) * 0.3
        if max_possible_score > 0:
            potential_score = min(potential_score / max_possible_score, 1.0)
        
        return round(potential_score, 2)
    
    def _get_confidence_level(self, confidence_score: float) -> str:
        """Convert confidence score to descriptive level"""
        if confidence_score >= 0.8:
            return "high"
        elif confidence_score >= 0.6:
            return "medium"
        else:
            return "low"

class RiskForecasterAgent(AIAgentBase):
    """AI agent for forecasting project risks using ARIMA time series analysis"""
    
    def __init__(self, supabase_client: Client, openai_api_key: str, base_url: Optional[str] = None):
        super().__init__(supabase_client, openai_api_key, base_url)
        self.min_data_points = 10
        
        # Import pandas and statsmodels for time series analysis
        try:
            import pandas as pd
            from statsmodels.tsa.arima.model import ARIMA
            from statsmodels.tsa.stattools import adfuller
            self.pd = pd
            self.ARIMA = ARIMA
            self.adfuller = adfuller
        except ImportError as e:
            logger.error(f"Required libraries not available: {e}")
            raise ImportError("pandas and statsmodels are required for RiskForecasterAgent")
    
    async def forecast_risks(
        self,
        organization_id: str,
        user_id: str,
        project_id: Optional[str] = None,
        forecast_periods: int = 12
    ) -> Dict[str, Any]:
        """
        Forecast risks using ARIMA time series analysis
        
        Args:
            organization_id: Organization ID for filtering
            user_id: User ID for audit logging
            project_id: Optional specific project ID
            forecast_periods: Number of periods to forecast (default 12)
            
        Returns:
            Dictionary containing forecasts, model confidence, and metrics
        """
        start_time = datetime.now()
        
        try:
            # Retrieve historical risk data filtered by organization
            risk_data = await self._retrieve_historical_risks(organization_id, project_id)
            
            # Check for minimum data points
            if len(risk_data) < self.min_data_points:
                error_msg = f"Insufficient historical data. Minimum {self.min_data_points} data points required, found {len(risk_data)}"
                
                # Log error to audit_logs
                await self._log_to_audit(
                    user_id=user_id,
                    organization_id=organization_id,
                    action="risk_forecast",
                    success=False,
                    error_message=error_msg,
                    details={"project_id": project_id, "data_points": len(risk_data)}
                )
                
                raise ValueError(error_msg)
            
            # Prepare time series data
            time_series = self._prepare_time_series(risk_data)
            
            # Fit ARIMA model
            model, confidence = self._fit_arima_model(time_series)
            
            # Generate forecast
            forecasts = self._generate_forecast(model, forecast_periods)
            
            # Calculate response time
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            
            # Log successful forecast to audit_logs
            await self._log_to_audit(
                user_id=user_id,
                organization_id=organization_id,
                action="risk_forecast",
                success=True,
                details={
                    "project_id": project_id,
                    "forecast_periods": forecast_periods,
                    "data_points": len(risk_data),
                    "model_confidence": confidence,
                    "response_time_ms": response_time
                }
            )
            
            # Log metrics
            await self.log_metrics(
                "risk_forecast", user_id, 0, 0, response_time, True, 
                confidence_score=confidence
            )
            
            return {
                "forecasts": forecasts,
                "model_confidence": confidence,
                "model_metrics": {
                    "aic": model.aic if hasattr(model, 'aic') else None,
                    "data_points": len(risk_data)
                }
            }
            
        except ValueError as e:
            # Already logged in the check above
            raise
        except Exception as e:
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            error_msg = str(e)
            
            # Log error to audit_logs
            await self._log_to_audit(
                user_id=user_id,
                organization_id=organization_id,
                action="risk_forecast",
                success=False,
                error_message=error_msg,
                details={"project_id": project_id}
            )
            
            await self.log_metrics(
                "risk_forecast", user_id, 0, 0, response_time, False, error_msg
            )
            
            logger.error(f"Risk forecasting failed: {e}")
            raise
    
    async def _retrieve_historical_risks(
        self, 
        organization_id: str, 
        project_id: Optional[str]
    ) -> List[Dict]:
        """Retrieve historical risk data from Supabase filtered by organization"""
        try:
            query = self.supabase.table("risks").select("*").eq("organization_id", organization_id)
            
            if project_id:
                query = query.eq("project_id", project_id)
            
            # Order by created_at to get time series
            query = query.order("created_at", desc=False)
            
            response = query.execute()
            return response.data or []
        except Exception as e:
            logger.error(f"Failed to retrieve historical risks: {e}")
            return []
    
    def _prepare_time_series(self, risk_data: List[Dict]) -> 'pd.Series':
        """Prepare time series data using pandas"""
        try:
            # Convert to DataFrame
            df = self.pd.DataFrame(risk_data)
            
            # Ensure we have created_at and a risk metric
            if 'created_at' not in df.columns:
                raise ValueError("Risk data must contain 'created_at' field")
            
            # Convert created_at to datetime
            df['created_at'] = self.pd.to_datetime(df['created_at'])
            
            # Calculate risk score (probability * impact)
            if 'probability' in df.columns and 'impact' in df.columns:
                df['risk_score'] = df['probability'] * df['impact']
            elif 'severity' in df.columns:
                # Map severity to numeric score
                severity_map = {'low': 1, 'medium': 2, 'high': 3, 'critical': 4}
                df['risk_score'] = df['severity'].map(severity_map).fillna(2)
            else:
                # Default: count of risks per period
                df['risk_score'] = 1
            
            # Group by time period (monthly) and aggregate
            df.set_index('created_at', inplace=True)
            time_series = df['risk_score'].resample('M').sum()
            
            # Fill missing periods with 0
            time_series = time_series.fillna(0)
            
            return time_series
            
        except Exception as e:
            logger.error(f"Failed to prepare time series: {e}")
            raise
    
    def _fit_arima_model(self, time_series: 'pd.Series') -> Tuple[Any, float]:
        """
        Fit ARIMA model with auto parameter selection
        
        Returns:
            Tuple of (fitted_model, confidence_score)
        """
        try:
            # Check for constant time series
            if time_series.nunique() <= 1:
                # Time series is constant - cannot fit ARIMA
                # Return a simple model that predicts the constant value
                logger.warning("Time series is constant, using simple constant model")
                constant_value = time_series.iloc[0] if len(time_series) > 0 else 0
                pd_module = self.pd  # Capture pandas reference for nested class
                series_len = len(time_series)
                
                # Create a mock model object for constant forecasting
                class ConstantModel:
                    def __init__(self, value, pd_ref, ts_len):
                        self.constant_value = value
                        self._pd = pd_ref
                        self.aic = 0  # Perfect fit for constant data
                        self.resid = pd_ref.Series([0] * ts_len)
                    
                    def forecast(self, steps):
                        return self._pd.Series([self.constant_value] * steps)
                    
                    def get_forecast(self, steps):
                        pd_ref = self._pd
                        value = self.constant_value
                        
                        class ForecastResult:
                            def __init__(self):
                                pass
                            
                            def summary_frame(self):
                                df = pd_ref.DataFrame({
                                    'mean': [value] * steps,
                                    'mean_ci_lower': [value] * steps,
                                    'mean_ci_upper': [value] * steps
                                })
                                return df
                        
                        return ForecastResult()
                
                model = ConstantModel(constant_value, pd_module, series_len)
                confidence = 0.5  # Medium confidence for constant data
                return model, confidence
            
            # Test for stationarity
            try:
                adf_result = self.adfuller(time_series.dropna())
                is_stationary = adf_result[1] < 0.05  # p-value < 0.05 means stationary
            except ValueError as e:
                # Sample size too short for ADF test - treat as non-stationary
                logger.warning(f"ADF test failed (sample size issue), treating as non-stationary: {e}")
                is_stationary = False
            
            # Determine d parameter (differencing order)
            d = 0 if is_stationary else 1
            
            # Try different p and q parameters
            best_aic = float('inf')
            best_model = None
            best_order = None
            
            # Test p,d,q in range (0-2, 0-1, 0-2)
            for p in range(3):
                for q in range(3):
                    try:
                        model = self.ARIMA(time_series, order=(p, d, q))
                        fitted_model = model.fit()
                        
                        if fitted_model.aic < best_aic:
                            best_aic = fitted_model.aic
                            best_model = fitted_model
                            best_order = (p, d, q)
                    except Exception as e:
                        # Skip this combination if it fails
                        continue
            
            if best_model is None:
                raise ValueError("Failed to fit ARIMA model with any parameter combination")
            
            # Calculate confidence based on AIC and model fit
            # Lower AIC is better, normalize to 0-1 scale
            # Also consider residuals
            residuals = best_model.resid
            rmse = np.sqrt(np.mean(residuals**2))
            
            # Confidence calculation:
            # - Good AIC (< 100): high confidence
            # - Low RMSE relative to data range: high confidence
            data_range = time_series.max() - time_series.min()
            if data_range > 0:
                normalized_rmse = rmse / data_range
                rmse_confidence = max(0, 1 - normalized_rmse)
            else:
                rmse_confidence = 0.5
            
            # AIC confidence (lower is better, normalize)
            aic_confidence = max(0, min(1, 1 - (best_aic / 200)))
            
            # Combined confidence
            confidence = (rmse_confidence * 0.6) + (aic_confidence * 0.4)
            confidence = max(0.0, min(1.0, confidence))
            
            logger.info(f"Fitted ARIMA{best_order} with AIC={best_aic:.2f}, confidence={confidence:.3f}")
            
            return best_model, confidence
            
        except Exception as e:
            logger.error(f"Failed to fit ARIMA model: {e}")
            raise
    
    def _generate_forecast(self, model: Any, periods: int) -> List[Dict]:
        """Generate forecast with confidence intervals"""
        try:
            # Generate forecast
            forecast_result = model.forecast(steps=periods)
            
            # Get confidence intervals (95% by default)
            forecast_df = model.get_forecast(steps=periods).summary_frame()
            
            # Build forecast list
            forecasts = []
            start_date = datetime.now()
            
            for i in range(periods):
                period_date = start_date + timedelta(days=30 * (i + 1))  # Monthly periods
                
                # Extract values
                risk_value = float(forecast_result.iloc[i]) if hasattr(forecast_result, 'iloc') else float(forecast_result[i])
                
                # Get confidence intervals from forecast_df
                lower_bound = float(forecast_df.iloc[i]['mean_ci_lower'])
                upper_bound = float(forecast_df.iloc[i]['mean_ci_upper'])
                
                # Convert risk score back to probability and impact
                # Assuming risk_score = probability * impact, and impact ranges 1-5
                # We'll estimate probability and use a default impact
                estimated_impact = 3.0  # Default medium impact
                estimated_probability = min(1.0, max(0.0, risk_value / 5.0))
                
                # Calculate confidence bounds and clamp to [0, 1]
                confidence_lower_raw = lower_bound / 5.0
                confidence_upper_raw = upper_bound / 5.0
                
                forecasts.append({
                    "period": period_date.strftime("%Y-%m"),
                    "risk_probability": round(estimated_probability, 3),
                    "risk_impact": round(estimated_impact, 1),
                    "confidence_lower": round(max(0.0, min(1.0, confidence_lower_raw)), 3),
                    "confidence_upper": round(max(0.0, min(1.0, confidence_upper_raw)), 3)
                })
            
            return forecasts
            
        except Exception as e:
            logger.error(f"Failed to generate forecast: {e}")
            raise
    
    async def _log_to_audit(
        self,
        user_id: str,
        organization_id: str,
        action: str,
        success: bool,
        error_message: Optional[str] = None,
        details: Optional[Dict] = None
    ):
        """Log forecast requests and results to audit_logs"""
        try:
            self.supabase.table("audit_logs").insert({
                "user_id": user_id,
                "organization_id": organization_id,
                "action": action,
                "success": success,
                "error_message": error_message,
                "details": details or {},
                "created_at": datetime.now().isoformat()
            }).execute()
        except Exception as e:
            logger.error(f"Failed to log to audit_logs: {e}")
    
    # Legacy methods for backward compatibility
    async def forecast_project_risks(self, user_id: str, project_id: str = None) -> Dict[str, Any]:
        """Legacy method - forecast potential risks for projects"""
        start_time = datetime.now()
        
        try:
            # Get project data
            projects_data = await self._get_projects_data(project_id)
            
            # Analyze risk patterns
            risk_predictions = []
            for project in projects_data:
                project_risks = await self._analyze_project_risks(project)
                risk_predictions.extend(project_risks)
            
            # Store predictions
            for prediction in risk_predictions:
                await self._store_risk_prediction(prediction)
            
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            
            # Log metrics
            await self.log_metrics(
                "risk_forecast", user_id, 0, 0, response_time, True
            )
            
            return {
                "predictions": risk_predictions,
                "summary": {
                    "total_risks": len(risk_predictions),
                    "high_probability": len([r for r in risk_predictions if r["probability"] > 0.7]),
                    "critical_impact": len([r for r in risk_predictions if r["impact_score"] >= 4])
                }
            }
            
        except Exception as e:
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            await self.log_metrics(
                "risk_forecast", user_id, 0, 0, response_time, False, str(e)
            )
            logger.error(f"Risk forecasting failed: {e}")
            raise
    
    async def _get_projects_data(self, project_id: str = None) -> List[Dict]:
        """Get project data for risk analysis"""
        try:
            query = self.supabase.table("projects").select("*")
            if project_id:
                query = query.eq("id", project_id)
            
            response = query.execute()
            return response.data or []
        except Exception as e:
            logger.error(f"Failed to get projects data: {e}")
            return []
    
    async def _analyze_project_risks(self, project: Dict) -> List[Dict]:
        """Analyze risks for a specific project"""
        risks = []
        
        try:
            # Budget risk analysis
            if project.get("budget") and project.get("spent"):
                budget_utilization = project["spent"] / project["budget"]
                if budget_utilization > 0.8:
                    risks.append({
                        "project_id": project["id"],
                        "risk_type": "budget_overrun",
                        "description": f"Project is at {budget_utilization*100:.1f}% of budget",
                        "probability": min(budget_utilization, 0.95),
                        "impact_score": 4,
                        "confidence_score": 0.8,
                        "mitigation_suggestions": [
                            "Review remaining tasks and budget allocation",
                            "Consider scope reduction or additional funding",
                            "Implement stricter budget controls"
                        ]
                    })
            
            # Timeline risk analysis
            if project.get("start_date") and project.get("end_date"):
                start_date = datetime.fromisoformat(project["start_date"].replace('Z', '+00:00'))
                end_date = datetime.fromisoformat(project["end_date"].replace('Z', '+00:00'))
                now = datetime.now(start_date.tzinfo)
                
                total_duration = (end_date - start_date).days
                elapsed_duration = (now - start_date).days
                
                if total_duration > 0:
                    timeline_progress = elapsed_duration / total_duration
                    
                    # Assume 50% completion for demo (in real scenario, get from project status)
                    work_progress = 0.5
                    
                    if timeline_progress > work_progress + 0.2:  # Behind schedule
                        risks.append({
                            "project_id": project["id"],
                            "risk_type": "schedule_delay",
                            "description": f"Project appears behind schedule ({timeline_progress*100:.1f}% time elapsed, ~{work_progress*100:.1f}% complete)",
                            "probability": 0.7,
                            "impact_score": 3,
                            "confidence_score": 0.6,
                            "mitigation_suggestions": [
                                "Reassess project timeline and milestones",
                                "Consider additional resources",
                                "Identify and remove blockers"
                            ]
                        })
            
            # Resource availability risk
            # This would analyze resource allocation vs availability
            risks.append({
                "project_id": project["id"],
                "risk_type": "resource_constraint",
                "description": "Potential resource availability issues identified",
                "probability": 0.4,
                "impact_score": 3,
                "confidence_score": 0.5,
                "mitigation_suggestions": [
                    "Review resource allocation plan",
                    "Identify backup resources",
                    "Consider timeline adjustments"
                ]
            })
            
        except Exception as e:
            logger.error(f"Risk analysis failed for project {project.get('id')}: {e}")
        
        return risks
    
    async def _store_risk_prediction(self, prediction: Dict):
        """Store risk prediction in database"""
        try:
            self.supabase.table("risk_predictions").upsert(prediction).execute()
        except Exception as e:
            logger.error(f"Failed to store risk prediction: {e}")

class HallucinationValidator(AIAgentBase):
    """AI agent for validating AI-generated content and detecting hallucinations"""
    
    def __init__(self, supabase_client: Client, openai_api_key: str, base_url: Optional[str] = None):
        super().__init__(supabase_client, openai_api_key, base_url)
    
    async def validate_response(self, response: str, sources: List[Dict], 
                              context_data: Dict = None) -> Dict[str, Any]:
        """Validate AI response against source data"""
        try:
            validation_results = {
                "is_valid": True,
                "confidence_score": 1.0,
                "issues": [],
                "source_coverage": 0.0
            }
            
            # Always extract claims first (this can raise exceptions)
            claims = self._extract_claims(response)
            
            # Check if response is grounded in sources
            if not sources:
                validation_results["issues"].append("No sources provided for validation")
                validation_results["confidence_score"] *= 0.5
                validation_results["source_coverage"] = 0.0
            else:
                # Check for specific claims that can be verified
                verified_claims = 0
                contradictions_found = 0
                
                for claim in claims:
                    verification_result = self._verify_claim_against_sources(claim, sources)
                    if verification_result:
                        verified_claims += 1
                    else:
                        # Check if this is a contradiction vs just unverified
                        if self._detect_contradiction(claim, sources):
                            contradictions_found += 1
                            validation_results["issues"].append(f"Contradictory claim detected: {claim}")
                        else:
                            validation_results["issues"].append(f"Unverified claim: {claim}")
                
                # Calculate source coverage more consistently
                if claims:
                    validation_results["source_coverage"] = verified_claims / len(claims)
                else:
                    # If no specific claims extracted, assume moderate coverage if sources exist
                    validation_results["source_coverage"] = 0.5
                
                # Adjust confidence based on verification and contradictions
                base_confidence = validation_results["source_coverage"]
                
                # Penalize contradictions heavily
                if contradictions_found > 0:
                    contradiction_penalty = min(0.8, contradictions_found * 0.3)
                    base_confidence *= (1.0 - contradiction_penalty)
                
                validation_results["confidence_score"] = base_confidence
            
            # Flag potential hallucinations
            if validation_results["confidence_score"] < 0.6:
                validation_results["is_valid"] = False
                validation_results["issues"].append("Low confidence score indicates potential hallucination")
            
            return validation_results
            
        except Exception as e:
            logger.error(f"Response validation failed: {e}")
            return {
                "is_valid": False,
                "confidence_score": 0.0,
                "issues": [f"Validation error: {str(e)}"],
                "source_coverage": 0.0
            }
    
    def _detect_contradiction(self, claim: str, sources: List[Dict]) -> bool:
        """Detect if a claim contradicts source data"""
        import re
        
        claim_lower = claim.lower()
        claim_numbers = re.findall(r'\$?[\d,]+(?:\.\d+)?', claim)
        claim_numbers = [self._normalize_number(num) for num in claim_numbers]
        
        # Look for contradictory information in sources
        for source in sources:
            source_text = source.get('content_text', '').lower()
            
            # Check for overlapping context (same topic)
            claim_words = set(word for word in claim_lower.split() if len(word) > 3)
            source_words = set(word for word in source_text.split() if len(word) > 3)
            overlap = len(claim_words.intersection(source_words))
            
            if overlap > 1:  # Some topical overlap
                source_numbers = re.findall(r'\$?[\d,]+(?:\.\d+)?', source_text)
                source_numbers = [self._normalize_number(num) for num in source_numbers]
                
                # Check for numerical contradictions
                if claim_numbers and source_numbers:
                    for claim_num in claim_numbers:
                        for source_num in source_numbers:
                            # Significant difference indicates contradiction
                            if claim_num > 0 and source_num > 0:
                                diff_ratio = abs(claim_num - source_num) / max(claim_num, source_num)
                                if diff_ratio >= 0.30:  # 30% or more difference (lowered from 35%)
                                    return True
        
        return False
    
    def _extract_claims(self, response: str) -> List[str]:
        """Extract factual claims from response"""
        # Improved claim extraction with more consistent behavior
        sentences = response.split('.')
        claims = []
        
        # Keywords that indicate factual claims
        factual_keywords = [
            'total', 'number', 'percent', 'budget', 'deadline', 'resource',
            'cost', 'spending', 'allocation', 'utilization', 'performance',
            'project', 'risk', 'issue', 'milestone', 'completion'
        ]
        
        for sentence in sentences:
            sentence = sentence.strip()
            if sentence and any(keyword in sentence.lower() for keyword in factual_keywords):
                claims.append(sentence)
        
        # Ensure consistent behavior - if no claims found, treat entire response as one claim
        if not claims and response.strip():
            claims = [response.strip()]
        
        return claims
    
    def _verify_claim_against_sources(self, claim: str, sources: List[Dict]) -> bool:
        """Verify a claim against source data with improved contradiction detection"""
        if not sources:
            return False
            
        claim_lower = claim.lower()
        
        # Extract numerical values from claim for contradiction detection
        import re
        claim_numbers = re.findall(r'\$?[\d,]+(?:\.\d+)?', claim)
        claim_numbers = [self._normalize_number(num) for num in claim_numbers]
        
        for source in sources:
            source_text = source.get('content_text', '').lower()
            
            # Check for word overlap (basic verification)
            claim_words = set(word for word in claim_lower.split() if len(word) > 3)
            source_words = set(word for word in source_text.split() if len(word) > 3)
            overlap = len(claim_words.intersection(source_words))
            
            if overlap > 0:
                # If there's word overlap, check for numerical contradictions
                source_numbers = re.findall(r'\$?[\d,]+(?:\.\d+)?', source_text)
                source_numbers = [self._normalize_number(num) for num in source_numbers]
                
                # If both have numbers, check for significant differences
                if claim_numbers and source_numbers:
                    for claim_num in claim_numbers:
                        for source_num in source_numbers:
                            # If numbers differ by 30% or more, it's likely a contradiction
                            if claim_num > 0 and source_num > 0:
                                diff_ratio = abs(claim_num - source_num) / max(claim_num, source_num)
                                if diff_ratio >= 0.30:  # 30% or more difference (lowered from 35%)
                                    return False  # Contradiction detected
                
                return True  # Word overlap without contradiction
        
        return False
    
    def _normalize_number(self, num_str: str) -> float:
        """Normalize number string to float for comparison"""
        try:
            # Remove $ and commas, convert to float
            cleaned = num_str.replace('$', '').replace(',', '')
            return float(cleaned)
        except (ValueError, AttributeError):
            return 0.0

class DataValidatorAgent(AIAgentBase):
    """Data Validation Agent for detecting inconsistencies and integrity issues"""
    
    def __init__(self, supabase_client: Client, openai_api_key: str, base_url: Optional[str] = None):
        super().__init__(supabase_client, openai_api_key, base_url)
    
    async def validate_data(
        self,
        organization_id: str,
        validation_scope: str,
        user_id: str
    ) -> Dict[str, Any]:
        """
        Validate data and return issues grouped by severity
        
        Args:
            organization_id: Organization ID for filtering
            validation_scope: "all", "financials", "timelines", or "integrity"
            user_id: User ID for audit logging
            
        Returns:
            Dict containing validation report with issues grouped by severity
        """
        start_time = datetime.now()
        
        try:
            issues = []
            
            # Run validations based on scope
            if validation_scope in ["all", "financials"]:
                financial_issues = await self._validate_financials(organization_id)
                issues.extend(financial_issues)
            
            if validation_scope in ["all", "timelines"]:
                timeline_issues = await self._validate_timelines(organization_id)
                issues.extend(timeline_issues)
            
            if validation_scope in ["all", "integrity"]:
                integrity_issues = await self._validate_integrity(organization_id)
                issues.extend(integrity_issues)
            
            # Group issues by severity
            critical_issues = [i for i in issues if i["severity"] == "CRITICAL"]
            high_issues = [i for i in issues if i["severity"] == "HIGH"]
            medium_issues = [i for i in issues if i["severity"] == "MEDIUM"]
            low_issues = [i for i in issues if i["severity"] == "LOW"]
            
            # Calculate response time
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            
            # Prepare result
            result = {
                "issues": issues,
                "total_issues": len(issues),
                "critical_count": len(critical_issues),
                "high_count": len(high_issues),
                "medium_count": len(medium_issues),
                "low_count": len(low_issues),
                "validation_scope": validation_scope,
                "timestamp": datetime.now().isoformat()
            }
            
            # Log operation
            await self.log_operation(
                operation_type="data_validation",
                user_id=user_id,
                inputs={"organization_id": organization_id, "validation_scope": validation_scope},
                outputs=result,
                response_time_ms=response_time,
                success=True
            )
            
            logger.info(f"Data validation completed: {len(issues)} issues found")
            return result
            
        except Exception as e:
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            
            # Log error
            await self.log_operation(
                operation_type="data_validation",
                user_id=user_id,
                inputs={"organization_id": organization_id, "validation_scope": validation_scope},
                outputs={},
                response_time_ms=response_time,
                success=False,
                error_message=str(e)
            )
            
            logger.error(f"Data validation failed: {e}")
            raise
    
    async def _validate_financials(self, organization_id: str) -> List[Dict]:
        """
        Check for budget overruns and financial inconsistencies
        
        Validation rules:
        - Budget overrun: actual_cost > budget
        - Negative values: cost < 0 or budget < 0
        - Missing financials: projects without budget records
        """
        issues = []
        
        try:
            # Get all projects for the organization
            projects_response = self.supabase.table("projects").select(
                "id, name, budget, status"
            ).eq("organization_id", organization_id).execute()
            
            projects = projects_response.data or []
            
            for project in projects:
                project_id = project["id"]
                project_name = project["name"]
                budget = project.get("budget")
                
                # Check for negative budget
                if budget is not None and budget < 0:
                    issues.append({
                        "severity": "CRITICAL",
                        "category": "financial",
                        "entity_type": "project",
                        "entity_id": project_id,
                        "description": f"Project '{project_name}' has negative budget: ${budget}",
                        "recommendation": "Update budget to a positive value"
                    })
                
                # Check for missing budget
                if budget is None:
                    issues.append({
                        "severity": "MEDIUM",
                        "category": "financial",
                        "entity_type": "project",
                        "entity_id": project_id,
                        "description": f"Project '{project_name}' has no budget defined",
                        "recommendation": "Define a budget for this project"
                    })
                    continue
                
                # Get actual costs for the project
                financials_response = self.supabase.table("financials").select(
                    "amount"
                ).eq("project_id", project_id).execute()
                
                financials = financials_response.data or []
                actual_cost = sum(f.get("amount", 0) for f in financials)
                
                # Check for negative costs
                for financial in financials:
                    amount = financial.get("amount", 0)
                    if amount < 0:
                        issues.append({
                            "severity": "HIGH",
                            "category": "financial",
                            "entity_type": "financial",
                            "entity_id": financial.get("id", "unknown"),
                            "description": f"Project '{project_name}' has negative cost entry: ${amount}",
                            "recommendation": "Correct the negative cost entry"
                        })
                
                # Check for budget overruns
                if budget > 0 and actual_cost > budget:
                    overrun_percentage = ((actual_cost - budget) / budget) * 100
                    
                    # Assign severity based on overrun percentage
                    if overrun_percentage > 20:
                        severity = "HIGH"
                    elif overrun_percentage > 10:
                        severity = "MEDIUM"
                    else:
                        severity = "LOW"
                    
                    issues.append({
                        "severity": severity,
                        "category": "financial",
                        "entity_type": "project",
                        "entity_id": project_id,
                        "description": f"Project '{project_name}' is over budget by {overrun_percentage:.1f}% (Budget: ${budget}, Actual: ${actual_cost})",
                        "recommendation": f"Review project costs and consider budget adjustment"
                    })
            
            logger.info(f"Financial validation found {len(issues)} issues")
            return issues
            
        except Exception as e:
            logger.error(f"Financial validation failed: {e}")
            return issues
    
    async def _validate_timelines(self, organization_id: str) -> List[Dict]:
        """
        Check for schedule conflicts and deadline violations
        
        Validation rules:
        - End before start: end_date < start_date
        - Overdue projects: end_date < current_date AND status != "completed"
        - Resource conflicts: same resource allocated to overlapping tasks
        """
        issues = []
        
        try:
            current_date = datetime.now().date()
            
            # Get all projects for the organization
            projects_response = self.supabase.table("projects").select(
                "id, name, start_date, end_date, status"
            ).eq("organization_id", organization_id).execute()
            
            projects = projects_response.data or []
            
            for project in projects:
                project_id = project["id"]
                project_name = project["name"]
                start_date_str = project.get("start_date")
                end_date_str = project.get("end_date")
                status = project.get("status", "")
                
                # Parse dates
                start_date = None
                end_date = None
                
                if start_date_str:
                    try:
                        start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00')).date()
                    except (ValueError, AttributeError):
                        pass
                
                if end_date_str:
                    try:
                        end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00')).date()
                    except (ValueError, AttributeError):
                        pass
                
                # Check for end_date < start_date
                if start_date and end_date and end_date < start_date:
                    issues.append({
                        "severity": "CRITICAL",
                        "category": "timeline",
                        "entity_type": "project",
                        "entity_id": project_id,
                        "description": f"Project '{project_name}' has end date ({end_date}) before start date ({start_date})",
                        "recommendation": "Correct the project timeline dates"
                    })
                
                # Check for overdue projects
                if end_date and end_date < current_date and status.lower() != "completed":
                    days_overdue = (current_date - end_date).days
                    issues.append({
                        "severity": "HIGH",
                        "category": "timeline",
                        "entity_type": "project",
                        "entity_id": project_id,
                        "description": f"Project '{project_name}' is {days_overdue} days overdue (End date: {end_date}, Status: {status})",
                        "recommendation": "Update project status or extend deadline"
                    })
            
            # Check for resource conflicts (overlapping allocations)
            allocations_response = self.supabase.table("resource_allocations").select(
                "id, resource_id, project_id, start_date, end_date, allocation_percentage"
            ).eq("organization_id", organization_id).execute()
            
            allocations = allocations_response.data or []
            
            # Group allocations by resource
            resource_allocations = {}
            for allocation in allocations:
                resource_id = allocation.get("resource_id")
                if resource_id not in resource_allocations:
                    resource_allocations[resource_id] = []
                resource_allocations[resource_id].append(allocation)
            
            # Check for overlapping allocations
            for resource_id, allocs in resource_allocations.items():
                for i, alloc1 in enumerate(allocs):
                    for alloc2 in allocs[i+1:]:
                        # Parse dates
                        try:
                            start1 = datetime.fromisoformat(alloc1["start_date"].replace('Z', '+00:00')).date()
                            end1 = datetime.fromisoformat(alloc1["end_date"].replace('Z', '+00:00')).date()
                            start2 = datetime.fromisoformat(alloc2["start_date"].replace('Z', '+00:00')).date()
                            end2 = datetime.fromisoformat(alloc2["end_date"].replace('Z', '+00:00')).date()
                            
                            # Check for overlap
                            if start1 <= end2 and start2 <= end1:
                                total_allocation = alloc1.get("allocation_percentage", 0) + alloc2.get("allocation_percentage", 0)
                                if total_allocation > 100:
                                    issues.append({
                                        "severity": "HIGH",
                                        "category": "timeline",
                                        "entity_type": "resource_allocation",
                                        "entity_id": resource_id,
                                        "description": f"Resource {resource_id} is over-allocated ({total_allocation}%) during overlapping period",
                                        "recommendation": "Adjust resource allocation percentages or timelines"
                                    })
                        except (ValueError, AttributeError, KeyError):
                            continue
            
            logger.info(f"Timeline validation found {len(issues)} issues")
            return issues
            
        except Exception as e:
            logger.error(f"Timeline validation failed: {e}")
            return issues
    
    async def _validate_integrity(self, organization_id: str) -> List[Dict]:
        """
        Check for data integrity issues
        
        Validation rules:
        - Orphaned records: foreign keys pointing to non-existent records
        - Missing required fields: NULL values in required fields
        - Duplicate entries: duplicate unique identifiers
        """
        issues = []
        
        try:
            # Check for orphaned project references in financials
            financials_response = self.supabase.table("financials").select(
                "id, project_id"
            ).eq("organization_id", organization_id).execute()
            
            financials = financials_response.data or []
            
            for financial in financials:
                project_id = financial.get("project_id")
                if project_id:
                    # Check if project exists
                    project_response = self.supabase.table("projects").select(
                        "id"
                    ).eq("id", project_id).execute()
                    
                    if not project_response.data:
                        issues.append({
                            "severity": "CRITICAL",
                            "category": "integrity",
                            "entity_type": "financial",
                            "entity_id": financial["id"],
                            "description": f"Financial record references non-existent project {project_id}",
                            "recommendation": "Remove orphaned financial record or restore project"
                        })
            
            # Check for orphaned resource allocations
            allocations_response = self.supabase.table("resource_allocations").select(
                "id, resource_id, project_id"
            ).eq("organization_id", organization_id).execute()
            
            allocations = allocations_response.data or []
            
            for allocation in allocations:
                resource_id = allocation.get("resource_id")
                project_id = allocation.get("project_id")
                
                # Check if resource exists
                if resource_id:
                    resource_response = self.supabase.table("resources").select(
                        "id"
                    ).eq("id", resource_id).execute()
                    
                    if not resource_response.data:
                        issues.append({
                            "severity": "CRITICAL",
                            "category": "integrity",
                            "entity_type": "resource_allocation",
                            "entity_id": allocation["id"],
                            "description": f"Resource allocation references non-existent resource {resource_id}",
                            "recommendation": "Remove orphaned allocation or restore resource"
                        })
                
                # Check if project exists
                if project_id:
                    project_response = self.supabase.table("projects").select(
                        "id"
                    ).eq("id", project_id).execute()
                    
                    if not project_response.data:
                        issues.append({
                            "severity": "CRITICAL",
                            "category": "integrity",
                            "entity_type": "resource_allocation",
                            "entity_id": allocation["id"],
                            "description": f"Resource allocation references non-existent project {project_id}",
                            "recommendation": "Remove orphaned allocation or restore project"
                        })
            
            # Check for missing required fields in projects
            projects_response = self.supabase.table("projects").select(
                "id, name, start_date, end_date"
            ).eq("organization_id", organization_id).execute()
            
            projects = projects_response.data or []
            
            for project in projects:
                project_id = project["id"]
                project_name = project.get("name")
                
                if not project_name:
                    issues.append({
                        "severity": "HIGH",
                        "category": "integrity",
                        "entity_type": "project",
                        "entity_id": project_id,
                        "description": f"Project {project_id} is missing required field: name",
                        "recommendation": "Add a name to the project"
                    })
                
                if not project.get("start_date"):
                    issues.append({
                        "severity": "MEDIUM",
                        "category": "integrity",
                        "entity_type": "project",
                        "entity_id": project_id,
                        "description": f"Project '{project_name or project_id}' is missing required field: start_date",
                        "recommendation": "Add a start date to the project"
                    })
                
                if not project.get("end_date"):
                    issues.append({
                        "severity": "MEDIUM",
                        "category": "integrity",
                        "entity_type": "project",
                        "entity_id": project_id,
                        "description": f"Project '{project_name or project_id}' is missing required field: end_date",
                        "recommendation": "Add an end date to the project"
                    })
            
            # Check for duplicate project names within organization
            project_names = {}
            for project in projects:
                name = project.get("name")
                if name:
                    if name in project_names:
                        issues.append({
                            "severity": "LOW",
                            "category": "integrity",
                            "entity_type": "project",
                            "entity_id": project["id"],
                            "description": f"Duplicate project name found: '{name}' (also used by project {project_names[name]})",
                            "recommendation": "Consider using unique project names for clarity"
                        })
                    else:
                        project_names[name] = project["id"]
            
            logger.info(f"Integrity validation found {len(issues)} issues")
            return issues
            
        except Exception as e:
            logger.error(f"Integrity validation failed: {e}")
            return issues


class AnomalyDetectorAgent(AIAgentBase):
    """Anomaly Detection Agent using Isolation Forest for audit log analysis"""
    
    def __init__(self, supabase_client: Client, openai_api_key: str, base_url: Optional[str] = None):
        super().__init__(supabase_client, openai_api_key, base_url)
        self.contamination = 0.1  # Expected anomaly rate (10%)
        self.n_estimators = 100  # Number of trees in Isolation Forest
    
    async def detect_anomalies(
        self,
        organization_id: str,
        time_range_days: int = 30,
        user_id: str = None
    ) -> Dict[str, Any]:
        """
        Detect anomalies in audit logs using Isolation Forest
        
        Args:
            organization_id: Organization to analyze
            time_range_days: Number of days to look back (default 30)
            user_id: User making the request (for logging)
        
        Returns:
            Dict containing anomalies, total logs analyzed, and anomaly count
        """
        start_time = datetime.now()
        
        try:
            # Retrieve audit logs filtered by organization and time range
            cutoff_date = datetime.now() - timedelta(days=time_range_days)
            
            audit_logs_response = self.supabase.table("audit_logs").select(
                "id, user_id, action, entity_type, entity_id, details, success, created_at"
            ).eq(
                "organization_id", organization_id
            ).gte(
                "created_at", cutoff_date.isoformat()
            ).order(
                "created_at", desc=False
            ).execute()
            
            audit_logs = audit_logs_response.data or []
            
            if len(audit_logs) < 10:
                # Insufficient data for anomaly detection
                response_time = int((datetime.now() - start_time).total_seconds() * 1000)
                
                await self.log_operation(
                    operation_type="anomaly_detection",
                    user_id=user_id or "system",
                    inputs={"organization_id": organization_id, "time_range_days": time_range_days},
                    outputs={"message": "Insufficient data"},
                    response_time_ms=response_time,
                    success=True
                )
                
                return {
                    "anomalies": [],
                    "total_logs_analyzed": len(audit_logs),
                    "anomaly_count": 0,
                    "message": "Insufficient data for anomaly detection (minimum 10 logs required)"
                }
            
            # Extract features for anomaly detection
            features_df = self._prepare_features(audit_logs)
            
            # Train Isolation Forest model
            model = self._train_isolation_forest(features_df)
            
            # Score and rank anomalies
            anomalies = self._score_anomalies(model, features_df, audit_logs)
            
            # Calculate metrics
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            
            # Log detection request
            await self.log_operation(
                operation_type="anomaly_detection",
                user_id=user_id or "system",
                inputs={
                    "organization_id": organization_id,
                    "time_range_days": time_range_days,
                    "total_logs": len(audit_logs)
                },
                outputs={
                    "anomaly_count": len(anomalies),
                    "anomalies": [a["log_id"] for a in anomalies[:10]]  # Log first 10
                },
                response_time_ms=response_time,
                success=True,
                confidence_score=self._calculate_detection_confidence(anomalies, len(audit_logs))
            )
            
            return {
                "anomalies": anomalies,
                "total_logs_analyzed": len(audit_logs),
                "anomaly_count": len(anomalies),
                "detection_confidence": self._calculate_detection_confidence(anomalies, len(audit_logs))
            }
            
        except Exception as e:
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            
            # Log error
            await self.log_operation(
                operation_type="anomaly_detection",
                user_id=user_id or "system",
                inputs={"organization_id": organization_id, "time_range_days": time_range_days},
                outputs={},
                response_time_ms=response_time,
                success=False,
                error_message=str(e)
            )
            
            logger.error(f"Anomaly detection failed: {e}")
            raise
    
    def _prepare_features(self, audit_logs: List[Dict]) -> 'pd.DataFrame':
        """
        Extract features for anomaly detection
        
        Features:
        - hour_of_day: Hour when action occurred (0-23)
        - day_of_week: Day of week (0-6, Monday=0)
        - action_frequency: Count of action type in last hour
        - user_action_diversity: Unique actions by user in last hour
        - time_since_last_action: Seconds since user's last action
        - data_volume: Size of data accessed (estimated from details)
        """
        import pandas as pd
        
        # Convert to DataFrame for easier manipulation
        df = pd.DataFrame(audit_logs)
        df['created_at'] = pd.to_datetime(df['created_at'])
        
        # Extract time-based features
        df['hour_of_day'] = df['created_at'].dt.hour
        df['day_of_week'] = df['created_at'].dt.dayofweek
        
        # Calculate action frequency (actions per hour)
        df['action_frequency'] = df.groupby(['action', pd.Grouper(key='created_at', freq='1H')])['id'].transform('count')
        
        # Calculate user action diversity (unique actions per user per hour)
        df['user_action_diversity'] = df.groupby(['user_id', pd.Grouper(key='created_at', freq='1H')])['action'].transform('nunique')
        
        # Calculate time since last action for each user
        df = df.sort_values(['user_id', 'created_at'])
        df['time_since_last_action'] = df.groupby('user_id')['created_at'].diff().dt.total_seconds().fillna(0)
        
        # Calculate data volume (estimate from details JSON size)
        df['data_volume'] = df['details'].apply(lambda x: len(str(x)) if x else 0)
        
        # Add failed attempts count (failed actions in last hour)
        df['failed_attempts'] = df[df['success'] == False].groupby(
            ['user_id', pd.Grouper(key='created_at', freq='1H')]
        )['id'].transform('count').fillna(0)
        
        # Select feature columns
        feature_columns = [
            'hour_of_day',
            'day_of_week',
            'action_frequency',
            'user_action_diversity',
            'time_since_last_action',
            'data_volume',
            'failed_attempts'
        ]
        
        features_df = df[feature_columns].fillna(0)
        
        logger.info(f"Prepared {len(features_df)} feature vectors with {len(feature_columns)} features")
        
        return features_df
    
    def _train_isolation_forest(self, features: 'pd.DataFrame') -> 'IsolationForest':
        """
        Train Isolation Forest model
        
        Configuration:
        - n_estimators: 100 trees
        - contamination: 0.1 (expect 10% anomalies)
        - max_samples: 256
        - random_state: 42 for reproducibility
        """
        from sklearn.ensemble import IsolationForest
        
        model = IsolationForest(
            n_estimators=self.n_estimators,
            contamination=self.contamination,
            max_samples=min(256, len(features)),
            random_state=42,
            n_jobs=-1  # Use all available cores
        )
        
        model.fit(features)
        
        logger.info(f"Trained Isolation Forest with {self.n_estimators} estimators")
        
        return model
    
    def _score_anomalies(
        self,
        model: 'IsolationForest',
        features: 'pd.DataFrame',
        audit_logs: List[Dict]
    ) -> List[Dict]:
        """
        Score and rank anomalies
        
        Returns list of anomalies with confidence scores, sorted by confidence descending
        """
        import pandas as pd
        
        # Get anomaly predictions (-1 for anomaly, 1 for normal)
        predictions = model.predict(features)
        
        # Get anomaly scores (lower = more anomalous)
        scores = model.score_samples(features)
        
        # Convert scores to confidence values (0.0-1.0, higher = more anomalous)
        # Normalize scores to 0-1 range
        min_score = scores.min()
        max_score = scores.max()
        
        if max_score - min_score > 0:
            normalized_scores = (scores - min_score) / (max_score - min_score)
            # Invert so that lower scores (more anomalous) get higher confidence
            confidence_scores = 1.0 - normalized_scores
        else:
            confidence_scores = np.zeros(len(scores))
        
        # Build anomaly results
        anomalies = []
        
        for i, (prediction, confidence) in enumerate(zip(predictions, confidence_scores)):
            if prediction == -1:  # Anomaly detected
                log = audit_logs[i]
                
                # Determine reason based on feature values
                feature_row = features.iloc[i]
                reasons = []
                
                if feature_row['hour_of_day'] < 6 or feature_row['hour_of_day'] > 22:
                    reasons.append("Unusual time of day")
                
                if feature_row['action_frequency'] > features['action_frequency'].quantile(0.95):
                    reasons.append("High action frequency")
                
                if feature_row['user_action_diversity'] > features['user_action_diversity'].quantile(0.95):
                    reasons.append("High action diversity")
                
                if feature_row['time_since_last_action'] < 1:
                    reasons.append("Rapid successive actions")
                
                if feature_row['data_volume'] > features['data_volume'].quantile(0.95):
                    reasons.append("Large data volume accessed")
                
                if feature_row['failed_attempts'] > 0:
                    reasons.append("Failed action attempts")
                
                if not reasons:
                    reasons.append("Unusual pattern detected")
                
                # Get user name if available
                user_name = log.get('user_id', 'Unknown')
                
                anomalies.append({
                    "log_id": log["id"],
                    "timestamp": log["created_at"],
                    "user_id": log["user_id"],
                    "user_name": user_name,
                    "action": log["action"],
                    "confidence": float(confidence),
                    "reason": ", ".join(reasons),
                    "details": log.get("details", {})
                })
        
        # Sort by confidence descending
        anomalies.sort(key=lambda x: x["confidence"], reverse=True)
        
        logger.info(f"Detected {len(anomalies)} anomalies")
        
        return anomalies
    
    def _calculate_detection_confidence(self, anomalies: List[Dict], total_logs: int) -> float:
        """
        Calculate overall confidence in the anomaly detection
        
        Based on:
        - Number of logs analyzed
        - Anomaly rate compared to expected contamination
        - Average confidence of detected anomalies
        """
        if total_logs < 10:
            return 0.0
        
        # Data volume factor (more data = higher confidence)
        data_volume_factor = min(total_logs / 100, 1.0)
        
        # Anomaly rate factor (closer to expected contamination = higher confidence)
        if total_logs > 0:
            anomaly_rate = len(anomalies) / total_logs
            rate_diff = abs(anomaly_rate - self.contamination)
            rate_factor = max(0, 1.0 - (rate_diff * 5))  # Penalize large deviations
        else:
            rate_factor = 0.0
        
        # Average anomaly confidence
        if anomalies:
            avg_anomaly_confidence = sum(a["confidence"] for a in anomalies) / len(anomalies)
        else:
            avg_anomaly_confidence = 0.5
        
        # Combine factors
        overall_confidence = (
            data_volume_factor * 0.3 +
            rate_factor * 0.3 +
            avg_anomaly_confidence * 0.4
        )
        
        return min(max(overall_confidence, 0.0), 1.0)


# Factory function to create AI agents
def create_ai_agents(supabase_client: Client, openai_api_key: str, base_url: Optional[str] = None) -> Dict[str, AIAgentBase]:
    """Create all AI agents with optional custom base URL for OpenAI-compatible APIs (e.g., Grok)"""
    return {
        "rag_reporter": RAGReporterAgent(supabase_client, openai_api_key, base_url),
        "resource_optimizer": ResourceOptimizerAgent(supabase_client, openai_api_key, base_url),
        "risk_forecaster": RiskForecasterAgent(supabase_client, openai_api_key, base_url),
        "hallucination_validator": HallucinationValidator(supabase_client, openai_api_key, base_url),
        "data_validator": DataValidatorAgent(supabase_client, openai_api_key, base_url),
        "anomaly_detector": AnomalyDetectorAgent(supabase_client, openai_api_key, base_url)
    }



class AuditSearchAgent(AIAgentBase):
    """
    Audit Search Agent for semantic search over audit logs using RAG
    
    Enables natural language search over audit logs using vector embeddings
    and semantic similarity search with pgvector.
    
    Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
    """
    
    def __init__(self, supabase_client: Client, openai_api_key: str, base_url: Optional[str] = None):
        """
        Initialize Audit Search Agent
        
        Args:
            supabase_client: Supabase client for database operations
            openai_api_key: OpenAI API key for embeddings
            base_url: Optional custom base URL for OpenAI-compatible APIs
        """
        super().__init__(supabase_client, openai_api_key, base_url)
        self.embedding_model = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-ada-002")
        self.embedding_dimension = 1536  # OpenAI ada-002 dimension
        
        logger.info(f"AuditSearchAgent initialized with embedding model: {self.embedding_model}")
    
    async def search_audit_logs(
        self,
        query: str,
        organization_id: str,
        user_id: str,
        limit: int = 50,
        filters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Search audit logs using natural language query with RAG
        
        Args:
            query: Natural language search query
            organization_id: Organization ID for filtering
            user_id: User making the request (for logging)
            limit: Maximum number of results (default 50, max 100)
            filters: Optional filters (date_range, event_types, etc.)
        
        Returns:
            Dict containing search results with relevance scores and highlights
            
        Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
        """
        start_time = datetime.now()
        
        try:
            # Validate inputs
            if not query or len(query.strip()) == 0:
                raise ValueError("Query cannot be empty")
            
            if limit > 100:
                limit = 100  # Cap at 100 results
            
            # Generate embedding for query
            query_embedding = await self._generate_embedding(query)
            
            # Perform semantic search
            results = await self._semantic_search(
                query_embedding,
                organization_id,
                limit,
                filters
            )
            
            # Rank results by relevance
            ranked_results = self._rank_results(query, results)
            
            # Highlight relevant sections
            highlighted_results = self._highlight_results(query, ranked_results)
            
            # Calculate metrics
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            
            # Log search query to audit_logs
            await self._log_search_query(
                query=query,
                organization_id=organization_id,
                user_id=user_id,
                result_count=len(highlighted_results),
                response_time_ms=response_time
            )
            
            # Log operation
            await self.log_operation(
                operation_type="audit_search",
                user_id=user_id,
                inputs={
                    "query": query,
                    "organization_id": organization_id,
                    "limit": limit,
                    "filters": filters
                },
                outputs={
                    "result_count": len(highlighted_results),
                    "top_relevance_score": highlighted_results[0]["relevance_score"] if highlighted_results else 0.0
                },
                response_time_ms=response_time,
                success=True
            )
            
            return {
                "results": highlighted_results,
                "total_results": len(highlighted_results),
                "query": query,
                "search_time_ms": response_time
            }
            
        except Exception as e:
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            
            # Log error
            await self.log_operation(
                operation_type="audit_search",
                user_id=user_id,
                inputs={"query": query, "organization_id": organization_id},
                outputs={},
                response_time_ms=response_time,
                success=False,
                error_message=str(e)
            )
            
            logger.error(f"Audit search failed: {e}")
            raise
    
    async def _generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding for text using OpenAI
        
        Args:
            text: Text to generate embedding for
            
        Returns:
            List of floats representing the embedding vector
            
        Raises:
            Exception: If embedding generation fails
        """
        try:
            response = self.openai_client.embeddings.create(
                model=self.embedding_model,
                input=text
            )
            
            embedding = response.data[0].embedding
            
            # Validate embedding dimension
            if len(embedding) != self.embedding_dimension:
                raise ValueError(
                    f"Expected embedding dimension {self.embedding_dimension}, got {len(embedding)}"
                )
            
            logger.debug(f"Generated embedding for text of length {len(text)}")
            return embedding
            
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            raise
    
    async def _semantic_search(
        self,
        query_embedding: List[float],
        organization_id: str,
        limit: int,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Perform semantic search on audit logs using vector similarity
        
        Args:
            query_embedding: Query embedding vector
            organization_id: Organization ID for filtering
            limit: Maximum number of results
            filters: Optional filters
            
        Returns:
            List of matching audit log entries
            
        Requirements: 14.2
        """
        try:
            # Build filter parameters
            event_types = filters.get("event_types") if filters else None
            start_date = filters.get("start_date") if filters else None
            end_date = filters.get("end_date") if filters else None
            similarity_threshold = filters.get("similarity_threshold", 0.0) if filters else 0.0
            
            # Call the search_audit_logs_semantic RPC function
            # This function was created in migration 028
            result = self.supabase.rpc(
                'search_audit_logs_semantic',
                {
                    'query_embedding': query_embedding,
                    'p_tenant_id': organization_id,
                    'event_types': event_types,
                    'start_date': start_date.isoformat() if start_date else None,
                    'end_date': end_date.isoformat() if end_date else None,
                    'similarity_limit': limit,
                    'similarity_threshold': similarity_threshold
                }
            ).execute()
            
            results = result.data or []
            
            logger.info(f"Semantic search returned {len(results)} results")
            return results
            
        except Exception as e:
            logger.error(f"Semantic search failed: {e}")
            # Return empty list on error
            return []
    
    def _rank_results(self, query: str, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Rank results by relevance (cosine similarity)
        
        Results are already ranked by the database query, but we add
        additional relevance scoring based on query terms.
        
        Args:
            query: Original search query
            results: Search results from database
            
        Returns:
            Ranked results with relevance scores
            
        Requirements: 14.3
        """
        # Results are already sorted by similarity_score from the database
        # We just need to ensure they're in descending order
        ranked = sorted(
            results,
            key=lambda x: x.get('similarity_score', 0.0),
            reverse=True
        )
        
        # Add relevance_score field (same as similarity_score for consistency)
        for result in ranked:
            result['relevance_score'] = result.get('similarity_score', 0.0)
        
        logger.debug(f"Ranked {len(ranked)} results by relevance")
        return ranked
    
    def _highlight_results(self, query: str, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Highlight relevant sections in search results
        
        Args:
            query: Original search query
            results: Ranked search results
            
        Returns:
            Results with highlighted_text field
            
        Requirements: 14.4
        """
        query_terms = set(query.lower().split())
        
        for result in results:
            # Build text to highlight from various fields
            text_parts = []
            
            # Add event type
            if result.get('event_type'):
                text_parts.append(f"Event: {result['event_type']}")
            
            # Add entity info
            if result.get('entity_type'):
                entity_text = f"Entity: {result['entity_type']}"
                if result.get('entity_id'):
                    entity_text += f" ({result['entity_id']})"
                text_parts.append(entity_text)
            
            # Add action details
            if result.get('action_details'):
                details = result['action_details']
                if isinstance(details, dict):
                    # Extract key-value pairs
                    details_text = ", ".join([f"{k}: {v}" for k, v in details.items()])
                    text_parts.append(f"Details: {details_text}")
                else:
                    text_parts.append(f"Details: {str(details)}")
            
            # Add severity and category
            if result.get('severity'):
                text_parts.append(f"Severity: {result['severity']}")
            
            if result.get('category'):
                text_parts.append(f"Category: {result['category']}")
            
            # Add risk level
            if result.get('risk_level'):
                text_parts.append(f"Risk: {result['risk_level']}")
            
            # Add tags
            if result.get('tags'):
                tags = result['tags']
                if isinstance(tags, dict):
                    tags_text = ", ".join([str(v) for v in tags.values()])
                    text_parts.append(f"Tags: {tags_text}")
            
            # Combine all text
            full_text = ". ".join(text_parts)
            
            # Simple highlighting: wrap matching terms in **bold**
            highlighted_text = full_text
            for term in query_terms:
                if len(term) > 2:  # Only highlight terms longer than 2 chars
                    # Case-insensitive replacement
                    import re
                    pattern = re.compile(re.escape(term), re.IGNORECASE)
                    highlighted_text = pattern.sub(f"**{term}**", highlighted_text)
            
            result['highlighted_text'] = highlighted_text
        
        logger.debug(f"Highlighted {len(results)} results")
        return results
    
    async def _log_search_query(
        self,
        query: str,
        organization_id: str,
        user_id: str,
        result_count: int,
        response_time_ms: int
    ):
        """
        Log search query to audit_logs for audit trail
        
        Requirements: 14.5
        """
        try:
            self.supabase.table("audit_logs").insert({
                "organization_id": organization_id,
                "user_id": user_id,
                "action": "audit_search",
                "entity_type": "audit_logs",
                "entity_id": None,
                "details": {
                    "query": query,
                    "result_count": result_count,
                    "response_time_ms": response_time_ms
                },
                "success": True,
                "created_at": datetime.now().isoformat()
            }).execute()
            
            logger.debug(f"Logged search query for user {user_id}")
            
        except Exception as e:
            logger.warning(f"Failed to log search query: {e}")
            # Don't raise - logging failure shouldn't break search

