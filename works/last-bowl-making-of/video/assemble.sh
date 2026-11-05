#!/bin/zsh
# 讲解部分（Remotion 画面 + out/explainer.wav）接第六版新配乐版 → 幕后片整片；再抽检查帧、量响度。
set -e
D=${0:A:h}; W=$D/..; F=~/video-forge/films/last-bowl/out/最后一碗面-最终版-新配乐.mp4
OUT=$W/最后一碗面-幕后-初稿.mp4
# 第六版是全范围（yuvj420p），讲解部分是 tv 范围，先统一成 tv 范围再接，接缝处亮度不跳
ffmpeg -v error -y -i $D/out/explainer.mp4 -i $D/out/explainer.wav -i $F -filter_complex \
  "[0:v]fps=24,format=yuv420p,setsar=1[v0];[2:v]fps=24,scale=in_range=pc:out_range=tv,format=yuv420p,setsar=1[v1];\
[1:a]aformat=sample_rates=48000:channel_layouts=stereo[a0];[2:a]aformat=sample_rates=48000:channel_layouts=stereo[a1];\
[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]" \
  -map '[v]' -map '[a]' -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p -c:a aac -b:a 192k -ar 48000 -movflags +faststart $OUT
echo "== $OUT"
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate -of compact $OUT
ffmpeg -hide_banner -nostats -i $OUT -af ebur128=peak=true -f null - 2>&1 | grep -E '^\s+(I|LRA|Peak):'
# 静止检测：3 秒以上不动的段落（第六版里的定版除外）
ffmpeg -hide_banner -nostats -i $OUT -vf "freezedetect=n=0.002:d=3" -an -f null - 2>&1 | grep -E 'freeze_(start|duration)' || echo "无 3 秒以上静止"
