import {
  AspectRatio,
  BrandWatermark,
  CanvasLayer,
  FeatureBadge,
  FloatingElement,
  ProductPlacement,
  PromoBadge,
  StudioBackground,
  StudioTypography,
} from '../types';
import { loadImage } from './backgroundRemoval';
import { applyConvolutionSharpenToImageData } from './smartAutoFix';

export interface RenderCanvasParams {
  aspectRatio: AspectRatio;
  background: StudioBackground;
  product: ProductPlacement;
  typography: StudioTypography;
  badges: FeatureBadge[];
  badgesPosition?: { x: number; y: number };
  promoBadge: PromoBadge;
  floatingElements: FloatingElement[];
  layers?: CanvasLayer[];
  brandWatermark?: BrandWatermark;
  scaleMultiplier?: number; // 1 = 1080p, 2 = 2160p (4k)
}

export function getDimensionsForRatio(ratio: AspectRatio, baseWidth = 1080): { width: number; height: number } {
  switch (ratio) {
    case '1:1':
      return { width: baseWidth, height: baseWidth };
    case '9:16':
      return { width: baseWidth, height: Math.round(baseWidth * (16 / 9)) };
    case '4:5':
      return { width: baseWidth, height: Math.round(baseWidth * (5 / 4)) };
    case '16:9':
      return { width: Math.round(baseWidth * (16 / 9)), height: baseWidth };
  }
}

