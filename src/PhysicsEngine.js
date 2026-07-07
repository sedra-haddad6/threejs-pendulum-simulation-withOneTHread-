import { PhysicsVector } from './PhysicsVector.js';

export class PhysicsEngine {
    constructor() {
        this.g = 9.81;

        // كثافة الهواء ρ (kg/m³) - خاصية الوسط المحيط، تتحكم بها سلايدر "مقاومة الهواء"
        // عند 0 => فراغ تام => لا قوة سحب إطلاقاً => حفظ كامل للطاقة (بلا أي "تخميد" مصطنع)
        this.airDensity = 1.225;

        this.suspensionY = 1.8;
    }

    computeForces(balls, isFullyInelastic) {
        balls.forEach(ball => {
            ball.resetForces();

            // 1. الجاذبية: القوة الوحيدة التي تحدد "الثقل" - إن كانت g=0 تصبح الكرة عديمة الوزن
            const gravityY = -this.g * ball.mass;
            ball.netForce.add(new PhysicsVector(0, gravityY, 0));

            // 2. مقاومة الهواء الحقيقية: Fd = 0.5 * ρ * v² * Cd * A (قانون الكرة في وسط لزج)
            const velocityMagnitude = ball.velocity.length();
            let dragForce = new PhysicsVector(0, 0, 0);
            
            if (velocityMagnitude > 1e-6 && this.airDensity > 0) {
                const crossSectionalArea = Math.PI * ball.radius * ball.radius;
                const dragMagnitude = 0.5 * this.airDensity * velocityMagnitude * velocityMagnitude * ball.dragCoefficient * crossSectionalArea;
                dragForce = ball.velocity.clone().normalize().multiplyScalar(-dragMagnitude);
                ball.netForce.add(dragForce);
            }

            // -----------------------------------------------------------------
            // إضافة فيزيائية حقيقية: قانون الاضطراب الجوي الحراري (معادلة لورانجفين المبسطة)
            // عندما تنعدم الجاذبية، جزيئات الهواء المحيطة لا تتوقف بل تصطدم بالكرة وتجعلها تطفو وتتحرك
            if (this.g === 0 && this.airDensity > 0) {
                const crossSectionalArea = Math.PI * ball.radius * ball.radius;
                // معامل تخميد الوسط المرتبط بشكل طردي بكثافة الهواء ومساحة سطح الكرة
                const gamma = 0.5 * this.airDensity * ball.dragCoefficient * crossSectionalArea;
                
                // شدة الاضطراب الحراري (تتناسب مع حجم الكرة وكثافة الغاز المحيط)
                const thermalIntensity = Math.sqrt(gamma * 0.1); 

                // توليد قوى نبضية دقيقة عشوائية الاتجاه تحاكي حركة الجزيئات العشوائية (الحركة البراونية)
                const fThermalX = (Math.random() - 0.5) * thermalIntensity;
                const fThermalY = (Math.random() - 0.5) * thermalIntensity;
                const fThermalZ = (Math.random() - 0.5) * thermalIntensity;

                ball.netForce.add(new PhysicsVector(fThermalX, fThermalY, fThermalZ));
            }
            // -----------------------------------------------------------------

            if (ball.isRopeSnapped) return;

            // 3. قوة الشد بالخيط: تُحسب من قانون نيوتن الثاني مسقطاً على اتجاه الخيط
            const ropeVector = new PhysicsVector(
                ball.position.x - ball.suspension.x,
                ball.position.y - this.suspensionY,
                ball.position.z - ball.suspension.z
            );

            const currentLength = ropeVector.length();
            if (currentLength > 1e-9) {
                const rHat = ropeVector.clone().normalize();

                // تفكيك السرعة إلى مركبة شعاعية ومركبة مماسية
                const vRadial = ball.velocity.dot(rHat);
                const vTangentialSq = Math.max(0, ball.velocity.lengthSq() - vRadial * vRadial);

                // مجموع القوى غير الشد مسقطة على اتجاه الخيط (للخارج موجب)
                // تم إدخال محصلة القوى بالكامل (بما فيها الاضطراب الحراري الجديد) لضمان دقة الشد وحفظ المسافة
                const nonTensionRadialComponent = ball.netForce.dot(rHat);

                // T = (القوى غير الشد باتجاه الخارج) + m*v_t²/L
                let tensionMagnitude = nonTensionRadialComponent + (ball.mass * vTangentialSq) / ball.length;

                // الخيط لا يمكن أن "يدفع" - فقط يشد
                if (tensionMagnitude > 0) {
                    const tensionForce = rHat.clone().multiplyScalar(-tensionMagnitude);
                    ball.netForce.add(tensionForce);
                }
            }
        });

        this.resolveCollisions(balls, isFullyInelastic);
    }

