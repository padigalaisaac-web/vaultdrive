import { create } from 'zustand';
import { fileService } from '../services/fileService.js';

export interface UploadItem {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: 'queued' | 'uploading' | 'done' | 'error' | 'duplicate';
  error?: string;
  file: File;
}

interface UploadStore {
  items: UploadItem[];
  isOpen: boolean;
  addFiles: (files: File[], folderId?: string | null) => Promise<void>;
  removeItem: (id: string) => void;
  clearAll: () => void;
  setIsOpen: (open: boolean) => void;
}

export const useUploadStore = create<UploadStore>((set, get) => ({
  items: [],
  isOpen: false,

  addFiles: async (files: File[], folderId: string | null = null) => {
    const newItems: UploadItem[] = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'queued',
      file
    }));

    set((state) => ({
      items: [...state.items, ...newItems],
      isOpen: true
    }));

    for (const item of newItems) {
      // Mark as uploading
      set((state) => ({
        items: state.items.map((i) =>
          i.id === item.id ? { ...i, status: 'uploading', progress: 10 } : i
        )
      }));

      try {
        // Duplicate check
        const dup = await fileService.checkDuplicate(item.file);
        if (dup.duplicate) {
          set((state) => ({
            items: state.items.map((i) =>
              i.id === item.id
                ? { ...i, status: 'duplicate', error: 'Duplicate — file already exists' }
                : i
            )
          }));
          continue;
        }

        // Upload
        await fileService.uploadFile(item.file, {
          folderId,
          onProgress: (pct) => {
            set((state) => ({
              items: state.items.map((i) =>
                i.id === item.id ? { ...i, progress: pct } : i
              )
            }));
          }
        });

        // Mark as done
        set((state) => ({
          items: state.items.map((i) =>
            i.id === item.id ? { ...i, status: 'done', progress: 100 } : i
          )
        }));

        window.dispatchEvent(new CustomEvent('vaultdrive:refresh'));
      } catch (err: any) {
        if (err.message === 'OFFLINE_QUEUED') {
          set((state) => ({
            items: state.items.map((i) =>
              i.id === item.id
                ? { ...i, status: 'queued', error: 'Queued for upload when online' }
                : i
            )
          }));
        } else {
          set((state) => ({
            items: state.items.map((i) =>
              i.id === item.id
                ? { ...i, status: 'error', error: err.message || 'Upload failed' }
                : i
            )
          }));
        }
      }
    }
  },

  removeItem: (id: string) => {
    set((state) => {
      const remaining = state.items.filter((i) => i.id !== id);
      return {
        items: remaining,
        isOpen: remaining.length > 0
      };
    });
  },

  clearAll: () => {
    set({ items: [], isOpen: false });
  },

  setIsOpen: (isOpen: boolean) => set({ isOpen })
}));
