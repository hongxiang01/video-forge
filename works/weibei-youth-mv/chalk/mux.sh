#!/bin/bash
# 帧 + 歌曲：mux.sh 帧目录 输出.mp4
set -e
ffmpeg -y -loglevel error -framerate 30 -i "$1/f%05d.png" -ss 0 -t 147.03 -i ~/mv-xue/song.mp3 \
  -af "afade=t=out:st=145.3:d=1.7" -c:v libx264 -crf 17 -preset medium -pix_fmt yuv420p -c:a aac -b:a 192k -shortest "$2"
