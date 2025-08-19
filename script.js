// ---------- ELEMENTOS ----------
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const selectStyle = document.getElementById('style');
const opacityInput = document.getElementById('opacity');
const saveBtn = document.getElementById('save');

// Ajusta o tamanho do canvas ao do vídeo
function syncCanvasSize() {
  if (video.videoWidth && video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
}

// ---------- CATÁLOGO DE CORTES ----------
// Os PNGs ficam na RAIZ do repositório.
// Para trocar os modelos sem mexer em código, basta substituir os 3 arquivos
// pelos seus (com o MESMO nome: sidepart.png, shortcrop.png, quiff.png).
const HAIR_STYLES = [
  { id: 'sidepart', name: 'Social com risca (lado)', src: 'sidepart.png',   scale: 2.05, y: 0.78 },
  { id: 'quiff',    name: 'Quiff',                    src: 'quiff.png',      scale: 2.00, y: 0.80 },
  { id: 'short',    name: 'Social curto',             src: 'shortcrop.png',  scale: 1.90, y: 0.82 }
  { id: 'social',   name: 'Social (natural)',         src: 'social.png',     scale: 2.00, y: 0.80 }
];

const images = {};
let currentStyle = HAIR_STYLES[0];
let currentOpacity = parseFloat(opacityInput.value);

// Precarrega imagens e popula o select
HAIR_STYLES.forEach(s => {
  const img = new Image();
  img.src = s.src;
  img.crossOrigin = 'anonymous';
  images[s.id] = img;

  const opt = document.createElement('option');
  opt.value = s.id;
  opt.textContent = s.name;
  selectStyle.appendChild(opt);
});
selectStyle.value = currentStyle.id;

selectStyle.addEventListener('change', () => {
  currentStyle = HAIR_STYLES.find(s => s.id === selectStyle.value);
});
opacityInput.addEventListener('input', () => {
  currentOpacity = parseFloat(opacityInput.value);
});

// ---------- MEDIAPIPE FACEMESH ----------
const faceMesh = new FaceMesh({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
});
faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});
faceMesh.onResults(onResults);

// Câmera frontal
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user' },
    audio: false
  });
  video.srcObject = stream;
  await video.play();
  syncCanvasSize();

  const camera = new Camera(video, {
    onFrame: async () => { await faceMesh.send({ image: video }); },
    width: video.videoWidth || 720,
    height: video.videoHeight || 960
  });
  camera.start();
}

function onResults(results) {
  // Desenha frame da câmera
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

  if (results.multiFaceLandmarks && results.multiFaceLandmarks.length) {
    const lm = results.multiFaceLandmarks[0];

    // Pontos: têmporas (127 e 356) e topo da testa (10)
    const L = lm[127], R = lm[356], T = lm[10];

    // Converte para pixels
    const lx = L.x * canvas.width,  ly = L.y * canvas.height;
    const rx = R.x * canvas.width,  ry = R.y * canvas.height;
    const tx = T.x * canvas.width,  ty = T.y * canvas.height;

    // Largura da cabeça (entre têmporas)
    const faceWidth = Math.hypot(rx - lx, ry - ly);

    // Corte atual
    const s = currentStyle;
    const img = images[s.id];
    if (img && img.complete) {
      // Centro entre têmporas e referência na testa
      const cx = (lx + rx) / 2;
      const cy = ty;

      // Tamanho relativo
      const hairW = faceWidth * s.scale;
      const hairH = hairW * (img.height / img.width);

      // Ângulo da cabeça
      const angle = Math.atan2(ry - ly, rx - lx);

      // Desenha com rotação + leve deslocamento acima da testa
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.globalAlpha = currentOpacity;

      const yOffset = -hairH * s.y;
      ctx.drawImage(img, -hairW / 2, yOffset, hairW, hairH);

      // Reset
      ctx.globalAlpha = 1;
      ctx.rotate(-angle);
      ctx.translate(-cx, -cy);
    }
  }
  ctx.restore();
}

// Salvar preview
document.getElementById('save').addEventListener('click', () => {
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = 'transfor-mais-preview.png';
  a.click();
});

// Iniciar
startCamera().catch(err => {
  console.error(err);
  alert('Não foi possível acessar a câmera. Verifique permissões.');
});
