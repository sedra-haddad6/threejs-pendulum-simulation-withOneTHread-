import { PhysicsVector } from './PhysicsVector.js';
import { BallState } from './BallState.js';
import { PhysicsEngine } from './PhysicsEngine.js';
import { SimulationScene } from './SimulationScene.js';

let balls = [];
const numBalls = 5;
const ballRadius = 0.25;
const suspensionY = 1.8;

const engine = new PhysicsEngine();
const simScene = new SimulationScene('canvas-container');

// تحويل قيمة سلايدر "مقاومة الهواء" إلى كثافة هواء فعلية (kg/m³)
// عند 0 => فراغ تام (لا سحب، حفظ كامل للطاقة) - عند الحد الأقصى => وسط كثيف يبدد الطاقة بسرعة ملحوظة
// المعامل 25000 يحول مجال السلايدر [0, 0.002] إلى مجال كثافة معقول [0, 50] kg/m³
function sliderToAirDensity(sliderValue) {
    return Math.max(0, sliderValue) * 25000;
}

function initSimulation() {
    balls = [];
    const specialCase = document.getElementById('special-case').value;

    const initialOffsetX = parseFloat(document.getElementById('init-offset-x')?.value || 1.2);
    const initialOffsetZ = parseFloat(document.getElementById('init-offset-z')?.value || 0);
    const selectedBallIndex = parseInt(document.getElementById('ball-select')?.value || 0);
    const gravityValue = parseFloat(document.getElementById('gravity-slider')?.value || 9.81);
    const dampingValue = parseFloat(document.getElementById('damping-slider')?.value || 0.0001);

    engine.g = gravityValue;
    engine.airDensity = sliderToAirDensity(dampingValue);

    const startX = -((numBalls - 1) * (ballRadius * 2)) / 2;

    for (let i = 0; i < numBalls; i++) {
        let mass = 0.5;
        let length = 2.0;

        if (specialCase === 'mass-variance' && i === 2) {
            mass = 2.5;
        }
        if (specialCase === 'length-variance') {
            length = 1.4 + (i * 0.15);
        }

        const suspensionX = startX + i * (ballRadius * 2 + 0.0015);
        const suspensionPoint = new PhysicsVector(suspensionX, suspensionY, 0);
        const ball = new BallState(i, mass, ballRadius, length, suspensionPoint);

        if (i === selectedBallIndex) {
            // إزاحة ثنائية المحور (x و z) مع الحفاظ على طول الخيط: y = suspensionY - sqrt(L² - x² - z²)
            // هذا هو ما يجعل الكرة تتأرجح فعلياً على 3 محاور (بندول مخروطي) بدل مستوٍ واحد فقط
            const maxHorizontal = length * 0.95;
            let ox = initialOffsetX;
            let oz = initialOffsetZ;
            const horizontalDist = Math.sqrt(ox * ox + oz * oz);
            if (horizontalDist > maxHorizontal && horizontalDist > 0) {
                const scale = maxHorizontal / horizontalDist;
                ox *= scale;
                oz *= scale;
            }
            const calculatedY = suspensionY - Math.sqrt(Math.max(0, length * length - ox * ox - oz * oz));
            ball.position.set(suspensionX - ox, calculatedY, oz);
        } else {
            ball.position.set(suspensionX, suspensionY - length, 0);
        }

        if (specialCase === 'punctured-ball' && i === 0) {
            ball.isPunctured = true;
        }

        balls.push(ball);
    }

    simScene.createVisualBalls(balls);
}

function updateEnergyStats() {
    let totalEp = 0;
    let totalEk = 0;
    let totalRotationalEk = 0;

    for (let ball of balls) {
        const h = ball.position.y - (suspensionY - ball.length);
        const ep = ball.mass * engine.g * h; // بدون Math.max: تسمح بقيم جاذبية سالبة دون خطأ

        const v2 = ball.velocity.lengthSq();
        const ek = 0.5 * ball.mass * v2;

        const w2 = ball.angularVelocity.lengthSq();
        const rotationalEk = 0.5 * ball.inertia * w2;

        totalEp += ep;
        totalEk += ek;
        totalRotationalEk += rotationalEk;
    }

    const totalEnergy = totalEp + totalEk + totalRotationalEk;
    document.getElementById('energy-stats').innerHTML =
        'طاقة الوضع: ' + totalEp.toFixed(2) + ' جول<br>' +
        'الطاقة الحركية: ' + totalEk.toFixed(2) + ' جول<br>' +
        
        'الطاقة الكلية: ' + totalEnergy.toFixed(2) + ' جول';
}

