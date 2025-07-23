import React, { useRef, useEffect, useState, useCallback } from 'react';
import { DrawData, ClearData, CanvasEventData, Tool, TextData } from '../types';
import Icon from './Icon';
import { ICON_PATHS } from '../constants';

const CANVAS_BG_COLOR = '#1F2937';
const FONT_SIZE = 20;

interface CanvasViewProps {
    sendDrawData: (data: DrawData) => void;
    sendTextData: (data: TextData) => void;
    sendClearCanvas: () => void;
    lastCanvasEvent: CanvasEventData | null;
}

type CanvasAction = DrawData | TextData;

export const CanvasView: React.FC<CanvasViewProps> = ({ sendDrawData, sendTextData, sendClearCanvas, lastCanvasEvent }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    // Tool State
    const [tool, setTool] = useState<Tool>('pen');
    const [color, setColor] = useState('#FFFFFF');
    const [lineWidth, setLineWidth] = useState(5);
    
    // Interaction State
    const [isDrawing, setIsDrawing] = useState(false);
    const lastPosRef = useRef<{ x: number, y: number } | null>(null);
    const [textInput, setTextInput] = useState({ active: false, x: 0, y: 0, value: ''});
    
    // View State
    const [transform, setTransform] = useState({ scale: 1, offset: { x: 0, y: 0 } });
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef({ x: 0, y: 0 });
    const lastTouchDistanceRef = useRef<number | null>(null);
    const midPointRef = useRef<{ x: number, y: number } | null>(null);

    // History State
    const [peerHistory, setPeerHistory] = useState<CanvasAction[]>([]);
    const [localHistory, setLocalHistory] = useState<CanvasAction[]>([]);
    const [historyPointer, setHistoryPointer] = useState(-1);

    const setupCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const parent = canvas.parentElement;
        if (!parent) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = parent.clientWidth * dpr;
        canvas.height = parent.clientHeight * dpr;
        
        const context = canvas.getContext('2d');
        if (!context) return;
        context.scale(dpr, dpr);
    }, []);

    useEffect(() => {
        setupCanvas();
        window.addEventListener('resize', setupCanvas);
        return () => window.removeEventListener('resize', setupCanvas);
    }, [setupCanvas]);

    // Handle incoming peer events
    useEffect(() => {
        if (!lastCanvasEvent) return;
        if (lastCanvasEvent.type === 'draw' || lastCanvasEvent.type === 'text') {
            setPeerHistory(prev => [...prev, lastCanvasEvent]);
        } else if (lastCanvasEvent.type === 'clear') {
            setPeerHistory([]);
            setLocalHistory([]);
            setHistoryPointer(-1);
        }
    }, [lastCanvasEvent]);
    
    const addLocalAction = (action: CanvasAction) => {
        const newHistory = localHistory.slice(0, historyPointer + 1);
        newHistory.push(action);
        setLocalHistory(newHistory);
        setHistoryPointer(newHistory.length - 1);
    };

    // Main rendering loop
    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) return;
        
        const dpr = window.devicePixelRatio || 1;

        context.save();
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.fillStyle = CANVAS_BG_COLOR;
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.restore();

        context.save();
        context.translate(transform.offset.x, transform.offset.y);
        context.scale(transform.scale, transform.scale);
        
        const visibleHistory = localHistory.slice(0, historyPointer + 1);
        const allEvents = [...peerHistory, ...visibleHistory];
        
        for (const event of allEvents) {
             if (event.type === 'draw') {
                context.beginPath();
                context.moveTo(event.x0, event.y0);
                context.lineTo(event.x1, event.y1);
                context.strokeStyle = event.tool === 'eraser' ? CANVAS_BG_COLOR : event.color;
                context.lineWidth = event.lineWidth;
                context.lineCap = 'round';
                context.lineJoin = 'round';
                context.stroke();
                context.closePath();
             } else if (event.type === 'text') {
                context.font = event.font;
                context.fillStyle = event.color;
                context.textAlign = 'left';
                context.textBaseline = 'top';
                context.fillText(event.text, event.x, event.y);
             }
        }

        context.restore();
    }, [peerHistory, localHistory, historyPointer, transform]);

    const getCoords = (clientX: number, clientY: number): { x: number, y: number } | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const worldX = (clientX - rect.left - transform.offset.x) / transform.scale;
        const worldY = (clientY - rect.top - transform.offset.y) / transform.scale;
        return { x: worldX, y: worldY };
    }
    
    const startDrawing = (event: React.MouseEvent | React.TouchEvent) => {
        const coords = getCoords(
            'touches' in event.nativeEvent ? event.nativeEvent.touches[0].clientX : event.nativeEvent.clientX,
            'touches' in event.nativeEvent ? event.nativeEvent.touches[0].clientY : event.nativeEvent.clientY
        );
        if (!coords) return;
        setIsDrawing(true);
        lastPosRef.current = coords;
    };

    const drawOnMove = (event: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const currentPos = getCoords(
            'touches' in event.nativeEvent ? event.nativeEvent.touches[0].clientX : event.nativeEvent.clientX,
            'touches' in event.nativeEvent ? event.nativeEvent.touches[0].clientY : event.nativeEvent.clientY
        );
        const lastPos = lastPosRef.current;
        if (!currentPos || !lastPos) return;

        const drawEvent: DrawData = {
            type: 'draw', tool: tool as 'pen' | 'eraser', x0: lastPos.x, y0: lastPos.y, x1: currentPos.x, y1: currentPos.y, color, lineWidth
        };
        addLocalAction(drawEvent);
        sendDrawData(drawEvent);
        lastPosRef.current = currentPos;
    };

    const finishDrawing = () => {
        setIsDrawing(false);
        lastPosRef.current = null;
    };
    
    const handleTextSubmit = () => {
        if (!textInput.active || !textInput.value.trim()) {
            setTextInput({ active: false, x: 0, y: 0, value: '' });
            return;
        };
        const font = `${FONT_SIZE}px sans-serif`;
        const textEvent: TextData = {
            type: 'text',
            x: textInput.x,
            y: textInput.y,
            text: textInput.value,
            color: color,
            font: font
        };
        addLocalAction(textEvent);
        sendTextData(textEvent);
        setTextInput({ active: false, x: 0, y: 0, value: '' });
    };

    // --- MOUSE & TOUCH EVENT HANDLERS ---
    
    const onMouseDown = (event: React.MouseEvent) => {
        if (event.button === 0) { // Left click
            if (tool === 'pen' || tool === 'eraser') {
                 startDrawing(event);
            } else if (tool === 'text') {
                handleTextSubmit(); // Submit previous text if any
                const coords = getCoords(event.clientX, event.clientY);
                if(coords) setTextInput({ active: true, x: coords.x, y: coords.y, value: '' });
            }
        } else if (event.button === 2) { // Right click
            setIsPanning(true);
            panStartRef.current = { x: event.clientX - transform.offset.x, y: event.clientY - transform.offset.y };
        }
    };

    const onMouseMove = (event: React.MouseEvent) => {
        if (isPanning) {
            setTransform(prev => ({ ...prev, offset: { x: event.clientX - panStartRef.current.x, y: event.clientY - panStartRef.current.y } }));
        } else if (isDrawing) {
            drawOnMove(event);
        }
    };

    const onMouseUp = (event: React.MouseEvent) => {
        if (event.button === 0) finishDrawing();
        else if (event.button === 2) setIsPanning(false);
    };
    
    const onTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            if (tool === 'pen' || tool === 'eraser') {
                startDrawing(e);
            } else if (tool === 'text') {
                handleTextSubmit();
                const coords = getCoords(e.touches[0].clientX, e.touches[0].clientY);
                if(coords) setTextInput({ active: true, x: coords.x, y: coords.y, value: '' });
            }
        } else if (e.touches.length >= 2) {
            setIsDrawing(false); // Stop drawing if second finger is added
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            lastTouchDistanceRef.current = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            midPointRef.current = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
            panStartRef.current = { x: midPointRef.current.x - transform.offset.x, y: midPointRef.current.y - transform.offset.y };
        }
    };
    
    const onTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            drawOnMove(e);
        } else if (e.touches.length >= 2) {
            e.preventDefault();
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const newDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            const newMidPoint = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };

            // Pan
            const newOffsetX = newMidPoint.x - panStartRef.current.x;
            const newOffsetY = newMidPoint.y - panStartRef.current.y;
            
            // Zoom
            const scaleFactor = lastTouchDistanceRef.current ? newDist / lastTouchDistanceRef.current : 1;
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const mouseX = newMidPoint.x - rect.left;
            const mouseY = newMidPoint.y - rect.top;

            const finalOffsetX = mouseX - (mouseX - newOffsetX) * scaleFactor;
            const finalOffsetY = mouseY - (mouseY - newOffsetY) * scaleFactor;

            setTransform(prev => ({
                scale: Math.max(0.1, Math.min(10, prev.scale * scaleFactor)),
                offset: { x: finalOffsetX, y: finalOffsetY }
            }));

            lastTouchDistanceRef.current = newDist;
            panStartRef.current = { x: newMidPoint.x - finalOffsetX, y: newMidPoint.y - finalOffsetY };
        }
    };
    
    const onTouchEnd = () => {
        lastTouchDistanceRef.current = null;
        midPointRef.current = null;
        finishDrawing();
    };
    
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const scaleAmount = -e.deltaY * 0.001;
        const newScale = Math.max(0.1, Math.min(10, transform.scale + scaleAmount));
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX - transform.offset.x) / transform.scale;
        const worldY = (mouseY - transform.offset.y) / transform.scale;

        const newOffsetX = mouseX - worldX * newScale;
        const newOffsetY = mouseY - worldY * newScale;

        setTransform({
            scale: newScale,
            offset: { x: newOffsetX, y: newOffsetY }
        });
    };

    // --- UI Button Handlers ---
    const handleUndo = () => setHistoryPointer(p => Math.max(-1, p - 1));
    const handleRedo = () => setHistoryPointer(p => Math.min(localHistory.length - 1, p + 1));
    const handleClearCanvas = () => {
        setPeerHistory([]);
        setLocalHistory([]);
        setHistoryPointer(-1);
        sendClearCanvas();
    };

    const handleZoom = (factor: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const { width, height } = canvas.getBoundingClientRect();
        const centerX = width / 2;
        const centerY = height / 2;

        const newScale = Math.max(0.1, Math.min(10, transform.scale * factor));

        const worldX = (centerX - transform.offset.x) / transform.scale;
        const worldY = (centerY - transform.offset.y) / transform.scale;

        const newOffsetX = centerX - worldX * newScale;
        const newOffsetY = centerY - worldY * newScale;

        setTransform({
            scale: newScale,
            offset: { x: newOffsetX, y: newOffsetY }
        });
    }
    const handleResetView = () => {
        setTransform({ scale: 1, offset: { x: 0, y: 0 } });
    }

    const ToolButton: React.FC<{ myTool: Tool, label: string, icon: string }> = ({myTool, label, icon}) => (
         <button onClick={() => setTool(myTool)} className={`p-2 rounded-lg transition-colors ${tool === myTool ? 'bg-blue-600 text-white' : 'bg-dark-surface hover:bg-gray-600'}`} aria-label={label}>
            <Icon path={icon} className="w-5 h-5"/>
        </button>
    )

    return (
        <div className="relative h-full w-full bg-gray-800 rounded-b-lg touch-none" style={{ cursor: tool === 'text' ? 'text' : isPanning ? 'grabbing' : 'crosshair' }}>
            <canvas
                ref={canvasRef}
                className="w-full h-full"
                onMouseDown={onMouseDown} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onMouseMove={onMouseMove} onWheel={handleWheel} onContextMenu={(e) => e.preventDefault()}
                onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd} onTouchMove={onTouchMove}
            />
            
            {/* Toolbar */}
            <div className="absolute top-2 left-2 flex flex-wrap items-center gap-2 bg-dark-bg p-2 rounded-lg shadow-md">
                <div className="flex items-center gap-1 border-r border-dark-border pr-2">
                    <ToolButton myTool='pen' label='Pen' icon={ICON_PATHS.pen} />
                    <ToolButton myTool='eraser' label='Eraser' icon={ICON_PATHS.eraser} />
                    <ToolButton myTool='text' label='Text' icon={ICON_PATHS.text} />
                </div>
                 <div className="flex items-center gap-1 border-r border-dark-border pr-2">
                    <button onClick={handleUndo} disabled={historyPointer < 0} className="p-2 rounded-lg transition-colors bg-dark-surface hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Undo">
                        <Icon path={ICON_PATHS.undo} className="w-5 h-5"/>
                    </button>
                    <button onClick={handleRedo} disabled={historyPointer >= localHistory.length - 1} className="p-2 rounded-lg transition-colors bg-dark-surface hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Redo">
                        <Icon path={ICON_PATHS.redo} className="w-5 h-5"/>
                    </button>
                 </div>
                 <div className="flex items-center gap-1 border-r border-dark-border pr-2">
                    <button onClick={() => handleZoom(1.2)} className="p-2 rounded-lg transition-colors bg-dark-surface hover:bg-gray-600" aria-label="Zoom In">
                        <Icon path={ICON_PATHS.zoomIn} className="w-5 h-5"/>
                    </button>
                    <button onClick={() => handleZoom(0.8)} className="p-2 rounded-lg transition-colors bg-dark-surface hover:bg-gray-600" aria-label="Zoom Out">
                        <Icon path={ICON_PATHS.zoomOut} className="w-5 h-5"/>
                    </button>
                    <button onClick={handleResetView} className="p-2 rounded-lg transition-colors bg-dark-surface hover:bg-gray-600" aria-label="Reset View">
                        <Icon path={ICON_PATHS.resetView} className="w-5 h-5"/>
                    </button>
                 </div>
                <div className="flex items-center gap-2">
                    <input type="color" id="color-picker" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-8 p-0 border-none rounded bg-dark-surface cursor-pointer" />
                    <input type="range" id="line-width" min="1" max="50" value={lineWidth} onChange={(e) => setLineWidth(Number(e.target.value))} className="w-24 cursor-pointer" />
                </div>
                <button onClick={handleClearCanvas} className="bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-2 px-3 rounded-lg transition-colors">
                    Clear All
                </button>
            </div>

            {textInput.active && (
                <textarea
                    autoFocus
                    value={textInput.value}
                    onChange={(e) => setTextInput(prev => ({ ...prev, value: e.target.value }))}
                    onBlur={handleTextSubmit}
                    onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTextSubmit(); }}}
                    style={{
                        position: 'absolute',
                        left: `${transform.offset.x + textInput.x * transform.scale}px`,
                        top: `${transform.offset.y + textInput.y * transform.scale}px`,
                        transform: `scale(${transform.scale})`,
                        transformOrigin: 'top left',
                        fontSize: `${FONT_SIZE}px`,
                        lineHeight: 1.2,
                        color: color,
                        background: 'transparent',
                        border: `1px dashed ${color}`,
                        outline: 'none',
                        resize: 'none',
                        overflow: 'hidden',
                        minWidth: '100px',
                    }}
                    className="p-1 font-sans"
                />
            )}
        </div>
    );
};