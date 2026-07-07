import './style.css';
import { animate } from 'framer-motion/dom';
import { initScene } from './scene.js';

const menuBtn = document.getElementById('menu-btn');
const sideMenu = document.getElementById('side-menu');
const blurOverlay = document.getElementById('blur-overlay');
const sceneContainer = document.getElementById('scene-container');

const line1 = document.querySelector('.line-1');
const line2 = document.querySelector('.line-2');
const line3 = document.querySelector('.line-3');

const ease = [0.16, 1, 0.3, 1];
let isOpen = false;

function openMenu() {
  isOpen = true;
  menuBtn.setAttribute('aria-expanded', 'true');
  sideMenu.setAttribute('aria-hidden', 'false');
  blurOverlay.classList.add('active');

  const width = sideMenu.offsetWidth;
  animate(sideMenu, { x: [width, 0] }, { duration: 0.45, ease });
  animate(line1, { rotate: 45, y: 7 }, { duration: 0.3, ease });
  animate(line2, { opacity: 0 }, { duration: 0.2 });
  animate(line3, { rotate: -45, y: -7 }, { duration: 0.3, ease });
}

function closeMenu() {
  isOpen = false;
  menuBtn.setAttribute('aria-expanded', 'false');
  sideMenu.setAttribute('aria-hidden', 'true');
  blurOverlay.classList.remove('active');

  const width = sideMenu.offsetWidth;
  animate(sideMenu, { x: [0, width] }, { duration: 0.4, ease });
  animate(line1, { rotate: 0, y: 0 }, { duration: 0.3, ease });
  animate(line2, { opacity: 1 }, { duration: 0.2 });
  animate(line3, { rotate: 0, y: 0 }, { duration: 0.3, ease });
}

menuBtn.addEventListener('click', () => {
  isOpen ? closeMenu() : openMenu();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isOpen) closeMenu();
});

document.addEventListener('click', (e) => {
  if (!isOpen) return;
  if (sideMenu.contains(e.target) || menuBtn.contains(e.target)) return;
  closeMenu();
});

initScene(sceneContainer);
