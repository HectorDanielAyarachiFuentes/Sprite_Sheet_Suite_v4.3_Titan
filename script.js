document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const appContainer = document.querySelector('.app-container');
    const welcomeScreen = document.getElementById('welcome-screen');
    const dropZone = document.getElementById('drop-zone');
    const imageLoader = document.getElementById('image-loader');
    const imageDisplay = document.getElementById('image-display');
    const canvas = document.getElementById('measurement-canvas'), ctx = canvas.getContext('2d');
    const rulerTop = document.getElementById('ruler-top'), ctxTop = rulerTop.getContext('2d');
    const rulerLeft = document.getElementById('ruler-left'), ctxLeft = rulerLeft.getContext('2d');
    const imageDimensionsP = document.getElementById('image-dimensions');
    const framesList = document.getElementById('frames-list');
    const rowsInput = document.getElementById('rows-input'), colsInput = document.getElementById('cols-input');
    const cellWInput = document.getElementById('cell-w-input'), cellHInput = document.getElementById('cell-h-input');
    const generateGridButton = document.getElementById('generate-grid-button');
    const generateBySizeButton = document.getElementById('generate-by-size-button');
    const clearButton = document.getElementById('clear-button');
    const previewCanvas = document.getElementById('preview-canvas'), previewCtx = previewCanvas.getContext('2d');
    const playPauseButton = document.getElementById('play-pause-button');
    const firstFrameButton = document.getElementById('first-frame-button');
    const lastFrameButton = document.getElementById('last-frame-button');
    const fpsSlider = document.getElementById('fps-slider'), fpsValue = document.getElementById('fps-value');
    const undoButton = document.getElementById('undo-button');
    const redoButton = document.getElementById('redo-button');
    const clipsSelect = document.getElementById('clips-select');
    const newClipButton = document.getElementById('new-clip-button');
    const renameClipButton = document.getElementById('rename-clip-button');
    const deleteClipButton = document.getElementById('delete-clip-button');
    const selectAllFramesButton = document.getElementById('select-all-frames');
    const deselectAllFramesButton = document.getElementById('deselect-all-frames');
    const changeImageButton = document.getElementById('change-image-button');
    const toast = document.getElementById('toast');
    const projectHistoryList = document.getElementById('project-history-list');
    const allControls = document.querySelectorAll('button, input, select');
    const lockFramesButton = document.getElementById('lock-frames-button');
    const fullscreenButton = document.getElementById('fullscreen-button');
    const exportZipButton = document.getElementById('export-zip-button');
    const exportGifButton = document.getElementById('export-gif-button');
    const maxGifSizeInput = document.getElementById('max-gif-size');
    const exportCodeButton = document.getElementById('export-code-button');
    const codePreviewContainer = document.getElementById('code-preview-container');
    const htmlCodeOutput = document.getElementById('html-code-output');
    const cssCodeOutput = document.getElementById('css-code-output');
    const htmlLineNumbers = document.getElementById('html-line-numbers');
    const cssLineNumbers = document.getElementById('css-line-numbers');
    const livePreviewIframe = document.getElementById('live-preview-iframe');
    const jsonOutput = document.getElementById('json-output');
    const jsonFormatSelect = document.getElementById('json-format-select');
    const jsonLineNumbers = document.getElementById('json-line-numbers');
    const autoDetectButton = document.getElementById('auto-detect-button');
    const autoDetectToleranceInput = document.getElementById('auto-detect-tolerance');
    const exportScaleInput = document.getElementById('export-scale-input');


    // --- App State ---
    let frames = [], clips = [], activeClipId = null;
    let historyStack = [], historyIndex = -1;
    let localHistoryStack = [], localHistoryIndex = -1, localHistoryFrameId = null;
    let selectedFrameId = null;
    let animationState = { isPlaying: false, fps: 12, currentFrameIndex: 0, lastTime: 0, animationFrameId: null };
    let currentFileName = "spritesheet.png";
    let isReloadingFromStorage = false;
    let isLocked = false;

    // --- Interaction State ---
    let isDrawing = false, isDragging = false, isResizing = false, isDraggingSlice = false;
    let startPos = { x: 0, y: 0 };
    let newRect = null;
    let resizeHandle = null;
    let draggedSlice = null;
    const HANDLE_SIZE = 8;
    const SLICE_HANDLE_WIDTH = 6;

    // --- Local Storage & History ---
    const saveCurrentSession = () => { if (!imageDisplay.src || imageDisplay.src.startsWith('http')) return; const state = { imageSrc: imageDisplay.src, fileName: currentFileName, frames, clips, activeClipId, historyStack, historyIndex }; localStorage.setItem('spriteSheetLastSession', JSON.stringify(state)); };
    const loadLastSession = () => { const savedState = localStorage.getItem('spriteSheetLastSession'); if (savedState) { const state = JSON.parse(savedState); isReloadingFromStorage = true; currentFileName = state.fileName; frames = state.frames; clips = state.clips; activeClipId = state.activeClipId; historyStack = state.historyStack || []; historyIndex = state.historyIndex === undefined ? -1 : state.historyIndex; imageDisplay.src = state.imageSrc; } };
    
    // --- History (Undo/Redo) - Granular ---
    const saveGlobalState = () => { historyStack = historyStack.slice(0, historyIndex + 1); historyStack.push(JSON.stringify(frames)); historyIndex++; localHistoryStack = []; localHistoryIndex = -1; updateHistoryButtons(); saveCurrentSession(); };
    const saveLocalState = () => { const frame = frames.find(f => f.id === selectedFrameId); if (!frame) return; if(localHistoryFrameId !== selectedFrameId) { localHistoryStack = []; localHistoryIndex = -1; localHistoryFrameId = selectedFrameId; } localHistoryStack = localHistoryStack.slice(0, localHistoryIndex + 1); localHistoryStack.push(JSON.stringify({ hSlices: frame.hSlices, vSlices: frame.vSlices })); localHistoryIndex++; updateHistoryButtons(); saveCurrentSession(); };
    const updateHistoryButtons = () => { const localUndo = localHistoryIndex > 0; const localRedo = localHistoryIndex < localHistoryStack.length - 1; const globalUndo = historyIndex > 0; const globalRedo = historyIndex < historyStack.length - 1; undoButton.disabled = !localUndo && !globalUndo; redoButton.disabled = !localRedo && !globalRedo; };
    const undo = () => { if (localHistoryIndex > 0) { localHistoryIndex--; const frame = frames.find(f => f.id === localHistoryFrameId); const state = JSON.parse(localHistoryStack[localHistoryIndex]); frame.hSlices = state.hSlices; frame.vSlices = state.vSlices; updateAll(false); saveCurrentSession(); } else if (historyIndex > 0) { historyIndex--; loadState(historyStack[historyIndex]); } };
    const redo = () => { if (localHistoryIndex < localHistoryStack.length - 1) { localHistoryIndex++; const frame = frames.find(f => f.id === localHistoryFrameId); const state = JSON.parse(localHistoryStack[localHistoryIndex]); frame.hSlices = state.hSlices; frame.vSlices = state.vSlices; updateAll(false); saveCurrentSession(); } else if (historyIndex < historyStack.length - 1) { historyIndex++; loadState(historyStack[historyIndex]); } };
    const loadState = (stateString) => { frames = JSON.parse(stateString); selectedFrameId = null; localHistoryStack = []; localHistoryIndex = -1; localHistoryFrameId = null; updateAll(false); saveCurrentSession(); };
    
    // --- Core Data Function: Flattening Frames ---
    const getFlattenedFrames = () => {
        const flattened = [];
        let subFrameId = 0;
        frames.forEach(frame => {
            if (frame.type === 'group') {
                const yCoords = [0, ...frame.hSlices.sort((a,b)=>a-b), frame.rect.h];
                
                for (let i = 0; i < yCoords.length - 1; i++) {
                    const rowY = yCoords[i];
                    const rowH = yCoords[i+1] - yCoords[i];
                    const xCoordsForRow = [0];

                    frame.vSlices.sort((a,b) => (a.rowOverrides[i] ?? a.globalX) - (b.rowOverrides[i] ?? b.globalX)).forEach(slice => {
                        const xPos = slice.rowOverrides[i] !== undefined ? slice.rowOverrides[i] : slice.globalX;
                        if (xPos !== null) {
                            xCoordsForRow.push(xPos);
                        }
                    });

                    xCoordsForRow.push(frame.rect.w);
                    const uniqueSortedX = [...new Set(xCoordsForRow)].sort((a,b) => a-b);

                    for (let j = 0; j < uniqueSortedX.length - 1; j++) {
                        const cellX = uniqueSortedX[j];
                        const cellW = uniqueSortedX[j+1] - cellX;
                        if (cellW <= 0) continue;
                        
                        flattened.push({
                            id: subFrameId++,
                            name: `${frame.name}_${i}_${j}`,
                            rect: { x: Math.round(frame.rect.x + cellX), y: Math.round(frame.rect.y + rowY), w: Math.round(cellW), h: Math.round(rowH) }
                        });
                    }
                }
            } else {
                flattened.push({ ...frame, id: subFrameId++ });
            }
        });
        return flattened;
    };

    // --- Initialization and Image Loading ---
    const setControlsEnabled = (enabled) => { allControls.forEach(el => el.id !== 'image-loader' && el.parentElement.id !== 'drop-zone' && (el.disabled = !enabled)); updateHistoryButtons(); };
    imageDisplay.onload = () => {
        welcomeScreen.style.display = 'none'; appContainer.style.visibility = 'visible'; document.body.classList.add('app-loaded');
        const { naturalWidth: w, naturalHeight: h } = imageDisplay;
        canvas.width = rulerTop.width = w; canvas.height = rulerLeft.height = h; rulerTop.height = 30; rulerLeft.width = 30;
        imageDimensionsP.innerHTML = `<strong>${currentFileName}:</strong> ${w}px &times; ${h}px`;
        if (!isReloadingFromStorage) { historyIndex = -1; clearAll(true); addToHistory(); } else { updateAll(false); }
        setControlsEnabled(true);
    };
    const handleFile = (file) => { if (!file || !file.type.startsWith('image/')) return; currentFileName = file.name; const reader = new FileReader(); reader.onload = (e) => { imageDisplay.src = e.target.result; isReloadingFromStorage = false; }; reader.readAsDataURL(file); };
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); e.currentTarget.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', (e) => e.currentTarget.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => { e.preventDefault(); e.currentTarget.classList.remove('dragover'); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); });
    imageLoader.addEventListener('change', (e) => { if (e.target.files.length) handleFile(e.target.files[0]); });
    changeImageButton.addEventListener('click', () => { welcomeScreen.style.display = 'flex'; appContainer.style.visibility = 'hidden'; document.body.classList.remove('app-loaded'); });

    // --- Core Logic & UI Update ---
    const updateAll = (shouldSaveState = false) => { if (shouldSaveState) saveGlobalState(); drawAll(); updateUI(); resetAnimation(); codePreviewContainer.style.display = 'none'; updateHistoryButtons();};
    const updateUI = () => { updateClipsSelect(); updateFramesList(); updateJsonOutput(); };
    
    // --- Drawing & Interaction ---
    const drawAll = () => { ctx.clearRect(0,0,canvas.width,canvas.height); const activeClip=getActiveClip(); const allSubFrames=getFlattenedFrames(); frames.forEach(frame=>{const isSelected=selectedFrameId===frame.id; ctx.strokeStyle=isSelected?'var(--danger)':'rgba(122, 162, 247, 0.5)'; ctx.lineWidth=isSelected?2:1; ctx.setLineDash(frame.type==='group'?[4,4]:[]); ctx.strokeRect(frame.rect.x,frame.rect.y,frame.rect.w,frame.rect.h); ctx.setLineDash([]); if(isSelected && !isLocked)drawResizeHandles(frame.rect); if(frame.type==='group'){ const sliceColor = '#f7768e'; const overrideColor = '#e0af68'; ctx.lineWidth=1; ctx.strokeStyle = sliceColor; frame.hSlices.forEach(sliceY=>{ctx.beginPath(); ctx.moveTo(frame.rect.x,frame.rect.y+sliceY); ctx.lineTo(frame.rect.x+frame.rect.w,frame.rect.y+sliceY); ctx.stroke()}); const yCoords=[0,...frame.hSlices.sort((a,b)=>a-b),frame.rect.h]; for(let i=0; i<yCoords.length-1; i++){const rowYStart=frame.rect.y+yCoords[i],rowYEnd=frame.rect.y+yCoords[i+1]; frame.vSlices.forEach(slice=>{const xPos=slice.rowOverrides[i]!==undefined?slice.rowOverrides[i]:slice.globalX; if(xPos===null)return; const isOverridden=slice.rowOverrides[i]!==undefined; ctx.strokeStyle=isOverridden? overrideColor : sliceColor; ctx.beginPath(); ctx.moveTo(frame.rect.x+xPos,rowYStart); ctx.lineTo(frame.rect.x+xPos,rowYEnd); ctx.stroke()})}}}); allSubFrames.forEach(subFrame=>{const isIncluded=activeClip?.frameIds.includes(subFrame.id); ctx.fillStyle=isIncluded?'rgba(122, 162, 247, 0.15)':'rgba(30,30,45,0.4)'; ctx.fillRect(subFrame.rect.x,subFrame.rect.y,subFrame.rect.w,subFrame.rect.h); ctx.fillStyle=isIncluded?'rgba(255,255,255,0.8)':'rgba(169,177,214,0.6)'; ctx.font='12px var(--font-sans)'; ctx.fillText(subFrame.id,subFrame.rect.x+4,subFrame.rect.y+14)}); if(isDrawing&&newRect){ctx.strokeStyle='var(--warning)'; ctx.strokeRect(newRect.x,newRect.y,newRect.w,newRect.h)}drawRulers()};
    const drawResizeHandles = (rect) => { ctx.fillStyle = 'var(--danger)'; const half = HANDLE_SIZE / 2; const handles = getResizeHandles(rect); Object.values(handles).forEach(handle => ctx.fillRect(handle.x - half, handle.y - half, HANDLE_SIZE, HANDLE_SIZE)); };
    const drawRulers = () => {ctxTop.clearRect(0,0,rulerTop.width,rulerTop.height);ctxLeft.clearRect(0,0,rulerLeft.width,rulerLeft.height);if(!imageDisplay.src||!imageDisplay.complete)return;ctxTop.font=ctxLeft.font='10px var(--font-sans)';ctxTop.fillStyle=ctxLeft.fillStyle='var(--text-secondary)';for(let x=0;x<canvas.width;x+=10){ctxTop.beginPath();ctxTop.moveTo(x,x%50===0?15:22);ctxTop.lineTo(x,30);ctxTop.stroke();if(x%50===0)ctxTop.fillText(x,x+2,12)}for(let y=0;y<canvas.height;y+=10){ctxLeft.beginPath();ctxLeft.moveTo(y%50===0?15:22,y);ctxLeft.lineTo(30,y);ctxLeft.stroke();if(y%50===0)ctxLeft.fillText(y,4,y-2)}};
    const getMousePos = (e) => ({x: e.offsetX, y: e.offsetY});
    const getFrameAtPos = (pos) => frames.slice().reverse().find(f => pos.x >= f.rect.x && pos.x <= f.rect.x + f.rect.w && pos.y >= f.rect.y && pos.y <= f.rect.y + f.rect.h);
    const getResizeHandles = (rect) => { const {x, y, w, h} = rect; return { tl: { x, y }, tr: { x: x + w, y }, bl: { x, y: y + h }, br: { x: x + w, y: y + h }, t: { x: x + w/2, y }, b: { x: x + w/2, y: y + h }, l: { x, y: y + h/2 }, r: { x: x + w, y: y + h/2 } }; };
    const getHandleAtPos = (pos) => { if(isLocked) return null; const frame = frames.find(f => f.id === selectedFrameId); if (!frame) return null; for (const [name, handlePos] of Object.entries(getResizeHandles(frame.rect))) { if (Math.abs(pos.x - handlePos.x) < HANDLE_SIZE/2 && Math.abs(pos.y - handlePos.y) < HANDLE_SIZE/2) return name; } return null; };
    const getSliceAtPos = (pos) => { const frame = frames.find(f => f.id === selectedFrameId && f.type === 'group'); if (!frame) return null; const yCoords = [0, ...frame.hSlices.sort((a,b)=>a-b), frame.rect.h]; const rowIndex = yCoords.findIndex((y, i) => pos.y >= frame.rect.y + y && pos.y < frame.rect.y + yCoords[i + 1]); if (rowIndex === -1) return null; for (let i = 0; i < frame.vSlices.length; i++) { const slice = frame.vSlices[i], xPos = slice.rowOverrides[rowIndex] !== undefined ? slice.rowOverrides[rowIndex] : slice.globalX; if (xPos === null) continue; if (Math.abs(pos.x - (frame.rect.x + xPos)) < SLICE_HANDLE_WIDTH / 2) return { axis: 'v', index: i, rowIndex: rowIndex }; } for (let i = 0; i < frame.hSlices.length; i++) { if (Math.abs(pos.y - (frame.rect.y + frame.hSlices[i])) < SLICE_HANDLE_WIDTH / 2) return { axis: 'h', index: i, rowIndex: rowIndex }; } return null; };
    
    canvas.addEventListener('mousedown', (e) => {
        const pos = getMousePos(e);
        const frameAtPos = getFrameAtPos(pos);

        if (frameAtPos && (e.altKey || e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            selectedFrameId = frameAtPos.id;
            if (frameAtPos.type !== 'group') { frameAtPos.type = 'group'; frameAtPos.hSlices = []; frameAtPos.vSlices = []; }
            
            if (e.altKey) {
                frameAtPos.hSlices.push(pos.y - frameAtPos.rect.y);
            } else {
                const yCoords = [0, ...frameAtPos.hSlices.sort((a, b) => a - b), frameAtPos.rect.h];
                const rowIndex = yCoords.findIndex((y, i) => pos.y >= frameAtPos.rect.y + y && pos.y < frameAtPos.rect.y + yCoords[i + 1]);
                if (rowIndex > -1) {
                    const newVSlice = { id: Date.now(), globalX: null, rowOverrides: {[rowIndex]: pos.x - frameAtPos.rect.x} };
                    frameAtPos.vSlices.push(newVSlice);
                }
            }
            saveLocalState();
            updateAll(false);
            return;
        }

        startPos = pos;
        resizeHandle = getHandleAtPos(startPos);
        draggedSlice = getSliceAtPos(startPos);
        
        if (resizeHandle) { isResizing = true; } 
        else if (draggedSlice) { isDraggingSlice = true; } 
        else if (frameAtPos) { 
            if (selectedFrameId !== frameAtPos.id) { localHistoryStack = []; localHistoryIndex = -1; }
            selectedFrameId = frameAtPos.id;
            localHistoryFrameId = selectedFrameId;
            if(!isLocked) isDragging = true; 
        } else { 
            selectedFrameId = null; 
            if(!isLocked) {isDrawing = true; newRect = { x: startPos.x, y: startPos.y, w: 0, h: 0 };} 
        } 
        updateAll(false);
    });

    canvas.addEventListener('mousemove', (e) => { const pos = getMousePos(e); const handle = getHandleAtPos(pos); const slice = getSliceAtPos(pos); if (handle) { if (handle === 'tl' || handle === 'br') canvas.style.cursor = 'nwse-resize'; else if (handle === 'tr' || handle === 'bl') canvas.style.cursor = 'nesw-resize'; else if (handle === 't' || handle === 'b') canvas.style.cursor = 'ns-resize'; else if (handle === 'l' || handle === 'r') canvas.style.cursor = 'ew-resize'; } else if (slice) { canvas.style.cursor = slice.axis === 'v' ? 'ew-resize' : 'ns-resize'; } else if (getFrameAtPos(pos)) { canvas.style.cursor = isLocked ? 'default' : 'move'; } else { canvas.style.cursor = isLocked ? 'default' : 'crosshair'; } const frame = frames.find(f => f.id === selectedFrameId); if (isResizing && frame && !isLocked) { let { x, y, w, h } = frame.rect; const ox2 = x + w, oy2 = y + h; if (resizeHandle.includes('l')) x = pos.x; if (resizeHandle.includes('t')) y = pos.y; if (resizeHandle.includes('r')) w = pos.x - x; if (resizeHandle.includes('b')) h = pos.y - y; if (resizeHandle.includes('l')) w = ox2 - x; if (resizeHandle.includes('t')) h = oy2 - y; frame.rect = { x, y, w, h }; } else if (isDragging && frame && !isLocked) { const dx = pos.x - startPos.x, dy = pos.y - startPos.y; frame.rect.x += dx; frame.rect.y += dy; startPos = pos; } else if (isDraggingSlice && frame) { if (draggedSlice.axis === 'v') { let newX = pos.x - frame.rect.x; if (newX < 0) newX = 0; if (newX > frame.rect.w) newX = frame.rect.w; const vSlice = frame.vSlices[draggedSlice.index]; if (e.altKey) vSlice.rowOverrides[draggedSlice.rowIndex] = newX; else vSlice.globalX = newX; } else { let newY = pos.y - frame.rect.y; if (newY < 0) newY = 0; if (newY > frame.rect.h) newY = frame.rect.h; frame.hSlices[draggedSlice.index] = newY; } } else if (isDrawing && !isLocked) { newRect.w = pos.x - newRect.x; newRect.h = pos.y - newRect.y; } drawAll(); });
    canvas.addEventListener('mouseup', () => { let stateChanged = false; if (isResizing || isDragging || isDraggingSlice) { const frame = frames.find(f => f.id === selectedFrameId); if (frame && frame.rect.w < 0) { frame.rect.x += frame.rect.w; frame.rect.w *= -1; } if (frame && frame.rect.h < 0) { frame.rect.y += frame.rect.h; frame.rect.h *= -1; } if (isDraggingSlice) saveLocalState(); else stateChanged = true; } else if (isDrawing && newRect) { if (newRect.w < 0) { newRect.x += newRect.w; newRect.w *= -1; } if (newRect.h < 0) { newRect.y += newRect.h; newRect.h *= -1; } if (newRect.w > 4 && newRect.h > 4) { const newId = frames.length > 0 ? Math.max(...frames.map(f => f.id)) + 1 : 0; frames.push({ id: newId, name: `frame_${newId}`, rect: newRect, type: 'simple' }); selectedFrameId = newId; stateChanged = true; } } isDrawing = isDragging = isResizing = isDraggingSlice = false; newRect = resizeHandle = draggedSlice = null; updateAll(stateChanged); });
    canvas.addEventListener('dblclick', (e) => { const subFrame = getFlattenedFrames().slice().reverse().find(f => { const pos = getMousePos(e); return pos.x >= f.rect.x && pos.x <= f.rect.x + f.rect.w && pos.y >= f.rect.y && pos.y <= f.rect.y + f.rect.h; }); if (subFrame) { const clip = getActiveClip(); if (!clip) return; const idx = clip.frameIds.indexOf(subFrame.id); if (idx > -1) clip.frameIds.splice(idx, 1); else clip.frameIds.push(subFrame.id); updateAll(false); saveCurrentSession(); } });

    // --- Slicing and Grid Generation ---
    function clearAll(isInitial = false) { frames = []; clips = []; activeClipId = null; selectedFrameId = null; if (!isInitial) updateAll(true); }
    clearButton.addEventListener('click', () => { if(isLocked){ showToast('Desbloquea los frames primero (L)', 'warning'); return; } if(confirm('¿Seguro que quieres borrar todos los frames?')) { clearAll(false); } });
    generateGridButton.addEventListener('click', () => { if(isLocked){ showToast('Desbloquea los frames primero (L)', 'warning'); return; } const r=parseInt(rowsInput.value), c=parseInt(colsInput.value); if(isNaN(r)||isNaN(c)||r<1||c<1)return; const w=canvas.width/c, h=canvas.height/r; const newFrame = { id: 0, name: `grid_group`, rect: { x: 0, y: 0, w: canvas.width, h: canvas.height }, type: 'group', vSlices: [], hSlices: [] }; for (let i = 1; i < c; i++) newFrame.vSlices.push({ id: Date.now()+i, globalX: i*w, rowOverrides: {} }); for (let i = 1; i < r; i++) newFrame.hSlices.push(i*h); frames = [newFrame]; clips = []; activeClipId = null; updateAll(true); });
    generateBySizeButton.addEventListener('click', () => { if(isLocked){ showToast('Desbloquea los frames primero (L)', 'warning'); return; } const w=parseInt(cellWInput.value), h=parseInt(cellHInput.value); if(isNaN(w)||isNaN(h)||w<1||h<1)return; const newFrame = { id: 0, name: `sized_group`, rect: { x: 0, y: 0, w: canvas.width, h: canvas.height }, type: 'group', vSlices: [], hSlices: [] }; for (let x=w; x<canvas.width; x+=w) newFrame.vSlices.push({ id: Date.now()+x, globalX: x, rowOverrides: {} }); for (let y=h; y<canvas.height; y+=h) newFrame.hSlices.push(y); frames = [newFrame]; clips = []; activeClipId = null; updateAll(true); });
    
    // --- Automatic Sprite Detection ---
    const detectSprites = async () => {
        if (isLocked) { showToast('Desbloquea los frames primero (L)', 'warning'); return; }
        if (!confirm('Esta acción borrará todos los frames existentes y buscará nuevos automáticamente. ¿Deseas continuar?')) return;

        showToast('Detectando sprites... esto puede tardar un momento.', 'primary');
        autoDetectButton.disabled = true;

        setTimeout(() => {
            try {
                const tolerance = parseInt(autoDetectToleranceInput.value, 10);
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                const { naturalWidth: w, naturalHeight: h } = imageDisplay;
                tempCanvas.width = w; tempCanvas.height = h;
                tempCtx.drawImage(imageDisplay, 0, 0);

                const imageData = tempCtx.getImageData(0, 0, w, h);
                const data = imageData.data;
                const visited = new Uint8Array(w * h);
                const newFrames = [];

                const bgR = data[0], bgG = data[1], bgB = data[2], bgA = data[3];

                const isBackgroundColor = (index) => {
                    const r = data[index], g = data[index + 1], b = data[index + 2], a = data[index + 3];
                    if (a === 0) return true;
                    if (bgA < 255 && a > 0) return false;
                    const diff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
                    return diff <= tolerance;
                };

                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const i = (y * w + x);
                        if (visited[i] || isBackgroundColor(i * 4)) continue;

                        const queue = [[x, y]];
                        visited[i] = 1;
                        let minX = x, minY = y, maxX = x, maxY = y;

                        while (queue.length > 0) {
                            const [cx, cy] = queue.shift();
                            minX = Math.min(minX, cx); minY = Math.min(minY, cy);
                            maxX = Math.max(maxX, cx); maxY = Math.max(maxY, cy);
                            
                            const neighbors = [[cx, cy - 1], [cx, cy + 1], [cx - 1, cy], [cx + 1, cy]];
                            for (const [nx, ny] of neighbors) {
                                if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                                    const ni = (ny * w + nx);
                                    if (!visited[ni] && !isBackgroundColor(ni * 4)) {
                                        visited[ni] = 1;
                                        queue.push([nx, ny]);
                                    }
                                }
                            }
                        }
                        
                        const newId = newFrames.length;
                        newFrames.push({
                            id: newId, name: `sprite_${newId}`,
                            rect: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
                            type: 'simple'
                        });
                    }
                }

                if (newFrames.length > 0) {
                    frames = newFrames; clips = []; activeClipId = null; selectedFrameId = null;
                    showToast(`¡Detección completada! Se encontraron ${newFrames.length} sprites.`, 'success');
                    updateAll(true);
                } else {
                    showToast('No se encontraron sprites con la tolerancia actual.', 'warning');
                }
            } catch (error) {
                console.error("Error during sprite detection:", error);
                showToast('Ocurrió un error durante la detección.', 'danger');
            } finally {
                autoDetectButton.disabled = false;
            }
        }, 50);
    };
    autoDetectButton.addEventListener('click', detectSprites);

    // --- Clip, Animation ---
    const getActiveClip = () => clips.find(c => c.id === activeClipId);
    const createNewClip = (name) => { const newName = name || prompt("Nombre del nuevo clip:", `Clip ${clips.length + 1}`); if (!newName) return; clips.push({ id: Date.now(), name: newName, frameIds: [] }); activeClipId = clips[clips.length - 1].id; updateUI(); resetAnimation(); saveCurrentSession(); };
    newClipButton.addEventListener('click', () => createNewClip());
    renameClipButton.addEventListener('click', () => { const clip = getActiveClip(); if (clip) { const newName = prompt("Nuevo nombre:", clip.name); if(newName) { clip.name = newName; updateUI(); saveCurrentSession(); } }});
    deleteClipButton.addEventListener('click', () => { if (clips.length <= 1) return showToast("No puedes eliminar el último clip.", 'warning'); if(confirm('¿Eliminar clip?')) { clips = clips.filter(c => c.id !== activeClipId); activeClipId = clips[0]?.id || null; updateUI(); resetAnimation(); saveCurrentSession();} });
    clipsSelect.addEventListener('change', (e) => { activeClipId = parseInt(e.target.value); updateAll(false); saveCurrentSession(); });
    const updateClipsSelect = () => { const prevId = activeClipId; clipsSelect.innerHTML = ''; clips.forEach(c => {const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.name; clipsSelect.appendChild(opt);}); if (clips.find(c => c.id === prevId)) clipsSelect.value = prevId; else if (clips.length > 0) clipsSelect.value = clips[0].id; activeClipId = clipsSelect.value ? parseInt(clipsSelect.value) : null; if (!activeClipId && clips.length > 0) activeClipId = clips[0].id; if (clips.length === 0 && getFlattenedFrames().length > 0) createNewClip("Default"); };
    const updateFramesList = () => { framesList.innerHTML = ''; const activeClip = getActiveClip(); const allFrames = getFlattenedFrames(); if(allFrames.length === 0) {framesList.innerHTML = `<li>No hay frames definidos.</li>`; return;}; allFrames.forEach(f => { const li = document.createElement('li'); const isChecked = activeClip?.frameIds.includes(f.id); li.innerHTML = `<input type="checkbox" ${isChecked ? 'checked' : ''} data-frame-id="${f.id}"> F${f.id}: ${f.name} (${f.rect.w}x${f.rect.h})`; framesList.appendChild(li); }); };
    framesList.addEventListener('change', (e) => { if(e.target.matches('[data-frame-id]')) { const clip = getActiveClip(); if(!clip) return; const id = parseInt(e.target.dataset.frameId); if (e.target.checked) { if(!clip.frameIds.includes(id)) clip.frameIds.push(id); } else { clip.frameIds = clip.frameIds.filter(fid => fid !== id); } updateAll(false); saveCurrentSession(); }});
    selectAllFramesButton.addEventListener('click', () => { const clip = getActiveClip(); if (clip) { clip.frameIds = getFlattenedFrames().map(f => f.id); updateAll(false); saveCurrentSession();} });
    deselectAllFramesButton.addEventListener('click', () => { const clip = getActiveClip(); if (clip) { clip.frameIds = []; updateAll(false); saveCurrentSession();} });
    const getAnimationFrames = () => { const clip = getActiveClip(); if (!clip) return []; const all = getFlattenedFrames(); return clip.frameIds.map(id => all.find(f => f.id === id)).filter(Boolean); };
    const resetAnimation = () => { if (animationState.isPlaying) toggleAnimation(); animationState.currentFrameIndex = 0; const animFrames = getAnimationFrames(); drawFrameInPreview(animFrames.length > 0 ? animFrames[0] : null); };
    const toggleAnimation = () => { animationState.isPlaying = !animationState.isPlaying; if (animationState.isPlaying && getAnimationFrames().length > 0) { playPauseButton.textContent = '⏸️'; animationState.lastTime = performance.now(); animationLoop(animationState.lastTime); } else { playPauseButton.textContent = '▶️'; cancelAnimationFrame(animationState.animationFrameId); } };
    const animationLoop = (timestamp) => { if (!animationState.isPlaying) return; const elapsed = timestamp - animationState.lastTime; const animFrames = getAnimationFrames(); if (elapsed > 1000 / animationState.fps && animFrames.length > 0) { animationState.lastTime = timestamp; drawFrameInPreview(animFrames[animationState.currentFrameIndex]); animationState.currentFrameIndex = (animationState.currentFrameIndex + 1) % animFrames.length; } animationState.animationFrameId = requestAnimationFrame(animationLoop); };
    const drawFrameInPreview = (frame) => { previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height); if (!frame) return; const { x, y, w, h } = frame.rect; const scale = Math.min(previewCanvas.width / w, previewCanvas.height / h); previewCtx.drawImage(imageDisplay, x, y, w, h, (previewCanvas.width - w * scale)/2, (previewCanvas.height - h * scale)/2, w*scale, h*scale); };
    playPauseButton.addEventListener('click', toggleAnimation);
    fpsSlider.addEventListener('input', (e) => { animationState.fps = parseInt(e.target.value); fpsValue.textContent = e.target.value; });
    firstFrameButton.addEventListener('click', () => { if (animationState.isPlaying) toggleAnimation(); animationState.currentFrameIndex = 0; drawFrameInPreview(getAnimationFrames()[0]); });
    lastFrameButton.addEventListener('click', () => { if (animationState.isPlaying) toggleAnimation(); const animFrames = getAnimationFrames(); animationState.currentFrameIndex = animFrames.length - 1; drawFrameInPreview(animFrames[animationState.currentFrameIndex]); });
    const showToast = (message, type = 'success') => { toast.textContent = message; toast.style.backgroundColor = `var(--${type})`; toast.style.bottom = '20px'; setTimeout(() => { toast.style.bottom = '-100px'; }, 2500); };
    const toggleLock = () => { isLocked = !isLocked; lockFramesButton.textContent = isLocked ? '🔒' : '🔓'; lockFramesButton.classList.toggle('locked', isLocked); showToast(isLocked ? 'Frame principal bloqueado' : 'Frame principal desbloqueado', 'primary'); drawAll(); };
    const toggleFullscreen = () => { if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(err => { alert(`Error al intentar entrar en pantalla completa: ${err.message} (${err.name})`); }); } else { document.exitFullscreen(); } };

    undoButton.addEventListener('click', undo);
    redoButton.addEventListener('click', redo);
    lockFramesButton.addEventListener('click', toggleLock);
    fullscreenButton.addEventListener('click', toggleFullscreen);

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

        if ((e.key === 'Delete' || e.key === 'Backspace') && draggedSlice) {
            e.preventDefault();
            const frame = frames.find(f => f.id === selectedFrameId);
            if (draggedSlice.axis === 'v') {
                frame.vSlices.splice(draggedSlice.index, 1);
            } else {
                frame.hSlices.splice(draggedSlice.index, 1);
            }
            draggedSlice = null; 
            saveLocalState();
            updateAll(false);
            return;
        }

        if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
        if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedFrameId !== null) { if(isLocked) { showToast('Desbloquea el frame para eliminar (L)', 'warning'); return; } e.preventDefault(); frames = frames.filter(f => f.id !== selectedFrameId); selectedFrameId = null; updateAll(true); }
        if (e.key.toLowerCase() === 'f') { e.preventDefault(); document.body.classList.toggle('focus-mode'); }
        if (e.key.toLowerCase() === 'l') { e.preventDefault(); toggleLock(); }
        if (e.key.toLowerCase() === 'm') { e.preventDefault(); toggleFullscreen(); }
        if (e.key === 'Escape') { if (document.body.classList.contains('focus-mode')) { e.preventDefault(); document.body.classList.remove('focus-mode'); } }
    });
    
    document.body.addEventListener('click', (e) => { if (e.target.classList.contains('copy-button')) { const targetId = e.target.dataset.target; const pre = document.getElementById(targetId); navigator.clipboard.writeText(pre.textContent).then(() => showToast('¡Copiado al portapapeles!')); } });
    
    const highlightSyntax = (str, lang) => { const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); str=esc(str); if (lang==='json') return str.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?)/g, (m) => /:$/.test(m) ? `<span class="token-key">${m.slice(0,-1)}</span>:` : `<span class="token-string">${m}</span>`).replace(/([{}[\](),:])/g, '<span class="token-punctuation">$&</span>'); if (lang==='html') return str.replace(/(&lt;\/?)([^&gt;\s]+)/g, `$1<span class="token-tag">$2</span>`).replace(/([a-z-]+)=(&quot;.*?&quot;)/g, `<span class="token-attr-name">$1</span>=<span class="token-attr-value">$2</span>`); if (lang==='css') return str.replace(/\/\*[\s\S]*?\*\//g, '<span class="token-comment">$&</span>').replace(/([a-zA-Z-]+)(?=:)/g, '<span class="token-property">$&</span>').replace(/(body|h1|@keyframes|\.stage|\.sprite-container|\.ground)/g, '<span class="token-selector">$&</span>'); return str; };
    const updateJsonOutput = () => { const format=jsonFormatSelect.value; let out; const framesData=getFlattenedFrames(); const meta={app:"Sprite Sheet Suite v4.3", image:currentFileName, size:{w:canvas.width,h:canvas.height}, clips:clips.map(c=>({name:c.name,frames:c.frameIds}))}; switch(format){ case 'phaser3': out={frames:framesData.reduce((acc,f)=>{acc[f.name]={frame:f.rect,spriteSourceSize:{x:0,y:0,...f.rect},sourceSize:f.rect};return acc}, {}), meta}; break; case 'godot': out={frames:framesData.reduce((acc,f)=>{acc[f.name]={frame:f.rect,source_size:{w:f.rect.w,h:f.rect.h},sprite_source_size:{x:0,y:0,...f.rect}};return acc}, {}), meta}; break; default: out={meta, frames:framesData}; break; } const jsonString = JSON.stringify(out, null, 2); jsonOutput.innerHTML = highlightSyntax(jsonString, 'json'); jsonLineNumbers.innerHTML = Array.from({length: jsonString.split('\n').length}, (_, i) => `<span>${i+1}</span>`).join(''); };
    jsonFormatSelect.addEventListener('change', updateJsonOutput);
    exportZipButton.addEventListener('click', async () => { const allFrames=getFlattenedFrames(); if (allFrames.length === 0) return showToast('No hay frames para exportar.','warning'); showToast('Generando ZIP...', 'primary'); const zip = new JSZip(); const tempCanvas=document.createElement('canvas'), tempCtx=tempCanvas.getContext('2d'); for(const frame of allFrames) { tempCanvas.width = frame.rect.w; tempCanvas.height = frame.rect.h; tempCtx.drawImage(imageDisplay, frame.rect.x, frame.rect.y, frame.rect.w, frame.rect.h, 0, 0, frame.rect.w, frame.rect.h); const blob = await new Promise(res => tempCanvas.toBlob(res, 'image/png')); zip.file(`${frame.name || `frame_${frame.id}`}.png`, blob); } const content = await zip.generateAsync({type:"blob"}); const link = document.createElement('a'); link.href = URL.createObjectURL(content); link.download = `${currentFileName.split('.')[0]}.zip`; link.click(); URL.revokeObjectURL(link.href); });
    exportGifButton.addEventListener('click', () => { const animFrames=getAnimationFrames(); if (animFrames.length===0) return showToast("No hay frames en este clip para exportar.",'warning'); showToast("Generando GIF, por favor espera...",'primary'); const gif=new GIF({workers:2,quality:10,workerScript:'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js'}); const tempCanvas=document.createElement('canvas'),tempCtx=tempCanvas.getContext('2d'); const maxSize=parseInt(maxGifSizeInput.value)||128; animFrames.forEach(frame=>{const{x,y,w,h}=frame.rect; let dW=w,dH=h; if(w>maxSize||h>maxSize){if(w>h){dW=maxSize;dH=(h/w)*maxSize}else{dH=maxSize;dW=(w/h)*maxSize}} tempCanvas.width=Math.round(dW); tempCanvas.height=Math.round(dH); tempCtx.drawImage(imageDisplay,x,y,w,h,0,0,tempCanvas.width,tempCanvas.height); gif.addFrame(tempCanvas,{copy:true,delay:1000/animationState.fps});}); gif.on('finished',(blob)=>{const link=document.createElement('a'); link.href=URL.createObjectURL(blob); link.download=`${currentFileName.split('.')[0]}_${getActiveClip().name}.gif`; link.click(); URL.revokeObjectURL(link.href);}); gif.render(); });
    
    exportCodeButton.addEventListener('click', () => { 
        const animFrames = getAnimationFrames(); 
        if (animFrames.length === 0) return showToast("Selecciona al menos un frame en el clip.", 'warning'); 
        
        const scale = parseFloat(exportScaleInput.value) || 2;
        const { htmlCode, cssCode } = generateCssAnimationCode(animFrames, scale);

        htmlCodeOutput.innerHTML = highlightSyntax(htmlCode,'html'); 
        cssCodeOutput.innerHTML = highlightSyntax(cssCode,'css'); 
        const genLines = (c) => Array.from({length:c.split('\n').length},(_,i)=>`<span>${i+1}</span>`).join(''); 
        htmlLineNumbers.innerHTML = genLines(htmlCode); 
        cssLineNumbers.innerHTML = genLines(cssCode); 
        livePreviewIframe.srcdoc = `<!DOCTYPE html><html><head><style>${cssCode}</style></head><body>${htmlCode.match(/<body>([\s\S]*)<\/body>/)[1]}</body></html>`; 
        codePreviewContainer.style.display = 'grid'; 
    });
    
    function generateCssAnimationCode(animFrames, scale) {
        const firstFrame = animFrames[0].rect; 
        const frameCount = animFrames.length; 
        const duration = ((1 / animationState.fps) * frameCount).toFixed(2); 
        const htmlCode = `<!DOCTYPE html>\n<html lang="es">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>Animación de Sprite</title>\n    <link rel="stylesheet" href="style.css">\n</head>\n<body>\n\n    <div class="stage">\n        <div class="sprite"></div>\n    </div>\n\n</body>\n</html>`; 
        let keyframesSteps = animFrames.map((frame, index) => { 
            const { x, y, w, h } = frame.rect; 
            const percentage = (index / frameCount) * 100; 
            return `    ${percentage.toFixed(2)}% { width: ${w}px; height: ${h}px; background-position: -${x}px -${y}px; }`; 
        }).join('\n'); 
        
        const cssCode = `/* Estilos para la página de demostración */\nbody {\n    display: grid;\n    place-content: center;\n    min-height: 100vh;\n    background-color: #2c3e50;\n    margin: 0;\n}\n\n/* El "escenario" donde ocurre la animación */\n.stage {\n    padding: 2rem;\n    background-color: #1a252f;\n    border-radius: 8px;\n    border: 2px solid #55687a;\n    display: flex;\n    justify-content: center;\n    align-items: flex-end;\n    position: relative;\n    overflow: hidden;\n    min-height: 250px;\n    min-width: 250px;\n}\n\n/* El sprite con la animación */\n.sprite {\n    width: ${firstFrame.w}px;\n    height: ${firstFrame.h}px;\n    background-image: url('${currentFileName}');\n    \n    /* Mantiene los píxeles nítidos */\n    image-rendering: pixelated;\n    image-rendering: crisp-edges;\n\n    /* Escala el sprite para verlo mejor */\n    transform: scale(${scale});\n    transform-origin: bottom center;\n\n    /* Aplicación de la animación */\n    animation: play ${duration}s steps(1) infinite;\n}\n\n/* Definición de los pasos de la animación */\n@keyframes play {\n${keyframesSteps}\n    100% { width: ${firstFrame.w}px; height: ${firstFrame.h}px; background-position: -${firstFrame.x}px -${firstFrame.y}px; }\n}`; 
        
        return { htmlCode, cssCode }; 
    }

    // --- Local Storage & History (Project Persistence) ---
    const getHistory = () => JSON.parse(localStorage.getItem('spriteSheetHistory') || '[]');
    const saveHistory = (history) => localStorage.setItem('spriteSheetHistory', JSON.stringify(history));
    const addToHistory = () => { const id=Date.now(); const thumbCanvas=document.createElement('canvas'); const thumbCtx=thumbCanvas.getContext('2d'); const thumbSize=40; thumbCanvas.width=thumbSize; thumbCanvas.height=thumbSize; thumbCtx.drawImage(imageDisplay,0,0,thumbSize,thumbSize); const thumbSrc=thumbCanvas.toDataURL(); const historyEntry={id,name:currentFileName,thumb:thumbSrc}; let history=getHistory(); history=history.filter(item=>item.name!==currentFileName); history.unshift(historyEntry); if(history.length>5)history.pop(); saveHistory(history); const fullState={imageSrc:imageDisplay.src,fileName:currentFileName,frames,clips,activeClipId, historyStack, historyIndex}; localStorage.setItem(`history_${id}`,JSON.stringify(fullState)); updateHistoryPanel(); };
    const updateHistoryPanel = () => { const history = getHistory(); projectHistoryList.innerHTML = ''; if (history.length === 0) { projectHistoryList.innerHTML = `<li style="cursor: default; justify-content: center;">No hay proyectos guardados.</li>`; return; } history.forEach(item => { const li = document.createElement('li'); li.dataset.historyId = item.id; li.innerHTML = `<img src="${item.thumb}" class="history-thumb" alt="thumbnail"><span class="history-name">${item.name}</span><button class="delete-history-btn" title="Eliminar del historial">✖</button>`; projectHistoryList.appendChild(li); }); };
    projectHistoryList.addEventListener('click', (e) => { const li = e.target.closest('li'); if (!li) return; const id = li.dataset.historyId; if (e.target.classList.contains('delete-history-btn')) { e.stopPropagation(); let history=getHistory(); history=history.filter(item=>item.id!=id); saveHistory(history); localStorage.removeItem(`history_${id}`); updateHistoryPanel(); showToast('Proyecto eliminado del historial.','warning'); } else { const savedState=localStorage.getItem(`history_${id}`); if(savedState){ const state=JSON.parse(savedState); isReloadingFromStorage=true; currentFileName=state.fileName; frames=state.frames; clips=state.clips; activeClipId=state.activeClipId; historyStack = state.historyStack || []; historyIndex = state.historyIndex === undefined ? -1 : state.historyIndex; imageDisplay.src=state.imageSrc; } } });

    // --- INICIO DEL CAMBIO: Lógica de Acordeón para Exportar ---
    const exportPanel = document.getElementById('export-panel');
    const exportSubPanels = exportPanel.querySelectorAll('.sub-panel');
    exportSubPanels.forEach(panel => {
        panel.addEventListener('toggle', (e) => {
            if (e.target.open) {
                // Cuando un panel se abre, cierra los demás
                exportSubPanels.forEach(otherPanel => {
                    if (otherPanel !== e.target && otherPanel.open) {
                        otherPanel.open = false;
                    }
                });
            }
        });
    });
    // --- FIN DEL CAMBIO ---

    // Initial Load
    loadLastSession();
    updateHistoryPanel();
    setControlsEnabled(false);
});
