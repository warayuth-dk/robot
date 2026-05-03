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
            video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 720 } } 
        });
        video.srcObject = cameraStream;
        await video.play();
        document.getElementById("instructionOverlay").style.display = "none";
        state = "SCAN_QR";
        requestAnimationFrame(loop);
    } catch(e) { alert("เปิดกล้องไม่ได้"); }
}

// ================= CORE LOOP =================
function loop() {
    if (state === "COMPLETED") return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvasElement.width = video.videoWidth; canvasElement.height = video.videoHeight;
        canvas.drawImage(video, 0, 0);

        if (state === "SCAN_QR") {
            const imageData = canvas.getImageData(0,0,canvasElement.width,canvasElement.height);
            const code = jsQR(imageData.data, canvasElement.width, canvasElement.height);
            if (code) handleQRCode(code.data);
        } 
        else if (state === "SNAP_BOTTLE") {
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
        
        document.getElementById("displayUserName").innerText = `ทหาร: ${currentName} (${currentNumber} - ${currentBuble})`;
        document.getElementById("targetNameDisplay").innerText = currentName;
        
        state = "SNAP_BOTTLE";
        document.getElementById("stepTag").textContent = "STEP 2: ถ่ายรูปขวดปัสสาวะ";
        document.getElementById("bottleGuide").classList.add("show");
        document.getElementById("liveStatusBadge").classList.add("show");
        document.getElementById("btnSnap").style.display = "flex";
    } catch (e) { console.log("QR Format Error"); }
}

// ================= COLOR ANALYZE (Lab Space) =================
function rgbToLab(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    r = (r > 0.04045) ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = (g > 0.04045) ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = (b > 0.04045) ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
    let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) * 100;
    let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) * 100;
    let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) * 100;
    x /= 95.047; y /= 100.000; z /= 108.883;
    x = (x > 0.008856) ? Math.pow(x, 1/3) : (7.787 * x) + (16 / 116);
    y = (y > 0.008856) ? Math.pow(y, 1/3) : (7.787 * y) + (16 / 116);
    z = (z > 0.008856) ? Math.pow(z, 1/3) : (7.787 * z) + (16 / 116);
    return { l: (116 * y) - 16, a: 500 * (x - y), b: 200 * (y - z) };
}

function analyzeColor() {
    const urineRGB = getAvgRGB(canvasElement.width / 2, canvasElement.height / 2, 30);
    const lab = rgbToLab(urineRGB[0], urineRGB[1], urineRGB[2]);
    let lv = 1;
    if (lab.l > 75 && lab.b < 25) lv = 0; 
    else if (lab.l < 42) lv = 4; 
    else if (lab.b > 58 || (lab.b > 45 && lab.l < 60)) lv = 3; 
    else if (lab.b > 35) lv = 2; 
    else lv = 1;
    currentLV = lv;
    document.getElementById("liveText").innerText = `LV.${lv} - ${LEVELS[lv].name}`;
    document.getElementById("liveDot").style.backgroundColor = LEVELS[lv].color;
}

// ================= SNAP & SAVE =================

function takePhoto() {
    // 1. ถ่ายรูปขวด
    document.getElementById("photoSnapshot").src = canvasElement.toDataURL('image/jpeg', 0.8);
    
    // 2. หยุดกล้องและไปหน้าบันทึกทันที
    if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
    state = "COMPLETED";
    
    showSavePopup();
}

function showSavePopup() {
    document.getElementById("dataPopup").classList.add("show");
    document.getElementById("btnSnap").style.display = "none";
    document.getElementById("bottleGuide").classList.remove("show");
    document.getElementById("liveStatusBadge").classList.remove("show");
    
    const info = LEVELS[currentLV];
    const badge = document.getElementById("popupColorBadge");
    if(badge) {
        badge.innerText = `ผลวิเคราะห์: ${info.name} (LV.${currentLV})`;
        badge.style.backgroundColor = info.color;
        badge.style.color = (currentLV >= 3) ? "#fff" : "#000";
    }
}

async function confirmSave() {
    const temp = document.getElementById('modalBodyTemp').value;
    if(!temp || temp < 35 || temp > 43) return alert("กรุณาตรวจสอบอุณหภูมิ (35.0 - 43.0)");
    
    const record = { 
        date: new Date().toLocaleDateString('th-TH'), 
        Number: currentNumber, 
        name: currentName,
        buble: currentBuble, 
        temp: temp, 
        level: String(currentLV), 
        status: LEVELS[currentLV].name, 
        time: new Date().toLocaleTimeString('th-TH') 
    };

    document.getElementById("syncSpinner").style.display = "block";
    try {
        await fetch(CONFIG_SHEET_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(record) });
        historyData.unshift(record);
        localStorage.setItem('urine_history_v2', JSON.stringify(historyData.slice(0, 10)));
        renderHistory();
        alert("บันทึกข้อมูลเรียบร้อย");
        resetApp();
    } catch { alert("บันทึกล้มเหลว"); }
    document.getElementById("syncSpinner").style.display = "none";
}

// ================= UTILS =================

async function toggleFlash() {
    if (!cameraStream) return;
    const track = cameraStream.getVideoTracks()[0];
    const capabilities = track.getCapabilities();
    if (!capabilities.torch) return alert("ไม่รองรับแฟลช");
    isFlashOn = !isFlashOn;
    await track.applyConstraints({ advanced: [{ torch: isFlashOn }] });
}

function getAvgRGB(x, y, size) {
    const data = canvas.getImageData(x - size/2, y - size/2, size, size).data;
    let r=0, g=0, b=0;
    for (let i=0; i<data.length; i+=4) { r+=data[i]; g+=data[i+1]; b+=data[i+2]; }
    return [r/(data.length/4), g/(data.length/4), b/(data.length/4)];
}

function renderHistory() {
  const body = document.getElementById("historyBody");
  if (!body) return;
  body.innerHTML = historyData.map(r => `
    <tr>
      <td>${r.date}</td>
      <td>${r.time}</td>
      <td>${r.Number}</td>
      <td>${r.name}</td>
      <td>${r.buble}</td>
      <td>${r.temp}°</td>
      <td style="font-weight:bold; color:${LEVELS[r.level].color}">LV.${r.level}</td>
    </tr>
  `).join('');
}

function resetApp() { location.reload(); }

function startClock() {
    setInterval(() => { 
        const el = document.getElementById('clock');
        if(el) el.textContent = new Date().toLocaleTimeString('th-TH'); 
    }, 1000);
}