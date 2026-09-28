import React, { useState } from 'react';
import { Copy, Check, Lock, Calendar, Globe, Share2 } from 'lucide-react';
import { Modal, Button, Input } from '../ui/index.js';
import { FileItem, Folder } from '../../types/index.js';
import { shareService } from '../../services/storageService.js';

interface ShareModalProps {
  item: FileItem | Folder | null;
  type: 'file' | 'folder';
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ item, type, isOpen, onClose }) => {
  const [password, setPassword] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number | null>(7);
  const [allowDownload, setAllowDownload] = useState(true);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!item || !isOpen) return null;

  const handleCreateShare = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const share = await shareService.createShare({
        file_id: type === 'file' ? item.id : null,
        folder_id: type === 'folder' ? item.id : null,
        password: password.trim() ? password : undefined,
        expires_in_days: expiresInDays,
        allow_download: allowDownload
      });

      const fullUrl = `${window.location.origin}${share.share_url}`;
      setShareUrl(fullUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to generate share link');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setShareUrl(null);
        setError(null);
        onClose();
      }}
      title={`Share ${type === 'file' ? 'File' : 'Folder'}: ${item.name}`}
      size="md"
    >
      <div className="space-y-4 text-sm">
        {error && (
          <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs">
            {error}
          </div>
        )}

        {!shareUrl ? (
          <>
            <div className="space-y-3">
              <Input
                label="Password Protection (Optional)"
                type="password"
                placeholder="Leave blank for public link"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<Lock className="w-4 h-4 text-slate-400" />}
              />

              <div>
                <label className="label">Link Expiration</label>
                <select
                  className="input"
                  value={expiresInDays ?? ''}
                  onChange={(e) => setExpiresInDays(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="1">1 Day</option>
                  <option value="7">7 Days</option>
                  <option value="30">30 Days</option>
                  <option value="">Never Expires</option>
                </select>
              </div>

              {type === 'file' && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="allowDownload"
                    checked={allowDownload}
                    onChange={(e) => setAllowDownload(e.target.checked)}
                    className="rounded bg-slate-700 border-slate-600 text-brand-600 focus:ring-brand-500"
                  />
                  <label htmlFor="allowDownload" className="text-slate-300 text-xs cursor-pointer">
                    Allow recipients to download this file
                  </label>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={isLoading}
                onClick={handleCreateShare}
                icon={<Share2 className="w-4 h-4" />}
              >
                Create Link
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-emerald-950/30 border border-emerald-800/50 rounded-xl text-emerald-300 text-xs">
              <Globe className="w-4 h-4 flex-shrink-0" />
              <span>Anyone with this secure link can view this {type}.</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="input text-xs font-mono select-all"
              />
              <Button
                variant={isCopied ? 'secondary' : 'primary'}
                onClick={handleCopy}
                icon={isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              >
                {isCopied ? 'Copied' : 'Copy'}
              </Button>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
