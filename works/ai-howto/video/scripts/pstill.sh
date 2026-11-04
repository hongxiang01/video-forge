#!/bin/zsh
# 纸本片出静帧：pstill.sh <帧号(0起,逗号分隔)> <输出目录绝对路径> [bundle tag]
# 改代码后 bundle 需重建：传 REBUILD=1；多个 agent 并行时每人用自己的 tag（如 ch1/ch2a）避免互相覆盖。
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd); cd "$ROOT"
FR=$1; OUT=$2; TAG=${3:-main}
B=build_paper_$TAG
BROWSER=$(find ~/remotion-effects/node_modules/.remotion/chrome-headless-shell -type f -name chrome-headless-shell -perm -u+x | head -1)
[ "${REBUILD:-1}" = 1 ] && rm -rf "$B"
[ -d "$B" ] || npx remotion bundle src/index.ts --out-dir "$B" --log=error
mkdir -p "$OUT"
for N in ${(s:,:)FR}; do
  npx remotion still "$B" FilmSilent "$OUT/f_$(printf %05d $N).png" --frame=$N --browser-executable="$BROWSER" --log=error
done
ls "$OUT" | wc -l
