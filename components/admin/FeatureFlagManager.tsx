'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Flag, Plus, Edit, Trash2, Users, Percent, List, Globe } from 'lucide-react';

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  status: 'enabled' | 'disabled' | 'beta' | 'deprecated';
  rollout_strategy: 'all_users' | 'percentage' | 'user_list' | 'role_based';
  rollout_percentage?: number;
  allowed_user_ids?: string[];
  allowed_roles?: string[];
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export default function FeatureFlagManager() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);

  useEffect(() => {
    loadFeatureFlags();
  }, []);

  const loadFeatureFlags = async () => {
    try {
      const response = await fetch('/api/admin/feature-flags');
      if (response.ok) {
        const data = await response.json();
        setFlags(data);
      }
    } catch (error) {
      console.error('Failed to load feature flags:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (flag: FeatureFlag) => {
    const newStatus = flag.status === 'enabled' ? 'disabled' : 'enabled';
    
    try {
      const response = await fetch(`/api/admin/feature-flags/${flag.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        await loadFeatureFlags();
      }
    } catch (error) {
      console.error('Failed to toggle feature flag:', error);
    }
  };

  const handleDeleteFlag = async (flagId: string) => {
    if (!confirm('Are you sure you want to delete this feature flag?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/feature-flags/${flagId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadFeatureFlags();
      }
    } catch (error) {
      console.error('Failed to delete feature flag:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      enabled: 'default',
      disabled: 'secondary',
      beta: 'outline',
      deprecated: 'destructive',
    };

    return (
      <Badge variant={variants[status] || 'default'}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const getStrategyIcon = (strategy: string) => {
    switch (strategy) {
      case 'all_users':
        return <Globe className="h-4 w-4" />;
      case 'percentage':
        return <Percent className="h-4 w-4" />;
      case 'user_list':
        return <List className="h-4 w-4" />;
      case 'role_based':
        return <Users className="h-4 w-4" />;
      default:
        return <Flag className="h-4 w-4" />;
    }
  };

  const getStrategyLabel = (strategy: string) => {
    const labels: Record<string, string> = {
      all_users: 'All Users',
      percentage: 'Percentage Rollout',
      user_list: 'User List',
      role_based: 'Role-Based',
    };
    return labels[strategy] || strategy;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading feature flags...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Feature Flags</h2>
          <p className="text-muted-foreground">
            Manage feature rollout and user access control
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Feature Flag
        </Button>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-2xl">
            <FeatureFlagForm
              onSuccess={() => {
                setIsCreateDialogOpen(false);
                loadFeatureFlags();
              }}
              onCancel={() => setIsCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {flags.map((flag) => (
          <Card key={flag.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{flag.name}</CardTitle>
                    {getStatusBadge(flag.status)}
                  </div>
                  <CardDescription>{flag.description}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={flag.status === 'enabled'}
                    onCheckedChange={() => handleToggleStatus(flag)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingFlag(flag)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteFlag(flag.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  {getStrategyIcon(flag.rollout_strategy)}
                  <span>{getStrategyLabel(flag.rollout_strategy)}</span>
                </div>
                {flag.rollout_strategy === 'percentage' && flag.rollout_percentage && (
                  <div>Rollout: {flag.rollout_percentage}%</div>
                )}
                {flag.rollout_strategy === 'role_based' && flag.allowed_roles && (
                  <div>Roles: {flag.allowed_roles.join(', ')}</div>
                )}
                {flag.rollout_strategy === 'user_list' && flag.allowed_user_ids && (
                  <div>Users: {flag.allowed_user_ids.length}</div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {flags.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Flag className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No feature flags configured</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              Create your first feature flag
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={editingFlag !== null} onOpenChange={(open) => !open && setEditingFlag(null)}>
        <DialogContent className="max-w-2xl">
          {editingFlag && (
            <FeatureFlagForm
              flag={editingFlag}
              onSuccess={() => { setEditingFlag(null); loadFeatureFlags(); }}
              onCancel={() => setEditingFlag(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface FeatureFlagFormProps {
  flag?: FeatureFlag;
  onSuccess: () => void;
  onCancel: () => void;
}

function FeatureFlagForm({ flag, onSuccess, onCancel }: FeatureFlagFormProps) {
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    status: 'enabled' | 'disabled' | 'beta' | 'deprecated';
    rollout_strategy: 'all_users' | 'percentage' | 'user_list' | 'role_based';
    rollout_percentage: number;
    allowed_roles: string;
  }>({
    name: flag?.name || '',
    description: flag?.description || '',
    status: flag?.status || 'disabled',
    rollout_strategy: flag?.rollout_strategy || 'all_users',
    rollout_percentage: flag?.rollout_percentage || 0,
    allowed_roles: flag?.allowed_roles?.join(', ') || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      ...formData,
      rollout_percentage: formData.rollout_strategy === 'percentage' ? formData.rollout_percentage : null,
      allowed_roles: formData.rollout_strategy === 'role_based' 
        ? formData.allowed_roles.split(',').map(r => r.trim()).filter(Boolean)
        : null,
    };

    try {
      const url = flag
        ? `/api/admin/feature-flags/${flag.id}`
        : '/api/admin/feature-flags';
      
      const response = await fetch(url, {
        method: flag ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        onSuccess();
      }
    } catch (error) {
      console.error('Failed to save feature flag:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{flag ? 'Edit' : 'Create'} Feature Flag</DialogTitle>
        <DialogDescription>
          Configure feature rollout and access control settings
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="name">Feature Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., shareable_urls"
            disabled={!!flag}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            value={formData.description}
            onChange={(value) => setFormData({ ...formData, description: value })}
            placeholder="Describe what this feature does"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.status}
            onChange={(value) => setFormData({ ...formData, status: value as 'enabled' | 'disabled' | 'beta' | 'deprecated' })}
            options={[
              { value: 'enabled', label: 'Enabled' },
              { value: 'disabled', label: 'Disabled' },
              { value: 'beta', label: 'Beta' },
              { value: 'deprecated', label: 'Deprecated' },
            ]}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="rollout_strategy">Rollout Strategy</Label>
          <Select
            value={formData.rollout_strategy}
            onChange={(value) => setFormData({ ...formData, rollout_strategy: value as 'all_users' | 'percentage' | 'user_list' | 'role_based' })}
            options={[
              { value: 'all_users', label: 'All Users' },
              { value: 'percentage', label: 'Percentage Rollout' },
              { value: 'user_list', label: 'User List' },
              { value: 'role_based', label: 'Role-Based' },
            ]}
          />
        </div>

        {formData.rollout_strategy === 'percentage' && (
          <div className="space-y-2">
            <Label htmlFor="rollout_percentage">Rollout Percentage</Label>
            <Input
              id="rollout_percentage"
              type="number"
              min="0"
              max="100"
              value={formData.rollout_percentage}
              onChange={(e) => setFormData({ ...formData, rollout_percentage: parseInt(e.target.value) })}
            />
          </div>
        )}

        {formData.rollout_strategy === 'role_based' && (
          <div className="space-y-2">
            <Label htmlFor="allowed_roles">Allowed Roles (comma-separated)</Label>
            <Input
              id="allowed_roles"
              value={formData.allowed_roles}
              onChange={(e) => setFormData({ ...formData, allowed_roles: e.target.value })}
              placeholder="e.g., admin, project_manager"
            />
          </div>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {flag ? 'Update' : 'Create'} Feature Flag
        </Button>
      </DialogFooter>
    </form>
  );
}
