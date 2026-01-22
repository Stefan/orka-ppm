"""
PO Breakdown Scheduled Export Service

This service handles scheduled/recurring exports with email delivery and customization options.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from supabase import Client

from services.po_breakdown_export_service import POBreakdownExportService


class ScheduledExportConfig:
    """Configuration for scheduled exports"""
    
    def __init__(
        self,
        schedule_id: UUID,
        project_id: UUID,
        export_format: str,
        frequency: str,
        email_recipients: List[str],
        filters: Optional[Dict[str, Any]] = None,
        custom_fields: Optional[List[str]] = None,
        include_summary: bool = True,
        enabled: bool = True
    ):
        self.schedule_id = schedule_id
        self.project_id = project_id
        self.export_format = export_format
        self.frequency = frequency
        self.email_recipients = email_recipients
        self.filters = filters or {}
        self.custom_fields = custom_fields
        self.include_summary = include_summary
        self.enabled = enabled


class POBreakdownScheduledExportService:
    """Service for managing scheduled PO breakdown exports"""
    
    def __init__(self, supabase: Client):
        self.supabase = supabase
        self.export_service = POBreakdownExportService(supabase)
    
    async def create_scheduled_export(
        self,
        project_id: UUID,
        export_format: str,
        frequency: str,
        email_recipients: List[str],
        filters: Optional[Dict[str, Any]] = None,
        custom_fields: Optional[List[str]] = None,
        include_summary: bool = True,
        user_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Create a new scheduled export configuration
        
        Args:
            project_id: Project UUID
            export_format: Format (csv, excel, json)
            frequency: Frequency (daily, weekly, monthly)
            email_recipients: List of email addresses
            filters: Optional filters to apply
            custom_fields: Custom fields to include
            include_summary: Whether to include summary
            user_id: User creating the schedule
            
        Returns:
            Created schedule configuration
        """
        schedule_id = uuid4()
        
        schedule_data = {
            'id': str(schedule_id),
            'project_id': str(project_id),
            'export_format': export_format,
            'frequency': frequency,
            'email_recipients': email_recipients,
            'filters': filters or {},
            'custom_fields': custom_fields or [],
            'include_summary': include_summary,
            'enabled': True,
            'last_run_at': None,
            'next_run_at': self._calculate_next_run(frequency).isoformat(),
            'created_by': str(user_id) if user_id else None,
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        
        result = self.supabase.table('po_breakdown_export_schedules').insert(schedule_data).execute()
        
        if not result.data:
            raise Exception("Failed to create scheduled export")
        
        return result.data[0]
    
    async def update_scheduled_export(
        self,
        schedule_id: UUID,
        updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update a scheduled export configuration"""
        
        updates['updated_at'] = datetime.now().isoformat()
        
        # Recalculate next run if frequency changed
        if 'frequency' in updates:
            updates['next_run_at'] = self._calculate_next_run(updates['frequency']).isoformat()
        
        result = self.supabase.table('po_breakdown_export_schedules').update(updates).eq('id', str(schedule_id)).execute()
        
        if not result.data:
            raise Exception("Failed to update scheduled export")
        
        return result.data[0]
    
    async def delete_scheduled_export(self, schedule_id: UUID) -> bool:
        """Delete a scheduled export configuration"""
        
        result = self.supabase.table('po_breakdown_export_schedules').delete().eq('id', str(schedule_id)).execute()
        
        return len(result.data) > 0
    
    async def get_scheduled_export(self, schedule_id: UUID) -> Dict[str, Any]:
        """Get a specific scheduled export configuration"""
        
        result = self.supabase.table('po_breakdown_export_schedules').select('*').eq('id', str(schedule_id)).execute()
        
        if not result.data:
            raise Exception("Scheduled export not found")
        
        return result.data[0]
    
    async def list_scheduled_exports(
        self,
        project_id: Optional[UUID] = None,
        enabled_only: bool = False
    ) -> List[Dict[str, Any]]:
        """List scheduled export configurations"""
        
        query = self.supabase.table('po_breakdown_export_schedules').select('*')
        
        if project_id:
            query = query.eq('project_id', str(project_id))
        
        if enabled_only:
            query = query.eq('enabled', True)
        
        result = query.order('created_at', desc=True).execute()
        
        return result.data or []
    
    async def execute_scheduled_export(self, schedule_id: UUID) -> Dict[str, Any]:
        """
        Execute a scheduled export immediately
        
        Args:
            schedule_id: Schedule UUID
            
        Returns:
            Execution result with status and details
        """
        # Get schedule configuration
        schedule = await self.get_scheduled_export(schedule_id)
        
        if not schedule['enabled']:
            return {
                'success': False,
                'error': 'Schedule is disabled'
            }
        
        try:
            # Generate export
            project_id = UUID(schedule['project_id'])
            export_format = schedule['export_format']
            filters = schedule.get('filters', {})
            custom_fields = schedule.get('custom_fields')
            include_summary = schedule.get('include_summary', True)
            
            export_data = None
            filename = f"po_breakdown_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            
            if export_format == 'csv':
                export_data = await self.export_service.export_to_csv(
                    project_id=project_id,
                    filters=filters,
                    custom_fields=custom_fields
                )
                filename += '.csv'
                content_type = 'text/csv'
            
            elif export_format == 'excel':
                export_data = await self.export_service.export_to_excel(
                    project_id=project_id,
                    filters=filters,
                    include_summary=include_summary,
                    custom_fields=custom_fields
                )
                filename += '.xlsx'
                content_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            
            elif export_format == 'json':
                export_data = await self.export_service.export_to_json(
                    project_id=project_id,
                    filters=filters,
                    hierarchical_structure=True
                )
                filename += '.json'
                content_type = 'application/json'
            
            else:
                raise ValueError(f"Unsupported export format: {export_format}")
            
            # Send email with attachment
            email_recipients = schedule['email_recipients']
            await self._send_export_email(
                recipients=email_recipients,
                filename=filename,
                export_data=export_data,
                content_type=content_type,
                project_id=project_id
            )
            
            # Update schedule
            await self._update_schedule_after_run(schedule_id, success=True)
            
            # Log execution
            await self._log_export_execution(
                schedule_id=schedule_id,
                success=True,
                filename=filename,
                recipients=email_recipients
            )
            
            return {
                'success': True,
                'schedule_id': str(schedule_id),
                'filename': filename,
                'recipients': email_recipients,
                'executed_at': datetime.now().isoformat()
            }
        
        except Exception as e:
            # Update schedule with error
            await self._update_schedule_after_run(schedule_id, success=False, error=str(e))
            
            # Log execution failure
            await self._log_export_execution(
                schedule_id=schedule_id,
                success=False,
                error=str(e)
            )
            
            return {
                'success': False,
                'schedule_id': str(schedule_id),
                'error': str(e),
                'executed_at': datetime.now().isoformat()
            }
    
    async def process_due_exports(self) -> List[Dict[str, Any]]:
        """
        Process all scheduled exports that are due to run
        
        Returns:
            List of execution results
        """
        # Get all enabled schedules that are due
        now = datetime.now().isoformat()
        
        result = self.supabase.table('po_breakdown_export_schedules').select('*').eq('enabled', True).lte('next_run_at', now).execute()
        
        due_schedules = result.data or []
        
        # Execute each schedule
        results = []
        for schedule in due_schedules:
            schedule_id = UUID(schedule['id'])
            execution_result = await self.execute_scheduled_export(schedule_id)
            results.append(execution_result)
        
        return results
    
    def _calculate_next_run(self, frequency: str, from_date: Optional[datetime] = None) -> datetime:
        """Calculate next run time based on frequency"""
        
        base_date = from_date or datetime.now()
        
        if frequency == 'daily':
            return base_date + timedelta(days=1)
        elif frequency == 'weekly':
            return base_date + timedelta(weeks=1)
        elif frequency == 'monthly':
            # Approximate month as 30 days
            return base_date + timedelta(days=30)
        elif frequency == 'hourly':
            return base_date + timedelta(hours=1)
        else:
            raise ValueError(f"Unsupported frequency: {frequency}")
    
    async def _update_schedule_after_run(
        self,
        schedule_id: UUID,
        success: bool,
        error: Optional[str] = None
    ):
        """Update schedule after execution"""
        
        # Get current schedule
        schedule = await self.get_scheduled_export(schedule_id)
        
        updates = {
            'last_run_at': datetime.now().isoformat(),
            'next_run_at': self._calculate_next_run(schedule['frequency']).isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        
        if not success and error:
            updates['last_error'] = error
        
        await self.update_scheduled_export(schedule_id, updates)
    
    async def _send_export_email(
        self,
        recipients: List[str],
        filename: str,
        export_data: Any,
        content_type: str,
        project_id: UUID
    ):
        """
        Send export via email
        
        Note: This is a placeholder implementation. In production, this would integrate
        with an email service like SendGrid, AWS SES, or similar.
        """
        # TODO: Implement actual email sending
        # For now, just log the action
        print(f"Would send email to {recipients} with attachment {filename}")
        
        # In production, you would:
        # 1. Format email with project details
        # 2. Attach the export file
        # 3. Send via email service
        # 4. Handle delivery failures
    
    async def _log_export_execution(
        self,
        schedule_id: UUID,
        success: bool,
        filename: Optional[str] = None,
        recipients: Optional[List[str]] = None,
        error: Optional[str] = None
    ):
        """Log export execution for audit trail"""
        
        log_data = {
            'id': str(uuid4()),
            'schedule_id': str(schedule_id),
            'executed_at': datetime.now().isoformat(),
            'success': success,
            'filename': filename,
            'recipients': recipients or [],
            'error': error
        }
        
        self.supabase.table('po_breakdown_export_logs').insert(log_data).execute()
    
    async def get_export_history(
        self,
        schedule_id: Optional[UUID] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get export execution history"""
        
        query = self.supabase.table('po_breakdown_export_logs').select('*')
        
        if schedule_id:
            query = query.eq('schedule_id', str(schedule_id))
        
        result = query.order('executed_at', desc=True).limit(limit).execute()
        
        return result.data or []


class ExportCustomizationService:
    """Service for managing export customization options"""
    
    def __init__(self, supabase: Client):
        self.supabase = supabase
    
    async def save_export_template(
        self,
        name: str,
        project_id: UUID,
        export_format: str,
        filters: Dict[str, Any],
        custom_fields: Optional[List[str]] = None,
        column_order: Optional[List[str]] = None,
        user_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """Save an export template for reuse"""
        
        template_id = uuid4()
        
        template_data = {
            'id': str(template_id),
            'name': name,
            'project_id': str(project_id),
            'export_format': export_format,
            'filters': filters,
            'custom_fields': custom_fields or [],
            'column_order': column_order or [],
            'created_by': str(user_id) if user_id else None,
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        
        result = self.supabase.table('po_breakdown_export_templates').insert(template_data).execute()
        
        if not result.data:
            raise Exception("Failed to save export template")
        
        return result.data[0]
    
    async def get_export_template(self, template_id: UUID) -> Dict[str, Any]:
        """Get a specific export template"""
        
        result = self.supabase.table('po_breakdown_export_templates').select('*').eq('id', str(template_id)).execute()
        
        if not result.data:
            raise Exception("Export template not found")
        
        return result.data[0]
    
    async def list_export_templates(
        self,
        project_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None
    ) -> List[Dict[str, Any]]:
        """List available export templates"""
        
        query = self.supabase.table('po_breakdown_export_templates').select('*')
        
        if project_id:
            query = query.eq('project_id', str(project_id))
        
        if user_id:
            query = query.eq('created_by', str(user_id))
        
        result = query.order('created_at', desc=True).execute()
        
        return result.data or []
    
    async def delete_export_template(self, template_id: UUID) -> bool:
        """Delete an export template"""
        
        result = self.supabase.table('po_breakdown_export_templates').delete().eq('id', str(template_id)).execute()
        
        return len(result.data) > 0
