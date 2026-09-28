import React, { useEffect, useState } from 'react';
import { Share2, Copy, Check, Trash2, Globe, Lock, ExternalLink } from 'lucide-react';
import { shareService } from '../services/storageService.js';
import { ShareItem } from '../types/index.js';
import { formatDate, formatRelativeTime } from '../utils/formatters.js';
import { Button, EmptyState } from '../components/ui/index.js';

export const SharedPage: React.FC = () => {
  const [shares, setShares] = useState<ShareItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadShares = async () => {
    try {
      const data = await shareService.listShares();
      if (data) setShares(data);
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    loadShares();
  }, []);

  const handleCopy = (share: ShareItem) => {
    const fullUrl = `${window.location.origin}${share.share_url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(share.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Revoke this share link? Anyone with this link will immediately lose access.')) {
      await shareService.deleteShare(id);
      loadShares();
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2.5">
          <Share2 className="w-6 h-6 text-brand-400" />
          Shared Links
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Active public links created for your files and folders.
        </p>
      </div>

      {shares.length === 0 ? (
        <EmptyState
          icon={<Share2 className="w-12 h-12 text-slate-600" />}
          title="No active shares"
          description="Select any file or folder and click 'Share' to generate a secure link."
        />
      ) : (
        <div className="card divide-y divide-slate-800">
          {shares.map(share => {
            const itemName = share.file?.name || share.folder?.name || 'Shared Item';
            const isCopied = copiedId === share.id;

            return (
              <div key={share.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-slate-800/40 transition-colors">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-brand-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Globe className="w-5 h-5 text-brand-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-200 truncate">{itemName}</p>
                      {share.password_protected && (
                        <span className="badge bg-amber-900/40 text-amber-300 text-[10px] px-1.5 py-0.5 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> Password
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span>{share.access_count} views</span>
                      <span>•</span>
                      <span>
                        {share.expires_at ? `Expires ${formatDate(share.expires_at, 'MMM d, yyyy')}` : 'Never expires'}
                      </span>
                      <span>•</span>
                      <span>Created {formatRelativeTime(share.created_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    onClick={() => handleCopy(share)}
                  >
                    {isCopied ? 'Copied' : 'Copy Link'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<ExternalLink className="w-3.5 h-3.5" />}
                    onClick={() => window.open(share.share_url, '_blank')}
                  >
                    Open
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300"
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                    onClick={() => handleDelete(share.id)}
                  >
                    Revoke
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
