import { PhysicsVector } from './PhysicsVector.js';

export class BallState {
    constructor(index, mass, radius, length, suspensionPoint) {
        this.index = index;
        this.mass = mass;
        this.radius = radius;
        this.length = length;
        this.suspension = suspensionPoint;

        this.position = new PhysicsVector();
        this.velocity = new PhysicsVector();
        this.acceleration = new PhysicsVector();
        this.netForce = new PhysicsVector();

        // العزم الدوراني والسرعة الزاوية
        this.angularVelocity = new PhysicsVector();
        this.angularAcceleration = new PhysicsVector();
        this.torque = new PhysicsVector();

        // لحظة القصور الذاتي (Moment of Inertia) لكرة صلبة متجانسة: I = (2/5) m r²
        this.inertia = (2 / 5) * mass * radius * radius;

        this.isRopeSnapped = false;
        this.isPunctured = false;
        this.initialMass = mass;

        // معامل السحب (Cd) خاصية شكل الكرة نفسها (كرة ملساء تقريباً)
        // كثافة الهواء ρ خاصية "الوسط" وليست خاصية الكرة، فبقيت على مستوى المحرك (PhysicsEngine)
        this.dragCoefficient = 0.47;
    }

    // نصف قطر الكرة يتقلص مع تناقص الكتلة (كرة مثقوبة) بافتراض كثافة ثابتة للمادة
    // m = ρ_ball * (4/3)π r³  =>  r ∝ m^(1/3)
    updatePuncturedState(dt) {
        if (this.isPunctured && this.mass > 0.05) {
            this.mass -= 0.05 * dt; 
        this.mass = Math.max(this.mass, 0.01); 
        
        // 2. منطقياً: الغلاف الخارجي ثابت، لن نغير نصف القطر (this.radius)
        
        // 3. تحديث عزم القصور الذاتي لأن الكتلة تناقصت مع ثبات نصف القطر
        this.inertia = (2 / 5) * this.mass * this.radius * this.radius;


        }
    }

    resetForces() {
        this.netForce.set(0, 0, 0);
        this.torque.set(0, 0, 0);
    }
}