import crypto from 'crypto';
import type { UploadImageInput, UploadImageOutput, UploadStorage } from './upload.types';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_IMAGE_WIDTH = 8192;
const DEFAULT_MAX_IMAGE_HEIGHT = 8192;
const DEFAULT_MAX_IMAGE_PIXELS = 40_000_000;

function parsePositiveIntegerEnv(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

const MAX_IMAGE_WIDTH = parsePositiveIntegerEnv(process.env.UPLOAD_MAX_IMAGE_WIDTH, DEFAULT_MAX_IMAGE_WIDTH);
const MAX_IMAGE_HEIGHT = parsePositiveIntegerEnv(process.env.UPLOAD_MAX_IMAGE_HEIGHT, DEFAULT_MAX_IMAGE_HEIGHT);
const MAX_IMAGE_PIXELS = parsePositiveIntegerEnv(process.env.UPLOAD_MAX_IMAGE_PIXELS, DEFAULT_MAX_IMAGE_PIXELS);

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

interface ParsedPayload {
  mime_type?: string;
  content_base64: string;
}

interface ImageDimensions {
  width: number;
  height: number;
}

function validateImageDimensionsBounds(dimensions: ImageDimensions): void {
  if (dimensions.width > MAX_IMAGE_WIDTH || dimensions.height > MAX_IMAGE_HEIGHT) {
    throw new Error('IMAGE_DIMENSIONS_TOO_LARGE');
  }
  if (dimensions.width * dimensions.height > MAX_IMAGE_PIXELS) {
    throw new Error('IMAGE_PIXELS_EXCEEDED');
  }
}

function detectImageMimeByMagicNumber(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

function parsePngDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 24) {
    return null;
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}

function isJpegStart(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function parseJpegDimensions(buffer: Buffer): ImageDimensions | null {
  if (!isJpegStart(buffer)) {
    return null;
  }

  let offset = 2;
  while (offset + 1 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (offset < buffer.length && buffer[offset] === 0xff) {
      offset += 1;
    }
    if (offset >= buffer.length) {
      break;
    }

    const marker = buffer[offset];
    if (marker === undefined) {
      break;
    }
    offset += 1;

    if (
      marker === 0xd8 ||
      marker === 0xd9 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      continue;
    }

    if (offset + 1 >= buffer.length) {
      break;
    }
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) {
      return null;
    }

    const isStartOfFrame =
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf;

    if (isStartOfFrame) {
      if (segmentLength < 7) {
        return null;
      }
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      if (width <= 0 || height <= 0) {
        return null;
      }
      return { width, height };
    }

    offset += segmentLength;
  }

  return null;
}

function parseWebpDimensions(buffer: Buffer): ImageDimensions | null {
  if (
    buffer.length < 16 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    return null;
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkSize;
    if (dataEnd > buffer.length) {
      return null;
    }

    if (chunkType === 'VP8X' && chunkSize >= 10) {
      const w0 = buffer[dataStart + 4];
      const w1 = buffer[dataStart + 5];
      const w2 = buffer[dataStart + 6];
      const h0 = buffer[dataStart + 7];
      const h1 = buffer[dataStart + 8];
      const h2 = buffer[dataStart + 9];
      if (w0 === undefined || w1 === undefined || w2 === undefined || h0 === undefined || h1 === undefined || h2 === undefined) {
        return null;
      }
      const width = 1 + w0 + (w1 << 8) + (w2 << 16);
      const height = 1 + h0 + (h1 << 8) + (h2 << 16);
      if (width > 0 && height > 0) {
        return { width, height };
      }
    }

    if (chunkType === 'VP8 ' && chunkSize >= 10) {
      const width = buffer.readUInt16LE(dataStart + 6) & 0x3fff;
      const height = buffer.readUInt16LE(dataStart + 8) & 0x3fff;
      if (width > 0 && height > 0) {
        return { width, height };
      }
    }

    if (chunkType === 'VP8L' && chunkSize >= 5 && buffer[dataStart] === 0x2f) {
      const b0 = buffer[dataStart + 1];
      const b1 = buffer[dataStart + 2];
      const b2 = buffer[dataStart + 3];
      const b3 = buffer[dataStart + 4];
      if (b0 === undefined || b1 === undefined || b2 === undefined || b3 === undefined) {
        return null;
      }
      const width = 1 + (b0 | ((b1 & 0x3f) << 8));
      const height = 1 + ((b1 >> 6) | (b2 << 2) | ((b3 & 0x0f) << 10));
      if (width > 0 && height > 0) {
        return { width, height };
      }
    }

    const paddedChunkSize = chunkSize + (chunkSize % 2);
    offset = dataStart + paddedChunkSize;
  }

  return null;
}

function parseDimensionsByMagicNumber(body: Buffer, mimeType: string): ImageDimensions | null {
  if (mimeType === 'image/png') {
    return parsePngDimensions(body);
  }
  if (mimeType === 'image/jpeg') {
    return parseJpegDimensions(body);
  }
  if (mimeType === 'image/webp') {
    return parseWebpDimensions(body);
  }
  return null;
}

type SharpMetadataOutcome =
  | { status: 'ok'; dimensions: ImageDimensions }
  | { status: 'module_missing' }
  | { status: 'invalid_image' };

async function parseDimensionsWithSharp(body: Buffer): Promise<SharpMetadataOutcome> {
  try {
    const sharpModule = await import('sharp');
    const sharp = sharpModule.default;
    const metadata = await sharp(body, {
      limitInputPixels: MAX_IMAGE_PIXELS,
      failOn: 'warning',
    }).metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
      return { status: 'invalid_image' };
    }
    return { status: 'ok', dimensions: { width, height } };
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    const code = (error as { code?: string })?.code;
    if (message.includes('pixel') && message.includes('limit')) {
      throw new Error('IMAGE_PIXELS_EXCEEDED');
    }
    if (
      code === 'ERR_MODULE_NOT_FOUND' ||
      code === 'MODULE_NOT_FOUND' ||
      message.includes('cannot find module') ||
      message.includes('module not found')
    ) {
      return { status: 'module_missing' };
    }
    return { status: 'invalid_image' };
  }
}

