import React, { useMemo } from "react";
import Svg, { Path, Rect } from "react-native-svg";
import { tokens } from "../theme";

// ISO/IEC 18004 QR Code (Sürüm 1–10, ECC Level L, Byte Modu, Mask 0)
// Harici paket gerektirmeden react-native-svg ile gerçek, tüm kameralar tarafından
// okunabilir QR kod üretir.
interface VersionSpec {
  version: number;
  size: number;
  dataCodewords: number;
  ecCodewordsPerBlock: number;
  blocks: number;
  alignment: number[];
}

const VERSION_SPECS: readonly VersionSpec[] = [
  { version: 1, size: 21, dataCodewords: 19, ecCodewordsPerBlock: 7, blocks: 1, alignment: [] },
  { version: 2, size: 25, dataCodewords: 34, ecCodewordsPerBlock: 10, blocks: 1, alignment: [6, 18] },
  { version: 3, size: 29, dataCodewords: 55, ecCodewordsPerBlock: 15, blocks: 1, alignment: [6, 22] },
  { version: 4, size: 33, dataCodewords: 80, ecCodewordsPerBlock: 20, blocks: 1, alignment: [6, 26] },
  { version: 5, size: 37, dataCodewords: 108, ecCodewordsPerBlock: 26, blocks: 1, alignment: [6, 30] },
  { version: 6, size: 41, dataCodewords: 136, ecCodewordsPerBlock: 18, blocks: 2, alignment: [6, 34] },
  { version: 7, size: 45, dataCodewords: 156, ecCodewordsPerBlock: 20, blocks: 2, alignment: [6, 22, 38] },
  { version: 8, size: 49, dataCodewords: 194, ecCodewordsPerBlock: 24, blocks: 2, alignment: [6, 24, 42] },
  { version: 9, size: 53, dataCodewords: 232, ecCodewordsPerBlock: 30, blocks: 2, alignment: [6, 26, 46] },
  { version: 10, size: 57, dataCodewords: 274, ecCodewordsPerBlock: 18, blocks: 4, alignment: [6, 28, 50] },
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGeneratorPoly(ecLen);
  const rem = new Uint8Array(ecLen);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    for (let j = 0; j < ecLen - 1; j++) {
      rem[j] = rem[j + 1] ^ gfMul(gen[j + 1], factor);
    }
    rem[ecLen - 1] = gfMul(gen[ecLen], factor);
  }
  return rem;
}

