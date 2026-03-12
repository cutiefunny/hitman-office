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
                this.killers = []; // 요원들을 관리하는 배열
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

                killersData.forEach((kData, index) => {
                    const agent = this.add.rectangle(this.startArea.x, this.startArea.y, 32, 32, kData.color);
                    agent.setStrokeStyle(2, kData.color);
                    this.physics.add.existing(agent);
                    agent.body.setCollideWorldBounds(true);
                    agent.hp = kData.hp;
                    agent.stats = { ...kData.stats };
                    agent.attackType = kData.attackType;
                    agent.range = kData.range;
                    agent.specialAbilities = kData.specialAbilities || [];

                    const label = this.add.text(75, 225 + (index * 200), `${kData.name} [HP: ${agent.hp}]`, { fill: Phaser.Display.Color.IntegerToColor(kData.color).rgba, fontSize: '12px', fontFamily: 'monospace' });

                    agent.setInteractive({ useHandCursor: true });
                    agent.setActive(false).setVisible(false);
                    agent.body.enable = false;
                    label.setActive(false).setVisible(false);

                    this.killers.push({
                        agent,
                        label,
                        data: kData,
                        dest: null,
                        isAttacking: false,
                        vision: this.add.graphics(),
                        attackLine: this.add.graphics(),
                        id: kData.name,
                        index: index + 1 // 1-based ID for external API
                    });
                });

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
                this.killers.forEach(k => {
                    this.physics.add.collider(k.agent, this.walls);
                    this.physics.add.collider(k.agent, this.target);
                    this.killers.forEach(other => {
                        if (k !== other) this.physics.add.collider(k.agent, other.agent);
                    });
                });

                this.target.setInteractive({ useHandCursor: true });

                // 통합 클릭 핸들러
                this.input.on('pointerdown', (pointer, gameObjects) => {
                    if (this.gameEnded) return;

                    if (gameObjects.length > 0) {
                        const clicked = gameObjects[0];

                        // 클릭한 대상이 킬러이거나 타겟일 경우 정보 열람 대상으로 설정
                        const clickedKiller = this.killers.find(k => k.agent === clicked);
                        if ((clickedKiller && clickedKiller.agent.active) || clicked === this.target) {
                            this.viewedAgent = clicked;
                        }

                        if (clickedKiller && clickedKiller.agent.active) {
                            this.isDragRotating = true;

                            if (this.selectedAgent === clicked) {
                                clicked.setStrokeStyle(2, clickedKiller.data.color);
                                this.selectedAgent = null;
                                this.isDragRotating = false;
                                this.statusText.setText("[ 위성 해킹: 작전 대기 중 ]");
                            } else {
                                if (this.selectedAgent) {
                                    const prevKiller = this.killers.find(k => k.agent === this.selectedAgent);
                                    if (prevKiller) this.selectedAgent.setStrokeStyle(2, prevKiller.data.color);
                                }
                                this.selectedAgent = clicked;
                                clicked.setStrokeStyle(4, 0xffffff);
                                this.statusText.setText(`[ 요원 식별: ${clickedKiller.id} 선택됨 ]`);
                            }
                            return;
                        }

                        if (clicked === this.target && this.selectedAgent) {
                            const currentKiller = this.killers.find(k => k.agent === this.selectedAgent);
                            if (currentKiller) {
                                currentKiller.isAttacking = true;
                                currentKiller.dest = null;
                                this.statusText.setText(`[ 명령: ${currentKiller.id} 타겟 추격 및 교전 ]`);
                                this.statusText.setFill('#f00');
                            }
                            return;
                        }
                    }

                    if (this.selectedAgent) {
                        const currentKiller = this.killers.find(k => k.agent === this.selectedAgent);
                        if (currentKiller) {
                            currentKiller.dest = { x: pointer.worldX, y: pointer.worldY };
                            currentKiller.isAttacking = false;
                            this.statusText.setText(`[ 명령: ${currentKiller.id} 지점 이동 하달 ]`);
                            this.statusText.setFill('#0f0');
                        }
                    }
                });

                this.input.on('pointerup', () => {
                    this.isDragRotating = false;
                });

                // --- 외부 API ---
                window.commandAutoAttack = () => {
                    if (this.gameEnded) return;
                    if (this.target && this.target.active) {
                        this.killers.forEach(k => {
                            k.isAttacking = true;
                            k.dest = null;
                        });

                        if (this.selectedAgent) {
                            const cur = this.killers.find(k => k.agent === this.selectedAgent);
                            if (cur) this.selectedAgent.setStrokeStyle(2, cur.data.color);
                            this.selectedAgent = null;
                        }

                        this.statusText.setText(`[ 명령: 전 요원 자율 교전 (SEEK & DESTROY) 개시 ]`);
                        this.statusText.setFill('#f00');
                    }
                };

                window.toggleAgent = (id, isActive) => {
                    if (this.gameEnded) return;
                    const k = this.killers.find(item => item.index === id);
                    if (!k) return;

                    const agent = k.agent;
                    const label = k.label;

                    if (!isActive) {
                        if (this.selectedAgent === agent) {
                            this.selectedAgent.setStrokeStyle(2, k.data.color);
                            this.selectedAgent = null;
                        }
                        if (agent.body) agent.body.setVelocity(0, 0);
                        k.isAttacking = false;
                        k.dest = null;
                    } else if (isActive && (!agent.active || agent.hp <= 0)) {
                        agent.x = this.startArea.x + Math.random() * this.startArea.width;
                        agent.y = this.startArea.y + Math.random() * this.startArea.height;
                        agent.hp = k.data.hp;
                        agent.stats = { ...k.data.stats };
                        label.setText(`${k.id} [HP: ${agent.hp}]`);
                        label.setFill(Phaser.Display.Color.IntegerToColor(k.data.color).rgba);
                        if (agent.body) agent.body.setVelocity(0, 0);
                    }

                    if (agent) agent.setActive(isActive).setVisible(isActive);
                    if (label) label.setActive(isActive).setVisible(isActive);
                    if (agent && agent.body) agent.body.enable = isActive;

                    this.statusText.setText(`[ 명령: ${k.id} - ${isActive ? '전투력 복원 (ONLINE)' : '무장 해제 (OFFLINE)'} ]`);
                    this.statusText.setFill(isActive ? '#0f0' : '#888');
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

                this.targetVision = this.add.graphics();
                // 개별 킬러 비전 및 라인은 killers 배열 생성 시 내부에서 graphics 생성하여 소속시킴
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
                    const inFOVs = this.killers.filter(k => k.agent.active).map(k => {
                        // 은신(Stealth) 능력치가 있으면 타겟이 식별할 수 있는 거리가 50% 감소함
                        const effectivePerception = k.agent.specialAbilities.includes('은신') ? targetPerception * 0.5 : targetPerception;
                        return {
                            inFOV: this.visionSystem.checkInFOV(this.target, k.agent, fovRadians, effectivePerception),
                            killer: k
                        };
                    });

                    const isPanicking = this.target.panicTime && time < this.target.panicTime;
                    const anyInFOV = inFOVs.some(item => item.inFOV);
                    const isFleeing = anyInFOV || isPanicking;
                    const isStunned = this.target.stunTime && time < this.target.stunTime;

                    let nearestDetectedKiller;
                    if (isPanicking) {
                        nearestDetectedKiller = this.target.panicSource;
                    } else {
                        const detected = inFOVs.filter(item => item.inFOV);
                        if (detected.length > 0) {
                            detected.sort((a, b) => {
                                const d1 = Phaser.Math.Distance.Between(this.target.x, this.target.y, a.killer.agent.x, a.killer.agent.y);
                                const d2 = Phaser.Math.Distance.Between(this.target.x, this.target.y, b.killer.agent.x, b.killer.agent.y);
                                return d1 - d2;
                            });
                            nearestDetectedKiller = detected[0].killer.agent;
                        }
                    }

                    let labelText = "TARGET";
                    let labelColor = '#f00';

                    if (isStunned) {
                        this.target.body.setVelocity(this.target.body.velocity.x * 0.9, this.target.body.velocity.y * 0.9);
                        labelText = "STUNNED";
                        labelColor = '#aaaaaa';
                    } else if (isFleeing && nearestDetectedKiller && nearestDetectedKiller.active) {
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
                        // WANDERING (No immediate threat or lost sight)
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

                    // Common movement post-processing (rotation and velocity smoothing)
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
                    const targetVisualRotation = this.target.visualAngle;
                    this.target.rotation = targetVisualRotation;

                    if (speed > 5) {
                        this.target.body.setVelocity(Math.cos(targetVisualRotation) * speed, Math.sin(targetVisualRotation) * speed);
                    }

                    const targetVisionAngle = this.target.visualAngle || 0;
                    const visionAlpha = isFleeing ? 0.2 : 0.1;
                    const visionColor = isFleeing ? 0xff6600 : 0xff0000;

                    this.targetVision.clear();
                    if (this.showTargetVision) {
                        this.visionSystem.renderRaycastVision(this.targetVision, this.target.x, this.target.y, targetVisionAngle, targetPerception, fovRadians, visionColor, visionAlpha);
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

                        const kObj = this.killers.find(k => k.agent === this.viewedAgent);
                        if (kObj) {
                            aName = kObj.id;
                            aColor = Phaser.Display.Color.IntegerToColor(kObj.data.color).rgba;
                        } else if (this.viewedAgent === this.target) {
                            aName = "TARGET";
                            aColor = "#f00";
                        }

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
                const agents = this.killers;

                let targetNeutralized = false;

                agents.forEach(data => {
                    let { agent, dest, isAttacking, vision, label, data: kData, attackLine: line } = data;
                    const color = kData.color;
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
                            data.isAttacking = true;
                            isAttacking = true;
                            this.statusText.setText(`[ 시스템 경고: ${data.id} 타겟 식별, 강제 교전 개시 ]`);
                            this.statusText.setFill('#ff6600');
                        }
                    }

                    // 근접 타입이면 사거리를 강제로 제한하여 원거리 발동 방지
                    const currentAttackRange = agent.attackType === 'melee' ? 50 : (agent.range || 150);

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

                                if (agent.attackType === 'ranged') {
                                    this.combatSystem.fireShotgun(agent, this.target, hitAngle, currentAttackRange);
                                } else if (agent.attackType === 'melee') {
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
                        // 대시(Dash) 능력치가 있으면 이동속도 50% 증가
                        const currentKillerSpeed = agent.specialAbilities.includes('대시') ? killerSpeed * 1.5 : killerSpeed;

                        if (isAttacking && this.target && this.target.active) {
                            this.movementSystem.moveWithAvoidance(agent, this.target, currentKillerSpeed);
                        } else if (dest) {
                            const d = Phaser.Math.Distance.Between(agent.x, agent.y, dest.x, dest.y);
                            if (d < 10) {
                                agent.body.setVelocity(0, 0);
                                data.dest = null;
                            } else {
                                this.movementSystem.moveWithAvoidance(agent, dest, currentKillerSpeed);
                            }
                        } else {
                            agent.body.setVelocity(0, 0);
                        }

                        if (!this.killers.some(k => k.isAttacking)) {
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
                    this.killers.forEach(k => k.isAttacking = false);
                    this.gameEnded = true;
                    this.statusText.setText("[ TARGET NEUTRALIZED: MISSION ACCOMPLISHED ]");
                    this.statusText.setFill('#0f0');
                    this.add.text(400, 300, "MISSION COMPLETE", { fontSize: '64px', fill: '#0f0', fontFamily: 'monospace', fontWeight: 'bold' }).setOrigin(0.5);
                    this.killers.forEach(k => k.agent.body.setVelocity(0, 0));
                }
            }
        }
    };

    return new Phaser.Game(config);
}