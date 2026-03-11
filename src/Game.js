import Phaser from 'phaser';

import MovementSystem from './systems/MovementSystem';
import VisionSystem from './systems/VisionSystem';
import CombatSystem from './systems/CombatSystem';

import mapUrl from './assets/maps/hitman1.json?url';
import streetUrl from './assets/maps/street1.jpg';
import { getKillers, getTargetConfig } from './data/AgentConfig';

export default function createGame(containerId) {
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
            preload: function () {
                this.load.image('street', streetUrl);
                this.load.tilemapTiledJSON('map', mapUrl);
            },
            create: function () {
                // 작전 상태 변수
                this.selectedAgent = null;
                this.killer1Dest = null;
                this.killer2Dest = null;
                this.isAttacking1 = false;
                this.isAttacking2 = false;
                this.targetHits = 0;
                this.lastHitTime = 0;
                this.lastTargetHitTime = 0;
                this.gameEnded = false;
                this.isDragRotating = false;
                this.viewedAgent = null; // 선택된 요원 정보 표출용

                // 하위 시스템(매니저) 인스턴스화
                this.movementSystem = new MovementSystem(this);
                this.visionSystem = new VisionSystem(this);
                this.combatSystem = new CombatSystem(this);

                // 타일맵 로드
                const map = this.make.tilemap({ key: 'map' });
                const tileset = map.addTilesetImage('street', 'street');
                map.createLayer('Ground', tileset, 0, 0);

                // Start/Target 구역 데이터 로드
                this.startArea = { x: 0, y: 0, width: 800, height: 600 };
                const startLayer = map.getObjectLayer('Start');
                if (startLayer && startLayer.objects.length > 0) this.startArea = startLayer.objects[0];

                this.targetArea = { x: 0, y: 0, width: 800, height: 600 };
                const targetLayer = map.getObjectLayer('Target');
                if (targetLayer && targetLayer.objects.length > 0) this.targetArea = targetLayer.objects[0];
                this.targetDest = null;

                // 벽(장애물) 생성 (Blocks 레이어)
                this.walls = this.physics.add.staticGroup();
                const blocksLayer = map.getObjectLayer('Blocks');
                if (blocksLayer && blocksLayer.objects) {
                    blocksLayer.objects.forEach(obj => {
                        const wall = this.add.rectangle(obj.x + obj.width / 2, obj.y + obj.height / 2, obj.width, obj.height, 0x555555, 0); // 0 = alpha (투명)
                        this.walls.add(wall);
                    });
                }

                // 최적화: 충돌 판정용 Rect 캐싱
                this.cachedWallBounds = this.walls.getChildren().map(wall => wall.getBounds());

                // 오퍼레이터 화면 텍스트
                this.statusText = this.add.text(10, 10, "[ 위성 해킹: 작전 구역 모니터링 ]", {
                    fill: '#0f0',
                    fontFamily: 'monospace',
                    fontSize: '18px'
                });

                // === 요원 & 타겟 데이터 불러오기 ===
                const killersData = getKillers();
                const targetData = getTargetConfig();

                this.killer1 = this.add.rectangle(this.startArea.x, this.startArea.y, 32, 32, killersData[0].color);
                this.killer1.setStrokeStyle(2, killersData[0].color);
                this.physics.add.existing(this.killer1);
                this.killer1.body.setCollideWorldBounds(true);
                this.killer1.hp = killersData[0].hp;
                this.killer1.stats = { ...killersData[0].stats };
                this.killer1Label = this.add.text(75, 225, `${killersData[0].name} [HP: ${this.killer1.hp}]`, { fill: '#0f0', fontSize: '12px', fontFamily: 'monospace' });
                this.killer1.setInteractive({ useHandCursor: true });
                this.killer1.setActive(false).setVisible(false);
                this.killer1.body.enable = false;
                this.killer1Label.setActive(false).setVisible(false);

                this.killer2 = this.add.rectangle(this.startArea.x, this.startArea.y, 32, 32, killersData[1].color);
                this.killer2.setStrokeStyle(2, killersData[1].color);
                this.physics.add.existing(this.killer2);
                this.killer2.body.setCollideWorldBounds(true);
                this.killer2.hp = killersData[1].hp;
                this.killer2.stats = { ...killersData[1].stats };
                this.killer2Label = this.add.text(75, 425, `${killersData[1].name} [HP: ${this.killer2.hp}]`, { fill: '#0ff', fontSize: '12px', fontFamily: 'monospace' });
                this.killer2.setInteractive({ useHandCursor: true });
                this.killer2.setActive(false).setVisible(false);
                this.killer2.body.enable = false;
                this.killer2Label.setActive(false).setVisible(false);

                const tx = this.targetArea.x + this.targetArea.width / 2;
                const ty = this.targetArea.y + this.targetArea.height / 2;
                this.target = this.add.rectangle(tx, ty, 32, 32, 0xff0000);
                this.target.setStrokeStyle(2, 0xff0000);
                this.physics.add.existing(this.target);
                this.target.body.setCollideWorldBounds(true);
                this.target.hp = targetData.hp;
                this.target.stats = { ...targetData.stats };
                this.targetLabel = this.add.text(tx - 25, ty + 20, `TARGET [HP: ${this.target.hp}]`, { fill: '#f00', fontSize: '12px', fontFamily: 'monospace' });

                // 콜라이더 설정
                this.physics.add.collider(this.target, this.walls);
                this.physics.add.collider(this.killer1, this.walls);
                this.physics.add.collider(this.killer2, this.walls);
                this.physics.add.collider(this.killer1, this.killer2);
                this.physics.add.collider(this.killer1, this.target);
                this.physics.add.collider(this.killer2, this.target);

                this.target.setInteractive({ useHandCursor: true });

                // 통합 클릭 핸들러
                this.input.on('pointerdown', (pointer, gameObjects) => {
                    if (this.gameEnded) return;

                    if (gameObjects.length > 0) {
                        const clicked = gameObjects[0];

                        // 클릭한 대상이 킬러이거나 타겟일 경우 정보 열람 대상으로 설정
                        if ((clicked === this.killer1 && this.killer1.active) ||
                            (clicked === this.killer2 && this.killer2.active) ||
                            clicked === this.target) {
                            this.viewedAgent = clicked;
                        }

                        if ((clicked === this.killer1 && this.killer1.active) || (clicked === this.killer2 && this.killer2.active)) {
                            this.isDragRotating = true;

                            if (this.selectedAgent === clicked) {
                                let color = clicked === this.killer1 ? 0x00ff00 : 0x00ffff;
                                clicked.setStrokeStyle(2, color);
                                this.selectedAgent = null;
                                this.isDragRotating = false;
                                this.statusText.setText("[ 위성 해킹: 작전 대기 중 ]");
                            } else {
                                if (this.selectedAgent) {
                                    let prevColor = this.selectedAgent === this.killer1 ? 0x00ff00 : 0x00ffff;
                                    this.selectedAgent.setStrokeStyle(2, prevColor);
                                }
                                this.selectedAgent = clicked;
                                clicked.setStrokeStyle(4, 0xffffff);
                                this.statusText.setText(`[ 요원 식별: ${clicked === this.killer1 ? "KILLER 1" : "KILLER 2"} 선택됨 ]`);
                            }
                            return;
                        }

                        if (clicked === this.target && this.selectedAgent) {
                            if (this.selectedAgent === this.killer1) {
                                this.isAttacking1 = true;
                                this.killer1Dest = null;
                            } else {
                                this.isAttacking2 = true;
                                this.killer2Dest = null;
                            }
                            this.statusText.setText(`[ 명령: ${this.selectedAgent === this.killer1 ? "KILLER 1" : "KILLER 2"} 타겟 추격 및 교전 ]`);
                            this.statusText.setFill('#f00');
                            return;
                        }
                    }

                    if (this.selectedAgent) {
                        if (this.selectedAgent === this.killer1) {
                            this.killer1Dest = { x: pointer.worldX, y: pointer.worldY };
                            this.isAttacking1 = false;
                        } else {
                            this.killer2Dest = { x: pointer.worldX, y: pointer.worldY };
                            this.isAttacking2 = false;
                        }
                        this.statusText.setText(`[ 명령: ${this.selectedAgent === this.killer1 ? "KILLER 1" : "KILLER 2"} 지점 이동 하달 ]`);
                        this.statusText.setFill('#0f0');
                    }
                });

                this.input.on('pointerup', () => {
                    this.isDragRotating = false;
                });

                // --- 외부 API ---
                window.commandAutoAttack = () => {
                    if (this.gameEnded) return;
                    if (this.target && this.target.active) {
                        this.isAttacking1 = true;
                        this.killer1Dest = null;
                        this.isAttacking2 = true;
                        this.killer2Dest = null;

                        if (this.selectedAgent) {
                            let color = this.selectedAgent === this.killer1 ? 0x00ff00 : 0x00ffff;
                            this.selectedAgent.setStrokeStyle(2, color);
                            this.selectedAgent = null;
                        }

                        this.statusText.setText(`[ 명령: 전 요원 자율 교전 (SEEK & DESTROY) 개시 ]`);
                        this.statusText.setFill('#f00');
                    }
                };

                window.toggleAgent = (id, isActive) => {
                    if (this.gameEnded) return;
                    let agent = id === 1 ? this.killer1 : this.killer2;
                    let label = id === 1 ? this.killer1Label : this.killer2Label;

                    if (!isActive) {
                        if (this.selectedAgent === agent) {
                            this.selectedAgent.setStrokeStyle(2, id === 1 ? 0x00ff00 : 0x00ffff);
                            this.selectedAgent = null;
                        }
                        if (agent.body) agent.body.setVelocity(0, 0);
                        if (id === 1) { this.isAttacking1 = false; this.killer1Dest = null; }
                        else { this.isAttacking2 = false; this.killer2Dest = null; }
                    } else if (isActive && (!agent.active || agent.hp <= 0)) {
                        // 랜덤 시작 위치 지정 및 설정된 데이터로 스탯 복원
                        const dat = getKillers();
                        const kData = id === 1 ? dat[0] : dat[1];
                        agent.x = this.startArea.x + Math.random() * this.startArea.width;
                        agent.y = this.startArea.y + Math.random() * this.startArea.height;
                        agent.hp = kData.hp;
                        agent.stats = { ...kData.stats };
                        label.setText(`${kData.name} [HP: ${agent.hp}]`);
                        label.setFill(id === 1 ? '#0f0' : '#0ff');
                        if (agent.body) agent.body.setVelocity(0, 0);
                    }

                    if (agent) agent.setActive(isActive).setVisible(isActive);
                    if (label) label.setActive(isActive).setVisible(isActive);
                    if (agent && agent.body) agent.body.enable = isActive;

                    this.statusText.setText(`[ 명령: KILLER ${id} - ${isActive ? '전투력 복원 (ONLINE)' : '무장 해제 (OFFLINE)'} ]`);
                    this.statusText.setFill(isActive ? (id === 1 ? '#0f0' : '#0ff') : '#888');
                };

                this.showKillerVision = false;
                window.toggleKillerVision = (state) => {
                    this.showKillerVision = state;
                };

                this.targetCounterOn = false;
                window.toggleTargetCounter = (state) => {
                    this.targetCounterOn = state;
                };

                this.showTargetVision = false;
                window.toggleTargetVision = (state) => {
                    this.showTargetVision = state;
                };

                this.attackLine1 = this.add.graphics();
                this.attackLine2 = this.add.graphics();
                this.targetVision = this.add.graphics();
                this.killer1Vision = this.add.graphics();
                this.killer2Vision = this.add.graphics();
            },

            update: function (time) {
                if (this.gameEnded) return;

                const targetNormalSpeed = 100;
                const targetFleeSpeed = 180;
                const killerSpeed = 150;
                const attackRange = 100;
                const detectionRange = 250;
                const fovRadians = Phaser.Math.DegToRad(120);

                // --- 타겟 행동 제어 ---
                if (this.target && this.target.body) {
                    const targetPerception = this.target.stats.perception;
                    const inFOV1 = this.visionSystem.checkInFOV(this.target, this.killer1, fovRadians, targetPerception);
                    const inFOV2 = this.visionSystem.checkInFOV(this.target, this.killer2, fovRadians, targetPerception);

                    const isPanicking = this.target.panicTime && time < this.target.panicTime;
                    const isFleeing = inFOV1 || inFOV2 || isPanicking;
                    const isStunned = this.target.stunTime && time < this.target.stunTime;

                    let nearestDetectedKiller;
                    if (isPanicking) {
                        nearestDetectedKiller = this.target.panicSource;
                    } else {
                        const dist1 = Phaser.Math.Distance.Between(this.target.x, this.target.y, this.killer1.x, this.killer1.y);
                        const dist2 = Phaser.Math.Distance.Between(this.target.x, this.target.y, this.killer2.x, this.killer2.y);
                        nearestDetectedKiller = (inFOV1 && inFOV2) ? (dist1 < dist2 ? this.killer1 : this.killer2) : (inFOV1 ? this.killer1 : this.killer2);
                    }

                    let labelText = "TARGET";
                    let labelColor = '#f00';

                    if (isStunned) {
                        this.target.body.setVelocity(this.target.body.velocity.x * 0.9, this.target.body.velocity.y * 0.9);
                        labelText = "STUNNED";
                        labelColor = '#aaaaaa';
                    } else if (nearestDetectedKiller && nearestDetectedKiller.active) {
                        if (isFleeing) {
                            if (this.targetCounterOn) {
                                const distToKiller = Phaser.Math.Distance.Between(this.target.x, this.target.y, nearestDetectedKiller.x, nearestDetectedKiller.y);
                                if (distToKiller > 200) {
                                    this.movementSystem.moveWithAvoidance(this.target, nearestDetectedKiller, targetNormalSpeed);
                                } else {
                                    this.target.body.setVelocity(0, 0);
                                    this.target.lastValidAngle = Phaser.Math.Angle.Between(this.target.x, this.target.y, nearestDetectedKiller.x, nearestDetectedKiller.y);
                                }
                                labelText = "ENGAGING";
                                labelColor = '#ff5555';
                            } else {
                                this.movementSystem.moveWithAvoidance(this.target, null, targetFleeSpeed, nearestDetectedKiller);
                                labelText = "CAUTION: EVADING";
                                labelColor = '#ff0';
                            }
                        } else {
                            if (!this.targetDest) {
                                this.targetDest = {
                                    x: this.targetArea.x + Math.random() * this.targetArea.width,
                                    y: this.targetArea.y + Math.random() * this.targetArea.height
                                };
                            }

                            const distToDest = Phaser.Math.Distance.Between(this.target.x, this.target.y, this.targetDest.x, this.targetDest.y);
                            if (distToDest < 10) {
                                this.targetDest = {
                                    x: this.targetArea.x + Math.random() * this.targetArea.width,
                                    y: this.targetArea.y + Math.random() * this.targetArea.height
                                };
                            } else {
                                this.movementSystem.moveWithAvoidance(this.target, this.targetDest, targetNormalSpeed);
                            }
                            labelText = "TARGET";
                            labelColor = '#f00';
                        }


                        const speed = this.target.body.speed;
                        const moveAngle = speed > 5 ? Math.atan2(this.target.body.velocity.y, this.target.body.velocity.x) : (this.target.lastValidAngle || 0);

                        if (this.target.visualAngle === undefined) this.target.visualAngle = moveAngle;

                        const diff = Phaser.Math.Angle.Wrap(moveAngle - this.target.visualAngle);
                        if (Math.abs(diff) > Math.PI * 0.9) {
                            const targetGoingDown = moveAngle > 0 && moveAngle < Math.PI;
                            this.target.visualAngle += targetGoingDown ? 0.15 : -0.15;
                        } else {
                            this.target.visualAngle = Phaser.Math.Angle.RotateTo(this.target.visualAngle, moveAngle, 0.2);
                        }
                        const targetAngle = this.target.visualAngle;
                        this.target.rotation = targetAngle;

                        if (speed > 5) {
                            this.target.body.setVelocity(Math.cos(targetAngle) * speed, Math.sin(targetAngle) * speed);
                        }
                    }

                    const targetAngle = this.target.visualAngle || 0;
                    const visionAlpha = isFleeing ? 0.2 : 0.1;
                    const visionColor = isFleeing ? 0xff6600 : 0xff0000;

                    this.targetVision.clear();
                    if (this.showTargetVision) {
                        this.visionSystem.renderRaycastVision(this.targetVision, this.target.x, this.target.y, targetAngle, targetPerception, fovRadians, visionColor, visionAlpha);
                    }

                    const hpText = Math.max(0, this.target.hp);
                    const fullLabel = `${labelText} [HP: ${hpText}]`;
                    if (this.targetLabel.text !== fullLabel) {
                        this.targetLabel.setText(fullLabel).setFill(labelColor);
                    }
                    this.targetLabel.setPosition(this.target.x - 25, this.target.y + 20);

                    // --- 타겟 자동 반격 (권총) ---
                    if (this.targetCounterOn && nearestDetectedKiller && !isStunned) {
                        // isFleeing 일 때 타겟이 교전에 들어갔으므로, 시야 조건과 무관하게 근방이면 사격 시도 가능 (패닉에 의해 시야 밖에 있어도)
                        const distToDetect = Phaser.Math.Distance.Between(this.target.x, this.target.y, nearestDetectedKiller.x, nearestDetectedKiller.y);
                        const targetLineOfSightBlocked = this.visionSystem.checkLineOfSightBlocked(this.target, nearestDetectedKiller);

                        // 사거리 내에 있고, 벽에 가로막히지 않았으면 대응 사격 준비 (반응 속도 적용)
                        if (distToDetect <= targetPerception && !targetLineOfSightBlocked) {
                            if (this.target.engagedEnemy !== nearestDetectedKiller) {
                                this.target.engagedEnemy = nearestDetectedKiller;
                                this.target.engageStartTime = time;
                            }

                            if (time >= this.target.engageStartTime + this.target.stats.reactionSpeed) {
                                if (!this.target.lastAttackTime || time > this.target.lastAttackTime + this.target.stats.attackSpeed) {
                                    this.target.lastAttackTime = time;
                                    const hitAngle = Phaser.Math.Angle.Between(this.target.x, this.target.y, nearestDetectedKiller.x, nearestDetectedKiller.y);
                                    this.combatSystem.firePistol(this.target, nearestDetectedKiller, hitAngle);
                                }
                            }
                        } else {
                            this.target.engagedEnemy = null;
                        }
                    }
                }

                // --- UI에 정보 업데이트 전송 ---
                if (window.updateAgentInfo) {
                    if (this.viewedAgent) {
                        let aName = "UNKNOWN";
                        let aColor = "#fff";
                        if (this.viewedAgent === this.killer1) { aName = "KILLER 1"; aColor = "#0f0"; }
                        else if (this.viewedAgent === this.killer2) { aName = "KILLER 2"; aColor = "#0ff"; }
                        else if (this.viewedAgent === this.target) { aName = "TARGET"; aColor = "#f00"; }

                        window.updateAgentInfo({
                            name: aName,
                            hp: this.viewedAgent.hp,
                            damage: this.viewedAgent.stats?.damage ?? 'N/A',
                            attackSpeed: this.viewedAgent.stats?.attackSpeed ?? 'N/A',
                            accuracy: this.viewedAgent.stats?.accuracy ?? 'N/A',
                            reactionSpeed: this.viewedAgent.stats?.reactionSpeed ?? 'N/A',
                            intelligence: this.viewedAgent.stats?.intelligence ?? 'N/A',
                            perception: this.viewedAgent.stats?.perception ?? 'N/A',
                            color: aColor
                        });
                    } else {
                        window.updateAgentInfo(null);
                    }
                }

                // --- 킬러들 행동 처리 ---
                const agents = [
                    { agent: this.killer1, dest: this.killer1Dest, isAttacking: this.isAttacking1, line: this.attackLine1, vision: this.killer1Vision, label: this.killer1Label, id: "KILLER 1", color: 0x00ff00 },
                    { agent: this.killer2, dest: this.killer2Dest, isAttacking: this.isAttacking2, line: this.attackLine2, vision: this.killer2Vision, label: this.killer2Label, id: "KILLER 2", color: 0x00ffff }
                ];

                let targetNeutralized = false;

                agents.forEach(data => {
                    let { agent, dest, isAttacking, line, vision, label, color } = data;
                    if (!agent || !agent.body) return;

                    line.clear();
                    vision.clear();

                    if (!agent.active) return;

                    if (agent.hp <= 0) {
                        // 킬러 사망 처리
                        agent.setActive(false).setVisible(false);
                        agent.body.enable = false;
                        label.setText(`[DEAD] ${data.id}`).setFill('#555');
                        return;
                    }

                    let killerAngle = agent.lastAngle || 0;

                    if (this.isDragRotating && this.selectedAgent === agent) {
                        killerAngle = Phaser.Math.Angle.Between(agent.x, agent.y, this.input.activePointer.worldX, this.input.activePointer.worldY);
                    } else if (agent.body.speed > 5) {
                        killerAngle = Math.atan2(agent.body.velocity.y, agent.body.velocity.x);
                    }

                    agent.lastAngle = killerAngle;
                    agent.rotation = killerAngle;

                    const killerPerception = agent.stats.perception;
                    const kAlpha = this.selectedAgent === agent ? 0.2 : 0.1;
                    if (this.showKillerVision) {
                        // Killers didn't check walls visually before, but let's give them raycast vision to match targets
                        this.visionSystem.renderRaycastVision(vision, agent.x, agent.y, killerAngle, killerPerception, fovRadians, color, kAlpha, 30);
                    }

                    const distToTarget = (this.target && this.target.active) ? Phaser.Math.Distance.Between(agent.x, agent.y, this.target.x, this.target.y) : Infinity;
                    const lineOfSightBlocked = this.visionSystem.checkLineOfSightBlocked(agent, this.target);

                    if (!isAttacking && !dest && !lineOfSightBlocked && distToTarget <= killerPerception) {
                        const angleToTarget = Phaser.Math.Angle.Between(agent.x, agent.y, this.target.x, this.target.y);
                        const angleDiff = Math.abs(Phaser.Math.Angle.Wrap(angleToTarget - killerAngle));

                        if (angleDiff <= fovRadians / 2) {
                            if (agent === this.killer1) this.isAttacking1 = true;
                            else this.isAttacking2 = true;
                            isAttacking = true;
                            this.statusText.setText(`[ 시스템 경고: ${data.id} 타겟 식별, 강제 교전 개시 ]`);
                            this.statusText.setFill('#ff6600');
                        }
                    }

                    const currentAttackRange = agent === this.killer1 ? 150 : 50;

                    if (distToTarget <= currentAttackRange && !lineOfSightBlocked) {
                        agent.body.setVelocity(0, 0);

                        if (agent.engagedEnemy !== this.target) {
                            agent.engagedEnemy = this.target;
                            agent.engageStartTime = time;
                        }

                        if (time >= agent.engageStartTime + agent.stats.reactionSpeed) {
                            if (!agent.lastAttackTime || time > agent.lastAttackTime + agent.stats.attackSpeed) {
                                agent.lastAttackTime = time;

                                this.target.panicTime = time + 2000;
                                this.target.panicSource = agent;

                                const hitAngle = Phaser.Math.Angle.Between(agent.x, agent.y, this.target.x, this.target.y);

                                if (agent === this.killer1) {
                                    this.combatSystem.fireShotgun(agent, this.target, hitAngle, currentAttackRange);
                                } else if (agent === this.killer2) {
                                    this.combatSystem.performMelee(agent, this.target, hitAngle, time);
                                }

                                if (this.target.hp <= 0) targetNeutralized = true;
                            }
                        }

                        if (Phaser.Math.Between(0, 10) > 4) {
                            this.target.setStrokeStyle(4, 0xffffff);
                        } else {
                            this.target.setStrokeStyle(2, 0xff0000);
                        }
                    } else {
                        if (isAttacking && this.target && this.target.active) {
                            this.movementSystem.moveWithAvoidance(agent, this.target, killerSpeed);
                        } else if (dest) {
                            const d = Phaser.Math.Distance.Between(agent.x, agent.y, dest.x, dest.y);
                            if (d < 10) {
                                agent.body.setVelocity(0, 0);
                                if (agent === this.killer1) this.killer1Dest = null;
                                else this.killer2Dest = null;
                            } else {
                                this.movementSystem.moveWithAvoidance(agent, dest, killerSpeed);
                            }
                        } else {
                            agent.body.setVelocity(0, 0);
                        }

                        if (!this.isAttacking1 && !this.isAttacking2) {
                            if (this.target && this.target.active) this.target.setStrokeStyle(2, 0xff0000);
                        }
                    }

                    if (label && label.active && agent.hp > 0) {
                        label.setText(`${data.id} [HP: ${Math.max(0, agent.hp)}]`);
                        label.setPosition(agent.x - 25, agent.y + 20);
                    }
                });

                if (targetNeutralized) {
                    this.target.destroy();
                    this.targetLabel.destroy();
                    this.isAttacking1 = this.isAttacking2 = false;
                    this.gameEnded = true;
                    this.statusText.setText("[ TARGET NEUTRALIZED: MISSION ACCOMPLISHED ]");
                    this.statusText.setFill('#0f0');
                    this.add.text(400, 300, "MISSION COMPLETE", { fontSize: '64px', fill: '#0f0', fontFamily: 'monospace', fontWeight: 'bold' }).setOrigin(0.5);
                    this.killer1.body.setVelocity(0, 0);
                    this.killer2.body.setVelocity(0, 0);
                }
            }
        }
    };

    return new Phaser.Game(config);
}