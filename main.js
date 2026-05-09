import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

class Game {
    // Private variables for security to prevent simple console-based tampering
    #score = 0;
    #timeRemaining = 20.0;
    #isPlaying = false;
    #lastTime = performance.now();
    #targets = [];

    constructor() {
        this.initDOM();
        this.initThreeJS();
        this.initControls();
        this.initAudio(); // Placeholder for sound effects

        window.addEventListener('resize', this.onWindowResize.bind(this), false);
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    initDOM() {
        this.titleScreen = document.getElementById('title-screen');
        this.hud = document.getElementById('hud');
        this.resultScreen = document.getElementById('result-screen');
        this.timeDisplay = document.getElementById('time-display');
        this.scoreDisplay = document.getElementById('score-display');
        this.finalScore = document.getElementById('final-score');

        document.getElementById('start-btn').addEventListener('click', () => {
            this.controls.lock();
        });

        document.getElementById('replay-btn').addEventListener('click', () => {
            this.controls.lock();
        });
    }

    initThreeJS() {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x050b14, 0.002);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.body.appendChild(this.renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040); // Soft white light
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(10, 20, 10);
        this.scene.add(dirLight);

        // Starfield
        this.createStarfield();

        // Raycaster for shooting
        this.raycaster = new THREE.Raycaster();
        this.centerVector = new THREE.Vector2(0, 0); // Center of screen

        // Target settings
        this.targetGeometry = new THREE.SphereGeometry(1.5, 32, 32);
        // Vibrant neon pink material
        this.targetMaterial = new THREE.MeshStandardMaterial({
            color: 0xff00ff,
            emissive: 0x880088,
            roughness: 0.2,
            metalness: 0.8
        });
    }

    createStarfield() {
        const starsGeometry = new THREE.BufferGeometry();
        const starsCount = 2000;
        const posArray = new Float32Array(starsCount * 3);

        for (let i = 0; i < starsCount * 3; i++) {
            // Random positions in a sphere
            posArray[i] = (Math.random() - 0.5) * 500;
        }

        starsGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        const starsMaterial = new THREE.PointsMaterial({
            size: 0.5,
            color: 0xffffff,
            transparent: true,
            opacity: 0.8,
        });

        const starMesh = new THREE.Points(starsGeometry, starsMaterial);
        this.scene.add(starMesh);
    }

