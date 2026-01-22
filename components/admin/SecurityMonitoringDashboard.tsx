'use client';

/**
 * Security Monitoring Dashboard Component
 * 
 * Provides admin interface for monitoring share link security,
 * reviewing alerts, and taking action on suspicious activity.
 * 
 * Requirements: 4.4
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  Activity,
  Ban,
} from 'lucide-react';

interface SecurityAlert {
  id: string;
  share_id: string;
  alert_type: string;
  ip_address: string;
  threat_score: number;
  suspicious_reasons: Array<{
    type: string;
    description: string;
    severity: string;
  }>;
  country_code?: string;
  city?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending_review' | 'under_review' | 'resolved' | 'dismissed';
  created_at: string;
}

interface DashboardData {
  period: {
    start_date: string;
    end_date: string;
    days: number;
  };
  alert_summary: {
    total_alerts: number;
    by_status: Record<string, number>;
    by_severity: Record<string, number>;
  };
  event_summary: {
    total_events: number;
    threat_trend: Array<{
      date: string;
      count: number;
      average_score: number;
    }>;
  };
  top_suspicious_ips: Array<{
    ip_address: string;
    event_count: number;
  }>;
}

interface SecurityMonitoringDashboardProps {
  apiBaseUrl?: string;
}

export default function SecurityMonitoringDashboard({
  apiBaseUrl = '/api',
}: SecurityMonitoringDashboardProps) {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('pending_review');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [dashboardDays, setDashboardDays] = useState<number>(7);
  
  // Dialog state
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [resolution, setResolution] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [resolving, setResolving] = useState(false);

  // Fetch dashboard data
  useEffect(() => {
    fetchDashboardData();
  }, [dashboardDays]);

  // Fetch alerts
  useEffect(() => {
    fetchAlerts();
  }, [statusFilter, severityFilter]);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch(
        `${apiBaseUrl}/admin/security/dashboard?days=${dashboardDays}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const data = await response.json();
      setDashboardData(data);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data');
    }
  };

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      
      if (severityFilter !== 'all') {
        params.append('severity', severityFilter);
      }

      const response = await fetch(
        `${apiBaseUrl}/admin/security/alerts?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch alerts');
      }

      const data = await response.json();
      setAlerts(data.alerts || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching alerts:', err);
      setError('Failed to load security alerts');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveAlert = async () => {
    if (!selectedAlert || !resolution) {
      return;
    }

    try {
      setResolving(true);
      const response = await fetch(
        `${apiBaseUrl}/admin/security/alerts/${selectedAlert.id}/resolve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            resolution,
            action_taken: actionTaken || undefined,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to resolve alert');
      }

      // Refresh alerts
      await fetchAlerts();
      await fetchDashboardData();

      // Close dialog
      setShowResolveDialog(false);
      setSelectedAlert(null);
      setResolution('');
      setActionTaken('');
    } catch (err) {
      console.error('Error resolving alert:', err);
      setError('Failed to resolve alert');
    } finally {
      setResolving(false);
    }
  };

  const handleSuspendLink = async (shareId: string) => {
    if (!confirm('Are you sure you want to suspend this share link?')) {
      return;
    }

    try {
      const reason = prompt('Enter reason for suspension:');
      if (!reason) {
        return;
      }

      const response = await fetch(
        `${apiBaseUrl}/admin/security/shares/${shareId}/suspend`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ reason }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to suspend share link');
      }

      alert('Share link suspended successfully');
      await fetchAlerts();
      await fetchDashboardData();
    } catch (err) {
      console.error('Error suspending share link:', err);
      alert('Failed to suspend share link');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="h-4 w-4" />;
      case 'medium':
        return <Activity className="h-4 w-4" />;
      case 'low':
        return <Shield className="h-4 w-4" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Security Monitoring</h1>
          <p className="text-muted-foreground">
            Monitor and manage share link security alerts
          </p>
        </div>
        <Select
          value={dashboardDays.toString()}
          onValueChange={(value) => setDashboardDays(parseInt(value))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Dashboard Summary Cards */}
      {dashboardData && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData.alert_summary.total_alerts}
              </div>
              <p className="text-xs text-muted-foreground">
                Last {dashboardData.period.days} days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData.alert_summary.by_status.pending_review || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Requires attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData.alert_summary.by_severity.critical || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                High priority
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Security Events</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData.event_summary.total_events}
              </div>
              <p className="text-xs text-muted-foreground">
                Detected events
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alerts Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Security Alerts</CardTitle>
              <CardDescription>
                Review and manage suspicious activity alerts
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending_review">Pending Review</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading alerts...</div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No security alerts found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Threat Score</TableHead>
                  <TableHead>Reasons</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell>
                      <Badge className={getSeverityColor(alert.severity)}>
                        <span className="flex items-center gap-1">
                          {getSeverityIcon(alert.severity)}
                          {alert.severity}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {alert.ip_address}
                    </TableCell>
                    <TableCell>
                      {alert.city && alert.country_code
                        ? `${alert.city}, ${alert.country_code}`
                        : alert.country_code || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{alert.threat_score}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {alert.suspicious_reasons.length} reason(s)
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{alert.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(alert.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedAlert(alert);
                            setShowResolveDialog(true);
                          }}
                          disabled={alert.status === 'resolved'}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Resolve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleSuspendLink(alert.share_id)}
                        >
                          <Ban className="h-4 w-4 mr-1" />
                          Suspend
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Resolve Alert Dialog */}
      <Dialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Security Alert</DialogTitle>
            <DialogDescription>
              Provide details about how this alert was resolved
            </DialogDescription>
          </DialogHeader>

          {selectedAlert && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Alert Details</div>
                <div className="text-sm text-muted-foreground">
                  <div>IP: {selectedAlert.ip_address}</div>
                  <div>Threat Score: {selectedAlert.threat_score}</div>
                  <div>Severity: {selectedAlert.severity}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Suspicious Reasons</div>
                <ul className="text-sm text-muted-foreground list-disc list-inside">
                  {selectedAlert.suspicious_reasons.map((reason, index) => (
                    <li key={index}>{reason.description}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Resolution *</label>
                <Textarea
                  placeholder="Describe how this alert was resolved..."
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Action Taken</label>
                <Select value={actionTaken} onValueChange={setActionTaken}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select action taken" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false_positive">False Positive</SelectItem>
                    <SelectItem value="link_suspended">Link Suspended</SelectItem>
                    <SelectItem value="ip_blocked">IP Blocked</SelectItem>
                    <SelectItem value="monitoring">Under Monitoring</SelectItem>
                    <SelectItem value="no_action">No Action Required</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowResolveDialog(false);
                setSelectedAlert(null);
                setResolution('');
                setActionTaken('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleResolveAlert}
              disabled={!resolution || resolving}
            >
              {resolving ? 'Resolving...' : 'Resolve Alert'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
