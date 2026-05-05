/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Sparkles, Video, Image as ImageIcon, Music, Send, 
  ArrowRight, Clock, Box, Zap, Wand2, RefreshCw, X,
  Download, Camera, Languages, Tag
} from 'lucide-react';
import { motion } from 'motion/react';
import { Asset, HistoryItem } from '../../types';

export interface GenerateWorkspaceProps {
  assets: Asset[];
  history: HistoryItem[];
  isGenerating: boolean;
  generationProgress: number;
  onGenerateVideo: (prompt: string, sourceImage?: string | null) => void;
  onGenerateAudio: (prompt: string, duration: number, autoPlace?: boolean) => void;
  onGenerateImage: (prompt: string, sourceImage: string | null, sourceAsset: Asset | null, aspectRatio: string) => void;
  onTranslate: (text: string) => Promise<string>;
  onAnalyzeVisual: (url: string, assetId: string) => Promise<string>;
  onCaptureFrame: () => string | null;
  addAsset: (asset: Asset) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
}

const FILTERS: Record<string, string> = {
  'なし': 'none',
  'ノワール': 'grayscale(100%) contrast(120%)',
  'ヴィンテージ': 'sepia(30%) saturate(150%) hue-rotate(-15deg)',
  'ビビッド': 'saturate(180%) contrast(110%)',
  'シネマ': 'contrast(110%) brightness(90%) saturate(130%)',
};

const TAG_CATEGORIES = {
  'ジャンル': ['シネマティック', 'エレクトロ', 'オーケストラ', 'アンビエント', 'ローファイ', 'ジャズ', 'ロック'],
  '楽器': ['ピアノ', 'シンセサイザー', 'ストリングス', 'ドラム', 'アコースティックギター', 'ベース'],
  '雰囲気': ['壮大', '落ち着いた', '不気味', '幻想的', '緊迫感', 'エモーショナル', 'ダーク']
};

