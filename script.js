// ================= CONFIG & DATA =================
const CONFIG_SHEET_URL = 'https://script.google.com/macros/s/AKfycbzkaX_ETSZP6iu4mBgg6M9LLlP6jaG98l9gNTvtVkzvd8d2gtnvp_XioH5sMQbLJTio0A/exec'; 

const LEVELS = [
  { lv: 0, name: "ใส", color: "#ffffff" },
  { lv: 1, name: "เหลืองจาง", color: "#FEEFC6" },
  { lv: 2, name: "เหลือง", color: "#FDD771" },
  { lv: 3, name: "ส้ม/ขาดน้ำ", color: "#FFB300" },
  { lv: 4, name: "น้ำตาล/อันตราย", color: "#795548" }
];

let state = "IDLE", currentLV = 0, cameraStream = null;
let currentNumber = "", currentName = "", currentBuble = "", isFlashOn = false;
let historyData = JSON.parse(localStorage.getItem('urine_history_v2') || '[]');

const video = document.getElementById("video");
const canvasElement = document.getElementById("canvas");
const canvas = canvasElement.getContext("2d", { willReadFrequently: true });

// ================= INIT =================
document.addEventListener('DOMContentLoaded', () => {
    renderHistory();
    startClock();
    autoStartCamera();
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('th-TH');
});

async function autoStartCamera() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (devices.some(d => d.kind === 'videoinput')) initCamera();
    } catch (e) { console.log("Camera access denied"); }
}

async function initCamera() {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment", width: { ideal: 720 }, height: { ideal: 720 } } 
        });
        video.srcObject = cameraStream;
        await video.play();
        document.getElementById("instructionOverlay").style.display = "none";
        state = "SCAN_QR";
        requestAnimationFrame(loop);
    } catch(e) { alert("เปิดกล้องไม่ได้"); }
}

// ================= CORE LOGIC =================
function loop() {
    if (state === "COMPLETED") return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvasElement.width = video.videoWidth; canvasElement.height = video.videoHeight;
        canvas.drawImage(video, 0, 0);
        if (state === "SCAN_QR") {
            const code = jsQR(canvas.getImageData(0,0,canvasElement.width,canvasElement.height).data, canvasElement.width, canvasElement.height);
            if (code) handleQRCode(code.data);
        } else if (state === "SNAP_BOTTLE") {
            analyzeColor();
        }
    }
    requestAnimationFrame(loop);
}

function handleQRCode(data) {
    try {
        const url = new URL(data);
        currentNumber = url.searchParams.get('Number') || "-";
        currentName = url.searchParams.get('name') || "Unknown";
        currentBuble = url.searchParams.get('Buble') || "-";
        document.getElementById("displayUserName").innerText = `ทหาร: ${currentName} (${currentNumber})`;
        document.getElementById("targetNameDisplay").innerText = currentName;
        state = "SNAP_BOTTLE";
        document.getElementById("btnSnap").style.display = "flex";
        document.getElementById("bottleGuide").classList.add("show");
        document.getElementById("liveStatusBadge").classList.add("show");
        document.getElementById("stepTag").textContent = "STEP 2: SNAP BOTTLE";
    } catch (e) { console.log("QR Format Error"); }
}

