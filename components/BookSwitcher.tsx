"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { CheckIcon, ChevronDownIcon } from "@/components/icons/hub-icons";
import type { ProgramSwitcherItem } from "@/lib/queries/all-programs";

interface BookSwitcherProps {
  variant: "desktop" | "mobile";
  currentSlug: string;
  programs: ProgramSwitcherItem[];
  collapsed?: boolean;
  destination?: "hub" | "landing";
}

export function BookSwitcher({
  variant,
  currentSlug,
  programs,
  collapsed,
  destination = "hub",
}: BookSwitcherProps) {
  const buildHref = (slug: string) =>
    destination === "landing" ? `/program/${slug}` : `/program/${slug}/hub`;
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = programs.find((p) => p.slug === currentSlug);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open || variant !== "desktop") return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, variant]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (variant !== "mobile" || !open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, variant]);

  if (!current) return null;

  const list = (
    <>
      {programs.map((p) => {
        const isCurrent = p.slug === currentSlug;
        return (
          <Link
            key={p.slug}
            href={buildHref(p.slug)}
            className={`book-switcher-item${isCurrent ? " current" : ""}`}
            onClick={close}
            aria-current={isCurrent ? "page" : undefined}
          >
            <BookCover program={p} className="book-switcher-cover" />
            <div className="book-switcher-item-body">
              <div className="book-switcher-item-title">{p.title}</div>
              {p.author && (
                <div className="book-switcher-item-author">{p.author}</div>
              )}
            </div>
            {isCurrent ? (
              <span className="book-switcher-item-check">
                <CheckIcon size={14} />
              </span>
            ) : (
              <span className="book-switcher-item-arrow">›</span>
            )}
          </Link>
        );
      })}
      <Link href="/#catalog" className="book-switcher-all-link" onClick={close}>
        <span>Все книги</span>
        <span>›</span>
      </Link>
    </>
  );

  if (variant === "desktop") {
    return (
      <div ref={containerRef} className="book-switcher-wrap">
        <button
          type="button"
          className={`book-switcher-trigger${open ? " active" : ""}`}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={
            collapsed ? `Текущая книга: ${current.title}` : undefined
          }
          title={collapsed ? current.title : undefined}
        >
          <BookCover program={current} className="book-switcher-cover" />
          <div className="book-switcher-trigger-info">
            <div className="book-switcher-trigger-title">{current.title}</div>
            {current.author && (
              <div className="book-switcher-trigger-author">{current.author}</div>
            )}
          </div>
          <span className="book-switcher-chevron">
            <ChevronDownIcon size={14} />
          </span>
        </button>
        <div
          className={`book-switcher-dropdown${open ? " open" : ""}`}
          role="menu"
        >
          {list}
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className={`book-switcher-tab${open ? " active" : ""}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Сменить книгу"
      >
        <BookCover program={current} className="book-switcher-tab-cover" />
        <span className="mobile-tab-label">Книга</span>
      </button>
      {open && (
        <>
          <div className="auth-sheet-scrim" onClick={close} />
          <div
            className="auth-sheet mode-sheet open book-switcher-sheet"
            role="dialog"
            aria-label="Выберите книгу"
          >
            <div className="auth-sheet-handle" />
            <div className="book-switcher-sheet-title">Другие книги</div>
            <div className="book-switcher-sheet-list">{list}</div>
          </div>
        </>
      )}
    </>
  );
}

function BookCover({
  program,
  className,
}: {
  program: ProgramSwitcherItem;
  className: string;
}) {
  return (
    <div className={className}>
      {program.coverUrl ? (
        <img src={program.coverUrl} alt="" />
      ) : (
        <div className="book-switcher-cover-fallback">
          {(program.title || "?").trim().charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
}
