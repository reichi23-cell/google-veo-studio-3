import React from 'react';
import { formatTime } from '../../../utils/timeUtils';

interface TimeRulerProps {
  duration: number;
  zoom: number;
}

export const TimeRuler: React.FC<TimeRulerProps> = ({ duration, zoom }) => {
  return (
    <div className="absolute top-0 left-0 right-0 h-[54px] border-b-2 border-blue-600 bg-[#0a0c16] z-40 overflow-hidden pointer-events-none shadow-lg">
      {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => {
        const isMajor = i % 5 === 0;
        const isMinute = i % 60 === 0;
        
        return (
          <div key={i} className="absolute bottom-0 h-full flex flex-col justify-end" style={{ left: i * zoom }}>
            {isMajor ? (
              <div className="flex flex-col items-center pb-0.5">
                <span className={`text-[8px] font-mono tabular-nums mb-1 ${isMinute ? 'text-blue-400 font-black' : 'text-zinc-500 font-bold'}`}>
                  {formatTime(i).split('.')[0]}
                </span>
                <div className={`w-0.5 ${isMinute ? 'h-4 bg-blue-500' : 'h-2 bg-zinc-600'}`} />
              </div>
            ) : (
              <div className="w-px h-1 bg-zinc-800 mb-0.5" />
            )}
          </div>
        );
      })}
    </div>
  );
};
