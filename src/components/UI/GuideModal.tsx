/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Video, Zap, Scissors, Download, Sparkles } from 'lucide-react';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GuideModal({ isOpen, onClose }: GuideModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[300] flex items-center justify-center p-6 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-[0_0_100px_rgba(37,99,235,0.1)] my-auto"
      >
        <div className="p-8 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-blue-600 rounded-2xl shadow-xl shadow-blue-600/20">
               <Video size={24} className="text-white" />
             </div>
             <div>
               <h2 className="text-2xl font-black text-white tracking-tight">How to use Veo Studio</h2>
               <p className="text-xs text-zinc-500 font-medium uppercase tracking-[0.2em]">Quick Start Guide</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-zinc-500 hover:text-white transition-all"><X size={24}/></button>
        </div>

        <div className="p-10 space-y-10">
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-4">
               <div className="flex items-center gap-3 text-blue-400">
                  <Sparkles size={18} />
                  <h3 className="text-sm font-bold uppercase tracking-widest">Generate</h3>
               </div>
               <p className="text-sm text-zinc-400 leading-relaxed">Go to the <span className="text-white font-bold">Veo AI</span> tab to generate cinematic videos or high-fidelity images using natural language prompts.</p>
            </div>
            
            <div className="space-y-4">
               <div className="flex items-center gap-3 text-purple-400">
                  <Zap size={18} />
                  <h3 className="text-sm font-bold uppercase tracking-widest">Sequence</h3>
               </div>
               <p className="text-sm text-zinc-400 leading-relaxed">Drag assets onto the timeline. You can layer multiple videos, images, and audio tracks for complex compositing.</p>
            </div>

            <div className="space-y-4">
               <div className="flex items-center gap-3 text-red-400">
                  <Scissors size={18} />
                  <h3 className="text-sm font-bold uppercase tracking-widest">Edit</h3>
               </div>
               <p className="text-sm text-zinc-400 leading-relaxed">Use <span className="text-white font-bold">C</span> to split clips and <span className="text-white font-bold">Delete</span> to remove. Drag clip edges to trim.</p>
            </div>

            <div className="space-y-4">
               <div className="flex items-center gap-3 text-green-400">
                  <Download size={18} />
                  <h3 className="text-sm font-bold uppercase tracking-widest">Export</h3>
               </div>
               <p className="text-sm text-zinc-400 leading-relaxed">Once finished, hit <span className="text-white font-bold">Export</span> to render your project as a high-quality MP4 file directly in your browser.</p>
            </div>
          </div>

          <div className="p-6 bg-blue-600/5 border border-blue-500/10 rounded-2xl">
             <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3">Keyboard Shortcuts</h4>
             <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
                <div className="flex justify-between border-b border-white/5 pb-2">
                   <span className="text-zinc-500">Play / Pause</span>
                   <span className="text-white font-mono bg-zinc-800 px-2 rounded">Space</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                   <span className="text-zinc-500">Split (Cutter)</span>
                   <span className="text-white font-mono bg-zinc-800 px-2 rounded">C</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                   <span className="text-zinc-500">Move Clip</span>
                   <span className="text-white font-mono bg-zinc-800 px-2 rounded">Arrows</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                   <span className="text-zinc-500">Fast Move (+Shift)</span>
                   <span className="text-white font-mono bg-zinc-800 px-2 rounded">Shift + Arrows</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                   <span className="text-zinc-500">Zoom Timeline</span>
                   <span className="text-white font-mono bg-zinc-800 px-2 rounded">W / E</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                   <span className="text-zinc-500">Group Selected</span>
                   <span className="text-white font-mono bg-zinc-800 px-2 rounded">G</span>
                </div>
             </div>
          </div>
        </div>

        <div className="p-8 bg-black/20 text-center">
           <button 
             onClick={onClose}
             className="px-12 py-3 bg-white text-black text-xs font-black uppercase tracking-[0.3em] rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-xl shadow-white/5"
           >
             Got it
           </button>
        </div>
      </motion.div>
    </div>
  );
}
