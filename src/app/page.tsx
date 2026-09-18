import Link from 'next/link';
export default function Home() {
  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-4 px-6">
      <h1 className="text-4xl font-semibold tracking-tight">Flyco</h1>
      <p className="text-muted-foreground">Le service est en préparation.</p>
      <Link href="/fr">Accéder à mon compte</Link>
    </main>
  );
}
