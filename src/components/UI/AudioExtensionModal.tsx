/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Music, Sparkles, X, Wand2 } from 'lucide-react';
import { VideoClip } from '../../types';

interface AudioExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (prompt: string) => void;
  originalClip: VideoClip;
  extensionDuration: number;
}

export default function AudioExtensionModal({ isOpen, onClose, onGenerate, originalClip, extensionDuration }: AudioExtensionModalProps) {
  const [prompt, setPrompt] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#1a1a1a] border border-[#333] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-[#333] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <Music size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">AI Audio Extension</h2>
              <p className="text-xs text-indigo-400 font-bold uppercase tracking-widest">Extending by {extensionDuration.toFixed(1)}s</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X size={20}/></button>
        </div>

        <div className="p-8 space-y-6">
          <div className="p-4 bg-indigo-900/10 border border-indigo-500/20 rounded-xl flex gap-4">
             <div className="w-12 h-12 bg-indigo-600/20 rounded-lg flex items-center justify-center text-indigo-400 shrink-0">
               <Music size={24}/>
             </div>
             <div className="space-y-1">
               <p className="text-xs font-bold text-white uppercase tracking-wider">{originalClip.name}</p>
               <p className="text-[10px] text-gray-500 leading-relaxed">The AI will analyze the spectral patterns and continue the audio based on your prompt.</p>
             </div>
          </div>

          <div className="space-y-3">
             <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Continuation Prompt</label>
             <div className="relative">
                <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. Continue with a building cinematic swell followed by a dramatic silence..."
                  className="w-full bg-black border border-[#333] rounded-xl px-4 py-4 text-sm text-white focus:border-indigo-500 outline-none transition-all h-32 resize-none"
                />
             </div>
          </div>
        </div>

        <div className="p-6 bg-[#252525] flex gap-4">
          <button onClick={onClose} className="flex-1 py-3 text-xs font-bold text-gray-500 uppercase tracking-widest hover:text-white transition-colors">Cancel</button>
          <button 
            onClick={() => onGenerate(prompt)}
            disabled={!prompt.trim()}
            className="flex-[2] py-3 bg-indigo-600 text-white text-xs font-black uppercase tracking-[0.2em] rounded-xl hover:bg-indigo-500 disabled:opacity-30 transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/20"
          >
            <Sparkles size={16} /> Generate {extensionDuration.toFixed(1)}s Extension
          </button>
        </div>
      </motion.div>
    </div>
  );
}
