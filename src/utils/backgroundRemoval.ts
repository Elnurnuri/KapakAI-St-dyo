/**
 * Smart Edge-Aware Flood-Fill Background Removal & Alpha Matting
 * Preserves light-colored product interiors while removing complex or solid backgrounds cleanly.
 */

export interface BgRemovalOptions {
  tolerance?: number; // 10 - 80, default 34
  feather?: number; // 0 - 6px, default 1.5
  mode?: 'smart-flood' | 'global-color';
  protectCenter?: boolean;
}

export interface BgRemovalResult {
  cutoutDataUrl: string;
  uncroppedCutoutDataUrl: string;
  width: number;
  height: number;
  uncroppedWidth: number;
  uncroppedHeight: number;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

export async function sourceToBase64(src: string): Promise<{ base64: string; mimeType: string }> {
  if (src.startsWith('data:image/')) {
    const match = src.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
    return { base64: src, mimeType: match ? match[1] : 'image/png' };
  }
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(img, 0, 0);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  return { base64: dataUrl, mimeType: 'image/jpeg' };
}

export async function autoCropCutout(dataUrl: string, pad = 12): Promise<string> {
  const img = await loadImage(dataUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  let minX = w, minY = h, maxX = 0, maxY = 0;
  let hasFg = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3];
      if (a > 20) {
        hasFg = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasFg || maxX <= minX || maxY <= minY) return dataUrl;

  const cropX = Math.max(0, minX - pad);
  const cropY = Math.max(0, minY - pad);
  const cropW = Math.min(w - cropX, maxX - minX + pad * 2);
  const cropH = Math.min(h - cropY, maxY - minY + pad * 2);

  if (cropW < 20 || cropH < 20) return dataUrl;

  const out = document.createElement('canvas');
  out.width = cropW;
  out.height = cropH;
  const outCtx = out.getContext('2d');
  if (!outCtx) return dataUrl;
  outCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  return out.toDataURL('image/png');
}

/**
 * Pure flood-fill background segmentation on raw RGBA pixel buffer.
 * Exported for deterministic unit testing as well.
 */
export function computeForegroundAlpha(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options: BgRemovalOptions = {}
): { alphaMap: Float32Array; avgBg: [number, number, number] } {
  const { tolerance = 34, feather = 1.5, mode = 'smart-flood' } = options;
  const totalPixels = width * height;

  // 1. Sample border pixels to find dominant background color(s)
  const borderPalette: Array<[number, number, number]> = [];
  const stepX = Math.max(1, Math.floor(width / 40));
  const stepY = Math.max(1, Math.floor(height / 40));

  const pushUniqueColor = (r: number, g: number, b: number) => {
    for (const c of borderPalette) {
      if ((c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2 < 220) return;
    }
    if (borderPalette.length < 18) borderPalette.push([r, g, b]);
  };

  let sumR = 0, sumG = 0, sumB = 0, sumCount = 0;
  for (let x = 0; x < width; x += stepX) {
    for (const y of [1, height - 2]) {
      if (y < 0 || y >= height) continue;
      const idx = (y * width + x) * 4;
      if (data[idx + 3] > 200) {
        pushUniqueColor(data[idx], data[idx + 1], data[idx + 2]);
        sumR += data[idx]; sumG += data[idx + 1]; sumB += data[idx + 2]; sumCount++;
      }
    }
  }
  for (let y = 0; y < height; y += stepY) {
    for (const x of [1, width - 2]) {
      if (x < 0 || x >= width) continue;
      const idx = (y * width + x) * 4;
      if (data[idx + 3] > 200) {
        pushUniqueColor(data[idx], data[idx + 1], data[idx + 2]);
        sumR += data[idx]; sumG += data[idx + 1]; sumB += data[idx + 2]; sumCount++;
      }
    }
  }

  const avgBg: [number, number, number] =
    sumCount > 0 ? [sumR / sumCount, sumG / sumCount, sumB / sumCount] : [255, 255, 255];
  if (borderPalette.length === 0) borderPalette.push(avgBg);

  // Perceptual + chroma-sensitive color distance
  const colorDist = (r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) => {
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    const lumaDiff = 0.299 * dr + 0.587 * dg + 0.114 * db;
    const chromaSq = ((dr - lumaDiff) ** 2 + (dg - lumaDiff) ** 2 + (db - lumaDiff) ** 2) * 1.35;
    return Math.sqrt(lumaDiff * lumaDiff + chromaSq * 0.5);
  };

  const minBorderColorDist = (r: number, g: number, b: number) => {
    let best = Infinity;
    for (let i = 0; i < borderPalette.length; i++) {
      const c = borderPalette[i];
      const d = colorDist(r, g, b, c[0], c[1], c[2]);
      if (d < best) best = d;
    }
    return best;
  };

  // 2. Compute 3x3 Sobel edge gradient magnitude for reliable packaging rim detection
  const edgeMag = new Float32Array(totalPixels);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const tl = ((y - 1) * width + (x - 1)) * 4;
      const tc = ((y - 1) * width + x) * 4;
      const tr = ((y - 1) * width + (x + 1)) * 4;
      const ml = (y * width + (x - 1)) * 4;
      const mr = (y * width + (x + 1)) * 4;
      const bl = ((y + 1) * width + (x - 1)) * 4;
      const bc = ((y + 1) * width + x) * 4;
      const br = ((y + 1) * width + (x + 1)) * 4;

      let maxChannelGrad = 0;
      for (let c = 0; c < 3; c++) {
        const gx =
          -data[tl + c] + data[tr + c] - 2 * data[ml + c] + 2 * data[mr + c] - data[bl + c] + data[br + c];
        const gy =
          -data[tl + c] - 2 * data[tc + c] - data[tr + c] + data[bl + c] + 2 * data[bc + c] + data[br + c];
        const mag = Math.sqrt(gx * gx + gy * gy) / 4;
        if (mag > maxChannelGrad) maxChannelGrad = mag;
      }

      edgeMag[y * width + x] = maxChannelGrad;
    }
  }

