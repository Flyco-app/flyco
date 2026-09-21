import { z } from 'zod';

export const avatarMaxBytes = 2 * 1024 * 1024;
const avatarMimeSchema = z.enum(['image/jpeg', 'image/png', 'image/webp']);

function matchesSignature(
  bytes: Uint8Array,
  mime: z.infer<typeof avatarMimeSchema>,
) {
  if (mime === 'image/jpeg')
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'image/png')
    return bytes
      .slice(0, 8)
      .every(
        (value, index) =>
          value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index],
      );
  return (
    new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  );
}

export function validateAvatar(file: File) {
  const mime = avatarMimeSchema.safeParse(file.type);
  if (!mime.success || file.size <= 0 || file.size > avatarMaxBytes)
    return null;
  return {
    mime: mime.data,
    extension: mime.data === 'image/jpeg' ? 'jpg' : mime.data.split('/')[1],
  };
}

export async function hasValidAvatarSignature(
  file: File,
  mime: z.infer<typeof avatarMimeSchema>,
) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  return bytes.length >= 12 && matchesSignature(bytes, mime);
}
