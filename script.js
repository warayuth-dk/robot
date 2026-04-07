// ================= CONFIG =================
const CONFIG_SHEET_URL = 'https://script.google.com/macros/s/AKfycbw3TCYas6G3V4-ofUNBSxOo-ngdi_O6Et1oBwLYlfYjmxTMW1hZ0LC-mSJ9HfJ711FQHQ/exec'; 

// ================= DOM =================
const video = document.getElementById("video");
const canvasElement = document.getElementById("canvas");
const canvas = canvasElement.getContext("2d", { alpha: false, willReadFrequently: true });

// ================= DATA =================
const LEVELS = [
  { lv: 0, name: "ใส", color: "#ffffff", textColor: "#000", description: "ดื่มน้ำมาก" },
  { lv: 1, name: "เหลืองจาง", color: "#FEEFC6", textColor: "#000", description: "ปกติ" },
  { lv: 2, name: "เหลือง", color: "#FDD771", textColor: "#000", description: "เริ่มขาดน้ำ" },
  { lv: 3, name: "ส้ม/ขาดน้ำ", color: "#FFB300", textColor: "#000", description: "ขาดน้ำ" },
  { lv: 4, name: "น้ำตาล/อันตราย", color: "#795548", textColor: "#fff", description: "อันตราย" }
];

// ================= STATE =================
let state = "IDLE";
let currentNumber = "", currentName = "", currentBuble = "", currentLV = 0;
let historyData = JSON.parse(localStorage.getItem('urine_history_v2') || '[]');
let cameraStream = null;
let scanInterval = null;
let isFlashOn = false;

// ================= INIT =================
document.addEventListener('DOMContentLoaded', () => {
  renderHistory();
  startClock();
  autoStartCamera();
  const d = new Date();
  document.getElementById('currentDate').textContent = d.toLocaleDateString('th-TH', {day:'2-digit', month:'short', year:'numeric'});
});

async function autoStartCamera() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    if (devices.some(d => d.kind === 'videoinput')) await initCamera();
  } catch (e) { console.log("Auto camera blocked:", e); }
}

async function initCamera() {
  try {
    const constraints = { video: { facingMode: "environment", width: { ideal: 720 }, height: { ideal: 720 } } };
    cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = cameraStream;
    await video.play();
    document.getElementById("instructionOverlay").style.display = "none";
    state = "SCAN_QR";
    updateStepTag("STEP 1: SCAN QR CODE", true);
    canvasElement.style.display = "none";
    scanInterval = setInterval(scanQRCode, 400);
    requestAnimationFrame(loop);
  } catch(e) { showError("เปิดกล้องไม่ได้: " + e.message); }
}

function scanQRCode() {
  if (state !== "SCAN_QR" || video.readyState !== video.HAVE_ENOUGH_DATA) return;
  const scanSize = 500;
  canvasElement.width = scanSize; canvasElement.height = scanSize;
  const sx = (video.videoWidth - scanSize) / 2;
  const sy = (video.videoHeight - scanSize) / 2;
  canvas.drawImage(video, sx, sy, scanSize, scanSize, 0, 0, scanSize, scanSize);
  const imageData = canvas.getImageData(0, 0, scanSize, scanSize);
  const code = jsQR(imageData.data, imageData.width, imageData.height);
  if (code) handleQRCodeDetected(code.data);
}

function handleQRCodeDetected(qrData) {
  try {
    const url = new URL(qrData);
    currentNumber = url.searchParams.get('Number') || "-";
    currentName = url.searchParams.get('name') || "Unknown";
    currentBuble = url.searchParams.get('Buble') || "-";
    document.getElementById("displayUserName").innerHTML =`เลขที่: ${currentNumber}<br>ชื่อ: ${currentName}<br>Bubble: ${currentBuble}`;
    clearInterval(scanInterval);
    state = "SNAP_BOTTLE";
    canvasElement.style.display = "block";
    updateStepTag("STEP 2: SNAP BOTTLE", true);
    document.getElementById("btnSnap").style.display = "flex";
    document.getElementById("btnReset").style.display = "flex";
    document.getElementById("bottleGuide").classList.add("show");
    document.getElementById("liveStatusBadge").classList.add("show"); // 🔥 แสดง Badge
  } catch { showError("QR ไม่ถูกต้อง"); }
}

function loop() {
  if (state === "COMPLETED") return;
  if (state === "SNAP_BOTTLE" && video.readyState === video.HAVE_ENOUGH_DATA) {
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;
    canvas.drawImage(video, 0, 0);
    const centerX = canvasElement.width / 2;
    const centerY = canvasElement.height / 2;
    const urineRGB = getAvgRGB(centerX, centerY, 20);
    const whiteRGB = getAvgRGB(centerX + 120, centerY - 150, 20); 
    updateColorIndicator(urineRGB, whiteRGB);
  }
  requestAnimationFrame(loop);
}

function getAvgRGB(x, y, size) {
  const data = canvas.getImageData(x - size/2, y - size/2, size, size).data;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i+1]; b += data[i+2]; }
  const pixels = data.length / 4;
  return [r / pixels, g / pixels, b / pixels];
}