  const alphaMap = new Float32Array(totalPixels);
  alphaMap.fill(1);

  if (mode === 'global-color') {
    const hardTol = tolerance * 0.65;
    const softTol = tolerance * 0.95 + 10;
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      if (data[idx + 3] < 10) {
        alphaMap[i] = 0;
        continue;
      }
      const d = minBorderColorDist(data[idx], data[idx + 1], data[idx + 2]);
      if (d <= hardTol) {
        alphaMap[i] = 0;
      } else if (d < softTol) {
        alphaMap[i] = (d - hardTol) / (softTol - hardTol);
      }
    }
  } else {
    // Border-seeded BFS Flood Fill
    const visited = new Uint8Array(totalPixels);
    const isBg = new Uint8Array(totalPixels);
    const queue = new Int32Array(totalPixels);
    let head = 0;
    let tail = 0;

    const maxBgDist = tolerance * 0.72;
    const stepLimit = Math.max(8, tolerance * 0.4);
    const edgeBarrier = Math.max(11, 28 - tolerance * 0.22);

    const trySeed = (x: number, y: number) => {
      const p = y * width + x;
      if (visited[p]) return;
      const idx = p * 4;
      if (data[idx + 3] < 20) {
        visited[p] = 1;
        isBg[p] = 1;
        queue[tail++] = p;
        return;
      }
      const d = minBorderColorDist(data[idx], data[idx + 1], data[idx + 2]);
      if (d <= maxBgDist * 1.1) {
        visited[p] = 1;
        isBg[p] = 1;
        queue[tail++] = p;
      }
    };

    for (let x = 0; x < width; x++) {
      trySeed(x, 0);
      trySeed(x, height - 1);
    }
    for (let y = 0; y < height; y++) {
      trySeed(0, y);
      trySeed(width - 1, y);
    }

    const dx4 = [1, -1, 0, 0];
    const dy4 = [0, 0, 1, -1];

    while (head < tail) {
      const cur = queue[head++];
      const cx = cur % width;
      const cy = (cur - cx) / width;
      const cIdx = cur * 4;
      const cr = data[cIdx];
      const cg = data[cIdx + 1];
      const cb = data[cIdx + 2];

      for (let dir = 0; dir < 4; dir++) {
        const nx = cx + dx4[dir];
        const ny = cy + dy4[dir];
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

        const np = ny * width + nx;
        if (visited[np]) continue;

        const nIdx = np * 4;
        if (data[nIdx + 3] < 20) {
          visited[np] = 1;
          isBg[np] = 1;
          queue[tail++] = np;
          continue;
        }

        const nr = data[nIdx];
        const ng = data[nIdx + 1];
        const nb = data[nIdx + 2];

        const dStep = colorDist(cr, cg, cb, nr, ng, nb);
        const dBg = minBorderColorDist(nr, ng, nb);

        // Stop reliably at edge boundaries so soft-white objects stay intact
        if (dBg <= maxBgDist && dStep <= stepLimit && edgeMag[np] < edgeBarrier) {
          visited[np] = 1;
          isBg[np] = 1;
          queue[tail++] = np;
        }
      }
    }

    // Also run subtle soft erosion/transition on immediate boundary pixels
    for (let i = 0; i < totalPixels; i++) {
      if (isBg[i]) {
        alphaMap[i] = 0;
      } else {
        const idx = i * 4;
        if (data[idx + 3] < 20) {
          alphaMap[i] = 0;
        }
      }
    }
  }

  // 3. Targeted boundary feathering (only blur pixels near alpha transitions so interior stays sharp)
  const radius = Math.max(0, Math.min(5, Math.round(feather)));
  if (radius > 0) {
    const finalAlpha = new Float32Array(alphaMap);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const p = y * width + x;
        const a = alphaMap[p];
        // Check if near boundary
        const isEdge =
          alphaMap[p - 1] !== a ||
          alphaMap[p + 1] !== a ||
          alphaMap[p - width] !== a ||
          alphaMap[p + width] !== a;

        if (!isEdge) continue;

        let sum = 0;
        let count = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) continue;
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= width) continue;
            sum += alphaMap[ny * width + nx];
            count++;
          }
        }
        finalAlpha[p] = sum / count;
      }
    }
    return { alphaMap: finalAlpha, avgBg };
  }

  return { alphaMap, avgBg };
}

