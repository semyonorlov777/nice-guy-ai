import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  ignoreCommand:
    "git diff --quiet HEAD^ HEAD -- ':(exclude)*.md' ':(exclude)docs/' ':(exclude).vscode/' ':(exclude).idea/' ':(exclude).claude/'",
};
