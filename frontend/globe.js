// ── CONFIG ────────────────────────────────────────────────────────────────────
// After deploying your worker, paste its URL here:
const WORKER_URL = "https://flight-tracker-worker.sidd-karani06.workers.dev";

const GLOBE_RADIUS = 5;
const PLANE_SIZE   = 0.06;
const REFRESH_MS   = 12000; // refresh live data every 12 seconds

// ── Scene setup ───────────────────────────────────────────────────────────────
const canvas    = document.getElementById("globe");
const renderer  = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 0, 14);

// Lighting
scene.add(new THREE.AmbientLight(0x334466, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.8);
sun.position.set(10, 5, 10);
scene.add(sun);

// Stars background
const starGeo = new THREE.BufferGeometry();
const starVerts = [];
for (let i = 0; i < 8000; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(2 * Math.random() - 1);
  const r     = 200 + Math.random() * 100;
  starVerts.push(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}
starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starVerts, 3));
scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 })));

// ── Globe ─────────────────────────────────────────────────────────────────────
const loader   = new THREE.TextureLoader();
const earthGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);

// Use a reliable free earth texture (NASA Blue Marble hosted on public CDN)
const earthTex = loader.load(
  "https://raw.githubusercontent.com/mrdoob/three.js/r128/examples/textures/planets/earth_atmos_2048.jpg",
  () => document.getElementById("loading").style.display = "none"
);
const earthMat  = new THREE.MeshPhongMaterial({ map: earthTex, specular: 0x111122, shininess: 15 });
const earthMesh = new THREE.Mesh(earthGeo, earthMat);
scene.add(earthMesh);

// Atmosphere glow
const atmosGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.02, 64, 64);
const atmosMat = new THREE.MeshPhongMaterial({
  color: 0x4488ff, transparent: true, opacity: 0.08, side: THREE.FrontSide,
});
scene.add(new THREE.Mesh(atmosGeo, atmosMat));

// ── Helpers ───────────────────────────────────────────────────────────────────
function latLonToVec3(lat, lon, r = GLOBE_RADIUS + 0.05) {
  const phi   = (90 - lat)  * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta)
  );
}

function metersToFeet(m)  { return m ? Math.round(m * 3.28084).toLocaleString() : "—"; }
function msToKnots(ms)    { return ms ? Math.round(ms * 1.94384) : "—"; }

// ── Plane sprites ─────────────────────────────────────────────────────────────
// Draw a tiny plane icon onto a canvas → texture
function makePlaneTexture(color = "#00d4ff") {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = color;
  // Body
  g.beginPath(); g.moveTo(32, 4); g.lineTo(36, 28); g.lineTo(32, 24); g.lineTo(28, 28); g.closePath(); g.fill();
  // Wings
  g.beginPath(); g.moveTo(32, 20); g.lineTo(60, 36); g.lineTo(56, 38); g.lineTo(32, 28); g.lineTo(8, 38); g.lineTo(4, 36); g.closePath(); g.fill();
  // Tail
  g.beginPath(); g.moveTo(32, 28); g.lineTo(40, 52); g.lineTo(32, 46); g.lineTo(24, 52); g.closePath(); g.fill();
  return new THREE.CanvasTexture(c);
}

const planeTex        = makePlaneTexture("#00d4ff");
const planeTexHighlit = makePlaneTexture("#fbbf24");
const planeTexTracked = makePlaneTexture("#34d399");

// Map of icao24 → THREE.Sprite
let planeSprites = {};
let flightData   = [];
let highlighted  = null;

function updatePlanes(flights) {
  flightData = flights;
  const seen = new Set();

  flights.forEach(f => {
    if (f.lat == null || f.lon == null) return;
    seen.add(f.icao24);

    if (!planeSprites[f.icao24]) {
      const mat    = new THREE.SpriteMaterial({ map: planeTex, sizeAttenuation: true, depthTest: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(PLANE_SIZE * 2, PLANE_SIZE * 2, 1);
      sprite.userData = { flight: f };
      scene.add(sprite);
      planeSprites[f.icao24] = sprite;
    }

    const sprite = planeSprites[f.icao24];
    const pos    = latLonToVec3(f.lat, f.lon);
    sprite.position.copy(pos);
    sprite.userData.flight = f;
  });

  // Remove stale sprites
  Object.keys(planeSprites).forEach(id => {
    if (!seen.has(id)) { scene.remove(planeSprites[id]); delete planeSprites[id]; }
  });

  document.getElementById("flight-count").textContent =
    `${flights.length.toLocaleString()} flights live`;
}

// ── Live data fetch ───────────────────────────────────────────────────────────
async function fetchFlights() {
  try {
    const res  = await fetch(`${WORKER_URL}/flights`);
    const data = await res.json();
    if (data.flights) updatePlanes(data.flights);
  } catch (e) {
    console.warn("Flight fetch error:", e);
  }
}

fetchFlights();
setInterval(fetchFlights, REFRESH_MS);

// ── Search ────────────────────────────────────────────────────────────────────
document.getElementById("search-btn").addEventListener("click", () => {
  const q = document.getElementById("search-input").value.trim().toUpperCase();
  const f = flightData.find(f => (f.callsign || "").toUpperCase().includes(q));
  if (f) selectFlight(f);
  else alert(`No active flight found matching "${q}"`);
});
document.getElementById("search-input").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("search-btn").click();
});

