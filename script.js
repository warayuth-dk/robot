// ================= CONFIG & DATA =================
const CONFIG_SHEET_URL = 'https://script.google.com/macros/s/AKfycbw3TCYas6G3V4-ofUNBSxOo-ngdi_O6Et1oBwLYlfYjmxTMW1hZ0LC-mSJ9HfJ711FQHQ/exec'; 

const LEVELS = [
  { lv: 0, name: "ใสมาก", color: "#e0f7fa", description: "ดื่มน้ำเพียงพอ" },
  { lv: 1, name: "เหลืองจาง", color: "#fff9c4", description: "ปกติ" },
  { lv: 2, name: "เหลือง", color: "#ffeb3b", description: "เริ่มขาดน้ำ" },
  { lv: 3, name: "ส้ม/ขาดน้ำ", color: "#ff9800", description: "ควรดื่มน้ำทันที" },
  { lv: 4, name: "น้ำตาล/อันตราย", color: "#795548", description: "ขาดน้ำรุนแรง พบแพทย์" }
];

let state = "IDLE";
let cameraStream = null;
let currentLV = 0;
let currentNumber = "", currentName = "", currentBuble = "";
let isFlashOn = false;

const video = document.getElementById("video");
const canvasElement = document.getElementById("canvas");
const canvas = canvasElement.getContext("2d", { willReadFrequently: true });

// ================= APP LOGIC =================

document.addEventListener('DOMContentLoaded', () => {
    startClock();
    renderHistory();
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('th-TH');
});

async function initCamera() {
    try {
        const constraints = { video: { facingMode: "environment", width: 720, height: 720 } };
        cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = cameraStream;
        await video.play();
        
        document.getElementById("instructionOverlay").style.display = "none";
        state = "SCAN_QR";
        requestAnimationFrame(loop);
    } catch (e) { alert("เข้าถึงกล้องไม่ได้: " + e.message); }
}

function loop() {
    if (state === "COMPLETED") return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvasElement.width = video.videoWidth;
        canvasElement.height = video.videoHeight;
        canvas.drawImage(video, 0, 0);

        if (state === "SCAN_QR") {
            const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
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

        document.getElementById("displayUserName").innerHTML = `<b>${currentName}</b> (เลขที่: ${currentNumber})`;
        document.getElementById("stepTag").textContent = "STEP 2: SNAP BOTTLE";
        document.getElementById("btnSnap").style.display = "flex";
        document.getElementById("btnReset").style.display = "flex";
        document.getElementById("liveStatus").classList.add("active");
        document.getElementById("bottleGuide").classList.add("show");
        state = "SNAP_BOTTLE";
    } catch (e) { console.error("QR Error"); }
}

function analyzeColor() {
    const centerX = canvasElement.width / 2;
    const centerY = canvasElement.height / 2;
    
    // ดึงค่าสี 2 จุด: กลางขวด และพื้นหลัง (ขาวอ้างอิง)
    const urine = getAvgRGB(centerX, centerY, 30);
    const white = getAvgRGB(centerX + 150, centerY - 150, 20);

    const urineBr = (0.299 * urine[0] + 0.587 * urine[1] + 0.114 * urine[2]);
    const whiteBr = (0.299 * white[0] + 0.587 * white[1] + 0.114 * white[2]);
    const yellowIndex = (white[2] / Math.max(white[0], 1)) - (urine[2] / Math.max(urine[0], 1));
    const brownScore = (urine[0]/(urine[0]+urine[1]+urine[2])) - (urine[1]/(urine[0]+urine[1]+urine[2]));

    let lv = 1;
    if (yellowIndex < 0.12 && (urineBr/whiteBr) > 0.82) lv = 0;
    else if (brownScore > 0.3) lv = 4;
    else if (yellowIndex > 0.6) lv = 3;
    else if (yellowIndex > 0.25) lv = 2;
    else lv = 1;

    currentLV = lv;
    updateLiveUI(lv, urine);
}

function updateLiveUI(lv, rgb) {
    const info = LEVELS[lv];
    const liveText = document.getElementById("liveText");
    const liveDot = document.getElementById("liveDot");
    const liveDesc = document.getElementById("liveDesc");
    const resultBox = document.getElementById("colorResult");

    liveText.innerText = `LV.${lv} - ${info.name}`;
    liveText.style.color = info.color;
    liveDot.style.background = info.color;
    liveDesc.innerText = info.description;

    resultBox.style.background = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    resultBox.style.color = (rgb[0]+rgb[1]+rgb[2])/3 > 128 ? "#000" : "#fff";
    resultBox.innerText = `วิเคราะห์แบบ Real-time: ${info.name} (LV.${lv})`;
}

function getAvgRGB(x, y, size) {
    const data = canvas.getImageData(x - size/2, y - size/2, size, size).data;
    let r=0, g=0, b=0;
    for (let i=0; i<data.length; i+=4) { r+=data[i]; g+=data[i+1]; b+=data[i+2]; }
    const n = data.length/4;
    return [r/n, g/n, b/n];
}

async function toggleFlash() {
    const track = cameraStream.getVideoTracks()[0];
    try {
        isFlashOn = !isFlashOn;
        await track.applyConstraints({ advanced: [{ torch: isFlashOn }] });
    } catch (e) { alert("ไม่รองรับแฟลช"); }
}

function takePhoto() {
    if (isFlashOn) toggleFlash();
    document.getElementById("photoSnapshot").src = canvasElement.toDataURL('image/jpeg', 0.8);
    document.getElementById("vFrame").style.display = "none";
    document.getElementById("liveStatus").classList.remove("active");
    document.getElementById("photoWrap").classList.add("show");
    document.getElementById("tempArea").classList.add("active");
    document.getElementById("btnSave").style.display = "flex";
    document.getElementById("btnSnap").style.display = "none";
    state = "COMPLETED";
}

async function confirmSave() {
    const temp = document.getElementById("bodyTemp").value;
    if (!temp || temp < 35 || temp > 42) return alert("กรุณากรอกอุณหภูมิที่ถูกต้อง (35-42)");

    const record = {
        date: new Date().toLocaleDateString('th-TH'),
        time: new Date().toLocaleTimeString('th-TH'),
        name: currentName,
        temp: temp,
        level: currentLV,
        status: LEVELS[currentLV].name
    };

    document.getElementById("syncSpinner").style.display = "block";
    try {
        await fetch(CONFIG_SHEET_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(record) });
        saveToLocal(record);
        alert("บันทึกสำเร็จ!");
        resetApp();
    } catch (e) { alert("บันทึกไม่สำเร็จ"); }
    document.getElementById("syncSpinner").style.display = "none";
}

function saveToLocal(record) {
    let history = JSON.parse(localStorage.getItem('urine_logs') || '[]');
    history.unshift(record);
    localStorage.setItem('urine_logs', JSON.stringify(history.slice(0, 10)));
    renderHistory();
}

function renderHistory() {
    const logs = JSON.parse(localStorage.getItem('urine_logs') || '[]');
    const body = document.getElementById("historyBody");
    if (logs.length > 0) {
        body.innerHTML = logs.map(l => `<tr><td>${l.time}</td><td>${l.name}</td><td>${l.temp}°</td><td>LV.${l.level}</td></tr>`).join('');
    }
}

function resetApp() {
    location.reload(); // วิธีที่ง่ายและเคลียร์ที่สุดสำหรับแอปกล้อง
}

function startClock() {
    setInterval(() => { document.getElementById('clock').textContent = new Date().toLocaleTimeString('th-TH'); }, 1000);
}