export default function GenerateWorkspace({
  assets,
  history,
  isGenerating,
  generationProgress,
  onGenerateVideo,
  onGenerateImage,
  onGenerateAudio,
  onTranslate,
  onAnalyzeVisual,
  onCaptureFrame,
  addAsset
}: GenerateWorkspaceProps) {
  const [prompt, setPrompt] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'video' | 'image' | 'audio'>('video');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAutoPlacementEnabled, setIsAutoPlacementEnabled] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('なし');
  const [filterOpacity, setFilterOpacity] = useState(100);

  const handleTranslate = async () => {
    if (!prompt.trim() || isTranslating) return;
    setIsTranslating(true);
    try {
      const translated = await onTranslate(prompt);
      setPrompt(translated);
    } catch (e) {
      console.error(e);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleGenerate = () => {
    if (!prompt.trim() && !capturedImage) return;
    
    if (selectedMode === 'video') onGenerateVideo(prompt, capturedImage);
    if (selectedMode === 'image') onGenerateImage(prompt, capturedImage, null, '16:9');
    if (selectedMode === 'audio') onGenerateAudio(prompt, 30, isAutoPlacementEnabled);
    setPrompt('');
    setCapturedImage(null);
  };

  const captureLocalFiltered = () => {
    if (!capturedImage) return;
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // 1. Draw original base image (100% alpha, no filter)
        ctx.drawImage(img, 0, 0);
        
        // 2. Draw filtered image on top with specific globalAlpha for "Intensity"
        ctx.filter = FILTERS[selectedFilter] === 'none' ? 'none' : FILTERS[selectedFilter];
        ctx.globalAlpha = filterOpacity / 100;
        ctx.drawImage(img, 0, 0);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        addAsset({
          id: `filtered_${Date.now()}`,
          name: `Filter: ${selectedFilter}`,
          type: 'image',
          url: dataUrl,
          duration: 5,
          thumbnail: dataUrl,
          isLocal: true,
          isGenerated: false // Manual filter is local
        });
      }
    };
    img.src = capturedImage;
  };

  const toggleTag = (tag: string) => {
    setPrompt(prev => {
      const tags = prev.split(/[,、\s]+/).filter(Boolean);
      if (tags.includes(tag)) {
        return tags.filter(t => t !== tag).join('、');
      } else {
        return [...tags, tag].join('、');
      }
    });
  };

  const [isOver, setIsOver] = useState(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    const assetId = e.dataTransfer.getData('assetId');
    if (assetId) {
      // Look in assets first
      let item = assets.find(a => a.id === assetId);
      let url = item?.url;

      // If not in assets, look in history
      if (!item) {
        const historyItem = history.find(h => h.id === assetId);
        if (historyItem) {
          url = historyItem.resultUrl;
          item = { type: historyItem.type } as any;
        }
      }

      if (url && item) {
        // Set capture for visual context in all cases
        if (item.type === 'video' || item.type === 'image') {
          setCapturedImage(url);
        }

        if (selectedMode === 'audio' && (item.type === 'video' || item.type === 'image')) {
          setIsAnalyzing(true);
          try {
            const aiPrompt = await onAnalyzeVisual(url, assetId);
            setPrompt(aiPrompt);
          } catch (err) {
            console.error(err);
          } finally {
            setIsAnalyzing(false);
          }
        }
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#111] overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-8">
        <div className="w-full max-w-2xl space-y-8 py-12">
          <div className="text-center space-y-2">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-full text-[10px] font-bold uppercase tracking-[0.2em]"
            >
              <Sparkles size={12} /> Powered by Google Veo
            </motion.div>
            <h1 className="text-4xl font-black text-white tracking-tight">Final Cut & Mastering.</h1>
            <p className="text-gray-500 uppercase text-[10px] font-bold tracking-[0.3em]">AI-Driven Continuity & Atmospheric Scoring</p>
          </div>

          <div 
            className={`bg-[#1a1a1a] border border-[#333] rounded-2xl p-6 shadow-2xl relative overflow-hidden transition-all ${isOver ? 'ring-2 ring-blue-500 bg-blue-500/5' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsOver(true);
            }}
            onDragLeave={() => setIsOver(false)}
            onDrop={handleDrop}
          >
            <div className="flex gap-4 mb-6">
              {[
                { id: 'video', icon: <Video size={16} />, label: 'Video' },
                { id: 'image', icon: <ImageIcon size={16} />, label: 'Image' },
                { id: 'audio', icon: <Music size={16} />, label: 'Audio' }
              ].map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setSelectedMode(mode.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${selectedMode === mode.id ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-white hover:bg-[#252525]'}`}
                >
                  {mode.icon}
                  {mode.label}
                </button>
              ))}
            </div>

            <div className="space-y-4 relative z-10">
              <div className="relative group">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    selectedMode === 'video' ? "動き、照明、シネマティックスタイルを詳細に記述してください..." : 
                    selectedMode === 'image' ? "構図、質感、ライティングを詳細に記述してください..." :
                    "30秒の楽曲の雰囲気、楽器、スタイルを記述してください..."
                  }
                  className="w-full bg-black border border-[#333] rounded-xl px-6 py-6 text-sm text-white focus:border-blue-500 outline-none transition-all resize-none h-40 leading-relaxed group-hover:border-[#444]"
                />
                
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center backdrop-blur-sm z-20 space-y-3 animate-in fade-in duration-300">
                    <div className="relative">
                      <div className="w-12 h-12 border-4 border-blue-500/20 rounded-full" />
                      <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin" />
                    </div>
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] animate-pulse">Gemini Visual Analysis...</span>
                  </div>
                )}
                
                <div className="absolute top-4 right-4 flex flex-col gap-2">
                  <button 
                    onClick={handleTranslate}
                    disabled={isTranslating || !prompt.trim()}
                    className={`px-3 py-2 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg transition-all border border-blue-500/30 flex items-center gap-2 group/btn ${isTranslating ? 'animate-pulse' : ''}`}
                    title="翻訳して決定"
                  >
                    {isTranslating ? <RefreshCw size={14} className="animate-spin" /> : <Languages size={14} />}
                    <span className="text-[10px] font-black uppercase tracking-widest">翻訳して決定</span>
                  </button>
                  {selectedMode !== 'audio' && (
                    <button 
                      onClick={() => {
                          const frame = onCaptureFrame();
                          if (frame) setCapturedImage(frame);
                       }}
                      className="p-2 bg-[#222] hover:bg-zinc-700 text-gray-400 hover:text-white rounded-lg transition-all border border-[#333]"
                      title="Reference current frame"
                    >
                      <Wand2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {capturedImage && (
                <div className="flex flex-col gap-6 p-4 bg-black/40 rounded-2xl border border-white/5 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex gap-4 items-center">
                      <div className="relative group shrink-0 w-32 aspect-video rounded-lg overflow-hidden border border-white/10 shadow-xl bg-black">
                        {capturedImage.startsWith('data:audio') ? (
                          <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-blue-400">
                             <Music size={32} />
                          </div>
                        ) : capturedImage.includes('video') || capturedImage.startsWith('blob:http') || capturedImage.includes('.mp4') ? (
                          <video src={capturedImage} className="w-full h-full object-cover" muted playsInline />
                        ) : (
                          <img src={capturedImage} className="w-full h-full object-cover" alt="Source Reference" />
                        )}
                        <button 
                          onClick={() => setCapturedImage(null)}
                          className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">
                          {selectedMode === 'audio' ? 'Analyzing for Scoring' : 'Visual Reference'} Active
                        </h4>
                        <p className="text-[10px] text-zinc-600 leading-tight">AI will use this {selectedMode === 'audio' ? 'visual' : 'context'} for generation.</p>
                      </div>
                  </div>
                  
                  {selectedMode !== 'audio' && (
                    <div className="flex gap-6 items-start pt-4 border-t border-white/5">
                      <div className="relative group shrink-0">
                        <div className="w-48 aspect-video rounded-xl overflow-hidden border-2 border-blue-500 shadow-2xl relative bg-[#0a0a0a]">
                          {/* Base (Original) Layer */}
                          {capturedImage.includes('video') || capturedImage.startsWith('blob:http') || capturedImage.includes('.mp4') ? (
                            <video 
                              src={capturedImage} 
                              className="w-full h-full object-cover absolute inset-0" 
                              muted 
                              playsInline
                            />
                          ) : (
                            <img 
                              src={capturedImage} 
                              className="w-full h-full object-cover absolute inset-0" 
                              alt="Base" 
                            />
                          )}
                          
                          {/* Filtered Layer */}
                          <div 
                            className="w-full h-full absolute inset-0 transition-opacity duration-300"
                            style={{ 
                              filter: FILTERS[selectedFilter], 
                              opacity: filterOpacity / 100,
                            }}
                          >
                            {capturedImage.includes('video') || capturedImage.startsWith('blob:http') || capturedImage.includes('.mp4') ? (
                              <video src={capturedImage} className="w-full h-full object-cover" muted playsInline />
                            ) : (
                              <img src={capturedImage} className="w-full h-full object-cover" alt="Filtered" />
                            )}
                          </div>
                        </div>
                        <span className="absolute -bottom-6 left-0 text-[8px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1">
                          <Camera size={10} /> Image Ref Active
                        </span>
                      </div>

                      <div className="flex-1 space-y-6">
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Filter Preset</label>
                          <div className="flex flex-wrap gap-2">
                            {Object.keys(FILTERS).map(f => (
                              <button
                                key={f}
                                onClick={() => setSelectedFilter(f)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${selectedFilter === f ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:text-white'}`}
                              >
                                {f}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">フィルター強度</label>
                            <span className="text-[10px] font-mono text-blue-400">{filterOpacity}%</span>
                          </div>
                          <input 
                            type="range"
                            min="0"
                            max="100"
                            value={filterOpacity}
                            onChange={(e) => setFilterOpacity(parseInt(e.target.value))}
                            className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-blue-500"
                          />
                        </div>

                        <button
                          onClick={captureLocalFiltered}
                          className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 border border-white/5"
                        >
                          <Download size={14} className="text-blue-400" /> Save Styled to Assets
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tag Building Blocks - Now Inside the Card */}
              <div className="space-y-6 pt-6 border-t border-white/5">
                <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-2">
                  <Tag size={12} className="text-blue-500" /> Prompt Building Blocks
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {Object.entries(TAG_CATEGORIES).map(([category, tags]) => (
                    <div key={category} className="space-y-3">
                      <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest border-b border-white/10 pb-1">
                        {category}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {tags.map(tag => {
                          const isActive = prompt.includes(tag);
                          return (
                            <button
                              key={tag}
                              onClick={() => toggleTag(tag)}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                                isActive 
                                  ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' 
                                  : 'bg-zinc-900 border-white/5 text-zinc-400 hover:text-white hover:border-white/10'
                              }`}
                            >
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <div className="flex gap-4 text-[10px] text-gray-500 font-bold uppercase tracking-widest items-center">
                  <span className="flex items-center gap-1"><Clock size={12} /> {selectedMode === 'audio' ? '30s Master' : '8s Duration'}</span>
                  {selectedMode === 'audio' ? (
                    <button 
                      onClick={() => setIsAutoPlacementEnabled(!isAutoPlacementEnabled)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded transition-all ${isAutoPlacementEnabled ? 'bg-blue-600/20 text-blue-400' : 'text-zinc-600 outline outline-zinc-600'}`}
                    >
                      <Zap size={10} /> Auto-Sync to Timeline
                    </button>
                  ) : (
                    <span className="flex items-center gap-1"><Box size={12} /> {selectedMode === 'video' ? '1080p Cinematic' : 'Imagen 3'}</span>
                  )}
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || (!prompt.trim() && !capturedImage)}
                  className="px-8 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-[0.2em] hover:bg-blue-500 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 transition-all flex items-center gap-3 shadow-[0_0_30px_rgba(37,99,235,0.3)]"
                >
                  {isGenerating ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                  ) : (
                    <Send size={14} />
                  )}
                  {isGenerating ? `Generating ${Math.round(generationProgress)}%` : 'Generate'}
                </button>
              </div>
            </div>
            
            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-600/5 blur-[100px] rounded-full pointer-events-none" />
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-purple-600/5 blur-[100px] rounded-full pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
}