async function validateImageDimensions(body: Buffer, mimeType: string): Promise<void> {
  const parsedByMagic = parseDimensionsByMagicNumber(body, mimeType);
  if (!parsedByMagic) {
    throw new Error('INVALID_IMAGE_DIMENSIONS');
  }
  validateImageDimensionsBounds(parsedByMagic);

  const sharpMetadata = await parseDimensionsWithSharp(body);
  if (sharpMetadata.status === 'ok') {
    validateImageDimensionsBounds(sharpMetadata.dimensions);
    return;
  }

  if (sharpMetadata.status === 'module_missing') {
    return;
  }

  throw new Error('INVALID_IMAGE_DIMENSIONS');
}

function parseDataUrl(dataUrl: string): ParsedPayload {
  const trimmed = dataUrl.trim();
  const matched = /^data:([^;]+);base64,(.+)$/i.exec(trimmed);
  if (!matched) {
    throw new Error('INVALID_DATA_URL');
  }
  const mimeType = matched[1];
  const contentBase64 = matched[2];
  if (!mimeType || !contentBase64) {
    throw new Error('INVALID_DATA_URL');
  }
  return {
    mime_type: mimeType.toLowerCase(),
    content_base64: contentBase64.trim(),
  };
}

async function parsePayload(input: UploadImageInput): Promise<{ mime_type: string; body: Buffer }> {
  let mimeType = (input.mime_type ?? '').trim().toLowerCase();
  let contentBase64 = (input.content_base64 ?? '').trim();
  const contentBuffer = input.content_buffer;

  if (!contentBase64 && !contentBuffer && input.data_url) {
    const parsed = parseDataUrl(input.data_url);
    contentBase64 = parsed.content_base64;
    if (!mimeType && parsed.mime_type) {
      mimeType = parsed.mime_type;
    }
  }

  if (!mimeType) {
    throw new Error('MIME_TYPE_REQUIRED');
  }
  if (!ALLOWED_MIME_TO_EXT[mimeType]) {
    throw new Error('MIME_TYPE_NOT_ALLOWED');
  }
  if (!contentBase64 && !contentBuffer) {
    throw new Error('EMPTY_FILE_CONTENT');
  }

  let body: Buffer | null = null;
  if (contentBuffer) {
    body = contentBuffer;
  } else {
    try {
      body = Buffer.from(contentBase64, 'base64');
    } catch (_error) {
      throw new Error('INVALID_BASE64_CONTENT');
    }
  }

  if (!body || !body.length) {
    throw new Error('EMPTY_FILE_CONTENT');
  }
  if (body.length > MAX_UPLOAD_BYTES) {
    throw new Error('FILE_TOO_LARGE');
  }
  const detectedMime = detectImageMimeByMagicNumber(body);
  if (!detectedMime) {
    throw new Error('INVALID_IMAGE_SIGNATURE');
  }
  if (detectedMime !== mimeType) {
    throw new Error('MIME_TYPE_MISMATCH');
  }
  await validateImageDimensions(body, mimeType);

  return {
    mime_type: mimeType,
    body,
  };
}

function buildObjectKey(userId: number, mimeType: string): string {
  const ext = ALLOWED_MIME_TO_EXT[mimeType];
  const date = new Date().toISOString().slice(0, 10);
  const rand = crypto.randomBytes(8).toString('hex');
  return `uploads/source/${userId}/${date}/${Date.now()}-${rand}.${ext}`;
}

export class UploadService {
  constructor(private readonly storage: UploadStorage) {}

  async uploadImage(input: UploadImageInput): Promise<UploadImageOutput> {
    if (!Number.isInteger(input.user_id) || input.user_id <= 0) {
      throw new Error('INVALID_USER_ID');
    }

    const parsed = await parsePayload(input);
    const key = buildObjectKey(input.user_id, parsed.mime_type);

    const uploaded = await this.storage.upload({
      key,
      body: parsed.body,
      content_type: parsed.mime_type,
    });

    return {
      image_url: uploaded.url,
      key,
      size_bytes: parsed.body.length,
      mime_type: parsed.mime_type,
    };
  }
}
