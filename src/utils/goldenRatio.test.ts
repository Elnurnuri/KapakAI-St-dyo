import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GOLDEN_MAJOR,
  GOLDEN_MINOR,
  computePixelCenterOfGravity,
  selectGoldenRatioTarget,
  computeGoldenRatioPlacement,
  getRenderedProductBoxPercent,
} from './goldenRatio';

test('computePixelCenterOfGravity finds bottom-right mass center accurately on transparent image', () => {
  const w = 100;
  const h = 100;
  const rgba = new Uint8ClampedArray(w * h * 4);

  // Place opaque product mass inside x: [60..90), y: [50..90) => center around (0.75, 0.70)
  for (let y = 50; y < 90; y++) {
    for (let x = 60; x < 90; x++) {
      const idx = (y * w + x) * 4;
      rgba[idx] = 40;
      rgba[idx + 1] = 40;
      rgba[idx + 2] = 40;
      rgba[idx + 3] = 255;
    }
  }

  const cog = computePixelCenterOfGravity(rgba, w, h);
  assert.equal(cog.source, 'pixel');
  assert.ok(Math.abs(cog.x - 0.75) < 0.02, `Expected cg.x ~0.75, got ${cog.x}`);
  assert.ok(Math.abs(cog.y - 0.7) < 0.02, `Expected cg.y ~0.70, got ${cog.y}`);
  assert.ok(cog.boundingBox);
  assert.ok(Math.abs(cog.boundingBox.xMin - 0.6) < 0.02);
  assert.ok(Math.abs(cog.boundingBox.xMax - 0.9) < 0.02);
});

test('selectGoldenRatioTarget places product opposite to typography alignment using phi points', () => {
  const leftTextTarget = selectGoldenRatioTarget({
    alignment: 'left',
    positionX: 7,
    positionY: 10,
  });
  assert.equal(leftTextTarget.id, 'right-golden');
  assert.ok(Math.abs(leftTextTarget.x - GOLDEN_MAJOR) < 0.2);
  assert.ok(Math.abs(leftTextTarget.y - GOLDEN_MAJOR) < 0.2);

  const rightTextTarget = selectGoldenRatioTarget({
    alignment: 'right',
    positionX: 92,
    positionY: 10,
  });
  assert.equal(rightTextTarget.id, 'left-golden');
  assert.ok(Math.abs(rightTextTarget.x - GOLDEN_MINOR) < 0.2);

  const centerTopTextTarget = selectGoldenRatioTarget({
    alignment: 'center',
    positionX: 50,
    positionY: 8,
  });
  assert.equal(centerTopTextTarget.id, 'bottom-center-golden');
  assert.equal(centerTopTextTarget.x, 50);
  assert.ok(Math.abs(centerTopTextTarget.y - GOLDEN_MAJOR) < 0.2);
});

test('computeGoldenRatioPlacement shifts geometric center so asymmetric center of gravity lands on golden point', () => {
  // Bottle with heavy base (cg.y = 0.65) and weight slightly right (cg.x = 0.58)
  const placement = computeGoldenRatioPlacement({
    aspectRatio: '4:5',
    typography: { alignment: 'left', positionX: 7, positionY: 9 },
    imgWidth: 600,
    imgHeight: 1000,
    centerOfGravity: {
      x: 0.58,
      y: 0.65,
      boundingBox: { xMin: 0.1, yMin: 0.05, xMax: 0.9, yMax: 0.95 },
      source: 'ai',
      confidence: 0.95,
      rationale: 'Şişe tabanı yoğun.',
    },
    currentScale: 1,
    autoScale: false,
  });

  const box = getRenderedProductBoxPercent({
    aspectRatio: '4:5',
    imgWidth: 600,
    imgHeight: 1000,
    scale: placement.scale,
  });

  // Product's actual center of gravity on canvas should match right-golden (61.8, 61.8)
  const renderedCgX = placement.x + (0.58 - 0.5) * box.widthPercent;
  const renderedCgY = placement.y + (0.65 - 0.5) * box.heightPercent;

  assert.ok(
    Math.abs(renderedCgX - 61.8) < 0.3,
    `Expected rendered CG X at 61.8%, got ${renderedCgX}`
  );
  assert.ok(
    Math.abs(renderedCgY - 61.8) < 0.3,
    `Expected rendered CG Y at 61.8%, got ${renderedCgY}`
  );
  assert.ok(placement.x < 61.8, 'Geometric center X should shift left to compensate right-heavy mass');
  assert.ok(placement.y < 61.8, 'Geometric center Y should shift up to compensate bottom-heavy mass');
});

test('computeGoldenRatioPlacement auto-scales padded uncropped images and clamps safely inside artboard', () => {
  // Product occupies only central 40% vertically inside uncropped photo, sitting near bottom edge
  const placement = computeGoldenRatioPlacement({
    aspectRatio: '1:1',
    typography: { alignment: 'left', positionX: 7, positionY: 9 },
    imgWidth: 1000,
    imgHeight: 1000,
    centerOfGravity: {
      x: 0.5,
      y: 0.85,
      boundingBox: { xMin: 0.3, yMin: 0.65, xMax: 0.7, yMax: 0.98 },
      source: 'ai',
      confidence: 0.9,
    },
    autoScale: true,
  });

  assert.ok(placement.scale > 1.0, `Expected auto-scale to enlarge small uncropped subject, got ${placement.scale}`);
  assert.ok(placement.x >= 12 && placement.x <= 88);
  assert.ok(placement.y >= 14 && placement.y <= 88);
});
