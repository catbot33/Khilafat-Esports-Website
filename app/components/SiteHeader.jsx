import Image from "next/image";
import Link from "next/link";
import AccountButton from "./AccountButton";

export default function SiteHeader({ pageHeader = false }) {
  return (
    <header className={`site-header${pageHeader ? " page-site-header" : ""}`}>
      <Link className="brand" href="/#top" aria-label="Khilafat Esports home">
        <Image
          src="/images/khilafat-logo.svg"
          alt="Khilafat"
          width={170}
          height={56}
          priority
        />
      </Link>

      <nav className="primary-nav" aria-label="Primary navigation">
        <Link href="/#top">Home</Link>
        <Link href="/tournaments">Tournaments</Link>
        <Link href="/live">Live</Link>
        <Link href="/looking-for-player">Looking for player</Link>
      </nav>

      <AccountButton />
    </header>
  );
}
