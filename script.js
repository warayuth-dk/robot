// เพิ่ม Library OCR (ต้องมีการโหลด Tesseract.js ในไฟล์ HTML ด้วยผ่าน CDN)
// <script src="https://unpkg.com/tesseract.js@v4.0.1/dist/tesseract.min.js"></script>

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
let lastQRScanTime = 0; // สำหรับหน่วงเวลาสแกน QR

const video = document.getElementById("video");
const canvasElement = document.getElementById("canvas");
const canvas = canvasElement.getContext("2d", { alpha: false, willReadFrequently: true });

// ================= INIT =================
document.addEventListener('DOMContentLoaded', () => {
    renderHistory();
    startClock();
    autoStartCamera();
});

async function autoStartCamera() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (devices.some(d => d.kind === 'videoinput')) initCamera();
    } catch (e) { console.log("Camera access denied"); }
}

async function initCamera() {
    try {
        // เคลียร์ Stream เก่าถ้ามี
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
        }

        cameraStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } 
        });
        video.srcObject = cameraStream;
        await video.play();
        document.getElementById("instructionOverlay").style.display = "none";
        state = "SCAN_QR";
        requestAnimationFrame(loop);
    } catch(e) { alert("เปิดกล้องไม่ได้"); }
}

// ================= CORE LOOP =================
function loop(time) {
    if (state === "COMPLETED") return;
    
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvasElement.width = video.videoWidth; 
        canvasElement.height = video.videoHeight;
        canvas.drawImage(video, 0, 0);

        if (state === "SCAN_QR") {
<<<<<<< HEAD
            // 🔥 ป้องกัน Frame Drop: สแกน QR ทุกๆ 250ms (4 ครั้งต่อวินาที)
            if (time - lastQRScanTime > 250) {
                lastQRScanTime = time;
                const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
                const code = jsQR(imageData.data, canvasElement.width, canvasElement.height);
                if (code) handleQRCode(code.data);
            }
=======
            const code = jsQR(canvas.getImageData(0,0,canvasElement.width,canvasElement.height).data, canvasElement.width, canvasElement.height);
            if (code) handleQRCode(code.data);
>>>>>>> parent of 4ddd91a (fix all code)
        } 
        else if (state === "SNAP_BOTTLE") {
            analyzeColor();
        } 
        else if (state === "SCAN_TEMP") {
            // ช่วงนี้รอกดปุ่ม Snap Temp หรืออ่าน OCR อัตโนมัติ (ถ้าต้องการ)
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
        state = "SNAP_BOTTLE";
        document.getElementById("btnSnap").style.display = "flex";
        document.getElementById("bottleGuide").classList.add("show");
        document.getElementById("liveStatusBadge").classList.add("show");
<<<<<<< HEAD
        document.getElementById("btnSnap").style.display = "flex";
        document.getElementById("btnSnap").innerText = "📸 ถ่ายภาพและบันทึก";
    } catch (e) { console.log("QR Format Error"); }
}

// ================= COLOR ANALYZE (CIELAB) =================
=======
        document.getElementById("stepTag").textContent = "STEP 2: ถ่ายรูปขวดปัสสาวะ";
    } catch (e) { console.log("QR Format Error"); }
}

// ================= COLOR ANALYZE (Lab) =================
>>>>>>> parent of 4ddd91a (fix all code)
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

// กดถ่ายรูปขวด -> ไปขั้นตอนสแกนปรอท
function takePhoto() {
<<<<<<< HEAD
    document.getElementById("photoSnapshot").src = canvasElement.toDataURL('image/jpeg', 0.8);
    
    if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
    }
    state = "COMPLETED";

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

    setTimeout(() => document.getElementById("modalBodyTemp").focus(), 400);
=======
    // บันทึกรูปขวดเก็บไว้
    document.getElementById("photoSnapshot").src = canvasElement.toDataURL('image/jpeg', 0.8);
    
    // เปลี่ยนสถานะไปสแกนปรอท
    state = "SCAN_TEMP";
    document.getElementById("bottleGuide").classList.remove("show");
    document.getElementById("tempGuide").classList.add("show"); // ต้องมีกรอบใหม่สำหรับปรอทใน HTML
    document.getElementById("stepTag").textContent = "STEP 3: สแกนเลขปรอท";
    document.getElementById("btnSnap").onclick = scanThermometer; // เปลี่ยนหน้าที่ปุ่ม
}

