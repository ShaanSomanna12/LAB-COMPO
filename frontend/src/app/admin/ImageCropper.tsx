'use client';

import React, { useState, useEffect, useRef } from 'react';

interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedBase64: string) => void;
  onCancel: () => void;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageDimensions {
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
}

export default function ImageCropper({ imageSrc, onCropComplete, onCancel }: ImageCropperProps) {
  const [aspectRatio, setAspectRatio] = useState<'free' | '1:1' | '4:3' | '16:9'>('free');
  const [dimensions, setDimensions] = useState<ImageDimensions | null>(null);
  const [crop, setCrop] = useState<CropArea>({ x: 0, y: 0, width: 100, height: 100 });
  const [dragMode, setDragMode] = useState<'move' | 'nw' | 'ne' | 'se' | 'sw' | null>(null);
  const [startMouse, setStartMouse] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [startCrop, setStartCrop] = useState<CropArea>({ x: 0, y: 0, width: 100, height: 100 });
  
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleImageLoaded = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const { clientWidth, clientHeight, naturalWidth, naturalHeight } = img;
    
    setDimensions({
      width: clientWidth,
      height: clientHeight,
      naturalWidth,
      naturalHeight
    });

    // Default centered crop box (80% of minimum dimension)
    const boxSize = Math.min(clientWidth, clientHeight) * 0.8;
    const x = (clientWidth - boxSize) / 2;
    const y = (clientHeight - boxSize) / 2;
    setCrop({ x, y, width: boxSize, height: boxSize });
  };

  // Adjust crop aspect ratio when selection changes
  useEffect(() => {
    if (!dimensions) return;
    const { width: containerWidth, height: containerHeight } = dimensions;
    
    if (aspectRatio === 'free') return;
    
    const r = aspectRatio === '1:1' ? 1 : aspectRatio === '4:3' ? 4 / 3 : 16 / 9;
    
    // Recenter crop with new aspect ratio bounds
    let w = Math.min(containerWidth * 0.8, containerHeight * 0.8 * r);
    let h = w / r;
    
    if (h > containerHeight) {
      h = containerHeight * 0.8;
      w = h * r;
    }
    
    const x = (containerWidth - w) / 2;
    const y = (containerHeight - h) / 2;
    setCrop({ x, y, width: w, height: h });
  }, [aspectRatio, dimensions]);

  // Window-level mouse and touch listener for robust dragging
  useEffect(() => {
    if (!dragMode) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dimensions) return;
      const dx = e.clientX - startMouse.x;
      const dy = e.clientY - startMouse.y;
      
      const { width: containerWidth, height: containerHeight } = dimensions;

      if (dragMode === 'move') {
        let newX = startCrop.x + dx;
        let newY = startCrop.y + dy;
        
        // Keep within bounds
        newX = Math.max(0, Math.min(newX, containerWidth - startCrop.width));
        newY = Math.max(0, Math.min(newY, containerHeight - startCrop.height));
        
        setCrop(prev => ({ ...prev, x: newX, y: newY }));
      } else {
        // Resize corner modes
        let newX = startCrop.x;
        let newY = startCrop.y;
        let newW = startCrop.width;
        let newH = startCrop.height;

        if (dragMode === 'se') {
          newW = startCrop.width + dx;
          newH = startCrop.height + dy;
        } else if (dragMode === 'sw') {
          newX = startCrop.x + dx;
          newW = startCrop.width - dx;
          newH = startCrop.height + dy;
        } else if (dragMode === 'ne') {
          newY = startCrop.y + dy;
          newH = startCrop.height - dy;
          newW = startCrop.width + dx;
        } else if (dragMode === 'nw') {
          newX = startCrop.x + dx;
          newY = startCrop.y + dy;
          newW = startCrop.width - dx;
          newH = startCrop.height - dy;
        }

        // Apply aspect ratio constraints if locked
        if (aspectRatio !== 'free') {
          const r = aspectRatio === '1:1' ? 1 : aspectRatio === '4:3' ? 4 / 3 : 16 / 9;
          if (dragMode === 'se' || dragMode === 'ne') {
            newH = newW / r;
          } else if (dragMode === 'sw' || dragMode === 'nw') {
            newH = newW / r;
          }
        }

        // Apply sizing limits
        const minSize = 35;
        if (newW < minSize) {
          newW = minSize;
          if (dragMode === 'sw' || dragMode === 'nw') {
            newX = startCrop.x + startCrop.width - minSize;
          }
        }
        if (newH < minSize) {
          newH = minSize;
          if (dragMode === 'ne' || dragMode === 'nw') {
            newY = startCrop.y + startCrop.height - minSize;
          }
        }

        // Clamping inside box boundaries
        if (newX < 0) {
          newW += newX;
          newX = 0;
        }
        if (newY < 0) {
          newH += newY;
          newY = 0;
        }
        if (newX + newW > containerWidth) {
          newW = containerWidth - newX;
        }
        if (newY + newH > containerHeight) {
          newH = containerHeight - newY;
        }

        // Correct aspect ratio if boundary clamping broke it
        if (aspectRatio !== 'free') {
          const r = aspectRatio === '1:1' ? 1 : aspectRatio === '4:3' ? 4 / 3 : 16 / 9;
          if (Math.abs((newW / newH) - r) > 0.01) {
            if (newW / r <= containerHeight - newY) {
              newH = newW / r;
            } else {
              newW = newH * r;
              if (dragMode === 'sw' || dragMode === 'nw') {
                newX = startCrop.x + startCrop.width - newW;
              }
            }
          }
        }

        setCrop({ x: newX, y: newY, width: newW, height: newH });
      }
    };

    const handleMouseUp = () => {
      setDragMode(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      const touch = e.touches[0];
      const fakeEvent = { clientX: touch.clientX, clientY: touch.clientY } as MouseEvent;
      handleMouseMove(fakeEvent);
    };
    
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [dragMode, dimensions, startMouse, startCrop, aspectRatio]);

  const handleStartDrag = (mode: 'move' | 'nw' | 'ne' | 'se' | 'sw', clientX: number, clientY: number) => {
    setDragMode(mode);
    setStartMouse({ x: clientX, y: clientY });
    setStartCrop({ ...crop });
  };

  const handleApplyCrop = () => {
    if (!dimensions || !imgRef.current) return;

    const img = imgRef.current;
    const { width: displayedWidth, height: displayedHeight, naturalWidth, naturalHeight } = dimensions;

    const scaleX = naturalWidth / displayedWidth;
    const scaleY = naturalHeight / displayedHeight;

    const canvas = document.createElement('canvas');
    canvas.width = crop.width * scaleX;
    canvas.height = crop.height * scaleY;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(
      img,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    // Dynamic compression at 80% quality JPEG
    const base64Cropped = canvas.toDataURL('image/jpeg', 0.80);
    onCropComplete(base64Cropped);
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-60 p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-3xl shadow-2xl p-6 relative flex flex-col max-h-[92vh]">
        <button onClick={onCancel} className="absolute top-4 right-4 text-zinc-400 hover:text-white transition">✕</button>
        
        <h3 className="text-xl font-bold text-white mb-2">Crop Image</h3>
        <p className="text-xs text-zinc-400 mb-4">Drag inside the box to move it. Drag the white handles to resize the crop selection.</p>

        {/* Aspect Ratio Selector */}
        <div className="bg-zinc-950 p-1 rounded-lg border border-zinc-800 flex gap-1 mb-4 max-w-sm">
          {(['free', '1:1', '4:3', '16:9'] as const).map(ratio => (
            <button
              key={ratio}
              type="button"
              onClick={() => setAspectRatio(ratio)}
              className={`flex-1 text-center py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${aspectRatio === ratio ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-white'}`}
            >
              {ratio}
            </button>
          ))}
        </div>

        {/* Image Workspace Area */}
        <div className="flex-1 min-h-[300px] bg-zinc-950 rounded-lg overflow-hidden border border-zinc-850 flex items-center justify-center p-4 relative">
          <div 
            ref={containerRef}
            className="relative select-none"
            style={{ maxWidth: '100%', maxHeight: '60vh' }}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Source To Crop"
              onLoad={handleImageLoaded}
              className="block max-w-full max-h-[60vh] w-auto h-auto select-none pointer-events-none rounded-sm"
            />
            
            {dimensions && (
              <>
                {/* Crop Overlay selection viewport */}
                <div
                  className="absolute border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] rounded-sm overflow-hidden z-20 cursor-move"
                  style={{
                    left: `${crop.x}px`,
                    top: `${crop.y}px`,
                    width: `${crop.width}px`,
                    height: `${crop.height}px`,
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleStartDrag('move', e.clientX, e.clientY);
                  }}
                  onTouchStart={(e) => {
                    if (e.touches.length > 0) {
                      const touch = e.touches[0];
                      handleStartDrag('move', touch.clientX, touch.clientY);
                    }
                  }}
                >
                  {/* Grid Lines inside crop area */}
                  <div className="absolute top-1/3 left-0 right-0 h-[1px] border-t border-dashed border-white/35 pointer-events-none"></div>
                  <div className="absolute top-2/3 left-0 right-0 h-[1px] border-t border-dashed border-white/35 pointer-events-none"></div>
                  <div className="absolute left-1/3 top-0 bottom-0 w-[1px] border-l border-dashed border-white/35 pointer-events-none"></div>
                  <div className="absolute left-2/3 top-0 bottom-0 w-[1px] border-l border-dashed border-white/35 pointer-events-none"></div>
                  
                  {/* Aspect Ratio Box Text */}
                  <div className="absolute bottom-1 right-2 bg-black/60 px-1 py-0.5 rounded text-[8px] font-black font-mono text-white/80 pointer-events-none uppercase tracking-wider">
                    {aspectRatio === 'free' ? 'Custom' : aspectRatio}
                  </div>
                </div>

                {/* Handles placed outside viewport for perfect grabbing coordinates */}
                <div
                  className="absolute z-30 select-none"
                  style={{
                    left: `${crop.x}px`,
                    top: `${crop.y}px`,
                    width: `${crop.width}px`,
                    height: `${crop.height}px`,
                    pointerEvents: 'none'
                  }}
                >
                  {/* Corner Handles */}
                  <div
                    className="w-3.5 h-3.5 bg-white absolute rounded-full border border-zinc-950 top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize z-40"
                    style={{ pointerEvents: 'auto' }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleStartDrag('nw', e.clientX, e.clientY);
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      if (e.touches.length > 0) {
                        const touch = e.touches[0];
                        handleStartDrag('nw', touch.clientX, touch.clientY);
                      }
                    }}
                  />
                  <div
                    className="w-3.5 h-3.5 bg-white absolute rounded-full border border-zinc-950 top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize z-40"
                    style={{ pointerEvents: 'auto' }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleStartDrag('ne', e.clientX, e.clientY);
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      if (e.touches.length > 0) {
                        const touch = e.touches[0];
                        handleStartDrag('ne', touch.clientX, touch.clientY);
                      }
                    }}
                  />
                  <div
                    className="w-3.5 h-3.5 bg-white absolute rounded-full border border-zinc-950 bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize z-40"
                    style={{ pointerEvents: 'auto' }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleStartDrag('sw', e.clientX, e.clientY);
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      if (e.touches.length > 0) {
                        const touch = e.touches[0];
                        handleStartDrag('sw', touch.clientX, touch.clientY);
                      }
                    }}
                  />
                  <div
                    className="w-3.5 h-3.5 bg-white absolute rounded-full border border-zinc-950 bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize z-40"
                    style={{ pointerEvents: 'auto' }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleStartDrag('se', e.clientX, e.clientY);
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      if (e.touches.length > 0) {
                        const touch = e.touches[0];
                        handleStartDrag('se', touch.clientX, touch.clientY);
                      }
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex gap-3 mt-6 border-t border-zinc-800 pt-4 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-bold transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApplyCrop}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-blue-500/10"
          >
            Apply Crop ✓
          </button>
        </div>
      </div>
    </div>
  );
}
