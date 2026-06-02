import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/admin/components/ui/card';
import { Button } from '@/admin/components/ui/button';
import { Label } from '@/admin/components/ui/label';
import { Badge } from '@/admin/components/ui/badge';
import { Switch } from '@/admin/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/admin/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/admin/components/ui/table';
import { Separator } from '@/admin/components/ui/separator';
import { Input } from '@/admin/components/ui/input';
import { Database, Download, RefreshCcw, Check, AlertCircle, Calendar, Clock, Loader2, Trash2, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { backupApi } from '@/admin/utils/api';

/**
 * Trigger a JSON file download in the browser.
 * Files are named with "RMS-Backup_" prefix so users can easily identify them
 * when saving into an "RMS Backup" folder.
 */
function triggerJsonDownload(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}


// ─── Types ───────────────────────────────────────────────────────────────────

interface Backup {
  _id: string;
  name: string;
  size: string;
  date: string;
  time: string;
  status: 'completed' | 'failed' | 'in_progress';
  type: 'manual' | 'automatic' | 'uploaded';
  documentCounts?: Record<string, number>;
  totalDocuments?: number;
  collections?: string[];
}

interface BackupConfig {
  autoBackupEnabled: boolean;
  frequency: string;
  backupTime: string;
  retentionDays: number;
  backupLocation: string;
  googleDriveEnabled: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BackupRecovery() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [config, setConfig] = useState<BackupConfig>({
    autoBackupEnabled: true,
    frequency: 'daily',
    backupTime: '02:00',
    retentionDays: 30,
    backupLocation: 'local',
    googleDriveEnabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Fetch helpers ──────────────────────────────────────────────────────
  const fetchBackups = useCallback(async () => {
    try {
      const data = await backupApi.list();
      const list: Backup[] = (Array.isArray(data) ? data : []).map((b: any) => ({
        _id: b._id || b.id,
        name: b.name,
        size: b.size || 'N/A',
        date: b.date,
        time: b.time,
        status: b.status || 'completed',
        type: b.type || 'manual',
        documentCounts: b.documentCounts,
        totalDocuments: b.totalDocuments,
        collections: b.collections,
      }));
      setBackups(list);
      return list;
    } catch (err) {
      console.error('Failed to fetch backups', err);
      return null;
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const data = await backupApi.getConfig();
      if (data) {
        setConfig({
          autoBackupEnabled: data.autoBackupEnabled ?? true,
          frequency: data.frequency ?? 'daily',
          backupTime: data.backupTime ?? '02:00',
          retentionDays: data.retentionDays ?? 30,
          backupLocation: data.backupLocation ?? 'local',
          googleDriveEnabled: data.googleDriveEnabled ?? false,
        });
      }
    } catch (err) {
      console.error('Failed to fetch backup config', err);
    }
  }, []);

  // ─── Initial load ───────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      await Promise.all([fetchConfig(), fetchBackups()]);
      setLoading(false);
    })();
  }, [fetchConfig, fetchBackups]);

  // ─── Actions ────────────────────────────────────────────────────────────
  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    try {
      await backupApi.create({ type: 'manual' });
      await fetchBackups();
      toast.success('Backup created successfully!');
    } catch (error) {
      console.error('Failed to create backup:', error);
      toast.error('Failed to create backup');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleRestoreBackup = async (backupId: string) => {
    if (!window.confirm('Restoring will overwrite ALL current data with the backup. Continue?')) return;
    setRestoringId(backupId);
    try {
      const result = await backupApi.restore(backupId);
      if (result?.success) {
        toast.success(result.message || 'Backup restored successfully!');
      } else {
        toast.error('Restore failed');
      }
    } catch (error: any) {
      console.error('Failed to restore backup:', error);
      toast.error(error?.message || 'Failed to restore backup');
    } finally {
      setRestoringId(null);
    }
  };

  const handleDownloadBackup = async (backup: Backup) => {
    setDownloadingId(backup._id);
    try {
      const data = await backupApi.downloadData(backup._id);
      const filename = `RMS-Backup_${backup.date}_${backup.time.replace(/:/g, '-')}.json`;
      triggerJsonDownload(data, filename);
      toast.success('Backup file downloaded');
    } catch (error) {
      console.error('Failed to download backup:', error);
      toast.error('Failed to download backup');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    if (!window.confirm('Delete this backup permanently?')) return;
    try {
      await backupApi.delete(backupId);
      setBackups(prev => prev.filter(b => b._id !== backupId));
      toast.success('Backup deleted');
    } catch (error) {
      console.error('Failed to delete backup:', error);
      toast.error('Failed to delete backup');
    }
  };

  // ─── Load backup from file ───────────────────────────────────────────────
  const handleLoadFromFile = () => fileInputRef.current?.click();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      // Accept both {backupInfo, collections, data} and bare {collectionName: [...]}
      const payload = parsed.data ? parsed : { data: parsed, collections: Object.keys(parsed) };
      const result = await backupApi.uploadFile(payload);
      if (result?.success) {
        toast.success('Backup file loaded. You can now Restore it from the history below.');
        await fetchBackups();
      } else {
        toast.error('Failed to register backup file');
      }
    } catch (err) {
      console.error('Error loading backup file:', err);
      toast.error('Invalid backup file format');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ─── Save config ─────────────────────────────────────────────────────────
  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await backupApi.updateConfig({
        autoBackupEnabled: config.autoBackupEnabled,
        frequency: config.frequency,
        backupTime: config.backupTime,
        retentionDays: config.retentionDays,
        backupLocation: config.backupLocation,
        googleDriveEnabled: config.googleDriveEnabled,
      });
      toast.success('Backup configuration saved! Scheduler updated.');
    } catch (error) {
      console.error('Failed to save config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  // ─── UI helpers ──────────────────────────────────────────────────────────
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-green-500">
            <Check className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-500">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge className="bg-blue-500">
            <RefreshCcw className="h-3 w-3 mr-1 animate-spin" />
            In Progress
          </Badge>
        );
    }
  };

  const nextScheduledLabel = () => {
    if (!config.autoBackupEnabled) return 'Disabled';
    if (config.frequency === 'hourly') return 'Every hour';
    return `Next ${config.frequency} at ${config.backupTime}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-2 sm:p-3">
      {/* Hidden file input for loading backup files */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Backup Actions + Config */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-black">Backup Actions</CardTitle>
                <CardDescription className="text-black">Create and manage backups</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleCreateBackup}
              className="w-full"
              size="lg"
              disabled={isCreatingBackup}
            >
              {isCreatingBackup ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Database className="h-5 w-5 mr-2" />
              )}
              {isCreatingBackup ? 'Creating Backup...' : 'Create Backup Now'}
            </Button>

            {/* Load backup from a previously downloaded file */}
            <Button onClick={handleLoadFromFile} variant="outline" className="w-full" size="lg">
              <FolderOpen className="h-5 w-5 mr-2" />
              Load Backup from File
            </Button>

            <Separator />

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-0.5">
                <Label>Automatic Backups</Label>
                <p className="text-xs text-muted-foreground">
                  Enable scheduled backups — auto-downloaded when each backup runs
                </p>
              </div>
              <Switch
                checked={config.autoBackupEnabled}
                onCheckedChange={(checked) => setConfig({ ...config, autoBackupEnabled: checked })}
              />
            </div>

            {config.autoBackupEnabled && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="backup-frequency">Backup Frequency</Label>
                  <Select
                    value={config.frequency}
                    onValueChange={(value) => setConfig({ ...config, frequency: value })}
                  >
                    <SelectTrigger id="backup-frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Every Hour</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly (Sunday)</SelectItem>
                      <SelectItem value="monthly">Monthly (1st)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {config.frequency !== 'hourly' && (
                  <div className="space-y-2">
                    <Label htmlFor="backup-time">Backup Time</Label>
                    <Input
                      id="backup-time"
                      type="time"
                      value={config.backupTime}
                      onChange={(e) => setConfig({ ...config, backupTime: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      File is auto-downloaded to your browser — save it in an &quot;RMS Backup&quot; folder.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="retention">Retention Period (Days)</Label>
                  <Select
                    value={config.retentionDays.toString()}
                    onValueChange={(value) => setConfig({ ...config, retentionDays: parseInt(value) })}
                  >
                    <SelectTrigger id="retention">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 Days</SelectItem>
                      <SelectItem value="15">15 Days</SelectItem>
                      <SelectItem value="30">30 Days</SelectItem>
                      <SelectItem value="60">60 Days</SelectItem>
                      <SelectItem value="90">90 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <Separator />

            <Button onClick={handleSaveConfig} className="w-full" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Configuration
            </Button>
          </CardContent>
        </Card>

        {/* Backup Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              <div>
                <CardTitle className="text-black">Backup Status</CardTitle>
                <CardDescription className="text-black">Latest backup information</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-4 border rounded-lg bg-green-50 dark:bg-green-950">
              <div className="p-2 bg-green-500 rounded-lg">
                <Check className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-green-800 dark:text-green-200">
                  {backups.length > 0 ? 'Last Backup Successful' : 'No Backups Yet'}
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {backups.length > 0 ? `${backups[0].date} at ${backups[0].time}` : '—'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Next Scheduled</span>
                </div>
                <span className="font-medium text-sm">{nextScheduledLabel()}</span>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Retention Period</span>
                </div>
                <span className="font-medium">{config.retentionDays} Days</span>
              </div>

              <div className="p-3 border rounded-lg bg-blue-50 text-xs text-blue-700">
                <p className="font-medium mb-1">Auto-backup flow:</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Scheduler runs on the server at the set time</li>
                  <li>Backup is saved to the database</li>
                  <li>File is auto-downloaded to your browser</li>
                  <li>Save the file in an <strong>RMS Backup</strong> folder</li>
                  <li>Use <em>Load Backup from File</em> to restore later</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Backup History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-black">Backup History</CardTitle>
                <CardDescription className="text-black">Previous backups available for restore</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={fetchBackups}>
              <RefreshCcw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Backup Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Docs</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No backups found. Create one now or wait for the automatic backup.
                  </TableCell>
                </TableRow>
              ) : (
                backups.map(backup => (
                  <TableRow key={backup._id}>
                    <TableCell className="font-medium">{backup.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {backup.type === 'manual' ? 'Manual' : backup.type === 'uploaded' ? 'Uploaded' : 'Auto'}
                      </Badge>
                    </TableCell>
                    <TableCell>{backup.size}</TableCell>
                    <TableCell>{backup.date}</TableCell>
                    <TableCell>{backup.time}</TableCell>
                    <TableCell>{backup.totalDocuments ?? '—'}</TableCell>
                    <TableCell>{getStatusBadge(backup.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRestoreBackup(backup._id)}
                          disabled={backup.status !== 'completed' || restoringId === backup._id}
                          title="Restore"
                        >
                          {restoringId === backup._id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCcw className="h-4 w-4" />
                          )}
                          <span className="ml-1 hidden sm:inline">Restore</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadBackup(backup)}
                          disabled={backup.status !== 'completed' || downloadingId === backup._id}
                          title="Download"
                        >
                          {downloadingId === backup._id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteBackup(backup._id)}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
