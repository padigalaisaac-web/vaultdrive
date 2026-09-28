import React from 'react';
import { AlertTriangle, Server, HardDrive, Copy } from 'lucide-react';
import { Modal, Button } from '../ui/index.js';
import { ConflictItem } from '../../types/index.js';
import { useAppStore } from '../../stores/appStore.js';
import { fileService } from '../../services/fileService.js';
import { folderService } from '../../services/folderService.js';

export const ConflictModal: React.FC = () => {
  const { pendingConflicts, resolveConflict } = useAppStore();

  if (pendingConflicts.length === 0) return null;

  const currentConflict = pendingConflicts[0];

  const handleResolve = async (action: 'server' | 'local' | 'both') => {
    const { entity_type, entity_id, serverVersion, clientPayload } = currentConflict;

    try {
      if (action === 'server') {
        // Keep server version: update local DB with server data
        if (entity_type === 'file') {
          await fileService.updateFile(entity_id, serverVersion);
        } else {
          await folderService.updateFolder(entity_id, serverVersion);
        }
      } else if (action === 'local') {
        // Keep local: force push client version
        if (entity_type === 'file') {
          await fileService.updateFile(entity_id, clientPayload);
        } else {
          await folderService.updateFolder(entity_id, clientPayload);
        }
      } else if (action === 'both') {
        // Save both (safest default)
        const copyName = `${clientPayload.name || 'copy'} (Local Conflict Copy)`;
        if (entity_type === 'file') {
          await fileService.updateFile(entity_id, { ...clientPayload, name: copyName });
        } else {
          await folderService.createFolder(copyName, clientPayload.parent_id);
        }
      }
    } catch (e) {
      console.error('Failed to resolve conflict:', e);
    } finally {
      resolveConflict(entity_id);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={() => handleResolve('both')}
      title="Conflict Detected"
      size="md"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-amber-200">
          <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0" />
          <p className="text-xs leading-relaxed">
            This {currentConflict.entity_type} was modified on another device while you were offline.
            Choose how you would like to resolve the conflict.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-900 rounded-xl border border-slate-700">
            <div className="flex items-center gap-1.5 font-medium text-slate-300 mb-2">
              <Server className="w-3.5 h-3.5 text-brand-400" />
              Server Version
            </div>
            <p className="text-slate-100 font-semibold truncate">{currentConflict.serverVersion?.name || 'Unnamed'}</p>
            <p className="text-slate-500 mt-1">v{currentConflict.serverVersion?.version || 1}</p>
          </div>

          <div className="p-3 bg-slate-900 rounded-xl border border-slate-700">
            <div className="flex items-center gap-1.5 font-medium text-slate-300 mb-2">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              Local Version
            </div>
            <p className="text-slate-100 font-semibold truncate">{currentConflict.clientPayload?.name || 'Unnamed'}</p>
            <p className="text-slate-500 mt-1">Pending sync</p>
          </div>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          <Button
            variant="primary"
            className="w-full justify-center"
            icon={<Copy className="w-4 h-4" />}
            onClick={() => handleResolve('both')}
          >
            Save Both (Recommended)
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              className="justify-center text-xs"
              onClick={() => handleResolve('server')}
            >
              Keep Server
            </Button>
            <Button
              variant="secondary"
              className="justify-center text-xs"
              onClick={() => handleResolve('local')}
            >
              Keep Local
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
