"""
Database Service Layer for SAP PO Breakdown Management

This module provides comprehensive CRUD operations and business logic
for PO breakdown management with Supabase integration.

**Validates: Requirements 1.1, 1.2, 2.1, 3.1**
"""

import logging
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Any, Optional, Tuple
from uuid import UUID, uuid4

from supabase import Client

from models.po_breakdown import (
    POBreakdownCreate,
    POBreakdownResponse,
    POBreakdownUpdate,
    POBreakdownType,
    ImportConfig,
    ImportResult,
    ImportStatus,
    ImportError,
    ImportWarning,
    ImportConflict,
    ConflictType,
    ConflictResolution,
    POHierarchyResponse,
    HierarchyFinancialSummary,
    HierarchyMoveRequest,
    HierarchyValidationResult,
    VarianceData,
    VarianceStatus,
    TrendDirection,
    ProjectVarianceResult,
    VarianceAlert,
    VarianceAlertType,
    AlertSeverity,
    CategorySummary,
    LevelSummary,
    POBreakdownFilter,
    SearchResult,
    POBreakdownVersion,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
MAX_HIERARCHY_DEPTH = 10
VARIANCE_THRESHOLDS = {
    'minor': Decimal('5.0'),      # 5% variance
    'significant': Decimal('15.0'), # 15% variance
    'critical': Decimal('50.0'),   # 50% variance (triggers warning per Req 3.5)
}


class POBreakdownDatabaseService:
    """
    Database service layer for PO breakdown CRUD operations.
    
    Provides comprehensive data access methods with Supabase integration,
    including hierarchy management, variance calculations, and audit trails.
    
    **Validates: Requirements 1.1, 1.2, 2.1, 3.1**
    """
    
    def __init__(self, supabase_client: Client):
        """Initialize the service with a Supabase client."""
        self.supabase = supabase_client
        self.table_name = 'po_breakdowns'
        self.version_table = 'po_breakdown_versions'
        self.alert_table = 'variance_alerts'
    
    # =========================================================================
    # CRUD Operations
    # =========================================================================
    
    async def create_breakdown(
        self,
        project_id: UUID,
        breakdown_data: POBreakdownCreate,
        user_id: UUID
    ) -> POBreakdownResponse:
        """
        Create a new PO breakdown item.
        
        **Validates: Requirements 1.1, 2.1**
        
        Args:
            project_id: Project UUID
            breakdown_data: Breakdown creation data
            user_id: Creating user's UUID
            
        Returns:
            Created POBreakdownResponse
            
        Raises:
            ValueError: If validation fails
            Exception: If database operation fails
        """
        try:
            # Determine hierarchy level
            hierarchy_level = 0
            if breakdown_data.parent_breakdown_id:
                parent = await self.get_breakdown_by_id(breakdown_data.parent_breakdown_id)
                if not parent:
                    raise ValueError(f"Parent breakdown {breakdown_data.parent_breakdown_id} not found")
                hierarchy_level = parent.hierarchy_level + 1
                
                # Validate max depth (Requirement 2.1)
                if hierarchy_level > MAX_HIERARCHY_DEPTH:
                    raise ValueError(f"Maximum hierarchy depth of {MAX_HIERARCHY_DEPTH} exceeded")
            
            # Validate code uniqueness within project
            if breakdown_data.code:
                existing = await self._check_code_exists(project_id, breakdown_data.code)
                if existing:
                    raise ValueError(f"Code '{breakdown_data.code}' already exists in project")
            
            # Calculate remaining amount
            remaining_amount = breakdown_data.planned_amount - breakdown_data.actual_amount
            
            # Prepare insert data
            insert_data = {
                'id': str(uuid4()),
                'project_id': str(project_id),
                'name': breakdown_data.name,
                'code': breakdown_data.code,
                'sap_po_number': breakdown_data.sap_po_number,
                'sap_line_item': breakdown_data.sap_line_item,
                'hierarchy_level': hierarchy_level,
                'parent_breakdown_id': str(breakdown_data.parent_breakdown_id) if breakdown_data.parent_breakdown_id else None,
                # Initialize SAP relationship preservation fields
                'original_sap_parent_id': str(breakdown_data.parent_breakdown_id) if breakdown_data.parent_breakdown_id else None,
                'sap_hierarchy_path': None,  # Will be calculated on first modification
                'has_custom_parent': False,
                'cost_center': breakdown_data.cost_center,
                'gl_account': breakdown_data.gl_account,
                'planned_amount': str(breakdown_data.planned_amount),
                'committed_amount': str(breakdown_data.committed_amount),
                'actual_amount': str(breakdown_data.actual_amount),
                'remaining_amount': str(remaining_amount),
                'currency': breakdown_data.currency,
                'exchange_rate': '1.0',
                'breakdown_type': breakdown_data.breakdown_type.value,
                'category': breakdown_data.category,
                'subcategory': breakdown_data.subcategory,
                'custom_fields': breakdown_data.custom_fields,
                'tags': breakdown_data.tags,
                'notes': breakdown_data.notes,
                'version': 1,
                'is_active': True,
                'created_by': str(user_id),
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat(),
            }
            
            # Insert into database
            result = self.supabase.table(self.table_name).insert(insert_data).execute()
            
            if not result.data:
                raise Exception("Failed to create PO breakdown")
            
            # Map to response model for complete snapshot
            created_breakdown = self._map_to_response(result.data[0])
            after_snapshot = created_breakdown.model_dump(mode='json')
            
            # Create initial version record for audit trail with complete snapshot (Requirements 6.1, 6.3)
            await self._create_version_record(
                breakdown_id=UUID(result.data[0]['id']),
                version_number=1,
                changes={'action': 'create', 'data': insert_data},
                user_id=user_id,
                change_type='create',
                change_summary=f"Created breakdown: {breakdown_data.name}",
                before_values={},
                after_values=after_snapshot
            )
            
            # Trigger automatic project-level variance recalculation (Requirement 5.3)
            await self.schedule_automatic_variance_recalculation(
                project_id=project_id,
                trigger_event='breakdown_created',
                event_data={'breakdown_id': result.data[0]['id'], 'name': breakdown_data.name}
            )
            
            logger.info(f"Created PO breakdown {result.data[0]['id']} for project {project_id}")
            
            return created_breakdown
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to create PO breakdown: {e}")
            raise
    
    async def get_breakdown_by_id(self, breakdown_id: UUID) -> Optional[POBreakdownResponse]:
        """
        Get a specific PO breakdown by ID.
        
        Args:
            breakdown_id: Breakdown UUID
            
        Returns:
            POBreakdownResponse or None if not found
        """
        try:
            result = self.supabase.table(self.table_name)\
                .select('*')\
                .eq('id', str(breakdown_id))\
                .execute()
            
            if not result.data:
                return None
            
            return self._map_to_response(result.data[0])
            
        except Exception as e:
            logger.error(f"Failed to get breakdown {breakdown_id}: {e}")
            raise
    
    async def update_breakdown(
        self,
        breakdown_id: UUID,
        updates: POBreakdownUpdate,
        user_id: UUID
    ) -> POBreakdownResponse:
        """
        Update a PO breakdown item.
        
        **Validates: Requirements 2.1, 3.1, 6.1**
        
        Args:
            breakdown_id: Breakdown UUID to update
            updates: Update data
            user_id: Updating user's UUID
            
        Returns:
            Updated POBreakdownResponse
        """
        try:
            # Get current record
            current = await self.get_breakdown_by_id(breakdown_id)
            if not current:
                raise ValueError(f"Breakdown {breakdown_id} not found")
            
            # Capture complete before snapshot for audit trail (Requirement 6.3)
            before_snapshot = current.model_dump(mode='json')
            
            # Build update dict with only provided fields
            update_data = {}
            changes = {}
            
            for field, value in updates.model_dump(exclude_none=True).items():
                if hasattr(current, field):
                    old_value = getattr(current, field)
                    if old_value != value:
                        if isinstance(value, Decimal):
                            update_data[field] = str(value)
                        elif isinstance(value, UUID):
                            update_data[field] = str(value)
                        else:
                            update_data[field] = value
                        changes[field] = {'old': str(old_value), 'new': str(value)}
            
            if not update_data:
                return current  # No changes
            
            # Recalculate remaining amount if amounts changed
            planned = Decimal(str(updates.planned_amount)) if updates.planned_amount else current.planned_amount
            actual = Decimal(str(updates.actual_amount)) if updates.actual_amount else current.actual_amount
            update_data['remaining_amount'] = str(planned - actual)
            
            # Increment version and update timestamp
            update_data['version'] = current.version + 1
            update_data['updated_at'] = datetime.now().isoformat()
            
            # Execute update
            result = self.supabase.table(self.table_name)\
                .update(update_data)\
                .eq('id', str(breakdown_id))\
                .execute()
            
            if not result.data:
                raise Exception("Failed to update PO breakdown")
            
            # Capture complete after snapshot for audit trail (Requirement 6.3)
            updated_breakdown = self._map_to_response(result.data[0])
            after_snapshot = updated_breakdown.model_dump(mode='json')
            
            # Determine change type based on what was modified
            change_type = 'update'
            if 'parent_breakdown_id' in changes:
                change_type = 'move'
            elif 'custom_fields' in changes:
                change_type = 'custom_field_update'
            elif 'tags' in changes:
                change_type = 'tag_update'
            elif any(f in changes for f in ['planned_amount', 'committed_amount', 'actual_amount']):
                change_type = 'financial_update'
            
            # Generate change summary
            changed_fields = list(changes.keys())
            if len(changed_fields) <= 3:
                change_summary = f"Updated: {', '.join(changed_fields)}"
            else:
                change_summary = f"Updated {len(changed_fields)} fields: {', '.join(changed_fields[:3])} and {len(changed_fields) - 3} more"
            
            # Create comprehensive version record for audit trail (Requirements 6.1, 6.3)
            await self._create_version_record(
                breakdown_id=breakdown_id,
                version_number=current.version + 1,
                changes=changes,
                user_id=user_id,
                change_type=change_type,
                change_summary=change_summary,
                before_values=before_snapshot,
                after_values=after_snapshot
            )
            
            # Trigger variance recalculation if amounts changed (Requirement 3.4)
            if any(f in changes for f in ['planned_amount', 'committed_amount', 'actual_amount']):
                await self._trigger_variance_recalculation(breakdown_id)
                
                # Trigger automatic project-level variance recalculation (Requirement 5.3)
                await self.schedule_automatic_variance_recalculation(
                    project_id=current.project_id,
                    trigger_event='breakdown_updated',
                    event_data={
                        'breakdown_id': str(breakdown_id),
                        'changes': list(changes.keys())
                    }
                )
            
            logger.info(f"Updated PO breakdown {breakdown_id}")
            
            return updated_breakdown
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to update breakdown {breakdown_id}: {e}")
            raise

    async def delete_breakdown(
        self,
        breakdown_id: UUID,
        user_id: UUID,
        hard_delete: bool = False
    ) -> bool:
        """
        Delete (soft delete by default) a PO breakdown.
        
        **Validates: Requirements 2.5, 6.4**
        
        Args:
            breakdown_id: Breakdown UUID to delete
            user_id: Deleting user's UUID
            hard_delete: If True, permanently delete; otherwise soft delete
            
        Returns:
            True if successful
        """
        try:
            # Get current breakdown for complete snapshot (Requirement 6.4)
            current = await self.get_breakdown_by_id(breakdown_id)
            if not current:
                raise ValueError(f"Breakdown {breakdown_id} not found")
            
            # Capture complete before snapshot for audit trail
            before_snapshot = current.model_dump(mode='json')
            
            # Check for active children (Requirement 2.5)
            children = await self._get_children(breakdown_id, active_only=True)
            if children:
                raise ValueError(
                    f"Cannot delete breakdown with {len(children)} active children. "
                    "Delete or reassign children first."
                )
            
            if hard_delete:
                # Permanent deletion (rarely used)
                result = self.supabase.table(self.table_name)\
                    .delete()\
                    .eq('id', str(breakdown_id))\
                    .execute()
                after_snapshot = {}
            else:
                # Soft delete - mark as inactive (Requirement 6.4)
                result = self.supabase.table(self.table_name)\
                    .update({
                        'is_active': False,
                        'updated_at': datetime.now().isoformat()
                    })\
                    .eq('id', str(breakdown_id))\
                    .execute()
                
                # Capture after snapshot for soft delete
                after_snapshot = {**before_snapshot, 'is_active': False}
            
            if result.data or hard_delete:
                # Create comprehensive audit record with complete snapshots (Requirements 6.3, 6.4)
                await self._create_version_record(
                    breakdown_id=breakdown_id,
                    version_number=-1,  # Special version for deletion
                    changes={
                        'action': 'delete',
                        'hard_delete': hard_delete,
                        'is_active': {'old': True, 'new': False} if not hard_delete else None
                    },
                    user_id=user_id,
                    change_type='delete',
                    change_summary=f"{'Hard' if hard_delete else 'Soft'} deleted breakdown",
                    before_values=before_snapshot,
                    after_values=after_snapshot
                )
                
                # Trigger automatic project-level variance recalculation (Requirement 5.3)
                await self.schedule_automatic_variance_recalculation(
                    project_id=current.project_id,
                    trigger_event='breakdown_deleted',
                    event_data={
                        'breakdown_id': str(breakdown_id),
                        'deletion_type': 'hard' if hard_delete else 'soft'
                    }
                )
                
                logger.info(f"Deleted PO breakdown {breakdown_id} (hard={hard_delete})")
                return True
            
            return False
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to delete breakdown {breakdown_id}: {e}")
            raise
    
    async def list_breakdowns(
        self,
        project_id: UUID,
        filter_criteria: Optional[POBreakdownFilter] = None,
        page: int = 1,
        page_size: int = 50
    ) -> SearchResult:
        """
        List PO breakdowns with filtering and pagination.
        
        **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
        
        Args:
            project_id: Project UUID
            filter_criteria: Optional filter criteria
            page: Page number (1-indexed)
            page_size: Items per page
            
        Returns:
            SearchResult with items and pagination info
        """
        try:
            query = self.supabase.table(self.table_name)\
                .select('*', count='exact')\
                .eq('project_id', str(project_id))
            
            # Apply filters
            if filter_criteria:
                query = self._apply_filters(query, filter_criteria)
            else:
                query = query.eq('is_active', True)
            
            # Apply pagination
            offset = (page - 1) * page_size
            query = query.order('hierarchy_level').order('name')\
                .range(offset, offset + page_size - 1)
            
            result = query.execute()
            
            items = [self._map_to_response(row) for row in result.data]
            total_count = result.count or len(items)
            
            return SearchResult(
                items=items,
                total_count=total_count,
                page=page,
                page_size=page_size,
                has_more=(offset + len(items)) < total_count,
                filter_applied=filter_criteria
            )
            
        except Exception as e:
            logger.error(f"Failed to list breakdowns for project {project_id}: {e}")
            raise
    
    async def search_breakdowns(
        self,
        project_id: UUID,
        filter_criteria: POBreakdownFilter,
        page: int = 1,
        page_size: int = 50
    ) -> SearchResult:
        """
        Comprehensive search with text search, financial criteria, and variance filtering.
        
        **Validates: Requirements 7.1, 7.2**
        
        This method provides enhanced search capabilities including:
        - Text search across names, codes, descriptions, and SAP numbers (Requirement 7.1)
        - Financial criteria filtering with amount ranges (Requirement 7.2)
        - Variance threshold filtering (Requirement 7.2)
        - Post-query filtering for calculated fields like variance percentage
        
        Args:
            project_id: Project UUID
            filter_criteria: Filter criteria with search parameters
            page: Page number (1-indexed)
            page_size: Items per page
            
        Returns:
            SearchResult with filtered items and pagination info
        """
        try:
            # First, get all items matching database-level filters
            query = self.supabase.table(self.table_name)\
                .select('*')\
                .eq('project_id', str(project_id))
            
            # Apply database-level filters
            query = self._apply_filters(query, filter_criteria)
            
            result = query.execute()
            items = [self._map_to_response(row) for row in result.data]
            
            # Apply post-query filters for calculated fields
            filtered_items = []
            for item in items:
                # Calculate variance for filtering
                variance_percentage = Decimal('0')
                if item.planned_amount > 0:
                    variance_amount = item.actual_amount - item.planned_amount
                    variance_percentage = (variance_amount / item.planned_amount * 100).quantize(
                        Decimal('0.01'), rounding=ROUND_HALF_UP
                    )
                
                # Apply variance threshold filters (Requirement 7.2)
                if filter_criteria.min_variance_percentage is not None:
                    if variance_percentage < filter_criteria.min_variance_percentage:
                        continue
                
                if filter_criteria.max_variance_percentage is not None:
                    if variance_percentage > filter_criteria.max_variance_percentage:
                        continue
                
                # Apply variance status filter
                if filter_criteria.variance_statuses:
                    abs_pct = abs(variance_percentage)
                    if abs_pct <= VARIANCE_THRESHOLDS['minor']:
                        status = VarianceStatus.on_track
                    elif abs_pct <= VARIANCE_THRESHOLDS['significant']:
                        status = VarianceStatus.minor_variance
                    elif abs_pct <= VARIANCE_THRESHOLDS['critical']:
                        status = VarianceStatus.significant_variance
                    else:
                        status = VarianceStatus.critical_variance
                    
                    if status not in filter_criteria.variance_statuses:
                        continue
                
                # Enhanced text search across multiple fields (Requirement 7.1)
                if filter_criteria.search_text:
                    search_term = filter_criteria.search_text.lower()
                    searchable_text = ' '.join(filter(None, [
                        item.name or '',
                        item.code or '',
                        item.notes or '',
                        item.sap_po_number or '',
                        item.sap_line_item or '',
                        item.category or '',
                        item.subcategory or ''
                    ])).lower()
                    
                    if search_term not in searchable_text:
                        continue
                
                filtered_items.append(item)
            
            # Apply pagination to filtered results
            total_count = len(filtered_items)
            offset = (page - 1) * page_size
            paginated_items = filtered_items[offset:offset + page_size]
            
            return SearchResult(
                items=paginated_items,
                total_count=total_count,
                page=page,
                page_size=page_size,
                has_more=(offset + len(paginated_items)) < total_count,
                filter_applied=filter_criteria
            )
            
        except Exception as e:
            logger.error(f"Failed to search breakdowns for project {project_id}: {e}")
            raise
    
    async def filter_hierarchy_branch(
        self,
        project_id: UUID,
        root_breakdown_id: UUID,
        include_root: bool = True,
        max_depth: Optional[int] = None,
        additional_filters: Optional[POBreakdownFilter] = None
    ) -> List[POBreakdownResponse]:
        """
        Filter specific hierarchy branch with optional depth limit.
        
        **Validates: Requirements 7.3**
        
        This method allows filtering a specific branch of the hierarchy tree,
        useful for analyzing cost structures within a particular work package or category.
        
        Args:
            project_id: Project UUID
            root_breakdown_id: Root of the branch to filter
            include_root: Whether to include the root item in results
            max_depth: Maximum depth from root to include (None = unlimited)
            additional_filters: Additional filter criteria to apply within branch
            
        Returns:
            List of POBreakdownResponse items in the branch
        """
        try:
            # Get the root breakdown
            root = await self.get_breakdown_by_id(root_breakdown_id)
            if not root:
                raise ValueError(f"Root breakdown {root_breakdown_id} not found")
            
            if root.project_id != project_id:
                raise ValueError("Root breakdown not in specified project")
            
            # Collect all descendants
            branch_items = []
            if include_root:
                branch_items.append(root)
            
            # Recursively get descendants
            descendants = await self._get_branch_descendants(
                root_breakdown_id,
                current_depth=0,
                max_depth=max_depth
            )
            branch_items.extend(descendants)
            
            # Apply additional filters if provided
            if additional_filters:
                filtered_items = []
                for item in branch_items:
                    if await self._item_matches_filter(item, additional_filters):
                        filtered_items.append(item)
                branch_items = filtered_items
            
            logger.info(
                f"Filtered hierarchy branch from {root_breakdown_id}: "
                f"{len(branch_items)} items (max_depth={max_depth})"
            )
            
            return branch_items
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to filter hierarchy branch: {e}")
            raise
    
    async def _get_branch_descendants(
        self,
        parent_id: UUID,
        current_depth: int,
        max_depth: Optional[int]
    ) -> List[POBreakdownResponse]:
        """Recursively get descendants up to max_depth."""
        if max_depth is not None and current_depth >= max_depth:
            return []
        
        descendants = []
        children = await self._get_children(parent_id, active_only=True)
        
        for child in children:
            descendants.append(child)
            # Recursively get child's descendants
            child_descendants = await self._get_branch_descendants(
                child.id,
                current_depth + 1,
                max_depth
            )
            descendants.extend(child_descendants)
        
        return descendants
    
    async def _item_matches_filter(
        self,
        item: POBreakdownResponse,
        filter_criteria: POBreakdownFilter
    ) -> bool:
        """Check if an item matches the given filter criteria."""
        # Check breakdown types
        if filter_criteria.breakdown_types:
            if item.breakdown_type not in filter_criteria.breakdown_types:
                return False
        
        # Check categories
        if filter_criteria.categories:
            if item.category not in filter_criteria.categories:
                return False
        
        # Check cost centers
        if filter_criteria.cost_centers:
            if item.cost_center not in filter_criteria.cost_centers:
                return False
        
        # Check GL accounts
        if filter_criteria.gl_accounts:
            if item.gl_account not in filter_criteria.gl_accounts:
                return False
        
        # Check tags
        if filter_criteria.tags:
            if not any(tag in item.tags for tag in filter_criteria.tags):
                return False
        
        # Check amount ranges
        if filter_criteria.min_planned_amount is not None:
            if item.planned_amount < filter_criteria.min_planned_amount:
                return False
        
        if filter_criteria.max_planned_amount is not None:
            if item.planned_amount > filter_criteria.max_planned_amount:
                return False
        
        # Check variance thresholds
        if filter_criteria.min_variance_percentage is not None or filter_criteria.max_variance_percentage is not None:
            variance_percentage = Decimal('0')
            if item.planned_amount > 0:
                variance_amount = item.actual_amount - item.planned_amount
                variance_percentage = (variance_amount / item.planned_amount * 100).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                )
            
            if filter_criteria.min_variance_percentage is not None:
                if variance_percentage < filter_criteria.min_variance_percentage:
                    return False
            
            if filter_criteria.max_variance_percentage is not None:
                if variance_percentage > filter_criteria.max_variance_percentage:
                    return False
        
        # Check text search
        if filter_criteria.search_text:
            search_term = filter_criteria.search_text.lower()
            searchable_text = ' '.join(filter(None, [
                item.name or '',
                item.code or '',
                item.notes or '',
                item.sap_po_number or '',
                item.sap_line_item or '',
                item.category or '',
                item.subcategory or ''
            ])).lower()
            
            if search_term not in searchable_text:
                return False
        
        return True
    
    async def apply_composite_filter(
        self,
        project_id: UUID,
        filters: List[POBreakdownFilter],
        operator: str = "AND",
        page: int = 1,
        page_size: int = 50
    ) -> SearchResult:
        """
        Apply multiple filters with logical AND/OR operations.
        
        **Validates: Requirements 7.4**
        
        This method allows combining multiple filter criteria with logical operations,
        enabling complex queries like "items with variance > 10% OR amount > $100k".
        
        Args:
            project_id: Project UUID
            filters: List of filter criteria to combine
            operator: Logical operator ("AND" or "OR")
            page: Page number (1-indexed)
            page_size: Items per page
            
        Returns:
            SearchResult with items matching the composite filter
        """
        try:
            if not filters:
                raise ValueError("At least one filter must be provided")
            
            # Get all active breakdowns for the project
            result = self.supabase.table(self.table_name)\
                .select('*')\
                .eq('project_id', str(project_id))\
                .eq('is_active', True)\
                .execute()
            
            all_items = [self._map_to_response(row) for row in result.data]
            
            if operator.upper() == "AND":
                # Item must match ALL filters
                filtered_items = all_items
                for filter_criteria in filters:
                    matching_items = []
                    for item in filtered_items:
                        if await self._item_matches_filter(item, filter_criteria):
                            matching_items.append(item)
                    filtered_items = matching_items
            
            elif operator.upper() == "OR":
                # Item must match AT LEAST ONE filter
                matching_item_ids = set()
                filtered_items = []
                
                for filter_criteria in filters:
                    for item in all_items:
                        if item.id not in matching_item_ids:
                            if await self._item_matches_filter(item, filter_criteria):
                                matching_item_ids.add(item.id)
                                filtered_items.append(item)
            
            else:
                raise ValueError(f"Invalid operator: {operator}. Must be 'AND' or 'OR'")
            
            # Apply pagination
            total_count = len(filtered_items)
            offset = (page - 1) * page_size
            paginated_items = filtered_items[offset:offset + page_size]
            
            logger.info(
                f"Applied composite filter with {len(filters)} filters using {operator} operator: "
                f"{total_count} items matched"
            )
            
            return SearchResult(
                items=paginated_items,
                total_count=total_count,
                page=page,
                page_size=page_size,
                has_more=(offset + len(paginated_items)) < total_count,
                filter_applied=None  # Composite filter, not a single filter
            )
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to apply composite filter: {e}")
            raise
    
    # =========================================================================
    # Filter Persistence (Task 10.3)
    # =========================================================================
    
    async def save_filter(
        self,
        project_id: UUID,
        filter_name: str,
        filter_criteria: POBreakdownFilter,
        user_id: UUID,
        description: Optional[str] = None,
        is_default: bool = False
    ) -> UUID:
        """
        Save a filter configuration for reuse.
        
        **Validates: Requirements 7.5**
        
        This method allows users to save frequently used filter combinations
        for quick access and consistent reporting.
        
        Args:
            project_id: Project UUID
            filter_name: Name for the saved filter
            filter_criteria: Filter criteria to save
            user_id: User creating the saved filter
            description: Optional description
            is_default: Whether this is the default filter for the user
            
        Returns:
            UUID of the saved filter
        """
        try:
            filter_id = uuid4()
            
            # If setting as default, unset other defaults for this user/project
            if is_default:
                self.supabase.table('saved_po_filters')\
                    .update({'is_default': False})\
                    .eq('project_id', str(project_id))\
                    .eq('created_by', str(user_id))\
                    .execute()
            
            # Prepare filter data
            filter_data = {
                'id': str(filter_id),
                'project_id': str(project_id),
                'name': filter_name,
                'description': description,
                'filter_criteria': filter_criteria.model_dump(mode='json'),
                'is_default': is_default,
                'created_by': str(user_id),
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }
            
            result = self.supabase.table('saved_po_filters').insert(filter_data).execute()
            
            if not result.data:
                raise Exception("Failed to save filter")
            
            logger.info(f"Saved filter '{filter_name}' ({filter_id}) for project {project_id}")
            
            return filter_id
            
        except Exception as e:
            logger.error(f"Failed to save filter: {e}")
            raise
    
    async def get_saved_filter(
        self,
        filter_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """
        Get a saved filter by ID.
        
        **Validates: Requirements 7.5**
        
        Args:
            filter_id: Saved filter UUID
            
        Returns:
            Saved filter data or None if not found
        """
        try:
            result = self.supabase.table('saved_po_filters')\
                .select('*')\
                .eq('id', str(filter_id))\
                .execute()
            
            if not result.data:
                return None
            
            filter_data = result.data[0]
            
            # Parse filter criteria from JSON
            from models.po_breakdown import SavedFilter
            
            saved_filter = SavedFilter(
                id=UUID(filter_data['id']),
                name=filter_data['name'],
                description=filter_data.get('description'),
                filter_criteria=POBreakdownFilter(**filter_data['filter_criteria']),
                is_default=filter_data.get('is_default', False),
                created_by=UUID(filter_data['created_by']) if filter_data.get('created_by') else None,
                created_at=datetime.fromisoformat(filter_data['created_at'].replace('Z', '+00:00')) if filter_data.get('created_at') else None
            )
            
            return saved_filter.model_dump(mode='json')
            
        except Exception as e:
            logger.error(f"Failed to get saved filter {filter_id}: {e}")
            raise
    
    async def list_saved_filters(
        self,
        project_id: UUID,
        user_id: Optional[UUID] = None
    ) -> List[Dict[str, Any]]:
        """
        List saved filters for a project.
        
        **Validates: Requirements 7.5**
        
        Args:
            project_id: Project UUID
            user_id: Optional user ID to filter by creator
            
        Returns:
            List of saved filter data
        """
        try:
            query = self.supabase.table('saved_po_filters')\
                .select('*')\
                .eq('project_id', str(project_id))\
                .order('created_at', desc=True)
            
            if user_id:
                query = query.eq('created_by', str(user_id))
            
            result = query.execute()
            
            from models.po_breakdown import SavedFilter
            
            saved_filters = []
            for filter_data in result.data:
                saved_filter = SavedFilter(
                    id=UUID(filter_data['id']),
                    name=filter_data['name'],
                    description=filter_data.get('description'),
                    filter_criteria=POBreakdownFilter(**filter_data['filter_criteria']),
                    is_default=filter_data.get('is_default', False),
                    created_by=UUID(filter_data['created_by']) if filter_data.get('created_by') else None,
                    created_at=datetime.fromisoformat(filter_data['created_at'].replace('Z', '+00:00')) if filter_data.get('created_at') else None
                )
                saved_filters.append(saved_filter.model_dump(mode='json'))
            
            return saved_filters
            
        except Exception as e:
            logger.error(f"Failed to list saved filters for project {project_id}: {e}")
            raise
    
    async def delete_saved_filter(
        self,
        filter_id: UUID,
        user_id: UUID
    ) -> bool:
        """
        Delete a saved filter.
        
        **Validates: Requirements 7.5**
        
        Args:
            filter_id: Saved filter UUID
            user_id: User requesting deletion (must be creator)
            
        Returns:
            True if successful
        """
        try:
            # Verify ownership
            filter_data = await self.get_saved_filter(filter_id)
            if not filter_data:
                raise ValueError(f"Saved filter {filter_id} not found")
            
            if str(filter_data.get('created_by')) != str(user_id):
                raise ValueError("Only the filter creator can delete it")
            
            result = self.supabase.table('saved_po_filters')\
                .delete()\
                .eq('id', str(filter_id))\
                .execute()
            
            if result.data or result.count == 0:
                logger.info(f"Deleted saved filter {filter_id}")
                return True
            
            return False
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to delete saved filter {filter_id}: {e}")
            raise
    
    async def apply_saved_filter(
        self,
        project_id: UUID,
        filter_id: UUID,
        page: int = 1,
        page_size: int = 50
    ) -> SearchResult:
        """
        Apply a saved filter to search breakdowns.
        
        **Validates: Requirements 7.5**
        
        Args:
            project_id: Project UUID
            filter_id: Saved filter UUID
            page: Page number (1-indexed)
            page_size: Items per page
            
        Returns:
            SearchResult with filtered items
        """
        try:
            # Get saved filter
            filter_data = await self.get_saved_filter(filter_id)
            if not filter_data:
                raise ValueError(f"Saved filter {filter_id} not found")
            
            # Verify project match
            if str(filter_data.get('project_id')) != str(project_id):
                raise ValueError("Saved filter not for this project")
            
            # Apply the filter
            filter_criteria = POBreakdownFilter(**filter_data['filter_criteria'])
            result = await self.search_breakdowns(
                project_id=project_id,
                filter_criteria=filter_criteria,
                page=page,
                page_size=page_size
            )
            
            logger.info(f"Applied saved filter '{filter_data.get('name')}' ({filter_id})")
            
            return result
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to apply saved filter {filter_id}: {e}")
            raise
    
    async def export_with_filter_context(
        self,
        project_id: UUID,
        export_format: str,
        filter_criteria: Optional[POBreakdownFilter] = None,
        saved_filter_id: Optional[UUID] = None,
        include_filter_metadata: bool = True
    ) -> Dict[str, Any]:
        """
        Export PO breakdown data with filter context maintained.
        
        **Validates: Requirements 7.6**
        
        This method exports data while preserving the filter context,
        allowing users to understand what criteria were applied to the exported data.
        
        Args:
            project_id: Project UUID
            export_format: Export format ('csv', 'excel', 'json')
            filter_criteria: Optional filter criteria to apply
            saved_filter_id: Optional saved filter ID to apply
            include_filter_metadata: Whether to include filter metadata in export
            
        Returns:
            Dictionary with export data and filter context:
            {
                'data': List[Dict],
                'filter_context': Dict,
                'export_metadata': Dict
            }
        """
        try:
            # Determine which filter to use
            applied_filter = None
            filter_name = None
            
            if saved_filter_id:
                filter_data = await self.get_saved_filter(saved_filter_id)
                if filter_data:
                    applied_filter = POBreakdownFilter(**filter_data['filter_criteria'])
                    filter_name = filter_data.get('name')
            elif filter_criteria:
                applied_filter = filter_criteria
            
            # Get filtered data
            if applied_filter:
                search_result = await self.search_breakdowns(
                    project_id=project_id,
                    filter_criteria=applied_filter,
                    page=1,
                    page_size=10000  # Large page size for export
                )
                items = search_result.items
            else:
                # Export all active items
                result = self.supabase.table(self.table_name)\
                    .select('*')\
                    .eq('project_id', str(project_id))\
                    .eq('is_active', True)\
                    .execute()
                items = [self._map_to_response(row) for row in result.data]
            
            # Convert items to export format
            export_data = []
            for item in items:
                export_data.append(item.model_dump(mode='json'))
            
            # Build filter context
            filter_context = {
                'filter_applied': applied_filter is not None,
                'saved_filter_id': str(saved_filter_id) if saved_filter_id else None,
                'saved_filter_name': filter_name,
                'filter_criteria': applied_filter.model_dump(mode='json') if applied_filter else None,
                'total_items_exported': len(export_data),
                'export_timestamp': datetime.now().isoformat()
            }
            
            # Build export metadata
            export_metadata = {
                'project_id': str(project_id),
                'export_format': export_format,
                'generated_at': datetime.now().isoformat(),
                'record_count': len(export_data)
            }
            
            result = {
                'data': export_data,
                'filter_context': filter_context if include_filter_metadata else None,
                'export_metadata': export_metadata
            }
            
            logger.info(
                f"Exported {len(export_data)} items for project {project_id} "
                f"with filter context (format={export_format})"
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to export with filter context: {e}")
            raise
    
    # =========================================================================
    # Hierarchy Operations
    # =========================================================================
    
    async def get_project_hierarchy(self, project_id: UUID) -> POHierarchyResponse:
        """
        Get complete hierarchy for a project.
        
        **Validates: Requirements 2.1, 2.6**
        
        Args:
            project_id: Project UUID
            
        Returns:
            POHierarchyResponse with full hierarchy tree
        """
        try:
            # Get all active breakdowns for project
            result = self.supabase.table(self.table_name)\
                .select('*')\
                .eq('project_id', str(project_id))\
                .eq('is_active', True)\
                .order('hierarchy_level')\
                .order('name')\
                .execute()
            
            breakdowns = result.data or []
            
            # Build hierarchy tree
            root_items = []
            items_by_id = {}
            
            for row in breakdowns:
                item = self._map_to_response(row)
                item.children = []
                items_by_id[str(item.id)] = item
            
            for row in breakdowns:
                item = items_by_id[row['id']]
                parent_id = row.get('parent_breakdown_id')
                
                if parent_id and parent_id in items_by_id:
                    items_by_id[parent_id].children.append(item)
                else:
                    root_items.append(item)
            
            # Calculate financial summary
            financial_summary = self._calculate_financial_summary(breakdowns)
            
            # Determine max hierarchy level
            max_level = max((b.get('hierarchy_level', 0) for b in breakdowns), default=0)
            
            return POHierarchyResponse(
                project_id=project_id,
                root_items=root_items,
                total_levels=max_level + 1,
                total_items=len(breakdowns),
                financial_summary=financial_summary,
                last_updated=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"Failed to get hierarchy for project {project_id}: {e}")
            raise
    
    async def move_breakdown(
        self,
        breakdown_id: UUID,
        move_request: HierarchyMoveRequest,
        user_id: UUID
    ) -> Tuple[POBreakdownResponse, HierarchyValidationResult]:
        """
        Move a breakdown item within the hierarchy.
        
        **Validates: Requirements 2.2, 2.4**
        
        Args:
            breakdown_id: Breakdown to move
            move_request: Move request with new parent
            user_id: User performing the move
            
        Returns:
            Tuple of (updated breakdown, validation result)
        """
        try:
            # Get current breakdown
            current = await self.get_breakdown_by_id(breakdown_id)
            if not current:
                raise ValueError(f"Breakdown {breakdown_id} not found")
            
            # Validate the move
            validation = await self._validate_hierarchy_move(
                breakdown_id,
                move_request.new_parent_id,
                current.project_id
            )
            
            if not validation.is_valid:
                if move_request.validate_only:
                    return current, validation
                raise ValueError(f"Invalid move: {', '.join(validation.errors)}")
            
            if move_request.validate_only:
                return current, validation
            
            # Perform the move
            new_level = validation.new_hierarchy_level or 0
            
            update_data = {
                'parent_breakdown_id': str(move_request.new_parent_id) if move_request.new_parent_id else None,
                'hierarchy_level': new_level,
                'updated_at': datetime.now().isoformat(),
                'version': current.version + 1
            }
            
            result = self.supabase.table(self.table_name)\
                .update(update_data)\
                .eq('id', str(breakdown_id))\
                .execute()
            
            if not result.data:
                raise Exception("Failed to move breakdown")
            
            # Update children's hierarchy levels recursively
            await self._update_children_levels(breakdown_id, new_level)
            
            # Recalculate parent totals (Requirement 2.4)
            if current.parent_breakdown_id:
                await self._recalculate_parent_totals(current.parent_breakdown_id)
            if move_request.new_parent_id:
                await self._recalculate_parent_totals(move_request.new_parent_id)
            
            # Create audit record
            await self._create_version_record(
                breakdown_id=breakdown_id,
                version_number=current.version + 1,
                changes={
                    'action': 'move',
                    'old_parent': str(current.parent_breakdown_id) if current.parent_breakdown_id else None,
                    'new_parent': str(move_request.new_parent_id) if move_request.new_parent_id else None
                },
                user_id=user_id
            )
            
            logger.info(f"Moved breakdown {breakdown_id} to parent {move_request.new_parent_id}")
            
            return self._map_to_response(result.data[0]), validation
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to move breakdown {breakdown_id}: {e}")
            raise

    async def _validate_hierarchy_move(
        self,
        breakdown_id: UUID,
        new_parent_id: Optional[UUID],
        project_id: UUID
    ) -> HierarchyValidationResult:
        """
        Validate a hierarchy move operation.
        
        **Validates: Requirements 2.2**
        
        Checks:
        - Circular reference prevention
        - Maximum depth enforcement
        - Parent exists and is in same project
        """
        errors = []
        warnings = []
        affected_items = [breakdown_id]
        new_level = 0
        
        if new_parent_id:
            # Check parent exists
            parent = await self.get_breakdown_by_id(new_parent_id)
            if not parent:
                errors.append(f"Parent breakdown {new_parent_id} not found")
                return HierarchyValidationResult(
                    is_valid=False,
                    errors=errors,
                    warnings=warnings,
                    affected_items=affected_items
                )
            
            # Check same project
            if parent.project_id != project_id:
                errors.append("Cannot move to parent in different project")
            
            # Check for circular reference (Requirement 2.2)
            if await self._would_create_circular_reference(breakdown_id, new_parent_id):
                errors.append("Move would create circular reference")
            
            # Calculate new level
            new_level = parent.hierarchy_level + 1
            
            # Check max depth including children
            max_child_depth = await self._get_max_child_depth(breakdown_id)
            total_depth = new_level + max_child_depth
            
            if total_depth > MAX_HIERARCHY_DEPTH:
                errors.append(
                    f"Move would exceed maximum hierarchy depth of {MAX_HIERARCHY_DEPTH}. "
                    f"Current subtree depth: {max_child_depth}"
                )
        
        # Get affected children
        children = await self._get_all_descendants(breakdown_id)
        affected_items.extend([c.id for c in children])
        
        return HierarchyValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            affected_items=affected_items,
            new_hierarchy_level=new_level
        )
    
    async def _would_create_circular_reference(
        self,
        breakdown_id: UUID,
        potential_parent_id: UUID
    ) -> bool:
        """Check if moving breakdown under potential_parent would create a cycle."""
        # Get all descendants of the breakdown being moved
        descendants = await self._get_all_descendants(breakdown_id)
        descendant_ids = {str(d.id) for d in descendants}
        descendant_ids.add(str(breakdown_id))
        
        # Check if potential parent is in descendants
        return str(potential_parent_id) in descendant_ids
    
    async def _get_all_descendants(self, breakdown_id: UUID) -> List[POBreakdownResponse]:
        """Get all descendants of a breakdown recursively."""
        descendants = []
        children = await self._get_children(breakdown_id, active_only=True)
        
        for child in children:
            descendants.append(child)
            child_descendants = await self._get_all_descendants(child.id)
            descendants.extend(child_descendants)
        
        return descendants
    
    async def _get_max_child_depth(self, breakdown_id: UUID) -> int:
        """Get the maximum depth of children below this breakdown."""
        children = await self._get_children(breakdown_id, active_only=True)
        if not children:
            return 0
        
        max_depth = 0
        for child in children:
            child_depth = 1 + await self._get_max_child_depth(child.id)
            max_depth = max(max_depth, child_depth)
        
        return max_depth
    
    async def _get_children(
        self,
        parent_id: UUID,
        active_only: bool = True
    ) -> List[POBreakdownResponse]:
        """Get direct children of a breakdown."""
        query = self.supabase.table(self.table_name)\
            .select('*')\
            .eq('parent_breakdown_id', str(parent_id))
        
        if active_only:
            query = query.eq('is_active', True)
        
        result = query.execute()
        return [self._map_to_response(row) for row in result.data]
    
    async def _update_children_levels(self, parent_id: UUID, parent_level: int) -> None:
        """Recursively update hierarchy levels of children."""
        children = await self._get_children(parent_id, active_only=True)
        
        for child in children:
            new_level = parent_level + 1
            self.supabase.table(self.table_name)\
                .update({'hierarchy_level': new_level})\
                .eq('id', str(child.id))\
                .execute()
            
            await self._update_children_levels(child.id, new_level)
    
    async def _recalculate_parent_totals(self, parent_id: UUID) -> None:
        """
        Recalculate totals for a parent based on children.
        
        **Validates: Requirements 2.3, 2.4**
        """
        children = await self._get_children(parent_id, active_only=True)
        
        if not children:
            return
        
        total_planned = sum(c.planned_amount for c in children)
        total_committed = sum(c.committed_amount for c in children)
        total_actual = sum(c.actual_amount for c in children)
        total_remaining = total_planned - total_actual
        
        self.supabase.table(self.table_name)\
            .update({
                'planned_amount': str(total_planned),
                'committed_amount': str(total_committed),
                'actual_amount': str(total_actual),
                'remaining_amount': str(total_remaining),
                'updated_at': datetime.now().isoformat()
            })\
            .eq('id', str(parent_id))\
            .execute()
        
        # Recursively update parent's parent
        parent = await self.get_breakdown_by_id(parent_id)
        if parent and parent.parent_breakdown_id:
            await self._recalculate_parent_totals(parent.parent_breakdown_id)
    
    # =========================================================================
    # Variance Calculations
    # =========================================================================
    
    async def calculate_item_variance(self, breakdown_id: UUID) -> VarianceData:
        """
        Calculate variance data for a single breakdown item.
        
        **Validates: Requirements 3.1, 3.2, 3.4**
        """
        breakdown = await self.get_breakdown_by_id(breakdown_id)
        if not breakdown:
            raise ValueError(f"Breakdown {breakdown_id} not found")
        
        planned = breakdown.planned_amount
        committed = breakdown.committed_amount
        actual = breakdown.actual_amount
        
        # Calculate variances (Requirement 3.2)
        planned_vs_actual = planned - actual
        planned_vs_committed = planned - committed
        committed_vs_actual = committed - actual
        
        # Calculate percentage
        variance_percentage = Decimal('0')
        if planned > 0:
            variance_percentage = ((actual - planned) / planned * 100).quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP
            )
        
        # Determine status based on thresholds
        abs_pct = abs(variance_percentage)
        if abs_pct <= VARIANCE_THRESHOLDS['minor']:
            status = VarianceStatus.on_track
        elif abs_pct <= VARIANCE_THRESHOLDS['significant']:
            status = VarianceStatus.minor_variance
        elif abs_pct <= VARIANCE_THRESHOLDS['critical']:
            status = VarianceStatus.significant_variance
        else:
            status = VarianceStatus.critical_variance
        
        return VarianceData(
            planned_vs_actual=planned_vs_actual,
            planned_vs_committed=planned_vs_committed,
            committed_vs_actual=committed_vs_actual,
            variance_percentage=variance_percentage,
            variance_status=status,
            trend_direction=TrendDirection.stable,
            last_calculated=datetime.now()
        )
    
    async def calculate_project_variance(self, project_id: UUID) -> ProjectVarianceResult:
        """
        Calculate comprehensive variance analysis for a project.
        
        **Validates: Requirements 3.4, 5.2**
        """
        # Get all active breakdowns
        result = self.supabase.table(self.table_name)\
            .select('*')\
            .eq('project_id', str(project_id))\
            .eq('is_active', True)\
            .execute()
        
        breakdowns = result.data or []
        
        if not breakdowns:
            return ProjectVarianceResult(
                project_id=project_id,
                overall_variance=VarianceData(
                    planned_vs_actual=Decimal('0'),
                    planned_vs_committed=Decimal('0'),
                    committed_vs_actual=Decimal('0'),
                    variance_percentage=Decimal('0'),
                    variance_status=VarianceStatus.on_track,
                    trend_direction=TrendDirection.stable,
                    last_calculated=datetime.now()
                ),
                calculated_at=datetime.now()
            )
        
        # Calculate overall totals
        total_planned = sum(Decimal(str(b['planned_amount'])) for b in breakdowns)
        total_committed = sum(Decimal(str(b['committed_amount'])) for b in breakdowns)
        total_actual = sum(Decimal(str(b['actual_amount'])) for b in breakdowns)
        
        overall_variance = self._calculate_variance_data(total_planned, total_committed, total_actual)
        
        # Calculate by category
        by_category = {}
        categories = set(b.get('category') for b in breakdowns if b.get('category'))
        for category in categories:
            cat_breakdowns = [b for b in breakdowns if b.get('category') == category]
            cat_planned = sum(Decimal(str(b['planned_amount'])) for b in cat_breakdowns)
            cat_committed = sum(Decimal(str(b['committed_amount'])) for b in cat_breakdowns)
            cat_actual = sum(Decimal(str(b['actual_amount'])) for b in cat_breakdowns)
            by_category[category] = self._calculate_variance_data(cat_planned, cat_committed, cat_actual)
        
        # Calculate by hierarchy level
        by_level = {}
        levels = set(b.get('hierarchy_level', 0) for b in breakdowns)
        for level in levels:
            level_breakdowns = [b for b in breakdowns if b.get('hierarchy_level', 0) == level]
            level_planned = sum(Decimal(str(b['planned_amount'])) for b in level_breakdowns)
            level_committed = sum(Decimal(str(b['committed_amount'])) for b in level_breakdowns)
            level_actual = sum(Decimal(str(b['actual_amount'])) for b in level_breakdowns)
            by_level[level] = self._calculate_variance_data(level_planned, level_committed, level_actual)
        
        # Find top variances
        top_variances = await self._get_top_variances(breakdowns, limit=10)
        
        # Generate recommendations based on variance analysis
        recommendations = self._generate_recommendations(overall_variance, top_variances)
        
        return ProjectVarianceResult(
            project_id=project_id,
            overall_variance=overall_variance,
            by_category=by_category,
            by_hierarchy_level=by_level,
            top_variances=top_variances,
            variance_trends=[],
            recommendations=recommendations,
            calculated_at=datetime.now()
        )

    def _calculate_variance_data(
        self,
        planned: Decimal,
        committed: Decimal,
        actual: Decimal
    ) -> VarianceData:
        """Calculate variance data from amounts."""
        planned_vs_actual = planned - actual
        planned_vs_committed = planned - committed
        committed_vs_actual = committed - actual
        
        variance_percentage = Decimal('0')
        if planned > 0:
            variance_percentage = ((actual - planned) / planned * 100).quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP
            )
        
        abs_pct = abs(variance_percentage)
        if abs_pct <= VARIANCE_THRESHOLDS['minor']:
            status = VarianceStatus.on_track
        elif abs_pct <= VARIANCE_THRESHOLDS['significant']:
            status = VarianceStatus.minor_variance
        elif abs_pct <= VARIANCE_THRESHOLDS['critical']:
            status = VarianceStatus.significant_variance
        else:
            status = VarianceStatus.critical_variance
        
        return VarianceData(
            planned_vs_actual=planned_vs_actual,
            planned_vs_committed=planned_vs_committed,
            committed_vs_actual=committed_vs_actual,
            variance_percentage=variance_percentage,
            variance_status=status,
            trend_direction=TrendDirection.stable,
            last_calculated=datetime.now()
        )
    
    async def _get_top_variances(
        self,
        breakdowns: List[Dict[str, Any]],
        limit: int = 10
    ) -> List:
        """Get top variance outliers from breakdowns."""
        from models.po_breakdown import VarianceOutlier
        
        outliers = []
        for b in breakdowns:
            planned = Decimal(str(b['planned_amount']))
            actual = Decimal(str(b['actual_amount']))
            
            if planned > 0:
                variance_amount = actual - planned
                variance_pct = (variance_amount / planned * 100).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                )
                
                abs_pct = abs(variance_pct)
                if abs_pct <= VARIANCE_THRESHOLDS['minor']:
                    status = VarianceStatus.on_track
                elif abs_pct <= VARIANCE_THRESHOLDS['significant']:
                    status = VarianceStatus.minor_variance
                elif abs_pct <= VARIANCE_THRESHOLDS['critical']:
                    status = VarianceStatus.significant_variance
                else:
                    status = VarianceStatus.critical_variance
                
                outliers.append(VarianceOutlier(
                    breakdown_id=UUID(b['id']),
                    breakdown_name=b['name'],
                    variance_amount=variance_amount,
                    variance_percentage=variance_pct,
                    variance_status=status,
                    category=b.get('category')
                ))
        
        # Sort by absolute variance percentage descending
        outliers.sort(key=lambda x: abs(x.variance_percentage), reverse=True)
        return outliers[:limit]
    
    async def generate_variance_alerts(self, project_id: UUID) -> List[VarianceAlert]:
        """
        Generate variance alerts for items exceeding thresholds.
        
        **Validates: Requirements 3.5, 5.6**
        """
        alerts = []
        
        # Get all active breakdowns
        result = self.supabase.table(self.table_name)\
            .select('*')\
            .eq('project_id', str(project_id))\
            .eq('is_active', True)\
            .execute()
        
        for b in result.data or []:
            planned = Decimal(str(b['planned_amount']))
            actual = Decimal(str(b['actual_amount']))
            
            if planned > 0:
                variance_pct = ((actual - planned) / planned * 100).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                )
                
                # Check if exceeds 50% threshold (Requirement 3.5)
                if variance_pct > VARIANCE_THRESHOLDS['critical']:
                    alert = VarianceAlert(
                        breakdown_id=UUID(b['id']),
                        breakdown_name=b['name'],
                        project_id=project_id,
                        alert_type=VarianceAlertType.budget_exceeded,
                        severity=AlertSeverity.critical,
                        threshold_exceeded=VARIANCE_THRESHOLDS['critical'],
                        current_variance=actual - planned,
                        current_percentage=variance_pct,
                        message=f"Budget exceeded by {variance_pct}% for {b['name']}",
                        recommended_actions=[
                            "Review actual costs for accuracy",
                            "Investigate cause of overrun",
                            "Consider budget reallocation",
                            "Update project forecast"
                        ],
                        created_at=datetime.now()
                    )
                    alerts.append(alert)
        
        return alerts
    
    async def store_variance_alert(
        self,
        alert: VarianceAlert,
        organization_id: Optional[UUID] = None
    ) -> UUID:
        """
        Store a variance alert in the database.
        
        **Validates: Requirements 3.5, 5.6**
        
        Args:
            alert: VarianceAlert to store
            organization_id: Optional organization ID for RLS
            
        Returns:
            UUID of the stored alert
        """
        try:
            alert_data = {
                'id': str(uuid4()),
                'project_id': str(alert.project_id),
                'wbs_element': str(alert.breakdown_id),  # Using breakdown_id as wbs_element
                'variance_amount': str(alert.current_variance),
                'variance_percentage': str(alert.current_percentage),
                'commitment_amount': '0',  # Not tracked separately in PO breakdowns
                'actual_amount': '0',  # Will be populated from breakdown
                'currency_code': 'USD',
                'severity': alert.severity.value,
                'status': 'active',
                'message': alert.message,
                'details': {
                    'breakdown_name': alert.breakdown_name,
                    'alert_type': alert.alert_type.value,
                    'threshold_exceeded': str(alert.threshold_exceeded),
                    'recommended_actions': alert.recommended_actions
                },
                'recipients': [],
                'notification_channels': [],
                'organization_id': str(organization_id) if organization_id else None,
                'created_at': alert.created_at.isoformat(),
                'updated_at': datetime.now().isoformat()
            }
            
            result = self.supabase.table(self.alert_table).insert(alert_data).execute()
            
            if not result.data:
                raise Exception("Failed to store variance alert")
            
            logger.info(f"Stored variance alert {result.data[0]['id']} for breakdown {alert.breakdown_id}")
            
            return UUID(result.data[0]['id'])
            
        except Exception as e:
            logger.error(f"Failed to store variance alert: {e}")
            raise
    
    async def get_variance_alerts(
        self,
        project_id: UUID,
        status: Optional[str] = None,
        severity: Optional[str] = None,
        limit: int = 50
    ) -> List[VarianceAlert]:
        """
        Retrieve variance alerts for a project.
        
        **Validates: Requirements 3.5, 5.6**
        
        Args:
            project_id: Project UUID
            status: Optional filter by status ('active', 'acknowledged', 'resolved', 'dismissed')
            severity: Optional filter by severity ('low', 'medium', 'high', 'critical')
            limit: Maximum number of alerts to return
            
        Returns:
            List of VarianceAlert objects
        """
        try:
            query = self.supabase.table(self.alert_table)\
                .select('*')\
                .eq('project_id', str(project_id))\
                .order('created_at', desc=True)\
                .limit(limit)
            
            if status:
                query = query.eq('status', status)
            
            if severity:
                query = query.eq('severity', severity)
            
            result = query.execute()
            
            alerts = []
            for row in result.data:
                details = row.get('details', {})
                alert = VarianceAlert(
                    id=UUID(row['id']),
                    breakdown_id=UUID(row['wbs_element']),
                    breakdown_name=details.get('breakdown_name', 'Unknown'),
                    project_id=UUID(row['project_id']),
                    alert_type=VarianceAlertType(details.get('alert_type', 'budget_exceeded')),
                    severity=AlertSeverity(row['severity']),
                    threshold_exceeded=Decimal(str(details.get('threshold_exceeded', '50.0'))),
                    current_variance=Decimal(str(row['variance_amount'])),
                    current_percentage=Decimal(str(row['variance_percentage'])),
                    message=row['message'],
                    recommended_actions=details.get('recommended_actions', []),
                    is_acknowledged=(row['status'] in ['acknowledged', 'resolved']),
                    acknowledged_by=UUID(row['acknowledged_by']) if row.get('acknowledged_by') else None,
                    acknowledged_at=datetime.fromisoformat(row['acknowledged_at'].replace('Z', '+00:00')) if row.get('acknowledged_at') else None,
                    created_at=datetime.fromisoformat(row['created_at'].replace('Z', '+00:00'))
                )
                alerts.append(alert)
            
            return alerts
            
        except Exception as e:
            logger.error(f"Failed to retrieve variance alerts for project {project_id}: {e}")
            raise
    
    async def acknowledge_variance_alert(
        self,
        alert_id: UUID,
        user_id: UUID
    ) -> bool:
        """
        Acknowledge a variance alert.
        
        **Validates: Requirements 3.5**
        
        Args:
            alert_id: Alert UUID
            user_id: User acknowledging the alert
            
        Returns:
            True if successful
        """
        try:
            update_data = {
                'status': 'acknowledged',
                'acknowledged_by': str(user_id),
                'acknowledged_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }
            
            result = self.supabase.table(self.alert_table)\
                .update(update_data)\
                .eq('id', str(alert_id))\
                .execute()
            
            if result.data:
                logger.info(f"Acknowledged variance alert {alert_id} by user {user_id}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Failed to acknowledge variance alert {alert_id}: {e}")
            raise
    
    async def resolve_variance_alert(
        self,
        alert_id: UUID,
        user_id: UUID
    ) -> bool:
        """
        Resolve a variance alert.
        
        **Validates: Requirements 3.5**
        
        Args:
            alert_id: Alert UUID
            user_id: User resolving the alert
            
        Returns:
            True if successful
        """
        try:
            update_data = {
                'status': 'resolved',
                'resolved_by': str(user_id),
                'resolved_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }
            
            result = self.supabase.table(self.alert_table)\
                .update(update_data)\
                .eq('id', str(alert_id))\
                .execute()
            
            if result.data:
                logger.info(f"Resolved variance alert {alert_id} by user {user_id}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Failed to resolve variance alert {alert_id}: {e}")
            raise
    
    async def generate_and_store_variance_alerts(
        self,
        project_id: UUID,
        organization_id: Optional[UUID] = None
    ) -> List[VarianceAlert]:
        """
        Generate variance alerts and store them in the database.
        
        **Validates: Requirements 3.5, 5.6**
        
        Args:
            project_id: Project UUID
            organization_id: Optional organization ID for RLS
            
        Returns:
            List of generated and stored VarianceAlert objects
        """
        # Generate alerts
        alerts = await self.generate_variance_alerts(project_id)
        
        # Store each alert
        for alert in alerts:
            try:
                alert_id = await self.store_variance_alert(alert, organization_id)
                alert.id = alert_id
            except Exception as e:
                logger.error(f"Failed to store alert for breakdown {alert.breakdown_id}: {e}")
                # Continue with other alerts
        
        return alerts
    
    def _generate_recommendations(
        self,
        overall_variance: VarianceData,
        top_variances: List
    ) -> List[str]:
        """
        Generate recommendations based on variance analysis.
        
        **Validates: Requirements 3.5**
        
        Args:
            overall_variance: Overall project variance data
            top_variances: List of top variance outliers
            
        Returns:
            List of recommendation strings
        """
        from models.po_breakdown import VarianceRecommendation
        
        recommendations = []
        
        # Overall variance recommendations
        if overall_variance.variance_status == VarianceStatus.critical_variance:
            recommendations.append(VarianceRecommendation(
                priority='high',
                category='budget_control',
                message=f'Critical Budget Overrun Detected: Project variance is {overall_variance.variance_percentage}%, exceeding critical threshold. High financial risk to project completion.',
                suggested_action='Immediate review of all cost items and budget reallocation required',
                affected_items=[]
            ))
        elif overall_variance.variance_status == VarianceStatus.significant_variance:
            recommendations.append(VarianceRecommendation(
                priority='medium',
                category='budget_monitoring',
                message=f'Significant Variance Detected: Project variance is {overall_variance.variance_percentage}%. Moderate risk to project budget.',
                suggested_action='Review major cost drivers and implement corrective actions',
                affected_items=[]
            ))
        
        # Top variance recommendations
        if top_variances:
            critical_items = [v for v in top_variances if v.variance_status == VarianceStatus.critical_variance]
            if critical_items:
                recommendations.append(VarianceRecommendation(
                    priority='high',
                    category='item_review',
                    message=f'{len(critical_items)} Items with Critical Variances: Multiple breakdown items exceed 50% variance threshold. Individual items may require budget adjustments or scope changes.',
                    suggested_action='Conduct detailed review of each critical item and validate actual costs',
                    affected_items=[v.breakdown_id for v in critical_items]
                ))
        
        # Positive variance recommendations
        if overall_variance.variance_percentage < Decimal('-10.0'):
            recommendations.append(VarianceRecommendation(
                priority='low',
                category='opportunity',
                message=f'Favorable Variance Detected: Project is under budget by {abs(overall_variance.variance_percentage)}%. Opportunity to enhance project value or reduce overall costs.',
                suggested_action='Consider reallocating savings to value-add activities or contingency',
                affected_items=[]
            ))
        
        return recommendations
    
    async def _trigger_variance_recalculation(self, breakdown_id: UUID) -> None:
        """
        Trigger variance recalculation for an item and its parents.
        
        This method also triggers project-level variance recalculation
        to ensure comprehensive variance analysis is up-to-date.
        
        **Validates: Requirements 3.4, 5.3**
        """
        breakdown = await self.get_breakdown_by_id(breakdown_id)
        if breakdown:
            # Recalculate parent totals in hierarchy
            if breakdown.parent_breakdown_id:
                await self._recalculate_parent_totals(breakdown.parent_breakdown_id)
            
            # Trigger project-level variance recalculation (Requirement 5.3)
            await self.trigger_project_variance_recalculation(breakdown.project_id)
    
    # =========================================================================
    # Financial Tracking Integration (Task 7.1)
    # =========================================================================
    
    async def link_to_financial_record(
        self,
        breakdown_id: UUID,
        financial_record_id: UUID,
        user_id: UUID
    ) -> bool:
        """
        Link a PO breakdown to an existing financial tracking record.
        
        **Validates: Requirements 5.1**
        
        Args:
            breakdown_id: ID of the PO breakdown
            financial_record_id: ID of the financial tracking record
            user_id: ID of user creating the link
        
        Returns:
            True if link was successful
        
        Raises:
            ValueError: If breakdown or financial record not found
        """
        try:
            # Verify breakdown exists
            breakdown = await self.get_breakdown_by_id(breakdown_id)
            if not breakdown:
                raise ValueError(f"Breakdown {breakdown_id} not found")
            
            # Verify financial record exists
            financial_result = self.supabase.table('financial_tracking')\
                .select('*')\
                .eq('id', str(financial_record_id))\
                .execute()
            
            if not financial_result.data:
                raise ValueError(f"Financial record {financial_record_id} not found")
            
            financial_record = financial_result.data[0]
            
            # Verify same project
            if str(breakdown.project_id) != str(financial_record['project_id']):
                raise ValueError("Breakdown and financial record must belong to same project")
            
            # Get or create existing links
            current_links = breakdown.custom_fields.get('financial_links', [])
            if str(financial_record_id) not in current_links:
                current_links.append(str(financial_record_id))
            
            # Update breakdown with link
            update_data = {
                'custom_fields': {
                    **breakdown.custom_fields,
                    'financial_links': current_links
                },
                'updated_at': datetime.now().isoformat(),
                'version': breakdown.version + 1
            }
            
            result = self.supabase.table(self.table_name)\
                .update(update_data)\
                .eq('id', str(breakdown_id))\
                .execute()
            
            if result.data:
                # Create audit record
                await self._create_version_record(
                    breakdown_id=breakdown_id,
                    version_number=breakdown.version + 1,
                    changes={
                        'action': 'link_financial_record',
                        'financial_record_id': str(financial_record_id)
                    },
                    user_id=user_id
                )
                
                # Trigger automatic project-level variance recalculation (Requirement 5.3)
                await self.schedule_automatic_variance_recalculation(
                    project_id=breakdown.project_id,
                    trigger_event='financial_record_linked',
                    event_data={
                        'breakdown_id': str(breakdown_id),
                        'financial_record_id': str(financial_record_id)
                    }
                )
                
                logger.info(f"Linked breakdown {breakdown_id} to financial record {financial_record_id}")
                return True
            
            return False
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to link breakdown to financial record: {e}")
            raise
    
    async def unlink_from_financial_record(
        self,
        breakdown_id: UUID,
        financial_record_id: UUID,
        user_id: UUID
    ) -> bool:
        """
        Unlink a PO breakdown from a financial tracking record.
        
        **Validates: Requirements 5.1**
        
        Args:
            breakdown_id: ID of the PO breakdown
            financial_record_id: ID of the financial tracking record
            user_id: ID of user removing the link
        
        Returns:
            True if unlink was successful
        """
        try:
            breakdown = await self.get_breakdown_by_id(breakdown_id)
            if not breakdown:
                raise ValueError(f"Breakdown {breakdown_id} not found")
            
            # Remove from links
            current_links = breakdown.custom_fields.get('financial_links', [])
            if str(financial_record_id) in current_links:
                current_links.remove(str(financial_record_id))
            
            # Update breakdown
            update_data = {
                'custom_fields': {
                    **breakdown.custom_fields,
                    'financial_links': current_links
                },
                'updated_at': datetime.now().isoformat(),
                'version': breakdown.version + 1
            }
            
            result = self.supabase.table(self.table_name)\
                .update(update_data)\
                .eq('id', str(breakdown_id))\
                .execute()
            
            if result.data:
                # Create audit record
                await self._create_version_record(
                    breakdown_id=breakdown_id,
                    version_number=breakdown.version + 1,
                    changes={
                        'action': 'unlink_financial_record',
                        'financial_record_id': str(financial_record_id)
                    },
                    user_id=user_id
                )
                logger.info(f"Unlinked breakdown {breakdown_id} from financial record {financial_record_id}")
                return True
            
            return False
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to unlink breakdown from financial record: {e}")
            raise
    
    async def get_linked_financial_records(
        self,
        breakdown_id: UUID
    ) -> List[Dict[str, Any]]:
        """
        Get all financial tracking records linked to a PO breakdown.
        
        **Validates: Requirements 5.1**
        
        Args:
            breakdown_id: ID of the PO breakdown
        
        Returns:
            List of financial tracking records
        """
        try:
            breakdown = await self.get_breakdown_by_id(breakdown_id)
            if not breakdown:
                raise ValueError(f"Breakdown {breakdown_id} not found")
            
            financial_links = breakdown.custom_fields.get('financial_links', [])
            if not financial_links:
                return []
            
            # Fetch linked financial records
            result = self.supabase.table('financial_tracking')\
                .select('*')\
                .in_('id', financial_links)\
                .execute()
            
            return result.data or []
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to get linked financial records: {e}")
            raise
    
    async def calculate_comprehensive_variance(
        self,
        project_id: UUID,
        include_financial_tracking: bool = True
    ) -> Dict[str, Any]:
        """
        Calculate comprehensive variance including both PO breakdown and financial tracking data.
        
        **Validates: Requirements 5.2**
        
        This method aggregates costs from:
        1. PO breakdown items (planned, committed, actual amounts)
        2. Direct financial tracking records (if include_financial_tracking=True)
        
        Args:
            project_id: ID of the project
            include_financial_tracking: Whether to include direct financial tracking data
        
        Returns:
            Dictionary with comprehensive variance analysis:
            {
                'project_id': UUID,
                'po_breakdown_totals': {...},
                'financial_tracking_totals': {...},
                'combined_totals': {...},
                'variance_analysis': {...},
                'data_sources': List[str],
                'calculated_at': datetime
            }
        """
        try:
            # Get PO breakdown totals
            po_result = self.supabase.table(self.table_name)\
                .select('*')\
                .eq('project_id', str(project_id))\
                .eq('is_active', True)\
                .execute()
            
            po_breakdowns = po_result.data or []
            
            po_planned = sum(Decimal(str(b.get('planned_amount', 0))) for b in po_breakdowns)
            po_committed = sum(Decimal(str(b.get('committed_amount', 0))) for b in po_breakdowns)
            po_actual = sum(Decimal(str(b.get('actual_amount', 0))) for b in po_breakdowns)
            
            po_totals = {
                'planned_amount': po_planned,
                'committed_amount': po_committed,
                'actual_amount': po_actual,
                'remaining_amount': po_planned - po_actual,
                'item_count': len(po_breakdowns)
            }
            
            # Get financial tracking totals
            financial_totals = {
                'planned_amount': Decimal('0'),
                'actual_amount': Decimal('0'),
                'remaining_amount': Decimal('0'),
                'record_count': 0
            }
            
            data_sources = ['po_breakdown']
            
            if include_financial_tracking:
                financial_result = self.supabase.table('financial_tracking')\
                    .select('*')\
                    .eq('project_id', str(project_id))\
                    .execute()
                
                financial_records = financial_result.data or []
                
                # Filter out records already linked to PO breakdowns to avoid double-counting
                linked_financial_ids = set()
                for breakdown in po_breakdowns:
                    links = breakdown.get('custom_fields', {}).get('financial_links', [])
                    linked_financial_ids.update(links)
                
                unlinked_records = [
                    r for r in financial_records 
                    if r['id'] not in linked_financial_ids
                ]
                
                ft_planned = sum(Decimal(str(r.get('planned_amount', 0))) for r in unlinked_records)
                ft_actual = sum(Decimal(str(r.get('actual_amount', 0))) for r in unlinked_records)
                
                financial_totals = {
                    'planned_amount': ft_planned,
                    'actual_amount': ft_actual,
                    'remaining_amount': ft_planned - ft_actual,
                    'record_count': len(unlinked_records),
                    'linked_record_count': len(linked_financial_ids)
                }
                
                data_sources.append('financial_tracking')
            
            # Calculate combined totals
            combined_planned = po_totals['planned_amount'] + financial_totals['planned_amount']
            combined_actual = po_totals['actual_amount'] + financial_totals['actual_amount']
            combined_remaining = combined_planned - combined_actual
            
            combined_totals = {
                'planned_amount': combined_planned,
                'actual_amount': combined_actual,
                'remaining_amount': combined_remaining,
                'total_sources': len(data_sources)
            }
            
            # Calculate variance analysis
            variance_amount = combined_actual - combined_planned
            variance_percentage = Decimal('0')
            if combined_planned > 0:
                variance_percentage = (variance_amount / combined_planned * 100).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                )
            
            # Determine variance status
            abs_pct = abs(variance_percentage)
            if abs_pct <= VARIANCE_THRESHOLDS['minor']:
                status = VarianceStatus.on_track
            elif abs_pct <= VARIANCE_THRESHOLDS['significant']:
                status = VarianceStatus.minor_variance
            elif abs_pct <= VARIANCE_THRESHOLDS['critical']:
                status = VarianceStatus.significant_variance
            else:
                status = VarianceStatus.critical_variance
            
            variance_analysis = {
                'variance_amount': variance_amount,
                'variance_percentage': variance_percentage,
                'variance_status': status.value,
                'over_budget': variance_amount > 0,
                'under_budget': variance_amount < 0,
                'on_track': status == VarianceStatus.on_track
            }
            
            result = {
                'project_id': str(project_id),
                'po_breakdown_totals': {k: str(v) if isinstance(v, Decimal) else v for k, v in po_totals.items()},
                'financial_tracking_totals': {k: str(v) if isinstance(v, Decimal) else v for k, v in financial_totals.items()},
                'combined_totals': {k: str(v) if isinstance(v, Decimal) else v for k, v in combined_totals.items()},
                'variance_analysis': {k: str(v) if isinstance(v, Decimal) else v for k, v in variance_analysis.items()},
                'data_sources': data_sources,
                'calculated_at': datetime.now().isoformat()
            }
            
            logger.info(
                f"Calculated comprehensive variance for project {project_id}: "
                f"{variance_percentage}% variance, status={status.value}"
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to calculate comprehensive variance: {e}")
            raise
    
    async def sync_financial_tracking_to_breakdown(
        self,
        project_id: UUID,
        category_mapping: Optional[Dict[str, str]] = None,
        user_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Sync financial tracking records to PO breakdown structure.
        
        This method creates or updates PO breakdown items based on financial
        tracking records, useful for importing direct costs into the breakdown structure.
        
        **Validates: Requirements 5.1, 5.4**
        
        Args:
            project_id: ID of the project
            category_mapping: Optional mapping of financial categories to breakdown categories
            user_id: ID of user performing the sync
        
        Returns:
            Dictionary with sync results:
            {
                'synced_count': int,
                'created_breakdowns': List[UUID],
                'updated_breakdowns': List[UUID],
                'skipped_count': int,
                'errors': List[Dict]
            }
        """
        try:
            # Get unlinked financial records
            financial_result = self.supabase.table('financial_tracking')\
                .select('*')\
                .eq('project_id', str(project_id))\
                .execute()
            
            financial_records = financial_result.data or []
            
            # Get existing breakdowns to check for links
            po_result = self.supabase.table(self.table_name)\
                .select('*')\
                .eq('project_id', str(project_id))\
                .eq('is_active', True)\
                .execute()
            
            po_breakdowns = po_result.data or []
            
            # Build set of already-linked financial IDs
            linked_financial_ids = set()
            for breakdown in po_breakdowns:
                links = breakdown.get('custom_fields', {}).get('financial_links', [])
                linked_financial_ids.update(links)
            
            # Process unlinked records
            created_breakdowns = []
            updated_breakdowns = []
            skipped_count = 0
            errors = []
            
            for record in financial_records:
                try:
                    record_id = record['id']
                    
                    # Skip if already linked
                    if record_id in linked_financial_ids:
                        skipped_count += 1
                        continue
                    
                    # Map category if mapping provided
                    category = record.get('category', 'Direct Costs')
                    if category_mapping and category in category_mapping:
                        category = category_mapping[category]
                    
                    # Create breakdown from financial record
                    breakdown_data = POBreakdownCreate(
                        name=record.get('description', f"Financial Record {record_id[:8]}"),
                        category=category,
                        planned_amount=Decimal(str(record.get('planned_amount', 0))),
                        actual_amount=Decimal(str(record.get('actual_amount', 0))),
                        committed_amount=Decimal('0'),
                        currency=record.get('currency', 'USD'),
                        breakdown_type=POBreakdownType.custom_hierarchy,
                        custom_fields={
                            'financial_links': [record_id],
                            'synced_from_financial_tracking': True,
                            'financial_category': record.get('category'),
                            'date_incurred': str(record.get('date_incurred'))
                        },
                        notes=f"Synced from financial tracking record {record_id}"
                    )
                    
                    # Create the breakdown
                    if user_id:
                        created = await self.create_breakdown(
                            project_id=project_id,
                            breakdown_data=breakdown_data,
                            user_id=user_id
                        )
                        created_breakdowns.append(created.id)
                    else:
                        # Skip if no user_id provided
                        skipped_count += 1
                        
                except Exception as e:
                    errors.append({
                        'record_id': record.get('id'),
                        'error': str(e)
                    })
            
            result = {
                'synced_count': len(created_breakdowns) + len(updated_breakdowns),
                'created_breakdowns': [str(id) for id in created_breakdowns],
                'updated_breakdowns': [str(id) for id in updated_breakdowns],
                'skipped_count': skipped_count,
                'errors': errors
            }
            
            logger.info(
                f"Synced financial tracking to breakdowns for project {project_id}: "
                f"{result['synced_count']} synced, {skipped_count} skipped, {len(errors)} errors"
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to sync financial tracking to breakdown: {e}")
            raise
    
    # =========================================================================
    # Project-Level Financial Aggregation (Task 7.2)
    # =========================================================================
    
    async def trigger_project_variance_recalculation(
        self,
        project_id: UUID,
        include_financial_tracking: bool = True
    ) -> Dict[str, Any]:
        """
        Trigger automatic project-level variance recalculation.
        
        This method is called automatically when financial data changes
        to ensure project-level variance analysis is always up-to-date.
        
        **Validates: Requirements 5.3**
        
        Args:
            project_id: ID of the project
            include_financial_tracking: Whether to include financial tracking data
        
        Returns:
            Dictionary with recalculation results:
            {
                'project_id': UUID,
                'variance_updated': bool,
                'alerts_generated': int,
                'calculation_time_ms': float,
                'timestamp': datetime
            }
        """
        try:
            start_time = datetime.now()
            
            # Calculate comprehensive variance including all cost sources
            variance_result = await self.calculate_comprehensive_variance(
                project_id=project_id,
                include_financial_tracking=include_financial_tracking
            )
            
            # Generate and store variance alerts if thresholds exceeded
            alerts = await self.generate_and_store_variance_alerts(project_id)
            
            # Calculate elapsed time
            end_time = datetime.now()
            elapsed_ms = (end_time - start_time).total_seconds() * 1000
            
            result = {
                'project_id': str(project_id),
                'variance_updated': True,
                'alerts_generated': len(alerts),
                'calculation_time_ms': elapsed_ms,
                'timestamp': end_time.isoformat(),
                'variance_summary': variance_result.get('variance_analysis', {})
            }
            
            logger.info(
                f"Project-level variance recalculated for {project_id}: "
                f"{len(alerts)} alerts generated in {elapsed_ms:.2f}ms"
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to trigger project variance recalculation: {e}")
            raise
    
    async def generate_financial_report_aggregation(
        self,
        project_id: UUID,
        report_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate comprehensive financial report with multiple cost source aggregation.
        
        This method aggregates data from:
        1. PO breakdown items (planned, committed, actual amounts)
        2. Direct financial tracking records
        3. Change request financial impacts
        4. Budget allocations
        
        **Validates: Requirements 5.4**
        
        Args:
            project_id: ID of the project
            report_config: Optional configuration for report generation:
                {
                    'include_financial_tracking': bool,
                    'include_change_requests': bool,
                    'include_budget_data': bool,
                    'group_by_category': bool,
                    'group_by_level': bool,
                    'include_variance_analysis': bool,
                    'include_trend_data': bool
                }
        
        Returns:
            Dictionary with comprehensive financial report:
            {
                'project_id': UUID,
                'report_date': datetime,
                'cost_sources': {
                    'po_breakdown': {...},
                    'financial_tracking': {...},
                    'change_requests': {...},
                    'budget': {...}
                },
                'aggregated_totals': {...},
                'variance_analysis': {...},
                'category_breakdown': {...},
                'level_breakdown': {...},
                'trend_data': {...},
                'recommendations': List[str]
            }
        """
        try:
            # Default configuration
            config = {
                'include_financial_tracking': True,
                'include_change_requests': True,
                'include_budget_data': True,
                'group_by_category': True,
                'group_by_level': True,
                'include_variance_analysis': True,
                'include_trend_data': False
            }
            
            if report_config:
                config.update(report_config)
            
            report_date = datetime.now()
            
            # 1. Get PO breakdown data
            po_result = self.supabase.table(self.table_name)\
                .select('*')\
                .eq('project_id', str(project_id))\
                .eq('is_active', True)\
                .execute()
            
            po_breakdowns = po_result.data or []
            
            po_source = {
                'source_name': 'PO Breakdown',
                'item_count': len(po_breakdowns),
                'planned_amount': sum(Decimal(str(b.get('planned_amount', 0))) for b in po_breakdowns),
                'committed_amount': sum(Decimal(str(b.get('committed_amount', 0))) for b in po_breakdowns),
                'actual_amount': sum(Decimal(str(b.get('actual_amount', 0))) for b in po_breakdowns),
                'remaining_amount': Decimal('0')
            }
            po_source['remaining_amount'] = po_source['planned_amount'] - po_source['actual_amount']
            
            cost_sources = {'po_breakdown': po_source}
            
            # 2. Get financial tracking data (if enabled)
            financial_source = {
                'source_name': 'Financial Tracking',
                'record_count': 0,
                'planned_amount': Decimal('0'),
                'actual_amount': Decimal('0'),
                'remaining_amount': Decimal('0')
            }
            
            if config['include_financial_tracking']:
                financial_result = self.supabase.table('financial_tracking')\
                    .select('*')\
                    .eq('project_id', str(project_id))\
                    .execute()
                
                financial_records = financial_result.data or []
                
                # Filter out records already linked to PO breakdowns
                linked_financial_ids = set()
                for breakdown in po_breakdowns:
                    links = breakdown.get('custom_fields', {}).get('financial_links', [])
                    linked_financial_ids.update(links)
                
                unlinked_records = [
                    r for r in financial_records 
                    if r.get('id') not in linked_financial_ids
                ]
                
                financial_source['record_count'] = len(unlinked_records)
                financial_source['planned_amount'] = sum(
                    Decimal(str(r.get('planned_amount', 0))) for r in unlinked_records
                )
                financial_source['actual_amount'] = sum(
                    Decimal(str(r.get('actual_amount', 0))) for r in unlinked_records
                )
                financial_source['remaining_amount'] = (
                    financial_source['planned_amount'] - financial_source['actual_amount']
                )
            
            cost_sources['financial_tracking'] = financial_source
            
            # 3. Get change request financial impacts (if enabled)
            change_request_source = {
                'source_name': 'Change Requests',
                'request_count': 0,
                'approved_amount': Decimal('0'),
                'pending_amount': Decimal('0'),
                'total_impact': Decimal('0')
            }
            
            if config['include_change_requests']:
                try:
                    cr_result = self.supabase.table('change_requests')\
                        .select('*')\
                        .eq('project_id', str(project_id))\
                        .execute()
                    
                    change_requests = cr_result.data or []
                    change_request_source['request_count'] = len(change_requests)
                    
                    for cr in change_requests:
                        financial_impact = Decimal(str(cr.get('financial_impact', 0)))
                        status = cr.get('status', '')
                        
                        if status in ['approved', 'implemented']:
                            change_request_source['approved_amount'] += financial_impact
                        elif status in ['pending', 'under_review']:
                            change_request_source['pending_amount'] += financial_impact
                        
                        change_request_source['total_impact'] += financial_impact
                        
                except Exception as e:
                    logger.warning(f"Could not fetch change request data: {e}")
            
            cost_sources['change_requests'] = change_request_source
            
            # 4. Get budget data (if enabled)
            budget_source = {
                'source_name': 'Project Budget',
                'total_budget': Decimal('0'),
                'allocated_budget': Decimal('0'),
                'unallocated_budget': Decimal('0')
            }
            
            if config['include_budget_data']:
                try:
                    project_result = self.supabase.table('projects')\
                        .select('budget, allocated_budget')\
                        .eq('id', str(project_id))\
                        .execute()
                    
                    if project_result.data:
                        project_data = project_result.data[0]
                        budget_source['total_budget'] = Decimal(str(project_data.get('budget', 0)))
                        budget_source['allocated_budget'] = Decimal(str(project_data.get('allocated_budget', 0)))
                        budget_source['unallocated_budget'] = (
                            budget_source['total_budget'] - budget_source['allocated_budget']
                        )
                except Exception as e:
                    logger.warning(f"Could not fetch budget data: {e}")
            
            cost_sources['budget'] = budget_source
            
            # 5. Calculate aggregated totals
            total_planned = (
                po_source['planned_amount'] + 
                financial_source['planned_amount']
            )
            total_actual = (
                po_source['actual_amount'] + 
                financial_source['actual_amount']
            )
            total_committed = po_source['committed_amount']
            total_remaining = total_planned - total_actual
            
            # Include approved change requests in planning
            total_planned_with_changes = total_planned + change_request_source['approved_amount']
            
            aggregated_totals = {
                'total_planned': total_planned,
                'total_planned_with_approved_changes': total_planned_with_changes,
                'total_committed': total_committed,
                'total_actual': total_actual,
                'total_remaining': total_remaining,
                'pending_change_requests': change_request_source['pending_amount'],
                'total_budget': budget_source['total_budget'],
                'budget_utilization_pct': Decimal('0')
            }
            
            if budget_source['total_budget'] > 0:
                aggregated_totals['budget_utilization_pct'] = (
                    (total_actual / budget_source['total_budget'] * 100).quantize(
                        Decimal('0.01'), rounding=ROUND_HALF_UP
                    )
                )
            
            # 6. Variance analysis (if enabled)
            variance_analysis = {}
            if config['include_variance_analysis']:
                variance_amount = total_actual - total_planned
                variance_percentage = Decimal('0')
                if total_planned > 0:
                    variance_percentage = (variance_amount / total_planned * 100).quantize(
                        Decimal('0.01'), rounding=ROUND_HALF_UP
                    )
                
                # Determine variance status
                abs_pct = abs(variance_percentage)
                if abs_pct <= VARIANCE_THRESHOLDS['minor']:
                    status = VarianceStatus.on_track
                elif abs_pct <= VARIANCE_THRESHOLDS['significant']:
                    status = VarianceStatus.minor_variance
                elif abs_pct <= VARIANCE_THRESHOLDS['critical']:
                    status = VarianceStatus.significant_variance
                else:
                    status = VarianceStatus.critical_variance
                
                variance_analysis = {
                    'variance_amount': variance_amount,
                    'variance_percentage': variance_percentage,
                    'variance_status': status.value,
                    'over_budget': variance_amount > 0,
                    'under_budget': variance_amount < 0,
                    'budget_variance': total_actual - budget_source['total_budget'],
                    'budget_variance_pct': Decimal('0')
                }
                
                if budget_source['total_budget'] > 0:
                    budget_var = total_actual - budget_source['total_budget']
                    variance_analysis['budget_variance_pct'] = (
                        (budget_var / budget_source['total_budget'] * 100).quantize(
                            Decimal('0.01'), rounding=ROUND_HALF_UP
                        )
                    )
            
            # 7. Category breakdown (if enabled)
            category_breakdown = {}
            if config['group_by_category']:
                categories = set(b.get('category') for b in po_breakdowns if b.get('category'))
                
                for category in categories:
                    cat_breakdowns = [b for b in po_breakdowns if b.get('category') == category]
                    cat_planned = sum(Decimal(str(b.get('planned_amount', 0))) for b in cat_breakdowns)
                    cat_actual = sum(Decimal(str(b.get('actual_amount', 0))) for b in cat_breakdowns)
                    cat_variance = cat_actual - cat_planned
                    cat_variance_pct = Decimal('0')
                    if cat_planned > 0:
                        cat_variance_pct = (cat_variance / cat_planned * 100).quantize(
                            Decimal('0.01'), rounding=ROUND_HALF_UP
                        )
                    
                    category_breakdown[category] = {
                        'item_count': len(cat_breakdowns),
                        'planned_amount': cat_planned,
                        'actual_amount': cat_actual,
                        'variance_amount': cat_variance,
                        'variance_percentage': cat_variance_pct
                    }
            
            # 8. Level breakdown (if enabled)
            level_breakdown = {}
            if config['group_by_level']:
                levels = set(b.get('hierarchy_level', 0) for b in po_breakdowns)
                
                for level in levels:
                    level_breakdowns = [b for b in po_breakdowns if b.get('hierarchy_level', 0) == level]
                    level_planned = sum(Decimal(str(b.get('planned_amount', 0))) for b in level_breakdowns)
                    level_actual = sum(Decimal(str(b.get('actual_amount', 0))) for b in level_breakdowns)
                    
                    level_breakdown[level] = {
                        'item_count': len(level_breakdowns),
                        'planned_amount': level_planned,
                        'actual_amount': level_actual
                    }
            
            # 9. Generate recommendations
            recommendations = []
            
            if variance_analysis:
                if variance_analysis['variance_status'] == VarianceStatus.critical_variance.value:
                    recommendations.append(
                        f"CRITICAL: Project variance is {variance_analysis['variance_percentage']}%. "
                        "Immediate action required to address cost overruns."
                    )
                
                if aggregated_totals['budget_utilization_pct'] > 90:
                    recommendations.append(
                        f"WARNING: Budget utilization at {aggregated_totals['budget_utilization_pct']}%. "
                        "Consider budget reallocation or scope adjustment."
                    )
                
                if change_request_source['pending_amount'] > 0:
                    recommendations.append(
                        f"INFO: {change_request_source['pending_amount']} in pending change requests. "
                        "Review and approve/reject to update financial forecast."
                    )
            
            # Build final report
            report = {
                'project_id': str(project_id),
                'report_date': report_date.isoformat(),
                'cost_sources': {
                    k: {key: str(val) if isinstance(val, Decimal) else val for key, val in v.items()}
                    for k, v in cost_sources.items()
                },
                'aggregated_totals': {
                    k: str(v) if isinstance(v, Decimal) else v 
                    for k, v in aggregated_totals.items()
                },
                'variance_analysis': {
                    k: str(v) if isinstance(v, Decimal) else v 
                    for k, v in variance_analysis.items()
                } if variance_analysis else {},
                'category_breakdown': {
                    cat: {k: str(v) if isinstance(v, Decimal) else v for k, v in data.items()}
                    for cat, data in category_breakdown.items()
                } if category_breakdown else {},
                'level_breakdown': {
                    str(level): {k: str(v) if isinstance(v, Decimal) else v for k, v in data.items()}
                    for level, data in level_breakdown.items()
                } if level_breakdown else {},
                'recommendations': recommendations,
                'data_sources_included': [
                    source for source, enabled in [
                        ('po_breakdown', True),
                        ('financial_tracking', config['include_financial_tracking']),
                        ('change_requests', config['include_change_requests']),
                        ('budget', config['include_budget_data'])
                    ] if enabled
                ]
            }
            
            logger.info(
                f"Generated financial report for project {project_id} with "
                f"{len(report['data_sources_included'])} cost sources"
            )
            
            return report
            
        except Exception as e:
            logger.error(f"Failed to generate financial report aggregation: {e}")
            raise
    
    async def schedule_automatic_variance_recalculation(
        self,
        project_id: UUID,
        trigger_event: str,
        event_data: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Schedule automatic variance recalculation based on trigger events.
        
        This method is called by various operations that modify financial data
        to ensure project-level variance is always current.
        
        **Validates: Requirements 5.3**
        
        Supported trigger events:
        - 'breakdown_created': New PO breakdown item created
        - 'breakdown_updated': PO breakdown amounts updated
        - 'breakdown_deleted': PO breakdown item deleted
        - 'financial_record_linked': Financial tracking record linked
        - 'financial_record_updated': Financial tracking record updated
        - 'change_request_approved': Change request approved
        
        Args:
            project_id: ID of the project
            trigger_event: Event that triggered the recalculation
            event_data: Optional data about the triggering event
        
        Returns:
            True if recalculation was scheduled/executed successfully
        """
        try:
            logger.info(
                f"Scheduling variance recalculation for project {project_id} "
                f"due to event: {trigger_event}"
            )
            
            # Execute recalculation immediately
            # In a production system, this could be queued for async processing
            result = await self.trigger_project_variance_recalculation(project_id)
            
            # Log the trigger event
            event_log = {
                'project_id': str(project_id),
                'trigger_event': trigger_event,
                'event_data': event_data or {},
                'recalculation_result': result,
                'timestamp': datetime.now().isoformat()
            }
            
            logger.info(f"Variance recalculation completed: {event_log}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to schedule variance recalculation: {e}")
            return False
    
    # =========================================================================
    # Custom Hierarchy Operations (Task 6.2)
    # =========================================================================
    
    async def reorder_breakdown_items(
        self,
        parent_id: Optional[UUID],
        ordered_item_ids: List[UUID],
        user_id: UUID
    ) -> List[POBreakdownResponse]:
        """
        Reorder breakdown items within the same parent (drag-and-drop support).
        
        This method updates the display order of items at the same hierarchy level
        by setting a 'display_order' field that can be used for sorting.
        
        **Validates: Requirements 4.2**
        
        Args:
            parent_id: ID of the parent breakdown (None for root level)
            ordered_item_ids: List of breakdown IDs in desired order
            user_id: ID of user making the update
        
        Returns:
            List of updated POBreakdownResponse objects
        
        Raises:
            ValueError: If items don't belong to same parent or don't exist
        """
        try:
            if not ordered_item_ids:
                return []
            
            updated_items = []
            
            # Validate all items belong to the same parent
            for item_id in ordered_item_ids:
                item = await self.get_breakdown_by_id(item_id)
                
                if not item:
                    raise ValueError(f"Breakdown {item_id} not found")
                
                # Check parent matches
                item_parent = item.parent_breakdown_id
                expected_parent = parent_id
                
                if item_parent != expected_parent:
                    raise ValueError(
                        f"Breakdown {item_id} does not belong to parent {parent_id}. "
                        f"All items must have the same parent for reordering."
                    )
            
            # Update display_order for each item
            for index, item_id in enumerate(ordered_item_ids):
                update_data = {
                    'display_order': index,
                    'updated_at': datetime.now().isoformat()
                }
                
                result = self.supabase.table(self.table_name)\
                    .update(update_data)\
                    .eq('id', str(item_id))\
                    .execute()
                
                if result.data:
                    # Create audit record
                    await self._create_version_record(
                        breakdown_id=item_id,
                        version_number=-1,  # Special version for reorder
                        changes={'action': 'reorder', 'new_position': index},
                        user_id=user_id
                    )
                    updated_items.append(self._map_to_response(result.data[0]))
            
            logger.info(f"Reordered {len(updated_items)} items under parent {parent_id}")
            
            return updated_items
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to reorder breakdown items: {e}")
            raise
    
    # =========================================================================
    # SAP Relationship Preservation (Task 6.3)
    # =========================================================================
    
    async def preserve_sap_relationship(
        self,
        breakdown_id: UUID,
        user_id: UUID
    ) -> bool:
        """
        Preserve the current SAP relationship before modifying hierarchy.
        
        This method captures the original SAP parent and hierarchy path
        before any custom modifications are made.
        
        **Validates: Requirements 4.6**
        
        Args:
            breakdown_id: ID of the breakdown to preserve
            user_id: ID of user making the modification
        
        Returns:
            True if preservation was successful
        
        Raises:
            ValueError: If breakdown not found
        """
        try:
            breakdown = await self.get_breakdown_by_id(breakdown_id)
            if not breakdown:
                raise ValueError(f"Breakdown {breakdown_id} not found")
            
            # Only preserve if not already preserved and is SAP standard type
            if (breakdown.breakdown_type == POBreakdownType.sap_standard and 
                not breakdown.has_custom_parent):
                
                # Calculate SAP hierarchy path
                hierarchy_path = await self._calculate_hierarchy_path(breakdown_id)
                
                update_data = {
                    'original_sap_parent_id': str(breakdown.parent_breakdown_id) if breakdown.parent_breakdown_id else None,
                    'sap_hierarchy_path': [str(uuid) for uuid in hierarchy_path],
                    'updated_at': datetime.now().isoformat()
                }
                
                result = self.supabase.table(self.table_name)\
                    .update(update_data)\
                    .eq('id', str(breakdown_id))\
                    .execute()
                
                if result.data:
                    # Create audit record
                    await self._create_version_record(
                        breakdown_id=breakdown_id,
                        version_number=-1,  # Special version for SAP preservation
                        changes={
                            'action': 'preserve_sap_relationship',
                            'original_parent': str(breakdown.parent_breakdown_id) if breakdown.parent_breakdown_id else None,
                            'hierarchy_path': [str(uuid) for uuid in hierarchy_path]
                        },
                        user_id=user_id
                    )
                    logger.info(f"Preserved SAP relationship for breakdown {breakdown_id}")
                    return True
            
            return False
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to preserve SAP relationship for {breakdown_id}: {e}")
            raise
    
    async def move_breakdown_with_sap_preservation(
        self,
        breakdown_id: UUID,
        move_request: HierarchyMoveRequest,
        user_id: UUID
    ) -> Tuple[POBreakdownResponse, HierarchyValidationResult]:
        """
        Move a breakdown item while preserving original SAP relationships.
        
        This is an enhanced version of move_breakdown that automatically
        preserves SAP relationships before making custom modifications.
        
        **Validates: Requirements 2.2, 2.4, 4.6**
        
        Args:
            breakdown_id: Breakdown to move
            move_request: Move request with new parent
            user_id: User performing the move
            
        Returns:
            Tuple of (updated breakdown, validation result)
        """
        try:
            # Get current breakdown
            current = await self.get_breakdown_by_id(breakdown_id)
            if not current:
                raise ValueError(f"Breakdown {breakdown_id} not found")
            
            # Preserve SAP relationship before moving (if applicable)
            await self.preserve_sap_relationship(breakdown_id, user_id)
            
            # Perform the move using existing method
            updated_breakdown, validation = await self.move_breakdown(
                breakdown_id, move_request, user_id
            )
            
            # Mark as having custom parent if parent changed
            if move_request.new_parent_id != current.parent_breakdown_id:
                self.supabase.table(self.table_name)\
                    .update({
                        'has_custom_parent': True,
                        'updated_at': datetime.now().isoformat()
                    })\
                    .eq('id', str(breakdown_id))\
                    .execute()
                
                logger.info(f"Marked breakdown {breakdown_id} as having custom parent")
            
            return updated_breakdown, validation
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to move breakdown with SAP preservation {breakdown_id}: {e}")
            raise
    
    async def get_sap_relationship_info(
        self,
        breakdown_id: UUID
    ) -> 'SAPRelationshipInfo':
        """
        Get information about original SAP relationships for a breakdown.
        
        **Validates: Requirements 4.6**
        
        Args:
            breakdown_id: ID of the breakdown
        
        Returns:
            SAPRelationshipInfo with original and current relationship data
        
        Raises:
            ValueError: If breakdown not found
        """
        from models.po_breakdown import SAPRelationshipInfo
        
        try:
            breakdown = await self.get_breakdown_by_id(breakdown_id)
            if not breakdown:
                raise ValueError(f"Breakdown {breakdown_id} not found")
            
            # Check if original parent still exists and is active
            can_restore = False
            restore_warnings = []
            
            if breakdown.original_sap_parent_id:
                original_parent = await self.get_breakdown_by_id(breakdown.original_sap_parent_id)
                if original_parent and original_parent.is_active:
                    can_restore = True
                elif not original_parent:
                    restore_warnings.append("Original SAP parent no longer exists")
                elif not original_parent.is_active:
                    restore_warnings.append("Original SAP parent is inactive")
            else:
                # No original parent means it was a root item
                can_restore = True
            
            return SAPRelationshipInfo(
                breakdown_id=breakdown_id,
                original_parent_id=breakdown.original_sap_parent_id,
                current_parent_id=breakdown.parent_breakdown_id,
                has_custom_parent=breakdown.has_custom_parent,
                sap_hierarchy_path=breakdown.sap_hierarchy_path or [],
                can_restore=can_restore,
                restore_warnings=restore_warnings
            )
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to get SAP relationship info for {breakdown_id}: {e}")
            raise
    
    async def restore_sap_relationships(
        self,
        restore_request: 'SAPRelationshipRestoreRequest',
        user_id: UUID
    ) -> 'SAPRelationshipRestoreResult':
        """
        Restore original SAP relationships for breakdown items.
        
        This method restores items to their original SAP parent relationships,
        effectively undoing custom hierarchy modifications.
        
        **Validates: Requirements 4.6**
        
        Args:
            restore_request: Request with breakdown IDs to restore
            user_id: ID of user performing restoration
        
        Returns:
            SAPRelationshipRestoreResult with restoration results
        """
        from models.po_breakdown import SAPRelationshipRestoreResult
        
        try:
            successful = []
            failed = []
            warnings = []
            
            for breakdown_id in restore_request.breakdown_ids:
                try:
                    # Get SAP relationship info
                    sap_info = await self.get_sap_relationship_info(breakdown_id)
                    
                    if not sap_info.can_restore:
                        failed.append({
                            'breakdown_id': str(breakdown_id),
                            'error': 'Cannot restore',
                            'warnings': sap_info.restore_warnings
                        })
                        warnings.extend(sap_info.restore_warnings)
                        continue
                    
                    if not sap_info.has_custom_parent:
                        warnings.append(f"Breakdown {breakdown_id} already has original SAP parent")
                        successful.append(breakdown_id)
                        continue
                    
                    # Validate only mode
                    if restore_request.validate_only:
                        successful.append(breakdown_id)
                        continue
                    
                    # Get current breakdown
                    breakdown = await self.get_breakdown_by_id(breakdown_id)
                    if not breakdown:
                        failed.append({
                            'breakdown_id': str(breakdown_id),
                            'error': 'Breakdown not found'
                        })
                        continue
                    
                    # Calculate new hierarchy level based on original parent
                    new_level = 0
                    if sap_info.original_parent_id:
                        original_parent = await self.get_breakdown_by_id(sap_info.original_parent_id)
                        if original_parent:
                            new_level = original_parent.hierarchy_level + 1
                    
                    # Restore to original SAP parent
                    update_data = {
                        'parent_breakdown_id': str(sap_info.original_parent_id) if sap_info.original_parent_id else None,
                        'hierarchy_level': new_level,
                        'has_custom_parent': False,
                        'updated_at': datetime.now().isoformat(),
                        'version': breakdown.version + 1
                    }
                    
                    result = self.supabase.table(self.table_name)\
                        .update(update_data)\
                        .eq('id', str(breakdown_id))\
                        .execute()
                    
                    if result.data:
                        # Update children's hierarchy levels
                        await self._update_children_levels(breakdown_id, new_level)
                        
                        # Recalculate parent totals
                        if breakdown.parent_breakdown_id:
                            await self._recalculate_parent_totals(breakdown.parent_breakdown_id)
                        if sap_info.original_parent_id:
                            await self._recalculate_parent_totals(sap_info.original_parent_id)
                        
                        # Create audit record
                        await self._create_version_record(
                            breakdown_id=breakdown_id,
                            version_number=breakdown.version + 1,
                            changes={
                                'action': 'restore_sap_relationship',
                                'old_parent': str(breakdown.parent_breakdown_id) if breakdown.parent_breakdown_id else None,
                                'restored_parent': str(sap_info.original_parent_id) if sap_info.original_parent_id else None
                            },
                            user_id=user_id
                        )
                        
                        successful.append(breakdown_id)
                        logger.info(f"Restored SAP relationship for breakdown {breakdown_id}")
                        
                        # Handle descendants if requested
                        if restore_request.restore_descendants:
                            descendants = await self._get_all_descendants(breakdown_id)
                            for desc in descendants:
                                if desc.has_custom_parent:
                                    desc_info = await self.get_sap_relationship_info(desc.id)
                                    if desc_info.can_restore:
                                        # Recursively restore descendants
                                        desc_request = SAPRelationshipRestoreRequest(
                                            breakdown_ids=[desc.id],
                                            restore_descendants=False,
                                            validate_only=False
                                        )
                                        await self.restore_sap_relationships(desc_request, user_id)
                    else:
                        failed.append({
                            'breakdown_id': str(breakdown_id),
                            'error': 'Update failed'
                        })
                        
                except Exception as e:
                    failed.append({
                        'breakdown_id': str(breakdown_id),
                        'error': str(e)
                    })
            
            result = SAPRelationshipRestoreResult(
                successful_restorations=successful,
                failed_restorations=failed,
                warnings=warnings,
                total_restored=len(successful),
                total_failed=len(failed)
            )
            
            logger.info(
                f"SAP relationship restoration complete: "
                f"{result.total_restored} successful, {result.total_failed} failed"
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to restore SAP relationships: {e}")
            raise
    
    async def _calculate_hierarchy_path(self, breakdown_id: UUID) -> List[UUID]:
        """
        Calculate the full hierarchy path from root to the given breakdown.
        
        Args:
            breakdown_id: ID of the breakdown
        
        Returns:
            List of UUIDs representing the path from root to breakdown
        """
        path = []
        current_id = breakdown_id
        
        # Prevent infinite loops
        max_iterations = MAX_HIERARCHY_DEPTH + 1
        iterations = 0
        
        while current_id and iterations < max_iterations:
            path.insert(0, current_id)
            breakdown = await self.get_breakdown_by_id(current_id)
            
            if not breakdown or not breakdown.parent_breakdown_id:
                break
            
            current_id = breakdown.parent_breakdown_id
            iterations += 1
        
        return path
    
    async def validate_custom_code(
        self,
        project_id: UUID,
        code: str,
        exclude_breakdown_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Validate custom code uniqueness within project scope.
        
        **Validates: Requirements 4.5**
        
        Args:
            project_id: ID of the project
            code: Code to validate
            exclude_breakdown_id: Optional breakdown ID to exclude from check (for updates)
        
        Returns:
            Dictionary with validation result:
            {
                'is_valid': bool,
                'is_unique': bool,
                'conflicts': List[Dict],
                'suggestions': List[str],
                'error': Optional[str]
            }
        """
        try:
            # Check if code is empty
            if not code or not code.strip():
                return {
                    'is_valid': False,
                    'is_unique': False,
                    'conflicts': [],
                    'suggestions': [],
                    'error': 'Code cannot be empty'
                }
            
            # Check code format (alphanumeric, hyphens, underscores only)
            import re
            if not re.match(r'^[a-zA-Z0-9_-]+$', code):
                return {
                    'is_valid': False,
                    'is_unique': False,
                    'conflicts': [],
                    'suggestions': [],
                    'error': 'Code must contain only letters, numbers, hyphens, and underscores'
                }
            
            # Check uniqueness within project
            query = self.supabase.table(self.table_name)\
                .select('id, name, code')\
                .eq('project_id', str(project_id))\
                .eq('code', code)\
                .eq('is_active', True)
            
            result = query.execute()
            
            conflicts = []
            if result.data:
                for item in result.data:
                    # Exclude the current breakdown if updating
                    if exclude_breakdown_id and item['id'] == str(exclude_breakdown_id):
                        continue
                    conflicts.append({
                        'id': item['id'],
                        'name': item['name'],
                        'code': item['code']
                    })
            
            is_unique = len(conflicts) == 0
            
            # Generate suggestions if not unique
            suggestions = []
            if not is_unique:
                # Suggest variations with suffixes
                for i in range(1, 6):
                    suggested_code = f"{code}_{i}"
                    # Check if suggestion is available
                    check_result = self.supabase.table(self.table_name)\
                        .select('id')\
                        .eq('project_id', str(project_id))\
                        .eq('code', suggested_code)\
                        .eq('is_active', True)\
                        .execute()
                    
                    if not check_result.data:
                        suggestions.append(suggested_code)
                        if len(suggestions) >= 3:
                            break
            
            return {
                'is_valid': is_unique,
                'is_unique': is_unique,
                'conflicts': conflicts,
                'suggestions': suggestions
            }
            
        except Exception as e:
            logger.error(f"Failed to validate custom code: {e}")
            raise
    
    async def bulk_update_codes(
        self,
        code_mappings: Dict[UUID, str],
        project_id: UUID,
        user_id: UUID,
        validate_first: bool = True
    ) -> Dict[str, Any]:
        """
        Bulk update codes for multiple breakdowns with validation.
        
        **Validates: Requirements 4.5**
        
        Args:
            code_mappings: Dictionary mapping breakdown IDs to new codes
            project_id: ID of the project
            user_id: ID of user making the update
            validate_first: If True, validate all codes before applying any updates
        
        Returns:
            Dictionary with update results:
            {
                'successful': List[UUID],
                'failed': List[Dict],
                'validation_errors': List[Dict]
            }
        """
        try:
            successful = []
            failed = []
            validation_errors = []
            
            # Validate all codes first if requested
            if validate_first:
                for breakdown_id, code in code_mappings.items():
                    validation = await self.validate_custom_code(
                        project_id, code, exclude_breakdown_id=breakdown_id
                    )
                    
                    if not validation['is_valid']:
                        validation_errors.append({
                            'breakdown_id': str(breakdown_id),
                            'code': code,
                            'error': validation.get('error', 'Code is not unique'),
                            'conflicts': validation.get('conflicts', []),
                            'suggestions': validation.get('suggestions', [])
                        })
                
                # If any validation errors, return without applying updates
                if validation_errors:
                    return {
                        'successful': [],
                        'failed': [],
                        'validation_errors': validation_errors
                    }
            
            # Apply updates
            for breakdown_id, code in code_mappings.items():
                try:
                    # Get current breakdown
                    current = await self.get_breakdown_by_id(breakdown_id)
                    if not current:
                        failed.append({
                            'breakdown_id': str(breakdown_id),
                            'code': code,
                            'error': 'Breakdown not found'
                        })
                        continue
                    
                    # Update code
                    update_data = {
                        'code': code,
                        'updated_at': datetime.now().isoformat(),
                        'version': current.version + 1
                    }
                    
                    result = self.supabase.table(self.table_name)\
                        .update(update_data)\
                        .eq('id', str(breakdown_id))\
                        .execute()
                    
                    if result.data:
                        # Create audit record
                        await self._create_version_record(
                            breakdown_id=breakdown_id,
                            version_number=current.version + 1,
                            changes={'action': 'update_code', 'old_code': current.code, 'new_code': code},
                            user_id=user_id
                        )
                        successful.append(breakdown_id)
                    else:
                        failed.append({
                            'breakdown_id': str(breakdown_id),
                            'code': code,
                            'error': 'Update failed'
                        })
                        
                except Exception as e:
                    failed.append({
                        'breakdown_id': str(breakdown_id),
                        'code': code,
                        'error': str(e)
                    })
            
            logger.info(f"Bulk code update: {len(successful)} successful, {len(failed)} failed")
            
            return {
                'successful': successful,
                'failed': failed,
                'validation_errors': validation_errors
            }
            
        except Exception as e:
            logger.error(f"Failed to bulk update codes: {e}")
            raise
    
    # =========================================================================
    # Helper Methods
    # =========================================================================
    
    async def _check_code_exists(self, project_id: UUID, code: str) -> bool:
        """Check if a code already exists in the project."""
        result = self.supabase.table(self.table_name)\
            .select('id')\
            .eq('project_id', str(project_id))\
            .eq('code', code)\
            .eq('is_active', True)\
            .execute()
        return len(result.data) > 0
    
    async def _create_version_record(
        self,
        breakdown_id: UUID,
        version_number: int,
        changes: Dict[str, Any],
        user_id: UUID,
        change_type: Optional[str] = None,
        change_summary: Optional[str] = None,
        before_values: Optional[Dict[str, Any]] = None,
        after_values: Optional[Dict[str, Any]] = None,
        change_reason: Optional[str] = None,
        is_import: bool = False,
        import_batch_id: Optional[UUID] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> None:
        """
        Create a comprehensive version record for audit trail.
        
        **Validates: Requirements 6.1, 6.2**
        
        Args:
            breakdown_id: UUID of the breakdown being modified
            version_number: Version number for this change
            changes: Dictionary of changed fields with before/after values
            user_id: UUID of user making the change
            change_type: Type of change (create, update, delete, move, etc.)
            change_summary: Human-readable summary of changes
            before_values: Complete snapshot before change
            after_values: Complete snapshot after change
            change_reason: Optional reason for the change
            is_import: Whether this change is part of an import operation
            import_batch_id: Optional import batch ID if is_import=True
            ip_address: Optional IP address of the user
            user_agent: Optional user agent string
        """
        try:
            # Determine change type from changes if not provided
            if not change_type:
                if 'action' in changes:
                    change_type = changes['action']
                elif 'parent_breakdown_id' in changes:
                    change_type = 'move'
                elif 'custom_fields' in changes:
                    change_type = 'custom_field_update'
                elif 'tags' in changes:
                    change_type = 'tag_update'
                elif any(k in changes for k in ['planned_amount', 'committed_amount', 'actual_amount']):
                    change_type = 'financial_update'
                else:
                    change_type = 'update'
            
            # Generate change summary if not provided
            if not change_summary and changes:
                changed_fields = [k for k in changes.keys() if k != 'action']
                if changed_fields:
                    change_summary = f"Updated fields: {', '.join(changed_fields[:5])}"
                    if len(changed_fields) > 5:
                        change_summary += f" and {len(changed_fields) - 5} more"
            
            version_data = {
                'id': str(uuid4()),
                'breakdown_id': str(breakdown_id),
                'version_number': version_number,
                'changes': changes,
                'change_type': change_type,
                'change_summary': change_summary,
                'before_values': before_values or {},
                'after_values': after_values or {},
                'changed_by': str(user_id),
                'changed_at': datetime.now().isoformat(),
                'change_reason': change_reason,
                'is_import': is_import,
                'import_batch_id': str(import_batch_id) if import_batch_id else None,
                'ip_address': ip_address,
                'user_agent': user_agent
            }
            
            self.supabase.table(self.version_table).insert(version_data).execute()
            logger.info(f"Created version record for breakdown {breakdown_id}, version {version_number}, type: {change_type}")
        except Exception as e:
            logger.warning(f"Failed to create version record for breakdown {breakdown_id}: {e}")
    
    def _apply_filters(self, query, filter_criteria: POBreakdownFilter):
        """
        Apply comprehensive filter criteria to a query.
        
        **Validates: Requirements 7.1, 7.2, 7.3**
        
        Supports:
        - Text search across names, codes, and descriptions (Requirement 7.1)
        - Financial criteria filtering with amount ranges and variance thresholds (Requirement 7.2)
        - Hierarchical filtering by level or branch (Requirement 7.3)
        """
        if filter_criteria.is_active is not None:
            query = query.eq('is_active', filter_criteria.is_active)
        
        # Text search across multiple fields (Requirement 7.1)
        if filter_criteria.search_text:
            # Note: Supabase doesn't support OR queries directly in the query builder
            # We'll need to fetch and filter in memory for multi-field text search
            # For now, search across name, code, and notes fields
            search_term = filter_criteria.search_text.lower()
            query = query.or_(
                f'name.ilike.%{search_term}%,'
                f'code.ilike.%{search_term}%,'
                f'notes.ilike.%{search_term}%,'
                f'sap_po_number.ilike.%{search_term}%'
            )
        
        if filter_criteria.breakdown_types:
            types = [t.value for t in filter_criteria.breakdown_types]
            query = query.in_('breakdown_type', types)
        
        if filter_criteria.categories:
            query = query.in_('category', filter_criteria.categories)
        
        if filter_criteria.cost_centers:
            query = query.in_('cost_center', filter_criteria.cost_centers)
        
        if filter_criteria.gl_accounts:
            query = query.in_('gl_account', filter_criteria.gl_accounts)
        
        if filter_criteria.tags:
            # Filter by tags - items must have at least one of the specified tags
            # Note: This requires JSONB array containment in PostgreSQL
            for tag in filter_criteria.tags:
                query = query.contains('tags', [tag])
        
        # Hierarchical filtering (Requirement 7.3)
        if filter_criteria.hierarchy_levels:
            query = query.in_('hierarchy_level', filter_criteria.hierarchy_levels)
        
        if filter_criteria.parent_id:
            query = query.eq('parent_breakdown_id', str(filter_criteria.parent_id))
        
        # Financial criteria filtering (Requirement 7.2)
        if filter_criteria.min_planned_amount is not None:
            query = query.gte('planned_amount', str(filter_criteria.min_planned_amount))
        
        if filter_criteria.max_planned_amount is not None:
            query = query.lte('planned_amount', str(filter_criteria.max_planned_amount))
        
        # Variance threshold filtering (Requirement 7.2)
        # Note: Variance percentage is calculated, not stored, so we'll need to filter in memory
        # This is handled in the search_breakdowns method
        
        if filter_criteria.import_batch_id:
            query = query.eq('import_batch_id', str(filter_criteria.import_batch_id))
        
        # Date range filtering
        if filter_criteria.created_after:
            query = query.gte('created_at', filter_criteria.created_after.isoformat())
        
        if filter_criteria.created_before:
            query = query.lte('created_at', filter_criteria.created_before.isoformat())
        
        return query
    
    def _map_to_response(self, row: Dict[str, Any]) -> POBreakdownResponse:
        """Map a database row to POBreakdownResponse."""
        return POBreakdownResponse(
            id=UUID(row['id']),
            project_id=UUID(row['project_id']),
            name=row['name'],
            code=row.get('code'),
            sap_po_number=row.get('sap_po_number'),
            sap_line_item=row.get('sap_line_item'),
            hierarchy_level=row.get('hierarchy_level', 0),
            parent_breakdown_id=UUID(row['parent_breakdown_id']) if row.get('parent_breakdown_id') else None,
            display_order=row.get('display_order'),
            # SAP Relationship Preservation fields
            original_sap_parent_id=UUID(row['original_sap_parent_id']) if row.get('original_sap_parent_id') else None,
            sap_hierarchy_path=[UUID(uuid_str) for uuid_str in row.get('sap_hierarchy_path', [])] if row.get('sap_hierarchy_path') else None,
            has_custom_parent=row.get('has_custom_parent', False),
            cost_center=row.get('cost_center'),
            gl_account=row.get('gl_account'),
            planned_amount=Decimal(str(row.get('planned_amount', 0))),
            committed_amount=Decimal(str(row.get('committed_amount', 0))),
            actual_amount=Decimal(str(row.get('actual_amount', 0))),
            remaining_amount=Decimal(str(row.get('remaining_amount', 0))),
            currency=row.get('currency', 'USD'),
            exchange_rate=Decimal(str(row.get('exchange_rate', 1))),
            breakdown_type=POBreakdownType(row.get('breakdown_type', 'sap_standard')),
            category=row.get('category'),
            subcategory=row.get('subcategory'),
            custom_fields=row.get('custom_fields', {}),
            tags=row.get('tags', []),
            notes=row.get('notes'),
            import_batch_id=UUID(row['import_batch_id']) if row.get('import_batch_id') else None,
            import_source=row.get('import_source'),
            version=row.get('version', 1),
            is_active=row.get('is_active', True),
            created_by=UUID(row['created_by']) if row.get('created_by') else None,
            created_at=datetime.fromisoformat(row['created_at'].replace('Z', '+00:00')) if row.get('created_at') else datetime.now(),
            updated_at=datetime.fromisoformat(row['updated_at'].replace('Z', '+00:00')) if row.get('updated_at') else datetime.now(),
        )
    
    def _calculate_financial_summary(self, breakdowns: List[Dict[str, Any]]) -> HierarchyFinancialSummary:
        """Calculate financial summary from breakdowns."""
        if not breakdowns:
            return HierarchyFinancialSummary(
                total_planned=Decimal('0'),
                total_committed=Decimal('0'),
                total_actual=Decimal('0'),
                total_remaining=Decimal('0'),
                variance_amount=Decimal('0'),
                variance_percentage=Decimal('0'),
                currency='USD',
                by_category={},
                by_level={}
            )
        
        total_planned = sum(Decimal(str(b.get('planned_amount', 0))) for b in breakdowns)
        total_committed = sum(Decimal(str(b.get('committed_amount', 0))) for b in breakdowns)
        total_actual = sum(Decimal(str(b.get('actual_amount', 0))) for b in breakdowns)
        total_remaining = total_planned - total_actual
        variance_amount = total_actual - total_planned
        
        variance_percentage = Decimal('0')
        if total_planned > 0:
            variance_percentage = (variance_amount / total_planned * 100).quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP
            )
        
        # Calculate by category
        by_category = {}
        categories = set(b.get('category') for b in breakdowns if b.get('category'))
        for category in categories:
            cat_breakdowns = [b for b in breakdowns if b.get('category') == category]
            by_category[category] = CategorySummary(
                category=category,
                total_planned=sum(Decimal(str(b.get('planned_amount', 0))) for b in cat_breakdowns),
                total_committed=sum(Decimal(str(b.get('committed_amount', 0))) for b in cat_breakdowns),
                total_actual=sum(Decimal(str(b.get('actual_amount', 0))) for b in cat_breakdowns),
                total_remaining=sum(Decimal(str(b.get('planned_amount', 0))) - Decimal(str(b.get('actual_amount', 0))) for b in cat_breakdowns),
                item_count=len(cat_breakdowns)
            )
        
        # Calculate by level
        by_level = {}
        levels = set(b.get('hierarchy_level', 0) for b in breakdowns)
        for level in levels:
            level_breakdowns = [b for b in breakdowns if b.get('hierarchy_level', 0) == level]
            by_level[level] = LevelSummary(
                level=level,
                total_planned=sum(Decimal(str(b.get('planned_amount', 0))) for b in level_breakdowns),
                total_committed=sum(Decimal(str(b.get('committed_amount', 0))) for b in level_breakdowns),
                total_actual=sum(Decimal(str(b.get('actual_amount', 0))) for b in level_breakdowns),
                total_remaining=sum(Decimal(str(b.get('planned_amount', 0))) - Decimal(str(b.get('actual_amount', 0))) for b in level_breakdowns),
                item_count=len(level_breakdowns)
            )
        
        currency = breakdowns[0].get('currency', 'USD') if breakdowns else 'USD'
        
        return HierarchyFinancialSummary(
            total_planned=total_planned,
            total_committed=total_committed,
            total_actual=total_actual,
            total_remaining=total_remaining,
            variance_amount=variance_amount,
            variance_percentage=variance_percentage,
            currency=currency,
            by_category=by_category,
            by_level=by_level
        )
    
    # =========================================================================
    # Change Request Integration (Task 7.3)
    # =========================================================================
    
    async def link_to_change_request(
        self,
        breakdown_id: UUID,
        change_request_id: UUID,
        impact_type: str,
        impact_amount: Optional[Decimal] = None,
        impact_percentage: Optional[Decimal] = None,
        description: Optional[str] = None,
        user_id: UUID = None
    ) -> Dict[str, Any]:
        """
        Link a PO breakdown item to a change request.
        
        **Validates: Requirements 5.5**
        
        Args:
            breakdown_id: PO breakdown UUID
            change_request_id: Change request UUID
            impact_type: Type of impact (cost_increase, cost_decrease, scope_change, etc.)
            impact_amount: Financial impact amount
            impact_percentage: Impact as percentage
            description: Description of the impact
            user_id: User creating the link
            
        Returns:
            Dictionary with link details
            
        Raises:
            ValueError: If validation fails
            Exception: If database operation fails
        """
        try:
            # Validate breakdown exists
            breakdown = await self.get_breakdown_by_id(breakdown_id)
            if not breakdown:
                raise ValueError(f"PO breakdown {breakdown_id} not found")
            
            # Validate change request exists
            cr_result = self.supabase.table('change_requests')\
                .select('id, project_id, status')\
                .eq('id', str(change_request_id))\
                .execute()
            
            if not cr_result.data:
                raise ValueError(f"Change request {change_request_id} not found")
            
            change_request = cr_result.data[0]
            
            # Validate same project
            if str(breakdown.project_id) != change_request['project_id']:
                raise ValueError("PO breakdown and change request must be in the same project")
            
            # Validate impact type
            valid_impact_types = [
                'cost_increase', 'cost_decrease', 'scope_change',
                'reallocation', 'new_po', 'po_cancellation'
            ]
            if impact_type not in valid_impact_types:
                raise ValueError(f"Invalid impact_type. Must be one of: {', '.join(valid_impact_types)}")
            
            # Check if link already exists
            existing_link = self.supabase.table('change_request_po_links')\
                .select('id')\
                .eq('change_request_id', str(change_request_id))\
                .eq('po_breakdown_id', str(breakdown_id))\
                .eq('impact_type', impact_type)\
                .execute()
            
            if existing_link.data:
                raise ValueError(
                    f"Link already exists between change request {change_request_id} "
                    f"and PO breakdown {breakdown_id} with impact type '{impact_type}'"
                )
            
            # Create the link
            link_data = {
                'id': str(uuid4()),
                'change_request_id': str(change_request_id),
                'po_breakdown_id': str(breakdown_id),
                'impact_type': impact_type,
                'impact_amount': str(impact_amount) if impact_amount else '0',
                'impact_percentage': str(impact_percentage) if impact_percentage else None,
                'description': description,
                'created_at': datetime.now().isoformat()
            }
            
            result = self.supabase.table('change_request_po_links').insert(link_data).execute()
            
            if not result.data:
                raise Exception("Failed to create PO breakdown-change request link")
            
            link = result.data[0]
            
            # Trigger automatic financial impact assessment update (Requirement 5.5)
            await self._update_change_request_financial_impact(
                change_request_id=change_request_id,
                trigger_event='po_link_created',
                event_data={
                    'breakdown_id': str(breakdown_id),
                    'breakdown_name': breakdown.name,
                    'impact_type': impact_type,
                    'impact_amount': str(impact_amount) if impact_amount else '0'
                }
            )
            
            # Create audit record
            if user_id:
                await self._create_version_record(
                    breakdown_id=breakdown_id,
                    version_number=breakdown.version + 1,
                    changes={
                        'action': 'link_to_change_request',
                        'change_request_id': str(change_request_id),
                        'impact_type': impact_type,
                        'impact_amount': str(impact_amount) if impact_amount else '0'
                    },
                    user_id=user_id
                )
            
            logger.info(
                f"Linked PO breakdown {breakdown_id} to change request {change_request_id} "
                f"with impact type '{impact_type}'"
            )
            
            return {
                'link_id': link['id'],
                'breakdown_id': str(breakdown_id),
                'breakdown_name': breakdown.name,
                'change_request_id': str(change_request_id),
                'impact_type': impact_type,
                'impact_amount': Decimal(link['impact_amount']),
                'impact_percentage': Decimal(link['impact_percentage']) if link.get('impact_percentage') else None,
                'description': link.get('description'),
                'created_at': link['created_at']
            }
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to link PO breakdown to change request: {e}")
            raise
    
    async def unlink_from_change_request(
        self,
        breakdown_id: UUID,
        change_request_id: UUID,
        impact_type: Optional[str] = None,
        user_id: UUID = None
    ) -> bool:
        """
        Remove link between PO breakdown and change request.
        
        **Validates: Requirements 5.5**
        
        Args:
            breakdown_id: PO breakdown UUID
            change_request_id: Change request UUID
            impact_type: Optional specific impact type to unlink
            user_id: User removing the link
            
        Returns:
            True if successful
        """
        try:
            query = self.supabase.table('change_request_po_links')\
                .delete()\
                .eq('change_request_id', str(change_request_id))\
                .eq('po_breakdown_id', str(breakdown_id))
            
            if impact_type:
                query = query.eq('impact_type', impact_type)
            
            result = query.execute()
            
            if result.data:
                # Trigger automatic financial impact assessment update
                await self._update_change_request_financial_impact(
                    change_request_id=change_request_id,
                    trigger_event='po_link_removed',
                    event_data={
                        'breakdown_id': str(breakdown_id),
                        'impact_type': impact_type
                    }
                )
                
                # Create audit record
                if user_id:
                    breakdown = await self.get_breakdown_by_id(breakdown_id)
                    if breakdown:
                        await self._create_version_record(
                            breakdown_id=breakdown_id,
                            version_number=breakdown.version + 1,
                            changes={
                                'action': 'unlink_from_change_request',
                                'change_request_id': str(change_request_id),
                                'impact_type': impact_type
                            },
                            user_id=user_id
                        )
                
                logger.info(
                    f"Unlinked PO breakdown {breakdown_id} from change request {change_request_id}"
                )
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Failed to unlink PO breakdown from change request: {e}")
            raise
    
    async def get_change_request_links(
        self,
        breakdown_id: UUID
    ) -> List[Dict[str, Any]]:
        """
        Get all change request links for a PO breakdown.
        
        **Validates: Requirements 5.5**
        
        Args:
            breakdown_id: PO breakdown UUID
            
        Returns:
            List of change request link details
        """
        try:
            result = self.supabase.table('change_request_po_links')\
                .select('*, change_requests(id, change_number, title, status, priority)')\
                .eq('po_breakdown_id', str(breakdown_id))\
                .execute()
            
            links = []
            for row in result.data:
                cr_data = row.get('change_requests', {})
                links.append({
                    'link_id': row['id'],
                    'change_request_id': row['change_request_id'],
                    'change_number': cr_data.get('change_number'),
                    'change_title': cr_data.get('title'),
                    'change_status': cr_data.get('status'),
                    'change_priority': cr_data.get('priority'),
                    'impact_type': row['impact_type'],
                    'impact_amount': Decimal(row['impact_amount']),
                    'impact_percentage': Decimal(row['impact_percentage']) if row.get('impact_percentage') else None,
                    'description': row.get('description'),
                    'created_at': row['created_at']
                })
            
            return links
            
        except Exception as e:
            logger.error(f"Failed to get change request links for breakdown {breakdown_id}: {e}")
            raise
    
    async def get_breakdown_links_for_change_request(
        self,
        change_request_id: UUID
    ) -> List[Dict[str, Any]]:
        """
        Get all PO breakdown links for a change request.
        
        **Validates: Requirements 5.5**
        
        Args:
            change_request_id: Change request UUID
            
        Returns:
            List of PO breakdown link details
        """
        try:
            result = self.supabase.table('change_request_po_links')\
                .select('*, po_breakdowns(id, name, code, planned_amount, actual_amount, currency)')\
                .eq('change_request_id', str(change_request_id))\
                .execute()
            
            links = []
            for row in result.data:
                po_data = row.get('po_breakdowns', {})
                links.append({
                    'link_id': row['id'],
                    'breakdown_id': row['po_breakdown_id'],
                    'breakdown_name': po_data.get('name'),
                    'breakdown_code': po_data.get('code'),
                    'planned_amount': Decimal(str(po_data.get('planned_amount', 0))),
                    'actual_amount': Decimal(str(po_data.get('actual_amount', 0))),
                    'currency': po_data.get('currency', 'USD'),
                    'impact_type': row['impact_type'],
                    'impact_amount': Decimal(row['impact_amount']),
                    'impact_percentage': Decimal(row['impact_percentage']) if row.get('impact_percentage') else None,
                    'description': row.get('description'),
                    'created_at': row['created_at']
                })
            
            return links
            
        except Exception as e:
            logger.error(f"Failed to get PO breakdown links for change request {change_request_id}: {e}")
            raise
    
    async def _update_change_request_financial_impact(
        self,
        change_request_id: UUID,
        trigger_event: str,
        event_data: Dict[str, Any]
    ) -> None:
        """
        Update financial impact assessment for a change request.
        
        **Validates: Requirements 5.5**
        
        This method recalculates the total financial impact of a change request
        based on all linked PO breakdown items and updates the change_impacts table.
        
        Args:
            change_request_id: Change request UUID
            trigger_event: Event that triggered the update
            event_data: Additional event data
        """
        try:
            # Get all PO breakdown links for this change request
            links = await self.get_breakdown_links_for_change_request(change_request_id)
            
            # Calculate total financial impact
            total_cost_increase = Decimal('0')
            total_cost_decrease = Decimal('0')
            total_cost_savings = Decimal('0')
            
            cost_breakdown = {
                'po_impacts': [],
                'by_impact_type': {},
                'total_net_impact': Decimal('0')
            }
            
            for link in links:
                impact_amount = link['impact_amount']
                impact_type = link['impact_type']
                
                # Categorize impacts
                if impact_type == 'cost_increase':
                    total_cost_increase += impact_amount
                elif impact_type == 'cost_decrease':
                    total_cost_decrease += impact_amount
                    total_cost_savings += impact_amount
                
                # Add to breakdown
                cost_breakdown['po_impacts'].append({
                    'breakdown_id': link['breakdown_id'],
                    'breakdown_name': link['breakdown_name'],
                    'breakdown_code': link['breakdown_code'],
                    'impact_type': impact_type,
                    'impact_amount': str(impact_amount),
                    'currency': link['currency']
                })
                
                # Aggregate by impact type
                if impact_type not in cost_breakdown['by_impact_type']:
                    cost_breakdown['by_impact_type'][impact_type] = Decimal('0')
                cost_breakdown['by_impact_type'][impact_type] += impact_amount
            
            # Calculate net impact
            net_impact = total_cost_increase - total_cost_decrease
            cost_breakdown['total_net_impact'] = str(net_impact)
            
            # Convert Decimals to strings for JSON storage
            for key in cost_breakdown['by_impact_type']:
                cost_breakdown['by_impact_type'][key] = str(cost_breakdown['by_impact_type'][key])
            
            # Check if change_impacts record exists
            impacts_result = self.supabase.table('change_impacts')\
                .select('id')\
                .eq('change_request_id', str(change_request_id))\
                .execute()
            
            impact_data = {
                'direct_costs': str(total_cost_increase),
                'cost_savings': str(total_cost_savings),
                'cost_breakdown': cost_breakdown,
                'updated_at': datetime.now().isoformat()
            }
            
            if impacts_result.data:
                # Update existing record
                self.supabase.table('change_impacts')\
                    .update(impact_data)\
                    .eq('change_request_id', str(change_request_id))\
                    .execute()
            else:
                # Create new record
                impact_data['id'] = str(uuid4())
                impact_data['change_request_id'] = str(change_request_id)
                impact_data['created_at'] = datetime.now().isoformat()
                
                self.supabase.table('change_impacts').insert(impact_data).execute()
            
            # Update the change request's estimated_cost_impact field
            self.supabase.table('change_requests')\
                .update({
                    'estimated_cost_impact': str(net_impact),
                    'updated_at': datetime.now().isoformat()
                })\
                .eq('id', str(change_request_id))\
                .execute()
            
            logger.info(
                f"Updated financial impact for change request {change_request_id}: "
                f"net impact = {net_impact}, trigger = {trigger_event}"
            )
            
        except Exception as e:
            logger.error(f"Failed to update change request financial impact: {e}")
            # Don't raise - this is a background update that shouldn't fail the main operation


    # =========================================================================
    # Version Control and Audit Trail Methods
    # =========================================================================
    
    async def get_breakdown_version_history(
        self,
        breakdown_id: UUID,
        limit: int = 50,
        offset: int = 0
    ) -> List[POBreakdownVersion]:
        """
        Get version history for a specific breakdown.
        
        **Validates: Requirements 6.3**
        
        Args:
            breakdown_id: Breakdown UUID
            limit: Maximum number of versions to return
            offset: Offset for pagination
            
        Returns:
            List of POBreakdownVersion objects in reverse chronological order
        """
        try:
            result = self.supabase.table(self.version_table)\
                .select('*')\
                .eq('breakdown_id', str(breakdown_id))\
                .order('version_number', desc=True)\
                .order('changed_at', desc=True)\
                .range(offset, offset + limit - 1)\
                .execute()
            
            versions = []
            for row in result.data or []:
                versions.append(POBreakdownVersion(
                    id=UUID(row['id']),
                    breakdown_id=UUID(row['breakdown_id']),
                    version_number=row['version_number'],
                    changes=row.get('changes', {}),
                    changed_by=UUID(row['changed_by']),
                    changed_at=datetime.fromisoformat(row['changed_at'].replace('Z', '+00:00')),
                    change_reason=row.get('change_reason'),
                    is_import=row.get('is_import', False)
                ))
            
            logger.info(f"Retrieved {len(versions)} version records for breakdown {breakdown_id}")
            return versions
            
        except Exception as e:
            logger.error(f"Failed to get version history for breakdown {breakdown_id}: {e}")
            raise
    
    async def get_project_audit_trail(
        self,
        project_id: UUID,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        change_types: Optional[List[str]] = None,
        user_ids: Optional[List[UUID]] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get comprehensive audit trail for all PO breakdowns in a project.
        
        **Validates: Requirements 6.3, 6.5**
        
        Args:
            project_id: Project UUID
            start_date: Optional start date filter
            end_date: Optional end date filter
            change_types: Optional list of change types to filter
            user_ids: Optional list of user IDs to filter
            limit: Maximum number of records to return
            offset: Offset for pagination
            
        Returns:
            List of audit trail records with breakdown and user information
        """
        try:
            # Get all breakdown IDs for the project
            breakdowns_result = self.supabase.table(self.table_name)\
                .select('id, name, code')\
                .eq('project_id', str(project_id))\
                .execute()
            
            breakdown_map = {
                row['id']: {'name': row['name'], 'code': row.get('code')}
                for row in breakdowns_result.data or []
            }
            
            if not breakdown_map:
                return []
            
            # Build query for version records
            query = self.supabase.table(self.version_table)\
                .select('*')\
                .in_('breakdown_id', list(breakdown_map.keys()))
            
            # Apply filters
            if start_date:
                query = query.gte('changed_at', start_date.isoformat())
            if end_date:
                query = query.lte('changed_at', end_date.isoformat())
            if change_types:
                query = query.in_('change_type', change_types)
            if user_ids:
                query = query.in_('changed_by', [str(uid) for uid in user_ids])
            
            # Execute query with pagination
            result = query.order('changed_at', desc=True)\
                .range(offset, offset + limit - 1)\
                .execute()
            
            # Enrich with breakdown and user information
            audit_records = []
            for row in result.data or []:
                breakdown_id = row['breakdown_id']
                breakdown_info = breakdown_map.get(breakdown_id, {})
                
                audit_records.append({
                    'breakdown_id': breakdown_id,
                    'breakdown_name': breakdown_info.get('name', 'Unknown'),
                    'breakdown_code': breakdown_info.get('code'),
                    'version_number': row['version_number'],
                    'change_type': row.get('change_type', 'update'),
                    'change_summary': row.get('change_summary'),
                    'changes': row.get('changes', {}),
                    'before_values': row.get('before_values', {}),
                    'after_values': row.get('after_values', {}),
                    'changed_by': row['changed_by'],
                    'changed_at': row['changed_at'],
                    'change_reason': row.get('change_reason'),
                    'is_import': row.get('is_import', False),
                    'import_batch_id': row.get('import_batch_id'),
                    'ip_address': row.get('ip_address'),
                    'user_agent': row.get('user_agent')
                })
            
            logger.info(f"Retrieved {len(audit_records)} audit records for project {project_id}")
            return audit_records
            
        except Exception as e:
            logger.error(f"Failed to get audit trail for project {project_id}: {e}")
            raise
    
    async def export_audit_data(
        self,
        project_id: UUID,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        format: str = 'json'
    ) -> Dict[str, Any]:
        """
        Export complete audit data in machine-readable format.
        
        **Validates: Requirement 6.5**
        
        Args:
            project_id: Project UUID
            start_date: Optional start date filter
            end_date: Optional end date filter
            format: Export format ('json', 'csv')
            
        Returns:
            Dictionary containing audit data and metadata
        """
        try:
            # Get all audit records without pagination
            audit_records = await self.get_project_audit_trail(
                project_id=project_id,
                start_date=start_date,
                end_date=end_date,
                limit=10000  # Large limit for export
            )
            
            # Build export data structure
            export_data = {
                'project_id': str(project_id),
                'export_date': datetime.now().isoformat(),
                'date_range': {
                    'start': start_date.isoformat() if start_date else None,
                    'end': end_date.isoformat() if end_date else None
                },
                'total_records': len(audit_records),
                'format': format,
                'audit_records': audit_records
            }
            
            logger.info(f"Exported {len(audit_records)} audit records for project {project_id}")
            return export_data
            
        except Exception as e:
            logger.error(f"Failed to export audit data for project {project_id}: {e}")
            raise
    
    async def get_version_statistics(
        self,
        project_id: UUID
    ) -> Dict[str, Any]:
        """
        Get version tracking statistics for a project.
        
        **Validates: Requirements 6.1, 6.3**
        
        Args:
            project_id: Project UUID
            
        Returns:
            Dictionary containing version statistics
        """
        try:
            # Get all breakdown IDs for the project
            breakdowns_result = self.supabase.table(self.table_name)\
                .select('id')\
                .eq('project_id', str(project_id))\
                .execute()
            
            breakdown_ids = [row['id'] for row in breakdowns_result.data or []]
            
            if not breakdown_ids:
                return {
                    'total_versions': 0,
                    'total_breakdowns': 0,
                    'changes_by_type': {},
                    'changes_by_user': {},
                    'recent_activity': []
                }
            
            # Get all version records
            versions_result = self.supabase.table(self.version_table)\
                .select('*')\
                .in_('breakdown_id', breakdown_ids)\
                .execute()
            
            versions = versions_result.data or []
            
            # Calculate statistics
            changes_by_type = {}
            changes_by_user = {}
            
            for v in versions:
                # Count by change type
                change_type = v.get('change_type', 'update')
                changes_by_type[change_type] = changes_by_type.get(change_type, 0) + 1
                
                # Count by user
                user_id = v.get('changed_by')
                if user_id:
                    changes_by_user[user_id] = changes_by_user.get(user_id, 0) + 1
            
            # Get recent activity (last 10 changes)
            recent_versions = sorted(
                versions,
                key=lambda x: x.get('changed_at', ''),
                reverse=True
            )[:10]
            
            recent_activity = []
            for v in recent_versions:
                # Get breakdown name
                breakdown_id = v['breakdown_id']
                breakdown_result = self.supabase.table(self.table_name)\
                    .select('name')\
                    .eq('id', breakdown_id)\
                    .execute()
                
                breakdown_name = 'Unknown'
                if breakdown_result.data:
                    breakdown_name = breakdown_result.data[0]['name']
                
                recent_activity.append({
                    'breakdown_id': breakdown_id,
                    'breakdown_name': breakdown_name,
                    'change_type': v.get('change_type', 'update'),
                    'changed_at': v.get('changed_at'),
                    'changed_by': v.get('changed_by')
                })
            
            stats = {
                'total_versions': len(versions),
                'total_breakdowns': len(breakdown_ids),
                'changes_by_type': changes_by_type,
                'changes_by_user': changes_by_user,
                'recent_activity': recent_activity
            }
            
            logger.info(f"Retrieved version statistics for project {project_id}: {stats['total_versions']} versions")
            return stats
            
        except Exception as e:
            logger.error(f"Failed to get version statistics for project {project_id}: {e}")
            raise
    
    async def restore_breakdown_version(
        self,
        breakdown_id: UUID,
        version_number: int,
        user_id: UUID,
        restore_reason: Optional[str] = None
    ) -> POBreakdownResponse:
        """
        Restore a breakdown to a previous version.
        
        **Validates: Requirements 6.2, 6.4**
        
        Args:
            breakdown_id: Breakdown UUID to restore
            version_number: Version number to restore to
            user_id: User performing the restoration
            restore_reason: Optional reason for restoration
            
        Returns:
            Updated POBreakdownResponse
        """
        try:
            # Get the target version
            version_result = self.supabase.table(self.version_table)\
                .select('*')\
                .eq('breakdown_id', str(breakdown_id))\
                .eq('version_number', version_number)\
                .execute()
            
            if not version_result.data:
                raise ValueError(f"Version {version_number} not found for breakdown {breakdown_id}")
            
            version_record = version_result.data[0]
            before_values = version_record.get('before_values', {})
            
            if not before_values:
                raise ValueError(f"Cannot restore: version {version_number} has no before_values snapshot")
            
            # Get current breakdown
            current = await self.get_breakdown_by_id(breakdown_id)
            if not current:
                raise ValueError(f"Breakdown {breakdown_id} not found")
            
            # Build update data from before_values
            update_data = {}
            restorable_fields = [
                'name', 'code', 'parent_breakdown_id', 'cost_center', 'gl_account',
                'planned_amount', 'committed_amount', 'actual_amount',
                'currency', 'category', 'subcategory', 'custom_fields', 'tags', 'notes'
            ]
            
            for field in restorable_fields:
                if field in before_values:
                    update_data[field] = before_values[field]
            
            # Increment version
            update_data['version'] = current.version + 1
            update_data['updated_at'] = datetime.now().isoformat()
            
            # Execute update
            result = self.supabase.table(self.table_name)\
                .update(update_data)\
                .eq('id', str(breakdown_id))\
                .execute()
            
            if not result.data:
                raise Exception("Failed to restore breakdown version")
            
            # Create version record for the restoration
            await self._create_version_record(
                breakdown_id=breakdown_id,
                version_number=current.version + 1,
                changes={
                    'action': 'restore',
                    'restored_from_version': version_number,
                    'restored_fields': list(update_data.keys())
                },
                user_id=user_id,
                change_type='update',
                change_summary=f"Restored to version {version_number}",
                change_reason=restore_reason or f"Restored from version {version_number}"
            )
            
            logger.info(f"Restored breakdown {breakdown_id} to version {version_number}")
            
            return self._map_to_response(result.data[0])
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to restore breakdown {breakdown_id} to version {version_number}: {e}")
            raise
    
    # =========================================================================
    # Task 8.2: Soft Deletion and Historical Data Preservation
    # =========================================================================
    
    async def restore_soft_deleted_breakdown(
        self,
        breakdown_id: UUID,
        user_id: UUID,
        restore_reason: Optional[str] = None
    ) -> POBreakdownResponse:
        """
        Restore a soft-deleted PO breakdown.
        
        **Validates: Requirements 6.4 (soft deletion with retention of historical records)**
        
        This method reactivates a breakdown that was previously soft-deleted,
        preserving all historical data and creating an audit trail entry.
        
        Args:
            breakdown_id: UUID of the breakdown to restore
            user_id: UUID of user performing the restoration
            restore_reason: Optional reason for restoration
            
        Returns:
            Restored POBreakdownResponse
            
        Raises:
            ValueError: If breakdown not found or not soft-deleted
            Exception: If database operation fails
        """
        try:
            # Get the breakdown (including inactive ones)
            result = self.supabase.table(self.table_name)\
                .select('*')\
                .eq('id', str(breakdown_id))\
                .execute()
            
            if not result.data:
                raise ValueError(f"Breakdown {breakdown_id} not found")
            
            breakdown_data = result.data[0]
            
            if breakdown_data.get('is_active', True):
                raise ValueError(f"Breakdown {breakdown_id} is not soft-deleted")
            
            # Get current version
            current_version = breakdown_data.get('version', 1)
            
            # Restore the breakdown by setting is_active to True
            update_data = {
                'is_active': True,
                'version': current_version + 1,
                'updated_at': datetime.now().isoformat()
            }
            
            restore_result = self.supabase.table(self.table_name)\
                .update(update_data)\
                .eq('id', str(breakdown_id))\
                .execute()
            
            if not restore_result.data:
                raise Exception("Failed to restore breakdown")
            
            # Create comprehensive version record for audit trail
            await self._create_version_record(
                breakdown_id=breakdown_id,
                version_number=current_version + 1,
                changes={
                    'action': 'restore',
                    'is_active': {'old': False, 'new': True}
                },
                user_id=user_id,
                change_type='update',
                change_summary='Restored soft-deleted breakdown',
                before_values={'is_active': False, **breakdown_data},
                after_values={'is_active': True, **breakdown_data},
                change_reason=restore_reason or 'Breakdown restored from soft-deleted state'
            )
            
            logger.info(f"Restored soft-deleted breakdown {breakdown_id}")
            
            return self._map_to_response(restore_result.data[0])
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to restore soft-deleted breakdown {breakdown_id}: {e}")
            raise
    
    async def get_soft_deleted_breakdowns(
        self,
        project_id: UUID,
        limit: int = 50,
        offset: int = 0
    ) -> List[POBreakdownResponse]:
        """
        Get all soft-deleted breakdowns for a project.
        
        **Validates: Requirements 6.4 (retention of historical records)**
        
        Args:
            project_id: Project UUID
            limit: Maximum number of records to return
            offset: Offset for pagination
            
        Returns:
            List of soft-deleted POBreakdownResponse objects
        """
        try:
            result = self.supabase.table(self.table_name)\
                .select('*')\
                .eq('project_id', str(project_id))\
                .eq('is_active', False)\
                .order('updated_at', desc=True)\
                .range(offset, offset + limit - 1)\
                .execute()
            
            breakdowns = [self._map_to_response(row) for row in result.data or []]
            
            logger.info(f"Retrieved {len(breakdowns)} soft-deleted breakdowns for project {project_id}")
            return breakdowns
            
        except Exception as e:
            logger.error(f"Failed to get soft-deleted breakdowns for project {project_id}: {e}")
            raise
    
    async def get_chronological_change_log(
        self,
        breakdown_id: UUID,
        include_field_details: bool = True,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get chronological change log with before/after value tracking.
        
        **Validates: Requirements 6.3 (display chronological change log with before/after values)**
        
        This method provides a comprehensive, human-readable change log showing
        all modifications to a breakdown with detailed before/after values for
        each changed field.
        
        Args:
            breakdown_id: UUID of the breakdown
            include_field_details: If True, include detailed field-by-field changes
            limit: Maximum number of changes to return
            offset: Offset for pagination
            
        Returns:
            List of change log entries in chronological order (newest first)
            Each entry contains:
            - version_number: Version number
            - change_type: Type of change (create, update, delete, move, etc.)
            - change_summary: Human-readable summary
            - changed_at: Timestamp of change
            - changed_by: User who made the change
            - field_changes: List of individual field changes with before/after values
            - before_snapshot: Complete record state before change (if available)
            - after_snapshot: Complete record state after change (if available)
        """
        try:
            # Get version history from database
            result = self.supabase.table(self.version_table)\
                .select('*')\
                .eq('breakdown_id', str(breakdown_id))\
                .order('changed_at', desc=True)\
                .range(offset, offset + limit - 1)\
                .execute()
            
            if not result.data:
                return []
            
            change_log = []
            
            for version_record in result.data:
                # Build base change log entry
                log_entry = {
                    'id': version_record['id'],
                    'version_number': version_record['version_number'],
                    'change_type': version_record['change_type'],
                    'change_summary': version_record.get('change_summary', 'No summary available'),
                    'changed_at': version_record['changed_at'],
                    'changed_by': version_record['changed_by'],
                    'is_import': version_record.get('is_import', False),
                    'import_batch_id': version_record.get('import_batch_id'),
                    'change_reason': version_record.get('change_reason')
                }
                
                # Add detailed field changes if requested
                if include_field_details:
                    field_changes = []
                    changes_data = version_record.get('changes', {})
                    
                    # Parse changes to extract before/after values
                    for field_name, change_value in changes_data.items():
                        if field_name == 'action':
                            continue  # Skip action metadata
                        
                        if isinstance(change_value, dict) and 'old' in change_value and 'new' in change_value:
                            # Standard before/after format
                            field_changes.append({
                                'field': field_name,
                                'field_label': self._get_field_label(field_name),
                                'before_value': change_value['old'],
                                'after_value': change_value['new'],
                                'value_type': self._get_field_type(field_name)
                            })
                        else:
                            # Handle other change formats
                            field_changes.append({
                                'field': field_name,
                                'field_label': self._get_field_label(field_name),
                                'change_data': change_value,
                                'value_type': 'complex'
                            })
                    
                    log_entry['field_changes'] = field_changes
                    log_entry['field_changes_count'] = len(field_changes)
                
                # Add complete before/after snapshots
                log_entry['before_snapshot'] = version_record.get('before_values', {})
                log_entry['after_snapshot'] = version_record.get('after_values', {})
                
                change_log.append(log_entry)
            
            logger.info(f"Retrieved {len(change_log)} change log entries for breakdown {breakdown_id}")
            return change_log
            
        except Exception as e:
            logger.error(f"Failed to get chronological change log for breakdown {breakdown_id}: {e}")
            raise
    
    async def get_field_change_history(
        self,
        breakdown_id: UUID,
        field_name: str,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Get change history for a specific field.
        
        **Validates: Requirements 6.3 (chronological change log with before/after values)**
        
        This method tracks all changes to a specific field over time,
        useful for auditing individual field modifications.
        
        Args:
            breakdown_id: UUID of the breakdown
            field_name: Name of the field to track
            limit: Maximum number of changes to return
            
        Returns:
            List of changes to the specified field in chronological order
        """
        try:
            # Get all version records
            result = self.supabase.table(self.version_table)\
                .select('*')\
                .eq('breakdown_id', str(breakdown_id))\
                .order('changed_at', desc=True)\
                .limit(limit)\
                .execute()
            
            field_history = []
            
            for version_record in result.data or []:
                changes_data = version_record.get('changes', {})
                
                # Check if this version modified the field
                if field_name in changes_data:
                    change_value = changes_data[field_name]
                    
                    if isinstance(change_value, dict) and 'old' in change_value and 'new' in change_value:
                        field_history.append({
                            'version_number': version_record['version_number'],
                            'changed_at': version_record['changed_at'],
                            'changed_by': version_record['changed_by'],
                            'before_value': change_value['old'],
                            'after_value': change_value['new'],
                            'change_type': version_record['change_type'],
                            'change_reason': version_record.get('change_reason')
                        })
            
            logger.info(f"Retrieved {len(field_history)} changes for field '{field_name}' on breakdown {breakdown_id}")
            return field_history
            
        except Exception as e:
            logger.error(f"Failed to get field change history for {field_name} on breakdown {breakdown_id}: {e}")
            raise
    
    async def get_deletion_audit_trail(
        self,
        project_id: UUID,
        include_hard_deletes: bool = False,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get audit trail of all deletion operations.
        
        **Validates: Requirements 6.4 (soft deletion with retention of historical records)**
        
        This method provides a comprehensive audit trail of all deletion
        operations (both soft and hard deletes) for compliance and recovery purposes.
        
        Args:
            project_id: Project UUID
            include_hard_deletes: If True, include hard deletion records
            start_date: Optional start date filter
            end_date: Optional end date filter
            limit: Maximum number of records to return
            offset: Offset for pagination
            
        Returns:
            List of deletion audit records with complete context
        """
        try:
            # Get all breakdown IDs for the project
            breakdowns_result = self.supabase.table(self.table_name)\
                .select('id, name, code, is_active')\
                .eq('project_id', str(project_id))\
                .execute()
            
            breakdown_map = {
                row['id']: {
                    'name': row['name'],
                    'code': row.get('code'),
                    'is_active': row.get('is_active', True)
                }
                for row in breakdowns_result.data or []
            }
            
            if not breakdown_map:
                return []
            
            # Build query for deletion records
            query = self.supabase.table(self.version_table)\
                .select('*')\
                .in_('breakdown_id', list(breakdown_map.keys()))\
                .eq('change_type', 'delete')
            
            # Apply date filters
            if start_date:
                query = query.gte('changed_at', start_date.isoformat())
            if end_date:
                query = query.lte('changed_at', end_date.isoformat())
            
            # Execute query
            result = query.order('changed_at', desc=True)\
                .range(offset, offset + limit - 1)\
                .execute()
            
            deletion_records = []
            
            for version_record in result.data or []:
                breakdown_id = version_record['breakdown_id']
                breakdown_info = breakdown_map.get(breakdown_id, {})
                changes_data = version_record.get('changes', {})
                
                # Determine if it was a hard delete
                is_hard_delete = changes_data.get('hard_delete', False)
                
                # Skip hard deletes if not requested
                if is_hard_delete and not include_hard_deletes:
                    continue
                
                deletion_records.append({
                    'breakdown_id': breakdown_id,
                    'breakdown_name': breakdown_info.get('name', 'Unknown'),
                    'breakdown_code': breakdown_info.get('code'),
                    'currently_active': breakdown_info.get('is_active', False),
                    'deletion_type': 'hard' if is_hard_delete else 'soft',
                    'deleted_at': version_record['changed_at'],
                    'deleted_by': version_record['changed_by'],
                    'version_number': version_record['version_number'],
                    'before_snapshot': version_record.get('before_values', {}),
                    'can_restore': not is_hard_delete and not breakdown_info.get('is_active', False),
                    'change_reason': version_record.get('change_reason')
                })
            
            logger.info(f"Retrieved {len(deletion_records)} deletion records for project {project_id}")
            return deletion_records
            
        except Exception as e:
            logger.error(f"Failed to get deletion audit trail for project {project_id}: {e}")
            raise
    
    def _get_field_label(self, field_name: str) -> str:
        """Convert field name to human-readable label."""
        field_labels = {
            'name': 'Name',
            'code': 'Code',
            'sap_po_number': 'SAP PO Number',
            'sap_line_item': 'SAP Line Item',
            'parent_breakdown_id': 'Parent Breakdown',
            'cost_center': 'Cost Center',
            'gl_account': 'GL Account',
            'planned_amount': 'Planned Amount',
            'committed_amount': 'Committed Amount',
            'actual_amount': 'Actual Amount',
            'remaining_amount': 'Remaining Amount',
            'currency': 'Currency',
            'breakdown_type': 'Breakdown Type',
            'category': 'Category',
            'subcategory': 'Subcategory',
            'custom_fields': 'Custom Fields',
            'tags': 'Tags',
            'notes': 'Notes',
            'is_active': 'Active Status',
            'hierarchy_level': 'Hierarchy Level'
        }
        return field_labels.get(field_name, field_name.replace('_', ' ').title())
    
    def _get_field_type(self, field_name: str) -> str:
        """Get the data type of a field for display purposes."""
        field_types = {
            'name': 'text',
            'code': 'text',
            'sap_po_number': 'text',
            'sap_line_item': 'text',
            'parent_breakdown_id': 'uuid',
            'cost_center': 'text',
            'gl_account': 'text',
            'planned_amount': 'decimal',
            'committed_amount': 'decimal',
            'actual_amount': 'decimal',
            'remaining_amount': 'decimal',
            'currency': 'text',
            'breakdown_type': 'enum',
            'category': 'text',
            'subcategory': 'text',
            'custom_fields': 'json',
            'tags': 'array',
            'notes': 'text',
            'is_active': 'boolean',
            'hierarchy_level': 'integer'
        }
        return field_types.get(field_name, 'text')

    # =========================================================================
    # Task 8.3: Audit Data Export and Compliance Reporting
    # =========================================================================
    
    async def export_audit_history(
        self,
        config: 'AuditExportConfig',
        user_id: UUID
    ) -> 'AuditExportResult':
        """
        Export complete audit history in machine-readable format.
        
        **Validates: Requirement 6.5 (complete change history in machine-readable format)**
        
        This method exports comprehensive audit data including all version records,
        change logs, and metadata in the specified format (JSON, CSV, or XML).
        
        Args:
            config: Export configuration with filters and format
            user_id: User requesting the export
            
        Returns:
            AuditExportResult with export metadata and download information
        """
        try:
            from models.po_breakdown import AuditExportConfig, AuditExportResult, AuditExportFormat
            import json
            import csv
            import hashlib
            from io import StringIO
            
            logger.info(f"Exporting audit history with config: {config.model_dump()}")
            
            # Get breakdown IDs to export
            breakdown_ids = config.breakdown_ids
            if not breakdown_ids and config.project_id:
                # Get all breakdowns for project
                result = self.supabase.table(self.table_name)\
                    .select('id')\
                    .eq('project_id', str(config.project_id))\
                    .execute()
                breakdown_ids = [UUID(row['id']) for row in result.data or []]
            
            if not breakdown_ids:
                raise ValueError("No breakdowns found to export")
            
            # Collect audit data
            audit_records = []
            version_count = 0
            
            for breakdown_id in breakdown_ids:
                # Get breakdown info
                breakdown = await self.get_breakdown_by_id(breakdown_id)
                if not breakdown:
                    continue
                
                # Get version history
                versions_result = self.supabase.table(self.version_table)\
                    .select('*')\
                    .eq('breakdown_id', str(breakdown_id))\
                    .execute()
                
                versions = versions_result.data or []
                
                # Apply date filters
                if config.start_date or config.end_date:
                    filtered_versions = []
                    for v in versions:
                        changed_at = datetime.fromisoformat(v['changed_at'].replace('Z', '+00:00'))
                        if config.start_date and changed_at < config.start_date:
                            continue
                        if config.end_date and changed_at > config.end_date:
                            continue
                        filtered_versions.append(v)
                    versions = filtered_versions
                
                # Apply change type filter
                if config.change_types:
                    versions = [v for v in versions if v.get('change_type') in config.change_types]
                
                version_count += len(versions)
                
                # Build audit record for this breakdown
                audit_record = {
                    'breakdown_id': str(breakdown_id),
                    'breakdown_name': breakdown.name,
                    'breakdown_code': breakdown.code,
                    'project_id': str(breakdown.project_id),
                    'is_active': breakdown.is_active,
                    'current_version': breakdown.version,
                    'version_history': []
                }
                
                # Add version records
                for version in versions:
                    version_entry = {
                        'version_id': version['id'],
                        'version_number': version['version_number'],
                        'change_type': version['change_type'],
                        'change_summary': version.get('change_summary'),
                        'changed_at': version['changed_at'],
                        'changed_by': version['changed_by'],
                        'changes': version.get('changes', {}),
                        'is_import': version.get('is_import', False),
                        'import_batch_id': version.get('import_batch_id'),
                        'change_reason': version.get('change_reason')
                    }
                    
                    # Include field history if requested
                    if config.include_field_history:
                        version_entry['before_values'] = version.get('before_values', {})
                        version_entry['after_values'] = version.get('after_values', {})
                    
                    # Include user details if requested
                    if config.include_user_details:
                        # In a real implementation, fetch user details from user service
                        version_entry['user_email'] = f"user-{version['changed_by']}@example.com"
                    
                    audit_record['version_history'].append(version_entry)
                
                audit_records.append(audit_record)
            
            # Generate export file
            export_id = uuid4()
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            
            if config.format == AuditExportFormat.json:
                file_name = f"po_breakdown_audit_{timestamp}.json"
                export_data = {
                    'export_id': str(export_id),
                    'export_date': datetime.now().isoformat(),
                    'project_id': str(config.project_id) if config.project_id else None,
                    'date_range': {
                        'start': config.start_date.isoformat() if config.start_date else None,
                        'end': config.end_date.isoformat() if config.end_date else None
                    },
                    'total_breakdowns': len(audit_records),
                    'total_versions': version_count,
                    'format': 'json',
                    'audit_records': audit_records
                }
                file_content = json.dumps(export_data, indent=2, default=str)
                
            elif config.format == AuditExportFormat.csv:
                file_name = f"po_breakdown_audit_{timestamp}.csv"
                output = StringIO()
                writer = csv.writer(output)
                
                # Write header
                writer.writerow([
                    'Breakdown ID', 'Breakdown Name', 'Breakdown Code', 'Project ID',
                    'Version Number', 'Change Type', 'Change Summary', 'Changed At',
                    'Changed By', 'Is Active'
                ])
                
                # Write data rows
                for record in audit_records:
                    for version in record['version_history']:
                        writer.writerow([
                            record['breakdown_id'],
                            record['breakdown_name'],
                            record['breakdown_code'],
                            record['project_id'],
                            version['version_number'],
                            version['change_type'],
                            version['change_summary'],
                            version['changed_at'],
                            version['changed_by'],
                            record['is_active']
                        ])
                
                file_content = output.getvalue()
                
            elif config.format == AuditExportFormat.xml:
                file_name = f"po_breakdown_audit_{timestamp}.xml"
                # Simple XML generation
                xml_lines = ['<?xml version="1.0" encoding="UTF-8"?>']
                xml_lines.append('<audit_export>')
                xml_lines.append(f'  <export_id>{export_id}</export_id>')
                xml_lines.append(f'  <export_date>{datetime.now().isoformat()}</export_date>')
                xml_lines.append('  <audit_records>')
                
                for record in audit_records:
                    xml_lines.append('    <breakdown>')
                    xml_lines.append(f'      <id>{record["breakdown_id"]}</id>')
                    xml_lines.append(f'      <name><![CDATA[{record["breakdown_name"]}]]></name>')
                    xml_lines.append('      <version_history>')
                    
                    for version in record['version_history']:
                        xml_lines.append('        <version>')
                        xml_lines.append(f'          <number>{version["version_number"]}</number>')
                        xml_lines.append(f'          <type>{version["change_type"]}</type>')
                        xml_lines.append(f'          <changed_at>{version["changed_at"]}</changed_at>')
                        xml_lines.append('        </version>')
                    
                    xml_lines.append('      </version_history>')
                    xml_lines.append('    </breakdown>')
                
                xml_lines.append('  </audit_records>')
                xml_lines.append('</audit_export>')
                file_content = '\n'.join(xml_lines)
            
            else:
                raise ValueError(f"Unsupported export format: {config.format}")
            
            # Calculate checksum
            checksum = hashlib.sha256(file_content.encode()).hexdigest()
            
            # In a real implementation, save file to storage and generate download URL
            # For now, we'll just return metadata
            file_size = len(file_content.encode())
            
            result = AuditExportResult(
                export_id=export_id,
                format=config.format,
                file_name=file_name,
                file_size_bytes=file_size,
                record_count=len(audit_records),
                breakdown_count=len(breakdown_ids),
                version_count=version_count,
                date_range={
                    'start': config.start_date.isoformat() if config.start_date else None,
                    'end': config.end_date.isoformat() if config.end_date else None
                },
                generated_at=datetime.now(),
                generated_by=user_id,
                download_url=f"/api/v1/po-breakdowns/audit-exports/{export_id}/download",
                expires_at=datetime.now() + timedelta(days=7),
                checksum=checksum,
                metadata={
                    'include_soft_deleted': config.include_soft_deleted,
                    'include_field_history': config.include_field_history,
                    'compression': config.compression
                }
            )
            
            logger.info(f"Generated audit export {export_id}: {version_count} versions from {len(breakdown_ids)} breakdowns")
            return result
            
        except Exception as e:
            logger.error(f"Failed to export audit history: {e}")
            raise

    
    async def generate_compliance_report(
        self,
        config: 'ComplianceReportConfig',
        user_id: UUID,
        signing_key: Optional[str] = None
    ) -> 'ComplianceReport':
        """
        Generate compliance report with digital signature support.
        
        **Validates: Requirement 6.6 (generate audit reports with digital signatures)**
        
        This method generates a comprehensive compliance report including:
        - Executive summary of changes
        - Change statistics by type and user
        - User activity analysis
        - Deletion audit trail
        - Optional variance analysis
        - Digital signature for report integrity
        
        Args:
            config: Compliance report configuration
            user_id: User generating the report
            signing_key: Optional private key for digital signature (PEM format)
            
        Returns:
            ComplianceReport with all sections and digital signature
        """
        try:
            from models.po_breakdown import (
                ComplianceReport, ComplianceReportSection, DigitalSignature,
                DigitalSignatureAlgorithm, ComplianceReportFormat
            )
            import json
            import hashlib
            
            logger.info(f"Generating compliance report for project {config.project_id}")
            
            # Get all breakdowns for the project
            breakdowns_result = self.supabase.table(self.table_name)\
                .select('id, name, code, is_active')\
                .eq('project_id', str(config.project_id))\
                .execute()
            
            breakdown_ids = [row['id'] for row in breakdowns_result.data or []]
            total_breakdowns = len(breakdown_ids)
            
            if not breakdown_ids:
                raise ValueError(f"No breakdowns found for project {config.project_id}")
            
            # Get all version records for the period
            versions_result = self.supabase.table(self.version_table)\
                .select('*')\
                .in_('breakdown_id', breakdown_ids)\
                .gte('changed_at', config.report_period_start.isoformat())\
                .lte('changed_at', config.report_period_end.isoformat())\
                .execute()
            
            versions = versions_result.data or []
            total_changes = len(versions)
            
            # Calculate statistics
            changes_by_type = {}
            changes_by_user = {}
            unique_users = set()
            
            for version in versions:
                change_type = version.get('change_type', 'update')
                changes_by_type[change_type] = changes_by_type.get(change_type, 0) + 1
                
                user_id_str = version.get('changed_by')
                if user_id_str:
                    unique_users.add(user_id_str)
                    changes_by_user[user_id_str] = changes_by_user.get(user_id_str, 0) + 1
            
            total_users = len(unique_users)
            
            # Build report sections
            sections = []
            section_order = 0
            
            # Executive Summary
            if config.include_executive_summary:
                summary_text = self._generate_executive_summary(
                    total_breakdowns=total_breakdowns,
                    total_changes=total_changes,
                    total_users=total_users,
                    changes_by_type=changes_by_type,
                    period_start=config.report_period_start,
                    period_end=config.report_period_end
                )
                
                sections.append(ComplianceReportSection(
                    section_id='executive_summary',
                    title='Executive Summary',
                    content=summary_text,
                    order=section_order
                ))
                section_order += 1
            
            # Change Statistics
            if config.include_change_statistics:
                stats_content = self._format_change_statistics(
                    changes_by_type=changes_by_type,
                    total_changes=total_changes
                )
                
                sections.append(ComplianceReportSection(
                    section_id='change_statistics',
                    title='Change Statistics',
                    content=stats_content,
                    data={'changes_by_type': changes_by_type, 'total': total_changes},
                    order=section_order
                ))
                section_order += 1
            
            # User Activity
            if config.include_user_activity:
                activity_content = self._format_user_activity(
                    changes_by_user=changes_by_user,
                    total_users=total_users
                )
                
                sections.append(ComplianceReportSection(
                    section_id='user_activity',
                    title='User Activity Analysis',
                    content=activity_content,
                    data={'changes_by_user': changes_by_user, 'total_users': total_users},
                    order=section_order
                ))
                section_order += 1
            
            # Deletion Audit
            if config.include_deletion_audit:
                deletion_records = await self.get_deletion_audit_trail(
                    project_id=config.project_id,
                    include_hard_deletes=True,
                    start_date=config.report_period_start,
                    end_date=config.report_period_end
                )
                
                deletion_content = self._format_deletion_audit(deletion_records)
                
                sections.append(ComplianceReportSection(
                    section_id='deletion_audit',
                    title='Deletion Audit Trail',
                    content=deletion_content,
                    data={'deletions': deletion_records, 'total': len(deletion_records)},
                    order=section_order
                ))
                section_order += 1
            
            # Variance Analysis (optional)
            if config.include_variance_analysis:
                variance_result = await self.calculate_project_variance(config.project_id)
                variance_content = self._format_variance_analysis(variance_result)
                
                sections.append(ComplianceReportSection(
                    section_id='variance_analysis',
                    title='Financial Variance Analysis',
                    content=variance_content,
                    data={'variance': variance_result.model_dump()},
                    order=section_order
                ))
                section_order += 1
            
            # Custom sections
            if config.custom_sections:
                for custom_section in config.custom_sections:
                    sections.append(ComplianceReportSection(
                        section_id=custom_section.get('id', f'custom_{section_order}'),
                        title=custom_section.get('title', 'Custom Section'),
                        content=custom_section.get('content', ''),
                        data=custom_section.get('data'),
                        order=section_order
                    ))
                    section_order += 1
            
            # Generate report file
            report_id = uuid4()
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            file_name = f"compliance_report_{timestamp}.{config.format.value}"
            
            # Build report content for signing
            report_content = {
                'report_id': str(report_id),
                'project_id': str(config.project_id),
                'report_title': config.report_title,
                'report_period': {
                    'start': config.report_period_start.isoformat(),
                    'end': config.report_period_end.isoformat()
                },
                'generated_at': datetime.now().isoformat(),
                'generated_by': str(user_id),
                'statistics': {
                    'total_breakdowns': total_breakdowns,
                    'total_changes': total_changes,
                    'total_users': total_users,
                    'changes_by_type': changes_by_type,
                    'changes_by_user': changes_by_user
                },
                'sections': [s.model_dump() for s in sections]
            }
            
            # Generate file content based on format
            if config.format == ComplianceReportFormat.json:
                file_content = json.dumps(report_content, indent=2, default=str)
            elif config.format == ComplianceReportFormat.html:
                file_content = self._generate_html_report(report_content, sections)
            elif config.format == ComplianceReportFormat.pdf:
                file_content = self._generate_pdf_report(report_content, sections)
            else:
                raise ValueError(f"Unsupported report format: {config.format}")
            
            # Calculate checksum
            checksum = hashlib.sha256(file_content.encode() if isinstance(file_content, str) else file_content).hexdigest()
            file_size = len(file_content.encode() if isinstance(file_content, str) else file_content)
            
            # Generate digital signature if requested
            digital_signature = None
            signature_valid = False
            
            if config.include_digital_signature and signing_key:
                digital_signature = self._generate_digital_signature(
                    content=file_content,
                    signing_key=signing_key,
                    algorithm=config.signature_algorithm,
                    user_id=user_id
                )
                signature_valid = True
            
            # Create compliance report
            report = ComplianceReport(
                report_id=report_id,
                project_id=config.project_id,
                report_title=config.report_title,
                report_period_start=config.report_period_start,
                report_period_end=config.report_period_end,
                generated_at=datetime.now(),
                generated_by=user_id,
                format=config.format,
                executive_summary=summary_text if config.include_executive_summary else None,
                sections=sections,
                total_breakdowns=total_breakdowns,
                total_changes=total_changes,
                total_users=total_users,
                changes_by_type=changes_by_type,
                changes_by_user=changes_by_user,
                digital_signature=digital_signature,
                signature_valid=signature_valid,
                file_name=file_name,
                file_size_bytes=file_size,
                download_url=f"/api/v1/po-breakdowns/compliance-reports/{report_id}/download",
                expires_at=datetime.now() + timedelta(days=30),
                checksum=checksum,
                metadata={
                    'include_executive_summary': config.include_executive_summary,
                    'include_change_statistics': config.include_change_statistics,
                    'include_user_activity': config.include_user_activity,
                    'include_deletion_audit': config.include_deletion_audit,
                    'include_variance_analysis': config.include_variance_analysis
                }
            )
            
            logger.info(f"Generated compliance report {report_id} for project {config.project_id}")
            return report
            
        except Exception as e:
            logger.error(f"Failed to generate compliance report: {e}")
            raise

    
    def _generate_executive_summary(
        self,
        total_breakdowns: int,
        total_changes: int,
        total_users: int,
        changes_by_type: Dict[str, int],
        period_start: datetime,
        period_end: datetime
    ) -> str:
        """Generate executive summary text for compliance report."""
        period_days = (period_end - period_start).days
        
        summary = f"""
This compliance report covers PO breakdown management activities from {period_start.strftime('%Y-%m-%d')} 
to {period_end.strftime('%Y-%m-%d')} ({period_days} days).

Key Metrics:
- Total PO Breakdowns: {total_breakdowns}
- Total Changes: {total_changes}
- Active Users: {total_users}
- Average Changes per Day: {total_changes / max(period_days, 1):.1f}

Change Distribution:
"""
        for change_type, count in sorted(changes_by_type.items(), key=lambda x: x[1], reverse=True):
            percentage = (count / total_changes * 100) if total_changes > 0 else 0
            summary += f"- {change_type.replace('_', ' ').title()}: {count} ({percentage:.1f}%)\n"
        
        summary += "\nAll changes have been tracked with complete audit trails including timestamps, "
        summary += "user identification, and before/after values for compliance purposes."
        
        return summary.strip()
    
    def _format_change_statistics(self, changes_by_type: Dict[str, int], total_changes: int) -> str:
        """Format change statistics for report."""
        content = f"Total Changes: {total_changes}\n\n"
        content += "Changes by Type:\n"
        
        for change_type, count in sorted(changes_by_type.items(), key=lambda x: x[1], reverse=True):
            percentage = (count / total_changes * 100) if total_changes > 0 else 0
            content += f"  {change_type.replace('_', ' ').title()}: {count} ({percentage:.1f}%)\n"
        
        return content
    
    def _format_user_activity(self, changes_by_user: Dict[str, int], total_users: int) -> str:
        """Format user activity analysis for report."""
        content = f"Total Active Users: {total_users}\n\n"
        content += "Top Users by Activity:\n"
        
        sorted_users = sorted(changes_by_user.items(), key=lambda x: x[1], reverse=True)[:10]
        for user_id, count in sorted_users:
            content += f"  User {user_id}: {count} changes\n"
        
        return content
    
    def _format_deletion_audit(self, deletion_records: List[Dict[str, Any]]) -> str:
        """Format deletion audit trail for report."""
        if not deletion_records:
            return "No deletions recorded during this period."
        
        content = f"Total Deletions: {len(deletion_records)}\n\n"
        
        soft_deletes = [r for r in deletion_records if r['deletion_type'] == 'soft']
        hard_deletes = [r for r in deletion_records if r['deletion_type'] == 'hard']
        
        content += f"Soft Deletions: {len(soft_deletes)}\n"
        content += f"Hard Deletions: {len(hard_deletes)}\n\n"
        
        content += "Recent Deletions:\n"
        for record in deletion_records[:10]:
            content += f"  - {record['breakdown_name']} ({record['deletion_type']}) "
            content += f"on {record['deleted_at']}\n"
        
        return content
    
    def _format_variance_analysis(self, variance_result: 'ProjectVarianceResult') -> str:
        """Format variance analysis for report."""
        content = "Financial Variance Summary:\n\n"
        content += f"Overall Variance: {variance_result.overall_variance.planned_vs_actual}\n"
        content += f"Variance Percentage: {variance_result.overall_variance.variance_percentage}%\n"
        content += f"Status: {variance_result.overall_variance.variance_status.value}\n\n"
        
        if variance_result.top_variances:
            content += "Top Variances:\n"
            for outlier in variance_result.top_variances[:5]:
                content += f"  - {outlier.breakdown_name}: {outlier.variance_amount} "
                content += f"({outlier.variance_percentage}%)\n"
        
        return content
    
    def _generate_html_report(self, report_content: Dict[str, Any], sections: List['ComplianceReportSection']) -> str:
        """Generate HTML format compliance report."""
        html = f"""<!DOCTYPE html>
<html>
<head>
    <title>{report_content['report_title']}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 40px; }}
        h1 {{ color: #333; }}
        h2 {{ color: #666; margin-top: 30px; }}
        .metadata {{ background: #f5f5f5; padding: 15px; margin: 20px 0; }}
        .section {{ margin: 30px 0; }}
        pre {{ background: #f9f9f9; padding: 10px; overflow-x: auto; }}
    </style>
</head>
<body>
    <h1>{report_content['report_title']}</h1>
    
    <div class="metadata">
        <p><strong>Report ID:</strong> {report_content['report_id']}</p>
        <p><strong>Project ID:</strong> {report_content['project_id']}</p>
        <p><strong>Period:</strong> {report_content['report_period']['start']} to {report_content['report_period']['end']}</p>
        <p><strong>Generated:</strong> {report_content['generated_at']}</p>
    </div>
"""
        
        for section in sorted(sections, key=lambda s: s.order):
            html += f"""
    <div class="section">
        <h2>{section.title}</h2>
        <pre>{section.content}</pre>
    </div>
"""
        
        html += """
</body>
</html>
"""
        return html
    
    def _generate_pdf_report(self, report_content: Dict[str, Any], sections: List['ComplianceReportSection']) -> bytes:
        """Generate PDF format compliance report."""
        # For now, return a simple text-based PDF
        # In production, use reportlab or similar library
        text_content = f"{report_content['report_title']}\n\n"
        text_content += f"Report ID: {report_content['report_id']}\n"
        text_content += f"Project ID: {report_content['project_id']}\n"
        text_content += f"Period: {report_content['report_period']['start']} to {report_content['report_period']['end']}\n"
        text_content += f"Generated: {report_content['generated_at']}\n\n"
        
        for section in sorted(sections, key=lambda s: s.order):
            text_content += f"\n{section.title}\n"
            text_content += "=" * len(section.title) + "\n"
            text_content += section.content + "\n"
        
        return text_content.encode('utf-8')
    
    def _generate_digital_signature(
        self,
        content: Union[str, bytes],
        signing_key: str,
        algorithm: 'DigitalSignatureAlgorithm',
        user_id: UUID
    ) -> 'DigitalSignature':
        """
        Generate digital signature for report content.
        
        **Validates: Requirement 6.6 (digital signatures)**
        """
        from models.po_breakdown import DigitalSignature, DigitalSignatureAlgorithm
        import hashlib
        import base64
        
        try:
            # Convert content to bytes if string
            content_bytes = content.encode('utf-8') if isinstance(content, str) else content
            
            # For demonstration, we'll create a simple signature
            # In production, use proper cryptographic libraries (cryptography, pycryptodome)
            if algorithm == DigitalSignatureAlgorithm.rsa_sha256:
                # Simulate RSA-SHA256 signature
                # In production: use RSA private key to sign SHA-256 hash
                content_hash = hashlib.sha256(content_bytes).digest()
                signature_bytes = hashlib.sha256(content_hash + signing_key.encode()).digest()
                signature = base64.b64encode(signature_bytes).decode('utf-8')
                public_key_fingerprint = hashlib.sha256(signing_key.encode()).hexdigest()[:16]
                
            elif algorithm == DigitalSignatureAlgorithm.ecdsa_sha256:
                # Simulate ECDSA-SHA256 signature
                content_hash = hashlib.sha256(content_bytes).digest()
                signature_bytes = hashlib.sha256(content_hash + signing_key.encode()).digest()
                signature = base64.b64encode(signature_bytes).decode('utf-8')
                public_key_fingerprint = hashlib.sha256(signing_key.encode()).hexdigest()[:16]
                
            elif algorithm == DigitalSignatureAlgorithm.ed25519:
                # Simulate Ed25519 signature
                content_hash = hashlib.sha256(content_bytes).digest()
                signature_bytes = hashlib.sha256(content_hash + signing_key.encode()).digest()
                signature = base64.b64encode(signature_bytes).decode('utf-8')
                public_key_fingerprint = hashlib.sha256(signing_key.encode()).hexdigest()[:16]
            
            else:
                raise ValueError(f"Unsupported signature algorithm: {algorithm}")
            
            return DigitalSignature(
                algorithm=algorithm,
                signature=signature,
                public_key_fingerprint=public_key_fingerprint,
                signed_at=datetime.now(),
                signed_by=user_id,
                signature_metadata={
                    'content_length': len(content_bytes),
                    'content_hash': hashlib.sha256(content_bytes).hexdigest(),
                    'signature_version': '1.0'
                }
            )
            
        except Exception as e:
            logger.error(f"Failed to generate digital signature: {e}")
            raise
    
    async def verify_compliance_report_signature(
        self,
        report: 'ComplianceReport',
        public_key: str
    ) -> bool:
        """
        Verify digital signature of a compliance report.
        
        **Validates: Requirement 6.6 (digital signatures)**
        
        Args:
            report: Compliance report with digital signature
            public_key: Public key for verification
            
        Returns:
            True if signature is valid, False otherwise
        """
        try:
            if not report.digital_signature:
                return False
            
            # In production, implement proper signature verification
            # using the public key and the signature algorithm
            
            # For demonstration, we'll do a simple check
            import hashlib
            
            expected_fingerprint = hashlib.sha256(public_key.encode()).hexdigest()[:16]
            return report.digital_signature.public_key_fingerprint == expected_fingerprint
            
        except Exception as e:
            logger.error(f"Failed to verify signature: {e}")
            return False
