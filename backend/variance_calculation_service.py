"""
Variance Calculation Service for Commitments vs Actuals Analysis
Handles aggregation logic, variance calculations, and scheduled recalculation
"""

import asyncio
import logging
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Any, Optional, Tuple
from uuid import uuid4
from pydantic import BaseModel
from supabase import Client
from dataclasses import dataclass

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class VarianceCalculationResult(BaseModel):
    """Model for variance calculation results"""
    variances_calculated: int
    projects_processed: int
    wbs_elements_processed: int
    total_commitment: Decimal
    total_actual: Decimal
    total_variance: Decimal
    calculation_time_ms: int
    errors: List[str]
    warnings: List[str]

@dataclass
class ProjectVarianceSummary:
    """Summary of variance data for a project"""
    project_id: str
    project_name: str
    total_commitment: Decimal
    total_actual: Decimal
    variance: Decimal
    variance_percentage: Decimal
    status: str
    currency_code: str
    wbs_count: int
    last_updated: datetime

@dataclass
class WBSVarianceDetail:
    """Detailed variance data for a WBS element"""
    project_id: str
    wbs_element: str
    wbs_description: str
    commitment_amount: Decimal
    actual_amount: Decimal
    variance: Decimal
    variance_percentage: Decimal
    status: str
    currency_code: str
    commitment_count: int
    actual_count: int

