import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Filter, Folder as FolderIcon } from 'lucide-react';
import { fileService } from '../services/fileService.js';
import { FileItem, Folder, FileCategory } from '../types/index.js';
import { FileCard } from '../components/files/FileCard.js';
import { FolderCard } from '../components/files/FolderCard.js';
import { FilePreview } from '../components/files/FilePreview.js';
import { EmptyState } from '../components/ui/index.js';

export const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';
  const selectedCategory = (searchParams.get('category') as FileCategory) || '';

  const [inputQuery, setInputQuery] = useState(query);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

  const performSearch = async () => {
    const res = await fileService.search(query, {
      category: selectedCategory || undefined
    });
    setFiles(res.files || []);
    setFolders(res.folders || []);
  };

  useEffect(() => {
    setInputQuery(query);
    performSearch();
  }, [query, selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams({
      ...(inputQuery.trim() ? { q: inputQuery.trim() } : {}),
      ...(selectedCategory ? { category: selectedCategory } : {})
    });
  };

  const handleCategorySelect = (cat: string) => {
    setSearchParams({
      ...(query ? { q: query } : {}),
      ...(cat ? { category: cat } : {})
    });
  };

  const categories: { label: string; value: string }[] = [
    { label: 'All Types', value: '' },
    { label: 'Documents', value: 'document' },
    { label: 'Images', value: 'image' },
    { label: 'Videos', value: 'video' },
    { label: 'Audio', value: 'audio' },
    { label: 'Archives', value: 'archive' },
  ];

  const totalResults = files.length + folders.length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2.5">
          <Search className="w-6 h-6 text-brand-400" />
          Search Storage
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Search files and folders by name, extension, or category. Works seamlessly online and offline.
        </p>

        {/* Search input form */}
        <form onSubmit={handleSearchSubmit} className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, tag, or extension (e.g., pdf, machine learning, report)…"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
            />
          </div>
          <button type="submit" className="btn-primary">
            Search
          </button>
        </form>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-1">
          <span className="text-xs text-slate-500 flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3" /> Filter:
          </span>
          {categories.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => handleCategorySelect(value)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                selectedCategory === value
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {query && (
        <p className="text-xs text-slate-400">
          Found <span className="font-semibold text-slate-200">{totalResults}</span> results for "
          <span className="text-brand-400">{query}</span>"
        </p>
      )}

      {totalResults === 0 ? (
        <EmptyState
          icon={<Search className="w-12 h-12 text-slate-600" />}
          title={query ? 'No matching files or folders' : 'Start searching'}
          description={
            query
              ? 'Try adjusting your search terms or filters to find what you are looking for.'
              : 'Enter a search term above to find files across your cloud storage.'
          }
        />
      ) : (
        <div className="space-y-6">
          {folders.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <FolderIcon className="w-3.5 h-3.5 text-brand-400" />
                Folders ({folders.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {folders.map(f => (
                  <FolderCard
                    key={f.id}
                    folder={f}
                    onOpen={(folder) => navigate(`/files?folder=${folder.id}`)}
                  />
                ))}
              </div>
            </section>
          )}

          {files.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Files ({files.length})
              </h2>
              <div className="files-grid">
                {files.map(file => (
                  <FileCard
                    key={file.id}
                    file={file}
                    onOpen={(f) => setPreviewFile(f)}
                    onRefresh={performSearch}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {previewFile && (
        <FilePreview file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </div>
  );
};
