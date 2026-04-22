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

// ================= ANALYZE COLOR (TUNED BY YOUR SAMPLES) =================
function analyzeColor() {
    const centerX = canvasElement.width / 2, centerY = canvasElement.height / 2;
    
    // 1. อ่านค่าสีจากขวด และ พื้นหลัง
    const urine = getAvgRGB(centerX, centerY, 30);
    const white = getAvgRGB(centerX + 150, centerY - 150, 20); // ขยับจุดขาวให้พ้นเงาขวด

    // 2. คำนวณค่าดัชนี
    const yellowIndex = (white[2]/Math.max(white[0],1)) - (urine[2]/Math.max(urine[0],1));
    const urineBr = (0.299 * urine[0] + 0.587 * urine[1] + 0.114 * urine[2]);
    const whiteBr = (0.299 * white[0] + 0.587 * white[1] + 0.114 * white[2]);
    const brRatio = urineBr / Math.max(whiteBr, 1);

    // 3. ปรับจูน Logic ตามรูปภาพต้นแบบ
    let lv = 1;

    // --- LV.0: ใส (ภาพที่ 1) ---
    if (yellowIndex < 0.10 && brRatio > 0.85) {
        lv = 0;
    }
    // --- LV.4: น้ำตาล (ภาพที่ 2 - ต้องมืดและเข้มมาก) ---
    else if (yellowIndex > 0.80 && brRatio < 0.45) {
        lv = 4;
    }
    // --- LV.3: ส้ม/ส้มเข้ม (ภาพที่ 4) ---
    else if (yellowIndex > 0.55 || (yellowIndex > 0.45 && brRatio < 0.60)) {
        lv = 3;
    }
    // --- LV.2: เหลืองมาตรฐาน (ภาพที่ 3 - แก้ปัญหาจากเดิมที่โดดไป LV.4) ---
    else if (yellowIndex > 0.22) {
        lv = 2;
    }
    // --- LV.1: เหลืองจาง ---
    else {
        lv = 1;
    }

    currentLV = lv;
    const info = LEVELS[lv];
    
    // แสดงผลบน Badge หน้ากล้อง
    const liveText = document.getElementById("liveText");
    const liveDot = document.getElementById("liveDot");
    if(liveText) liveText.innerText = `LV.${lv} - ${info.name}`;
    if(liveDot) liveDot.style.backgroundColor = info.color;
    
    // อัปเดตข้อมูลใน Popup (สำหรับตอนกดถ่าย)
    const popupBadge = document.getElementById("popupColorBadge");
    if(popupBadge) {
        popupBadge.innerText = `ผล: ${info.name} (LV.${lv})`;
        popupBadge.style.backgroundColor = info.color;
        popupBadge.style.color = (lv === 4 || lv === 3) ? "#fff" : "#000";
    }
}

// ================= SNAP & SAVE =================
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
    if(!temp || temp < 35 || temp > 42) return alert("กรอกอุณหภูมิที่ถูกต้อง (35.0 - 42.0)");
    
    const now = new Date();
    const record = { 
        date: now.toLocaleDateString('th-TH'), 
        Number: currentNumber, 
        name: currentName, 
        buble: currentBuble, 
        temp: temp, 
        level: currentLV, 
        status: LEVELS[currentLV].name, 
        time: now.toLocaleTimeString('th-TH') 
    };

    const spinner = document.getElementById("syncSpinner");
    if(spinner) spinner.style.display = "block";

    try {
        await fetch(CONFIG_SHEET_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(record) });
        historyData.unshift(record);
        localStorage.setItem('urine_history_v2', JSON.stringify(historyData.slice(0, 10)));
        renderHistory();
        alert("บันทึกข้อมูลเรียบร้อย");
        resetApp();
    } catch { 
        alert("บันทึกล้มเหลว กรุณาลองใหม่"); 
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
      <td style="font-weight:bold; color:${LEVELS[r.level].lv >= 3 ? '#e67e22' : '#2ecc71'}">LV.${r.level}</td>
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
    if (!capabilities.torch) return alert("อุปกรณ์ไม่รองรับการเปิดแฟลช");
    isFlashOn = !isFlashOn;
    await track.applyConstraints({ advanced: [{ torch: isFlashOn }] });
    const btnFlash = document.getElementById("btnFlash");
    if(btnFlash) btnFlash.style.backgroundColor = isFlashOn ? "#ffeb3b" : "#eee";
}

function startClock() {
    setInterval(() => { 
        const clockEl = document.getElementById('clock');
        if(clockEl) clockEl.textContent = new Date().toLocaleTimeString('th-TH'); 
    }, 1000);
}