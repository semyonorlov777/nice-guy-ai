import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { DEFAULT_PROGRAM_SLUG } from "@/lib/constants";

export async function PublicHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="public-header">
      <Link href="/" className="logo">
        <div className="logo-icon">HC</div>
        <div className="logo-text">
          <span>He</span>Cлавный
        </div>
      </Link>
      {user ? (
        <Link href={`/program/${DEFAULT_PROGRAM_SLUG}/chat`} className="header-cta">
          В приложение
        </Link>
      ) : (
        <Link href="/auth" className="header-cta">
          Попробовать бесплатно
        </Link>
      )}
    </header>
  );
}
