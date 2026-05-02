export interface ProcessImageResult {
  main: {
    buffer: Buffer;
    content_type: 'image/webp';
  };
  thumbnail: {
    buffer: Buffer;
    content_type: 'image/webp';
  };
}

export interface ImageProcessor {
  process(input: {
    buffer: Buffer;
    source_mime_type: string;
    thumbnail_width?: number;
  }): Promise<ProcessImageResult>;
}

export class SharpImageProcessor implements ImageProcessor {
  async process(input: {
    buffer: Buffer;
    source_mime_type: string;
    thumbnail_width?: number;
  }): Promise<ProcessImageResult> {
    try {
      const sharpModule = await import('sharp');
      const sharp = sharpModule.default;
      const thumbnailWidth = input.thumbnail_width ?? 480;

      const main = await sharp(input.buffer)
        .webp({ quality: 82, effort: 5 })
        .toBuffer();

      const thumbnail = await sharp(input.buffer)
        .resize({ width: thumbnailWidth, withoutEnlargement: true })
        .webp({ quality: 72, effort: 4 })
        .toBuffer();

      return {
        main: {
          buffer: main,
          content_type: 'image/webp',
        },
        thumbnail: {
          buffer: thumbnail,
          content_type: 'image/webp',
        },
      };
    } catch (_error) {
      // Fallback when sharp is not installed: keep original as main and thumbnail.
      return {
        main: {
          buffer: input.buffer,
          content_type: 'image/webp',
        },
        thumbnail: {
          buffer: input.buffer,
          content_type: 'image/webp',
        },
      };
    }
  }
}
