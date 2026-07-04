// 入口：装配场景与 UI。
import './style.css';
import { Scene } from './scene.js';
import { initUI } from './ui.js';

const canvas = document.getElementById('scene');
const scene = new Scene(canvas);
initUI(scene);
scene.start();
