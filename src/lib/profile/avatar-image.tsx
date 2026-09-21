export function AvatarImage({ src, alt }: { src: string; alt: string }) {
  // A native image avoids the inline style emitted by next/image, preserving
  // the nonce-only CSP. The source is constructed from the validated Supabase URL.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={96}
      height={96}
      className="size-24 rounded-full object-cover"
    />
  );
}