// ── Flight info panel ─────────────────────────────────────────────────────────
function selectFlight(f) {
  highlighted = f.icao24;
  // Highlight sprite
  Object.entries(planeSprites).forEach(([id, s]) => {
    const isTracked = window._tracked && window._tracked.includes(s.userData.flight?.callsign);
    s.material.map = id === f.icao24 ? planeTexHighlit : (isTracked ? planeTexTracked : planeTex);
    s.material.needsUpdate = true;
    s.scale.set(id === f.icao24 ? PLANE_SIZE * 3.5 : PLANE_SIZE * 2, id === f.icao24 ? PLANE_SIZE * 3.5 : PLANE_SIZE * 2, 1);
  });

  // Smoothly rotate globe to face the flight
  targetLat = f.lat; targetLon = f.lon;

  // Populate panel
  document.getElementById("fp-callsign").textContent = f.callsign || f.icao24;
  document.getElementById("fp-country").textContent  = f.origin_country || "—";
  document.getElementById("fp-alt").textContent      = f.altitude_m ? `${metersToFeet(f.altitude_m)} ft` : "—";
  document.getElementById("fp-speed").textContent    = f.velocity_ms ? `${msToKnots(f.velocity_ms)} kts` : "—";
  document.getElementById("fp-heading").textContent  = f.heading != null ? `${Math.round(f.heading)}°` : "—";
  document.getElementById("fp-vrate").textContent    = f.vertical_rate != null ? `${f.vertical_rate > 0 ? "+" : ""}${Math.round(f.vertical_rate)} m/s` : "—";
  document.getElementById("fp-pos").textContent      = `${f.lat?.toFixed(2)}°, ${f.lon?.toFixed(2)}°`;
  document.getElementById("flight-panel").style.display = "block";
  document.getElementById("track-btn").dataset.callsign  = f.callsign || f.icao24;
}

document.getElementById("track-btn").addEventListener("click", async () => {
  const cs  = document.getElementById("track-btn").dataset.callsign;
  const res = await fetch(`${WORKER_URL}/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callsign: cs, action: "add" }),
  });
  const data = await res.json();
  window._tracked = data.trackedCallsigns;
  document.getElementById("track-btn").textContent = "✅ Tracked!";
  setTimeout(() => document.getElementById("track-btn").textContent = "⭐ Track This Flight", 2000);
});

// Load tracked callsigns on startup
(async () => {
  try {
    const res  = await fetch(`${WORKER_URL}/tracked`);
    const data = await res.json();
    window._tracked = data.trackedCallsigns || [];
  } catch (_) { window._tracked = []; }
})();

// ── Mouse click ray-casting ───────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse     = new THREE.Vector2();

canvas.addEventListener("click", e => {
  mouse.x = (e.clientX / innerWidth)  *  2 - 1;
  mouse.y = (e.clientY / innerHeight) * -2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(Object.values(planeSprites));
  if (hits.length > 0) {
    selectFlight(hits[0].object.userData.flight);
  }
});

// ── Globe rotation & drag ─────────────────────────────────────────────────────
let isDragging = false, prevX = 0, prevY = 0;
let rotX = 0, rotY = 0, velX = 0, velY = 0;
let targetLat = null, targetLon = null;

canvas.addEventListener("mousedown", e => { isDragging = true; prevX = e.clientX; prevY = e.clientY; targetLat = targetLon = null; });
window.addEventListener("mouseup",   () => isDragging = false);
window.addEventListener("mousemove", e => {
  if (!isDragging) return;
  velY += (e.clientX - prevX) * 0.005;
  velX += (e.clientY - prevY) * 0.005;
  prevX = e.clientX; prevY = e.clientY;
});

// Zoom
canvas.addEventListener("wheel", e => {
  camera.position.z = Math.max(7, Math.min(30, camera.position.z + e.deltaY * 0.02));
});

// Touch drag
canvas.addEventListener("touchstart", e => { isDragging = true; prevX = e.touches[0].clientX; prevY = e.touches[0].clientY; });
canvas.addEventListener("touchend",   () => isDragging = false);
canvas.addEventListener("touchmove",  e => {
  if (!isDragging) return;
  velY += (e.touches[0].clientX - prevX) * 0.005;
  velX += (e.touches[0].clientY - prevY) * 0.005;
  prevX = e.touches[0].clientX; prevY = e.touches[0].clientY;
});

// ── Resize ────────────────────────────────────────────────────────────────────
window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ── Render loop ───────────────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);

  if (targetLat != null && targetLon != null) {
    // Animate globe rotation toward selected flight
    const targetRotX = -targetLat * Math.PI / 180;
    const targetRotY =  targetLon * Math.PI / 180;
    earthMesh.rotation.x += (targetRotX - earthMesh.rotation.x) * 0.05;
    earthMesh.rotation.y += (targetRotY - earthMesh.rotation.y) * 0.05;
  } else {
    if (!isDragging) {
      velX *= 0.92; velY *= 0.92;
      // Gentle auto-rotate when idle
      if (Math.abs(velY) < 0.0005) velY += 0.0008;
    }
    rotX += velX; rotY += velY;
    earthMesh.rotation.x = rotX;
    earthMesh.rotation.y = rotY;
  }

  // Keep plane sprites synced with globe rotation
  Object.values(planeSprites).forEach(s => {
    const f   = s.userData.flight;
    const pos = latLonToVec3(f.lat, f.lon);
    // Apply globe rotation to plane positions
    pos.applyEuler(earthMesh.rotation);
    s.position.copy(pos);
  });

  renderer.render(scene, camera);
}
animate();
