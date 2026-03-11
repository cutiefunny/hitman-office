import Phaser from 'phaser';

export default class CombatSystem {
    constructor(scene) {
        this.scene = scene;
        this.sharedLine = new Phaser.Geom.Line();
        this.intersectionArray = [];
    }

    showFloatingText(x, y, text, color) {
        const floatText = this.scene.add.text(x, y - 20, text, {
            fontSize: '16px',
            fontFamily: 'monospace',
            fill: color,
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.scene.tweens.add({
            targets: floatText,
            y: y - 50,
            alpha: 0,
            duration: 800,
            onComplete: () => floatText.destroy()
        });
    }

    fireShotgun(agent, target, hitAngle, currentAttackRange) {
        const bulletCount = 5;
        this.scene.cameras.main.shake(100, 0.015);

        const flashX = agent.x + Math.cos(hitAngle) * 20;
        const flashY = agent.y + Math.sin(hitAngle) * 20;
        const flash = this.scene.add.circle(flashX, flashY, 12, 0xffff00);
        this.scene.tweens.add({ targets: flash, alpha: 0, scale: 0.2, duration: 80, onComplete: () => flash.destroy() });

        const spread = Math.PI / 6;
        const maxBulletDist = 1500;

        for (let i = 0; i < bulletCount; i++) {
            const angleOffset = hitAngle - (spread / 2) + (spread * (i / (bulletCount - 1)));
            const farX = agent.x + Math.cos(angleOffset) * maxBulletDist;
            const farY = agent.y + Math.sin(angleOffset) * maxBulletDist;

            this.sharedLine.setTo(agent.x, agent.y, farX, farY);

            let targetDestX = farX;
            let targetDestY = farY;
            let minDist = maxBulletDist;

            for (let wall of this.scene.cachedWallBounds) {
                this.intersectionArray.length = 0;
                if (Phaser.Geom.Intersects.GetLineToRectangle(this.sharedLine, wall, this.intersectionArray)) {
                    for (let p of this.intersectionArray) {
                        const d = Phaser.Math.Distance.Between(agent.x, agent.y, p.x, p.y);
                        if (d < minDist) {
                            minDist = d;
                            targetDestX = p.x;
                            targetDestY = p.y;
                        }
                    }
                }
            }

            const bullet = this.scene.add.rectangle(agent.x, agent.y, 15, 3, 0xffdd00);
            bullet.rotation = angleOffset;

            const duration = (minDist / 800) * 150;

            this.scene.tweens.add({
                targets: bullet,
                x: targetDestX,
                y: targetDestY,
                duration: duration,
                onComplete: () => {
                    bullet.destroy();
                    if (Math.random() > 0.3) {
                        const hitSpark = this.scene.add.circle(bullet.x, bullet.y, Phaser.Math.Between(4, 7), 0xffaa00);
                        this.scene.tweens.add({ targets: hitSpark, alpha: 0, scale: 1.5, duration: 150, onComplete: () => hitSpark.destroy() });
                    }
                }
            });
        }

        const stats = agent.stats || { damage: 100, accuracy: 80 };
        const isHit = Phaser.Math.Between(1, 100) <= stats.accuracy;

        if (!isHit) {
            this.showFloatingText(target.x, target.y - 20, "MISS", "#ffffff");
        } else {
            const baseDamage = stats.damage;
            const finalDamage = baseDamage + Phaser.Math.Between(-20, 20); // 데미지 변동
            target.hp -= finalDamage;
            this.showFloatingText(target.x, target.y - 20, `-${finalDamage}`, "#ff0000");

            // 샷건 적중 시 타겟에서 튀는 피 이펙트
            for (let i = 0; i < 4; i++) {
                const blood = this.scene.add.circle(target.x, target.y, Phaser.Math.Between(3, 6), 0xff0000);
                const spreadAngle = hitAngle + (Math.random() - 0.5) * spread; // 산탄 퍼짐 방향에 맞춰 피도 날아감
                const speed = Phaser.Math.Between(80, 200);

                this.scene.tweens.add({
                    targets: blood,
                    x: blood.x + Math.cos(spreadAngle) * speed,
                    y: blood.y + Math.sin(spreadAngle) * speed,
                    alpha: 0,
                    duration: 250,
                    ease: 'Cubic.easeOut',
                    onComplete: () => blood.destroy()
                });
            }
        }

        // 반동 (Recoil)
        agent.x -= Math.cos(hitAngle) * 5;
        agent.y -= Math.sin(hitAngle) * 5;
    }

    performMelee(agent, target, hitAngle, time) {
        const stats = agent.stats || { damage: 30, accuracy: 100 };
        const isHit = Phaser.Math.Between(1, 100) <= stats.accuracy;

        if (!isHit) {
            this.showFloatingText(target.x, target.y - 20, "MISS", "#ffffff");
            return; // 빗나갈 경우 스턴 및 이펙트 생략
        }

        const baseDamage = stats.damage;
        const finalDamage = baseDamage + Phaser.Math.Between(-5, 5); // 데미지 변동
        target.hp -= finalDamage;
        this.showFloatingText(target.x, target.y - 20, `-${finalDamage}`, "#ff0000");

        const wasStunned = target.stunTime && time < target.stunTime;
        target.stunTime = time + 1000;

        if (!wasStunned) {
            target.body.setVelocity(Math.cos(hitAngle) * 500, Math.sin(hitAngle) * 500);
        }

        this.scene.cameras.main.shake(150, 0.025);

        agent.x += Math.cos(hitAngle) * 15;
        agent.y += Math.sin(hitAngle) * 15;

        const slashColor = 0x00ffff;
        const slash1 = this.scene.add.rectangle(target.x, target.y, 50, 4, slashColor);
        slash1.rotation = hitAngle + Math.PI / 4;
        const slash2 = this.scene.add.rectangle(target.x, target.y, 50, 4, slashColor);
        slash2.rotation = hitAngle - Math.PI / 4;

        this.scene.tweens.add({
            targets: [slash1, slash2],
            scaleX: 1.5,
            scaleY: 0.1,
            alpha: 0,
            duration: 150,
            ease: 'Expo.easeOut',
            onComplete: () => { slash1.destroy(); slash2.destroy(); }
        });

        for (let i = 0; i < 6; i++) {
            const blood = this.scene.add.circle(target.x, target.y, Phaser.Math.Between(4, 8), 0xff0000);
            const spreadAngle = hitAngle + (Math.random() - 0.5) * Math.PI;
            const speed = Phaser.Math.Between(50, 150);

            this.scene.tweens.add({
                targets: blood,
                x: blood.x + Math.cos(spreadAngle) * speed,
                y: blood.y + Math.sin(spreadAngle) * speed,
                alpha: 0,
                duration: 300,
                ease: 'Cubic.easeOut',
                onComplete: () => blood.destroy()
            });
        }
    }

    firePistol(agent, target, hitAngle) {
        this.scene.cameras.main.shake(50, 0.01);

        const flashX = agent.x + Math.cos(hitAngle) * 20;
        const flashY = agent.y + Math.sin(hitAngle) * 20;
        const flash = this.scene.add.circle(flashX, flashY, 8, 0xffff00);
        this.scene.tweens.add({ targets: flash, alpha: 0, scale: 0.2, duration: 60, onComplete: () => flash.destroy() });

        const maxBulletDist = 1000;
        const farX = agent.x + Math.cos(hitAngle) * maxBulletDist;
        const farY = agent.y + Math.sin(hitAngle) * maxBulletDist;

        this.sharedLine.setTo(agent.x, agent.y, farX, farY);

        let targetDestX = farX;
        let targetDestY = farY;
        let minDist = maxBulletDist;

        let hitTarget = false;
        if (target && target.active && target.hp > 0) {
            const targetBounds = target.getBounds();
            this.intersectionArray.length = 0;
            if (Phaser.Geom.Intersects.GetLineToRectangle(this.sharedLine, targetBounds, this.intersectionArray)) {
                for (let p of this.intersectionArray) {
                    const d = Phaser.Math.Distance.Between(agent.x, agent.y, p.x, p.y);
                    if (d < minDist) {
                        minDist = d;
                        targetDestX = p.x;
                        targetDestY = p.y;
                        hitTarget = true;
                    }
                }
            }
        }

        for (let wall of this.scene.cachedWallBounds) {
            this.intersectionArray.length = 0;
            if (Phaser.Geom.Intersects.GetLineToRectangle(this.sharedLine, wall, this.intersectionArray)) {
                for (let p of this.intersectionArray) {
                    const d = Phaser.Math.Distance.Between(agent.x, agent.y, p.x, p.y);
                    if (d < minDist) {
                        minDist = d;
                        targetDestX = p.x;
                        targetDestY = p.y;
                        hitTarget = false; // 벽에 먼저 부딪힘
                    }
                }
            }
        }

        const bullet = this.scene.add.rectangle(agent.x, agent.y, 10, 2, 0xffaa00);
        bullet.rotation = hitAngle;

        const duration = (minDist / 800) * 120;

        this.scene.tweens.add({
            targets: bullet,
            x: targetDestX,
            y: targetDestY,
            duration: duration,
            onComplete: () => {
                bullet.destroy();
                const hitSpark = this.scene.add.circle(bullet.x, bullet.y, Phaser.Math.Between(3, 5), 0xffff00);
                this.scene.tweens.add({ targets: hitSpark, alpha: 0, scale: 1.5, duration: 100, onComplete: () => hitSpark.destroy() });

                // 총알 도착 시 피격/명중 판정
                if (hitTarget) {
                    const stats = agent.stats || { damage: 100, accuracy: 100 };
                    const isHit = Phaser.Math.Between(1, 100) <= stats.accuracy;

                    if (!isHit) {
                        this.showFloatingText(target.x, target.y - 20, "MISS", "#ffffff");
                    } else {
                        const finalDamage = stats.damage + Phaser.Math.Between(-10, 10);
                        target.hp -= finalDamage;
                        this.showFloatingText(target.x, target.y - 20, `-${finalDamage}`, "#ff0000");

                        // 피 이펙트
                        for (let i = 0; i < 4; i++) {
                            const blood = this.scene.add.circle(target.x, target.y, Phaser.Math.Between(3, 6), 0xff0000);
                            const spreadAngle = hitAngle + (Math.random() - 0.5) * Math.PI / 2;
                            const speed = Phaser.Math.Between(50, 150);

                            this.scene.tweens.add({
                                targets: blood,
                                x: blood.x + Math.cos(spreadAngle) * speed,
                                y: blood.y + Math.sin(spreadAngle) * speed,
                                alpha: 0,
                                duration: 250,
                                ease: 'Cubic.easeOut',
                                onComplete: () => blood.destroy()
                            });
                        }
                    }
                }
            }
        });

        // 반동
        agent.x -= Math.cos(hitAngle) * 3;
        agent.y -= Math.sin(hitAngle) * 3;
    }
}