function analyzeColor() {
    const centerX = canvasElement.width / 2, centerY = canvasElement.height / 2;
    
    // 1. อ่านค่าสีจากจุดเป้าหมาย
    const urine = getAvgRGB(centerX, centerY, 20);
    const white = getAvgRGB(centerX + 120, centerY - 150, 20); // จุดขาวอ้างอิง

    // 2. คำนวณดัชนีสี
    const yellowIndex = (white[2]/Math.max(white[0],1)) - (urine[2]/Math.max(urine[0],1));
    const urineBr = (0.299 * urine[0] + 0.587 * urine[1] + 0.114 * urine[2]);
    const whiteBr = (0.299 * white[0] + 0.587 * white[1] + 0.114 * white[2]);
    const brRatio = urineBr / Math.max(whiteBr, 1);

    // 3. ปรับจูนระดับสี (Decision Logic)
    let lv = 1;

    if (yellowIndex < 0.12 && brRatio > 0.82) {
        lv = 0; // ใส (เหลืองน้อยมากและสว่าง)
    } 
    else if (yellowIndex > 0.85 && brRatio < 0.55) {
        lv = 4; // น้ำตาล (ต้องเหลืองเข้มมาก และมืดจริง)
    }
    else if (yellowIndex > 0.48 || (yellowIndex > 0.38 && brRatio < 0.65)) {
        lv = 3; // ส้ม (เหลืองเข้ม หรือ เริ่มมีความทึบแสง)
    }
    else if (yellowIndex > 0.18) {
        lv = 2; // เหลืองปกติ
    }
    else {
        lv = 1; // เหลืองจาง
    }

    currentLV = lv;
    const info = LEVELS[lv];
    
    // Update Live Badge
    document.getElementById("liveText").innerText = `LV.${lv} - ${info.name}`;
    document.getElementById("liveDot").style.backgroundColor = info.color;
    
    // Debug info (ถ้าต้องการเห็นค่าตอนจูน ให้เอา Comment ด้านล่างออก)
    // console.log(`YI: ${yellowIndex.toFixed(2)}, BR: ${brRatio.toFixed(2)}`);

    // Update Popup Data
    const popupBadge = document.getElementById("popupColorBadge");
    if(popupBadge) {
        popupBadge.innerText = `ผล: ${info.name} (LV.${lv})`;
        popupBadge.style.borderColor = info.color;
        popupBadge.style.backgroundColor = info.color;
        popupBadge.style.color = (lv === 4) ? "#fff" : "#000";
    }
}

function takePhoto() {
    document.getElementById("photoSnapshot").src = canvasElement.toDataURL('image/jpeg', 0.8);
    document.getElementById("dataPopup").classList.add("show");
    document.getElementById("btnSnap").style.display = "none";
    if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
    state = "COMPLETED";
    setTimeout(() => document.getElementById("modalBodyTemp").focus(), 400);
}

async function confirmSave() {
    const temp = document.getElementById('modalBodyTemp').value;
    if(!temp || temp < 35 || temp > 42) return alert("กรอกอุณหภูมิที่ถูกต้อง (35-42)");
    
    const now = new Date();
    const record = { 
        date: now.toLocaleDateString('th-TH'), 
        Number: currentNumber, 
        name: currentName, 
        buble: currentBuble, 
        temp: temp, 
        level: currentLV, 
        status: LEVELS[currentLV].name, 
        time: new Date().toLocaleTimeString('th-TH') 
    };

    const spinner = document.getElementById("syncSpinner");
    if(spinner) spinner.style.display = "block";

    try {
        await fetch(CONFIG_SHEET_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(record) });
        historyData.unshift(record);
        localStorage.setItem('urine_history_v2', JSON.stringify(historyData.slice(0, 10)));
        renderHistory();
        
        alert("บันทึกสำเร็จ");
        resetApp();
    } catch { 
        alert("บันทึกล้มเหลว"); 
    }
    if(spinner) spinner.style.display = "none";
}

// ================= UTILS =================
function renderHistory() {
  const body = document.getElementById("historyBody");
  if (!body || historyData.length === 0) return;
  body.innerHTML = historyData.map(r => `
    <tr>
      <td>${r.date}</td>
      <td>${r.time}</td>
      <td>${r.Number}</td>
      <td>${r.name}</td>
      <td>${r.temp}°</td>
      <td style="color:${LEVELS[r.level].color}">LV.${r.level}</td>
    </tr>
  `).join('');
}

function getAvgRGB(x, y, size) {
    const startX = Math.max(0, x - size/2);
    const startY = Math.max(0, y - size/2);
    const data = canvas.getImageData(startX, startY, size, size).data;
    let r=0, g=0, b=0;
    for (let i=0; i<data.length; i+=4) { r+=data[i]; g+=data[i+1]; b+=data[i+2]; }
    const pixels = data.length / 4;
    return [r/pixels, g/pixels, b/pixels];
}

function resetApp() { location.reload(); }

async function toggleFlash() {
    if (!cameraStream) return;
    const track = cameraStream.getVideoTracks()[0];
    const capabilities = track.getCapabilities();
    if (!capabilities.torch) return alert("ไม่รองรับแฟลช");

    isFlashOn = !isFlashOn;
    await track.applyConstraints({ advanced: [{ torch: isFlashOn }] });
    
    const btnFlash = document.getElementById("btnFlash");
    if(btnFlash) btnFlash.classList.toggle("active", isFlashOn);
}

function startClock() {
    setInterval(() => { 
        const clockEl = document.getElementById('clock');
        if(clockEl) clockEl.textContent = new Date().toLocaleTimeString('th-TH'); 
    }, 1000);
}