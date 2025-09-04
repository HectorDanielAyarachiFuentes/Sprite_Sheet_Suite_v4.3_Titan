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
    const selectToolButton = document.getElementById('select-tool-button');
    const createFrameToolButton = document.getElementById('create-frame-tool-button');
    const eraserToolButton = document.getElementById('eraser-tool-button');
    const autoDetectToolButton = document.getElementById('auto-detect-tool-button');
    const editorArea = document.getElementById('editor-area');
    const imageContainer = document.getElementById('image-container');
    const zoomOutButton = document.getElementById('zoom-out-button');
    const zoomInButton = document.getElementById('zoom-in-button');
    const zoomFitButton = document.getElementById('zoom-fit-button');
    const zoomDisplay = document.getElementById('zoom-display');
    const loadingOverlay = document.getElementById('loading-overlay');

    // --- App State ---
    let frames = [], clips = [], activeClipId = null;
    let historyStack = [], historyIndex = -1;
    let localHistoryStack = [], localHistoryIndex = -1, localHistoryFrameId = null;
    let selectedFrameId = null;
    let animationState = { isPlaying: false, fps: 12, currentFrameIndex: 0, lastTime: 0, animationFrameId: null };
    let currentFileName = "spritesheet.png";
    let isReloadingFromStorage = false;
    let isLocked = false;
    let activeTool = 'select';
    let zoomLevel = 1.0;

    // --- Interaction State ---
    let isDrawing = false, isDragging = false, isResizing = false, isDraggingSlice = false;
    let startPos = { x: 0, y: 0 };
    let newRect = null;
    let resizeHandle = null;
    let draggedSlice = null;
    const HANDLE_SIZE = 8;
    const SLICE_HANDLE_WIDTH = 6;

    // --- Local Storage & History ---
    const saveCurrentSession = () => {
        if (!imageDisplay.src || imageDisplay.src.startsWith('http')) return;
        const state = { imageSrc: imageDisplay.src, fileName: currentFileName, frames, clips, activeClipId, historyStack, historyIndex };
        localStorage.setItem('spriteSheetLastSession', JSON.stringify(state));
    };

    const loadLastSession = () => {
        const savedState = localStorage.getItem('spriteSheetLastSession');
        if (savedState) {
            const state = JSON.parse(savedState);
            isReloadingFromStorage = true;
            currentFileName = state.fileName;
            // IMPORTANT: Ensure frames and clips are loaded from history entry if available
            frames = state.frames;
            clips = state.clips;
            activeClipId = state.activeClipId;
            historyStack = state.historyStack || [];
            historyIndex = state.historyIndex === undefined ? -1 : state.historyIndex;
            imageDisplay.src = state.imageSrc;
        }
    };
    
    // --- History (Undo/Redo) ---
    const saveGlobalState = () => {
        historyStack = historyStack.slice(0, historyIndex + 1);
        // Store both frames and clips in history
        historyStack.push(JSON.stringify({ frames, clips }));
        historyIndex++;
        localHistoryStack = [];
        localHistoryIndex = -1;
        updateHistoryButtons();
        saveCurrentSession();
    };

    const saveLocalState = () => {
        const frame = frames.find(f => f.id === selectedFrameId);
        if (!frame) return;
        if(localHistoryFrameId !== selectedFrameId) {
            localHistoryStack = [];
            localHistoryIndex = -1;
            localHistoryFrameId = selectedFrameId;
        }
        localHistoryStack = localHistoryStack.slice(0, localHistoryIndex + 1);
        localHistoryStack.push(JSON.stringify({ hSlices: frame.hSlices, vSlices: frame.vSlices }));
        localHistoryIndex++;
        updateHistoryButtons();
        saveCurrentSession();
    };

    const updateHistoryButtons = () => {
        const localUndo = localHistoryIndex > 0;
        const localRedo = localHistoryIndex < localHistoryStack.length - 1;
        const globalUndo = historyIndex > 0;
        const globalRedo = historyIndex < historyStack.length - 1;
        undoButton.disabled = !localUndo && !globalUndo;
        redoButton.disabled = !localRedo && !globalRedo;
    };

    const undo = () => {
        if (localHistoryIndex > 0) {
            localHistoryIndex--;
            const frame = frames.find(f => f.id === localHistoryFrameId);
            const state = JSON.parse(localHistoryStack[localHistoryIndex]);
            frame.hSlices = state.hSlices;
            frame.vSlices = state.vSlices;
            updateAll(false);
            saveCurrentSession();
        } else if (historyIndex > 0) {
            historyIndex--;
            loadState(historyStack[historyIndex]);
        }
    };

    const redo = () => {
        if (localHistoryIndex < localHistoryStack.length - 1) {
            localHistoryIndex++;
            const frame = frames.find(f => f.id === localHistoryFrameId);
            const state = JSON.parse(localHistoryStack[localHistoryIndex]);
            frame.hSlices = state.hSlices;
            frame.vSlices = state.vSlices;
            updateAll(false);
            saveCurrentSession();
        } else if (historyIndex < historyStack.length - 1) {
            historyIndex++;
            loadState(historyStack[historyIndex]);
        }
    };

    const loadState = (stateString) => {
        const state = JSON.parse(stateString);
        frames = state.frames;
        clips = state.clips; // Ensure clips are also loaded from history
        selectedFrameId = null;
        localHistoryStack = [];
        localHistoryIndex = -1;
        localHistoryFrameId = null;
        updateAll(false);
        saveCurrentSession();
    };
    
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
    
    // --- Zoom Logic ---
    const applyZoom = () => {
        imageContainer.style.transform = `scale(${zoomLevel})`;
        zoomDisplay.textContent = `${Math.round(zoomLevel * 100)}%`;
        drawAll(); 
    };
    const zoomIn = () => { zoomLevel = Math.min(zoomLevel * 1.25, 16); applyZoom(); };
    const zoomOut = () => { zoomLevel = Math.max(zoomLevel / 1.25, 0.1); applyZoom(); };
    const zoomFit = () => {
        if (!imageDisplay.complete || imageDisplay.naturalWidth === 0) return;
        const editorRect = editorArea.getBoundingClientRect();
        const viewWidth = editorRect.width - 60; // Padding
        const viewHeight = editorRect.height - 60;
        const scaleX = viewWidth / imageDisplay.naturalWidth;
        const scaleY = viewHeight / imageDisplay.naturalHeight;
        zoomLevel = Math.min(scaleX, scaleY, 1);
        applyZoom();
    };
    zoomInButton.addEventListener('click', zoomIn);
    zoomOutButton.addEventListener('click', zoomOut);
    zoomFitButton.addEventListener('click', zoomFit);

    // --- Loading Overlay Functions ---
    const showLoader = (message = "Procesando...") => {
        loadingOverlay.querySelector('p').textContent = message;
        loadingOverlay.classList.remove('hidden');
    };
    const hideLoader = () => {
        loadingOverlay.classList.add('hidden');
    };

    // --- Initialization and Image Loading ---
    const setControlsEnabled = (enabled) => { allControls.forEach(el => el.id !== 'image-loader' && el.parentElement.id !== 'drop-zone' && (el.disabled = !enabled)); updateHistoryButtons(); };
    imageDisplay.onload = () => {
        welcomeScreen.style.display = 'none'; appContainer.style.visibility = 'visible'; document.body.classList.add('app-loaded');
        const { naturalWidth: w, naturalHeight: h } = imageDisplay;
        canvas.width = w; canvas.height = h;
        rulerTop.width = editorArea.scrollWidth; rulerLeft.height = editorArea.scrollHeight;
        rulerTop.height = 30; rulerLeft.width = 30;
        imageDimensionsP.innerHTML = `<strong>${currentFileName}:</strong> ${w}px &times; ${h}px`;
        if (!isReloadingFromStorage) { 
            historyIndex = -1; clearAll(true); addToHistory();
            zoomFit(); 
        } else { 
            updateAll(false);
            applyZoom();
        }
        setControlsEnabled(true);
    };
    const handleFile = (file) => { if (!file || !file.type.startsWith('image/')) return; currentFileName = file.name; const reader = new FileReader(); reader.onload = (e) => { imageDisplay.src = e.target.result; isReloadingFromStorage = false; }; reader.readAsDataURL(file); };
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); e.currentTarget.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', (e) => e.currentTarget.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => { e.preventDefault(); e.currentTarget.classList.remove('dragover'); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); });
    imageLoader.addEventListener('change', (e) => { if (e.target.files.length) handleFile(e.target.files[0]); });
    changeImageButton.addEventListener('click', () => { welcomeScreen.style.display = 'flex'; appContainer.style.visibility = 'hidden'; document.body.classList.remove('app-loaded'); });

    // --- Core Logic & UI Update ---
    const updateAll = (shouldSaveState = false) => {
        if (shouldSaveState) saveGlobalState();
        drawAll();
        updateUI();
        resetAnimation();
        codePreviewContainer.style.display = 'none';
        updateHistoryButtons();
    };

    const updateUI = () => { updateClipsSelect(); updateFramesList(); updateJsonOutput(); };
    
    // --- Drawing & Interaction ---
    const drawAll = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const activeClip = getActiveClip();
        const allSubFrames = getFlattenedFrames();
    
        frames.forEach(frame => {
            const isSelected = selectedFrameId === frame.id;
            ctx.strokeStyle = isSelected ? 'var(--danger)' : 'rgba(122, 162, 247, 0.5)';
            ctx.lineWidth = isSelected ? 2 / zoomLevel : 1 / zoomLevel;
            ctx.setLineDash(frame.type === 'group' ? [4 / zoomLevel, 4 / zoomLevel] : []);
            ctx.strokeRect(frame.rect.x, frame.rect.y, frame.rect.w, frame.rect.h);
            ctx.setLineDash([]);
    
            if (isSelected && !isLocked) drawResizeHandles(frame.rect);
    
            if (frame.type === 'group') {
                const sliceColor = '#f7768e';
                const overrideColor = '#e0af68';
                ctx.lineWidth = 1 / zoomLevel;
                ctx.strokeStyle = sliceColor;
                frame.hSlices.forEach(sliceY => {
                    ctx.beginPath();
                    ctx.moveTo(frame.rect.x, frame.rect.y + sliceY);
                    ctx.lineTo(frame.rect.x + frame.rect.w, frame.rect.y + sliceY);
                    ctx.stroke();
                });
    
                const yCoords = [0, ...frame.hSlices.sort((a, b) => a - b), frame.rect.h];
                for (let i = 0; i < yCoords.length - 1; i++) {
                    const rowYStart = frame.rect.y + yCoords[i];
                    const rowYEnd = frame.rect.y + yCoords[i + 1];
                    frame.vSlices.forEach(slice => {
                        const xPos = slice.rowOverrides[i] !== undefined ? slice.rowOverrides[i] : slice.globalX;
                        if (xPos === null) return;
                        const isOverridden = slice.rowOverrides[i] !== undefined;
                        ctx.strokeStyle = isOverridden ? overrideColor : sliceColor;
                        ctx.beginPath();
                        ctx.moveTo(frame.rect.x + xPos, rowYStart);
                        ctx.lineTo(frame.rect.x + xPos, rowYEnd);
                        ctx.stroke();
                    });
                }
            }
        });
    
        allSubFrames.forEach(subFrame => {
            const isIncluded = activeClip?.frameIds.includes(subFrame.id);
            ctx.fillStyle = isIncluded ? 'rgba(122, 162, 247, 0.15)' : 'rgba(30,30,45,0.4)';
            ctx.fillRect(subFrame.rect.x, subFrame.rect.y, subFrame.rect.w, subFrame.rect.h);
    
            if (subFrame.rect.w > 8 && subFrame.rect.h > 8) {
                ctx.fillStyle = isIncluded ? 'rgba(255,255,255,0.8)' : 'rgba(169,177,214,0.6)';
                ctx.font = `${12 / zoomLevel}px var(--font-sans)`;
                ctx.fillText(subFrame.id, subFrame.rect.x + (4 / zoomLevel), subFrame.rect.y + (14 / zoomLevel));
            }
        });

        if (isResizing && selectedFrameId !== null) {
            const frame = frames.find(f => f.id === selectedFrameId);
            if (frame) {
                const { x, y, w, h } = frame.rect;
                ctx.strokeStyle = 'rgba(122, 162, 247, 0.7)';
                ctx.lineWidth = 1 / zoomLevel;
                ctx.setLineDash([5 / zoomLevel, 3 / zoomLevel]);
                ctx.beginPath();
                if (resizeHandle.includes('t') || resizeHandle.includes('b')) {
                    ctx.moveTo(0, y); ctx.lineTo(canvas.width, y);
                    ctx.moveTo(0, y + h); ctx.lineTo(canvas.width, y + h);
                }
                if (resizeHandle.includes('l') || resizeHandle.includes('r')) {
                    ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height);
                    ctx.moveTo(x + w, 0); ctx.lineTo(x + w, canvas.height);
                }
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
    
        if (isDrawing && newRect) {
            ctx.strokeStyle = 'var(--warning)';
            ctx.lineWidth = 1 / zoomLevel;
            ctx.strokeRect(newRect.x, newRect.y, newRect.w, newRect.h);
        }
        drawRulers();
    };
    
    const drawResizeHandles = (rect) => {
        const handleSize = HANDLE_SIZE / zoomLevel;
        ctx.fillStyle = 'var(--danger)';
        const half = handleSize / 2;
        const handles = getResizeHandles(rect);
        Object.values(handles).forEach(handle => ctx.fillRect(handle.x - half, handle.y - half, handleSize, handleSize));
    };
    
    const drawRulers = () => {
        ctxTop.clearRect(0, 0, rulerTop.width, rulerTop.height);
        ctxLeft.clearRect(0, 0, rulerLeft.width, rulerLeft.height);
        if (!imageDisplay.src || !imageDisplay.complete) return;
    
        const scrollLeft = editorArea.scrollLeft;
        const scrollTop = editorArea.scrollTop;
    
        ctxTop.font = ctxLeft.font = '10px var(--font-sans)';
        ctxTop.fillStyle = ctxLeft.fillStyle = 'var(--ps-text-medium)'; // Corrected variable
        
        let step = 10;
        if (zoomLevel < 0.5) step = 50;
        if (zoomLevel < 0.2) step = 100;
        const majorStep = step * 5;
    
        for (let x = 0; x <= imageDisplay.naturalWidth; x += step) {
            const screenX = (x * zoomLevel) - scrollLeft;
            const isMajor = x % majorStep === 0;
            ctxTop.beginPath();
            ctxTop.moveTo(screenX, isMajor ? 15 : 22);
            ctxTop.lineTo(screenX, 30);
            ctxTop.stroke();
            if (isMajor) {
                ctxTop.fillText(x, screenX + 2, 12);
            }
        }
    
        for (let y = 0; y <= imageDisplay.naturalHeight; y += step) {
            const screenY = (y * zoomLevel) - scrollTop;
            const isMajor = y % majorStep === 0;
            ctxLeft.beginPath();
            ctxLeft.moveTo(isMajor ? 15 : 22, screenY);
            ctxLeft.lineTo(30, screenY);
            ctxLeft.stroke();
            if (isMajor) {
                ctxLeft.fillText(y, 4, screenY + 10);
            }
        }
    };

    editorArea.addEventListener('scroll', drawRulers);
    
    const getMousePos = (e) => {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / zoomLevel,
            y: (e.clientY - rect.top) / zoomLevel
        };
    };
    
    const getFrameAtPos = (pos) => frames.slice().reverse().find(f => pos.x >= f.rect.x && pos.x <= f.rect.x + f.rect.w && pos.y >= f.rect.y && pos.y <= f.rect.y + f.rect.h);
    const getResizeHandles = (rect) => { const {x, y, w, h} = rect; return { tl: { x, y }, tr: { x: x + w, y }, bl: { x, y: y + h }, br: { x: x + w, y: y + h }, t: { x: x + w/2, y }, b: { x: x + w/2, y: y + h }, l: { x, y: y + h/2 }, r: { x: x + w, y: y + h/2 } }; };
    const getHandleAtPos = (pos) => { if(isLocked) return null; const frame = frames.find(f => f.id === selectedFrameId); if (!frame) return null; const handleSize = HANDLE_SIZE / zoomLevel; for (const [name, handlePos] of Object.entries(getResizeHandles(frame.rect))) { if (Math.abs(pos.x - handlePos.x) < handleSize/2 && Math.abs(pos.y - handlePos.y) < handleSize/2) return name; } return null; };
    const getSliceAtPos = (pos) => { const frame = frames.find(f => f.id === selectedFrameId && f.type === 'group'); if (!frame) return null; const sliceHandleWidth = SLICE_HANDLE_WIDTH / zoomLevel; const yCoords = [0, ...frame.hSlices.sort((a,b)=>a-b), frame.rect.h]; const rowIndex = yCoords.findIndex((y, i) => pos.y >= frame.rect.y + y && pos.y < frame.rect.y + yCoords[i + 1]); if (rowIndex === -1) return null; for (let i = 0; i < frame.vSlices.length; i++) { const slice = frame.vSlices[i], xPos = slice.rowOverrides[rowIndex] !== undefined ? slice.rowOverrides[rowIndex] : slice.globalX; if (xPos === null) continue; if (Math.abs(pos.x - (frame.rect.x + xPos)) < sliceHandleWidth / 2) return { axis: 'v', index: i, rowIndex: rowIndex }; } for (let i = 0; i < frame.hSlices.length; i++) { if (Math.abs(pos.y - (frame.rect.y + frame.hSlices[i])) < sliceHandleWidth / 2) return { axis: 'h', index: i, rowIndex: rowIndex }; } return null; };
    
    const setActiveTool = (toolName) => {
        activeTool = toolName;
        document.querySelectorAll('.left-toolbar .tool-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(`${toolName}-tool-button`);
        if (activeBtn) activeBtn.classList.add('active');
        
        canvas.classList.toggle('cursor-eraser', toolName === 'eraser');

        isDrawing = isDragging = isResizing = isDraggingSlice = false;
        newRect = resizeHandle = draggedSlice = null;
    };
    selectToolButton.addEventListener('click', () => setActiveTool('select'));
    createFrameToolButton.addEventListener('click', () => setActiveTool('create'));
    eraserToolButton.addEventListener('click', () => setActiveTool('eraser'));
    autoDetectToolButton.addEventListener('click', () => detectSprites());

    // === MODIFICADO: Manejador de eventos 'mousedown' y 'mousemove' ===
    canvas.addEventListener('mousedown', (e) => {
        const pos = getMousePos(e);
        startPos = pos;
        
        const frameAtClick = getFrameAtPos(pos);

        // Universal interaction: Slicing (Alt/Ctrl + Click)
        if (frameAtClick && (e.altKey || e.ctrlKey || e.metaKey)) {
            if(isLocked){ showToast('Desbloquea los frames para editar (L)', 'warning'); return; }
            e.preventDefault();
            selectedFrameId = frameAtClick.id;
            if (frameAtClick.type !== 'group') { 
                frameAtClick.type = 'group'; 
                frameAtClick.hSlices = []; 
                frameAtClick.vSlices = []; 
            }
            if (e.altKey) { 
                frameAtClick.hSlices.push(pos.y - frameAtClick.rect.y); 
            } else { // CtrlKey for vertical slicing
                const yCoords = [0, ...frameAtClick.hSlices.sort((a, b) => a - b), frameAtClick.rect.h];
                const rowIndex = yCoords.findIndex((y, i) => pos.y >= frameAtClick.rect.y + y && pos.y < frameAtClick.rect.y + yCoords[i + 1]);
                if (rowIndex > -1) {
                    const newVSlice = { id: Date.now(), globalX: null, rowOverrides: {[rowIndex]: pos.x - frameAtClick.rect.x} };
                    frameAtClick.vSlices.push(newVSlice);
                }
            }
            saveLocalState();
            updateAll(false);
            return;
        }

        // Tool-specific logic
        switch (activeTool) {
            case 'select':
                if (isLocked) {
                    showToast('Frames bloqueados. Desbloquéalos para mover/redimensionar (L).', 'warning');
                    selectedFrameId = frameAtClick ? frameAtClick.id : null; // Allow selection for viewing, but not editing
                    updateAll(false);
                    return;
                }
                resizeHandle = getHandleAtPos(startPos);
                draggedSlice = getSliceAtPos(startPos);

                if (resizeHandle) {
                    isResizing = true;
                } else if (draggedSlice) {
                    isDraggingSlice = true;
                } else if (frameAtClick) {
                    if (selectedFrameId !== frameAtClick.id) { localHistoryStack = []; localHistoryIndex = -1; }
                    selectedFrameId = frameAtClick.id;
                    localHistoryFrameId = selectedFrameId;
                    isDragging = true;
                } else {
                    selectedFrameId = null;
                }
                break;

            case 'create':
                if (isLocked) { showToast('Desbloquea los frames para crear nuevos (L)', 'warning'); return; }
                if (!frameAtClick) {
                    selectedFrameId = null;
                    isDrawing = true;
                    newRect = { x: startPos.x, y: startPos.y, w: 0, h: 0 };
                }
                break;

            case 'eraser':
                if (isLocked) { showToast('Desbloquea los frames para borrar (L)', 'warning'); return; }
                if (frameAtClick) {
                    // 1. Get current flattened sub-frame IDs BEFORE deletion
                    const subFrameIdsBefore = getFlattenedFrames().map(f => f.id);

                    // 2. Remove the main frame
                    frames = frames.filter(f => f.id !== frameAtClick.id);
                    if (selectedFrameId === frameAtClick.id) selectedFrameId = null;

                    // 3. Get new flattened sub-frame IDs and find removed ones
                    const subFrameIdsAfter = new Set(getFlattenedFrames().map(f => f.id));
                    const idsToRemove = subFrameIdsBefore.filter(id => !subFrameIdsAfter.has(id));

                    // 4. Remove these IDs from all animation clips
                    if (idsToRemove.length > 0) {
                        clips.forEach(clip => {
                            clip.frameIds = clip.frameIds.filter(id => !idsToRemove.includes(id));
                        });
                    }
                    updateAll(true); // Save global state and redraw
                }
                break;
        }
        
        // Only update UI if not in eraser mode (eraser redraws on click)
        if (activeTool !== 'eraser') {
            updateAll(false);
        }
    });

    canvas.addEventListener('mousemove', (e) => { 
        const pos = getMousePos(e); 
        
        // Update cursor style based on active tool and state
        if (isLocked) {
            canvas.style.cursor = 'not-allowed';
            canvas.classList.remove('cursor-eraser'); // Ensure eraser cursor is off if locked
        } else if (activeTool === 'select') {
            const handle = getHandleAtPos(pos); 
            const slice = getSliceAtPos(pos); 
            if (handle) { 
                if (handle.includes('t') || handle.includes('b')) canvas.style.cursor = 'ns-resize';
                else if (handle.includes('l') || handle.includes('r')) canvas.style.cursor = 'ew-resize';
                else if (handle.includes('d')) canvas.style.cursor = 'nwse-resize'; // Diagonal
                else if (handle.includes('c')) canvas.style.cursor = 'nesw-resize'; // Diagonal
            } else if (slice) { 
                canvas.style.cursor = slice.axis === 'v' ? 'ew-resize' : 'ns-resize'; 
            } else if (getFrameAtPos(pos)) { 
                canvas.style.cursor = 'move'; 
            } else { 
                canvas.style.cursor = 'default'; 
            } 
            canvas.classList.remove('cursor-eraser');
        } else if (activeTool === 'create') {
            canvas.style.cursor = 'crosshair';
            canvas.classList.remove('cursor-eraser');
        } else if (activeTool === 'eraser') {
            canvas.style.cursor = 'default'; // Let CSS handle the custom cursor icon
            canvas.classList.add('cursor-eraser');
        }

        // Update frame/slice position/size if actively dragging/resizing
        if (isResizing && selectedFrameId !== null && !isLocked) {
            const frame = frames.find(f => f.id === selectedFrameId);
            if (frame) {
                let { x, y, w, h } = frame.rect;
                const ox2 = x + w, oy2 = y + h; // Original x2, y2

                if (resizeHandle.includes('l')) x = pos.x;
                if (resizeHandle.includes('t')) y = pos.y;
                if (resizeHandle.includes('r')) w = pos.x - x;
                if (resizeHandle.includes('b')) h = pos.y - y;

                // Adjust width/height if resizing from top/left (negative width/height scenario)
                if (resizeHandle.includes('l')) w = ox2 - x;
                if (resizeHandle.includes('t')) h = oy2 - y;

                frame.rect = { x: x, y: y, w: w, h: h };
            }
        } else if (isDragging && selectedFrameId !== null && !isLocked) {
            const frame = frames.find(f => f.id === selectedFrameId);
            if (frame) {
                const dx = pos.x - startPos.x;
                const dy = pos.y - startPos.y;
                frame.rect.x += dx;
                frame.rect.y += dy;
                startPos = pos; // Update start position for continuous dragging
            }
        } else if (isDraggingSlice && selectedFrameId !== null && !isLocked) {
            const frame = frames.find(f => f.id === selectedFrameId);
            if (frame && draggedSlice) {
                if (draggedSlice.axis === 'v') {
                    let newX = pos.x - frame.rect.x;
                    newX = Math.max(0, Math.min(newX, frame.rect.w)); // Clamp within frame bounds
                    const vSlice = frame.vSlices[draggedSlice.index];
                    if (e.altKey) vSlice.rowOverrides[draggedSlice.rowIndex] = newX;
                    else vSlice.globalX = newX;
                } else { // Horizontal slice
                    let newY = pos.y - frame.rect.y;
                    newY = Math.max(0, Math.min(newY, frame.rect.h)); // Clamp within frame bounds
                    frame.hSlices[draggedSlice.index] = newY;
                }
            }
        } else if (isDrawing && newRect && !isLocked) {
            newRect.w = pos.x - newRect.x;
            newRect.h = pos.y - newRect.y;
        }
        drawAll(); 
    });
    
    canvas.addEventListener('mouseup', () => {
        let stateChanged = false;
        if (isResizing || isDragging || isDraggingSlice) {
            const frame = frames.find(f => f.id === selectedFrameId);
            if (frame) {
                // Normalize negative width/height
                if (frame.rect.w < 0) { frame.rect.x += frame.rect.w; frame.rect.w *= -1; }
                if (frame.rect.h < 0) { frame.rect.y += frame.rect.h; frame.rect.h *= -1; }
            }
            if (isDraggingSlice) saveLocalState();
            else stateChanged = true;
        } else if (isDrawing && newRect) {
            // Normalize negative width/height for new rect
            if (newRect.w < 0) { newRect.x += newRect.w; newRect.w *= -1; }
            if (newRect.h < 0) { newRect.y += newRect.h; newRect.h *= -1; }

            if (newRect.w > 4 && newRect.h > 4) { // Only add if a reasonable size
                const newId = frames.length > 0 ? Math.max(...frames.map(f => f.id)) + 1 : 0;
                frames.push({ id: newId, name: `frame_${newId}`, rect: newRect, type: 'simple' });
                selectedFrameId = newId;
                stateChanged = true;
            }
        }
        isDrawing = isDragging = isResizing = isDraggingSlice = false;
        newRect = resizeHandle = draggedSlice = null;
        updateAll(stateChanged);
    });

    canvas.addEventListener('dblclick', (e) => {
        const subFrame = getFlattenedFrames().slice().reverse().find(f => {
            const pos = getMousePos(e);
            return pos.x >= f.rect.x && pos.x <= f.rect.x + f.rect.w && pos.y >= f.rect.y && pos.y <= f.rect.y + f.rect.h;
        });
        if (subFrame) {
            const clip = getActiveClip();
            if (!clip) return;
            const idx = clip.frameIds.indexOf(subFrame.id);
            if (idx > -1) clip.frameIds.splice(idx, 1);
            else clip.frameIds.push(subFrame.id);
            updateAll(false);
            saveCurrentSession();
        }
    });

    // --- Slicing and Grid Generation ---
    function clearAll(isInitial = false) {
        frames = [];
        clips = []; // Also clear clips
        activeClipId = null;
        selectedFrameId = null;
        if (!isInitial) updateAll(true);
    }

    // Clear Button
    clearButton.addEventListener('click', () => {
        if(isLocked){ showToast('Desbloquea los frames primero (L)', 'warning'); return; }
        if(frames.length > 0 && confirm('¿Seguro que quieres borrar TODOS los frames? Esta acción es irreversible.')) {
            clearAll(false);
        } else if (frames.length === 0) {
            showToast('No hay frames para borrar.', 'info');
        }
    });

    // Generate Grid Button
    generateGridButton.addEventListener('click', () => {
        if(isLocked){ showToast('Desbloquea los frames primero (L)', 'warning'); return; }
        if(frames.length > 0 && !confirm('Esto borrará los frames existentes y generará una nueva parrilla. ¿Continuar?')) return;

        const r = parseInt(rowsInput.value), c = parseInt(colsInput.value);
        if(isNaN(r) || isNaN(c) || r < 1 || c < 1) { showToast('Filas y Columnas deben ser números positivos.', 'warning'); return; }
        
        const w = canvas.width / c, h = canvas.height / r;
        const newFrame = { id: 0, name: `grid_group`, rect: { x: 0, y: 0, w: canvas.width, h: canvas.height }, type: 'group', vSlices: [], hSlices: [] };
        for (let i = 1; i < c; i++) newFrame.vSlices.push({ id: Date.now()+i, globalX: i*w, rowOverrides: {} });
        for (let i = 1; i < r; i++) newFrame.hSlices.push(i*h);
        
        frames = [newFrame];
        clips = []; // Clear clips as all old frames are replaced
        activeClipId = null;
        updateAll(true);
        showToast('Parrilla generada con éxito.', 'success');
    });

    // Generate By Size Button
    generateBySizeButton.addEventListener('click', () => {
        if(isLocked){ showToast('Desbloquea los frames primero (L)', 'warning'); return; }
        if(frames.length > 0 && !confirm('Esto borrará los frames existentes y generará frames por tamaño. ¿Continuar?')) return;

        const w = parseInt(cellWInput.value), h = parseInt(cellHInput.value);
        if(isNaN(w) || isNaN(h) || w < 1 || h < 1) { showToast('Ancho y Alto deben ser números positivos.', 'warning'); return; }
        
        const newFrame = { id: 0, name: `sized_group`, rect: { x: 0, y: 0, w: canvas.width, h: canvas.height }, type: 'group', vSlices: [], hSlices: [] };
        for (let x=w; x<canvas.width; x+=w) newFrame.vSlices.push({ id: Date.now()+x, globalX: x, rowOverrides: {} });
        for (let y=h; y<canvas.height; y+=h) newFrame.hSlices.push(y);
        
        frames = [newFrame];
        clips = []; // Clear clips as all old frames are replaced
        activeClipId = null;
        updateAll(true);
        showToast('Frames generados por tamaño con éxito.', 'success');
    });
    
    // --- Automatic Sprite Detection ---
    const detectSprites = async () => {
        if (isLocked) { showToast('Desbloquea los frames primero (L)', 'warning'); return; }
        if (frames.length > 0 && !confirm('Esta acción borrará todos los frames existentes y buscará nuevos automáticamente. ¿Deseas continuar?')) return;

        showLoader('Detectando sprites...');
        autoDetectButton.disabled = true;
        autoDetectToolButton.disabled = true;

        setTimeout(() => { // Use setTimeout to allow UI to update and show loader
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

                // Determine background color from top-left pixel
                const bgR = data[0], bgG = data[1], bgB = data[2], bgA = data[3];

                const isBackgroundColor = (index) => {
                    const r = data[index], g = data[index + 1], b = data[index + 2], a = data[index + 3];
                    if (a === 0) return true; // Fully transparent is always background
                    if (bgA < 255 && a > 0) return false; // If background is transparent, any opaque pixel is not background
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
                            
                            const neighbors = [[cx, cy - 1], [cx, cy + 1], [cx - 1, cy], [cx + 1, cy]]; // 4-way connectivity
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
                    frames = newFrames;
                    clips = []; // Clear clips as all old frames are replaced
                    activeClipId = null;
                    selectedFrameId = null;
                    showToast(`¡Detección completada! Se encontraron ${newFrames.length} sprites.`, 'success');
                    updateAll(true);
                } else {
                    showToast('No se encontraron sprites con la tolerancia actual.', 'warning');
                }
            } catch (error) {
                console.error("Error during sprite detection:", error);
                showToast('Ocurrió un error durante la detección.', 'danger');
            } finally {
                hideLoader();
                autoDetectButton.disabled = false;
                autoDetectToolButton.disabled = false;
            }
        }, 50); // Small delay to ensure loader appears
    };
    autoDetectButton.addEventListener('click', detectSprites);

    // --- Clip, Animation ---
    const getActiveClip = () => clips.find(c => c.id === activeClipId);
    const createNewClip = (name) => {
        const newName = name || prompt("Nombre del nuevo clip:", `Clip ${clips.length + 1}`);
        if (!newName) return;
        clips.push({ id: Date.now(), name: newName, frameIds: [] });
        activeClipId = clips[clips.length - 1].id;
        updateUI();
        resetAnimation();
        saveCurrentSession();
    };
    newClipButton.addEventListener('click', () => createNewClip());
    renameClipButton.addEventListener('click', () => {
        const clip = getActiveClip();
        if (clip) {
            const newName = prompt("Nuevo nombre:", clip.name);
            if(newName) { clip.name = newName; updateUI(); saveCurrentSession(); }
        }
    });
    deleteClipButton.addEventListener('click', () => {
        if (clips.length <= 1) return showToast("No puedes eliminar el último clip.", 'warning');
        if(confirm('¿Eliminar clip?')) {
            clips = clips.filter(c => c.id !== activeClipId);
            activeClipId = clips[0]?.id || null;
            updateUI();
            resetAnimation();
            saveCurrentSession();
        }
    });
    clipsSelect.addEventListener('change', (e) => { activeClipId = parseInt(e.target.value); updateAll(false); saveCurrentSession(); });
    const updateClipsSelect = () => {
        const prevId = activeClipId;
        clipsSelect.innerHTML = '';
        clips.forEach(c => {const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.name; clipsSelect.appendChild(opt);});
        
        if (clips.find(c => c.id === prevId)) {
            clipsSelect.value = prevId;
        } else if (clips.length > 0) {
            clipsSelect.value = clips[0].id;
        }
        
        activeClipId = clipsSelect.value ? parseInt(clipsSelect.value) : null;
        if (!activeClipId && clips.length > 0) {
            activeClipId = clips[0].id; // Fallback if activeId was removed
        }
        if (clips.length === 0 && getFlattenedFrames().length > 0) {
            createNewClip("Default"); // Auto-create default clip if none exist but frames do
        }
    };
    const updateFramesList = () => {
        framesList.innerHTML = '';
        const activeClip = getActiveClip();
        const allFrames = getFlattenedFrames();
        if(allFrames.length === 0) {framesList.innerHTML = `<li>No hay frames definidos.</li>`; return;};
        allFrames.forEach(f => {
            const li = document.createElement('li');
            const isChecked = activeClip?.frameIds.includes(f.id);
            li.innerHTML = `<input type="checkbox" ${isChecked ? 'checked' : ''} data-frame-id="${f.id}"> F${f.id}: ${f.name} (${f.rect.w}x${f.rect.h})`;
            framesList.appendChild(li);
        });
    };
    framesList.addEventListener('change', (e) => {
        if(e.target.matches('[data-frame-id]')) {
            const clip = getActiveClip();
            if(!clip) return;
            const id = parseInt(e.target.dataset.frameId);
            if (e.target.checked) { if(!clip.frameIds.includes(id)) clip.frameIds.push(id); }
            else { clip.frameIds = clip.frameIds.filter(fid => fid !== id); }
            updateAll(false);
            saveCurrentSession();
        }
    });
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
    const toggleLock = () => { isLocked = !isLocked; lockFramesButton.textContent = isLocked ? '🔒' : '🔓'; lockFramesButton.classList.toggle('locked', isLocked); showToast(isLocked ? 'Frames bloqueados' : 'Frames desbloqueados', 'primary'); drawAll(); };
    const toggleFullscreen = () => { if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(err => { alert(`Error al intentar entrar en pantalla completa: ${err.message} (${err.name})`); }); } else { document.exitFullscreen(); } };

    undoButton.addEventListener('click', undo);
    redoButton.addEventListener('click', redo);
    lockFramesButton.addEventListener('click', toggleLock);
    fullscreenButton.addEventListener('click', toggleFullscreen);

    // --- Keyboard Shortcuts ---
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

        // Slice deletion
        if ((e.key === 'Delete' || e.key === 'Backspace') && draggedSlice && !isLocked) {
            e.preventDefault();
            const frame = frames.find(f => f.id === selectedFrameId);
            if (draggedSlice.axis === 'v') { frame.vSlices.splice(draggedSlice.index, 1); } 
            else { frame.hSlices.splice(draggedSlice.index, 1); }
            draggedSlice = null; 
            saveLocalState();
            updateAll(false);
            return;
        }

        // Global Undo/Redo
        if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
        if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
        
        // Frame deletion with Delete/Backspace key
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedFrameId !== null) {
            if(isLocked) { showToast('Desbloquea el frame para eliminar (L)', 'warning'); return; }
            e.preventDefault();
            
            // Re-use eraser logic for consistency
            const frameToDelete = frames.find(f => f.id === selectedFrameId);
            if (frameToDelete) {
                // 1. Get current flattened sub-frame IDs BEFORE deletion
                const subFrameIdsBefore = getFlattenedFrames().map(f => f.id);

                // 2. Remove the main frame
                frames = frames.filter(f => f.id !== frameToDelete.id);
                selectedFrameId = null;

                // 3. Get new flattened sub-frame IDs and find removed ones
                const subFrameIdsAfter = new Set(getFlattenedFrames().map(f => f.id));
                const idsToRemove = subFrameIdsBefore.filter(id => !subFrameIdsAfter.has(id));

                // 4. Remove these IDs from all animation clips
                if (idsToRemove.length > 0) {
                    clips.forEach(clip => {
                        clip.frameIds = clip.frameIds.filter(id => !idsToRemove.includes(id));
                    });
                }
                updateAll(true); // Save global state and redraw
                showToast(`Frame ${frameToDelete.name} eliminado.`, 'success');
            }
        }
        
        // Tool shortcuts
        if (e.key.toLowerCase() === 'c') { e.preventDefault(); setActiveTool('create'); }
        if (e.key.toLowerCase() === 'v') { e.preventDefault(); setActiveTool('select'); }
        if (e.key.toLowerCase() === 'e') { e.preventDefault(); setActiveTool('eraser'); }
        if (e.key.toLowerCase() === 'l') { e.preventDefault(); toggleLock(); }
        if (e.key.toLowerCase() === 'm') { e.preventDefault(); toggleFullscreen(); }
        if (e.key === 'Escape') { /* ... (código sin cambios) ... */ }
    });
    
    // --- Exportation and Project History ---
    document.body.addEventListener('click', (e) => { if (e.target.classList.contains('copy-button')) { const targetId = e.target.dataset.target; const pre = document.getElementById(targetId); navigator.clipboard.writeText(pre.textContent).then(() => showToast('¡Copiado al portapapeles!')); } });
    const highlightSyntax = (str, lang) => { /* ... (código sin cambios) ... */ };
    const updateJsonOutput = () => { /* ... (código sin cambios) ... */ };
    jsonFormatSelect.addEventListener('change', updateJsonOutput);
    exportZipButton.addEventListener('click', async () => { /* ... (código sin cambios) ... */ });
    exportGifButton.addEventListener('click', () => { /* ... (código sin cambios) ... */ });
    exportCodeButton.addEventListener('click', () => { /* ... (código sin cambios) ... */ });
    function generateCssAnimationCode(animFrames, scale) { /* ... (código sin cambios) ... */ }
    const getHistory = () => JSON.parse(localStorage.getItem('spriteSheetHistory') || '[]');
    const saveHistory = (history) => localStorage.setItem('spriteSheetHistory', JSON.stringify(history));
    const addToHistory = () => {
        const id=Date.now();
        const thumbCanvas=document.createElement('canvas');
        const thumbCtx=thumbCanvas.getContext('2d');
        const thumbSize=40;
        thumbCanvas.width=thumbSize;
        thumbCanvas.height=thumbSize;
        if (imageDisplay.naturalWidth > 0 && imageDisplay.naturalHeight > 0) {
            thumbCtx.drawImage(imageDisplay,0,0,imageDisplay.naturalWidth,imageDisplay.naturalHeight,0,0,thumbSize,thumbSize);
        }
        const thumbSrc=thumbCanvas.toDataURL();
        const historyEntry={id,name:currentFileName,thumb:thumbSrc};
        let history=getHistory();
        history=history.filter(item=>item.name!==currentFileName); // Remove old entry if same file
        history.unshift(historyEntry);
        if(history.length>5)history.pop(); // Keep only last 5 entries
        saveHistory(history);
        const fullState={imageSrc:imageDisplay.src,fileName:currentFileName,frames,clips,activeClipId, historyStack, historyIndex};
        localStorage.setItem(`history_${id}`,JSON.stringify(fullState));
        updateHistoryPanel();
    };
    const updateHistoryPanel = () => { /* ... (código sin cambios) ... */ };
    projectHistoryList.addEventListener('click', (e) => { /* ... (código sin cambios) ... */ });
    const exportPanel = document.getElementById('export-panel');
    const exportSubPanels = exportPanel.querySelectorAll('.sub-panel');
    exportSubPanels.forEach(panel => { /* ... (código sin cambios) ... */ });

    // Initial Load
    loadLastSession();
    updateHistoryPanel();
    setControlsEnabled(false);
});