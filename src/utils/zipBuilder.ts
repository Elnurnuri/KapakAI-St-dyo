/**
 * Zero-dependency binary ZIP archive builder (PKZIP STORE method + IEEE 802.3 CRC-32).
 * Ideal for bundling already-compressed PNG, JPEG, and WebP studio renders into a single download.
 */

export interface ZipFileEntry {
  name: string;
  data: Uint8Array;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function computeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;

  if (typeof atob === 'function') {
    const binary = atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }

  return new Uint8Array(Buffer.from(base64, 'base64'));
}

export function buildZipArchive(entries: ZipFileEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const prepared = entries.map((entry) => {
    const cleanName = entry.name.replace(/^\/+/, '');
    const nameBytes = encoder.encode(cleanName);
    const crc = computeCrc32(entry.data);
    return {
      nameBytes,
      data: entry.data,
      crc,
    };
  });

  // Calculate exact total byte length
  let localSectionBytes = 0;
  let centralSectionBytes = 0;
  for (const item of prepared) {
    localSectionBytes += 30 + item.nameBytes.length + item.data.length;
    centralSectionBytes += 46 + item.nameBytes.length;
  }
  const totalBytes = localSectionBytes + centralSectionBytes + 22;

  const buffer = new ArrayBuffer(totalBytes);
  const view = new DataView(buffer);
  const out = new Uint8Array(buffer);

  // Standard MS-DOS timestamp (valid fixed date: 2026-05-01 12:00:00)
  const dosTime = (12 << 11) | (0 << 5) | 0;
  const dosDate = ((2026 - 1980) << 9) | (5 << 5) | 1;

  const offsets: number[] = [];
  let cursor = 0;

  // 1. Write Local File Headers + File Payloads
  for (const item of prepared) {
    offsets.push(cursor);
    view.setUint32(cursor, 0x04034b50, true); // Local file header signature
    view.setUint16(cursor + 4, 20, true); // Version needed to extract (2.0)
    view.setUint16(cursor + 6, 0x0800, true); // General purpose bit flag (UTF-8 filenames)
    view.setUint16(cursor + 8, 0, true); // Compression method: 0 = STORE
    view.setUint16(cursor + 10, dosTime, true);
    view.setUint16(cursor + 12, dosDate, true);
    view.setUint32(cursor + 14, item.crc, true);
    view.setUint32(cursor + 18, item.data.length, true); // Compressed size
    view.setUint32(cursor + 22, item.data.length, true); // Uncompressed size
    view.setUint16(cursor + 26, item.nameBytes.length, true);
    view.setUint16(cursor + 28, 0, true); // Extra field length
    cursor += 30;

    out.set(item.nameBytes, cursor);
    cursor += item.nameBytes.length;

    out.set(item.data, cursor);
    cursor += item.data.length;
  }

  const centralDirStart = cursor;

  // 2. Write Central Directory Headers
  for (let i = 0; i < prepared.length; i++) {
    const item = prepared[i];
    view.setUint32(cursor, 0x02014b50, true); // Central directory signature
    view.setUint16(cursor + 4, 20, true); // Version made by
    view.setUint16(cursor + 6, 20, true); // Version needed
    view.setUint16(cursor + 8, 0x0800, true); // UTF-8 bit
    view.setUint16(cursor + 10, 0, true); // STORE
    view.setUint16(cursor + 12, dosTime, true);
    view.setUint16(cursor + 14, dosDate, true);
    view.setUint32(cursor + 16, item.crc, true);
    view.setUint32(cursor + 20, item.data.length, true);
    view.setUint32(cursor + 24, item.data.length, true);
    view.setUint16(cursor + 28, item.nameBytes.length, true);
    view.setUint16(cursor + 30, 0, true); // Extra length
    view.setUint16(cursor + 32, 0, true); // Comment length
    view.setUint16(cursor + 34, 0, true); // Disk number start
    view.setUint16(cursor + 36, 0, true); // Internal attrs
    view.setUint32(cursor + 38, 0, true); // External attrs
    view.setUint32(cursor + 42, offsets[i], true); // Relative offset of local header
    cursor += 46;

    out.set(item.nameBytes, cursor);
    cursor += item.nameBytes.length;
  }

  const centralDirSize = cursor - centralDirStart;

  // 3. Write End of Central Directory Record (EOCD)
  view.setUint32(cursor, 0x06054b50, true);
  view.setUint16(cursor + 4, 0, true); // Disk number
  view.setUint16(cursor + 6, 0, true); // Central dir start disk
  view.setUint16(cursor + 8, prepared.length, true); // Entries on disk
  view.setUint16(cursor + 10, prepared.length, true); // Total entries
  view.setUint32(cursor + 12, centralDirSize, true);
  view.setUint32(cursor + 16, centralDirStart, true);
  view.setUint16(cursor + 20, 0, true); // Comment length

  return out;
}
