import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { animate } from 'framer-motion/dom';

const CORNERS = [
  { pos: [1, 1, 1], label: 'Point 1' },
  { pos: [1, 1, -1], label: 'Point 2' },
  { pos: [-1, 1, 1], label: 'Point 3' },
  { pos: [-1, 1, -1], label: 'Point 4' },
  { pos: [1, -1, 1], label: 'Point 5' },
  { pos: [1, -1, -1], label: 'Point 6' },
  { pos: [-1, -1, 1], label: 'Point 7' },
  { pos: [-1, -1, -1], label: 'Point 8' },
];

const VISIBILITY_ON = 0.08;
const VISIBILITY_OFF = -0.08;
const LEADER_LENGTH = 58;
const TOOLTIP_GAP = 14;

export function initScene(container) {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    42,
    container.clientWidth / container.clientHeight,
    0.1,
    100
  );
  camera.position.set(3.9, 2.99, 4.83);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.cursor = 'grab';
  container.appendChild(renderer.domElement);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));

  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(4, 6, 5);
  scene.add(key);

  // Purple accent lighting for a soft, even color tint (no harsh side hotspot)
  const rim = new THREE.DirectionalLight(0x9b5cff, 0.45);
  rim.position.set(-5, 2, -4);
  scene.add(rim);

  const underLight = new THREE.PointLight(0xa855f7, 1.4, 10, 2);
  underLight.position.set(0, -2.6, 1);
  scene.add(underLight);

  // --- Ambient purple glow, rendered inside the scene (avoids CSS blend-mode seams) ---
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 256;
  glowCanvas.height = 256;
  const glowCtx = glowCanvas.getContext('2d');
  const glowGradient = glowCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
  glowGradient.addColorStop(0, 'rgba(168, 85, 247, 0.85)');
  glowGradient.addColorStop(0.4, 'rgba(140, 60, 220, 0.35)');
  glowGradient.addColorStop(1, 'rgba(140, 60, 220, 0)');
  glowCtx.fillStyle = glowGradient;
  glowCtx.fillRect(0, 0, 256, 256);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);

  const glowSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.55,
    })
  );
  glowSprite.scale.set(7.5, 7.5, 1);
  glowSprite.position.set(0, -0.6, -1.4);
  scene.add(glowSprite);

  const group = new THREE.Group();
  scene.add(group);

  new GLTFLoader().load(`${import.meta.env.BASE_URL}models/glassCube.glb`, (gltf) => {
    gltf.scene.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        obj.material.envMapIntensity = 1.4;
      }
    });
    group.add(gltf.scene);
  });

  // --- Neon glow overlay: glowing wireframe edges + vertex points ---
  const edgesGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(2, 2, 2));

  const edgesCore = new THREE.LineSegments(
    edgesGeometry,
    new THREE.LineBasicMaterial({ color: 0xe4d4ff, transparent: true, opacity: 0.9 })
  );
  group.add(edgesCore);

  const edgesGlow = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(2.03, 2.03, 2.03)),
    new THREE.LineBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  group.add(edgesGlow);

  const vertexPositions = new Float32Array(CORNERS.flatMap((c) => c.pos));
  const vertexGeometry = new THREE.BufferGeometry();
  vertexGeometry.setAttribute('position', new THREE.BufferAttribute(vertexPositions, 3));
  const vertexPoints = new THREE.Points(
    vertexGeometry,
    new THREE.PointsMaterial({
      color: 0xe4d4ff,
      size: 0.075,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  group.add(vertexPoints);

  // --- Corner marker overlay (dot + leader line + tooltip on hover) ---
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.classList.add('marker-lines');
  container.appendChild(svg);

  const markers = CORNERS.map((corner) => {
    const line = document.createElementNS(svgNS, 'line');
    svg.appendChild(line);

    const el = document.createElement('div');
    el.className = 'corner-marker';

    const dot = document.createElement('div');
    dot.className = 'corner-dot';
    el.appendChild(dot);
    container.appendChild(el);

    const tooltip = document.createElement('div');
    tooltip.className = 'corner-tooltip';
    tooltip.textContent = corner.label;
    container.appendChild(tooltip);

    const marker = { corner, el, tooltip, line, visible: true, hovering: false };

    el.addEventListener('mouseenter', () => showTooltip(marker));
    el.addEventListener('mouseleave', () => hideTooltip(marker));

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (marker.hovering) {
        hideTooltip(marker);
      } else {
        markers.forEach((m) => m !== marker && hideTooltip(m));
        showTooltip(marker);
      }
    });

    return marker;
  });

  function showTooltip(marker) {
    marker.hovering = true;
    animate(marker.line, { opacity: 1 }, { duration: 0.25 });
    animate(marker.tooltip, { opacity: 1 }, { duration: 0.25 });
  }

  function hideTooltip(marker) {
    marker.hovering = false;
    animate(marker.line, { opacity: 0 }, { duration: 0.2 });
    animate(marker.tooltip, { opacity: 0 }, { duration: 0.2 });
  }

  document.addEventListener('click', () => {
    markers.forEach((m) => hideTooltip(m));
  });

  const vector = new THREE.Vector3();
  const outward = new THREE.Vector3();
  const worldOutward = new THREE.Vector3();
  const viewDir = new THREE.Vector3();
  const center = new THREE.Vector3();

  function updateMarkers() {
    const w = container.clientWidth;
    const h = container.clientHeight;

    center.set(0, 0, 0).applyMatrix4(group.matrixWorld).project(camera);
    const cx = (center.x * 0.5 + 0.5) * w;
    const cy = (-center.y * 0.5 + 0.5) * h;

    markers.forEach((marker) => {
      const { corner, el, tooltip, line } = marker;

      vector.set(corner.pos[0], corner.pos[1], corner.pos[2]).applyMatrix4(group.matrixWorld);
      outward.set(corner.pos[0], corner.pos[1], corner.pos[2]).normalize();
      worldOutward.copy(outward).transformDirection(group.matrixWorld);
      viewDir.copy(camera.position).sub(vector).normalize();
      const facing = worldOutward.dot(viewDir);

      if (facing > VISIBILITY_ON) marker.visible = true;
      else if (facing < VISIBILITY_OFF) marker.visible = false;

      if (!marker.visible) {
        el.classList.add('marker-hidden');
        if (marker.hovering) {
          marker.hovering = false;
          animate(line, { opacity: 0 }, { duration: 0.15 });
          animate(tooltip, { opacity: 0 }, { duration: 0.15 });
        }
      } else {
        el.classList.remove('marker-hidden');
      }

      const projected = vector.clone().project(camera);
      const x = (projected.x * 0.5 + 0.5) * w;
      const y = (-projected.y * 0.5 + 0.5) * h;

      el.style.transform = `translate(${x}px, ${y}px)`;

      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const ex = x + (dx / dist) * LEADER_LENGTH;
      const ey = y + (dy / dist) * LEADER_LENGTH;

      line.setAttribute('x1', x);
      line.setAttribute('y1', y);
      line.setAttribute('x2', ex);
      line.setAttribute('y2', ey);

      const tipW = tooltip.offsetWidth || 60;
      const tipH = tooltip.offsetHeight || 16;
      const edgePad = 8;

      let tipLeft = dx >= 0 ? ex + TOOLTIP_GAP : ex - TOOLTIP_GAP - tipW;
      tipLeft = Math.min(Math.max(tipLeft, edgePad), w - tipW - edgePad);

      let tipTop = ey - tipH / 2;
      tipTop = Math.min(Math.max(tipTop, edgePad), h - tipH - edgePad);

      tooltip.style.left = `${tipLeft}px`;
      tooltip.style.top = `${tipTop}px`;
      tooltip.style.transform = 'none';
    });
  }

  // --- Cursor-driven rotation with inertia ---
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let velX = 0;
  let velY = 0;
  const damping = 0.94;
  const sensitivity = 0.008;
  const autoRotateSpeed = 0.0018;

  renderer.domElement.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    velX = 0;
    velY = 0;
    renderer.domElement.setPointerCapture(e.pointerId);
    renderer.domElement.style.cursor = 'grabbing';
  });

  renderer.domElement.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    velX = dx * sensitivity;
    velY = dy * sensitivity;
    group.rotation.y += velX;
    group.rotation.x += velY;
  });

  function stopDrag() {
    if (!dragging) return;
    dragging = false;
    renderer.domElement.style.cursor = 'grab';
  }

  renderer.domElement.addEventListener('pointerup', stopDrag);
  renderer.domElement.addEventListener('pointercancel', stopDrag);
  renderer.domElement.addEventListener('pointerleave', stopDrag);

  function tick() {
    requestAnimationFrame(tick);

    if (!dragging) {
      group.rotation.y += autoRotateSpeed;

      if (Math.abs(velX) > 0.0001 || Math.abs(velY) > 0.0001) {
        group.rotation.y += velX;
        group.rotation.x += velY;
        velX *= damping;
        velY *= damping;
      }
    }

    group.updateMatrixWorld();
    updateMarkers();
    renderer.render(scene, camera);
  }
  tick();

  window.addEventListener('resize', () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
}
