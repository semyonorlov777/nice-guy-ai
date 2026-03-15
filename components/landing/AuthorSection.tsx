interface AuthorSectionProps {
  photo_url: string | null;
  name: string;
  credentials: string;
  quote: string;
}

export function AuthorSection({ photo_url, name, credentials, quote }: AuthorSectionProps) {
  return (
    <section className="author">
      <div className="author-inner">
        {photo_url && (
          <div className="author-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo_url} alt={name} />
          </div>
        )}
        <div className="author-quote">
          <div className="author-qm">&ldquo;</div>
          <blockquote>{quote}</blockquote>
        </div>
        <div className="author-name">{name}</div>
        <div className="author-creds">{credentials}</div>
      </div>
    </section>
  );
}
