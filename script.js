
// Basic automatic hair overlay using MediaPipe FaceMesh
const video = document.getElementById('video');
const output = document.getElementById('output');
const ctx = output.getContext('2d');
const overlayImg = document.getElementById('overlay');
const styleSel = document.getElementById('style');
const opacitySlider = document.getElementById('opacity');
const snapBtn = document.getElementById('snap');
const dl = document.getElementById('download');

overlayImg.style.opacity = opacitySlider.value;

styleSel.addEventListener('change', e => {
  overlayImg.src = `assets/overlays/${e.target.value}.png`;
});

opacitySlider.addEventListener('input', e => {
  overlayImg.style.opacity = e.target.value;
});

async function setupCamera(){
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode:'user' }, audio:false});
  video.srcObject = stream;
  await new Promise(r => video.onloadedmetadata = r);
  video.play();
}

function autoPlaceOverlay(landmarks){
  // Use forehead and jaw landmarks to estimate head size & angle
  const leftForehead = landmarks[71];  // approximate
  const rightForehead = landmarks[301];
  const chin = landmarks[152];
  const nose = landmarks[1];

  const dx = rightForehead.x - leftForehead.x;
  const dy = rightForehead.y - leftForehead.y;
  const angle = Math.atan2(dy, dx);

  const headWidth = Math.hypot(dx, dy);
  const headHeight = Math.hypot((chin.x-nose.x),(chin.y-nose.y));

  const scale = Math.max(headWidth, headHeight) * 2.1; // heuristic scale

  // Convert normalized coords to pixels
  const w = output.width, h = output.height;
  const cx = ((leftForehead.x + rightForehead.x)/2) * w;
  const cy = ((leftForehead.y + rightForehead.y)/2) * h - (0.08*h);

  overlayImg.style.width = `${scale*w}px`;
  overlayImg.style.height = 'auto';
  overlayImg.style.left = `${cx - (scale*w)/2}px`;
  overlayImg.style.top = `${cy - (scale*w)/3}px`;
  overlayImg.style.transform = `rotate(${angle}rad)`;
}

function onResults(res){
  ctx.save();
  ctx.clearRect(0,0,output.width,output.height);
  ctx.drawImage(video, 0, 0, output.width, output.height);
  if(res.multiFaceLandmarks && res.multiFaceLandmarks.length>0){
    autoPlaceOverlay(res.multiFaceLandmarks[0]);
  }
  ctx.restore();
}

async function main(){
  await setupCamera();
  output.width = video.videoWidth;
  output.height = video.videoHeight;

  const faceMesh = new FaceMesh.FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
  });
  faceMesh.setOptions({ maxNumFaces:1, refineLandmarks:true, minDetectionConfidence:0.5, minTrackingConfidence:0.5});
  faceMesh.onResults(onResults);

  const camera = new Camera(video,{
    onFrame: async ()=>{ await faceMesh.send({image:video}); },
    width: output.width,
    height: output.height
  });
  camera.start();

  snapBtn.addEventListener('click', ()=>{
    // Temporarily hide controls for a clean export
    const prev = overlayImg.style.transform;
    // draw overlay onto canvas snapshot
    const temp = document.createElement('canvas');
    temp.width = output.width; temp.height = output.height;
    const tctx = temp.getContext('2d');
    tctx.drawImage(output,0,0);
    // draw the overlay image in its current position
    const rect = overlayImg.getBoundingClientRect();
    const oRect = output.getBoundingClientRect();
    const ox = rect.left - oRect.left;
    const oy = rect.top - oRect.top;
    const ow = overlayImg.clientWidth;
    const oh = overlayImg.clientHeight;
    // Simplified (rotation not applied in export)
    tctx.globalAlpha = parseFloat(opacitySlider.value);
    tctx.drawImage(overlayImg, ox, oy, ow, oh);

    const url = temp.toDataURL('image/png');
    dl.href = url;
    dl.click();
  });
}

main();