export async function renderHighResCover(params: RenderCanvasParams): Promise<HTMLCanvasElement> {
  const {
    aspectRatio,
    background,
    product,
    typography,
    badges,
    badgesPosition = { x: 7, y: 60 },
    promoBadge,
    floatingElements,
    layers,
    brandWatermark,
    scaleMultiplier = 1,
  } = params;

  const baseDims = getDimensionsForRatio(aspectRatio, 1080);
  const width = baseDims.width * scaleMultiplier;
  const height = baseDims.height * scaleMultiplier;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2d context');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 1. Draw Background with isolated blur, brightness, contrast & saturation
  ctx.save();
  const bgFilters: string[] = [];
  if (background.blur > 0) bgFilters.push(`blur(${background.blur * scaleMultiplier * 1.8}px)`);
  if (background.brightness !== 1) bgFilters.push(`brightness(${background.brightness})`);
  if (background.contrast !== undefined && background.contrast !== 1) {
    bgFilters.push(`contrast(${background.contrast})`);
  }
  if (background.saturation !== undefined && background.saturation !== 1) {
    bgFilters.push(`saturate(${background.saturation})`);
  }
  if (bgFilters.length > 0) ctx.filter = bgFilters.join(' ');

  if (background.type === 'image' && background.imageUrl) {
    if (background.gradient) {
      drawCssGradient(ctx, background.gradient, width, height);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    try {
      const bgImg = await loadImage(background.imageUrl);
      const imgRatio = (bgImg.naturalWidth || bgImg.width) / (bgImg.naturalHeight || bgImg.height);
      const canvasRatio = width / height;
      let dw = width, dh = height, dx = 0, dy = 0;
      if (background.fitMode === 'contain') {
        if (imgRatio > canvasRatio) {
          dh = width / imgRatio;
          dy = (height - dh) / 2;
        } else {
          dw = height * imgRatio;
          dx = (width - dw) / 2;
        }
      } else {
        if (imgRatio > canvasRatio) {
          dw = height * imgRatio;
          dx = (width - dw) / 2;
        } else {
          dh = width / imgRatio;
          dy = (height - dh) / 2;
        }
      }
      ctx.drawImage(bgImg, dx, dy, dw, dh);
    } catch {
      drawFallbackGradient(ctx, width, height);
    }
  } else if (background.type === 'gradient' && background.gradient) {
    drawCssGradient(ctx, background.gradient, width, height);
  } else {
    drawFallbackGradient(ctx, width, height);
  }
  ctx.restore();

  // Vignette overlay
  if (background.vignette) {
    const vignetteGrad = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.3,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.75
    );
    vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vignetteGrad.addColorStop(1, 'rgba(0,0,0,0.48)');
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, width, height);
  }

  // Stage Decor Layer (Champagne Arch & Marble Podium / Festive Lights)
  if (background.stageStyle === 'champagne-arch') {
    drawChampagneArchStage(ctx, width, height);
  } else if (background.stageStyle === 'festive-lights') {
    drawFestiveLightsStage(ctx, width, height);
  }

  // Helper renderers
  const drawProductLayer = async () => {
    if (!product.src) return;
    try {
      const prodImg = await loadImage(product.src);
      const prodNaturalW = prodImg.naturalWidth || prodImg.width;
      const prodNaturalH = prodImg.naturalHeight || prodImg.height;

      // Match DOM canvas visual proportion (~50% of artboard height at scale 1.0)
      const maxH = height * 0.48 * product.scale;
      const maxW = width * 0.46 * product.scale;
      const ratio = prodNaturalW / prodNaturalH;
      let targetH = maxH;
      let targetW = targetH * ratio;
      if (targetW > maxW) {
        targetW = maxW;
        targetH = targetW / ratio;
      }

      const centerX = (product.x / 100) * width;
      const centerY = (product.y / 100) * height;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate((product.rotation * Math.PI) / 180);
      if (product.flipX) ctx.scale(-1, 1);

      // Ambient glow behind product
      if (product.ambientGlow > 0) {
        const glowRadius = Math.max(targetW, targetH) * 0.85;
        const glowGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, glowRadius);
        glowGrad.addColorStop(0, product.glowColor || '#ffffff');
        glowGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.save();
        ctx.globalAlpha = product.ambientGlow * 0.6;
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Reflection
      if (product.reflection) {
        ctx.save();
        ctx.translate(0, targetH / 2);
        ctx.scale(1, -0.45);
        ctx.globalAlpha = product.reflectionOpacity * 0.6;
        ctx.drawImage(prodImg, -targetW / 2, -targetH, targetW, targetH);

        const maskGrad = ctx.createLinearGradient(0, -targetH, 0, 0);
        maskGrad.addColorStop(0, 'rgba(255,255,255,0)');
        maskGrad.addColorStop(1, 'rgba(255,255,255,0.92)');
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = maskGrad;
        ctx.fillRect(-targetW / 2, -targetH, targetW, targetH);
        ctx.restore();
      }

      // Studio Drop Shadow
      if (product.shadowOpacity > 0) {
        ctx.save();
        ctx.shadowColor = `rgba(0, 0, 0, ${product.shadowOpacity})`;
        ctx.shadowBlur = product.shadowBlur * scaleMultiplier * 1.4;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = product.shadowOffsetY * scaleMultiplier * 0.5;

        const shadowW = targetW * 0.85;
        const shadowH = 24 * scaleMultiplier * product.scale;
        const shadowY = targetH / 2 - 4 * scaleMultiplier;

        ctx.fillStyle = `rgba(0, 0, 0, ${product.shadowOpacity * 0.65})`;
        ctx.beginPath();
        ctx.ellipse(0, shadowY, shadowW / 2, shadowH / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Main product (with optional optical unsharp clarity pass)
      ctx.save();
      ctx.filter = `brightness(${product.brightness}) contrast(${product.contrast}) saturate(${product.saturation})`;
      const clarityAmt = product.clarity ?? 0;
      if (clarityAmt > 0.02 && targetW >= 8 && targetH >= 8) {
        const offW = Math.max(8, Math.round(targetW));
        const offH = Math.max(8, Math.round(targetH));
        const offCanvas = document.createElement('canvas');
        offCanvas.width = offW;
        offCanvas.height = offH;
        const offCtx = offCanvas.getContext('2d');
        if (offCtx) {
          offCtx.drawImage(prodImg, 0, 0, offW, offH);
          const rawImgData = offCtx.getImageData(0, 0, offW, offH);
          const sharpenedBytes = applyConvolutionSharpenToImageData(
            rawImgData.data,
            offW,
            offH,
            clarityAmt
          );
          const sharpImageData = new ImageData(
            new Uint8ClampedArray(sharpenedBytes),
            offW,
            offH
          );
          offCtx.putImageData(sharpImageData, 0, 0);
          ctx.drawImage(offCanvas, -targetW / 2, -targetH / 2, targetW, targetH);
        } else {
          ctx.drawImage(prodImg, -targetW / 2, -targetH / 2, targetW, targetH);
        }
      } else {
        ctx.drawImage(prodImg, -targetW / 2, -targetH / 2, targetW, targetH);
      }
      ctx.restore();

      ctx.restore();
    } catch (e) {
      console.error('Error drawing product image:', e);
    }
  };

  if (layers && layers.length > 0) {
    // Render bottom-to-top: layers[length-1] first, layers[0] last (frontmost)
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      if (!layer.visible) continue;

      if (layer.type === 'product') {
        await drawProductLayer();
      } else if (layer.type === 'typography') {
        drawTypography(ctx, typography, width, height, scaleMultiplier);
      } else if (layer.type === 'badges') {
        drawBadges(ctx, badges, badgesPosition, width, height, scaleMultiplier);
      } else if (layer.type === 'promoBadge') {
        if (promoBadge.show) {
          drawPromoBadge(ctx, promoBadge, width, height, scaleMultiplier);
        }
      } else if (layer.type === 'floating' && layer.floatingId) {
        const el = floatingElements.find((item) => item.id === layer.floatingId);
        if (el) {
          await drawFloatingElement(ctx, el, width, height, scaleMultiplier);
        }
      }
    }
  } else {
    await drawProductLayer();
    for (const el of floatingElements) {
      await drawFloatingElement(ctx, el, width, height, scaleMultiplier);
    }
    drawBadges(ctx, badges, badgesPosition, width, height, scaleMultiplier);
    if (promoBadge.show) {
      drawPromoBadge(ctx, promoBadge, width, height, scaleMultiplier);
    }
    drawTypography(ctx, typography, width, height, scaleMultiplier);
  }

  if (brandWatermark && brandWatermark.show && (brandWatermark.brandName.trim() || brandWatermark.logoUrl)) {
    await drawBrandWatermark(ctx, brandWatermark, width, height);
  }

  return canvas;
}

