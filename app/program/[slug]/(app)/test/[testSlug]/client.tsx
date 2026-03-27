"use client";

import { TestCardFlow } from "@/components/TestCardFlow";
import type { TestConfig } from "@/lib/test-config";

export function TestClient({ testConfig }: { testConfig: TestConfig | null }) {
  if (!testConfig) {
    return <div className="text-center py-20 text-[var(--text-secondary)]">Тест не найден</div>;
  }
  return <TestCardFlow testConfig={testConfig} />;
}