function updateColorIndicator(urine, white) {
  const urineBr = (0.299 * urine[0] + 0.587 * urine[1] + 0.114 * urine[2]);
  const whiteBr = (0.299 * white[0] + 0.587 * white[1] + 0.114 * white[2]);
  const whiteBlueRatio = white[2] / Math.max(white[0], 1);
  const urineBlueRatio = urine[2] / Math.max(urine[0], 1);
  const yellowIndex = whiteBlueRatio - urineBlueRatio;
  const total = urine[0] + urine[1] + urine[2];
  const brownScore = (urine[0]/total - urine[1]/total) + (urine[0]/total - urine[2]/total);
  const brRatio = urineBr / Math.max(whiteBr, 1);

  let lv = 1;
  if (yellowIndex < 0.12 && brRatio > 0.82) { lv = 0; }
  else if (brownScore > 0.90) { lv = 4; }
  else if (brownScore > 0.25 || yellowIndex > 0.70) { lv = 3; }
  else if (yellowIndex > 0.28) { lv = 2; }
  else { lv = 1; }
  
  currentLV = lv;
  const info = LEVELS[lv];

  // 🟢 NEW: Update Badge
  const liveBadge = document.getElementById("liveStatusBadge");
  const liveDot = document.getElementById("liveDot");
  const liveText = document.getElementById("liveText");
  if (state === "SNAP_BOTTLE") {
    liveBadge.classList.add("show");
    liveText.innerText = `LV.${lv} - ${info.name}`;
    liveDot.style.backgroundColor = info.color;
  }

  // Update Main UI
  const box = document.getElementById("colorResult");
  box.style.background = `rgb(${Math.round(urine[0])}, ${Math.round(urine[1])}, ${Math.round(urine[2])})`;
  box.innerHTML = `<div style="font-size:17px; font-weight:bold;">LV.${lv} - ${info.name}</div>
    <div style="font-size:10px; opacity:0.8;">ความเข้มเหลือง: ${(yellowIndex * 100).toFixed(0)} | น้ำตาล: ${(brownScore * 100).toFixed(0)}%</div>`;
  box.style.color = urineBr > 140 ? "#000" : "#fff";
}

async function toggleFlash() {
  if (!cameraStream) return;
  const track = cameraStream.getVideoTracks()[0];
  try {
    const caps = track.getCapabilities();
    if (!caps.torch) return alert("ไม่รองรับแฟลช");
    isFlashOn = !isFlashOn;
    await track.applyConstraints({ advanced: [{ torch: isFlashOn }] });
    const btn = document.getElementById("btnFlash");
    btn.classList.toggle("active", isFlashOn);
    btn.innerHTML = isFlashOn ? `<span>🔦</span> <small>ปิดแฟลช</small>` : `<span>💡</span> <small>เปิดแฟลช</small>`;
  } catch (e) { console.error(e); }
}

function takePhoto() {
  if (isFlashOn) toggleFlash();
  document.getElementById("photoSnapshot").src = canvasElement.toDataURL('image/jpeg', 0.8);
  document.getElementById("vFrame").style.display="none";
  document.getElementById("liveStatusBadge").classList.remove("show"); // 🔥 ซ่อน Badge
  document.getElementById("photoWrap").classList.add("show");
  if(cameraStream) cameraStream.getTracks().forEach(t=>t.stop());
  state="COMPLETED";
  updateStepTag("STEP 3: INPUT TEMP", true);
  document.getElementById("tempArea").classList.add("active");
  document.getElementById("btnSave").style.display="flex";
  document.getElementById("btnSnap").style.display="none";
}

async function confirmSave() {
  const temp = document.getElementById('bodyTemp').value;
  if(!temp || temp < 35 || temp > 42) return showError("กรอกอุณหภูมิ (35-42)");
  const record = { date: new Date().toLocaleDateString('th-TH'), Number: currentNumber, name: currentName, buble: currentBuble, temp, level: currentLV, status: LEVELS[currentLV].name, time: new Date().toLocaleTimeString('th-TH') };
  document.getElementById("syncSpinner").style.display = "block";
  try {
    await fetch(CONFIG_SHEET_URL,{ method:"POST", mode:"no-cors", body:JSON.stringify(record) });
    historyData.unshift(record);
    localStorage.setItem('urine_history_v2', JSON.stringify(historyData.slice(0,10)));
    renderHistory();
    document.getElementById("syncStatus").textContent="✅ บันทึกสำเร็จ";
    setTimeout(resetApp, 1500);
  } catch { showError("ส่งข้อมูลไม่สำเร็จ"); }
  document.getElementById("syncSpinner").style.display = "none";
}

function resetApp() {
  state="IDLE";
  document.getElementById("photoWrap").classList.remove("show");
  document.getElementById("vFrame").style.display="block";
  document.getElementById("btnSnap").style.display = "none";
  document.getElementById("btnSave").style.display="none";
  document.getElementById("btnReset").style.display="none";
  document.getElementById("tempArea").classList.remove("active");
  document.getElementById("liveStatusBadge").classList.remove("show"); // 🔥 ซ่อน Badge
  document.getElementById("bodyTemp").value="";
  document.getElementById("displayUserName").textContent="รอสแกน QR CODE...";
  document.getElementById("colorResult").innerHTML="สี: --";
  document.getElementById("colorResult").style.background="#222";
  document.getElementById("bottleGuide").classList.remove("show");
  updateStepTag("STEP 1: SCAN QR CODE", true);
  initCamera();
}

function renderHistory(){
  const body=document.getElementById("historyBody");
  if (historyData.length === 0) return;
  body.innerHTML=historyData.map(r=>`<tr><td>${r.date}</td><td>${r.time}</td><td>${r.Number}</td><td>${r.name}</td><td>${r.temp}°</td><td>LV.${r.level}</td></tr>`).join('');
}

function updateStepTag(t,a){ const el=document.getElementById('stepTag'); el.textContent=t; el.classList.toggle('active',a); }
function showError(m){ const el=document.getElementById('errorMessage'); el.textContent=m; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'), 3000); }
function startClock(){ setInterval(()=>{ document.getElementById('clock').textContent=new Date().toLocaleTimeString('th-TH'); },1000); }