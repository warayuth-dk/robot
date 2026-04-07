// ================= CONFIG =================
const CONFIG_SHEET_URL = 'https://script.google.com/macros/s/AKfycbw3TCYas6G3V4-ofUNBSxOo-ngdi_O6Et1oBwLYlfYjmxTMW1hZ0LC-mSJ9HfJ711FQHQ/exec'; 

// ================= DATA =================
const LEVELS = [
  { lv: 0, name: "ใส", color: "#ffffff" },
  { lv: 1, name: "เหลืองจาง", color: "#FEEFC6" },
  { lv: 2, name: "เหลือง", color: "#FDD771" },
  { lv: 3, name: "ส้ม/ขาดน้ำ", color: "#FFB300" },
  { lv: 4, name: "น้ำตาล/อันตราย", color: "#795548" }
];

// ================= STATE =================
let state = "IDLE";
let currentNumber = "", currentName = "", currentBuble = "", currentLV = 0;
let historyData = JSON.parse(localStorage.getItem('urine_history_v2') || '[]');
let cameraStream = null;
let isFlashOn = false;

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
    if (devices.some(d => d.kind === 'videoinput')) await initCamera();
  } catch (e) { console.log("Camera blocked", e); }
}

async function initCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: 720, height: 720 } });
    video.srcObject = cameraStream;
    await video.play();
    document.getElementById("instructionOverlay").style.display = "none";
    state = "SCAN_QR";
    requestAnimationFrame(loop);
  } catch(e) { alert("เปิดกล้องไม่ได้"); }
}

function loop() {
  if (state === "COMPLETED") return;
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;
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

function handleQRCode(qrData) {
  try {
    const url = new URL(qrData);
    currentNumber = url.searchParams.get('Number') || "-";
    currentName = url.searchParams.get('name') || "Unknown";
    currentBuble = url.searchParams.get('Buble') || "-";
    document.getElementById("displayUserName").innerHTML = `ชื่อ: ${currentName}<br>เลขที่: ${currentNumber}`;
    state = "SNAP_BOTTLE";
    document.getElementById("btnSnap").style.display = "flex";
    document.getElementById("btnReset").style.display = "flex";
    document.getElementById("bottleGuide").classList.add("show");
    document.getElementById("liveStatusBadge").classList.add("show");
  } catch { console.log("QR Error"); }
}

function analyzeColor() {
  const centerX = canvasElement.width / 2;
  const centerY = canvasElement.height / 2;
  const urine = getAvgRGB(centerX, centerY, 20);
  const white = getAvgRGB(centerX + 120, centerY - 150, 20);

  const yellowIndex = (white[2]/Math.max(white[0],1)) - (urine[2]/Math.max(urine[0],1));
  const urineBr = (0.299 * urine[0] + 0.587 * urine[1] + 0.114 * urine[2]);
  const whiteBr = (0.299 * white[0] + 0.587 * white[1] + 0.114 * white[2]);
  const total = urine[0] + urine[1] + urine[2];
  const brownScore = (urine[0]/total - urine[1]/total) + (urine[0]/total - urine[2]/total);

  let lv = 1;
  if (yellowIndex < 0.12 && (urineBr/whiteBr) > 0.82) lv = 0;
  else if (brownScore > 0.90) lv = 4;
  else if (brownScore > 0.25 || yellowIndex > 0.70) lv = 3;
  else if (yellowIndex > 0.28) lv = 2;
  else lv = 1;

  currentLV = lv;
  const info = LEVELS[lv];

  // Update UI
  document.getElementById("liveText").innerText = `LV.${lv} - ${info.name}`;
  document.getElementById("liveDot").style.backgroundColor = info.color;
  
  const box = document.getElementById("colorResult");
  box.style.background = `rgb(${Math.round(urine[0])}, ${Math.round(urine[1])}, ${Math.round(urine[2])})`;
  box.style.color = urineBr > 140 ? "#000" : "#fff";
  box.innerHTML = `LV.${lv} - ${info.name}`;
}

function getAvgRGB(x, y, size) {
  const data = canvas.getImageData(x - size/2, y - size/2, size, size).data;
  let r=0, g=0, b=0;
  for (let i=0; i<data.length; i+=4) { r+=data[i]; g+=data[i+1]; b+=data[i+2]; }
  return [r/(data.length/4), g/(data.length/4), b/(data.length/4)];
}

function takePhoto() {
  if (isFlashOn) toggleFlash();
  document.getElementById("photoSnapshot").src = canvasElement.toDataURL('image/jpeg', 0.8);
  document.getElementById("vFrame").style.display = "none";
  document.getElementById("liveStatusBadge").classList.remove("show");
  document.getElementById("photoWrap").classList.add("show");
  if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
  state = "COMPLETED";
  
  // Open Popup
  document.getElementById("targetName").innerText = currentName;
  document.getElementById("tempModal").classList.add("show");
  document.getElementById("modalBodyTemp").focus();
}

function closeModal() {
  document.getElementById("tempModal").classList.remove("show");
  document.getElementById("btnReset").style.display = "flex";
}

async function confirmSave() {
  const temp = document.getElementById('modalBodyTemp').value;
  if(!temp || temp < 35 || temp > 42) return alert("กรอกอุณหภูมิ (35-42)");

  const record = { date: new Date().toLocaleDateString('th-TH'), Number: currentNumber, name: currentName, buble: currentBuble, temp, level: currentLV, status: LEVELS[currentLV].name, time: new Date().toLocaleTimeString('th-TH') };
  
  document.getElementById("syncSpinner").style.display = "block";
  try {
    await fetch(CONFIG_SHEET_URL,{ method:"POST", mode:"no-cors", body:JSON.stringify(record) });
    historyData.unshift(record);
    localStorage.setItem('urine_history_v2', JSON.stringify(historyData.slice(0,10)));
    renderHistory();
    document.getElementById("tempModal").classList.remove("show");
    resetApp();
  } catch { alert("ส่งข้อมูลล้มเหลว"); }
  document.getElementById("syncSpinner").style.display = "none";
}

function resetApp() {
  location.reload(); // เคลียร์ทุกอย่างและเริ่มใหม่
}

async function toggleFlash() {
  const track = cameraStream.getVideoTracks()[0];
  try {
    isFlashOn = !isFlashOn;
    await track.applyConstraints({ advanced: [{ torch: isFlashOn }] });
    document.getElementById("btnFlash").classList.toggle("active", isFlashOn);
  } catch (e) { console.log(e); }
}

function startClock() {
  setInterval(() => { document.getElementById('clock').textContent = new Date().toLocaleTimeString('th-TH'); }, 1000);
}

function updateStepTag(t,a){ document.getElementById('stepTag').textContent=t; }