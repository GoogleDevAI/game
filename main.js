import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

class Game {
    // Private variables for security to prevent simple console-based tampering
    #score = 0;
    #timeRemaining = 20.0;
    #isPlaying = false;
    #lastTime = performance.now();
    #targets = [];
    #leaderboard = [];
    #currentSessionStartTime = null;
    #isTouchDevice = false;
    #gyroInitialized = false;

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
        this.mobileShootBtn = document.getElementById('mobile-shoot-btn');
        
        this.#isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

        if (this.#isTouchDevice) {
            this.mobileShootBtn.classList.add('active-for-touch');
            this.mobileShootBtn.addEventListener('touchstart', (e) => {
                e.stopPropagation(); // prevent drag logic from taking over
                e.preventDefault();  // prevent click events
                if (this.#isPlaying) this.shoot();
            }, { passive: false });
        }

        document.getElementById('start-btn').addEventListener('click', () => {
            if (this.#isTouchDevice) {
                this.requestMobilePermissionsAndStart();
            } else {
                this.controls.lock();
            }
        });

        document.getElementById('replay-btn').addEventListener('click', () => {
            if (this.#isTouchDevice) {
                this.requestMobilePermissionsAndStart();
            } else {
                this.controls.lock();
            }
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

        // Mobile Touch Controls
        let touchStartX = 0;
        let touchStartY = 0;
        let lastTouchX = 0;
        let lastTouchY = 0;

        document.addEventListener('touchstart', (e) => {
            if (!this.#isPlaying) return;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            lastTouchX = touchStartX;
            lastTouchY = touchStartY;
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (!this.#isPlaying) return;
            e.preventDefault(); // Prevent scrolling
            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            
            const deltaX = currentX - lastTouchX;
            const deltaY = currentY - lastTouchY;
            
            this.applyRotation(-deltaX * 0.005, -deltaY * 0.005);
            
            lastTouchX = currentX;
            lastTouchY = currentY;
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            if (!this.#isPlaying) return;
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            
            // If movement is very small, treat as a tap (shoot)
            const dist = Math.hypot(touchEndX - touchStartX, touchEndY - touchStartY);
            if (dist < 10) {
                this.shoot();
            }
        });
    }

    initAudio() {
        // Audio would be added here (Nice to have)
    }

    requestMobilePermissionsAndStart() {
        if (this.#isPlaying) return;

        if (!this.#gyroInitialized) {
            if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
                DeviceOrientationEvent.requestPermission()
                    .then(permissionState => {
                        if (permissionState === 'granted') {
                            window.addEventListener('deviceorientation', this.handleDeviceOrientation.bind(this));
                        }
                        this.#gyroInitialized = true;
                        this.startGame();
                    })
                    .catch((err) => {
                        console.error(err);
                        this.startGame(); // Fallback to swipe-only
                    });
                return; 
            } else {
                window.addEventListener('deviceorientation', this.handleDeviceOrientation.bind(this));
                this.#gyroInitialized = true;
            }
        }
        
        this.startGame();
    }

    handleDeviceOrientation(e) {
        if (!this.#isPlaying) return;

        const alpha = e.alpha; // 水平回転（Z軸） 0〜360
        const beta  = e.beta;  // 前後傾き（X軸） -180〜180
        const gamma = e.gamma; // 左右傾き（Y軸） -90〜90

        if (alpha === null || beta === null || gamma === null) return;

        // 初回: 現在の向きを「基準ゼロ点」として記録
        if (this.gyroBaseline === undefined) {
            this.gyroBaseline = { alpha, beta, gamma };
            this.previousGyro = { alpha, beta, gamma };
            return;
        }

        // 前フレームからの差分を計算
        let dAlpha = alpha - this.previousGyro.alpha;
        let dGamma = gamma - this.previousGyro.gamma;

        // 360度境界の補正
        if (dAlpha >  180) dAlpha -= 360;
        if (dAlpha < -180) dAlpha += 360;

        this.previousGyro = { alpha, beta, gamma };

        // スマホ縦持ち想定:
        //   alpha変化 → 水平（左右）エイム → カメラのYaw
        //   gamma変化 → 垂直（上下）エイム → カメラのPitch
        const sensitivity = 0.012; // 感度調整（好みで変更）

        const yawDelta   = -THREE.MathUtils.degToRad(dAlpha) * (sensitivity / 0.005);
        const pitchDelta = -THREE.MathUtils.degToRad(dGamma) * (sensitivity / 0.005);

        this.applyRotation(yawDelta, pitchDelta);
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
        this.#currentSessionStartTime = new Date();

        // ジャイロ基準点をリセット（再プレイ時に前回の向きを引き継がない）
        this.gyroBaseline = undefined;
        this.previousGyro = undefined;
        this.previousAlpha = undefined; // 旧コードの残滓も削除
        this.previousBeta  = undefined;

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
        for (let i = 0; i < 50; i++) {
            this.spawnTarget();
        }
    }

    endGame() {
        this.#isPlaying = false;
        this.controls.unlock();

        this.hud.classList.add('hidden');
        this.resultScreen.classList.remove('hidden');

        this.finalScore.innerText = this.#score;

        // Record score to leaderboard
        this.#leaderboard.push({
            score: this.#score,
            time: this.#currentSessionStartTime
        });
        
        // Sort descending by score
        this.#leaderboard.sort((a, b) => b.score - a.score);
        
        // Update leaderboard UI
        const rankingList = document.getElementById('ranking-list');
        rankingList.innerHTML = '';
        
        for (let i = 0; i < Math.min(3, this.#leaderboard.length); i++) {
            const entry = this.#leaderboard[i];
            const dateStr = entry.time.toLocaleTimeString('ja-JP'); 
            
            const li = document.createElement('li');
            li.innerHTML = `<span class="rank-score">${i + 1}位: ${entry.score} pts</span> <span class="rank-time">(${dateStr} 開始)</span>`;
            rankingList.appendChild(li);
        }

        // Reset Title screen text for next potential play
        document.querySelector('#title-screen h1').innerText = "STAR-SPHERE SHOOTER";
        document.querySelector('#title-screen p').innerHTML = "20秒以内に50個のターゲットを破壊せよ。<br>クリック/タップでミッション開始。<br>【PC】マウス＆WASD<br>【スマホ】ジャイロ ＆ スワイプ(エイム) ＆ タップ(射撃)";
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

    applyRotation(yawDelta, pitchDelta) {
        const euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.copy(this.camera.rotation);

        euler.y += yawDelta;
        euler.x += pitchDelta;
        
        // Clamp pitch to avoid flipping (-90 to 90 degrees)
        const PI_2 = Math.PI / 2;
        euler.x = Math.max(-PI_2 + 0.001, Math.min(PI_2 - 0.001, euler.x));
        
        this.camera.rotation.copy(euler);
    }

    applyWASDRotation(delta) {
        if (!this.#isPlaying) return;

        const rotationSpeed = 2.0 * delta; // Radians per second
        let yawDelta = 0;
        let pitchDelta = 0;

        if (this.keys.a) yawDelta += rotationSpeed;
        if (this.keys.d) yawDelta -= rotationSpeed;
        if (this.keys.w) pitchDelta += rotationSpeed;
        if (this.keys.s) pitchDelta -= rotationSpeed;

        if (yawDelta !== 0 || pitchDelta !== 0) {
            this.applyRotation(yawDelta, pitchDelta);
        }
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
