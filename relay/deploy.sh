#!/usr/bin/env bash
# Выкладка ретранслятора в Cloud Run (один экземпляр, Франкфурт).
# Требует: gcloud, вход в аккаунт, выбранный проект с биллингом, включённые Cloud Run и Cloud Build.
# Секреты задаются один раз в консоли Cloud Run (или --set-secrets), здесь не передаются.
set -euo pipefail
cd "$(dirname "$0")"
gcloud run deploy voice-relay \
  --source . \
  --region europe-west3 \
  --min-instances 1 --max-instances 1 \
  --concurrency 80 --timeout 3600 \
  --allow-unauthenticated
