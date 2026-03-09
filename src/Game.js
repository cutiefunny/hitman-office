import Phaser from 'phaser';

export default function createGame(containerId) {
    let waypoints = [
        { x: 700, y: 100 }, // 상단
        { x: 700, y: 500 }  // 하단
    ];
    let currentWaypointIndex = 0;

    const config = {
        type: Phaser.AUTO,
        parent: containerId,
        width: 800,
        height: 600,
        backgroundColor: '#111',
        physics: {
            default: 'arcade',
            arcade: {
                debug: false,
                gravity: { y: 0 }
            }
        },
        scene: {
            create: function () {
                // 작전 상태 변수
                this.selectedAgent = null;
                this.killer1Dest = null;
                this.isAttacking = false;
                this.targetHits = 0;
                this.lastHitTime = 0;
                this.gameEnded = false;

                // 오퍼레이터 화면 텍스트
                this.statusText = this.add.text(10, 10, "[ 위성 해킹: 작전 구역 모니터링 ]", {
                    fill: '#0f0',
                    fontFamily: 'monospace',
                    fontSize: '18px'
                });

                // --- 킬러1 ---
                this.killer1 = this.add.rectangle(100, 300, 32, 32, 0x00ff00);
                this.killer1.setStrokeStyle(2, 0x00ff00);
                this.physics.add.existing(this.killer1);
                this.killer1Label = this.add.text(75, 325, "KILLER 1", { fill: '#0f0', fontSize: '12px', fontFamily: 'monospace' });

                // 킬러1 인터랙티브 설정
                this.killer1.setInteractive({ useHandCursor: true });

                // --- 타겟 ---
                this.target = this.add.rectangle(waypoints[0].x, waypoints[0].y, 32, 32, 0xff0000);
                this.target.setStrokeStyle(2, 0xff0000);
                this.physics.add.existing(this.target);
                this.targetLabel = this.add.text(waypoints[0].x - 25, waypoints[0].y + 20, "TARGET", { fill: '#f00', fontSize: '12px', fontFamily: 'monospace' });

                // 타겟 인터랙티브 설정 (공격 명령용)
                this.target.setInteractive({ useHandCursor: true });

                // 통합 클릭 핸들러
                this.input.on('pointerdown', (pointer, gameObjects) => {
                    if (this.gameEnded) return;

                    if (gameObjects.length > 0) {
                        const clicked = gameObjects[0];

                        // 1. 킬러1 선택
                        if (clicked === this.killer1) {
                            this.selectedAgent = this.killer1;
                            this.killer1.setStrokeStyle(4, 0xffffff);
                            return;
                        }

                        // 2. 타겟 공격 명령
                        if (clicked === this.target && this.selectedAgent === this.killer1) {
                            this.isAttacking = true;
                            this.killer1Dest = null;
                            this.selectedAgent = null;
                            this.killer1.setStrokeStyle(2, 0x00ff00);
                            this.statusText.setText("[ 위성 해킹: 타겟 제거 명령 하달 ]");
                            this.statusText.setFill('#f00');
                            return;
                        }
                    }

                    // 3. 빈 화면 클릭 시 일반 이동 명령
                    if (this.selectedAgent === this.killer1) {
                        this.killer1Dest = { x: pointer.worldX, y: pointer.worldY };
                        this.isAttacking = false;
                        this.selectedAgent = null;
                        this.killer1.setStrokeStyle(2, 0x00ff00);
                        this.statusText.setText("[ 위성 해킹: 지점 이동 중 ]");
                        this.statusText.setFill('#0f0');
                    }
                });

                // --- 공격 효과 (선) ---
                this.attackLine = this.add.graphics();
            },
            update: function (time) {
                if (this.gameEnded) return;

                const targetNormalSpeed = 100;
                const targetFleeSpeed = 180;
                const killerSpeed = 150;
                const attackRange = 100;
                const detectionRange = 250; // 타겟의 킬러 감지 범위

                // --- 타겟 행동 제어 ---
                if (this.target && this.target.body) {
                    const distToKiller = Phaser.Math.Distance.Between(this.target.x, this.target.y, this.killer1.x, this.killer1.y);

                    if (distToKiller < detectionRange) {
                        // [도망 모드] 킬러로부터 반대 방향으로 이동
                        const angle = Phaser.Math.Angle.Between(this.killer1.x, this.killer1.y, this.target.x, this.target.y);
                        this.target.body.setVelocity(
                            Math.cos(angle) * targetFleeSpeed,
                            Math.sin(angle) * targetFleeSpeed
                        );

                        // 화면 경계 밖으로 나가지 않도록 제한 (Clamp)
                        this.target.x = Phaser.Math.Clamp(this.target.x, 20, 780);
                        this.target.y = Phaser.Math.Clamp(this.target.y, 20, 580);

                        this.targetLabel.setText("CAUTION: EVADING");
                        this.targetLabel.setFill('#ff0');
                    } else {
                        // [순찰 모드] 기존 루틴 수행
                        const dest = waypoints[currentWaypointIndex];
                        const distToDest = Phaser.Math.Distance.Between(this.target.x, this.target.y, dest.x, dest.y);

                        if (distToDest < 5) {
                            this.target.body.reset(dest.x, dest.y);
                            currentWaypointIndex = (currentWaypointIndex + 1) % waypoints.length;
                        } else {
                            this.physics.moveToObject(this.target, dest, targetNormalSpeed);
                        }
                        this.targetLabel.setText("TARGET");
                        this.targetLabel.setFill('#f00');
                    }
                    this.targetLabel.setPosition(this.target.x - 25, this.target.y + 20);
                }

                // --- 킬러1 행동 처리 ---
                if (this.killer1 && this.killer1.body) {
                    this.attackLine.clear();

                    if (this.isAttacking && this.target && this.target.active) {
                        const distToTarget = Phaser.Math.Distance.Between(this.killer1.x, this.killer1.y, this.target.x, this.target.y);

                        if (distToTarget <= attackRange) {
                            this.killer1.body.setVelocity(0, 0);

                            if (time > this.lastHitTime + 500) {
                                this.targetHits++;
                                this.lastHitTime = time;

                                if (this.targetHits >= 5) {
                                    this.target.destroy();
                                    this.targetLabel.destroy();
                                    this.isAttacking = false;
                                    this.gameEnded = true;
                                    this.statusText.setText("[ TARGET NEUTRALIZED: MISSION ACCOMPLISHED ]");
                                    this.statusText.setFill('#0f0');
                                    this.add.text(400, 300, "DEFEAT", { fontSize: '64px', fill: '#f00', fontFamily: 'monospace', fontWeight: 'bold' }).setOrigin(0.5);
                                    this.killer1.body.setVelocity(0, 0);
                                    return;
                                }
                            }

                            if (Phaser.Math.Between(0, 10) > 4) {
                                this.attackLine.lineStyle(2, 0x00ff00, 1);
                                this.attackLine.lineBetween(this.killer1.x, this.killer1.y, this.target.x, this.target.y);
                                this.target.setStrokeStyle(4, 0xffffff);
                            } else {
                                this.target.setStrokeStyle(2, 0xff0000);
                            }
                        } else {
                            this.physics.moveToObject(this.killer1, this.target, killerSpeed);
                            this.target.setStrokeStyle(2, 0xff0000);
                        }
                    } else if (this.killer1Dest) {
                        const dist = Phaser.Math.Distance.Between(this.killer1.x, this.killer1.y, this.killer1Dest.x, this.killer1Dest.y);
                        if (dist < 5) {
                            this.killer1.body.reset(this.killer1Dest.x, this.killer1Dest.y);
                            this.killer1Dest = null;
                            this.killer1.body.setVelocity(0, 0);
                        } else {
                            this.physics.moveToObject(this.killer1, this.killer1Dest, killerSpeed);
                        }
                    } else {
                        this.killer1.body.setVelocity(0, 0);
                    }

                    if (this.killer1Label && this.killer1Label.active) {
                        this.killer1Label.setPosition(this.killer1.x - 25, this.killer1.y + 20);
                    }
                }
            }
        }
    };

    return new Phaser.Game(config);
}