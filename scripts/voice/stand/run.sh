#!/bin/zsh
# Стенд проверки: пачка встреч бота текстом (+ голосовой разбор каждой) и проверяющий по свойствам.
# Запуск из корня рабочей копии:
#   STAND_DIR=<папка стенда> scripts/voice/stand/run.sh <метка> <повторов> <сценарий> [<сценарий> …]
# Сценарий:
#   lines:<имя>   — реплики из $STAND_DIR/lines/<имя>.txt, разбор — <имя>-debrief.txt (если есть)
#   persona:<имя> — студент-бот по описанию $STAND_DIR/personas/<имя>.txt (и во встрече, и в разборе)
# Клиент и режим: CLIENT (vera), MODE (voice_first_meeting), LIMIT (600). Сервер: WS_URL (по умолчанию прод).
# По очереди: в БД у пользователя одна живая сессия (voice_sessions_one_live_per_user), PAR больше 1 — только с разными STAND_USER. Пользователь-бот: STAND_USER (должен быть в app_config.voice_stand_users).
set -u
TAG=$1; N=$2; shift 2
: ${STAND_DIR:?нужна STAND_DIR}
CLIENT=${CLIENT:-vera}; MODE=${MODE:-voice_first_meeting}; SECONDS_LIMIT=${LIMIT:-600}
WS_URL=${WS_URL:-wss://nice-guy-ai.vercel.app/api/practice/ws}; PAR=${PAR:-1}
U=${STAND_USER:-e80f43d6-81be-4bdf-89ce-4918a28a5ba7}
R=$STAND_DIR/runs/$TAG; mkdir -p $R
one() {
  local sc=$1 k=$2 kind=${1%%:*} name=${1#*:}
  local id=$name-$k src=() dsrc=()
  if [[ $kind == lines ]]; then
    src=(--lines $STAND_DIR/lines/$name.txt)
    [[ -f $STAND_DIR/lines/$name-debrief.txt ]] && dsrc=(--lines $STAND_DIR/lines/$name-debrief.txt)
  else
    src=(--persona $STAND_DIR/personas/$name.txt); dsrc=(--persona $STAND_DIR/personas/$name.txt)
  fi
  [[ -f $R/$id.json ]] && return
  npx tsx --env-file=.env.local scripts/voice/ws-client.ts --user $U --url $WS_URL --mode $MODE --client $CLIENT \
    --seconds $SECONDS_LIMIT --text $src --out $R/$id --json $R/$id.json > $R/$id.log 2>&1 || { echo "сбой встречи $id"; return; }
  local sid=$(node -e "console.log(require('$R/$id.json').sessionId)")
  if (( ${#dsrc} )); then
    npx tsx --env-file=.env.local scripts/voice/ws-client.ts --user $U --url $WS_URL --text --debrief $sid $dsrc \
      --out $R/$id-d --json $R/$id-d.json > $R/$id-d.log 2>&1 || echo "сбой разбора $id"
  fi
  rm -f $R/$id/client.wav $R/$id-d/debrief.wav
  echo "готово $id ($sid)"
}
n=0
for sc in "$@"; do
  for k in $(seq 1 $N); do
    if (( PAR == 1 )); then one $sc $k; continue; fi
    one $sc $k &
    (( ++n % PAR == 0 )) && wait
  done
done
wait
ids=($(for f in $R/*.json; do [[ $f == *-d.json ]] || node -e "console.log(require('$f').sessionId)"; done))
npx tsx --env-file=.env.local scripts/voice/stand/judge.ts --out $R/judge --tag $TAG $ids
