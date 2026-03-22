"use client";

import * as Sentry from "@sentry/nextjs";
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ChatErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    Sentry.captureException(error, {
      tags: { component: "chat" },
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div
            style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}
          >
            <p>Ошибка загрузки чата</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              style={{
                marginTop: "12px",
                padding: "8px 16px",
                background: "var(--accent-soft)",
                border: "1px solid var(--accent-border)",
                borderRadius: "8px",
                cursor: "pointer",
                color: "var(--accent)",
              }}
            >
              Повторить
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
