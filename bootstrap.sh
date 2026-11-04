#!/bin/zsh
# 拉取外部依赖（读 deps.json）。用法：
#   bash bootstrap.sh            # 只拉 need=core 的
#   bash bootstrap.sh all        # 全部
#   bash bootstrap.sh <id> ...   # 指定
#   bash bootstrap.sh check      # 只检查本机有没有
# 本机代理极慢且 git clone 经代理会报 HTTP2 错，所以一律绕开代理；tarball 走 codeload 直连。
set -e
ROOT=$(cd "$(dirname "$0")" && pwd)
NOPROXY=(env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u all_proxy -u ALL_PROXY)
rows=$(python3 -I -c '
import json,os,sys
d=json.load(open(sys.argv[1],encoding="utf-8"))["deps"]
for x in d: print(x["id"],x["need"],x["mode"],x["url"],x["ref"],os.path.expanduser(x["path"]),sep="\t")
' "$ROOT/deps.json")
want=("$@"); [ ${#want} -eq 0 ] && want=(core)
echo "$rows" | while IFS=$'\t' read id need mode url ref p; do
  sel=0
  for w in $want; do [[ $w == all || $w == check || $w == $id || ( $w == core && $need == core ) ]] && sel=1; done
  [ $sel = 1 ] || continue
  if [ -e "$p" ]; then echo "✓ $id  $p"; continue; fi
  if [[ " $want " == *" check "* ]]; then echo "✗ $id  未下载（bash bootstrap.sh ${id}）"; continue; fi
  echo "↓ $id  → $p"
  mkdir -p "$(dirname "$p")"
  repo=${url#https://github.com/}
  if [ $mode = sparse ]; then
    $NOPROXY git -c http.version=HTTP/1.1 clone --filter=blob:none --sparse "$url" "$p"
    git -C "$p" checkout -q "$ref" 2>/dev/null || true
    echo "  稀疏克隆完成：用 git -C $p sparse-checkout add styles/<slug> 拉具体画风"
  else
    tmp=$(mktemp -d)
    curl -fsSL --noproxy '*' --max-time 600 "https://codeload.github.com/$repo/tar.gz/$ref" -o "$tmp/a.tgz" \
      || curl -fsSL --noproxy '*' --max-time 600 "https://codeload.github.com/$repo/tar.gz/refs/heads/main" -o "$tmp/a.tgz"
    mkdir -p "$p" && tar -xzf "$tmp/a.tgz" -C "$p" --strip-components 1 && rm -rf "$tmp"
  fi
  echo "✓ $id"
done
[[ " $want " == *" check "* ]] || python3 "$ROOT/index/build_index.py"
