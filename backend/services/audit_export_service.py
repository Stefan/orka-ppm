"""
Audit Export Service

This service handles exporting audit logs to PDF and CSV formats with AI-generated
executive summaries and trend analysis. It integrates with OpenAI for summary generation
and uses reportlab for PDF generation.

Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.12
"""

import os
import csv
import io
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from uuid import UUID
from dataclasses import dataclass

# Optional dependencies - gracefully handle if not installed
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    logging.warning("OpenAI not available - AI summaries will be disabled")

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
    from reportlab.platypus import Image as RLImage
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    from reportlab.graphics.shapes import Drawing
    from reportlab.graphics.charts.linecharts import HorizontalLineChart
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False
    logging.warning("ReportLab not available - PDF export will be disabled")

try:
    from reportlab.graphics.charts.barcharts import VerticalBarChart
except ImportError:
    pass

from config.database import supabase


@dataclass
class TrendAnalysis:
    """Data class for trend analysis results."""
    event_volume_over_time: List[Dict[str, Any]]
    category_distribution: Dict[str, int]
    severity_distribution: Dict[str, int]
    top_users: List[Dict[str, Any]]
    top_event_types: List[Dict[str, Any]]
    anomaly_trend: List[Dict[str, Any]]


class AuditExportService:
    """
    Service for exporting audit logs with AI-generated summaries.
    
    Supports PDF and CSV export formats with comprehensive filtering,
    AI-powered executive summaries, and trend analysis visualizations.
    """
    
    def __init__(self, supabase_client=None, openai_api_key: Optional[str] = None, base_url: Optional[str] = None):
        """
        Initialize Audit Export Service
        
        Args:
            supabase_client: Supabase client for database operations
            openai_api_key: OpenAI API key for summary generation
            base_url: Optional custom base URL for OpenAI-compatible APIs (e.g., Grok)
        """
        self.supabase = supabase_client or supabase
        self.logger = logging.getLogger(__name__)
        
        # Initialize OpenAI client
        if OPENAI_AVAILABLE:
            api_key = openai_api_key or os.getenv("OPENAI_API_KEY")
            if not api_key:
                self.logger.warning("OpenAI API key not provided, AI summaries will be disabled")
                self.openai_client = None
            else:
                # Use custom base URL if provided (for Grok, etc.)
                base_url = base_url or os.getenv("OPENAI_BASE_URL")
                if base_url:
                    self.openai_client = OpenAI(api_key=api_key, base_url=base_url)
                else:
                    self.openai_client = OpenAI(api_key=api_key)
        else:
            self.openai_client = None
        
        # Use configurable model from environment or default
        self.chat_model = os.getenv("OPENAI_MODEL", "grok-beta")
        
        # PDF styling - only if reportlab is available
        if REPORTLAB_AVAILABLE:
            self.styles = getSampleStyleSheet()
            self._setup_custom_styles()
        else:
            self.styles = None
        
        self.logger.info("AuditExportService initialized")
    
    def _setup_custom_styles(self):
        """Set up custom paragraph styles for PDF generation."""
        # Title style
        self.styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#1a1a1a'),
            spaceAfter=30,
            alignment=TA_CENTER
        ))
        
        # Subtitle style
        self.styles.add(ParagraphStyle(
            name='CustomSubtitle',
            parent=self.styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#333333'),
            spaceAfter=12,
            spaceBefore=12
        ))
        
        # Executive summary style
        self.styles.add(ParagraphStyle(
            name='ExecutiveSummary',
            parent=self.styles['BodyText'],
            fontSize=11,
            leading=16,
            textColor=colors.HexColor('#444444'),
            spaceAfter=12,
            leftIndent=20,
            rightIndent=20
        ))
    
    async def export_pdf(
        self,
        filters: Dict[str, Any],
        include_summary: bool = True,
        tenant_id: Optional[str] = None
    ) -> bytes:
        """
        Generate PDF export of filtered audit events.
        
        Args:
            filters: Dictionary of filters (date range, event types, severity, etc.)
            include_summary: Whether to include AI-generated executive summary
            tenant_id: Tenant ID for multi-tenant isolation
            
        Returns:
            PDF file as bytes
            
        Requirements: 5.1, 5.4, 5.12
        """
        try:
            self.logger.info(f"Generating PDF export with filters: {filters}")
            
            # Fetch filtered events
            events = await self._fetch_filtered_events(filters, tenant_id)
            
            if not events:
                self.logger.warning("No events found matching filters")
                return self._generate_empty_pdf()
            
            # Generate trend analysis
            trend_analysis = await self.generate_trend_analysis(events)
            
            # Generate executive summary if requested
            executive_summary = None
            if include_summary and self.openai_client:
                executive_summary = await self.generate_executive_summary(events)
            
            # Create PDF
            pdf_buffer = io.BytesIO()
            doc = SimpleDocTemplate(
                pdf_buffer,
                pagesize=letter,
                rightMargin=72,
                leftMargin=72,
                topMargin=72,
                bottomMargin=18
            )
            
            # Build PDF content
            story = []
            
            # Title
            story.append(Paragraph("Audit Trail Report", self.styles['CustomTitle']))
            story.append(Spacer(1, 12))
            
            # Report metadata
            metadata_text = f"""
            <b>Generated:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}<br/>
            <b>Total Events:</b> {len(events)}<br/>
            <b>Date Range:</b> {filters.get('start_date', 'N/A')} to {filters.get('end_date', 'N/A')}
            """
            story.append(Paragraph(metadata_text, self.styles['BodyText']))
            story.append(Spacer(1, 20))
            
            # Executive Summary
            if executive_summary:
                story.append(Paragraph("Executive Summary", self.styles['CustomSubtitle']))
                story.append(Paragraph(executive_summary, self.styles['ExecutiveSummary']))
                story.append(Spacer(1, 20))
            
            # Trend Analysis Charts
            if trend_analysis:
                story.append(Paragraph("Trend Analysis", self.styles['CustomSubtitle']))
                story.append(Spacer(1, 12))
                
                # Add category distribution chart
                category_chart = self._create_category_chart(trend_analysis.category_distribution)
                if category_chart:
                    story.append(category_chart)
                    story.append(Spacer(1, 20))
            
            # Event Details Table
            story.append(PageBreak())
            story.append(Paragraph("Event Details", self.styles['CustomSubtitle']))
            story.append(Spacer(1, 12))
            
            # Create events table
            events_table = self._create_events_table(events)
            story.append(events_table)
            
            # Build PDF
            doc.build(story)
            
            pdf_bytes = pdf_buffer.getvalue()
            pdf_buffer.close()
            
            self.logger.info(f"PDF export generated successfully: {len(pdf_bytes)} bytes")
            return pdf_bytes
            
        except Exception as e:
            self.logger.error(f"PDF export failed: {str(e)}")
            raise
    
    async def export_csv(
        self,
        filters: Dict[str, Any],
        tenant_id: Optional[str] = None
    ) -> str:
        """
        Generate CSV export of filtered audit events.
        
        Args:
            filters: Dictionary of filters (date range, event types, severity, etc.)
            tenant_id: Tenant ID for multi-tenant isolation
            
        Returns:
            CSV content as string
            
        Requirements: 5.2, 5.4
        """
        try:
            self.logger.info(f"Generating CSV export with filters: {filters}")
            
            # Fetch filtered events
            events = await self._fetch_filtered_events(filters, tenant_id)
            
            if not events:
                self.logger.warning("No events found matching filters")
                return self._generate_empty_csv()
            
            # Create CSV
            csv_buffer = io.StringIO()
            
            # Define CSV columns
            fieldnames = [
                'id', 'timestamp', 'event_type', 'user_id', 'entity_type', 'entity_id',
                'severity', 'category', 'risk_level', 'anomaly_score', 'is_anomaly',
                'tags', 'action_details', 'ip_address', 'user_agent', 'project_id'
            ]
            
            writer = csv.DictWriter(csv_buffer, fieldnames=fieldnames, extrasaction='ignore')
            
            # Write header
            writer.writeheader()
            
            # Write events
            for event in events:
                # Flatten complex fields
                row = {
                    'id': event.get('id'),
                    'timestamp': event.get('timestamp'),
                    'event_type': event.get('event_type'),
                    'user_id': event.get('user_id'),
                    'entity_type': event.get('entity_type'),
                    'entity_id': event.get('entity_id'),
                    'severity': event.get('severity'),
                    'category': event.get('category'),
                    'risk_level': event.get('risk_level'),
                    'anomaly_score': event.get('anomaly_score'),
                    'is_anomaly': event.get('is_anomaly'),
                    'tags': json.dumps(event.get('tags', {})),
                    'action_details': json.dumps(event.get('action_details', {})),
                    'ip_address': event.get('ip_address'),
                    'user_agent': event.get('user_agent'),
                    'project_id': event.get('project_id')
                }
                
                writer.writerow(row)
            
            csv_content = csv_buffer.getvalue()
            csv_buffer.close()
            
            self.logger.info(f"CSV export generated successfully: {len(events)} events")
            return csv_content
            
        except Exception as e:
            self.logger.error(f"CSV export failed: {str(e)}")
            raise
    
    async def export_csv_streaming(
        self,
        filters: Dict[str, Any],
        tenant_id: Optional[str] = None,
        batch_size: int = 1000
    ):
        """
        Generate CSV export with streaming for large datasets.
        
        This method yields CSV rows in batches to avoid loading all data into memory.
        Suitable for exports with millions of events.
        
        Args:
            filters: Dictionary of filters (date range, event types, severity, etc.)
            tenant_id: Tenant ID for multi-tenant isolation
            batch_size: Number of events to process per batch (default: 1000)
            
        Yields:
            CSV content chunks as strings
            
        Requirements: 7.1, 7.6, 7.7
        """
        try:
            self.logger.info(f"Starting streaming CSV export with filters: {filters}")
            
            # Define CSV columns
            fieldnames = [
                'id', 'timestamp', 'event_type', 'user_id', 'entity_type', 'entity_id',
                'severity', 'category', 'risk_level', 'anomaly_score', 'is_anomaly',
                'tags', 'action_details', 'ip_address', 'user_agent', 'project_id'
            ]
            
            # Yield CSV header
            csv_buffer = io.StringIO()
            writer = csv.DictWriter(csv_buffer, fieldnames=fieldnames, extrasaction='ignore')
            writer.writeheader()
            yield csv_buffer.getvalue()
            csv_buffer.close()
            
            # Stream events in batches
            offset = 0
            total_exported = 0
            
            while True:
                # Fetch batch of events
                batch_filters = filters.copy()
                batch_filters['limit'] = batch_size
                batch_filters['offset'] = offset
                
                events = await self._fetch_filtered_events(batch_filters, tenant_id)
                
                if not events:
                    break
                
                # Generate CSV for this batch
                csv_buffer = io.StringIO()
                writer = csv.DictWriter(csv_buffer, fieldnames=fieldnames, extrasaction='ignore')
                
                for event in events:
                    # Flatten complex fields
                    row = {
                        'id': event.get('id'),
                        'timestamp': event.get('timestamp'),
                        'event_type': event.get('event_type'),
                        'user_id': event.get('user_id'),
                        'entity_type': event.get('entity_type'),
                        'entity_id': event.get('entity_id'),
                        'severity': event.get('severity'),
                        'category': event.get('category'),
                        'risk_level': event.get('risk_level'),
                        'anomaly_score': event.get('anomaly_score'),
                        'is_anomaly': event.get('is_anomaly'),
                        'tags': json.dumps(event.get('tags', {})),
                        'action_details': json.dumps(event.get('action_details', {})),
                        'ip_address': event.get('ip_address'),
                        'user_agent': event.get('user_agent'),
                        'project_id': event.get('project_id')
                    }
                    
                    writer.writerow(row)
                
                # Yield batch
                yield csv_buffer.getvalue()
                csv_buffer.close()
                
                total_exported += len(events)
                offset += batch_size
                
                # If we got fewer events than batch_size, we're done
                if len(events) < batch_size:
                    break
            
            self.logger.info(f"Streaming CSV export completed: {total_exported} events")
            
        except Exception as e:
            self.logger.error(f"Streaming CSV export failed: {str(e)}")
            raise
    
    async def generate_executive_summary(
        self,
        events: List[Dict[str, Any]]
    ) -> str:
        """
        Generate AI-powered executive summary of audit events.
        
        Uses GPT-4 to analyze trends and highlight key findings.
        
        Args:
            events: List of audit events to summarize
            
        Returns:
            Formatted summary text
            
        Requirements: 5.3, 5.5
        """
        try:
            if not self.openai_client:
                return "AI summary generation is not available (OpenAI API key not configured)."
            
            # Calculate statistics
            stats = self._calculate_statistics(events)
            
            # Build prompt for GPT-4
            system_prompt = """You are an AI assistant specialized in analyzing audit logs for a Project Portfolio Management platform.
Generate a concise executive summary highlighting key trends, anomalies, and important events.
Focus on actionable insights and potential concerns."""
            
            user_prompt = f"""Analyze the following audit log statistics and generate an executive summary:

Total Events: {stats['total_events']}
Date Range: {stats['date_range']}

Event Breakdown:
- Critical Events: {stats['critical_events']}
- Security Events: {stats['security_events']}
- Financial Events: {stats['financial_events']}
- Anomalies Detected: {stats['anomalies_detected']}

Top Event Types:
{self._format_list(stats['top_event_types'])}

Category Distribution:
{self._format_dict(stats['category_distribution'])}

Risk Level Distribution:
{self._format_dict(stats['risk_distribution'])}

Top Users by Activity:
{self._format_list(stats['top_users'])}

Provide a 4-5 sentence executive summary highlighting:
1. Overall activity level and trends
2. Any concerning patterns or anomalies
3. Key security or compliance events
4. Recommendations for follow-up actions"""
            
            response = self.openai_client.chat.completions.create(
                model=self.chat_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,
                max_tokens=400
            )
            
            summary = response.choices[0].message.content
            
            self.logger.info("Executive summary generated successfully")
            return summary
            
        except Exception as e:
            self.logger.error(f"Executive summary generation failed: {str(e)}")
            return f"Failed to generate executive summary: {str(e)}"
    
    async def generate_trend_analysis(
        self,
        events: List[Dict[str, Any]]
    ) -> TrendAnalysis:
        """
        Analyze trends in audit events.
        
        Args:
            events: List of audit events to analyze
            
        Returns:
            TrendAnalysis object with charts data
            
        Requirements: 5.12
        """
        try:
            # Event volume over time (daily buckets)
            event_volume = self._calculate_event_volume_over_time(events)
            
            # Category distribution
            category_dist = {}
            for event in events:
                category = event.get('category', 'Unknown')
                category_dist[category] = category_dist.get(category, 0) + 1
            
            # Severity distribution
            severity_dist = {}
            for event in events:
                severity = event.get('severity', 'info')
                severity_dist[severity] = severity_dist.get(severity, 0) + 1
            
            # Top users
            user_counts = {}
            for event in events:
                user_id = event.get('user_id')
                if user_id:
                    user_counts[user_id] = user_counts.get(user_id, 0) + 1
            
            top_users = sorted(
                [{'user_id': k, 'count': v} for k, v in user_counts.items()],
                key=lambda x: x['count'],
                reverse=True
            )[:10]
            
            # Top event types
            event_type_counts = {}
            for event in events:
                event_type = event.get('event_type')
                if event_type:
                    event_type_counts[event_type] = event_type_counts.get(event_type, 0) + 1
            
            top_event_types = sorted(
                [{'event_type': k, 'count': v} for k, v in event_type_counts.items()],
                key=lambda x: x['count'],
                reverse=True
            )[:10]
            
            # Anomaly trend
            anomaly_trend = self._calculate_anomaly_trend(events)
            
            return TrendAnalysis(
                event_volume_over_time=event_volume,
                category_distribution=category_dist,
                severity_distribution=severity_dist,
                top_users=top_users,
                top_event_types=top_event_types,
                anomaly_trend=anomaly_trend
            )
            
        except Exception as e:
            self.logger.error(f"Trend analysis failed: {str(e)}")
            return None
    
    async def _fetch_filtered_events(
        self,
        filters: Dict[str, Any],
        tenant_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch audit events matching filters.
        
        Args:
            filters: Dictionary of filters
            tenant_id: Tenant ID for isolation
            
        Returns:
            List of matching audit events
        """
        try:
            query = self.supabase.table("audit_logs").select("*")
            
            # Apply tenant isolation
            if tenant_id:
                query = query.eq("tenant_id", tenant_id)
            
            # Apply date range filters
            if filters.get('start_date'):
                query = query.gte("timestamp", filters['start_date'])
            
            if filters.get('end_date'):
                query = query.lte("timestamp", filters['end_date'])
            
            # Apply event type filter
            if filters.get('event_types'):
                query = query.in_("event_type", filters['event_types'])
            
            # Apply severity filter
            if filters.get('severity'):
                query = query.eq("severity", filters['severity'])
            
            # Apply category filter
            if filters.get('categories'):
                query = query.in_("category", filters['categories'])
            
            # Apply risk level filter
            if filters.get('risk_levels'):
                query = query.in_("risk_level", filters['risk_levels'])
            
            # Apply user filter
            if filters.get('user_id'):
                query = query.eq("user_id", filters['user_id'])
            
            # Apply entity filters
            if filters.get('entity_type'):
                query = query.eq("entity_type", filters['entity_type'])
            
            if filters.get('entity_id'):
                query = query.eq("entity_id", filters['entity_id'])
            
            # Order by timestamp descending
            query = query.order("timestamp", desc=True)
            
            # Limit results (max 10000 for export)
            limit = filters.get('limit', 10000)
            query = query.limit(limit)
            
            response = query.execute()
            events = response.data or []
            
            self.logger.info(f"Fetched {len(events)} events matching filters")
            return events
            
        except Exception as e:
            self.logger.error(f"Failed to fetch filtered events: {str(e)}")
            return []
    
    def _calculate_statistics(self, events: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate statistics from events for summary generation."""
        stats = {
            'total_events': len(events),
            'critical_events': 0,
            'security_events': 0,
            'financial_events': 0,
            'anomalies_detected': 0,
            'top_event_types': [],
            'category_distribution': {},
            'risk_distribution': {},
            'top_users': [],
            'date_range': 'N/A'
        }
        
        if not events:
            return stats
        
        # Calculate date range
        timestamps = [e.get('timestamp') for e in events if e.get('timestamp')]
        if timestamps:
            timestamps.sort()
            stats['date_range'] = f"{timestamps[0]} to {timestamps[-1]}"
        
        # Count events by type
        event_type_counts = {}
        user_counts = {}
        
        for event in events:
            # Critical events
            if event.get('severity') == 'critical':
                stats['critical_events'] += 1
            
            # Security events
            if event.get('category') == 'Security Change':
                stats['security_events'] += 1
            
            # Financial events
            if event.get('category') == 'Financial Impact':
                stats['financial_events'] += 1
            
            # Anomalies
            if event.get('is_anomaly'):
                stats['anomalies_detected'] += 1
            
            # Event types
            event_type = event.get('event_type')
            if event_type:
                event_type_counts[event_type] = event_type_counts.get(event_type, 0) + 1
            
            # Categories
            category = event.get('category', 'Unknown')
            stats['category_distribution'][category] = stats['category_distribution'].get(category, 0) + 1
            
            # Risk levels
            risk = event.get('risk_level', 'Unknown')
            stats['risk_distribution'][risk] = stats['risk_distribution'].get(risk, 0) + 1
            
            # Users
            user_id = event.get('user_id')
            if user_id:
                user_counts[user_id] = user_counts.get(user_id, 0) + 1
        
        # Top event types
        stats['top_event_types'] = sorted(
            [{'type': k, 'count': v} for k, v in event_type_counts.items()],
            key=lambda x: x['count'],
            reverse=True
        )[:5]
        
        # Top users
        stats['top_users'] = sorted(
            [{'user_id': k, 'count': v} for k, v in user_counts.items()],
            key=lambda x: x['count'],
            reverse=True
        )[:5]
        
        return stats
    
    def _format_list(self, items: List[Dict[str, Any]]) -> str:
        """Format list of items for prompt."""
        if not items:
            return "None"
        return "\n".join([f"- {list(item.values())[0]}: {list(item.values())[1]}" for item in items])
    
    def _format_dict(self, data: Dict[str, Any]) -> str:
        """Format dictionary for prompt."""
        if not data:
            return "None"
        return "\n".join([f"- {k}: {v}" for k, v in data.items()])
    
    def _calculate_event_volume_over_time(
        self,
        events: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Calculate event volume grouped by day."""
        daily_counts = {}
        
        for event in events:
            timestamp_str = event.get('timestamp')
            if timestamp_str:
                try:
                    if isinstance(timestamp_str, str):
                        timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                    else:
                        timestamp = timestamp_str
                    
                    date_key = timestamp.date().isoformat()
                    daily_counts[date_key] = daily_counts.get(date_key, 0) + 1
                except:
                    pass
        
        # Convert to sorted list
        volume_data = [
            {'date': k, 'count': v}
            for k, v in sorted(daily_counts.items())
        ]
        
        return volume_data
    
    def _calculate_anomaly_trend(
        self,
        events: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Calculate anomaly detection trend over time."""
        daily_anomalies = {}
        
        for event in events:
            if event.get('is_anomaly'):
                timestamp_str = event.get('timestamp')
                if timestamp_str:
                    try:
                        if isinstance(timestamp_str, str):
                            timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                        else:
                            timestamp = timestamp_str
                        
                        date_key = timestamp.date().isoformat()
                        daily_anomalies[date_key] = daily_anomalies.get(date_key, 0) + 1
                    except:
                        pass
        
        # Convert to sorted list
        anomaly_data = [
            {'date': k, 'count': v}
            for k, v in sorted(daily_anomalies.items())
        ]
        
        return anomaly_data
    
    def _create_category_chart(self, category_dist: Dict[str, int]) -> Drawing:
        """Create bar chart for category distribution."""
        try:
            drawing = Drawing(400, 200)
            
            chart = VerticalBarChart()
            chart.x = 50
            chart.y = 50
            chart.height = 125
            chart.width = 300
            
            # Prepare data
            categories = list(category_dist.keys())
            counts = list(category_dist.values())
            
            chart.data = [counts]
            chart.categoryAxis.categoryNames = categories
            chart.categoryAxis.labels.angle = 45
            chart.categoryAxis.labels.fontSize = 8
            
            chart.valueAxis.valueMin = 0
            chart.valueAxis.valueMax = max(counts) * 1.1 if counts else 10
            
            drawing.add(chart)
            
            return drawing
        except Exception as e:
            self.logger.error(f"Failed to create category chart: {str(e)}")
            return None
    
    def _create_events_table(self, events: List[Dict[str, Any]]) -> Table:
        """Create table of event details for PDF."""
        # Limit to first 100 events for PDF
        events_subset = events[:100]
        
        # Table data
        data = [['Timestamp', 'Event Type', 'User', 'Severity', 'Category', 'Risk']]
        
        for event in events_subset:
            row = [
                event.get('timestamp', '')[:19],  # Truncate timestamp
                event.get('event_type', '')[:30],  # Truncate long event types
                str(event.get('user_id', ''))[:20],  # Truncate user ID
                event.get('severity', ''),
                event.get('category', '')[:20],  # Truncate category
                event.get('risk_level', '')
            ]
            data.append(row)
        
        # Create table
        table = Table(data, colWidths=[1.5*inch, 1.5*inch, 1.2*inch, 0.8*inch, 1.2*inch, 0.8*inch])
        
        # Style table
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey])
        ]))
        
        return table
    
    def _generate_empty_pdf(self) -> bytes:
        """Generate empty PDF when no events found."""
        pdf_buffer = io.BytesIO()
        doc = SimpleDocTemplate(pdf_buffer, pagesize=letter)
        
        story = [
            Paragraph("Audit Trail Report", self.styles['CustomTitle']),
            Spacer(1, 20),
            Paragraph("No events found matching the specified filters.", self.styles['BodyText'])
        ]
        
        doc.build(story)
        pdf_bytes = pdf_buffer.getvalue()
        pdf_buffer.close()
        
        return pdf_bytes
    
    def _generate_empty_csv(self) -> str:
        """Generate empty CSV when no events found."""
        csv_buffer = io.StringIO()
        fieldnames = [
            'id', 'timestamp', 'event_type', 'user_id', 'entity_type', 'entity_id',
            'severity', 'category', 'risk_level', 'anomaly_score', 'is_anomaly',
            'tags', 'action_details', 'ip_address', 'user_agent', 'project_id'
        ]
        writer = csv.DictWriter(csv_buffer, fieldnames=fieldnames)
        writer.writeheader()
        
        csv_content = csv_buffer.getvalue()
        csv_buffer.close()
        
        return csv_content


# Global export service instance
export_service = AuditExportService()
