/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import { Download, Save, Upload, Video, Undo2, Redo2, Film } from 'lucide-react';
import { FilmGrainLevel } from '../../utils/filmGrain';

interface GlobalHeaderProps {
  projectName: string;
  setProjectName: (name: string) => void;
  onExport: () => void;
  onSaveProject: () => void;
  onLoadProject: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isExporting: boolean;
  exportProgress: number;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  aspectRatio: '16:9' | '9:16';
  setAspectRatio: (ar: '16:9' | '9:16') => void;
  filmGrain: FilmGrainLevel;
  setFilmGrain: (v: FilmGrainLevel) => void;
}

export default function GlobalHeader({
  projectName,
  setProjectName,
  isExporting,
  exportProgress,
  onExport,
  onSaveProject,
  onLoadProject,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  aspectRatio,
  setAspectRatio,
  filmGrain,
  setFilmGrain,
}: GlobalHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <header className="h-14 bg-[#111] border-b border-white/5 flex items-center px-6 justify-between z-[100]">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
            <Video size={18} className="text-white" />
          </div>
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="bg-transparent border-none text-sm font-black focus:ring-0 rounded px-2 py-1 outline-none transition-all hover:bg-white/5 w-48 uppercase tracking-widest"
            placeholder="UNTITLED PROJECT"
          />
        </div>

        <div className="h-6 w-px bg-white/5 mx-2" />

        <div className="flex items-center gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-2 rounded-lg transition-all ${canUndo ? 'text-zinc-400 hover:text-white hover:bg-white/5' : 'text-zinc-700 cursor-not-allowed'}`}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={18} />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-2 rounded-lg transition-all ${canRedo ? 'text-zinc-400 hover:text-white hover:bg-white/5' : 'text-zinc-700 cursor-not-allowed'}`}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 size={18} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex bg-black/40 rounded-xl p-1 border border-white/5">
          <button
            onClick={() => setAspectRatio('16:9')}
            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all ${aspectRatio === '16:9' ? 'bg-white/10 text-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            16:9
          </button>
          <button
            onClick={() => setAspectRatio('9:16')}
            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all ${aspectRatio === '9:16' ? 'bg-white/10 text-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            9:16
          </button>
        </div>

        {/* Film Grain */}
        <div className="flex items-center gap-1 border border-white/5 rounded-xl p-1">
          <Film size={10} className="text-zinc-600 ml-1 mr-0.5" />
          {(['off', 'light', 'medium', 'heavy'] as FilmGrainLevel[]).map(level => (
            <button
              key={level}
              onClick={() => setFilmGrain(level)}
              title={level === 'off' ? 'Film Grain: Off' : `Film Grain: ${level}`}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                filmGrain === level
                  ? level === 'off'
                    ? 'bg-white/10 text-zinc-300'
                    : 'bg-amber-900/40 text-amber-300 border border-amber-700/50'
                  : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              {level === 'off' ? 'Off' : level === 'light' ? 'L' : level === 'medium' ? 'M' : 'H'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 border-l border-white/5 pl-4 ml-2">
          <button
            onClick={onSaveProject}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
            title="Save Project (.json)"
          >
            <Save size={18} />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
            title="Load Project (.json)"
          >
            <Upload size={18} />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={onLoadProject} 
            className="hidden" 
            accept=".json"
          />
        </div>

        <div className="h-6 w-px bg-white/5 mx-2" />

        {/* Standard Export (canvas renderer) */}
        <button
          onClick={onExport}
          disabled={isExporting}
          className={`flex items-center gap-3 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-2xl ${
            isExporting
              ? 'bg-blue-600/20 text-blue-400 cursor-not-allowed'
              : 'bg-white text-black hover:bg-blue-500 hover:text-white active:scale-95'
          }`}
        >
          <Download size={14} strokeWidth={3} />
          {isExporting ? `Exporting ${Math.round(exportProgress)}%` : 'Export'}
        </button>
      </div>
    </header>
  );
}