    initControls() {
        this.controls = new PointerLockControls(this.camera, document.body);

        this.controls.addEventListener('lock', () => {
            if (!this.#isPlaying) {
                this.startGame();
            } else {
                // Resume game
                this.hud.classList.remove('hidden');
                this.titleScreen.classList.add('hidden');
            }
        });

        this.controls.addEventListener('unlock', () => {
            if (this.#isPlaying && this.#timeRemaining > 0) {
                this.hud.classList.add('hidden');
                this.titleScreen.classList.remove('hidden');
                document.querySelector('#title-screen h1').innerText = "PAUSED";
                document.querySelector('#title-screen p').innerText = "クリックしてミッションを再開";
                document.getElementById('start-btn').innerText = "RESUME";
            }
        });

        // Shooting mechanism
        document.addEventListener('mousedown', (e) => {
            if (this.#isPlaying && this.controls.isLocked) {
                this.shoot();
            }
        });

        // WASD Auxiliary rotation
        this.keys = { w: false, a: false, s: false, d: false };
        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (this.keys.hasOwnProperty(key)) this.keys[key] = true;
        });
        document.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (this.keys.hasOwnProperty(key)) this.keys[key] = false;
        });
    }

    initAudio() {
        // Audio would be added here (Nice to have)
    }

    spawnTarget() {
        const mesh = new THREE.Mesh(this.targetGeometry, this.targetMaterial);

        // Target positioning logic based on specification:
        // x = r * sin(phi) * cos(theta)
        // y = r * sin(phi) * sin(theta)
        // z = r * cos(phi)
        const r = 30 + Math.random() * 20; // Radius between 30 and 50
        const phi = Math.acos(2 * Math.random() - 1); // 0 to PI evenly distributed
        const theta = Math.random() * 2 * Math.PI; // 0 to 2PI

        mesh.position.x = r * Math.sin(phi) * Math.cos(theta);
        mesh.position.y = r * Math.sin(phi) * Math.sin(theta);
        mesh.position.z = r * Math.cos(phi);

        // Add random rotation and movement data
        mesh.rotation.x = Math.random() * Math.PI;
        mesh.rotation.y = Math.random() * Math.PI;
        mesh.userData = {
            r: r,
            phi: phi,
            theta: theta,
            dPhi: (Math.random() - 0.5) * 1.5,   // Random angular velocity (phi)
            dTheta: (Math.random() - 0.5) * 1.5  // Random angular velocity (theta)
        };

        this.scene.add(mesh);
        this.#targets.push(mesh);
    }

    startGame() {
        // Reset state
        this.#score = 0;
        this.#timeRemaining = 20.0;
        this.#isPlaying = true;
        this.#lastTime = performance.now();

        this.updateScoreDisplay();
        this.updateTimeDisplay();

        // Hide UI, Show HUD
        this.titleScreen.classList.add('hidden');
        this.resultScreen.classList.add('hidden');
        this.hud.classList.remove('hidden');

        // Clear old targets
        this.#targets.forEach(t => this.scene.remove(t));
        this.#targets = [];

        // Reset camera rotation (PointerLockControls forces YXZ order)
        this.camera.rotation.set(0, 0, 0, 'YXZ');

        // Spawn 50 targets
        for (let i = 0; i < 40; i++) {
            this.spawnTarget();
        }
    }

    endGame() {
        this.#isPlaying = false;
        this.controls.unlock();

        this.hud.classList.add('hidden');
        this.resultScreen.classList.remove('hidden');

        this.finalScore.innerText = this.#score;

        // Reset Title screen text for next potential play
        document.querySelector('#title-screen h1').innerText = "STAR-SPHERE SHOOTER";
        document.querySelector('#title-screen p').innerHTML = "20秒以内に50個のターゲットを破壊せよ。<br>クリックでミッション開始。<br>マウス：エイム操作 / WASDキー：カメラ補助回転";
        document.getElementById('start-btn').innerText = "START MISSION";
    }

    shoot() {
        this.raycaster.setFromCamera(this.centerVector, this.camera);
        const intersects = this.raycaster.intersectObjects(this.#targets);

        if (intersects.length > 0) {
            // Hit the closest target
            const hitTarget = intersects[0].object;
            this.scene.remove(hitTarget);
            this.#targets = this.#targets.filter(t => t !== hitTarget);

            this.#score++;
            this.updateScoreDisplay();

            // Immediate respawn to keep exactly 20
            this.spawnTarget();
        }
    }

    updateScoreDisplay() {
        this.scoreDisplay.innerText = this.#score;
    }

    updateTimeDisplay() {
        // Format to 1 decimal place
        this.timeDisplay.innerText = Math.max(0, this.#timeRemaining).toFixed(1);
    }

    applyWASDRotation(delta) {
        if (!this.#isPlaying) return;

        const rotationSpeed = 2.0 * delta; // Radians per second

        // PointerLockControls uses 'YXZ' rotation order on the camera
        const euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.copy(this.camera.rotation);

        if (this.keys.a) euler.y += rotationSpeed;
        if (this.keys.d) euler.y -= rotationSpeed;
        if (this.keys.w) euler.x += rotationSpeed;
        if (this.keys.s) euler.x -= rotationSpeed;

        // Clamp pitch to avoid flipping (-90 to 90 degrees)
        const PI_2 = Math.PI / 2;
        euler.x = Math.max(-PI_2 + 0.001, Math.min(PI_2 - 0.001, euler.x));

        this.camera.rotation.copy(euler);
    }

    animate(time) {
        requestAnimationFrame(this.animate);

        const delta = (time - this.#lastTime) / 1000;
        this.#lastTime = time;

        if (this.#isPlaying) {
            this.#timeRemaining -= delta;

            if (this.#timeRemaining <= 0) {
                this.#timeRemaining = 0;
                this.updateTimeDisplay();
                this.endGame();
            } else {
                this.updateTimeDisplay();
                this.applyWASDRotation(delta);

                // Animate targets to make them dynamic and move randomly
                this.#targets.forEach(t => {
                    t.rotation.x += 0.5 * delta;
                    t.rotation.y += 0.5 * delta;

                    t.userData.phi += t.userData.dPhi * delta;
                    t.userData.theta += t.userData.dTheta * delta;

                    // Constrain phi to 0..PI to prevent unnatural flipping at poles
                    if (t.userData.phi < 0) {
                        t.userData.phi = -t.userData.phi;
                        t.userData.dPhi *= -1;
                    } else if (t.userData.phi > Math.PI) {
                        t.userData.phi = 2 * Math.PI - t.userData.phi;
                        t.userData.dPhi *= -1;
                    }

                    t.position.x = t.userData.r * Math.sin(t.userData.phi) * Math.cos(t.userData.theta);
                    t.position.y = t.userData.r * Math.sin(t.userData.phi) * Math.sin(t.userData.theta);
                    t.position.z = t.userData.r * Math.cos(t.userData.phi);
                });
            }
        }

        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// Start game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new Game();
});
