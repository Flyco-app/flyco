import { z } from 'zod';

export const ITEM_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const ITEM_PHOTO_MAX_COUNT = 5;

const photoSchema = z.object({
  type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  size: z.number().int().min(1).max(ITEM_PHOTO_MAX_BYTES),
});

const signatures: Record<string, (bytes: Uint8Array) => boolean> = {
  'image/jpeg': (bytes) =>
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  'image/png': (bytes) =>
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a,
  'image/webp': (bytes) =>
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP',
};

export async function validateItemPhoto(file: File): Promise<boolean> {
  if (!photoSchema.safeParse({ type: file.type, size: file.size }).success)
    return false;
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  return signatures[file.type]?.(bytes) ?? false;
}
