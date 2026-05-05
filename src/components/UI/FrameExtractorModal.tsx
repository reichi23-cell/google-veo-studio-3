import React, { useState, useRef, useEffect } from 'react';
import { X, CheckCircle, Loader2, FolderOpen, Video } from 'lucide-react';

interface FrameExtractorModalProps {
  videoUrl: string;
  videoName: string;
  onClose: () => void;
  initialSeekTime?: number; // Optional: specify exactly where to extract
}

export const FrameExtractorModal: React.FC<FrameExtractorModalProps> = ({ 
  videoUrl, 
  videoName, 
  onClose,
  initialSeekTime 
}) => {
  const [baseName, setBaseName] = useState(videoName.replace(/\.[^/.]+$/, ""));
  const [lastFrameUrl, setLastFrameUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [canExtract, setCanExtract] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleLoadedMetadata = () => {
      setCanExtract(true);
      setStatusMessage('動画の読み込み完了');
    };
    if (video.readyState >= 1) handleLoadedMetadata();
    else video.addEventListener('loadedmetadata', handleLoadedMetadata);
    return () => video.removeEventListener('loadedmetadata', handleLoadedMetadata);
  }, [videoUrl]);

  const extractLastFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsProcessing(true);
    setStatusMessage('フレームを解析中...');
    const video = videoRef.current;
    
    // Determine the seek time: use initialSeekTime if provided, otherwise use duration
    const targetTime = (initialSeekTime !== undefined && initialSeekTime > 0) 
      ? Math.min(initialSeekTime, video.duration || 99999) 
      : (video.duration || 0.1);
    
    // Back off slightly to ensure we capture a valid frame
    const finalSeekTime = Math.max(0, targetTime - 0.05);

    const timeout = setTimeout(() => {
      if (isProcessing) {
        setIsProcessing(false);
        setStatusMessage('解析がタイムアウトしました。');
      }
    }, 5000);

    video.currentTime = finalSeekTime;
    
    video.onseeked = () => {
      clearTimeout(timeout);
      const canvas = canvasRef.current!;
      const width = video.videoWidth;
      const height = video.videoHeight;
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, width, height);
        setLastFrameUrl(canvas.toDataURL('image/png'));
        setIsProcessing(false);
        setStatusMessage(`抽出完了: ${width} x ${height}px (${finalSeekTime.toFixed(2)}s)`);
      }
    };
  };

  const saveToFolder = async () => {
    if (!lastFrameUrl || !baseName) return;
    setIsSaving(true);
    setStatusMessage('保存中...');

    try {
      const isElectron = window && (window as any).process && (window as any).process.type;
      
      if (isElectron) {
        const electron = (window as any).require('electron');
        const fs = (window as any).require('fs');
        const path = (window as any).require('path');
        const { ipcRenderer } = electron;
        
        const targetDir = await ipcRenderer.invoke('select-directory');
        if (!targetDir) {
          setIsSaving(false);
          setStatusMessage('保存をキャンセルしました。');
          return;
        }

        const safeBaseName = baseName.replace(/[/\\?%*:|"<>]/g, '-');
        const ext = videoName.includes('.') ? videoName.split('.').pop() : 'mp4';
        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14); // YYYYMMDDHHMMSS
        
        setStatusMessage('動画を保存中...');
        const videoResponse = await fetch(videoUrl);
        const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
        const videoPath = path.join(targetDir, `${safeBaseName}_${timestamp}_video.${ext}`);
        fs.writeFileSync(videoPath, videoBuffer);

        setStatusMessage('画像を保存中...');
        const imagePath = path.join(targetDir, `${safeBaseName}_${timestamp}_frame.png`);
        const imageData = lastFrameUrl.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(imageData, 'base64');
        fs.writeFileSync(imagePath, imageBuffer);

        setStatusMessage(`✅ 保存完了: ${targetDir}`);
      } else {
        const dirHandle = await (window as any).showDirectoryPicker();
        const ext = 'mp4';
        const videoResponse = await fetch(videoUrl);
        const videoBlob = await videoResponse.blob();
        const videoHandle = await dirHandle.getFileHandle(`${baseName}_video.${ext}`, { create: true });
        const videoWritable = await videoHandle.createWritable();
        await videoWritable.write(videoBlob);
        await videoWritable.close();
        const imageHandle = await dirHandle.getFileHandle(`${baseName}_frame.png`, { create: true });
        const imageWritable = await imageHandle.createWritable();
        const imageBlob = await (await fetch(lastFrameUrl)).blob();
        await imageWritable.write(imageBlob);
        await imageWritable.close();
        setStatusMessage(`✅ 保存完了！`);
      }
      setIsSaving(false);
    } catch (err: any) {
      console.error(err);
      setStatusMessage(`❌ 保存エラー: ${err.message}`);
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl text-white">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Video className="text-blue-500" size={24} />
            <h2 className="text-xl font-bold">フレーム抽出</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Preview</span>
              <div className="aspect-video bg-black rounded-lg overflow-hidden border border-white/5 flex items-center justify-center relative">
                <video ref={videoRef} src={videoUrl} className="max-h-full" muted preload="auto" playsInline />
                {initialSeekTime !== undefined && (
                   <div className="absolute bottom-2 left-2 bg-blue-600 px-2 py-0.5 rounded text-[10px] font-bold">
                     Target: {initialSeekTime.toFixed(2)}s
                   </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Extracted Frame</span>
              <div className="aspect-video bg-black rounded-lg overflow-hidden border border-white/5 flex items-center justify-center">
                {lastFrameUrl ? (
                  <img src={lastFrameUrl} className="max-h-full object-contain" alt="Extracted frame" />
                ) : (
                  <div className="text-zinc-600 text-sm">{isProcessing ? '解析中...' : '解析前'}</div>
                )}
              </div>
            </div>
          </div>
          {lastFrameUrl && (
            <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-3">
              <label className="text-xs text-zinc-400 font-bold uppercase tracking-widest">保存ファイル名（ベース）</label>
              <input 
                type="text" value={baseName} onChange={(e) => setBaseName(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm focus:border-blue-500 outline-none"
              />
            </div>
          )}
          {statusMessage && (
            <div className={`text-center py-3 rounded-lg text-sm font-bold ${statusMessage.includes('✅') ? 'bg-green-500/10 text-green-400' : statusMessage.includes('❌') ? 'bg-red-500/10 text-red-400' : 'text-blue-400'}`}>
              {statusMessage}
            </div>
          )}
        </div>
        <div className="p-6 border-t border-white/5 flex items-center justify-end gap-4 bg-[#0d0d0d]">
          {!lastFrameUrl ? (
            <button 
              onClick={extractLastFrame} disabled={isProcessing || !canExtract}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all"
            >
              {isProcessing ? <Loader2 className="animate-spin" size={18} /> : null}
              フレームを抽出
            </button>
          ) : (
            <>
              <button onClick={() => setLastFrameUrl('')} className="text-zinc-400 hover:text-white text-sm font-bold">やり直し</button>
              <button 
                onClick={saveToFolder} disabled={isSaving}
                className="bg-white text-black hover:bg-zinc-200 disabled:opacity-50 px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]"
              >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <FolderOpen size={18} />}
                フォルダに保存
              </button>
            </>
          )}
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};