function parseColorStops(gradientStr: string): Array<{ color: string; stop?: number }> {
  const stopMatches = [...gradientStr.matchAll(/(#[a-fA-F0-9]{3,8}|rgba?\([^)]+\))(?:\s+(\d+(?:\.\d+)?)%)?/g)];
  if (stopMatches.length === 0) return [{ color: '#1e293b', stop: 0 }, { color: '#0f172a', stop: 1 }];
  return stopMatches.map((m, i) => ({
    color: m[1],
    stop: m[2] !== undefined ? Math.min(1, Math.max(0, Number(m[2]) / 100)) : i / Math.max(1, stopMatches.length - 1),
  }));
}

function drawCssGradient(ctx: CanvasRenderingContext2D, gradientStr: string, width: number, height: number) {
  const stops = parseColorStops(gradientStr);

  if (gradientStr.trim().startsWith('radial-gradient')) {
    const posMatch = gradientStr.match(/at\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/i);
    const cx = posMatch ? (Number(posMatch[1]) / 100) * width : width / 2;
    const cy = posMatch ? (Number(posMatch[2]) / 100) * height : height / 2;
    const maxR = Math.max(
      Math.hypot(cx, cy),
      Math.hypot(width - cx, cy),
      Math.hypot(cx, height - cy),
      Math.hypot(width - cx, height - cy)
    );
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
    stops.forEach((s, idx) => {
      grad.addColorStop(s.stop ?? idx / Math.max(1, stops.length - 1), s.color);
    });
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  const degMatch = gradientStr.match(/(\d+(?:\.\d+)?)deg/i);
  const angleRad = degMatch ? ((Number(degMatch[1]) - 90) * Math.PI) / 180 : Math.PI / 4;
  const r = Math.hypot(width, height) / 2;
  const cx = width / 2;
  const cy = height / 2;
  const grad = ctx.createLinearGradient(
    cx - Math.cos(angleRad) * r,
    cy - Math.sin(angleRad) * r,
    cx + Math.cos(angleRad) * r,
    cy + Math.sin(angleRad) * r
  );
  stops.forEach((s, idx) => {
    grad.addColorStop(s.stop ?? idx / Math.max(1, stops.length - 1), s.color);
  });
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

function drawFallbackGradient(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#f8fafc');
  grad.addColorStop(0.5, '#e2e8f0');
  grad.addColorStop(1, '#cbd5e1');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

function drawWrappedLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(/\s+/);
  let line = '';
  let y = startY;
  for (let n = 0; n < words.length; n++) {
    const testLine = line ? `${line} ${words[n]}` : words[n];
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = words[n];
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

function drawChampagneArchStage(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save();
  // Central glowing arch
  const archX = width * 0.12;
  const archW = width * 0.76;
  const archTop = height * 0.28;
  const archGrad = ctx.createLinearGradient(0, archTop, 0, height * 0.9);
  archGrad.addColorStop(0, 'rgba(254, 243, 199, 0.78)');
  archGrad.addColorStop(0.6, 'rgba(255, 251, 235, 0.35)');
  archGrad.addColorStop(1, 'rgba(255, 251, 235, 0)');
  ctx.fillStyle = archGrad;
  ctx.beginPath();
  ctx.roundRect(archX, archTop, archW, height * 0.64, [archW / 2, archW / 2, 0, 0]);
  ctx.fill();

  // Radial spotlight behind product
  const spot = ctx.createRadialGradient(width / 2, height * 0.56, 10, width / 2, height * 0.56, width * 0.42);
  spot.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
  spot.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = spot;
  ctx.fillRect(0, height * 0.25, width, height * 0.65);

  // Marble Podium
  const podY = height * 0.92;
  const podGrad = ctx.createLinearGradient(0, podY - height * 0.055, 0, podY + height * 0.055);
  podGrad.addColorStop(0, '#fefce8');
  podGrad.addColorStop(0.45, '#f5e6c8');
  podGrad.addColorStop(1, '#d6b88c');
  ctx.shadowColor = 'rgba(120, 53, 15, 0.28)';
  ctx.shadowBlur = width * 0.03;
  ctx.shadowOffsetY = height * 0.01;
  ctx.fillStyle = podGrad;
  ctx.beginPath();
  ctx.ellipse(width / 2, podY, width * 0.45, height * 0.055, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFestiveLightsStage(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save();
  // Snowy curve at bottom
  const snowGrad = ctx.createLinearGradient(0, height * 0.85, 0, height);
  snowGrad.addColorStop(0, 'rgba(255,255,255,0.95)');
  snowGrad.addColorStop(1, 'rgba(226,232,240,0.92)');
  ctx.fillStyle = snowGrad;
  ctx.beginPath();
  ctx.ellipse(width / 2, height * 1.0, width * 0.62, height * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Top fairy lights arc
  ctx.strokeStyle = 'rgba(254, 240, 138, 0.55)';
  ctx.lineWidth = Math.max(2, width * 0.003);
  ctx.beginPath();
  ctx.moveTo(0, height * 0.03);
  ctx.quadraticCurveTo(width * 0.5, height * 0.12, width, height * 0.03);
  ctx.stroke();

  for (let i = 1; i <= 9; i++) {
    const t = i / 10;
    const bx = width * t;
    const by = (1 - t) * (1 - t) * (height * 0.03) + 2 * (1 - t) * t * (height * 0.12) + t * t * (height * 0.03);
    const glow = ctx.createRadialGradient(bx, by, 1, bx, by, width * 0.025);
    glow.addColorStop(0, 'rgba(254, 240, 138, 0.95)');
    glow.addColorStop(0.35, 'rgba(253, 224, 71, 0.45)');
    glow.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(bx, by, width * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawTypography(
  ctx: CanvasRenderingContext2D,
  typo: StudioTypography,
  width: number,
  height: number,
  _s: number
) {
  // Scale typography relative to canvas width so 1:1 / 4:5 / 9:16 / 16:9 look consistent with DOM
  const scaleFactor = width / 500;
  const posX = (typo.positionX / 100) * width;
  const posY = (typo.positionY / 100) * height;
  const maxWidth = typo.alignment === 'center' ? width * 0.82 : width * 0.47;

  if (typo.plaqueStyle && typo.plaqueStyle !== 'none') {
    ctx.save();
    const boxW = maxWidth;
    const boxH =
      (typo.kicker ? 24 * scaleFactor : 0) +
      36 * typo.headlineSize * scaleFactor +
      (typo.headlineHighlight ? 28 * typo.headlineSize * scaleFactor : 0) +
      (!typo.subtitlePill && typo.subtitle ? 22 * scaleFactor : 0) +
      34 * scaleFactor;

    const centerX =
      typo.alignment === 'center'
        ? posX
        : typo.alignment === 'right'
        ? posX - boxW / 2
        : posX + boxW / 2;
    const centerY = posY + boxH / 2;

    ctx.translate(centerX, centerY);
    ctx.rotate(((typo.plaqueTilt ?? -2) * Math.PI) / 180);

    const grad = ctx.createLinearGradient(0, -boxH / 2, 0, boxH / 2);
    if (typo.plaqueStyle === 'emerald-3d') {
      grad.addColorStop(0, '#22c55e');
      grad.addColorStop(0.5, '#15803d');
      grad.addColorStop(1, '#14532d');
    } else if (typo.plaqueStyle === 'magenta-3d') {
      grad.addColorStop(0, '#f43f8e');
      grad.addColorStop(0.5, '#db2777');
      grad.addColorStop(1, '#831843');
    } else {
      grad.addColorStop(0, '#ef4444');
      grad.addColorStop(0.5, '#b91c1c');
      grad.addColorStop(1, '#7f1d1d');
    }

    ctx.shadowColor = 'rgba(0,0,0,0.34)';
    ctx.shadowBlur = 20 * scaleFactor;
    ctx.shadowOffsetY = 10 * scaleFactor;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, 16 * scaleFactor);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2.5 * scaleFactor;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    let cy = -boxH / 2 + 16 * scaleFactor;

    if (typo.kicker) {
      ctx.font = `800 ${Math.round(13 * scaleFactor)}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = typo.ctaTextColor || '#ffffff';
      ctx.fillText(typo.kicker.toUpperCase(), 0, cy, boxW - 24 * scaleFactor);
      cy += 20 * scaleFactor;
    }

    if (typo.headline) {
      const hSize = Math.round(33 * typo.headlineSize * scaleFactor);
      ctx.font = `900 ${hSize}px "${typo.fontFamily || 'Cabinet Grotesk'}", sans-serif`;
      ctx.fillStyle = typo.headlineColor || '#fde047';
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 6 * scaleFactor;
      ctx.shadowOffsetY = 3 * scaleFactor;
      ctx.fillText(typo.headline.toUpperCase(), 0, cy, boxW - 24 * scaleFactor);
      cy += hSize * 1.05;
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }

    if (typo.headlineHighlight) {
      const sSize = Math.round(23 * typo.headlineSize * scaleFactor);
      ctx.font = `900 ${sSize}px "${typo.fontFamily || 'Cabinet Grotesk'}", sans-serif`;
      ctx.fillStyle = typo.highlightColor || '#ffffff';
      ctx.fillText(typo.headlineHighlight.toUpperCase(), 0, cy, boxW - 24 * scaleFactor);
      cy += sSize * 1.1;
    }

    if (!typo.subtitlePill && typo.subtitle) {
      ctx.font = `800 ${Math.round(13 * scaleFactor)}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = typo.subtitleColor || '#ffffff';
      ctx.fillText(typo.subtitle.toUpperCase(), 0, cy + 4 * scaleFactor, boxW - 24 * scaleFactor);
    }

    if (typo.subtitlePill && typo.subtitle) {
      const pillFont = Math.round(12 * scaleFactor);
      ctx.font = `900 ${pillFont}px "Plus Jakarta Sans", sans-serif`;
      const tw = ctx.measureText(typo.subtitle.toUpperCase()).width;
      const pw = Math.min(boxW * 0.92, tw + 36 * scaleFactor);
      const ph = 26 * scaleFactor;
      const py = boxH / 2 - 4 * scaleFactor;
      ctx.fillStyle = '#fffbeb';
      ctx.shadowColor = 'rgba(0,0,0,0.18)';
      ctx.shadowBlur = 8 * scaleFactor;
      ctx.beginPath();
      ctx.roundRect(-pw / 2, py, pw, ph, 10 * scaleFactor);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = typo.subtitleColor || '#450a0a';
      ctx.textBaseline = 'middle';
      ctx.fillText(typo.subtitle.toUpperCase(), 0, py + ph / 2, pw - 16 * scaleFactor);
    }

    ctx.restore();
    return;
  }

  ctx.save();
  ctx.textAlign = typo.alignment;
  ctx.textBaseline = 'top';

  let currentY = posY;

  // Kicker
  if (typo.kicker) {
    ctx.font = `700 ${Math.round(11 * scaleFactor)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = typo.highlightColor || '#ea580c';
    ctx.fillText(typo.kicker.toUpperCase(), posX, currentY);
    currentY += 18 * scaleFactor;
  }

  // Main Headline
  if (typo.headline) {
    const fontSize = Math.round(30 * typo.headlineSize * scaleFactor);
    ctx.font = `800 ${fontSize}px "${typo.fontFamily || 'Cabinet Grotesk'}", sans-serif`;
    ctx.fillStyle = typo.headlineColor || '#0f172a';
    currentY = drawWrappedLines(ctx, typo.headline, posX, currentY, maxWidth, fontSize * 1.05);
  }

  // Highlight Headline line
  if (typo.headlineHighlight) {
    const fontSize = Math.round(30 * typo.headlineSize * scaleFactor);
    ctx.font = `800 ${fontSize}px "${typo.fontFamily || 'Cabinet Grotesk'}", sans-serif`;
    ctx.fillStyle = typo.highlightColor || '#ea580c';
    currentY = drawWrappedLines(ctx, typo.headlineHighlight, posX, currentY, maxWidth, fontSize * 1.08);
  }

  // Subtitle
  if (typo.subtitle) {
    currentY += 6 * scaleFactor;
    const subSize = Math.round(12 * scaleFactor);
    ctx.font = `500 ${subSize}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = typo.subtitleColor || '#334155';
    currentY = drawWrappedLines(ctx, typo.subtitle, posX, currentY, maxWidth, subSize * 1.38);
  }

  // CTA Button
  if (typo.showCta && typo.ctaText) {
    currentY += 10 * scaleFactor;
    const btnText = typo.ctaText.toUpperCase();
    ctx.font = `700 ${Math.round(11 * scaleFactor)}px "Plus Jakarta Sans", sans-serif`;
    const textWidth = ctx.measureText(btnText).width;
    const padX = 16 * scaleFactor;
    const btnW = textWidth + padX * 2;
    const btnH = 28 * scaleFactor;

    let btnX = posX;
    if (typo.alignment === 'center') btnX = posX - btnW / 2;
    if (typo.alignment === 'right') btnX = posX - btnW;

    ctx.fillStyle = typo.ctaBgColor || '#0f172a';
    ctx.beginPath();
    ctx.roundRect(btnX, currentY, btnW, btnH, 999 * scaleFactor);
    ctx.fill();

    ctx.fillStyle = typo.ctaTextColor || '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(btnText, btnX + btnW / 2, currentY + btnH / 2);
  }

  ctx.restore();
}

function drawBadges(
  ctx: CanvasRenderingContext2D,
  badges: FeatureBadge[],
  badgesPosition: { x: number; y: number },
  width: number,
  height: number,
  _s: number
) {
  if (!badges || badges.length === 0) return;

  const scaleFactor = width / 500;
  ctx.save();
  let startY = (badgesPosition.y / 100) * height;
  const startX = (badgesPosition.x / 100) * width;

  for (const b of badges) {
    const cardW = width * 0.42;
    const cardH = (b.sublabel ? 36 : 30) * scaleFactor;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.lineWidth = 1 * scaleFactor;

    ctx.beginPath();
    ctx.roundRect(startX, startY, cardW, cardH, 10 * scaleFactor);
    ctx.fill();
    ctx.stroke();

    // Rounded icon box
    const iconBoxSize = 20 * scaleFactor;
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.roundRect(startX + 8 * scaleFactor, startY + (cardH - iconBoxSize) / 2, iconBoxSize, iconBoxSize, 6 * scaleFactor);
    ctx.fill();

    // Mini check/dot inside icon box
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(startX + 8 * scaleFactor + iconBoxSize / 2, startY + cardH / 2, 3.2 * scaleFactor, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0f172a';
    ctx.font = `700 ${Math.round(11 * scaleFactor)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(
      b.label,
      startX + 34 * scaleFactor,
      b.sublabel ? startY + cardH * 0.36 : startY + cardH / 2,
      cardW - 42 * scaleFactor
    );

    if (b.sublabel) {
      ctx.fillStyle = '#475569';
      ctx.font = `400 ${Math.round(9 * scaleFactor)}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillText(
        b.sublabel,
        startX + 34 * scaleFactor,
        startY + cardH * 0.68,
        cardW - 42 * scaleFactor
      );
    }

    startY += cardH + 6 * scaleFactor;
  }

  ctx.restore();
}

function drawPromoBadge(
  ctx: CanvasRenderingContext2D,
  promo: PromoBadge,
  width: number,
  height: number,
  _s: number
) {
  const sf = width / 500;
  const x = (promo.x / 100) * width;
  const y = (promo.y / 100) * height;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((promo.rotation * Math.PI) / 180);
  ctx.scale(promo.scale * sf, promo.scale * sf);

  if (promo.type === 'circle') {
    const radius = 32;
    ctx.fillStyle = promo.color || '#ef4444';
    ctx.shadowColor = 'rgba(0,0,0,0.28)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = promo.textColor || '#ffffff';
    ctx.font = `800 12px "Cabinet Grotesk", sans-serif`;
    ctx.fillText(promo.text, 0, promo.subtext ? -6 : 0);

    if (promo.subtext) {
      ctx.font = `700 8.5px "Plus Jakarta Sans", sans-serif`;
      ctx.fillText(promo.subtext, 0, 9);
    }
  } else {
    ctx.font = `800 12px "Cabinet Grotesk", sans-serif`;
    const textW = ctx.measureText(promo.text).width;
    const badgeW = Math.max(textW + 24, 72);
    const badgeH = promo.subtext ? 38 : 30;

    ctx.fillStyle = promo.color || '#f59e0b';
    ctx.shadowColor = 'rgba(0,0,0,0.24)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH, 10);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = promo.textColor || '#ffffff';
    ctx.fillText(promo.text, 0, promo.subtext ? -6 : 0);

    if (promo.subtext) {
      ctx.font = `700 8.5px "Plus Jakarta Sans", sans-serif`;
      ctx.fillText(promo.subtext, 0, 9);
    }
  }

  ctx.restore();
}

async function drawFloatingElement(
  ctx: CanvasRenderingContext2D,
  el: FloatingElement,
  width: number,
  height: number,
  _s: number
) {
  const sf = width / 500;
  const x = (el.x / 100) * width;
  const y = (el.y / 100) * height;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((el.rotation * Math.PI) / 180);
  ctx.scale(el.scale * sf, el.scale * sf);
  ctx.globalAlpha = el.opacity;

  switch (el.type) {
    case 'water-splash': {
      const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, 28);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      grad.addColorStop(0.5, 'rgba(186, 230, 253, 0.7)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.ellipse(0, 0, 26, 15, 0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      for (const [dx, dy, r] of [[-16, -12, 3.5], [20, -8, 4], [8, 18, 2.5], [-12, 20, 3], [26, 14, 3]]) {
        ctx.beginPath();
        ctx.arc(dx, dy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'gold-coin': {
      ctx.shadowColor = 'rgba(161, 98, 7, 0.4)';
      ctx.shadowBlur = 8;
      const coinGrad = ctx.createLinearGradient(-18, -18, 18, 18);
      coinGrad.addColorStop(0, '#fef08a');
      coinGrad.addColorStop(0.5, '#eab308');
      coinGrad.addColorStop(1, '#a16207');
      ctx.fillStyle = coinGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#fef9c3';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#713f12';
      ctx.font = '800 13px "Cabinet Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('%', 0, 1);
      break;
    }

    case '3d-sphere': {
      const sphereGrad = ctx.createRadialGradient(-8, -8, 3, 0, 0, 22);
      sphereGrad.addColorStop(0, '#ffffff');
      sphereGrad.addColorStop(0.3, '#f43f5e');
      sphereGrad.addColorStop(1, '#881337');
      ctx.fillStyle = sphereGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 21, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'sparkle': {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.quadraticCurveTo(0, 0, 16, 0);
      ctx.quadraticCurveTo(0, 0, 0, 16);
      ctx.quadraticCurveTo(0, 0, -16, 0);
      ctx.quadraticCurveTo(0, 0, 0, -16);
      ctx.fill();
      break;
    }

    case 'leaf': {
      const leafGrad = ctx.createLinearGradient(-12, -16, 12, 16);
      leafGrad.addColorStop(0, '#f43f5e');
      leafGrad.addColorStop(1, '#fda4af');
      ctx.fillStyle = leafGrad;
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.quadraticCurveTo(16, -8, 12, 14);
      ctx.quadraticCurveTo(0, 20, -12, 14);
      ctx.quadraticCurveTo(-16, -8, 0, -18);
      ctx.fill();
      break;
    }

    case 'glow-ring': {
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.ellipse(0, 0, 48, 16, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }

    case 'gold-ribbon': {
      const ribGrad = ctx.createLinearGradient(-22, -22, 22, 22);
      ribGrad.addColorStop(0, '#fef08a');
      ribGrad.addColorStop(0.5, '#f59e0b');
      ribGrad.addColorStop(1, '#b45309');
      ctx.fillStyle = ribGrad;
      ctx.shadowColor = 'rgba(146, 64, 14, 0.35)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(-22, -16);
      ctx.bezierCurveTo(-4, -26, 20, -18, 14, -2);
      ctx.bezierCurveTo(8, 12, -12, 8, -4, 22);
      ctx.bezierCurveTo(4, 30, 22, 22, 26, 10);
      ctx.bezierCurveTo(14, 16, 4, 14, 4, 4);
      ctx.bezierCurveTo(4, -6, 22, -2, 24, -14);
      ctx.bezierCurveTo(12, -26, -8, -28, -22, -16);
      ctx.fill();
      break;
    }

    case 'custom-sticker': {
      if (el.imageUrl) {
        try {
          const stickerImg = await loadImage(el.imageUrl);
          const sw = stickerImg.naturalWidth || stickerImg.width;
          const sh = stickerImg.naturalHeight || stickerImg.height;
          const box = 112;
          const ratio = sw / sh;
          const drawW = ratio >= 1 ? box : box * ratio;
          const drawH = ratio >= 1 ? box / ratio : box;
          ctx.shadowColor = 'rgba(0, 0, 0, 0.32)';
          ctx.shadowBlur = 14;
          ctx.shadowOffsetY = 6;
          ctx.drawImage(stickerImg, -drawW / 2, -drawH / 2, drawW, drawH);
        } catch {
          // ignore unloaded custom sticker
        }
      }
      break;
    }
  }

  ctx.restore();
}

async function drawBrandWatermark(
  ctx: CanvasRenderingContext2D,
  wm: BrandWatermark,
  width: number,
  height: number
) {
  const scaleFactor = width / 500;
  const padX = width * 0.045;
  const padY = height * 0.038;
  const fontSize = Math.round(11 * scaleFactor);
  const label = wm.brandName.trim().toUpperCase();

  ctx.save();
  ctx.globalAlpha = Math.max(0.25, Math.min(1, wm.opacity));
  ctx.font = `800 ${fontSize}px "Plus Jakarta Sans", sans-serif`;

  const textW = label ? ctx.measureText(label).width : 0;
  const logoSize = wm.logoUrl ? 18 * scaleFactor : 0;
  const gap = wm.logoUrl && label ? 6 * scaleFactor : 0;
  const boxPadX = 10 * scaleFactor;
  const boxH = 26 * scaleFactor;
  const boxW = boxPadX * 2 + logoSize + gap + textW;

  const isRight = wm.position === 'top-right' || wm.position === 'bottom-right';
  const isBottom = wm.position === 'bottom-left' || wm.position === 'bottom-right';
  const bx = isRight ? width - padX - boxW : padX;
  const by = isBottom ? height - padY - boxH : padY;

  ctx.fillStyle = wm.theme === 'dark' ? 'rgba(15, 23, 42, 0.72)' : 'rgba(255, 255, 255, 0.84)';
  ctx.strokeStyle = wm.theme === 'dark' ? 'rgba(255, 255, 255, 0.22)' : 'rgba(15, 23, 42, 0.12)';
  ctx.lineWidth = 1 * scaleFactor;
  ctx.beginPath();
  ctx.roundRect(bx, by, boxW, boxH, boxH / 2);
  ctx.fill();
  ctx.stroke();

  let cursorX = bx + boxPadX;
  if (wm.logoUrl) {
    try {
      const logoImg = await loadImage(wm.logoUrl);
      ctx.drawImage(logoImg, cursorX, by + (boxH - logoSize) / 2, logoSize, logoSize);
      cursorX += logoSize + gap;
    } catch {
      // ignore failed watermark logo
    }
  }

  if (label) {
    ctx.fillStyle = wm.theme === 'dark' ? '#f8fafc' : '#0f172a';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(label, cursorX, by + boxH / 2);
  }

  ctx.restore();
}