export async function removeBackgroundClient(
  imageSource: string | HTMLImageElement,
  options: BgRemovalOptions = {}
): Promise<BgRemovalResult> {
  let img: HTMLImageElement;
  if (typeof imageSource === 'string') {
    img = await loadImage(imageSource);
  } else {
    img = imageSource;
  }

  const maxDim = 1100;
  let targetWidth = img.naturalWidth || img.width;
  let targetHeight = img.naturalHeight || img.height;

  if (targetWidth > maxDim || targetHeight > maxDim) {
    if (targetWidth > targetHeight) {
      targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
      targetWidth = maxDim;
    } else {
      targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
      targetHeight = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context not available');

  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
  const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const data = imgData.data;
  const totalPixels = targetWidth * targetHeight;

  const { alphaMap, avgBg } = computeForegroundAlpha(data, targetWidth, targetHeight, options);

  // Write alpha & decontaminate semi-transparent fringe colors against avgBg
  let minX = targetWidth, minY = targetHeight, maxX = 0, maxY = 0;
  let hasForeground = false;

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const a = alphaMap[i];
    const finalAlpha = Math.round(a * 255);
    data[idx + 3] = finalAlpha;

    // Color spill decontamination for semi-transparent edge pixels
    if (a > 0.08 && a < 0.92) {
      const invA = 1 / Math.max(a, 0.35);
      data[idx] = Math.min(255, Math.max(0, Math.round((data[idx] - (1 - a) * avgBg[0]) * invA)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round((data[idx + 1] - (1 - a) * avgBg[1]) * invA)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round((data[idx + 2] - (1 - a) * avgBg[2]) * invA)));
    }

    if (finalAlpha > 20) {
      hasForeground = true;
      const px = i % targetWidth;
      const py = (i - px) / targetWidth;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const uncroppedCutoutDataUrl = canvas.toDataURL('image/png');

  // Auto-crop to foreground bounding box with gentle padding
  let finalCanvas = canvas;
  if (hasForeground && maxX > minX && maxY > minY) {
    const pad = 12;
    const cropX = Math.max(0, minX - pad);
    const cropY = Math.max(0, minY - pad);
    const cropW = Math.min(targetWidth - cropX, maxX - minX + pad * 2);
    const cropH = Math.min(targetHeight - cropY, maxY - minY + pad * 2);

    if (cropW > 30 && cropH > 30) {
      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = cropW;
      croppedCanvas.height = cropH;
      const cCtx = croppedCanvas.getContext('2d');
      if (cCtx) {
        cCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        finalCanvas = croppedCanvas;
      }
    }
  }

  return {
    cutoutDataUrl: finalCanvas.toDataURL('image/png'),
    uncroppedCutoutDataUrl,
    width: finalCanvas.width,
    height: finalCanvas.height,
    uncroppedWidth: targetWidth,
    uncroppedHeight: targetHeight,
  };
}

/**
 * Magic Wand connected-component eraser for manual touch-up clicks
 */
export function magicWandEraseOnCanvas(
  canvas: HTMLCanvasElement,
  startX: number,
  startY: number,
  tolerance = 32
): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const x0 = Math.max(0, Math.min(w - 1, Math.round(startX)));
  const y0 = Math.max(0, Math.min(h - 1, Math.round(startY)));

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const startIdx = (y0 * w + x0) * 4;
  if (data[startIdx + 3] < 10) return;

  const targetR = data[startIdx];
  const targetG = data[startIdx + 1];
  const targetB = data[startIdx + 2];

  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;

  const startPos = y0 * w + x0;
  visited[startPos] = 1;
  queue[tail++] = startPos;

  const dx4 = [1, -1, 0, 0];
  const dy4 = [0, 0, 1, -1];

  while (head < tail) {
    const pos = queue[head++];
    const idx = pos * 4;
    data[idx + 3] = 0;

    const cx = pos % w;
    const cy = (pos - cx) / w;

    for (let d = 0; d < 4; d++) {
      const nx = cx + dx4[d];
      const ny = cy + dy4[d];
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const nPos = ny * w + nx;
      if (visited[nPos]) continue;

      const nIdx = nPos * 4;
      if (data[nIdx + 3] < 10) continue;

      const dr = data[nIdx] - targetR;
      const dg = data[nIdx + 1] - targetG;
      const db = data[nIdx + 2] - targetB;
      const dist = Math.sqrt(0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db);

      if (dist <= tolerance) {
        visited[nPos] = 1;
        queue[tail++] = nPos;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}
