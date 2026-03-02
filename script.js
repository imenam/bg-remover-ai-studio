// ─── State ─────────────────────────────────────────────────────────────────────
let originalFile = null;       // raw File from upload
let croppedBlob  = null;       // blob after crop applied
let removedBlob  = null;       // blob from backend
let removedImg   = null;       // Image element of removedBlob
let bgMode       = 'solid';    // solid | gradient | none
let solidColor   = '#ffffff';
let gradColor1   = '#c8f542';
let gradColor2   = '#6ee7b7';
let gradDeg      = 135;

// Crop state
let cropImg = null;            // Image element for crop step
let cropSel = null;            // {x, y, w, h} in natural image pixels
let cropMode = 'idle';         // 'idle', 'new', 'move', 'resize'
let activeHandle = null;       // 'tl', 'tr', 'bl', 'br'
let dragStart = { x: 0, y: 0 };
let startSel = null;
let lockedRatio = null;        // null = free, number = w/h

// ─── DOM Elements ─────────────────────────────────────────────────────────────
const uploadZone = document.getElementById('uploadZone');
const fileInput  = document.getElementById('fileInput');
const browseLink = document.getElementById('browseLink');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const cropCanvas = document.getElementById('cropCanvas');
const cropCtx = cropCanvas.getContext('2d');
const cropHintBox = document.getElementById('cropHintBox');
const sizeInfo = document.getElementById('cropSizeInfo');
const applyCropBtn = document.getElementById('applyCropBtn');
const resetCropBtn = document.getElementById('resetCropBtn');
const backToUploadBtn = document.getElementById('backToUploadBtn');
const proceedToRemoveBtn = document.getElementById('proceedToRemoveBtn');
const croppedPreview = document.getElementById('croppedPreview');
const removeBgBtn = document.getElementById('removeBgBtn');
const backToCropBtn = document.getElementById('backToCropBtn');
const spinnerWrap = document.getElementById('spinnerWrap');
const removeActionRow = document.getElementById('removeActionRow');
const removedPreviewCanvas = document.getElementById('removedPreviewCanvas');
const removedPlaceholder = document.getElementById('removedPlaceholder');
const resultCanvas = document.getElementById('resultCanvas');
const resultCtx = resultCanvas.getContext('2d');
const finalPreviewCanvas = document.getElementById('finalPreviewCanvas');
const backToRemoveBtn = document.getElementById('backToRemoveBtn');
const goToDownloadBtn = document.getElementById('goToDownloadBtn');
const backToBgBtn = document.getElementById('backToBgBtn');
const startOverBtn = document.getElementById('startOverBtn');
const solidColorPicker = document.getElementById('solidColorPicker');
const solidColorHex = document.getElementById('solidColorHex');
const gradColor1Input = document.getElementById('gradColor1');
const gradColor2Input = document.getElementById('gradColor2');
const gradPreview = document.getElementById('gradPreview');
const swatchRow = document.getElementById('swatchRow');
const cropX = document.getElementById('cropX');
const cropY = document.getElementById('cropY');
const cropW = document.getElementById('cropW');
const cropH = document.getElementById('cropH');
const customRatioW = document.getElementById('customRatioW');
const customRatioH = document.getElementById('customRatioH');
const applyCustomRatio = document.getElementById('applyCustomRatio');