class VarianceCalculationService:
    """Service for calculating financial variances between commitments and actuals"""
    
    def __init__(self, supabase_client: Client):
        self.supabase = supabase_client
        
        # Exchange rate cache for multi-currency support
        self.exchange_rate_cache = {}
        self.cache_expiry = {}
        
        # Variance thresholds for status determination
        self.variance_thresholds = {
            'under_threshold': -5.0,  # More than 5% under budget
            'over_threshold': 5.0     # More than 5% over budget
        }

    async def calculate_all_variances(self, organization_id: Optional[str] = None, 
                                    project_ids: Optional[List[str]] = None) -> VarianceCalculationResult:
        """
        Calculate variances for all projects or specified projects
        
        Args:
            organization_id: Filter by organization (optional)
            project_ids: Specific project IDs to process (optional)
            
        Returns:
            VarianceCalculationResult with processing summary
        """
        start_time = datetime.now()
        errors = []
        warnings = []
        
        try:
            logger.info(f"Starting variance calculation for organization: {organization_id}")
            
            # Get aggregated commitment and actual data
            commitment_data = await self._get_commitment_aggregates(organization_id, project_ids)
            actual_data = await self._get_actual_aggregates(organization_id, project_ids)
            
            # Combine data by project and WBS
            combined_data = self._combine_commitment_actual_data(commitment_data, actual_data)
            
            # Calculate variances
            variance_records = []
            total_commitment = Decimal('0')
            total_actual = Decimal('0')
            
            for key, data in combined_data.items():
                project_id, wbs_element = key
                
                # Convert amounts to base currency (USD) if needed
                commitment_usd = await self._convert_to_base_currency(
                    data['commitment_amount'], data['commitment_currency']
                )
                actual_usd = await self._convert_to_base_currency(
                    data['actual_amount'], data['actual_currency']
                )
                
                # Calculate variance
                variance = actual_usd - commitment_usd
                variance_percentage = self._calculate_variance_percentage(variance, commitment_usd)
                status = self._determine_variance_status(variance_percentage)
                
                # Create variance record
                variance_record = {
                    'id': str(uuid4()),
                    'project_id': project_id,
                    'wbs_element': wbs_element,
                    'total_commitment': float(commitment_usd),
                    'total_actual': float(actual_usd),
                    'variance': float(variance),
                    'variance_percentage': float(variance_percentage),
                    'status': status,
                    'currency_code': 'USD',  # Base currency
                    'calculated_at': datetime.now().isoformat(),
                    'organization_id': organization_id
                }
                
                variance_records.append(variance_record)
                total_commitment += commitment_usd
                total_actual += actual_usd
            
            # Batch upsert variance records
            if variance_records:
                await self._upsert_variance_records(variance_records)
            
            # Calculate processing time
            end_time = datetime.now()
            processing_time_ms = int((end_time - start_time).total_seconds() * 1000)
            
            # Get unique project and WBS counts
            unique_projects = len(set(record['project_id'] for record in variance_records))
            unique_wbs = len(variance_records)
            
            logger.info(f"Variance calculation completed: {len(variance_records)} records processed")
            
            return VarianceCalculationResult(
                variances_calculated=len(variance_records),
                projects_processed=unique_projects,
                wbs_elements_processed=unique_wbs,
                total_commitment=total_commitment,
                total_actual=total_actual,
                total_variance=total_actual - total_commitment,
                calculation_time_ms=processing_time_ms,
                errors=errors,
                warnings=warnings
            )
            
        except Exception as e:
            logger.error(f"Variance calculation failed: {str(e)}")
            errors.append(f"Calculation failed: {str(e)}")
            
            return VarianceCalculationResult(
                variances_calculated=0,
                projects_processed=0,
                wbs_elements_processed=0,
                total_commitment=Decimal('0'),
                total_actual=Decimal('0'),
                total_variance=Decimal('0'),
                calculation_time_ms=0,
                errors=errors,
                warnings=warnings
            )

    async def _get_commitment_aggregates(self, organization_id: Optional[str], 
                                       project_ids: Optional[List[str]]) -> List[Dict[str, Any]]:
        """Get aggregated commitment data by project and WBS"""
        
        try:
            query = self.supabase.table('commitments')\
                .select('project, wbs_element, currency_code, total_amount')\
                .not_.is_('project', 'null')\
                .not_.is_('wbs_element', 'null')
            
            if organization_id:
                query = query.eq('organization_id', organization_id)
            
            if project_ids:
                query = query.in_('project', project_ids)
            
            result = query.execute()
            
            # Aggregate by project and WBS
            aggregates = {}
            for record in result.data:
                key = (record['project'], record['wbs_element'])
                if key not in aggregates:
                    aggregates[key] = {
                        'project_id': record['project'],
                        'wbs_element': record['wbs_element'],
                        'commitment_amount': Decimal('0'),
                        'commitment_currency': record['currency_code'] or 'USD',
                        'commitment_count': 0
                    }
                
                amount = Decimal(str(record['total_amount'] or 0))
                aggregates[key]['commitment_amount'] += amount
                aggregates[key]['commitment_count'] += 1
            
            return list(aggregates.values())
            
        except Exception as e:
            logger.error(f"Failed to get commitment aggregates: {e}")
            return []

    async def _get_actual_aggregates(self, organization_id: Optional[str], 
                                   project_ids: Optional[List[str]]) -> List[Dict[str, Any]]:
        """Get aggregated actual data by project and WBS"""
        
        try:
            query = self.supabase.table('actuals')\
                .select('project_nr, wbs, currency_code, invoice_amount')\
                .not_.is_('project_nr', 'null')\
                .not_.is_('wbs', 'null')
            
            if organization_id:
                query = query.eq('organization_id', organization_id)
            
            if project_ids:
                query = query.in_('project_nr', project_ids)
            
            result = query.execute()
            
            # Aggregate by project and WBS
            aggregates = {}
            for record in result.data:
                key = (record['project_nr'], record['wbs'])
                if key not in aggregates:
                    aggregates[key] = {
                        'project_id': record['project_nr'],
                        'wbs_element': record['wbs'],
                        'actual_amount': Decimal('0'),
                        'actual_currency': record['currency_code'] or 'USD',
                        'actual_count': 0
                    }
                
                amount = Decimal(str(record['invoice_amount'] or 0))
                aggregates[key]['actual_amount'] += amount
                aggregates[key]['actual_count'] += 1
            
            return list(aggregates.values())
            
        except Exception as e:
            logger.error(f"Failed to get actual aggregates: {e}")
            return []

    def _combine_commitment_actual_data(self, commitments: List[Dict[str, Any]], 
                                      actuals: List[Dict[str, Any]]) -> Dict[Tuple[str, str], Dict[str, Any]]:
        """Combine commitment and actual data by project and WBS"""
        
        combined = {}
        
        # Add commitment data
        for commitment in commitments:
            key = (commitment['project_id'], commitment['wbs_element'])
            combined[key] = {
                'commitment_amount': commitment['commitment_amount'],
                'commitment_currency': commitment['commitment_currency'],
                'commitment_count': commitment['commitment_count'],
                'actual_amount': Decimal('0'),
                'actual_currency': 'USD',
                'actual_count': 0
            }
        
        # Add actual data
        for actual in actuals:
            key = (actual['project_id'], actual['wbs_element'])
            if key not in combined:
                combined[key] = {
                    'commitment_amount': Decimal('0'),
                    'commitment_currency': 'USD',
                    'commitment_count': 0,
                    'actual_amount': actual['actual_amount'],
                    'actual_currency': actual['actual_currency'],
                    'actual_count': actual['actual_count']
                }
            else:
                combined[key]['actual_amount'] = actual['actual_amount']
                combined[key]['actual_currency'] = actual['actual_currency']
                combined[key]['actual_count'] = actual['actual_count']
        
        return combined

    async def _convert_to_base_currency(self, amount: Decimal, currency: str) -> Decimal:
        """Convert amount to base currency (USD) using exchange rates"""
        
        if currency == 'USD' or amount == 0:
            return amount
        
        try:
            # Check cache first
            cache_key = f"{currency}_USD"
            if (cache_key in self.exchange_rate_cache and 
                cache_key in self.cache_expiry and 
                datetime.now() < self.cache_expiry[cache_key]):
                rate = self.exchange_rate_cache[cache_key]
            else:
                # Get exchange rate from database
                result = self.supabase.table('exchange_rates')\
                    .select('rate')\
                    .eq('from_currency', currency)\
                    .eq('to_currency', 'USD')\
                    .order('updated_at', desc=True)\
                    .limit(1)\
                    .execute()
                
                if result.data:
                    rate = Decimal(str(result.data[0]['rate']))
                    # Cache for 1 hour
                    self.exchange_rate_cache[cache_key] = rate
                    self.cache_expiry[cache_key] = datetime.now() + timedelta(hours=1)
                else:
                    logger.warning(f"No exchange rate found for {currency} to USD, using 1.0")
                    rate = Decimal('1.0')
            
            return amount * rate
            
        except Exception as e:
            logger.error(f"Failed to convert {currency} to USD: {e}")
            return amount  # Return original amount if conversion fails

    def _calculate_variance_percentage(self, variance: Decimal, commitment: Decimal) -> Decimal:
        """Calculate variance percentage with proper handling of zero commitment"""
        
        if commitment == 0:
            return Decimal('0')
        
        percentage = (variance / commitment) * 100
        return percentage.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    def _determine_variance_status(self, variance_percentage: Decimal) -> str:
        """Determine variance status based on percentage thresholds"""
        
        if variance_percentage < self.variance_thresholds['under_threshold']:
            return 'under'
        elif variance_percentage > self.variance_thresholds['over_threshold']:
            return 'over'
        else:
            return 'on'

    async def _upsert_variance_records(self, variance_records: List[Dict[str, Any]]) -> None:
        """Upsert variance records into the database"""
        
        try:
            # Delete existing records for the same project/WBS combinations
            for record in variance_records:
                self.supabase.table('financial_variances')\
                    .delete()\
                    .eq('project_id', record['project_id'])\
                    .eq('wbs_element', record['wbs_element'])\
                    .execute()
            
            # Insert new records in batches
            batch_size = 100
            for i in range(0, len(variance_records), batch_size):
                batch = variance_records[i:i + batch_size]
                self.supabase.table('financial_variances').insert(batch).execute()
            
            logger.info(f"Successfully upserted {len(variance_records)} variance records")
            
        except Exception as e:
            logger.error(f"Failed to upsert variance records: {e}")
            raise

    async def get_project_variance_summary(self, project_id: str, 
                                         organization_id: Optional[str] = None) -> Optional[ProjectVarianceSummary]:
        """Get variance summary for a specific project"""
        
        try:
            query = self.supabase.table('financial_variances')\
                .select('*')\
                .eq('project_id', project_id)
            
            if organization_id:
                query = query.eq('organization_id', organization_id)
            
            result = query.execute()
            
            if not result.data:
                return None
            
            # Aggregate project-level data
            total_commitment = sum(Decimal(str(r['total_commitment'])) for r in result.data)
            total_actual = sum(Decimal(str(r['total_actual'])) for r in result.data)
            variance = total_actual - total_commitment
            variance_percentage = self._calculate_variance_percentage(variance, total_commitment)
            status = self._determine_variance_status(variance_percentage)
            
            # Get project name (assuming we have a projects table)
            project_name = project_id  # Fallback to ID if name not found
            try:
                project_result = self.supabase.table('projects')\
                    .select('name')\
                    .eq('id', project_id)\
                    .execute()
                if project_result.data:
                    project_name = project_result.data[0]['name']
            except:
                pass
            
            return ProjectVarianceSummary(
                project_id=project_id,
                project_name=project_name,
                total_commitment=total_commitment,
                total_actual=total_actual,
                variance=variance,
                variance_percentage=variance_percentage,
                status=status,
                currency_code='USD',
                wbs_count=len(result.data),
                last_updated=datetime.fromisoformat(result.data[0]['calculated_at'].replace('Z', '+00:00'))
            )
            
        except Exception as e:
            logger.error(f"Failed to get project variance summary: {e}")
            return None

    async def get_wbs_variance_details(self, project_id: str, 
                                     organization_id: Optional[str] = None) -> List[WBSVarianceDetail]:
        """Get detailed variance data for all WBS elements in a project"""
        
        try:
            query = self.supabase.table('financial_variances')\
                .select('*')\
                .eq('project_id', project_id)
            
            if organization_id:
                query = query.eq('organization_id', organization_id)
            
            result = query.execute()
            
            details = []
            for record in result.data:
                # Get WBS description from commitments or actuals
                wbs_description = record['wbs_element']  # Fallback
                try:
                    commitment_result = self.supabase.table('commitments')\
                        .select('wbs_description')\
                        .eq('project', project_id)\
                        .eq('wbs_element', record['wbs_element'])\
                        .limit(1)\
                        .execute()
                    if commitment_result.data and commitment_result.data[0]['wbs_description']:
                        wbs_description = commitment_result.data[0]['wbs_description']
                except:
                    pass
                
                details.append(WBSVarianceDetail(
                    project_id=record['project_id'],
                    wbs_element=record['wbs_element'],
                    wbs_description=wbs_description,
                    commitment_amount=Decimal(str(record['total_commitment'])),
                    actual_amount=Decimal(str(record['total_actual'])),
                    variance=Decimal(str(record['variance'])),
                    variance_percentage=Decimal(str(record['variance_percentage'])),
                    status=record['status'],
                    currency_code=record['currency_code'],
                    commitment_count=0,  # Would need additional query to get counts
                    actual_count=0
                ))
            
            return details
            
        except Exception as e:
            logger.error(f"Failed to get WBS variance details: {e}")
            return []

    async def schedule_variance_recalculation(self, interval_hours: int = 24) -> None:
        """Schedule automatic variance recalculation"""
        
        logger.info(f"Starting scheduled variance recalculation (every {interval_hours} hours)")
        
        while True:
            try:
                logger.info("Running scheduled variance calculation...")
                result = await self.calculate_all_variances()
                
                logger.info(f"Scheduled calculation completed: {result.variances_calculated} variances calculated")
                
                # Wait for next interval
                await asyncio.sleep(interval_hours * 3600)
                
            except Exception as e:
                logger.error(f"Scheduled variance calculation failed: {e}")
                # Wait 1 hour before retrying on error
                await asyncio.sleep(3600)

    async def get_variance_trends(self, project_id: str, days: int = 30) -> List[Dict[str, Any]]:
        """Get variance trends over time for a project"""
        
        try:
            # This would require historical variance data
            # For now, return current variance as a single point
            summary = await self.get_project_variance_summary(project_id)
            
            if summary:
                return [{
                    'date': summary.last_updated.isoformat(),
                    'variance': float(summary.variance),
                    'variance_percentage': float(summary.variance_percentage),
                    'status': summary.status
                }]
            
            return []
            
        except Exception as e:
            logger.error(f"Failed to get variance trends: {e}")
            return []