// ฟังก์ชันสแกนตัวเลขจากปรอท
async function scanThermometer() {
<<<<<<< HEAD
    const statusEl = document.getElementById("syncStatus");
    statusEl.innerText = "กำลังอ่านค่าตัวเลข...";
    
    // ถ่ายภาพเฉพาะส่วนหน้าจอปรอท (Crop)
=======
    const snapBtn = document.getElementById("btnSnap");
    snapBtn.innerText = "⌛ กำลังอ่านค่า...";
    snapBtn.disabled = true;

    // สร้าง Canvas สำหรับ Crop รูปปรอท (ตามกรอบสี่เหลี่ยมผืนผ้า)
>>>>>>> parent of 4e78c02 (fix)
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 300;
    tempCanvas.height = 150;
    const ctx = tempCanvas.getContext('2d');
<<<<<<< HEAD
    // วาดรูปจากกลางจอ
    ctx.drawImage(video, (video.videoWidth-300)/2, (video.videoHeight-150)/2, 300, 150, 0, 0, 300, 150);
=======
    ctx.drawImage(video, (video.videoWidth-400)/2, (video.videoHeight-200)/2, 400, 200, 0, 0, 400, 200);
>>>>>>> parent of 4e78c02 (fix)
    
    const imageData = tempCanvas.toDataURL('image/png');

    try {
<<<<<<< HEAD
        // ใช้ Tesseract.js อ่านค่า
        const result = await Tesseract.recognize(imageData, 'eng', {
            tessedit_char_whitelist: '0123456789.' // ให้อ่านเฉพาะตัวเลขและจุด
=======
        const result = await Tesseract.recognize(imageData, 'eng', {
            tessedit_char_whitelist: '0123456789.'
>>>>>>> parent of 4e78c02 (fix)
        });
        
        let detectedText = result.data.text.trim().replace(/[^0-9.]/g, '');
        
        // ตรวจสอบว่าเป็นตัวเลขอุณหภูมิที่สมเหตุสมผลหรือไม่ (35-42)
        let val = parseFloat(detectedText);
        if (!isNaN(val) && val >= 35 && val <= 42) {
            currentTemp = val.toFixed(1);
            showSavePopup();
        } else {
<<<<<<< HEAD
            alert("อ่านค่าไม่ได้หรือค่าผิดปกติ (" + detectedText + ") กรุณาลองใหม่ หรือพิมพ์เอง");
            showSavePopup(detectedText); // เปิดป๊อปอัพให้แก้เอง
        }
    } catch (e) {
        alert("ระบบสแกนขัดข้อง กรุณาพิมพ์เอง");
=======
            alert(`ค่าที่อ่านได้ "${detectedText}" ไม่อยู่ในเกณฑ์ที่กำหนด\nกรุณาเล็งใหม่หรือพิมพ์แก้ไขเองในหน้าถัดไป`);
            showSavePopup(detectedText); 
        }
    } catch (e) {
        alert("OCR Error: กรุณากรอกอุณหภูมิด้วยตนเอง");
>>>>>>> parent of 4e78c02 (fix)
        showSavePopup();
    }
    statusEl.innerText = "";
}

function showSavePopup(preFill = "") {
    state = "COMPLETED";
    if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
    
    document.getElementById("dataPopup").classList.add("show");
    document.getElementById("modalBodyTemp").value = currentTemp || preFill;
    
    const info = LEVELS[currentLV];
    const badge = document.getElementById("popupColorBadge");
    badge.innerText = `ผลวิเคราะห์: ${info.name} (LV.${currentLV})`;
    badge.style.backgroundColor = info.color;
>>>>>>> parent of 4ddd91a (fix all code)
}

async function confirmSave() {
    const temp = document.getElementById('modalBodyTemp').value;
<<<<<<< HEAD
    if(!temp || temp < 34 || temp > 43) return alert("กรุณากรอกอุณหภูมิให้ถูกต้อง (34.0 - 43.0)");
=======
    if(!temp || temp < 35 || temp > 42) return alert("กรุณาใส่อุณหภูมิที่ถูกต้อง (35.0 - 42.0)");
>>>>>>> parent of 4ddd91a (fix all code)
    
    const record = { 
        date: new Date().toLocaleDateString('th-TH'), 
        Number: currentNumber, 
        name: currentName, 
        temp: temp, 
        level: currentLV, 
        status: LEVELS[currentLV].name, 
        time: new Date().toLocaleTimeString('th-TH') 
    };

<<<<<<< HEAD
    const spinner = document.getElementById("syncSpinner");
    if(spinner) spinner.style.display = "block";

=======
>>>>>>> parent of 4ddd91a (fix all code)
    try {
        await fetch(CONFIG_SHEET_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(record) });
        historyData.unshift(record);
        localStorage.setItem('urine_history_v2', JSON.stringify(historyData.slice(0, 10)));
        renderHistory();
        alert("บันทึกข้อมูลเรียบร้อย");
<<<<<<< HEAD
        resetApp();
    } catch { 
        alert("บันทึกล้มเหลว กรุณาลองใหม่"); 
    }
    if(spinner) spinner.style.display = "none";
=======
        location.reload();
    } catch { alert("บันทึกล้มเหลว"); }
>>>>>>> parent of 4ddd91a (fix all code)
}

// ================= UTILS =================

function getAvgRGB(x, y, size) {
    const data = canvas.getImageData(x - size/2, y - size/2, size, size).data;
    let r=0, g=0, b=0;
    for (let i=0; i<data.length; i+=4) { r+=data[i]; g+=data[i+1]; b+=data[i+2]; }
    return [r/(data.length/4), g/(data.length/4), b/(data.length/4)];
}

function renderHistory() {
  const body = document.getElementById("historyBody");
<<<<<<< HEAD
  if (!body) return;
  body.innerHTML = historyData.map(r => `
    <tr>
      <td>${r.date}</td>
      <td>${r.time}</td>
      <td>${r.Number}</td>
      <td>${r.name}</td>
      <td>${r.temp}°</td>
      <td style="font-weight:bold; color:${LEVELS[r.level].color}">LV.${r.level}</td>
    </tr>
  `).join('');
}

function resetApp() { 
    // ใช้ reload เพื่อเคลียร์หน่วยความจำทั้งหมดก่อนเริ่มรอบใหม่
    location.reload(); 
}

async function toggleFlash() {
    if (!cameraStream) return;
    const track = cameraStream.getVideoTracks()[0];
    const capabilities = track.getCapabilities();
    if (!capabilities.torch) return alert("ไม่รองรับแฟลช");
    isFlashOn = !isFlashOn;
    await track.applyConstraints({ advanced: [{ torch: isFlashOn }] });
=======
  if (body) body.innerHTML = historyData.map(r => `<tr><td>${r.date}</td><td>${r.Number}</td><td>${r.temp}°</td><td>LV.${r.level}</td></tr>`).join('');
>>>>>>> parent of 4ddd91a (fix all code)
}

function startClock() {
    setInterval(() => { document.getElementById('clock').textContent = new Date().toLocaleTimeString('th-TH'); }, 1000);
}