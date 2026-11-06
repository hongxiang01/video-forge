#!/bin/bash
# 歌词版：无字版帧 + 剪纸字幕层 + 歌曲：mux_lyrics.sh 帧目录 输出.mp4
set -e
ffmpeg -y -loglevel error -framerate 30 -i "$1/f%05d.png" -framerate 30 -i lyrics_ov/f%05d.png -ss 0 -t 147.03 -i ~/mv-xue/song.mp3 \
  -filter_complex "[0:v][1:v]overlay=0:0:format=auto[v]" -map "[v]" -map 2:a -af "afade=t=out:st=145.3:d=1.7" \
  -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p -c:a aac -b:a 192k -shortest "$2"