// ─── Step navigation ──────────────────────────────────────────────────────────
function gotoStep(n){
  document.querySelectorAll('.step-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('step'+n).classList.add('active');
  for(let i=1;i<=5;i++){
    const si=document.getElementById('si-'+i);
    si.classList.remove('active','done');
    if(i<n) si.classList.add('done');
    else if(i===n) si.classList.add('active');
    if(i<5){
      const sc=document.getElementById('sc-'+i);
      sc.classList.remove('done');
      if(i<n) sc.classList.add('done');
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function loadImageFromBlob(blob){
  return new Promise((res,rej)=>{
    const img=new Image();
    img.onload=()=>res(img);
    img.onerror=rej;
    img.src=URL.createObjectURL(blob);
  });
}
function blobToFile(blob,name){ return new File([blob],name,{type:blob.type}); }

// ─── STEP 1: Upload ───────────────────────────────────────────────────────────
// FIX: Prevent event bubbling on the browse link
browseLink.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});
uploadZone.addEventListener('click',()=>fileInput.click());
uploadZone.addEventListener('dragover',e=>{e.preventDefault();uploadZone.classList.add('dragover')});
uploadZone.addEventListener('dragleave',()=>uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop',e=>{e.preventDefault();uploadZone.classList.remove('dragover');handleUpload(e.dataTransfer.files[0])});
fileInput.addEventListener('change',e=>handleUpload(e.target.files[0]));

function handleUpload(file){
  if(!file||!file.type.match(/image\/(jpeg|png|webp)/)) return;
  
  // FIX: Clear input value so the same file can be uploaded again if needed
  if(fileInput) fileInput.value = "";

  // FIX: Reset previous state to ensure a clean slate
  cropSel = null; 
  croppedBlob = null;
  removedBlob = null;
  removedImg = null;

  originalFile=file;
  fileNameDisplay.textContent=file.name;
  const reader=new FileReader();
  reader.onload=e=>{
    const img=new Image();
    img.onload=()=>{
      initCropCanvas(img);
      gotoStep(2);
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}

// ─── STEP 2: Crop ─────────────────────────────────────────────────────────────

function initCropCanvas(img) {
  cropImg = img;
  cropCanvas.width = img.naturalWidth;
  cropCanvas.height = img.naturalHeight;
  cropSel = null;
  cropMode = 'idle';
  updateCropFieldsFromCss();
  applyCropBtn.disabled = true;
  sizeInfo.textContent = `${img.naturalWidth} × ${img.naturalHeight} px`;
  drawCropScene();
}

function drawCropScene() {
  if (!cropImg) return;
  cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
  cropCtx.drawImage(cropImg, 0, 0);

  if (!cropSel || cropSel.w < 2 || cropSel.h < 2) return;

  const scale = cropCanvas.width / cropCanvas.clientWidth;

  cropCtx.save();
  cropCtx.fillStyle = 'rgba(0,0,0,0.5)';
  cropCtx.beginPath();
  cropCtx.rect(0, 0, cropCanvas.width, cropCanvas.height);
  cropCtx.rect(cropSel.x, cropSel.y, cropSel.w, cropSel.h);
  cropCtx.fill('evenodd');
  cropCtx.restore();

  cropCtx.strokeStyle = '#c8f542';
  cropCtx.lineWidth = Math.max(1, 2 * scale);
  cropCtx.strokeRect(cropSel.x, cropSel.y, cropSel.w, cropSel.h);

  const handles = getHandlePositions(cropSel);
  cropCtx.fillStyle = '#c8f542';
  const hSize = 12 * scale;
  for (let key in handles) {
    let pos = handles[key];
    cropCtx.fillRect(pos.x - hSize / 2, pos.y - hSize / 2, hSize, hSize);
  }
}

function getCanvasPos(e) {
  const r = cropCanvas.getBoundingClientRect();
  const scaleX = cropCanvas.width / r.width;
  const scaleY = cropCanvas.height / r.height;
  return {
    x: Math.max(0, Math.min((e.clientX - r.left) * scaleX, cropCanvas.width)),
    y: Math.max(0, Math.min((e.clientY - r.top) * scaleY, cropCanvas.height))
  };
}

function distToPoint(px, py, x, y) { return Math.hypot(px - x, py - y); }

function getHandlePositions(sel) {
  if (!sel) return null;
  const { x, y, w, h } = sel;
  return { tl: { x, y }, tr: { x: x + w, y }, bl: { x, y: y + h }, br: { x: x + w, y: y + h } };
}

function getHandleAt(px, py, sel) {
  if (!sel) return null;
  const handles = getHandlePositions(sel);
  const scale = cropCanvas.width / cropCanvas.clientWidth;
  const threshold = 14 * scale;
  for (let [key, pos] of Object.entries(handles)) {
    if (distToPoint(px, py, pos.x, pos.y) <= threshold) return key;
  }
  return null;
}

function isInsideRect(px, py, sel) {
  if (!sel) return false;
  const margin = 10 * (cropCanvas.width / cropCanvas.clientWidth);
  return px >= sel.x + margin && px <= sel.x + sel.w - margin &&
         py >= sel.y + margin && py <= sel.y + sel.h - margin;
}

cropCanvas.addEventListener('pointerdown', startDrag);
cropCanvas.addEventListener('pointermove', onDrag);
cropCanvas.addEventListener('pointerup', endDrag);
cropCanvas.addEventListener('pointercancel', endDrag);

function startDrag(e) {
  if (!cropImg) return;
  e.preventDefault();
  const pos = getCanvasPos(e);

  if (!cropSel) {
    cropMode = 'new';
    dragStart = pos;
    cropHintBox.classList.add('dragging');
    cropCanvas.setPointerCapture(e.pointerId);
    return;
  }

  const handle = getHandleAt(pos.x, pos.y, cropSel);
  if (handle) {
    cropMode = 'resize';
    activeHandle = handle;
    dragStart = pos;
    startSel = { ...cropSel };
    cropHintBox.classList.add('dragging');
    cropCanvas.setPointerCapture(e.pointerId);
    return;
  }

  if (isInsideRect(pos.x, pos.y, cropSel)) {
    cropMode = 'move';
    dragStart = pos;
    startSel = { ...cropSel };
    cropHintBox.classList.add('dragging');
    cropCanvas.setPointerCapture(e.pointerId);
    return;
  }

  cropMode = 'new';
  dragStart = pos;
  cropHintBox.classList.add('dragging');
  cropCanvas.setPointerCapture(e.pointerId);
}

function onDrag(e) {
  if (!cropImg) return;
  const pos = getCanvasPos(e);

  if (cropMode === 'idle') {
    const handle = getHandleAt(pos.x, pos.y, cropSel);
    if (handle) {
      const cursors = { tl: 'nwse-resize', tr: 'nesw-resize', bl: 'nesw-resize', br: 'nwse-resize' };
      cropCanvas.style.cursor = cursors[handle];
    } else if (isInsideRect(pos.x, pos.y, cropSel)) {
      cropCanvas.style.cursor = 'move';
    } else {
      cropCanvas.style.cursor = 'crosshair';
    }
    return;
  }

  if (e.cancelable) e.preventDefault();

  if (cropMode === 'new') {
    let x = Math.min(dragStart.x, pos.x);
    let y = Math.min(dragStart.y, pos.y);
    let w = Math.abs(pos.x - dragStart.x);
    let h = Math.abs(pos.y - dragStart.y);

    if (lockedRatio) {
      const ratio = lockedRatio;
      if (w / h > ratio) h = w / ratio; else w = h * ratio;
      const maxW = cropCanvas.width - x;
      const maxH = cropCanvas.height - y;
      w = Math.min(w, maxW);
      h = Math.min(h, maxH);
      if (w / h > ratio) h = w / ratio; else w = h * ratio;
    }

    cropSel = { x, y, w, h };
    drawCropScene();
    updateCropFieldsFromCss();
    applyCropBtn.disabled = (w < 4 || h < 4);
    return;
  }

  if (cropMode === 'move') {
    let dx = pos.x - dragStart.x;
    let dy = pos.y - dragStart.y;
    let newX = Math.max(0, Math.min(startSel.x + dx, cropCanvas.width - startSel.w));
    let newY = Math.max(0, Math.min(startSel.y + dy, cropCanvas.height - startSel.h));

    cropSel = { ...startSel, x: newX, y: newY };
    drawCropScene();
    updateCropFieldsFromCss();
    applyCropBtn.disabled = false;
    return;
  }

  if (cropMode === 'resize') {
    let { x, y, w, h } = startSel;
    const minSize = 10 * (cropCanvas.width / cropCanvas.clientWidth);

    if (activeHandle === 'tl') {
      let newW = startSel.x + startSel.w - pos.x;
      let newH = startSel.y + startSel.h - pos.y;
      if (lockedRatio) {
        if (newW / newH > lockedRatio) newH = newW / lockedRatio; else newW = newH * lockedRatio;
      }
      newW = Math.max(minSize, Math.min(newW, startSel.x + startSel.w));
      newH = Math.max(minSize, Math.min(newH, startSel.y + startSel.h));
      x = startSel.x + startSel.w - newW;
      y = startSel.y + startSel.h - newH;
      w = newW; h = newH;
    } else if (activeHandle === 'tr') {
      let newW = pos.x - startSel.x;
      let newH = startSel.y + startSel.h - pos.y;
      if (lockedRatio) {
        if (newW / newH > lockedRatio) newH = newW / lockedRatio; else newW = newH * lockedRatio;
      }
      newW = Math.max(minSize, Math.min(newW, cropCanvas.width - startSel.x));
      newH = Math.max(minSize, Math.min(newH, startSel.y + startSel.h));
      y = startSel.y + startSel.h - newH;
      w = newW; h = newH;
    } else if (activeHandle === 'bl') {
      let newW = startSel.x + startSel.w - pos.x;
      let newH = pos.y - startSel.y;
      if (lockedRatio) {
        if (newW / newH > lockedRatio) newH = newW / lockedRatio; else newW = newH * lockedRatio;
      }
      newW = Math.max(minSize, Math.min(newW, startSel.x + startSel.w));
      newH = Math.max(minSize, Math.min(newH, cropCanvas.height - startSel.y));
      x = startSel.x + startSel.w - newW;
      w = newW; h = newH;
    } else if (activeHandle === 'br') {
      let newW = pos.x - startSel.x;
      let newH = pos.y - startSel.y;
      if (lockedRatio) {
        if (newW / newH > lockedRatio) newH = newW / lockedRatio; else newW = newH * lockedRatio;
      }
      newW = Math.max(minSize, Math.min(newW, cropCanvas.width - startSel.x));
      newH = Math.max(minSize, Math.min(newH, cropCanvas.height - startSel.y));
      w = newW; h = newH;
    }

    cropSel = { 
      x: Math.max(0, Math.min(x, cropCanvas.width - w)), 
      y: Math.max(0, Math.min(y, cropCanvas.height - h)), 
      w, h 
    };
    drawCropScene();
    updateCropFieldsFromCss();
    applyCropBtn.disabled = (w < minSize || h < minSize);
  }
}

function endDrag(e) {
  if (cropMode !== 'idle') {
    try { cropCanvas.releasePointerCapture(e.pointerId); } catch(err) {}
    cropMode = 'idle';
    activeHandle = null;
    startSel = null;
    cropHintBox.classList.remove('dragging');
  }
}

function updateCropFieldsFromCss() {
  if (!cropSel) {
    cropX.value = ''; cropY.value = ''; cropW.value = ''; cropH.value = '';
    return;
  }
  cropX.value = Math.round(cropSel.x);
  cropY.value = Math.round(cropSel.y);
  cropW.value = Math.round(cropSel.w);
  cropH.value = Math.round(cropSel.h);
}

[cropX, cropY, cropW, cropH].forEach(input => {
  input.addEventListener('input', () => {
    const x = parseFloat(cropX.value) || 0;
    const y = parseFloat(cropY.value) || 0;
    const w = parseFloat(cropW.value) || 0;
    const h = parseFloat(cropH.value) || 0;
    if (w > 0 && h > 0 && cropImg) {
      cropSel = { x, y, w, h };
      cropSel.x = Math.max(0, Math.min(cropSel.x, cropCanvas.width - cropSel.w));
      cropSel.y = Math.max(0, Math.min(cropSel.y, cropCanvas.height - cropSel.h));
      cropSel.w = Math.min(cropSel.w, cropCanvas.width - cropSel.x);
      cropSel.h = Math.min(cropSel.h, cropCanvas.height - cropSel.y);
      drawCropScene();
      applyCropBtn.disabled = false;
    }
  });
});

document.querySelectorAll('.ratio-chip').forEach(c => {
  c.addEventListener('click', () => {
    document.querySelectorAll('.ratio-chip').forEach(x => x.classList.remove('active'));
    c.classList.add('active');
    const r = c.dataset.ratio;
    if (r === 'free') lockedRatio = null;
    else {
      const [a, b] = r.split(':').map(Number);
      lockedRatio = a / b;
    }
  });
});

applyCustomRatio.addEventListener('click', () => {
  const w = parseFloat(customRatioW.value);
  const h = parseFloat(customRatioH.value);
  if (w > 0 && h > 0) {
    lockedRatio = w / h;
    document.querySelectorAll('.ratio-chip').forEach(x => x.classList.remove('active'));
  } else {
    alert('Please enter valid positive numbers for width and height.');
  }
});

applyCropBtn.addEventListener('click', () => {
  if (!cropSel || !cropImg) return;
  const x = Math.round(cropSel.x);
  const y = Math.round(cropSel.y);
  const w = Math.round(cropSel.w);
  const h = Math.round(cropSel.h);
  
  const off = document.createElement('canvas'); off.width = w; off.height = h;
  off.getContext('2d').drawImage(cropImg, x, y, w, h, 0, 0, w, h);
  off.toBlob(blob => {
    croppedBlob = blob;
    loadImageFromBlob(blob).then(img => {
      initCropCanvas(img);
      applyCropBtn.disabled = true;
      sizeInfo.textContent = `Cropped: ${w} × ${h} px`;
    });
  }, 'image/png');
});

resetCropBtn.addEventListener('click', () => {
  if (!originalFile) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => { croppedBlob = null; initCropCanvas(img); };
    img.src = e.target.result;
  };
  reader.readAsDataURL(originalFile);
});

backToUploadBtn.addEventListener('click', () => gotoStep(1));
proceedToRemoveBtn.addEventListener('click', () => {
  if (!croppedBlob) croppedBlob = originalFile;
  showCroppedPreview();
  gotoStep(3);
});

function showCroppedPreview() {
  const url = URL.createObjectURL(croppedBlob);
  croppedPreview.src = url;
}

// ─── STEP 3: Remove BG ────────────────────────────────────────────────────────
backToCropBtn.addEventListener('click',()=>gotoStep(2));

removeBgBtn.addEventListener('click',async()=>{
  removeBgBtn.disabled=true;
  spinnerWrap.classList.add('active');
  removeActionRow.style.display='none';

  const formData=new FormData();
  formData.append('file', croppedBlob instanceof File ? croppedBlob : blobToFile(croppedBlob,'image.png'));

  try{
    const res=await fetch('http://127.0.0.1:8000/remove-bg',{method:'POST',body:formData});
    if(!res.ok) throw new Error(`Server error ${res.status}: ${await res.text()}`);
    removedBlob=await res.blob();
    removedImg=await loadImageFromBlob(removedBlob);

    removedPreviewCanvas.width=removedImg.naturalWidth;
    removedPreviewCanvas.height=removedImg.naturalHeight;
    removedPreviewCanvas.getContext('2d').drawImage(removedImg,0,0);
    removedPreviewCanvas.style.display='block';
    removedPlaceholder.style.display='none';

    spinnerWrap.classList.remove('active');
    const proceedRow=document.createElement('div');
    proceedRow.className='btn-row center';
    proceedRow.innerHTML=`<button class="btn btn-secondary" id="backToCropBtn2">← Back</button>
      <button class="btn btn-primary" id="goToBgBtn">Choose Background →</button>`;
    document.getElementById('step3').appendChild(proceedRow);
    document.getElementById('backToCropBtn2').addEventListener('click',()=>{
      proceedRow.remove(); removeActionRow.style.display='';
      removeBgBtn.disabled=false; gotoStep(2);
    });
    document.getElementById('goToBgBtn').addEventListener('click',()=>{
      initColorStep();
      gotoStep(4);
    });
  }catch(err){
    spinnerWrap.classList.remove('active');
    removeActionRow.style.display='';
    removeBgBtn.disabled=false;
    alert('Error removing background: '+err.message+'\n\nMake sure your backend is running at http://127.0.0.1:8000');
  }
});

// ─── STEP 4: Background Color ─────────────────────────────────────────────────
const PRESETS_COLORS = [
  {c:null,title:'Transparent'},{c:'#ffffff',title:'White'},{c:'#000000',title:'Black'},
  {c:'#f5f5f5',title:'Light Gray'},{c:'#1a1a1a',title:'Charcoal'},{c:'#c8f542',title:'Lime'},
  {c:'#6ee7b7',title:'Mint'},{c:'#3b82f6',title:'Blue'},{c:'#f59e0b',title:'Amber'},
  {c:'#e11d48',title:'Rose'},{c:'#7c3aed',title:'Violet'},
];

function buildSwatches(){
  swatchRow.innerHTML='';
  PRESETS_COLORS.forEach(({c,title})=>{
    const sw=document.createElement('div');
    sw.className='swatch'+(c===null?' transparent-swatch':'');
    sw.title=title;
    if(c) sw.style.background=c;
    sw.addEventListener('click',()=>{
      solidColor=c; 
      solidColorPicker.value=c||'#ffffff';
      solidColorHex.textContent=c||'transparent';
      document.querySelectorAll('.swatch').forEach(s=>s.classList.remove('active'));
      sw.classList.add('active');
      renderResult();
    });
    if(c===solidColor) sw.classList.add('active');
    swatchRow.appendChild(sw);
  });
}

function initColorStep(){
  buildSwatches();
  renderResult();
  updateGradPreview();
}

document.querySelectorAll('.bg-type-tab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    document.querySelectorAll('.bg-type-tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    bgMode=tab.dataset.bgtype;
    document.getElementById('solidSection').style.display=bgMode==='solid'?'block':'none';
    document.getElementById('gradientSection').style.display=bgMode==='gradient'?'block':'none';
    renderResult();
  });
});

solidColorPicker.addEventListener('input',e=>{
  solidColor=e.target.value;
  solidColorHex.textContent=solidColor;
  document.querySelectorAll('.swatch').forEach(s=>s.classList.remove('active'));
  renderResult();
});

gradColor1Input.addEventListener('input',e=>{ gradColor1=e.target.value; updateGradPreview(); renderResult(); });
gradColor2Input.addEventListener('input',e=>{ gradColor2=e.target.value; updateGradPreview(); renderResult(); });

document.querySelectorAll('#gradDirChips .ratio-chip').forEach(c=>{
  c.addEventListener('click',()=>{
    document.querySelectorAll('#gradDirChips .ratio-chip').forEach(x=>x.classList.remove('active'));
    c.classList.add('active');
    gradDeg=parseInt(c.dataset.deg);
    updateGradPreview(); renderResult();
  });
});

function updateGradPreview(){
  gradPreview.style.background=
    `linear-gradient(${gradDeg}deg, ${gradColor1}, ${gradColor2})`;
  gradColor1Input.style.outline=`3px solid ${gradColor1}`;
  gradColor2Input.style.outline=`3px solid ${gradColor2}`;
}

function buildGradient(ctx,w,h,deg,c1,c2){
  const rad=(deg-90)*Math.PI/180;
  const len=Math.sqrt(w*w+h*h)/2;
  const cx=w/2, cy=h/2;
  const x1=cx-Math.cos(rad)*len, y1=cy-Math.sin(rad)*len;
  const x2=cx+Math.cos(rad)*len, y2=cy+Math.sin(rad)*len;
  const g=ctx.createLinearGradient(x1,y1,x2,y2);
  g.addColorStop(0,c1); g.addColorStop(1,c2);
  return g;
}

function renderResult(){
  if(!removedImg) return;
  const w=removedImg.naturalWidth, h=removedImg.naturalHeight;
  resultCanvas.width=w; resultCanvas.height=h;
  if(bgMode==='none'){
    const sz=Math.max(8,Math.round(Math.min(w,h)/32));
    for(let r=0;r*sz<h;r++) for(let c=0;c*sz<w;c++){
      resultCtx.fillStyle=(r+c)%2===0?'#cccccc':'#888888';
      resultCtx.fillRect(c*sz,r*sz,sz,sz);
    }
  } else if(bgMode==='solid'){
    if(solidColor===null){
      const sz=Math.max(8,Math.round(Math.min(w,h)/32));
      for(let r=0;r*sz<h;r++) for(let c=0;c*sz<w;c++){
        resultCtx.fillStyle=(r+c)%2===0?'#cccccc':'#888888';
        resultCtx.fillRect(c*sz,r*sz,sz,sz);
      }
    } else {
      resultCtx.fillStyle=solidColor;
      resultCtx.fillRect(0,0,w,h);
    }
  } else if(bgMode==='gradient'){
    const grd=buildGradient(resultCtx,w,h,gradDeg,gradColor1,gradColor2);
    resultCtx.fillStyle=grd;
    resultCtx.fillRect(0,0,w,h);
  }
  resultCtx.drawImage(removedImg,0,0);
}

backToRemoveBtn.addEventListener('click',()=>gotoStep(3));
goToDownloadBtn.addEventListener('click',()=>{
  finalPreviewCanvas.width=resultCanvas.width;
  finalPreviewCanvas.height=resultCanvas.height;
  finalPreviewCanvas.getContext('2d').drawImage(resultCanvas,0,0);
  gotoStep(5);
});

// ─── STEP 5: Download ─────────────────────────────────────────────────────────
function downloadFinal(format){
  const w=removedImg.naturalWidth, h=removedImg.naturalHeight;
  const off=document.createElement('canvas'); off.width=w; off.height=h;
  const oc=off.getContext('2d');
  if(format!=='png'){
    if(bgMode==='solid'&&solidColor){
      oc.fillStyle=solidColor; oc.fillRect(0,0,w,h);
    } else if(bgMode==='gradient'){
      oc.fillStyle=buildGradient(oc,w,h,gradDeg,gradColor1,gradColor2);
      oc.fillRect(0,0,w,h);
    } else {
      oc.fillStyle='#ffffff'; oc.fillRect(0,0,w,h);
    }
  }
  oc.drawImage(removedImg,0,0);
  const mime=format==='png'?'image/png':format==='jpg'?'image/jpeg':'image/webp';
  off.toBlob(blob=>{
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`removed-bg.${format}`; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  },mime,0.92);
}

document.querySelectorAll('.dl-card').forEach(card => {
  card.addEventListener('click', () => {
    const format = card.dataset.format;
    if (format) downloadFinal(format);
  });
});

// FIX: Fully clear states to fix the 2-3 times upload bug
function startOver(){
  originalFile=null; croppedBlob=null; removedBlob=null; removedImg=null;
  cropSel=null; cropImg=null;
  
  if (fileInput) fileInput.value = '';

  const r=document.querySelector('#step3 .btn-row.center:last-child');
  if(r&&r.id!=='removeActionRow') r.remove();
  
  removeActionRow.style.display='';
  removeBgBtn.disabled=false;
  spinnerWrap.classList.remove('active');
  removedPreviewCanvas.style.display='none';
  removedPlaceholder.style.display='';
  croppedPreview.src='';
  
  bgMode = 'solid';
  solidColor = '#ffffff';
  if(solidColorPicker) solidColorPicker.value = '#ffffff';
  if(solidColorHex) solidColorHex.textContent = '#ffffff';
  
  document.querySelectorAll('.bg-type-tab').forEach(t=>t.classList.remove('active'));
  const solidTab = document.getElementById('bgTabSolid');
  if(solidTab) solidTab.classList.add('active');
  
  const solidSec = document.getElementById('solidSection');
  const gradSec = document.getElementById('gradientSection');
  if(solidSec) solidSec.style.display='block';
  if(gradSec) gradSec.style.display='none';

  gotoStep(1);
}

startOverBtn.addEventListener('click', startOver);
backToBgBtn.addEventListener('click',()=>gotoStep(4));

// ─── Init ─────────────────────────────────────────────────────────────────────
updateGradPreview();
gotoStep(1);
