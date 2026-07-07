import * as THREE from 'three';

export class SimulationScene {
    constructor(containerId) {
        this.container = document.getElementById(containerId);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);

        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);

        // نقطة التقاط الكاميرا (المدار حوالينها) - وسط جهاز البندولات تقريباً
        this.cameraTarget = new THREE.Vector3(0, 1.0, 0);

        // إحداثيات كروية للكاميرا حول الهدف: نصف قطر، زاوية أفقية (theta)، زاوية رأسية (phi)
        this.cameraRadius = 5.0;
        this.cameraTheta = 0;          // دوران أفقي حول المحور y
        this.cameraPhi = Math.PI / 2.4; // ميل رأسي (قريب من مستوي الأفق قليلاً مرفوع)

        this.updateCameraPosition();

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
        dirLight.position.set(5, 10, 7);
        this.scene.add(dirLight);

        this.ballMaterial = new THREE.MeshStandardMaterial({
            color: 0xe1ff00,
            roughness: 0.1,
            metalness: 0.2
        });

        this.ropeMaterial = new THREE.LineBasicMaterial({
            color: 0xaaaaaa,
            linewidth: 2
        });

        this.metalMaterial = new THREE.MeshStandardMaterial({
            color: 0xd4af37,
            roughness: 0.2,
            metalness: 0.8
        });

        this.woodMaterial = new THREE.MeshStandardMaterial({
            color: 0x3d2314,
            roughness: 0.6,
            metalness: 0.1
        });

        this.visualBalls = [];
        this.visualRopes = [];
        this.ballRotations = [];

        this.createStructure();
        this.setupOrbitCamera();
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    // كاميرا مدارية بسيطة: سحب بالماوس يدور حول الجهاز، والعجلة تقرّب/تبعّد
    // مكتوبة يدوياً بدون أي مكتبة تحكم خارجية (فقط رياضيات إحداثيات كروية)
    setupOrbitCamera() {
        const dom = this.renderer.domElement;
        let isDragging = false;
        let lastX = 0, lastY = 0;

        dom.addEventListener('mousedown', (e) => {
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
        });

        window.addEventListener('mouseup', () => { isDragging = false; });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;

            this.cameraTheta -= dx * 0.008;
            this.cameraPhi -= dy * 0.008;
            // تفادي انقلاب الكاميرا عند القطبين
            const epsilon = 0.05;
            this.cameraPhi = Math.max(epsilon, Math.min(Math.PI - epsilon, this.cameraPhi));

            this.updateCameraPosition();
        });

        dom.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.cameraRadius += e.deltaY * 0.003;
            this.cameraRadius = Math.max(1.5, Math.min(15, this.cameraRadius));
            this.updateCameraPosition();
        }, { passive: false });

        // دعم اللمس للأجهزة المحمولة (سحب إصبع واحد = تدوير)
        let lastTouchX = 0, lastTouchY = 0;
        dom.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                lastTouchX = e.touches[0].clientX;
                lastTouchY = e.touches[0].clientY;
            }
        });
        dom.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                const dx = e.touches[0].clientX - lastTouchX;
                const dy = e.touches[0].clientY - lastTouchY;
                lastTouchX = e.touches[0].clientX;
                lastTouchY = e.touches[0].clientY;

                this.cameraTheta -= dx * 0.008;
                this.cameraPhi -= dy * 0.008;
                const epsilon = 0.05;
                this.cameraPhi = Math.max(epsilon, Math.min(Math.PI - epsilon, this.cameraPhi));
                this.updateCameraPosition();
            }
        }, { passive: true });
    }

    updateCameraPosition() {
        // تحويل الإحداثيات الكروية (radius, theta, phi) إلى موضع ديكارتي x,y,z حول الهدف
        const x = this.cameraTarget.x + this.cameraRadius * Math.sin(this.cameraPhi) * Math.sin(this.cameraTheta);
        const y = this.cameraTarget.y + this.cameraRadius * Math.cos(this.cameraPhi);
        const z = this.cameraTarget.z + this.cameraRadius * Math.sin(this.cameraPhi) * Math.cos(this.cameraTheta);
        this.camera.position.set(x, y, z);
        this.camera.lookAt(this.cameraTarget);
    }

    createStructure() {
        const baseGeo = new THREE.BoxGeometry(3.6, 0.15, 1.6);
        const baseMesh = new THREE.Mesh(baseGeo, this.woodMaterial);
        baseMesh.position.set(0, -0.5, 0);
        this.scene.add(baseMesh);

        const zPositions = [0.4, -0.4];
        zPositions.forEach(z => {
            const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.3, 16);

            const leftPole = new THREE.Mesh(poleGeo, this.metalMaterial);
            leftPole.position.set(-1.6, 0.65, z);
            this.scene.add(leftPole);

            const rightPole = new THREE.Mesh(poleGeo, this.metalMaterial);
            rightPole.position.set(1.6, 0.65, z);
            this.scene.add(rightPole);

            const topBarGeo = new THREE.CylinderGeometry(0.04, 0.04, 3.2, 16);
            topBarGeo.rotateZ(Math.PI / 2);
            const topBar = new THREE.Mesh(topBarGeo, this.metalMaterial);
            topBar.position.set(0, 1.8, z);
            this.scene.add(topBar);
        });
    }

    createVisualBalls(ballsData) {
        this.visualBalls.forEach(b => this.scene.remove(b));
        this.visualRopes.forEach(r => this.scene.remove(r));
        this.visualBalls = [];
        this.visualRopes = [];
        this.ballRotations = [];

        ballsData.forEach(ball => {
            const ballGeo = new THREE.SphereGeometry(ball.radius, 32, 32);
            const mesh = new THREE.Mesh(ballGeo, this.ballMaterial);
            mesh.position.copy(ball.position);
            this.scene.add(mesh);
            this.visualBalls.push(mesh);

            this.ballRotations.push({
                quaternion: new THREE.Quaternion(),
                angularVelocity: new THREE.Vector3(0, 0, 0)
            });

            const points = [
                new THREE.Vector3(ball.suspension.x, 1.8, ball.suspension.z),
                new THREE.Vector3(ball.position.x, ball.position.y, ball.position.z)
            ];
            const ropeGeo = new THREE.BufferGeometry().setFromPoints(points);
            const rope = new THREE.Line(ropeGeo, this.ropeMaterial);
            rope.visible = true;
            this.scene.add(rope);
            this.visualRopes.push(rope);
        });
    }

    // تحديث حجم شبكة الكرة البصرية (لحالة الكرة المثقوبة التي يتقلص نصف قطرها فعلياً)
    updateBallGeometry(index, radius) {
        const mesh = this.visualBalls[index];
        if (mesh) {
            mesh.geometry.dispose();
            mesh.geometry = new THREE.SphereGeometry(radius, 32, 32);
        }
    }

    syncVisuals(ballsData) {
        for (let i = 0; i < ballsData.length; i++) {
            const data = ballsData[i];
            const visualBall = this.visualBalls[i];
            const visualRope = this.visualRopes[i];

            if (visualBall && visualRope) {
                visualBall.position.set(data.position.x, data.position.y, data.position.z);

                if (this.ballRotations[i]) {
                    const rotData = this.ballRotations[i];

                    rotData.angularVelocity.set(
                        data.angularVelocity.x,
                        data.angularVelocity.y,
                        data.angularVelocity.z
                    );

                    const angularVelMagnitude = rotData.angularVelocity.length();
                    if (angularVelMagnitude > 0.001) {
                        const axis = rotData.angularVelocity.clone().normalize();
                        const angle = angularVelMagnitude * (0.0005 * 15);
                        const deltaQuaternion = new THREE.Quaternion();
                        deltaQuaternion.setFromAxisAngle(axis, angle);

                        rotData.quaternion.multiplyQuaternions(deltaQuaternion, rotData.quaternion);
                        rotData.quaternion.normalize();
                    }

                    visualBall.quaternion.copy(rotData.quaternion);
                }

                const positions = visualRope.geometry.attributes.position.array;
                positions[0] = data.suspension.x;
                positions[1] = 1.8;
                positions[2] = data.suspension.z;

                positions[3] = data.position.x;
                positions[4] = data.position.y;
                positions[5] = data.position.z;

                visualRope.geometry.attributes.position.needsUpdate = true;

                visualRope.visible = !data.isRopeSnapped;
            }
        }
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}