import Phaser from 'phaser';

export default class VisionSystem {
    constructor(scene) {
        this.scene = scene;
        this.sharedLine = new Phaser.Geom.Line();
        this.intersectionArray = [];
    }

    checkLineOfSightBlocked(source, target) {
        if (!target || !target.active) return true;
        this.sharedLine.setTo(source.x, source.y, target.x, target.y);
        for (let wall of this.scene.cachedWallBounds) {
            if (Phaser.Geom.Intersects.LineToRectangle(this.sharedLine, wall)) {
                return true;
            }
        }
        return false;
    }

    checkInFOV(target, killer, fovRadians, detectionRange) {
        if (!killer || !killer.active) return false;
        const dist = Phaser.Math.Distance.Between(target.x, target.y, killer.x, killer.y);
        if (dist > detectionRange) return false;
        if (dist < 50) return true;

        const angleToKiller = Phaser.Math.Angle.Between(target.x, target.y, killer.x, killer.y);
        const angleDiff = Math.abs(Phaser.Math.Angle.Wrap(angleToKiller - target.visualAngle));

        if (angleDiff <= fovRadians / 2) {
            const blocked = this.checkLineOfSightBlocked(target, killer);
            return !blocked;
        }
        return false;
    }

    renderRaycastVision(graphics, sourceX, sourceY, sourceAngle, detectionRange, fovRadians, color, alpha, rayCount = 60) {
        graphics.clear();
        graphics.lineStyle(1, color, alpha * 1.5);
        graphics.fillStyle(color, alpha);
        graphics.beginPath();
        graphics.moveTo(sourceX, sourceY);

        for (let i = 0; i <= rayCount; i++) {
            const rayAngle = (sourceAngle - fovRadians / 2) + (fovRadians * (i / rayCount));
            let rayEndX = sourceX + Math.cos(rayAngle) * detectionRange;
            let rayEndY = sourceY + Math.sin(rayAngle) * detectionRange;

            this.sharedLine.setTo(sourceX, sourceY, rayEndX, rayEndY);
            let minOpacityDist = detectionRange;

            for (let wall of this.scene.cachedWallBounds) {
                this.intersectionArray.length = 0;
                if (Phaser.Geom.Intersects.GetLineToRectangle(this.sharedLine, wall, this.intersectionArray)) {
                    for (let p of this.intersectionArray) {
                        const d = Phaser.Math.Distance.Between(sourceX, sourceY, p.x, p.y);
                        if (d < minOpacityDist) {
                            minOpacityDist = d;
                            rayEndX = p.x;
                            rayEndY = p.y;
                        }
                    }
                }
            }
            graphics.lineTo(rayEndX, rayEndY);
        }

        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
    }
}