function utf8Bytes(str: string): number[] {
  const encoded = encodeURIComponent(str);
  const out: number[] = [];
  for (let i = 0; i < encoded.length; i++) {
    if (encoded[i] === "%") {
      out.push(parseInt(encoded.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      out.push(encoded.charCodeAt(i));
    }
  }
  return out;
}

export function encodeQrMatrix(text: string): boolean[][] {
  const bytes = utf8Bytes(text || "https://mapsbridge.com");
  const spec =
    VERSION_SPECS.find((s) => {
      const lenBits = s.version <= 9 ? 8 : 16;
      const neededBytes = Math.ceil((4 + lenBits + bytes.length * 8) / 8);
      return neededBytes <= s.dataCodewords;
    }) ?? VERSION_SPECS[VERSION_SPECS.length - 1];

  const lenBits = spec.version <= 9 ? 8 : 16;
  const maxBytes = Math.min(
    bytes.length,
    Math.floor((spec.dataCodewords * 8 - 4 - lenBits) / 8),
  );
  const payload = bytes.slice(0, maxBytes);

  const bits: number[] = [];
  const pushBits = (val: number, count: number) => {
    for (let i = count - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  };

  // Byte mode indicator (0100)
  pushBits(0b0100, 4);
  pushBits(payload.length, lenBits);
  for (const b of payload) pushBits(b, 8);

  const capacityBits = spec.dataCodewords * 8;
  const terminator = Math.min(4, capacityBits - bits.length);
  pushBits(0, terminator);
  while (bits.length % 8 !== 0) bits.push(0);

  const dataWords = new Uint8Array(spec.dataCodewords);
  for (let i = 0; i < bits.length / 8; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i * 8 + b];
    dataWords[i] = byte;
  }
  let padToggle = true;
  for (let i = bits.length / 8; i < spec.dataCodewords; i++) {
    dataWords[i] = padToggle ? 0xec : 0x11;
    padToggle = !padToggle;
  }

  // Bloklara ayır ve Reed-Solomon EC üret
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  const baseBlockSize = Math.floor(spec.dataCodewords / spec.blocks);
  const extraBlocks = spec.dataCodewords % spec.blocks;
  let offset = 0;
  for (let b = 0; b < spec.blocks; b++) {
    const len = baseBlockSize + (b >= spec.blocks - extraBlocks ? 1 : 0);
    const block = dataWords.slice(offset, offset + len);
    offset += len;
    dataBlocks.push(block);
    ecBlocks.push(rsEncode(block, spec.ecCodewordsPerBlock));
  }

  const finalCodewords: number[] = [];
  const maxDataBlockLen = baseBlockSize + (extraBlocks > 0 ? 1 : 0);
  for (let i = 0; i < maxDataBlockLen; i++) {
    for (let b = 0; b < spec.blocks; b++) {
      if (i < dataBlocks[b].length) finalCodewords.push(dataBlocks[b][i]);
    }
  }
  for (let i = 0; i < spec.ecCodewordsPerBlock; i++) {
    for (let b = 0; b < spec.blocks; b++) {
      finalCodewords.push(ecBlocks[b][i]);
    }
  }

  const size = spec.size;
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const setFunctionModule = (r: number, c: number, dark: boolean) => {
    if (r < 0 || r >= size || c < 0 || c >= size) return;
    matrix[r][c] = dark;
    reserved[r][c] = true;
  };

  // Finder patterns (3 köşe) + ayırıcılar
  const placeFinder = (row: number, col: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setFunctionModule(r, c, inOuter && (onBorder || inInner));
      }
    }
  };
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Alignment patterns
  const align = spec.alignment;
  for (let i = 0; i < align.length; i++) {
    for (let j = 0; j < align.length; j++) {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === align.length - 1) ||
        (i === align.length - 1 && j === 0)
      )
        continue;
      const cr = align[i];
      const cc = align[j];
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setFunctionModule(cr + dr, cc + dc, dark);
        }
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) setFunctionModule(6, i, i % 2 === 0);
    if (!reserved[i][6]) setFunctionModule(i, 6, i % 2 === 0);
  }

  // Dark module & format info rezerv alanı
  setFunctionModule(size - 8, 8, true);
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      if (!reserved[8][i]) setFunctionModule(8, i, false);
      if (!reserved[i][8]) setFunctionModule(i, 8, false);
    }
  }
  for (let i = 0; i < 8; i++) {
    if (!reserved[8][size - 1 - i]) setFunctionModule(8, size - 1 - i, false);
    if (!reserved[size - 1 - i][8]) setFunctionModule(size - 1 - i, 8, false);
  }

  // Veri bitlerini yerleştir (zikzak yukarı/aşağı)
  const allBits: number[] = [];
  for (const cw of finalCodewords) {
    for (let b = 7; b >= 0; b--) allBits.push((cw >>> b) & 1);
  }

  let bitIdx = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      const r = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        if (reserved[r][c]) continue;
        const bit = bitIdx < allBits.length ? allBits[bitIdx++] === 1 : false;
        // Mask 0: (r + c) % 2 === 0
        const masked = (r + c) % 2 === 0 ? !bit : bit;
        matrix[r][c] = masked;
      }
    }
    upward = !upward;
  }

  // Format bilgisi: ECC Level L (01) + Mask 0 (000) -> BCH & XOR 0x5412 = 0x77c4 (30660)
  const formatBits = 0x77c4;
  const fBit = (idx: number) => ((formatBits >>> idx) & 1) === 1;

  for (let i = 0; i <= 5; i++) setFunctionModule(8, i, fBit(14 - i));
  setFunctionModule(8, 7, fBit(8));
  setFunctionModule(8, 8, fBit(7));
  setFunctionModule(7, 8, fBit(6));
  for (let i = 9; i < 15; i++) setFunctionModule(14 - i, 8, fBit(14 - i));

  for (let i = 0; i < 8; i++) setFunctionModule(8, size - 1 - i, fBit(i));
  for (let i = 8; i < 15; i++) setFunctionModule(size - 15 + i, 8, fBit(i));

  return matrix;
}

export function QrCodeSvg({
  value,
  size = 168,
  title = "Konum QR Kodu",
}: {
  value: string;
  size?: number;
  title?: string;
}) {
  const { d, viewBoxSize } = useMemo(() => {
    const matrix = encodeQrMatrix(value);
    const quietZone = 2;
    const total = matrix.length + quietZone * 2;
    const parts: string[] = [];
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix.length; c++) {
        if (matrix[r][c]) {
          const x = c + quietZone;
          const y = r + quietZone;
          parts.push(`M${x},${y}h1v1h-1z`);
        }
      }
    }
    return { d: parts.join(""), viewBoxSize: total };
  }, [value]);

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      accessibilityLabel={title}
    >
      <Rect
        x={0}
        y={0}
        width={viewBoxSize}
        height={viewBoxSize}
        fill={tokens.color.neutral0}
        rx={1}
      />
      <Path d={d} fill={tokens.color.primary} />
    </Svg>
  );
}

