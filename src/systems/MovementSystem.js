import Phaser from 'phaser';

export default class MovementSystem {
    constructor(scene) {
        this.scene = scene;
        this.avoidanceOffsets = [];
        for (let i = 0; i < 16; i++) {
            const offset = (i % 2 === 0 ? 1 : -1) * Math.floor(i / 2) * (Math.PI / 8);
            this.avoidanceOffsets.push(offset);
        }
        this.checkPoints = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
    }

    moveWithAvoidance(actor, targetPos, speed, fleeFrom = null) {
        if (!actor || !actor.body) return;

        const baseAngle = fleeFrom
            ? Phaser.Math.Angle.Between(fleeFrom.x, fleeFrom.y, actor.x, actor.y)
            : Phaser.Math.Angle.Between(actor.x, actor.y, targetPos.x, targetPos.y);

        const sensorDist = fleeFrom ? 80 : 50;
        let bestAngle = baseAngle;
        let maxScore = -Infinity;
        let foundPath = false;

        if (actor.lastValidAngle === undefined) actor.lastValidAngle = baseAngle;
        const currentVelAngle = actor.body.speed > 5 ? Math.atan2(actor.body.velocity.y, actor.body.velocity.x) : actor.lastValidAngle;

        for (let i = 0; i < this.avoidanceOffsets.length; i++) {
            const testAngle = baseAngle + this.avoidanceOffsets[i];
            const cos = Math.cos(testAngle);
            const sin = Math.sin(testAngle);

            this.checkPoints[0].x = actor.x + cos * sensorDist;
            this.checkPoints[0].y = actor.y + sin * sensorDist;

            this.checkPoints[1].x = actor.x + cos * (sensorDist - 10) + sin * 18;
            this.checkPoints[1].y = actor.y + sin * (sensorDist - 10) - cos * 18;

            this.checkPoints[2].x = actor.x + cos * (sensorDist - 10) - sin * 18;
            this.checkPoints[2].y = actor.y + sin * (sensorDist - 10) + cos * 18;

            let blocked = false;
            for (let p of this.checkPoints) {
                for (let wall of this.scene.cachedWallBounds) {
                    if (wall.contains(p.x, p.y)) {
                        blocked = true;
                        break;
                    }
                }
                if (blocked) break;
                if (p.x < 30 || p.x > 770 || p.y < 30 || p.y > 570) {
                    blocked = true;
                    break;
                }
            }

            if (!blocked) {
                let score = 0;
                const inertiaDiff = Math.abs(Phaser.Math.Angle.Wrap(testAngle - currentVelAngle));

                if (fleeFrom) {
                    score = (this.avoidanceOffsets.length - i) * 80;
                    score += (Math.PI - inertiaDiff) * 150;
                    const distToCenter = Phaser.Math.Distance.Between(this.checkPoints[0].x, this.checkPoints[0].y, 400, 300);
                    score += (800 - distToCenter) * 0.5;

                    if (score > maxScore) {
                        maxScore = score;
                        bestAngle = testAngle;
                        foundPath = true;
                    }
                } else {
                    score = (this.avoidanceOffsets.length - i) * 100;
                    score += (Math.PI - inertiaDiff) * 80;

                    if (targetPos) {
                        const distToTarget = Phaser.Math.Distance.Between(this.checkPoints[0].x, this.checkPoints[0].y, targetPos.x, targetPos.y);
                        score -= distToTarget * 1.5;
                    }

                    // Tactical Flanking Check
                    let otherKiller = null;
                    if (actor === this.scene.killer1) otherKiller = this.scene.killer2;
                    else if (actor === this.scene.killer2) otherKiller = this.scene.killer1;

                    if (otherKiller && otherKiller.active) {
                        const distToOther = Phaser.Math.Distance.Between(actor.x, actor.y, otherKiller.x, otherKiller.y);
                        if (distToOther < 250) {
                            const angleToOther = Phaser.Math.Angle.Between(actor.x, actor.y, otherKiller.x, otherKiller.y);
                            const angleDiffToOther = Math.abs(Phaser.Math.Angle.Wrap(testAngle - angleToOther));
                            score -= (Math.PI - angleDiffToOther) * 80;

                            if (distToOther < 120) {
                                score -= (Math.PI - angleDiffToOther) * 250;
                            }
                        }
                    }

                    if (score > maxScore) {
                        maxScore = score;
                        bestAngle = testAngle;
                        foundPath = true;
                    }

                    if (i === 0) break;
                }
            }
        }

        if (!foundPath) {
            if (fleeFrom) {
                const angleToCenter = Phaser.Math.Angle.Between(actor.x, actor.y, 400, 300);
                actor.body.setVelocity(Math.cos(angleToCenter) * speed, Math.sin(angleToCenter) * speed);
                actor.lastValidAngle = angleToCenter;
            } else {
                const slideAngle = currentVelAngle + (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
                actor.body.setVelocity(Math.cos(slideAngle) * (speed * 0.5), Math.sin(slideAngle) * (speed * 0.5));
                actor.lastValidAngle = slideAngle;
            }
            return;
        }

        actor.lastValidAngle = bestAngle;
        actor.body.setVelocity(Math.cos(bestAngle) * speed, Math.sin(bestAngle) * speed);
    }
}
