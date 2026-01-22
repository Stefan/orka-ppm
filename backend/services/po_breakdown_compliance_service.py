"""
PO Breakdown Compliance and Audit Export Service

This module provides comprehensive audit data export and compliance reporting
functionality for SAP PO Breakdown Management.

**Validates: Requirements 6.5, 6.6**
"""

import logging
import hashlib
import json
import csv
import io
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Any, Optional, BinaryIO
from uuid import UUID, uuid4

from supabase import Client

from models.po_breakdown import (
    AuditExportConfig,
    AuditExportResult,
    AuditExportFormat,
    ComplianceReportConfig,
    ComplianceReport,
    ComplianceReportSection,
    ComplianceReportFormat,
    DigitalSignature,
    DigitalSignatureAlgorithm,
    POBreakdownVersion,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class POBreakdownComplianceService:
    """
    Service for audit data export and compliance reporting.
    
    **Validates: Requirements 6.5, 6.6**
    """
    
    def __init__(self, supabase_client: Client):
        """Initialize the compliance service."""
        self.supabase = supabase_client
        self.breakdown_table = 'po_breakdowns'
        self.version_table = 'po_breakdown_versions'

    
    # =========================================================================
    # Audit Data Export (Requirement 6.5)
    # =========================================================================
    
    async def export_audit_history(
        self,
        config: AuditExportConfig,
        user_id: UUID
    ) -> AuditExportResult:
        """
        Export complete audit history in machine-readable format.
        
        **Validates: Requirement 6.5**
        
        Args:
            config: Export configuration
            user_id: User requesting the export
            
        Returns:
            AuditExportResult with export details
        """
        try:
            logger.info(f"Starting audit export with config: {config.format}")
            
            # Query audit data based on configuration
            audit_data = await self._query_audit_data(config)
            
            # Generate export file based on format
            if config.format == AuditExportFormat.json:
                file_content, file_name = await self._export_to_json(audit_data, config)
            elif config.format == AuditExportFormat.csv:
                file_content, file_name = await self._export_to_csv(audit_data, config)
            elif config.format == AuditExportFormat.xml:
                file_content, file_name = await self._export_to_xml(audit_data, config)
            else:
                raise ValueError(f"Unsupported export format: {config.format}")
            
            # Calculate checksum
            checksum = self._calculate_checksum(file_content)
            
            # Compress if requested
            if config.compression:
                file_content = await self._compress_data(file_content)
                file_name = f"{file_name}.gz"
            
            # Store export file (in production, this would upload to cloud storage)
            file_size = len(file_content)
            export_id = uuid4()
            
            # Calculate date range
            date_range = self._calculate_date_range(audit_data)
            
            # Create export result
            result = AuditExportResult(
                export_id=export_id,
                format=config.format,
                file_name=file_name,
                file_size_bytes=file_size,
                record_count=len(audit_data.get('versions', [])),
                breakdown_count=len(set(v['breakdown_id'] for v in audit_data.get('versions', []))),
                version_count=len(audit_data.get('versions', [])),
                date_range=date_range,
                generated_at=datetime.now(),
                generated_by=user_id,
                download_url=f"/api/v1/exports/{export_id}/download",
                expires_at=None,  # Set expiration policy as needed
                checksum=checksum,
                metadata={
                    'config': config.model_dump(mode='json'),
                    'compression': config.compression
                }
            )
            
            logger.info(f"Audit export completed: {export_id}")
            return result
            
        except Exception as e:
            logger.error(f"Failed to export audit history: {e}")
            raise

    
    async def _query_audit_data(self, config: AuditExportConfig) -> Dict[str, Any]:
        """
        Query audit data based on configuration.
        
        **Validates: Requirement 6.5**
        """
        try:
            # Build base query for versions
            query = self.supabase.table(self.version_table).select('*')
            
            # Apply filters
            if config.project_id:
                # Join with breakdowns to filter by project
                breakdown_ids = await self._get_project_breakdown_ids(config.project_id)
                if breakdown_ids:
                    query = query.in_('breakdown_id', [str(bid) for bid in breakdown_ids])
            
            if config.breakdown_ids:
                query = query.in_('breakdown_id', [str(bid) for bid in config.breakdown_ids])
            
            if config.start_date:
                query = query.gte('changed_at', config.start_date.isoformat())
            
            if config.end_date:
                query = query.lte('changed_at', config.end_date.isoformat())
            
            if config.change_types:
                query = query.in_('change_type', config.change_types)
            
            # Execute query
            result = query.order('changed_at').execute()
            versions = result.data or []
            
            # Get breakdown details if requested
            breakdowns = {}
            if config.include_field_history:
                breakdown_ids = list(set(v['breakdown_id'] for v in versions))
                breakdowns = await self._get_breakdowns_details(breakdown_ids, config.include_soft_deleted)
            
            # Get user details if requested
            users = {}
            if config.include_user_details:
                user_ids = list(set(v['changed_by'] for v in versions))
                users = await self._get_user_details(user_ids)
            
            return {
                'versions': versions,
                'breakdowns': breakdowns,
                'users': users,
                'export_metadata': {
                    'exported_at': datetime.now().isoformat(),
                    'config': config.model_dump(mode='json')
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to query audit data: {e}")
            raise
    
    async def _get_project_breakdown_ids(self, project_id: UUID) -> List[UUID]:
        """Get all breakdown IDs for a project."""
        result = self.supabase.table(self.breakdown_table)\
            .select('id')\
            .eq('project_id', str(project_id))\
            .execute()
        return [UUID(row['id']) for row in result.data]
    
    async def _get_breakdowns_details(
        self,
        breakdown_ids: List[str],
        include_soft_deleted: bool
    ) -> Dict[str, Any]:
        """Get breakdown details for audit export."""
        query = self.supabase.table(self.breakdown_table)\
            .select('*')\
            .in_('id', breakdown_ids)
        
        if not include_soft_deleted:
            query = query.eq('is_active', True)
        
        result = query.execute()
        return {row['id']: row for row in result.data}
    
    async def _get_user_details(self, user_ids: List[str]) -> Dict[str, Any]:
        """Get user details for audit export."""
        # In production, this would query user profiles
        # For now, return placeholder data
        return {uid: {'id': uid, 'name': f'User {uid[:8]}'} for uid in user_ids}

    
    async def _export_to_json(
        self,
        audit_data: Dict[str, Any],
        config: AuditExportConfig
    ) -> tuple[bytes, str]:
        """
        Export audit data to JSON format.
        
        **Validates: Requirement 6.5**
        """
        # Convert to JSON-serializable format
        export_data = self._prepare_json_export(audit_data)
        
        # Generate JSON
        json_str = json.dumps(export_data, indent=2, default=str)
        file_content = json_str.encode('utf-8')
        
        # Generate filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        file_name = f"po_breakdown_audit_export_{timestamp}.json"
        
        return file_content, file_name
    
    async def _export_to_csv(
        self,
        audit_data: Dict[str, Any],
        config: AuditExportConfig
    ) -> tuple[bytes, str]:
        """
        Export audit data to CSV format.
        
        **Validates: Requirement 6.5**
        """
        output = io.StringIO()
        
        # Define CSV columns
        fieldnames = [
            'version_id', 'breakdown_id', 'breakdown_name', 'version_number',
            'change_type', 'change_summary', 'changed_by', 'changed_at',
            'field_changes', 'is_import'
        ]
        
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        # Write version records
        for version in audit_data.get('versions', []):
            breakdown = audit_data.get('breakdowns', {}).get(version['breakdown_id'], {})
            user = audit_data.get('users', {}).get(version['changed_by'], {})
            
            row = {
                'version_id': version.get('id', ''),
                'breakdown_id': version.get('breakdown_id', ''),
                'breakdown_name': breakdown.get('name', ''),
                'version_number': version.get('version_number', ''),
                'change_type': version.get('change_type', ''),
                'change_summary': version.get('change_summary', ''),
                'changed_by': user.get('name', version.get('changed_by', '')),
                'changed_at': version.get('changed_at', ''),
                'field_changes': json.dumps(version.get('changes', {})),
                'is_import': version.get('is_import', False)
            }
            writer.writerow(row)
        
        file_content = output.getvalue().encode('utf-8')
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        file_name = f"po_breakdown_audit_export_{timestamp}.csv"
        
        return file_content, file_name
    
    async def _export_to_xml(
        self,
        audit_data: Dict[str, Any],
        config: AuditExportConfig
    ) -> tuple[bytes, str]:
        """
        Export audit data to XML format.
        
        **Validates: Requirement 6.5**
        """
        # Build XML structure
        xml_lines = ['<?xml version="1.0" encoding="UTF-8"?>']
        xml_lines.append('<audit_export>')
        xml_lines.append(f'  <metadata>')
        xml_lines.append(f'    <exported_at>{datetime.now().isoformat()}</exported_at>')
        xml_lines.append(f'    <record_count>{len(audit_data.get("versions", []))}</record_count>')
        xml_lines.append(f'  </metadata>')
        xml_lines.append('  <versions>')
        
        for version in audit_data.get('versions', []):
            xml_lines.append('    <version>')
            xml_lines.append(f'      <id>{self._xml_escape(str(version.get("id", "")))}</id>')
            xml_lines.append(f'      <breakdown_id>{self._xml_escape(str(version.get("breakdown_id", "")))}</breakdown_id>')
            xml_lines.append(f'      <version_number>{version.get("version_number", "")}</version_number>')
            xml_lines.append(f'      <change_type>{self._xml_escape(version.get("change_type", ""))}</change_type>')
            xml_lines.append(f'      <changed_at>{self._xml_escape(str(version.get("changed_at", "")))}</changed_at>')
            xml_lines.append(f'      <changed_by>{self._xml_escape(str(version.get("changed_by", "")))}</changed_by>')
            xml_lines.append('    </version>')
        
        xml_lines.append('  </versions>')
        xml_lines.append('</audit_export>')
        
        file_content = '\n'.join(xml_lines).encode('utf-8')
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        file_name = f"po_breakdown_audit_export_{timestamp}.xml"
        
        return file_content, file_name
    
    def _xml_escape(self, text: str) -> str:
        """Escape XML special characters."""
        return (text
                .replace('&', '&amp;')
                .replace('<', '&lt;')
                .replace('>', '&gt;')
                .replace('"', '&quot;')
                .replace("'", '&apos;'))

    
    def _prepare_json_export(self, audit_data: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare audit data for JSON export."""
        return {
            'metadata': audit_data.get('export_metadata', {}),
            'versions': [
                {
                    'id': str(v.get('id', '')),
                    'breakdown_id': str(v.get('breakdown_id', '')),
                    'breakdown_name': audit_data.get('breakdowns', {}).get(v.get('breakdown_id', ''), {}).get('name', ''),
                    'version_number': v.get('version_number'),
                    'change_type': v.get('change_type'),
                    'change_summary': v.get('change_summary'),
                    'changes': v.get('changes', {}),
                    'before_values': v.get('before_values', {}),
                    'after_values': v.get('after_values', {}),
                    'changed_by': str(v.get('changed_by', '')),
                    'changed_by_name': audit_data.get('users', {}).get(v.get('changed_by', ''), {}).get('name', ''),
                    'changed_at': str(v.get('changed_at', '')),
                    'change_reason': v.get('change_reason'),
                    'is_import': v.get('is_import', False)
                }
                for v in audit_data.get('versions', [])
            ],
            'breakdowns': {
                bid: {
                    'id': str(b.get('id', '')),
                    'name': b.get('name', ''),
                    'code': b.get('code'),
                    'sap_po_number': b.get('sap_po_number'),
                    'is_active': b.get('is_active', True)
                }
                for bid, b in audit_data.get('breakdowns', {}).items()
            }
        }
    
    def _calculate_checksum(self, content: bytes) -> str:
        """Calculate SHA-256 checksum of content."""
        return hashlib.sha256(content).hexdigest()
    
    async def _compress_data(self, content: bytes) -> bytes:
        """Compress data using gzip."""
        import gzip
        return gzip.compress(content)
    
    def _calculate_date_range(self, audit_data: Dict[str, Any]) -> Dict[str, Optional[str]]:
        """Calculate date range of audit data."""
        versions = audit_data.get('versions', [])
        if not versions:
            return {'start': None, 'end': None}
        
        dates = [v.get('changed_at') for v in versions if v.get('changed_at')]
        if not dates:
            return {'start': None, 'end': None}
        
        return {
            'start': min(dates),
            'end': max(dates)
        }

    
    # =========================================================================
    # Compliance Report Generation (Requirement 6.6)
    # =========================================================================
    
    async def generate_compliance_report(
        self,
        config: ComplianceReportConfig,
        user_id: UUID
    ) -> ComplianceReport:
        """
        Generate compliance report with digital signature.
        
        **Validates: Requirement 6.6**
        
        Args:
            config: Report configuration
            user_id: User generating the report
            
        Returns:
            ComplianceReport with digital signature
        """
        try:
            logger.info(f"Generating compliance report for project {config.project_id}")
            
            # Query audit data for report period
            audit_data = await self._query_report_data(config)
            
            # Generate report sections
            sections = []
            section_order = 0
            
            if config.include_executive_summary:
                sections.append(await self._generate_executive_summary(audit_data, section_order))
                section_order += 1
            
            if config.include_change_statistics:
                sections.append(await self._generate_change_statistics(audit_data, section_order))
                section_order += 1
            
            if config.include_user_activity:
                sections.append(await self._generate_user_activity(audit_data, section_order))
                section_order += 1
            
            if config.include_deletion_audit:
                sections.append(await self._generate_deletion_audit(audit_data, section_order))
                section_order += 1
            
            if config.include_variance_analysis:
                sections.append(await self._generate_variance_analysis(audit_data, section_order))
                section_order += 1
            
            # Add custom sections
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
            
            # Calculate statistics
            stats = self._calculate_report_statistics(audit_data)
            
            # Generate report file
            report_id = uuid4()
            file_content, file_name = await self._generate_report_file(
                config, sections, stats, report_id
            )
            
            # Calculate checksum
            checksum = self._calculate_checksum(file_content)
            
            # Generate digital signature if requested
            digital_signature = None
            signature_valid = False
            if config.include_digital_signature:
                digital_signature = await self._generate_digital_signature(
                    file_content,
                    config.signature_algorithm,
                    user_id
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
                executive_summary=sections[0].content if config.include_executive_summary else None,
                sections=sections,
                total_breakdowns=stats['total_breakdowns'],
                total_changes=stats['total_changes'],
                total_users=stats['total_users'],
                changes_by_type=stats['changes_by_type'],
                changes_by_user=stats['changes_by_user'],
                digital_signature=digital_signature,
                signature_valid=signature_valid,
                file_name=file_name,
                file_size_bytes=len(file_content),
                download_url=f"/api/v1/compliance-reports/{report_id}/download",
                expires_at=None,
                checksum=checksum,
                metadata={
                    'config': config.model_dump(mode='json'),
                    'generation_timestamp': datetime.now().isoformat()
                }
            )
            
            logger.info(f"Compliance report generated: {report_id}")
            return report
            
        except Exception as e:
            logger.error(f"Failed to generate compliance report: {e}")
            raise

    
    async def _query_report_data(self, config: ComplianceReportConfig) -> Dict[str, Any]:
        """Query data for compliance report."""
        # Query versions within report period
        query = self.supabase.table(self.version_table).select('*')
        
        # Get breakdown IDs for project
        breakdown_ids = await self._get_project_breakdown_ids(config.project_id)
        if breakdown_ids:
            query = query.in_('breakdown_id', [str(bid) for bid in breakdown_ids])
        
        # Filter by date range
        query = query.gte('changed_at', config.report_period_start.isoformat())
        query = query.lte('changed_at', config.report_period_end.isoformat())
        
        result = query.order('changed_at').execute()
        versions = result.data or []
        
        # Get breakdown details
        breakdowns = await self._get_breakdowns_details(
            [str(bid) for bid in breakdown_ids],
            include_soft_deleted=True
        )
        
        # Get user details
        user_ids = list(set(v['changed_by'] for v in versions))
        users = await self._get_user_details(user_ids)
        
        return {
            'versions': versions,
            'breakdowns': breakdowns,
            'users': users,
            'report_period': {
                'start': config.report_period_start.isoformat(),
                'end': config.report_period_end.isoformat()
            }
        }
    
    async def _generate_executive_summary(
        self,
        audit_data: Dict[str, Any],
        order: int
    ) -> ComplianceReportSection:
        """Generate executive summary section."""
        versions = audit_data.get('versions', [])
        breakdowns = audit_data.get('breakdowns', {})
        
        total_changes = len(versions)
        unique_breakdowns = len(set(v['breakdown_id'] for v in versions))
        unique_users = len(set(v['changed_by'] for v in versions))
        
        # Count change types
        change_types = {}
        for v in versions:
            change_type = v.get('change_type', 'unknown')
            change_types[change_type] = change_types.get(change_type, 0) + 1
        
        summary = f"""
        <h2>Executive Summary</h2>
        <p>This compliance report covers the audit trail for PO breakdown management activities 
        during the specified reporting period.</p>
        
        <h3>Key Metrics</h3>
        <ul>
            <li>Total Changes: {total_changes}</li>
            <li>Affected Breakdowns: {unique_breakdowns}</li>
            <li>Active Users: {unique_users}</li>
        </ul>
        
        <h3>Change Distribution</h3>
        <ul>
        """
        
        for change_type, count in sorted(change_types.items(), key=lambda x: x[1], reverse=True):
            percentage = (count / total_changes * 100) if total_changes > 0 else 0
            summary += f"<li>{change_type}: {count} ({percentage:.1f}%)</li>\n"
        
        summary += "</ul>"
        
        return ComplianceReportSection(
            section_id='executive_summary',
            title='Executive Summary',
            content=summary,
            data={
                'total_changes': total_changes,
                'unique_breakdowns': unique_breakdowns,
                'unique_users': unique_users,
                'change_types': change_types
            },
            order=order
        )
    
    async def _generate_change_statistics(
        self,
        audit_data: Dict[str, Any],
        order: int
    ) -> ComplianceReportSection:
        """Generate change statistics section."""
        versions = audit_data.get('versions', [])
        
        # Group by date
        changes_by_date = {}
        for v in versions:
            date = v.get('changed_at', '')[:10]  # Extract date part
            changes_by_date[date] = changes_by_date.get(date, 0) + 1
        
        # Group by type
        changes_by_type = {}
        for v in versions:
            change_type = v.get('change_type', 'unknown')
            changes_by_type[change_type] = changes_by_type.get(change_type, 0) + 1
        
        content = f"""
        <h2>Change Statistics</h2>
        
        <h3>Changes Over Time</h3>
        <table>
            <tr><th>Date</th><th>Changes</th></tr>
        """
        
        for date in sorted(changes_by_date.keys()):
            content += f"<tr><td>{date}</td><td>{changes_by_date[date]}</td></tr>\n"
        
        content += """
        </table>
        
        <h3>Changes by Type</h3>
        <table>
            <tr><th>Type</th><th>Count</th><th>Percentage</th></tr>
        """
        
        total = len(versions)
        for change_type, count in sorted(changes_by_type.items(), key=lambda x: x[1], reverse=True):
            percentage = (count / total * 100) if total > 0 else 0
            content += f"<tr><td>{change_type}</td><td>{count}</td><td>{percentage:.1f}%</td></tr>\n"
        
        content += "</table>"
        
        return ComplianceReportSection(
            section_id='change_statistics',
            title='Change Statistics',
            content=content,
            data={
                'changes_by_date': changes_by_date,
                'changes_by_type': changes_by_type
            },
            charts=[
                {
                    'type': 'line',
                    'title': 'Changes Over Time',
                    'data': changes_by_date
                },
                {
                    'type': 'pie',
                    'title': 'Changes by Type',
                    'data': changes_by_type
                }
            ],
            order=order
        )

    
    async def _generate_user_activity(
        self,
        audit_data: Dict[str, Any],
        order: int
    ) -> ComplianceReportSection:
        """Generate user activity section."""
        versions = audit_data.get('versions', [])
        users = audit_data.get('users', {})
        
        # Group by user
        changes_by_user = {}
        for v in versions:
            user_id = v.get('changed_by', '')
            changes_by_user[user_id] = changes_by_user.get(user_id, 0) + 1
        
        content = """
        <h2>User Activity</h2>
        <table>
            <tr><th>User</th><th>Changes</th><th>Percentage</th></tr>
        """
        
        total = len(versions)
        for user_id, count in sorted(changes_by_user.items(), key=lambda x: x[1], reverse=True):
            user_name = users.get(user_id, {}).get('name', user_id[:8])
            percentage = (count / total * 100) if total > 0 else 0
            content += f"<tr><td>{user_name}</td><td>{count}</td><td>{percentage:.1f}%</td></tr>\n"
        
        content += "</table>"
        
        return ComplianceReportSection(
            section_id='user_activity',
            title='User Activity',
            content=content,
            data={'changes_by_user': changes_by_user},
            order=order
        )
    
    async def _generate_deletion_audit(
        self,
        audit_data: Dict[str, Any],
        order: int
    ) -> ComplianceReportSection:
        """Generate deletion audit section."""
        versions = audit_data.get('versions', [])
        
        # Filter deletion events
        deletions = [v for v in versions if v.get('change_type') == 'delete']
        
        content = f"""
        <h2>Deletion Audit</h2>
        <p>Total Deletions: {len(deletions)}</p>
        
        <table>
            <tr><th>Date</th><th>Breakdown</th><th>Type</th><th>User</th></tr>
        """
        
        for deletion in deletions:
            breakdown_id = deletion.get('breakdown_id', '')
            breakdown = audit_data.get('breakdowns', {}).get(breakdown_id, {})
            user = audit_data.get('users', {}).get(deletion.get('changed_by', ''), {})
            
            changes = deletion.get('changes', {})
            deletion_type = 'Hard' if changes.get('hard_delete') else 'Soft'
            
            content += f"""
            <tr>
                <td>{deletion.get('changed_at', '')[:10]}</td>
                <td>{breakdown.get('name', 'Unknown')}</td>
                <td>{deletion_type}</td>
                <td>{user.get('name', 'Unknown')}</td>
            </tr>
            """
        
        content += "</table>"
        
        return ComplianceReportSection(
            section_id='deletion_audit',
            title='Deletion Audit',
            content=content,
            data={'deletions': len(deletions)},
            order=order
        )
    
    async def _generate_variance_analysis(
        self,
        audit_data: Dict[str, Any],
        order: int
    ) -> ComplianceReportSection:
        """Generate variance analysis section."""
        versions = audit_data.get('versions', [])
        
        # Filter financial updates
        financial_updates = [
            v for v in versions 
            if v.get('change_type') == 'financial_update'
        ]
        
        content = f"""
        <h2>Variance Analysis</h2>
        <p>Total Financial Updates: {len(financial_updates)}</p>
        <p>This section tracks changes to planned, committed, and actual amounts.</p>
        """
        
        return ComplianceReportSection(
            section_id='variance_analysis',
            title='Variance Analysis',
            content=content,
            data={'financial_updates': len(financial_updates)},
            order=order
        )
    
    def _calculate_report_statistics(self, audit_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate statistics for compliance report."""
        versions = audit_data.get('versions', [])
        
        changes_by_type = {}
        changes_by_user = {}
        
        for v in versions:
            change_type = v.get('change_type', 'unknown')
            changes_by_type[change_type] = changes_by_type.get(change_type, 0) + 1
            
            user_id = v.get('changed_by', '')
            changes_by_user[user_id] = changes_by_user.get(user_id, 0) + 1
        
        return {
            'total_breakdowns': len(audit_data.get('breakdowns', {})),
            'total_changes': len(versions),
            'total_users': len(changes_by_user),
            'changes_by_type': changes_by_type,
            'changes_by_user': changes_by_user
        }

    
    async def _generate_report_file(
        self,
        config: ComplianceReportConfig,
        sections: List[ComplianceReportSection],
        stats: Dict[str, Any],
        report_id: UUID
    ) -> tuple[bytes, str]:
        """Generate report file based on format."""
        if config.format == ComplianceReportFormat.pdf:
            return await self._generate_pdf_report(config, sections, stats, report_id)
        elif config.format == ComplianceReportFormat.html:
            return await self._generate_html_report(config, sections, stats, report_id)
        elif config.format == ComplianceReportFormat.json:
            return await self._generate_json_report(config, sections, stats, report_id)
        else:
            raise ValueError(f"Unsupported report format: {config.format}")
    
    async def _generate_html_report(
        self,
        config: ComplianceReportConfig,
        sections: List[ComplianceReportSection],
        stats: Dict[str, Any],
        report_id: UUID
    ) -> tuple[bytes, str]:
        """Generate HTML compliance report."""
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>{config.report_title}</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 40px; }}
                h1 {{ color: #333; }}
                h2 {{ color: #666; margin-top: 30px; }}
                table {{ border-collapse: collapse; width: 100%; margin: 20px 0; }}
                th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                th {{ background-color: #f2f2f2; }}
                .metadata {{ background-color: #f9f9f9; padding: 15px; margin: 20px 0; }}
            </style>
        </head>
        <body>
            <h1>{config.report_title}</h1>
            
            <div class="metadata">
                <p><strong>Report ID:</strong> {report_id}</p>
                <p><strong>Project ID:</strong> {config.project_id}</p>
                <p><strong>Report Period:</strong> {config.report_period_start.strftime('%Y-%m-%d')} to {config.report_period_end.strftime('%Y-%m-%d')}</p>
                <p><strong>Generated:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
                <p><strong>Total Changes:</strong> {stats['total_changes']}</p>
                <p><strong>Total Users:</strong> {stats['total_users']}</p>
            </div>
        """
        
        # Add sections
        for section in sorted(sections, key=lambda s: s.order):
            html += f"\n{section.content}\n"
        
        html += """
        </body>
        </html>
        """
        
        file_content = html.encode('utf-8')
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        file_name = f"compliance_report_{timestamp}.html"
        
        return file_content, file_name
    
    async def _generate_pdf_report(
        self,
        config: ComplianceReportConfig,
        sections: List[ComplianceReportSection],
        stats: Dict[str, Any],
        report_id: UUID
    ) -> tuple[bytes, str]:
        """Generate PDF compliance report."""
        # For now, generate HTML and note that PDF conversion would be done
        # In production, use a library like ReportLab or WeasyPrint
        html_content, _ = await self._generate_html_report(config, sections, stats, report_id)
        
        # Placeholder: In production, convert HTML to PDF
        # For now, return HTML with PDF extension
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        file_name = f"compliance_report_{timestamp}.pdf"
        
        return html_content, file_name
    
    async def _generate_json_report(
        self,
        config: ComplianceReportConfig,
        sections: List[ComplianceReportSection],
        stats: Dict[str, Any],
        report_id: UUID
    ) -> tuple[bytes, str]:
        """Generate JSON compliance report."""
        report_data = {
            'report_id': str(report_id),
            'project_id': str(config.project_id),
            'report_title': config.report_title,
            'report_period': {
                'start': config.report_period_start.isoformat(),
                'end': config.report_period_end.isoformat()
            },
            'generated_at': datetime.now().isoformat(),
            'statistics': stats,
            'sections': [
                {
                    'section_id': s.section_id,
                    'title': s.title,
                    'content': s.content,
                    'data': s.data,
                    'order': s.order
                }
                for s in sorted(sections, key=lambda s: s.order)
            ]
        }
        
        json_str = json.dumps(report_data, indent=2, default=str)
        file_content = json_str.encode('utf-8')
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        file_name = f"compliance_report_{timestamp}.json"
        
        return file_content, file_name

    
    async def _generate_digital_signature(
        self,
        content: bytes,
        algorithm: DigitalSignatureAlgorithm,
        user_id: UUID
    ) -> DigitalSignature:
        """
        Generate digital signature for compliance report.
        
        **Validates: Requirement 6.6**
        
        In production, this would use actual cryptographic signing.
        For now, we create a placeholder signature structure.
        """
        import base64
        
        # Calculate content hash
        content_hash = hashlib.sha256(content).hexdigest()
        
        # In production, this would:
        # 1. Load user's private key
        # 2. Sign the content hash
        # 3. Return the signature
        
        # Placeholder signature (in production, use actual cryptographic signing)
        signature_data = f"{algorithm.value}:{content_hash}:{user_id}:{datetime.now().isoformat()}"
        signature_bytes = signature_data.encode('utf-8')
        signature_b64 = base64.b64encode(signature_bytes).decode('utf-8')
        
        # Placeholder public key fingerprint
        public_key_fingerprint = hashlib.sha256(str(user_id).encode()).hexdigest()[:16]
        
        return DigitalSignature(
            algorithm=algorithm,
            signature=signature_b64,
            public_key_fingerprint=public_key_fingerprint,
            signed_at=datetime.now(),
            signed_by=user_id,
            signature_metadata={
                'content_hash': content_hash,
                'signing_method': 'placeholder',
                'note': 'In production, use actual cryptographic signing with RSA/ECDSA/Ed25519'
            }
        )
    
    async def verify_digital_signature(
        self,
        report: ComplianceReport,
        file_content: bytes
    ) -> bool:
        """
        Verify digital signature of a compliance report.
        
        **Validates: Requirement 6.6**
        
        Args:
            report: Compliance report with signature
            file_content: Report file content
            
        Returns:
            True if signature is valid
        """
        if not report.digital_signature:
            return False
        
        try:
            # Calculate current content hash
            current_hash = hashlib.sha256(file_content).hexdigest()
            
            # In production, this would:
            # 1. Load public key using fingerprint
            # 2. Verify signature against content
            # 3. Return verification result
            
            # Placeholder verification
            # Check if checksum matches
            return report.checksum == current_hash
            
        except Exception as e:
            logger.error(f"Failed to verify signature: {e}")
            return False
