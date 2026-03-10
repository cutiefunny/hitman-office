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
                this.killer2Dest = null;
                this.isAttacking1 = false;
                this.isAttacking2 = false;
                this.targetHits = 0;
                this.lastHitTime = 0;
                this.gameEnded = false;
                this.isDragRotating = false;

                // 최적화: 회피용 각도 데이터 캐싱 (전방위 360도 스캔용)
                this.avoidanceOffsets = [];
                for (let i = 0; i < 16; i++) {
                    const offset = (i % 2 === 0 ? 1 : -1) * Math.floor(i / 2) * (Math.PI / 8);
                    this.avoidanceOffsets.push(offset);
                }

                // 벽(장애물) 생성
                const wallsData = [
                    { x: 400, y: 150, w: 200, h: 20 },
                    { x: 400, y: 450, w: 200, h: 20 },
                    { x: 200, y: 300, w: 20, h: 200 },
                    { x: 600, y: 300, w: 20, h: 200 }
                ];

                this.walls = this.physics.add.staticGroup();
                wallsData.forEach(data => {
                    this.walls.add(this.add.rectangle(data.x, data.y, data.w, data.h, 0x555555));
                });

                // 최적화: 충돌 판정용 Rect 캐싱 (getBounds() 생성 방지)
                this.cachedWallBounds = this.walls.getChildren().map(wall => wall.getBounds());

                // 오퍼레이터 화면 텍스트
                this.statusText = this.add.text(10, 10, "[ 위성 해킹: 작전 구역 모니터링 ]", {
                    fill: '#0f0',
                    fontFamily: 'monospace',
                    fontSize: '18px'
                });

                // --- 킬러1 ---
                this.killer1 = this.add.rectangle(100, 200, 32, 32, 0x00ff00);
                this.killer1.setStrokeStyle(2, 0x00ff00);
                this.physics.add.existing(this.killer1);
                this.killer1Label = this.add.text(75, 225, "KILLER 1", { fill: '#0f0', fontSize: '12px', fontFamily: 'monospace' });
                this.killer1.setInteractive({ useHandCursor: true });

                // --- 킬러2 ---
                this.killer2 = this.add.rectangle(100, 400, 32, 32, 0x00ffff);
                this.killer2.setStrokeStyle(2, 0x00ffff);
                this.physics.add.existing(this.killer2);
                this.killer2Label = this.add.text(75, 425, "KILLER 2", { fill: '#0ff', fontSize: '12px', fontFamily: 'monospace' });
                this.killer2.setInteractive({ useHandCursor: true });

                // --- 타겟 ---
                this.target = this.add.rectangle(waypoints[0].x, waypoints[0].y, 32, 32, 0xff0000);
                this.target.setStrokeStyle(2, 0xff0000);
                this.physics.add.existing(this.target);
                this.targetLabel = this.add.text(waypoints[0].x - 25, waypoints[0].y + 20, "TARGET", { fill: '#f00', fontSize: '12px', fontFamily: 'monospace' });

                // 콜라이더 설정 (물리적 충돌 방지)
                this.physics.add.collider(this.target, this.walls);
                this.physics.add.collider(this.killer1, this.walls);
                this.physics.add.collider(this.killer2, this.walls);
                this.physics.add.collider(this.killer1, this.killer2);
                this.physics.add.collider(this.killer1, this.target);
                this.physics.add.collider(this.killer2, this.target);

                // 타겟 인터랙티브 설정 (공격 명령용)
                this.target.setInteractive({ useHandCursor: true });

                // 통합 클릭 핸들러
                this.input.on('pointerdown', (pointer, gameObjects) => {
                    if (this.gameEnded) return;

                    if (gameObjects.length > 0) {
                        const clicked = gameObjects[0];

                        // 요원 선택 및 해제 처리
                        if ((clicked === this.killer1 && this.killer1.active) || (clicked === this.killer2 && this.killer2.active)) {
                            this.isDragRotating = true; // 드래그 회전 시작

                            // 이미 선택된 요원을 다시 클릭하면 선택 해제
                            if (this.selectedAgent === clicked) {
                                let color = clicked === this.killer1 ? 0x00ff00 : 0x00ffff;
                                clicked.setStrokeStyle(2, color);
                                this.selectedAgent = null;
                                this.isDragRotating = false;
                                this.statusText.setText("[ 위성 해킹: 작전 대기 중 ]");
                            } else {
                                // 다른 요원 선택 시 기존 요원 스타일 초기화
                                if (this.selectedAgent) {
                                    let prevColor = this.selectedAgent === this.killer1 ? 0x00ff00 : 0x00ffff;
                                    this.selectedAgent.setStrokeStyle(2, prevColor);
                                }
                                this.selectedAgent = clicked;
                                clicked.setStrokeStyle(4, 0xffffff); // 선택 표시 (흰색 테두리)
                                this.statusText.setText(`[ 요원 식별: ${clicked === this.killer1 ? "KILLER 1" : "KILLER 2"} 선택됨 ]`);
                            }
                            return;
                        }

                        // 타겟 공격 명령 (선택 유지)
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

                    // 빈 화면 클릭 시 이동 명령 (선택 유지)
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

                // --- 외부 API: 자율 교전 명령 ---
                window.commandAutoAttack = () => {
                    if (this.gameEnded) return;
                    if (this.target && this.target.active) {
                        this.isAttacking1 = true;
                        this.killer1Dest = null;
                        this.isAttacking2 = true;
                        this.killer2Dest = null;

                        // 선택 초기화
                        if (this.selectedAgent) {
                            let color = this.selectedAgent === this.killer1 ? 0x00ff00 : 0x00ffff;
                            this.selectedAgent.setStrokeStyle(2, color);
                            this.selectedAgent = null;
                        }

                        this.statusText.setText(`[ 명령: 전 요원 자율 교전 (SEEK & DESTROY) 개시 ]`);
                        this.statusText.setFill('#f00');
                    }
                };

                // --- 외부 API: 요원 상태 토글 ---
                window.toggleAgent = (id, isActive) => {
                    if (this.gameEnded) return;
                    let agent = id === 1 ? this.killer1 : this.killer2;
                    let label = id === 1 ? this.killer1Label : this.killer2Label;

                    if (!isActive) {
                        // 선택 해제 및 추격 정지
                        if (this.selectedAgent === agent) {
                            this.selectedAgent.setStrokeStyle(2, id === 1 ? 0x00ff00 : 0x00ffff);
                            this.selectedAgent = null;
                        }
                        if (agent.body) agent.body.setVelocity(0, 0);
                        if (id === 1) { this.isAttacking1 = false; this.killer1Dest = null; }
                        else { this.isAttacking2 = false; this.killer2Dest = null; }
                    }

                    if (agent) agent.setActive(isActive).setVisible(isActive);
                    if (label) label.setActive(isActive).setVisible(isActive);
                    if (agent && agent.body) agent.body.enable = isActive;

                    this.statusText.setText(`[ 명령: KILLER ${id} - ${isActive ? '전투력 복원 (ONLINE)' : '무장 해제 (OFFLINE)'} ]`);
                    this.statusText.setFill(isActive ? (id === 1 ? '#0f0' : '#0ff') : '#888');
                };

                // --- 그래픽 효과 (공격 및 시야) ---
                this.attackLine1 = this.add.graphics();
                this.attackLine2 = this.add.graphics();
                this.targetVision = this.add.graphics();
                this.killer1Vision = this.add.graphics();
                this.killer2Vision = this.add.graphics();

                // --- 스마트 회피 이동 시스템 (개선형: 떨림 방지 및 슬라이딩) ---
                this.moveWithAvoidance = (actor, targetPos, speed, fleeFrom = null) => {
                    const baseAngle = fleeFrom
                        ? Phaser.Math.Angle.Between(fleeFrom.x, fleeFrom.y, actor.x, actor.y)
                        : Phaser.Math.Angle.Between(actor.x, actor.y, targetPos.x, targetPos.y);

                    const sensorDist = fleeFrom ? 80 : 50; // 추격자는 벽에 더 바짝 붙어 우회하도록 센서 반경 단축
                    let bestAngle = baseAngle;
                    let maxScore = -Infinity;
                    let foundPath = false;

                    // 1. 관성 및 떨림 방지 장치: 마지막으로 선택했던 각도를 저장하여 급격한 방향 전환 억제
                    if (actor.lastValidAngle === undefined) actor.lastValidAngle = baseAngle;

                    // 현재 실제 물리 속도가 충분하면 그것을, 아니면 이전 경로를 관성 기준으로 사용
                    const currentVelAngle = actor.body.speed > 5 ? Math.atan2(actor.body.velocity.y, actor.body.velocity.x) : actor.lastValidAngle;

                    for (let i = 0; i < this.avoidanceOffsets.length; i++) {
                        const testAngle = baseAngle + this.avoidanceOffsets[i];
                        const cos = Math.cos(testAngle);
                        const sin = Math.sin(testAngle);

                        // 센서 감지 성능 강화: 단일 점이 아닌 캐릭터 폭을 고려한 다중 점(Trident) 체크
                        const checkPoints = [
                            { x: actor.x + cos * sensorDist, y: actor.y + sin * sensorDist },
                            { x: actor.x + cos * (sensorDist - 10) + sin * 18, y: actor.y + sin * (sensorDist - 10) - cos * 18 },
                            { x: actor.x + cos * (sensorDist - 10) - sin * 18, y: actor.y + sin * (sensorDist - 10) + cos * 18 }
                        ];

                        let blocked = false;
                        for (let p of checkPoints) {
                            for (let j = 0; j < this.cachedWallBounds.length; j++) {
                                if (this.cachedWallBounds[j].contains(p.x, p.y)) {
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
                            // --- 정교한 스코어링 시스템 ---
                            let score = 0;
                            const inertiaDiff = Math.abs(Phaser.Math.Angle.Wrap(testAngle - currentVelAngle));

                            if (fleeFrom) {
                                // [도망 빙향]
                                score = (this.avoidanceOffsets.length - i) * 80;
                                score += (Math.PI - inertiaDiff) * 150; // 관성 유지 중요
                                const distToCenter = Phaser.Math.Distance.Between(actor.x + cos * sensorDist, actor.y + sin * sensorDist, 400, 300);
                                score += (800 - distToCenter) * 0.5; // 중앙 지향

                                if (score > maxScore) {
                                    maxScore = score;
                                    bestAngle = testAngle;
                                    foundPath = true;
                                }
                            } else {
                                // [추격/이동 방향]
                                // 정면에서 얼마나 벗어났는지가 가장 중요
                                score = (this.avoidanceOffsets.length - i) * 100;
                                score += (Math.PI - inertiaDiff) * 80; // 부드러운 우회를 위한 약간의 관성

                                // 타겟과의 거리 감소 우선
                                if (targetPos) {
                                    const distToTarget = Phaser.Math.Distance.Between(actor.x + cos * sensorDist, actor.y + sin * sensorDist, targetPos.x, targetPos.y);
                                    score -= distToTarget * 1.5;
                                }

                                // 킬러 간 동선 분산 협의 (Tactical Flanking)
                                let otherKiller = null;
                                if (actor === this.killer1) otherKiller = this.killer2;
                                else if (actor === this.killer2) otherKiller = this.killer1;

                                if (otherKiller && otherKiller.active) {
                                    const distToOther = Phaser.Math.Distance.Between(actor.x, actor.y, otherKiller.x, otherKiller.y);
                                    if (distToOther < 250) {
                                        // 팀원 위치를 향해 가는 경로일 경우 감점 (양각 포위 유도)
                                        const angleToOther = Phaser.Math.Angle.Between(actor.x, actor.y, otherKiller.x, otherKiller.y);
                                        const angleDiffToOther = Math.abs(Phaser.Math.Angle.Wrap(testAngle - angleToOther));

                                        score -= (Math.PI - angleDiffToOther) * 80;

                                        // 병목 현상 방지: 매우 가까우면 동선이 겹치지 않게 페널티 강화
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

                                // 추격 시 정면이 뚫려있고 (i==0) 장애물이 전혀 없으면 즉각 결정
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
                            // 킬러가 꽉 막힌 경우, 벽을 타고 미끄러지도록 임시 회피 기동
                            const slideAngle = currentVelAngle + (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
                            actor.body.setVelocity(Math.cos(slideAngle) * (speed * 0.5), Math.sin(slideAngle) * (speed * 0.5));
                            actor.lastValidAngle = slideAngle;
                        }
                        return;
                    }

                    actor.lastValidAngle = bestAngle;
                    actor.body.setVelocity(Math.cos(bestAngle) * speed, Math.sin(bestAngle) * speed);
                };
            },
            update: function (time) {
                if (this.gameEnded) return;

                const targetNormalSpeed = 100;
                const targetFleeSpeed = 180;
                const killerSpeed = 150;
                const attackRange = 100;
                const detectionRange = 250;

                // --- 타겟 행동 제어 ---
                if (this.target && this.target.body) {
                    const dist1 = Phaser.Math.Distance.Between(this.target.x, this.target.y, this.killer1.x, this.killer1.y);
                    const dist2 = Phaser.Math.Distance.Between(this.target.x, this.target.y, this.killer2.x, this.killer2.y);

                    const fovDegrees = 120;
                    const fovRadians = Phaser.Math.DegToRad(fovDegrees);
                    const rayCount = 40; // 시야 정교화 (레이캐스트 수)

                    // 장애물 체크 함수 (레이캐스트)
                    const checkObstacle = (x1, y1, x2, y2) => {
                        const line = new Phaser.Geom.Line(x1, y1, x2, y2);
                        for (let wall of this.cachedWallBounds) {
                            if (Phaser.Geom.Intersects.LineToRectangle(line, wall)) return true;
                        }
                        return false;
                    };

                    // 각 킬러가 시야 콘 안에 있고 장애물에 가려지지 않았는지 체크
                    const checkInFOV = (killer, dist) => {
                        if (!killer || !killer.active) return false;
                        if (dist > detectionRange) return false;
                        if (dist < 50) return true; // 초근접 거리는 벽 뒤라도 직감으로 감지 (선택 사항)

                        const angleToKiller = Phaser.Math.Angle.Between(this.target.x, this.target.y, killer.x, killer.y);
                        const angleDiff = Math.abs(Phaser.Math.Angle.Wrap(angleToKiller - this.target.visualAngle)); // Use current visualAngle for check

                        if (angleDiff <= fovRadians / 2) {
                            // 시야각 내에 있다면 장애물 체크
                            return !checkObstacle(this.target.x, this.target.y, killer.x, killer.y);
                        }
                        return false;
                    };

                    const inFOV1 = checkInFOV(this.killer1, dist1);
                    const inFOV2 = checkInFOV(this.killer2, dist2);

                    const isPanicking = this.target.panicTime && time < this.target.panicTime;
                    const isFleeing = inFOV1 || inFOV2 || isPanicking;
                    const isStunned = this.target.stunTime && time < this.target.stunTime;

                    let nearestDetectedKiller;
                    if (isPanicking) {
                        // 공격을 받으면 시야에 없어도 공격자 반대편으로 도주
                        nearestDetectedKiller = this.target.panicSource;
                    } else {
                        nearestDetectedKiller = (inFOV1 && inFOV2) ? (dist1 < dist2 ? this.killer1 : this.killer2) : (inFOV1 ? this.killer1 : this.killer2);
                    }

                    if (isStunned) {
                        // [스턴 상태] 넉백 밀림 유지 및 감속. AI 조작 불능.
                        this.target.body.setVelocity(this.target.body.velocity.x * 0.9, this.target.body.velocity.y * 0.9);
                        if (this.targetLabel.text !== "STUNNED") {
                            this.targetLabel.setText("STUNNED").setFill('#aaaaaa');
                        }
                    } else {
                        // 1. AI 가동 (이동 속도 결정 및 이동 수행)
                        if (isFleeing) {
                            // [도망 모드] 감지된 위협으로부터 도망
                            this.moveWithAvoidance(this.target, null, targetFleeSpeed, nearestDetectedKiller);
                            if (this.targetLabel.text !== "CAUTION: EVADING") {
                                this.targetLabel.setText("CAUTION: EVADING").setFill('#ff0');
                            }
                        } else {
                            // [순찰 모드]
                            const dest = waypoints[currentWaypointIndex];
                            const distToDest = Phaser.Math.Distance.Between(this.target.x, this.target.y, dest.x, dest.y);
                            if (distToDest < 10) {
                                currentWaypointIndex = (currentWaypointIndex + 1) % waypoints.length;
                            } else {
                                this.moveWithAvoidance(this.target, dest, targetNormalSpeed);
                            }
                            if (this.targetLabel.text !== "TARGET") {
                                this.targetLabel.setText("TARGET").setFill('#f00');
                            }
                        }

                        // 2. 물리적 상태에 기반한 시각적 회전 및 시야 처리 (스턴 상태가 아닐 때만 적용)
                        const speed = this.target.body.speed;
                        const moveAngle = speed > 5
                            ? Math.atan2(this.target.body.velocity.y, this.target.body.velocity.x)
                            : (this.target.lastValidAngle || 0);

                        if (this.target.visualAngle === undefined) this.target.visualAngle = moveAngle;

                        // 180도 회전 시 지정된 전술적 회전 규칙 적용
                        const diff = Phaser.Math.Angle.Wrap(moveAngle - this.target.visualAngle);
                        if (Math.abs(diff) > Math.PI * 0.9) {
                            const targetGoingDown = moveAngle > 0 && moveAngle < Math.PI;
                            const step = targetGoingDown ? 0.15 : -0.15; // 회전 속도 약간 상향
                            this.target.visualAngle += step;
                        } else {
                            // 일반 회전 속도도 상향하여 반응성을 높임
                            this.target.visualAngle = Phaser.Math.Angle.RotateTo(this.target.visualAngle, moveAngle, 0.2);
                        }
                        const targetAngle = this.target.visualAngle;
                        this.target.rotation = targetAngle; // 몸체 회전 동기화

                        // 핵심 수정: 타겟이 미끄러지지 않도록 (Sliding 방지) 시선이 향하는 방향으로만 전진하게 보정
                        if (speed > 5) {
                            this.target.body.setVelocity(Math.cos(targetAngle) * speed, Math.sin(targetAngle) * speed);
                        }
                    }

                    const targetAngle = this.target.visualAngle || 0;

                    // 3. 시야 콘 그리기 (레이캐스팅 방식)
                    this.targetVision.clear();
                    const visionAlpha = isFleeing ? 0.2 : 0.1;
                    const visionColor = isFleeing ? 0xff6600 : 0xff0000;

                    this.targetVision.lineStyle(1, visionColor, visionAlpha * 1.5);
                    this.targetVision.fillStyle(visionColor, visionAlpha);

                    this.targetVision.beginPath();
                    this.targetVision.moveTo(this.target.x, this.target.y);

                    const enhancedRayCount = 60; // 수평 벽 투과 방지를 위해 레이캐스트 밀도 증가
                    const fovIntersection = []; // 최적화: 매 레이캐스트마다 배열을 생성하지 않고 하나를 재사용

                    for (let i = 0; i <= enhancedRayCount; i++) {
                        const rayAngle = (targetAngle - fovRadians / 2) + (fovRadians * (i / enhancedRayCount));
                        let rayEndX = this.target.x + Math.cos(rayAngle) * detectionRange;
                        let rayEndY = this.target.y + Math.sin(rayAngle) * detectionRange;

                        const line = new Phaser.Geom.Line(this.target.x, this.target.y, rayEndX, rayEndY);
                        let minOpacityDist = detectionRange;

                        for (let wall of this.cachedWallBounds) {
                            fovIntersection.length = 0; // 기존 배열 비우기 (GC 방지)
                            // 벽과 교차하는 점을 모두 찾아 가장 가까운 곳에서 레이를 끊음
                            if (Phaser.Geom.Intersects.GetLineToRectangle(line, wall, fovIntersection)) {
                                for (let p of fovIntersection) {
                                    const d = Phaser.Math.Distance.Between(this.target.x, this.target.y, p.x, p.y);
                                    if (d < minOpacityDist) {
                                        minOpacityDist = d;
                                        rayEndX = p.x;
                                        rayEndY = p.y;
                                    }
                                }
                            }
                        }
                        this.targetVision.lineTo(rayEndX, rayEndY);
                    }

                    this.targetVision.closePath();
                    this.targetVision.fillPath();
                    this.targetVision.strokePath();

                    this.targetLabel.setPosition(this.target.x - 25, this.target.y + 20);
                }

                // --- 킬러들 행동 처리 (통합 로직) ---
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

                    if (!agent.active) return; // 요원이 비활성화된 상태면 로직 생략

                    // [킬러 방향 및 시야 처리]
                    let killerAngle = agent.lastAngle || 0;

                    if (this.isDragRotating && this.selectedAgent === agent) {
                        // 1. 드래그(클릭 유지) 중이면 무조건 마우스 방향
                        killerAngle = Phaser.Math.Angle.Between(agent.x, agent.y, this.input.activePointer.worldX, this.input.activePointer.worldY);
                    } else if (agent.body.speed > 5) {
                        // 2. 이동 중이면 진행 방향
                        killerAngle = Math.atan2(agent.body.velocity.y, agent.body.velocity.x);
                    }
                    // 3. 드래그를 떼거나 정지 시에는 이전 각도(killerAngle)가 유지됨

                    agent.lastAngle = killerAngle;
                    agent.rotation = killerAngle; // 사각형 몸체도 회전

                    // 킬러 시야 그리기 (90도 원뿔)
                    const kFov = Phaser.Math.DegToRad(90);
                    const kRange = 200;
                    const kAlpha = this.selectedAgent === agent ? 0.2 : 0.1;

                    vision.lineStyle(1, color, kAlpha * 2);
                    vision.fillStyle(color, kAlpha);
                    vision.beginPath();
                    vision.moveTo(agent.x, agent.y);
                    vision.arc(agent.x, agent.y, kRange, killerAngle - kFov / 2, killerAngle + kFov / 2);
                    vision.closePath();
                    vision.fillPath();
                    vision.strokePath();

                    const distToTarget = (this.target && this.target.active)
                        ? Phaser.Math.Distance.Between(agent.x, agent.y, this.target.x, this.target.y)
                        : Infinity;

                    // 통합 사격-벽 차폐 검사 (중복 연산 구조 최적화)
                    let lineOfSightBlocked = true;
                    if (this.target && this.target.active) {
                        const atkLine = new Phaser.Geom.Line(agent.x, agent.y, this.target.x, this.target.y);
                        lineOfSightBlocked = false;
                        for (let wall of this.cachedWallBounds) {
                            if (Phaser.Geom.Intersects.LineToRectangle(atkLine, wall)) {
                                lineOfSightBlocked = true;
                                break;
                            }
                        }
                    }

                    // [자율 교전 시스템 (Overwatch)] 대기 중 시야에 타겟이 들어오면 자동 추적 및 공격 전환
                    if (!isAttacking && !dest && !lineOfSightBlocked && distToTarget <= kRange) {
                        const angleToTarget = Phaser.Math.Angle.Between(agent.x, agent.y, this.target.x, this.target.y);
                        const angleDiff = Math.abs(Phaser.Math.Angle.Wrap(angleToTarget - killerAngle));

                        if (angleDiff <= kFov / 2) {
                            // 타겟 포착! 자동 추격 모드 활성화 (차폐 로직은 위에서 이미 완료)
                            if (agent === this.killer1) this.isAttacking1 = true;
                            else this.isAttacking2 = true;
                            isAttacking = true; // 현재 프레임 반영용
                            this.statusText.setText(`[ 시스템 경고: ${data.id} 타겟 식별, 강제 교전 개시 ]`);
                            this.statusText.setFill('#ff6600');
                        }
                    }

                    // [자동 공격 시스템] 사거리 안이고, 시야가 확보되었을 때 수행
                    const currentAttackRange = agent === this.killer1 ? 150 : 50;

                    if (distToTarget <= currentAttackRange && !lineOfSightBlocked) {
                        agent.body.setVelocity(0, 0); // 사격/근접 시 정지 (정밀 조준 및 타격 자세)

                        if (time > this.lastHitTime + 500) {
                            this.targetHits++;
                            this.lastHitTime = time;

                            // 피격 시 생존 본능 발동 (2초간 강제 패닉/도주)
                            this.target.panicTime = time + 2000;
                            this.target.panicSource = agent;

                            // Killer 2 (근접 전투) 특수 효과: 강력한 넉백 및 1초 스턴 (제압)
                            if (agent === this.killer2) {
                                this.target.stunTime = time + 1000;
                                const hitAngle = Phaser.Math.Angle.Between(agent.x, agent.y, this.target.x, this.target.y);
                                this.target.body.setVelocity(Math.cos(hitAngle) * 500, Math.sin(hitAngle) * 500); // 넉백 파워
                            }

                            if (this.targetHits >= 10) {
                                targetNeutralized = true;
                            }
                        }

                        // 시각적 공격 효과 분리
                        if (Phaser.Math.Between(0, 10) > 4) {
                            if (agent === this.killer1) {
                                // 총기 발사 궤적 (레이저)
                                line.lineStyle(2, 0x00ff00, 1);
                                line.lineBetween(agent.x, agent.y, this.target.x, this.target.y);
                            } else {
                                // 근접 타격 충격파 이펙트 (슬래시 원형)
                                line.lineStyle(4, 0x00ffff, 1);
                                line.strokeCircle(this.target.x, this.target.y, 25);
                            }
                            this.target.setStrokeStyle(4, 0xffffff);
                        } else {
                            this.target.setStrokeStyle(2, 0xff0000);
                        }
                    }
                    // [이동 로직] 사거리 밖이거나 타겟을 때릴 수 없는 상태일 때 이동 속행
                    else {
                        if (isAttacking && this.target && this.target.active) {
                            // 1. 추격 명령 수행 중
                            this.moveWithAvoidance(agent, this.target, killerSpeed);
                        } else if (dest) {
                            // 2. 일반 지점 이동 중
                            const d = Phaser.Math.Distance.Between(agent.x, agent.y, dest.x, dest.y);
                            if (d < 10) {
                                agent.body.setVelocity(0, 0);
                                if (agent === this.killer1) this.killer1Dest = null;
                                else this.killer2Dest = null;
                            } else {
                                this.moveWithAvoidance(agent, dest, killerSpeed);
                            }
                        } else {
                            // 3. 대기 상태
                            agent.body.setVelocity(0, 0);
                        }

                        // 공격 중이 아닐 때 타겟 테두리 초기화
                        if (!this.isAttacking1 && !this.isAttacking2) {
                            if (this.target && this.target.active) this.target.setStrokeStyle(2, 0xff0000);
                        }
                    }

                    if (label && label.active) {
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