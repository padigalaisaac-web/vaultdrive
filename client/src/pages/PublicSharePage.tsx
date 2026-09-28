import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Lock, AlertCircle, FileText, Globe } from 'lucide-react';
import { shareService } from '../services/storageService.js';
import { formatBytes } from '../utils/formatters.js';
import { getPreviewType } from '../utils/mime.js';
import { FileIcon } from '../components/FileIcon.js';
import { Button, Input, Spinner } from '../components/ui/index.js';

export const PublicSharePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [shareData, setShareData] = useState<any | null>(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchShare = async (pwd?: string) => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await shareService.getPublicShare(token, pwd);
      setShareData(data);
      setRequiresPassword(false);
    } catch (err: any) {
      if (err.requiresPassword) {
        setRequiresPassword(true);
      } else {
        setError(err.message || 'Shared link is invalid or expired.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchShare();
  }, [token]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password) fetchShare(password);
  };

  const handleDownload = () => {
    if (!token) return;
    const downloadUrl = `${shareService.getPublicDownloadUrl(token)}${
      password ? `?password=${encodeURIComponent(password)}` : ''
    }`;
    window.open(downloadUrl, '_blank');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <Spinner size="lg" />
        <p className="text-sm text-slate-400 mt-3">Loading shared content…</p>
      </div>
    );
  }

  if (requiresPassword) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm card p-6 border-slate-800 shadow-2xl text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-amber-400" />
          </div>
          <h2 className="text-lg font-bold text-slate-100">Password Protected</h2>
          <p className="text-xs text-slate-400 mt-1 mb-4">
            Enter the password to access this shared file.
          </p>

          {error && (
            <p className="text-xs text-red-400 mb-3">{error}</p>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            <Input
              type="password"
              placeholder="Enter password…"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
            <Button variant="primary" type="submit" className="w-full justify-center">
              Unlock
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (error || !shareData) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm card p-6 border-slate-800 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-100">Link Unavailable</h2>
          <p className="text-xs text-slate-400 mt-1">{error || 'This link may have expired or been revoked.'}</p>
        </div>
      </div>
    );
  }

  const { file, folder, allow_download } = shareData;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-900/80">
        <div className="flex items-center gap-2.5">
          <img src="/favicon.svg" alt="VaultDrive" className="w-6 h-6 invert" />
          <span className="font-bold text-slate-100">VaultDrive</span>
          <span className="text-xs text-slate-500 font-medium ml-2">Shared via link</span>
        </div>

        {file && allow_download && (
          <Button
            variant="primary"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            onClick={handleDownload}
          >
            Download File
          </Button>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-2xl mx-auto w-full">
        {file ? (
          <div className="card p-8 border-slate-800 w-full text-center space-y-4">
            <FileIcon category={file.category} size="xl" className="mx-auto" />
            <div>
              <h1 className="text-lg font-bold text-slate-100 truncate">{file.name}</h1>
              <p className="text-xs text-slate-500 mt-1">{formatBytes(file.size)}</p>
            </div>

            {allow_download ? (
              <Button
                variant="primary"
                icon={<Download className="w-4 h-4" />}
                onClick={handleDownload}
                className="mx-auto"
              >
                Download ({formatBytes(file.size)})
              </Button>
            ) : (
              <p className="text-xs text-amber-400">Download is disabled for this link.</p>
            )}
          </div>
        ) : folder ? (
          <div className="card p-8 border-slate-800 w-full text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-900/30 flex items-center justify-center mx-auto text-brand-400">
              <Globe className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-100 truncate">{folder.name}</h1>
              <p className="text-xs text-slate-500 mt-1">Shared Folder</p>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
};
