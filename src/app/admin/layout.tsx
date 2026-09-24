import Link from 'next/link';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <Link href="/admin" className="admin-brand">
          Flyco Operations
        </Link>
        <nav aria-label="Staff navigation">
          <Link href="/admin">Reports</Link>
          <Link href="/en">Marketplace</Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