// خطوة زمنية صغيرة لضمان استقرار عددي جيد مع التصادمات المتتالية
const dt = 0.0005;

function animate() {
    requestAnimationFrame(animate);

    const specialCase = document.getElementById('special-case').value;
    const isFullyInelastic = (specialCase === 'inelastic');

    for (let step = 0; step < 15; step++) {
        engine.computeForces(balls, isFullyInelastic);
        engine.integrate(balls, dt);
    }

    for (let i = 0; i < balls.length; i++) {
      const ball = balls[i];
    if (ball.updatePuncturedState) { 
        // تحديث الكتلة وعزم القصور داخلياً فقط دون تعديل الهندسة البصرية
        ball.updatePuncturedState(dt * 15); 
    }
    }

    simScene.syncVisuals(balls);
    updateEnergyStats();
    simScene.render();
}

document.getElementById('reset-btn').addEventListener('click', initSimulation);
document.getElementById('special-case').addEventListener('change', initSimulation);
document.getElementById('ball-select')?.addEventListener('change', initSimulation);

function repositionSelectedBall() {
    const selectedBallIndex = parseInt(document.getElementById('ball-select')?.value || 0);
    const currentVal = parseFloat(document.getElementById('init-offset-x').value);
    const currentZ = parseFloat(document.getElementById('init-offset-z')?.value || 0);
    document.getElementById('offset-val').innerText = currentVal.toFixed(1) + ' م';
    const offsetZLabel = document.getElementById('offset-z-val');
    if (offsetZLabel) offsetZLabel.innerText = currentZ.toFixed(1) + ' م';

    const startX = -((numBalls - 1) * (ballRadius * 2)) / 2;
    const suspensionX = startX + selectedBallIndex * (ballRadius * 2 + 0.0015);

    if (balls[selectedBallIndex]) {
        const length = balls[selectedBallIndex].length || 2.0;
        const maxHorizontal = length * 0.95;
        let ox = currentVal;
        let oz = currentZ;
        const horizontalDist = Math.sqrt(ox * ox + oz * oz);
        if (horizontalDist > maxHorizontal && horizontalDist > 0) {
            const scale = maxHorizontal / horizontalDist;
            ox *= scale;
            oz *= scale;
        }
        const calculatedY = suspensionY - Math.sqrt(Math.max(0, length * length - ox * ox - oz * oz));
        balls[selectedBallIndex].position.set(suspensionX - ox, calculatedY, oz);
        balls[selectedBallIndex].velocity.set(0, 0, 0);
    }
}

document.getElementById('init-offset-x').addEventListener('input', repositionSelectedBall);
document.getElementById('init-offset-z')?.addEventListener('input', repositionSelectedBall);

// الجاذبية: تُقبل أي قيمة بما فيها 0 (طفو كامل) أو سالبة (جاذبية معكوسة) دون أي خطأ برمجي
document.getElementById('gravity-slider')?.addEventListener('input', function (e) {
    document.getElementById('gravity-value').innerText = e.target.value + ' m/s²';
    engine.g = parseFloat(e.target.value);
});

// مقاومة الهواء: تتحكم بكثافة الوسط (ρ) في معادلة السحب الفيزيائية الحقيقية - وليست معامل تخميد مصطنع
document.getElementById('damping-slider')?.addEventListener('input', function (e) {
    document.getElementById('damping-value').innerText = e.target.value;
    engine.airDensity = sliderToAirDensity(parseFloat(e.target.value));
});

document.getElementById('snap-rope-btn').addEventListener('click', function () {
    const selectedBallIndex = parseInt(document.getElementById('ball-select')?.value || 0);
    if (balls.length > selectedBallIndex) {
        balls[selectedBallIndex].isRopeSnapped = true;
    }
});

document.getElementById('drop-multiple-btn')?.addEventListener('click', function () {
    if (balls.length > 0) {
        balls[0].isRopeSnapped = true;
        if (balls[1]) balls[1].isRopeSnapped = true;
    }
});

initSimulation();
animate();