    resolveCollisions(balls, isFullyInelastic) {
        const restitution = isFullyInelastic ? 0.0 : 1.0;

        for (let i = 0; i < balls.length; i++) {
            for (let j = i + 1; j < balls.length; j++) {
                const b1 = balls[i];
                const b2 = balls[j];

                const dx = b2.position.x - b1.position.x;
                const dy = b2.position.y - b1.position.y;
                const dz = b2.position.z - b1.position.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                const minDistance = b1.radius + b2.radius;

                if (distance < minDistance && distance > 1e-9) {
                    const nx = dx / distance;
                    const ny = dy / distance;
                    const nz = dz / distance;

                    const rvx = b2.velocity.x - b1.velocity.x;
                    const rvy = b2.velocity.y - b1.velocity.y;
                    const rvz = b2.velocity.z - b1.velocity.z;
                    const velAlongNormal = rvx * nx + rvy * ny + rvz * nz;

                    if (velAlongNormal < 0) {
                        const impulseMagnitude = -(1.0 + restitution) * velAlongNormal / ((1.0 / b1.mass) + (1.0 / b2.mass));

                        b1.velocity.x -= (impulseMagnitude / b1.mass) * nx;
                        b1.velocity.y -= (impulseMagnitude / b1.mass) * ny;
                        b1.velocity.z -= (impulseMagnitude / b1.mass) * nz;

                        b2.velocity.x += (impulseMagnitude / b2.mass) * nx;
                        b2.velocity.y += (impulseMagnitude / b2.mass) * ny;
                        b2.velocity.z += (impulseMagnitude / b2.mass) * nz;

                        const contactArm = new PhysicsVector(dx * 0.5, dy * 0.5, dz * 0.5);
                        const impulseForce1 = new PhysicsVector(
                            (impulseMagnitude / b1.mass) * nx,
                            (impulseMagnitude / b1.mass) * ny,
                            (impulseMagnitude / b1.mass) * nz
                        );
                        const torque1 = contactArm.cross(impulseForce1);

                        b1.torque.add(torque1);
                        b2.torque.sub(torque1);





// // بعد حساب velAlongNormal والimpulse العادي...
// const frictionCoeff = 0.1; // معامل احتكاك سطحي بين الكرتين

// // السرعة النسبية المماسية (طرح المركبة العمودية)
// const tangentialVx = rvx - velAlongNormal * nx;
// const tangentialVy = rvy - velAlongNormal * ny;
// const tangentialVz = rvz - velAlongNormal * nz;
// const tangentialSpeed = Math.sqrt(tangentialVx**2 + tangentialVy**2 + tangentialVz**2);

// if (tangentialSpeed > 1e-6) {
//     const tHat = new PhysicsVector(tangentialVx, tangentialVy, tangentialVz).normalize();
//     const frictionImpulse = frictionCoeff * Math.abs(impulseMagnitude);
//     const fImpX = -frictionImpulse * tHat.x;
//     const fImpY = -frictionImpulse * tHat.y;
//     const fImpZ = -frictionImpulse * tHat.z;
//     // هاي القوة المماسية عمودية على contactArm → cross product ما بيطلع صفر
//     const frictionForce1 = new PhysicsVector(fImpX / b1.mass, fImpY / b1.mass, fImpZ / b1.mass);
//     const torqueFromFriction = contactArm.cross(frictionForce1);
//     b1.torque.add(torqueFromFriction);
//     b2.torque.sub(torqueFromFriction);
// }







                        


                        
                        const overlap = minDistance - distance;
                        const pushDistance = overlap * 0.5;
                        b1.position.x -= pushDistance * nx;
                        b1.position.y -= pushDistance * ny;
                        b1.position.z -= pushDistance * nz;
                        b2.position.x += pushDistance * nx;
                        b2.position.y += pushDistance * ny;
                        b2.position.z += pushDistance * nz;
                    }
                }
            }
        }

    }

    integrate(balls, dt) {
        balls.forEach(ball => {
            // F = m.a
            ball.acceleration.set(
                ball.netForce.x / ball.mass,
                ball.netForce.y / ball.mass,
                ball.netForce.z / ball.mass
            );

            // تكامل شبه ضمني (Semi-Implicit Euler)
            ball.velocity.x += ball.acceleration.x * dt;
            ball.velocity.y += ball.acceleration.y * dt;
            ball.velocity.z += ball.acceleration.z * dt;

            // قيد طول الخيط الصارم فيزيائياً
            if (!ball.isRopeSnapped) {
                const ropeVector = new PhysicsVector(
                    ball.position.x - ball.suspension.x,
                    ball.position.y - this.suspensionY,
                    ball.position.z - ball.suspension.z
                );

                const len = ropeVector.length();
                if (len > 1e-9) {
                    const rHat = ropeVector.clone().normalize();

                    // إزالة أي مركبة سرعة على طول الخيط تماماً (الحركة مماسية بحتة)
                    const vRadial = ball.velocity.dot(rHat);
                    ball.velocity.x -= vRadial * rHat.x;
                    ball.velocity.y -= vRadial * rHat.y;
                    ball.velocity.z -= vRadial * rHat.z;
                }
            }

            // تحديث الموضع بناءً على السرعة المماسية المصححة
            ball.position.x += ball.velocity.x * dt;
            ball.position.y += ball.velocity.y * dt;
            ball.position.z += ball.velocity.z * dt;

            // إعادة ضبط الموضع ليكون على سطح الكرة (طول الخيط الثابت) بدقة
            if (!ball.isRopeSnapped) {
                const ropeVector = new PhysicsVector(
                    ball.position.x - ball.suspension.x,
                    ball.position.y - this.suspensionY,
                    ball.position.z - ball.suspension.z
                );
                const len = ropeVector.length();
                if (len > 1e-9) {
                    const rHat = ropeVector.clone().normalize();
                    ball.position.x = ball.suspension.x + rHat.x * ball.length;
                    ball.position.y = this.suspensionY + rHat.y * ball.length;
                    ball.position.z = ball.suspension.z + rHat.z * ball.length;
                }
            }

            // العزم الدوراني
            if (ball.inertia > 0) {
                ball.angularAcceleration.set(
                    ball.torque.x / ball.inertia,
                    ball.torque.y / ball.inertia,
                    ball.torque.z / ball.inertia
                );
                ball.angularVelocity.x += ball.angularAcceleration.x * dt;
                ball.angularVelocity.y += ball.angularAcceleration.y * dt;
                ball.angularVelocity.z += ball.angularAcceleration.z * dt;
            }
        });
    }
}