/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Plus, Upload, Trash2, Video, Image as ImageIcon, Music, History, 
  Sparkles, Layers, Play, Type,
  ArrowUpDown, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Asset, HistoryItem } from '../../types';

interface SharedSidebarProps {
  assets: Asset[];
  selectedAssetIds: string[];
  setSelectedAssetIds: (ids: string[]) => void;
  history: HistoryItem[];
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  processFiles: (files: File[]) => void;
  addTextToTimeline: () => void;
  width: number;
  onDeleteAsset: (id: string) => void;
  onExtractFrame: (asset: Asset) => void;
  onDeleteHistory: (id: string) => void;
  sidebarTab: 'assets' | 'history';
  onSidebarTabChange: (tab: 'assets' | 'history') => void;
  masterVolume?: number;
}

export default function SharedSidebar({
  assets,
  selectedAssetIds,
  setSelectedAssetIds,
  history,
  handleFileUpload,
  processFiles,
  addTextToTimeline,
  width,
  onDeleteAsset,
  onDeleteHistory,
  sidebarTab,
  onSidebarTabChange,
  masterVolume = 1,
  onExtractFrame
}: SharedSidebarProps) {
  const [sortMode, setSortMode] = React.useState<'none' | 'ratio-asc' | 'ratio-desc'>('none');
  const [isDraggingOver, setIsDraggingOver] = React.useState(false);

  const sortedAssets = React.useMemo(() => {
    if (sortMode === 'none') return assets;
    return [...assets].sort((a, b) => {
      const ratioA = a.aspectRatio || 0;
      const ratioB = b.aspectRatio || 0;
      return sortMode === 'ratio-asc' ? ratioA - ratioB : ratioB - ratioA;
    });
  }, [assets, sortMode]);

  const toggleSort = () => {
    setSortMode(prev => {
      if (prev === 'none') return 'ratio-desc';
      if (prev === 'ratio-desc') return 'ratio-asc';
      return 'none';
    });
  };

  const assetGroups = React.useMemo(() => ([
    { type: 'video' as const, label: 'Video Drops', icon: Video, accent: 'text-blue-400', assets: sortedAssets.filter(a => !a.isGenerated && a.type === 'video') },
    { type: 'image' as const, label: 'Image Drops', icon: ImageIcon, accent: 'text-purple-400', assets: sortedAssets.filter(a => !a.isGenerated && a.type === 'image') },
    { type: 'audio' as const, label: 'Audio Drops', icon: Music, accent: 'text-orange-400', assets: sortedAssets.filter(a => !a.isGenerated && a.type === 'audio') }
  ]), [sortedAssets]);

  const renderAssetCard = (asset: Asset) => (
    <div 
      key={asset.id}
      draggable
      onDragStart={(e) => {
        const dragAssetIds = selectedAssetIds.includes(asset.id) 
          ? selectedAssetIds 
          : [asset.id];
        e.dataTransfer.setData('assetIds', JSON.stringify(dragAssetIds));
        e.dataTransfer.setData('assetId', asset.id);
      }}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) {
          if (selectedAssetIds.includes(asset.id)) {
            setSelectedAssetIds(selectedAssetIds.filter(id => id !== asset.id));
          } else {
            setSelectedAssetIds([...selectedAssetIds, asset.id]);
          }
        } else {
          setSelectedAssetIds([asset.id]);
        }
      }}
      className={`group relative bg-[#1a1a1a] rounded-lg border-2 transition-all cursor-grab active:cursor-grabbing overflow-hidden shadow-lg 
        ${selectedAssetIds.includes(asset.id) 
          ? (selectedAssetIds.length > 1 
            ? 'border-green-500 ring-2 ring-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.4)]' 
            : 'border-blue-500 ring-2 ring-blue-500/20') 
          : 'border-transparent hover:border-blue-500/50'}`}
    >
      <div className="aspect-video bg-[#0a0a0a] relative overflow-hidden flex items-center justify-center">
        {asset.type === 'video' ? (
          <>
            {asset.thumbnail ? (
              <img 
                src={asset.thumbnail} 
                className="w-full h-full object-contain opacity-100" 
                alt={asset.name} 
                referrerPolicy="no-referrer"
              />
            ) : (
              <video 
                src={asset.url} 
                className="w-full h-full object-contain opacity-100" 
                preload="metadata"
              />
            )}
            <video 
              src={asset.url} 
              className="w-full h-full object-contain opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute inset-0 z-20" 
              onMouseEnter={(e) => e.currentTarget.play()} 
              onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
              muted
              playsInline
            />
          </>
        ) : (asset.thumbnail || asset.type === 'image') ? (
          <img 
            src={asset.thumbnail || asset.url} 
            className="w-full h-full object-contain opacity-100" 
            alt={asset.name} 
            referrerPolicy="no-referrer"
          />
        ) : asset.type === 'audio' ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 group-hover:bg-zinc-800 transition-colors">
             <Music size={24} className="text-orange-400 mb-1" />
             <audio 
               src={asset.url} 
               className="hidden" 
               onMouseEnter={(e) => {
                 e.currentTarget.volume = masterVolume;
                 e.currentTarget.play().catch(() => {});
               }}
               onMouseLeave={(e) => {
                 e.currentTarget.pause();
                 e.currentTarget.currentTime = 0;
               }}
             />
             <div className="text-[7px] font-bold text-zinc-600 uppercase tracking-tighter">Hover to Preview</div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-700 bg-[#111]">
            <ImageIcon size={24} />
          </div>
        )}
        <div className="absolute top-1 left-1 bg-black/40 p-1 rounded backdrop-blur-sm flex items-center gap-1">
          {asset.type === 'video' ? <Video size={10} className="text-blue-400" /> : asset.type === 'audio' ? <Music size={10} className="text-orange-400" /> : <ImageIcon size={10} className="text-purple-400" />}
          {asset.aspectRatio && (
            <span className="text-[7px] font-bold text-white/70">
              {asset.aspectRatio > 1.2 ? '16:9' : asset.aspectRatio < 0.8 ? '9:16' : '1:1'}
            </span>
          )}
        </div>
        {asset.isGenerated && (
          <div className="absolute top-1 right-1 bg-blue-600/80 px-1 rounded flex items-center gap-0.5 backdrop-blur-sm z-30">
            <Sparkles size={8} className="text-white" />
            <span className="text-[7px] font-black text-white uppercase tracking-tighter">Gen</span>
          </div>
        )}
        <div className="absolute bottom-1 right-1 bg-black/60 px-1 rounded text-[8px] font-mono backdrop-blur-sm">
          {asset.duration.toFixed(1)}s
        </div>
        {asset.type === 'video' && (
          <button 
            onClick={(e) => { e.stopPropagation(); onExtractFrame(asset); }}
            className="absolute top-2 right-2 p-2 bg-blue-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all z-50 shadow-xl hover:scale-110 active:scale-95"
            title="Extract Last Frame"
          >
            <Eye size={14} />
          </button>
        )}
      </div>
      <div className="p-2 flex items-center justify-between bg-[#252525]/80 backdrop-blur-sm">
        <span className="text-[9px] truncate font-medium text-gray-400 w-full pr-2">{asset.name}</span>
        <button 
          onClick={(e) => { e.stopPropagation(); onDeleteAsset(asset.id); }}
          className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all p-1"
        >
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFiles(files);
      onSidebarTabChange('assets');
    }
  };

  return (
    <div 
      className={`bg-[#202020] border-r border-[#333] flex flex-col shrink-0 h-full relative transition-all ${isDraggingOver ? 'ring-2 ring-inset ring-blue-500 bg-[#252525]' : ''}`}
      style={{ width: `${width}px` }}
      onDragOver={(e) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes('Files')) {
          setIsDraggingOver(true);
        }
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDrop}
    >
      <AnimatePresence>
        {isDraggingOver && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-blue-500/10 backdrop-blur-[2px] flex items-center justify-center pointer-events-none"
          >
            <div className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-blue-600 shadow-2xl">
              <Upload size={48} className="text-white animate-bounce" />
              <div className="text-white font-black uppercase tracking-widest text-sm text-center leading-relaxed">
                Drop files to<br/>Import Assets
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex border-b border-[#333] bg-[#252525]">
        <button 
          onClick={() => onSidebarTabChange('assets')}
          className={`flex-1 flex flex-col items-center py-3 gap-1 transition-all ${sidebarTab === 'assets' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-white'}`}
        >
          <Layers size={18} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Assets</span>
        </button>
        <button 
          onClick={() => onSidebarTabChange('history')}
          className={`flex-1 flex flex-col items-center py-3 gap-1 transition-all ${sidebarTab === 'history' ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-500 hover:text-white'}`}
        >
          <History size={18} />
          <span className="text-[10px] font-bold uppercase tracking-widest">History</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {sidebarTab === 'assets' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Recent Downloads</h3>
                <p className="mt-1 text-[8px] font-bold uppercase tracking-widest text-zinc-700">Mounted last 5 days</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={toggleSort}
                  className={`p-1.5 rounded transition-all flex items-center gap-1 ${sortMode !== 'none' ? 'bg-blue-500/20 text-blue-400' : 'bg-[#333] hover:bg-[#444] text-gray-300 hover:text-white'}`}
                  title="Sort by Aspect Ratio"
                >
                  <ArrowUpDown size={14} />
                </button>
                <button 
                  onClick={addTextToTimeline}
                  className="p-1.5 bg-[#333] hover:bg-[#444] rounded text-gray-300 hover:text-white transition-all"
                  title="Add Text"
                >
                  <Type size={14} />
                </button>
                <label className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded text-white cursor-pointer transition-all shadow-lg shadow-blue-600/20">
                  <Plus size={14} />
                  <input type="file" multiple onChange={handleFileUpload} className="hidden" accept="video/*,image/*,audio/*" />
                </label>
              </div>
            </div>

            <div className="space-y-7">
              {assetGroups.map(group => {
                const Icon = group.icon;
                return (
                  <section key={group.type} className="space-y-3">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <div className="flex items-center gap-2">
                        <Icon size={13} className={group.accent} />
                        <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{group.label}</h4>
                      </div>
                      <span className="text-[9px] font-mono text-zinc-600">{group.assets.length}</span>
                    </div>
                    {group.assets.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                        {group.assets.map(renderAssetCard)}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-white/5 bg-black/10 px-3 py-4 text-center text-[9px] font-bold uppercase tracking-widest text-zinc-700">
                        No {group.type} files
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
            {assets.length === 0 && (
              <div className="mt-8 text-center space-y-4 opacity-30 px-4">
                <Upload size={32} className="mx-auto" />
                <p className="text-[10px] uppercase font-bold tracking-widest leading-relaxed text-center">Drag files here<br/>or use the + button</p>
              </div>
            )}
            
            <div className="pt-6">
              <button 
                onClick={addTextToTimeline}
                className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl border border-white/5 text-[10px] font-bold uppercase tracking-[0.2em] transition-all shadow-lg"
              >
                <Plus size={14} />
                Add Text Layer
              </button>
            </div>
          </div>
        )}

        {sidebarTab === 'history' && (
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Export History</h3>
            <div className="space-y-3">
              {history.map(item => (
                <div 
                  key={item.id} 
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('assetId', item.id);
                  }}
                  className="bg-[#1a1a1a] border border-[#333] rounded-xl overflow-hidden group hover:border-green-500/30 transition-all cursor-grab active:cursor-grabbing"
                >
                  <div className="aspect-video bg-black relative overflow-hidden flex items-center justify-center">
                    {item.type === 'audio' ? (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-900 group-hover:bg-zinc-800 transition-colors">
                        <Music size={32} className="text-orange-400 opacity-40 group-hover:opacity-100 transition-opacity" />
                      </div>
                    ) : (
                      <>
                        <img 
                          src={item.thumbnail || item.resultUrl} 
                          className="w-full h-full object-contain opacity-60 group-hover:opacity-100 transition-all duration-500" 
                          alt="Result" 
                        />
                        {item.type === 'video' && (
                          <video 
                            src={item.resultUrl} 
                            className="w-full h-full object-contain opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute inset-0 z-20" 
                            onMouseEnter={(e) => e.currentTarget.play()} 
                            onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                            muted
                            playsInline
                          />
                        )}
                      </>
                    )}
                    
                    {/* Gen Badge in History */}
                    {item.isGenerated && (
                      <div className="absolute top-2 right-2 bg-blue-600/80 px-1.5 py-0.5 rounded flex items-center gap-1 backdrop-blur-md z-30 shadow-lg border border-white/10">
                        <Sparkles size={10} className="text-white" />
                        <span className="text-[8px] font-black text-white uppercase tracking-tighter">Gen</span>
                      </div>
                    )}

                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px] z-40">
                      <button 
                        onClick={(e) => { e.stopPropagation(); window.open(item.resultUrl, '_blank'); }}
                        className="p-2 bg-white text-black rounded-full hover:scale-110 transition-transform shadow-xl"
                      >
                        <Play size={16} fill="currentColor" />
                      </button>
                    </div>
                    
                    <div className="absolute top-2 left-2 bg-black/40 p-1 rounded backdrop-blur-sm z-30">
                      {item.type === 'video' ? <Video size={10} className="text-blue-400" /> : item.type === 'audio' ? <Music size={10} className="text-orange-400" /> : <ImageIcon size={10} className="text-purple-400" />}
                    </div>
                  </div>
                  <div className="p-3 space-y-2 bg-[#252525]">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest truncate max-w-[120px]">
                        {item.name || "Generation Result"}
                      </span>
                      {item.duration && (
                        <span className="text-[8px] font-mono text-zinc-600">{item.duration.toFixed(1)}s</span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-300 line-clamp-2 leading-relaxed italic">"{item.prompt}"</p>
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <span className="text-[8px] font-mono text-gray-600 uppercase tracking-tighter">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button 
                        onClick={() => onDeleteHistory(item.id)}
                        className="text-gray-700 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {history.length === 0 && (
                <div className="mt-8 text-center space-y-3 opacity-30">
                  <History size={32} className="mx-auto" />
                  <p className="text-[10px] uppercase font-bold tracking-widest">No history yet</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
