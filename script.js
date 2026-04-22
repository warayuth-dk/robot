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

// ================= COLOR SPACE CONVERSION (Lab) =================
function rgbToLab(r, g, b) {
    // 1. Normalize RGB
    r /= 255; g /= 255; b /= 255;
    r = (r > 0.04045) ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = (g > 0.04045) ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = (b > 0.04045) ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

    // 2. Convert to XYZ
    let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) * 100;
    let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) * 100;
    let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) * 100;

    // 3. Convert XYZ to Lab (D65 White Point)
    x /= 95.047; y /= 100.000; z /= 108.883;
    x = (x > 0.008856) ? Math.pow(x, 1/3) : (7.787 * x) + (16 / 116);
    y = (y > 0.008856) ? Math.pow(y, 1/3) : (7.787 * y) + (16 / 116);
    z = (z > 0.008856) ? Math.pow(z, 1/3) : (7.787 * z) + (16 / 116);

    return {
        l: (116 * y) - 16,
        a: 500 * (x - y),
        b: 200 * (y - z)
    };
}

// ================= ANALYZE COLOR (Lab Mode) =================
function analyzeColor() {
    const centerX = canvasElement.width / 2, centerY = canvasElement.height / 2;
    
    const urineRGB = getAvgRGB(centerX, centerY, 30);
    const lab = rgbToLab(urineRGB[0], urineRGB[1], urineRGB[2]);

    // ค่าที่ใช้ตัดสิน: 
    // lab.l = ความสว่าง (0 มืด - 100 สว่าง)
    // lab.b = ความเหลือง (ยิ่งบวกมาก ยิ่งเหลืองเข้ม)
    
    let lv = 1;

    // --- ปรับจูน Logic ตาม LAB ---
    if (lab.l > 88 && lab.b < 15) {
        lv = 0; // ใส (สว่างมากและเหลืองน้อย)
    }
    else if (lab.l < 45) {
        lv = 4; // น้ำตาล (มืดมาก)
    }
    else if (lab.b > 65 || (lab.b > 50 && lab.l < 65)) {
        lv = 3; // ส้ม (เหลืองเข้มมาก หรือ เหลืองมืด)
    }
    else if (lab.b > 30) {
        lv = 2; // เหลืองปกติ
    }
    else {
        lv = 1; // เหลืองจาง
    }

    currentLV = lv;
    const info = LEVELS[lv];
    
    const liveText = document.getElementById("liveText");
    const liveDot = document.getElementById("liveDot");
    if(liveText) liveText.innerText = `LV.${lv} - ${info.name}`;
    if(liveDot) liveDot.style.backgroundColor = info.color;
    
    // Debug: ปลดคอมเมนต์บรรทัดล่างเพื่อดูค่า Lab จริงๆ บนหน้าจอตอนจูน
    // console.log(`L: ${lab.l.toFixed(1)}, b: ${lab.b.toFixed(1)}`);

    const popupBadge = document.getElementById("popupColorBadge");
    if(popupBadge) {
        popupBadge.innerText = `ผล: ${info.name} (LV.${lv})`;
        popupBadge.style.backgroundColor = info.color;
        popupBadge.style.color = (lv >= 3) ? "#fff" : "#000";
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
    
    const record = { 
        date: new Date().toLocaleDateString('th-TH'), 
        Number: currentNumber, 
        name: currentName, 
        buble: currentBuble, 
        temp: temp, 
        level: currentLV, 
        status: LEVELS[currentLV].name, 
        time: new Date().toLocaleTimeString('th-TH') 
    };

    try {
        await fetch(CONFIG_SHEET_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(record) });
        historyData.unshift(record);
        localStorage.setItem('urine_history_v2', JSON.stringify(historyData.slice(0, 10)));
        renderHistory();
        alert("บันทึกสำเร็จ");
        resetApp();
    } catch { alert("บันทึกล้มเหลว"); }
}

// ================= UTILS =================
function getAvgRGB(x, y, size) {
    const data = canvas.getImageData(x - size/2, y - size/2, size, size).data;
    let r=0, g=0, b=0;
    for (let i=0; i<data.length; i+=4) { r+=data[i]; g+=data[i+1]; b+=data[i+2]; }
    const pixels = data.length / 4;
    return [r/pixels, g/pixels, b/pixels];
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
      <td>${r.temp}°</td>
      <td style="color:${LEVELS[r.level].color}">LV.${r.level}</td>
    </tr>
  `).join('');
}

function resetApp() { location.reload(); }

async function toggleFlash() {
    const track = cameraStream.getVideoTracks()[0];
    isFlashOn = !isFlashOn;
    await track.applyConstraints({ advanced: [{ torch: isFlashOn }] });
}

function startClock() {
    setInterval(() => { 
        const el = document.getElementById('clock');
        if(el) el.textContent = new Date().toLocaleTimeString('th-TH'); 
    }, 1000);
}