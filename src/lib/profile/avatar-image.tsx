'use client';

import Image from 'next/image';

export function AvatarImage({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      loader={({ src: value }) => value}
      unoptimized
      src={src}
      alt={alt}
      width={96}
      height={96}
      className="size-24 rounded-full object-cover"
    />
  );
}
