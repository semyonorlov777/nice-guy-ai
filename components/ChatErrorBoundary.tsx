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
          <div className="chat-error-container">
            <p>Ошибка загрузки чата</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="chat-error-retry"
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
