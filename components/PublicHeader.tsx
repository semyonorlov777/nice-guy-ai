import Link from "next/link";
import { createClient } from "@/lib/supabase-server";

export async function PublicHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="public-header">
      <Link href="/" className="logo">
        <div className="logo-icon">К</div>
        <div className="logo-text">
          Книжный <span>Спарринг</span>
        </div>
      </Link>
      {user ? (
        <Link href="/" className="header-cta">
          В чат
        </Link>
      ) : (
        <Link href="/auth" className="header-cta">
          Попробовать бесплатно
        </Link>
      )}
    </header>
  );
}
