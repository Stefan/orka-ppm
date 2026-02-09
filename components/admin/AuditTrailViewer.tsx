/**
 * Audit Trail Viewer Component
 * 
 * Displays comprehensive audit logs for role and permission changes.
 * Provides filtering, pagination, and detailed view of audit events.
 * 
 * Requirements: 4.5 - Audit trail viewing interface for administrators
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/Table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  User,
  Shield,
  AlertCircle,
  CheckCircle,
  XCircle,
  Eye
} from 'lucide-react';

interface AuditLog {
  id: string;
  organization_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: {
    target_user_id?: string;
    role_id?: string;
    role_name?: string;
    scope_type?: string;
    scope_id?: string;
    permissions?: string[];
    added_permissions?: string[];
    removed_permissions?: string[];
    old_permissions?: string[];
    new_permissions?: string[];
    old_description?: string;
    new_description?: string;
    affected_users?: number;
    error_message?: string;
  };
  success: boolean;
  created_at: string;
}

interface AuditLogListResponse {
  logs: AuditLog[];
  total_count: number;
  page: number;
  per_page: number;
  total_pages: number;
}

const ACTION_LABELS: Record<string, string> = {
  role_assignment_created: 'Role Assigned',
  role_assignment_removed: 'Role Removed',
  custom_role_created: 'Custom Role Created',
  custom_role_updated: 'Custom Role Updated',
  custom_role_deleted: 'Custom Role Deleted',
};

const ACTION_COLORS: Record<string, string> = {
  role_assignment_created: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
  role_assignment_removed: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
  custom_role_created: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  custom_role_updated: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
  custom_role_deleted: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
};

export default function AuditTrailViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [perPage] = useState(20);
  
  // Filter state
  const [filters, setFilters] = useState({
    action: '',
    role_name: '',
    target_user_id: '',
    start_date: '',
    end_date: '',
  });
  
  const [appliedFilters, setAppliedFilters] = useState(filters);

  useEffect(() => {
    fetchAuditLogs();
  }, [currentPage, appliedFilters]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const offset = (currentPage - 1) * perPage;
      const params = new URLSearchParams({
        limit: perPage.toString(),
        offset: offset.toString(),
      });
      
      // Add filters if set
      if (appliedFilters.action) params.append('action', appliedFilters.action);
      if (appliedFilters.role_name) params.append('role_name', appliedFilters.role_name);
      if (appliedFilters.target_user_id) params.append('target_user_id', appliedFilters.target_user_id);
      if (appliedFilters.start_date) params.append('start_date', appliedFilters.start_date);
      if (appliedFilters.end_date) params.append('end_date', appliedFilters.end_date);
      
      const response = await fetch(`/api/rbac/audit/role-changes?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }
      
      const data: AuditLogListResponse = await response.json();
      setLogs(data.logs);
      setTotalPages(data.total_pages);
      setTotalCount(data.total_count);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    setAppliedFilters(filters);
    setCurrentPage(1); // Reset to first page when applying filters
  };

  const handleClearFilters = () => {
    const emptyFilters = {
      action: '',
      role_name: '',
      target_user_id: '',
      start_date: '',
      end_date: '',
    };
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setCurrentPage(1);
  };

  const handleViewDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setShowDetails(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionIcon = (action: string) => {
    if (action.includes('created') || action.includes('assignment_created')) {
      return <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />;
    } else if (action.includes('removed') || action.includes('deleted')) {
      return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
    } else if (action.includes('updated')) {
      return <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
    }
    return <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role & Permission Audit Trail
          </CardTitle>
          <CardDescription>
            Comprehensive audit log of all role and permission changes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters Section */}
          <div className="mb-6 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="h-4 w-4" />
              <h3 className="text-sm font-medium">Filters</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="action-filter">Action Type</Label>
                <Select
                  value={filters.action}
                  onValueChange={(value) => setFilters({ ...filters, action: value })}
                >
                  <SelectTrigger id="action-filter">
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All actions</SelectItem>
                    <SelectItem value="role_assignment_created">Role Assigned</SelectItem>
                    <SelectItem value="role_assignment_removed">Role Removed</SelectItem>
                    <SelectItem value="custom_role_created">Custom Role Created</SelectItem>
                    <SelectItem value="custom_role_updated">Custom Role Updated</SelectItem>
                    <SelectItem value="custom_role_deleted">Custom Role Deleted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="role-filter">Role Name</Label>
                <Input
                  id="role-filter"
                  placeholder="Filter by role name"
                  value={filters.role_name}
                  onChange={(e) => setFilters({ ...filters, role_name: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="user-filter">User ID</Label>
                <Input
                  id="user-filter"
                  placeholder="Filter by user ID"
                  value={filters.target_user_id}
                  onChange={(e) => setFilters({ ...filters, target_user_id: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={handleApplyFilters} size="sm">
                <Search className="h-4 w-4 mr-2" />
                Apply Filters
              </Button>
              <Button onClick={handleClearFilters} variant="outline" size="sm">
                Clear Filters
              </Button>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Audit Logs Table */}
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">Loading audit logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-slate-400">
              <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No audit logs found</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3 text-gray-400 dark:text-slate-500" />
                            {formatDate(log.created_at)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getActionIcon(log.action)}
                            <Badge className={ACTION_COLORS[log.action] || 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200'}>
                              {ACTION_LABELS[log.action] || log.action}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{log.details.role_name || 'N/A'}</span>
                          {log.details.scope_type && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              {log.details.scope_type}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.success ? (
                            <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 border-green-200 dark:border-green-800">
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-50 dark:bg-red-900/20 text-red-700 border-red-200 dark:border-red-800">
                              Failed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 dark:text-slate-400">
                          {log.details.target_user_id && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span className="truncate max-w-[150px]">
                                {log.details.target_user_id.substring(0, 8)}...
                              </span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(log)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-600 dark:text-slate-400">
                  Showing {((currentPage - 1) * perPage) + 1} to {Math.min(currentPage * perPage, totalCount)} of {totalCount} entries
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
            <DialogDescription>
              Complete information about this audit event
            </DialogDescription>
          </DialogHeader>
          
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500 dark:text-slate-400">Timestamp</Label>
                  <p className="text-sm font-mono">{formatDate(selectedLog.created_at)}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500 dark:text-slate-400">Action</Label>
                  <p className="text-sm">
                    <Badge className={ACTION_COLORS[selectedLog.action]}>
                      {ACTION_LABELS[selectedLog.action] || selectedLog.action}
                    </Badge>
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500 dark:text-slate-400">Status</Label>
                  <p className="text-sm">
                    {selectedLog.success ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700">Success</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-50 text-red-700">Failed</Badge>
                    )}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500 dark:text-slate-400">Entity Type</Label>
                  <p className="text-sm font-medium">{selectedLog.entity_type}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <Label className="text-xs text-gray-500 dark:text-slate-400 mb-2 block">Event Details</Label>
                <div className="space-y-2 bg-gray-50 dark:bg-slate-800/50 p-4 rounded-md">
                  {selectedLog.details.role_name && (
                    <div>
                      <span className="text-xs font-medium">Role Name:</span>
                      <span className="text-sm ml-2">{selectedLog.details.role_name}</span>
                    </div>
                  )}
                  {selectedLog.details.target_user_id && (
                    <div>
                      <span className="text-xs font-medium">Target User:</span>
                      <span className="text-sm ml-2 font-mono">{selectedLog.details.target_user_id}</span>
                    </div>
                  )}
                  {selectedLog.details.scope_type && (
                    <div>
                      <span className="text-xs font-medium">Scope:</span>
                      <span className="text-sm ml-2">{selectedLog.details.scope_type}</span>
                    </div>
                  )}
                  {selectedLog.details.added_permissions && selectedLog.details.added_permissions.length > 0 && (
                    <div>
                      <span className="text-xs font-medium">Added Permissions:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedLog.details.added_permissions.map((perm, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs bg-green-50">
                            {perm}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedLog.details.removed_permissions && selectedLog.details.removed_permissions.length > 0 && (
                    <div>
                      <span className="text-xs font-medium">Removed Permissions:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedLog.details.removed_permissions.map((perm, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs bg-red-50">
                            {perm}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedLog.details.permissions && selectedLog.details.permissions.length > 0 && (
                    <div>
                      <span className="text-xs font-medium">Permissions:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedLog.details.permissions.map((perm, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {perm}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedLog.details.affected_users !== undefined && (
                    <div>
                      <span className="text-xs font-medium">Affected Users:</span>
                      <span className="text-sm ml-2">{selectedLog.details.affected_users}</span>
                    </div>
                  )}
                  {selectedLog.details.error_message && (
                    <div>
                      <span className="text-xs font-medium text-red-600 dark:text-red-400">Error:</span>
                      <p className="text-sm ml-2 text-red-600 dark:text-red-400">{selectedLog.details.error_message}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t pt-4">
                <Label className="text-xs text-gray-500 dark:text-slate-400 mb-2 block">Raw Data</Label>
                <pre className="text-xs bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto">
                  {JSON.stringify(selectedLog, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
