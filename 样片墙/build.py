#!/usr/bin/env python3
"""生成画风样片墙。
  python3 build.py            → index.html（本地版：卡片里直接播放官方 720p 样片）
  python3 build.py artifact   → artifact.html（缩略图内嵌为 data URI，点卡片跳到官方视频链接；Artifact 会拦截外部媒体）
数据：~/mv-xue/lemo-opuscar/styleboard/catalog.json；缩略图：img/<slug>.jpg（官方 img/<slug>_0.jpg）。
"""
import base64, html, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
CATALOG = os.path.expanduser('~/mv-xue/lemo-opuscar/styleboard/catalog.json')
BASE = 'https://lemomo-ai.github.io/lemo-opuscar'

# 新手入口：中文用途 → 匹配 catalog 里 uses 标签的英文关键词
PURPOSES = [
    ('新闻 / 时事', ['news', 'bulletin', 'fact-check', 'incident', 'journalism', 'report']),
    ('科普 / 讲解', ['explainer', 'science', 'lesson', 'course', 'how-to', 'learning', 'engineering', 'myth-busting', 'process']),
    ('历史 / 文化', ['history', 'heritage', 'archive', 'museum', 'era', 'folk', 'legend', 'wuxia', 'poetry', 'cultur', 'myth']),
    ('品牌 / 广告', ['brand', 'ads', 'identity', 'hospitality']),
    ('产品 / 发布', ['product', 'launch', 'keynote', 'saas', 'spec', 'feature', 'hardware', 'devices', 'consumer tech', 'onboarding']),
    ('数据 / 报告', ['data', 'report', 'market', 'growth', 'comparison', 'investor', 'annual']),
    ('儿童 / 绘本', ['kid', 'children', 'picture book', 'bedtime', 'toys']),
    ('城市 / 旅行', ['city', 'travel', 'tourism', 'destination', 'journey', 'place', 'urban', 'architecture', 'real estate']),
    ('音乐 / MV', ['music']),
    ('情感 / 故事', ['emotional', 'story', 'farewell', 'life milestone', 'silent', 'nostalgia']),
    ('节日 / 祝福', ['festiv', 'new year', 'holiday', 'greeting', 'invitation', 'gala']),
    ('游戏 / 奇幻', ['game', 'fantasy', 'sci-fi', 'horror', 'mystery', 'world building']),
    ('自然 / 环境', ['nature', 'wildlife', 'landscape', 'climate', 'environment', 'energy', 'season']),
    ('片头 / 预告', ['opener', 'title', 'trailer', 'teaser', 'poster']),
    ('体育', ['sport', 'match', 'coach']),
    ('轻松 / 社媒', ['social', 'humour', 'comedy', 'pet', 'calm', 'ambient', 'lifestyle', 'variety']),
]


def purposes_of(item):
    tags = ' | '.join(item['uses']).lower()
    return [i for i, (_, kws) in enumerate(PURPOSES) if any(k in tags for k in kws)]


def thumb_src(slug, embed):
    if not embed:
        return f'img/{slug}.jpg'
    small = os.path.join(HERE, 'img-s', f'{slug}.jpg')
    if not os.path.exists(small):
        os.makedirs(os.path.dirname(small), exist_ok=True)
        subprocess.run(['sips', '-Z', '400', '-s', 'formatOptions', '62', os.path.join(HERE, 'img', f'{slug}.jpg'),
                        '--out', small], check=True, capture_output=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(open(small, 'rb').read()).decode()


def card(item, embed):
    s = item['slug']
    e = html.escape
    film = f'{BASE}/films/{s}.mp4'
    media = (f'<a class="m" href="{film}" target="_blank" rel="noopener"><img loading="lazy" src="{thumb_src(s, True)}" alt=""><span class="play">▶ 看样片</span></a>'
             if embed else
             f'<div class="m"><video preload="none" controls playsinline poster="{thumb_src(s, False)}" src="{film}"></video></div>')
    tags = ''.join(f'<i>{e(u)}</i>' for u in item['uses'])
    p = ' '.join(f'p{i}' for i in purposes_of(item))
    return f'''<article class="card {p}" data-q="{e((item['cn'] + ' ' + item['en'] + ' ' + s + ' ' + item['line_cn']).lower())}">
  {media}
  <div class="t"><b>{e(item['cn'])}</b><span>{e(item['en'])}</span></div>
  <div class="slug">#{item['num']} · <code>{s}</code> · {round(item['dur'])} 秒 ·《{e(item['film'])}》</div>
  <p>{e(item['line_cn'])}</p>
  <div class="tags">{tags}</div>
</article>'''


def build(embed):
    items = json.load(open(CATALOG))
    cats = []
    for it in items:
        if it['cat'] not in cats:
            cats.append(it['cat'])
    sections = ''.join(
        f'<section><h2>{html.escape(c)} <small>{len([i for i in items if i["cat"] == c])}</small></h2><div class="grid">'
        + ''.join(card(i, embed) for i in items if i['cat'] == c) + '</div></section>'
        for c in cats)
    chips = '<button class="chip on" data-p="">全部</button>' + ''.join(
        f'<button class="chip" data-p="p{i}">{html.escape(n)}</button>' for i, (n, _) in enumerate(PURPOSES))
    tip = '点卡片在新窗口看官方样片' if embed else '点卡片直接播放（需联网）'
    return f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>画风样片墙 · 66 种</title>
<style>
:root{{--bg:#111216;--card:#1b1d23;--line:#2a2d36;--fg:#e9e7e2;--dim:#9a9aa3;--acc:#ffcf5a}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 -apple-system,"PingFang SC","Noto Sans SC",sans-serif}}
header{{position:sticky;top:0;z-index:2;background:rgba(17,18,22,.94);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding:16px 24px 12px}}
h1{{margin:0 0 4px;font-size:22px}}header p{{margin:0 0 10px;color:var(--dim);font-size:13px}}
.row{{display:flex;gap:8px;flex-wrap:wrap;align-items:center}}
.chip{{border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:99px;padding:4px 12px;font:inherit;font-size:13px;cursor:pointer}}
.chip.on{{background:var(--acc);color:#111;border-color:var(--acc)}}
input{{flex:0 0 220px;background:var(--card);border:1px solid var(--line);color:var(--fg);border-radius:8px;padding:5px 10px;font:inherit;font-size:13px}}
main{{padding:8px 24px 48px}}h2{{font-size:17px;margin:28px 0 12px}}h2 small{{color:var(--dim);font-weight:400}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}}
.m{{display:block;position:relative;aspect-ratio:16/9;background:#000}}.m img,.m video{{width:100%;height:100%;object-fit:cover;display:block}}
.play{{position:absolute;right:8px;bottom:8px;background:rgba(0,0,0,.7);color:#fff;font-size:12px;padding:2px 8px;border-radius:6px}}
.t{{padding:10px 12px 0;display:flex;gap:8px;align-items:baseline}}.t b{{font-size:16px}}.t span{{color:var(--dim);font-size:13px}}
.slug{{padding:2px 12px;color:var(--dim);font-size:12px}}code{{color:var(--acc)}}
.card p{{margin:6px 12px;font-size:13.5px}}.tags{{padding:0 12px 12px;display:flex;flex-wrap:wrap;gap:4px}}
.tags i{{font-style:normal;font-size:11px;color:var(--dim);border:1px solid var(--line);border-radius:4px;padding:0 5px}}
.hide{{display:none}}footer{{color:var(--dim);font-size:12px;padding:0 24px 32px}}a{{color:var(--acc)}}
</style></head><body>
<header><h1>画风样片墙 · 66 种</h1>
<p>不知道选什么画风？先按「我想做…」筛，再看样片。选中后把卡片上的 <code>slug</code> 告诉 Claude。{tip}。</p>
<div class="row">{chips}<input id="q" placeholder="搜名字、slug、内容…"></div></header>
<main>{sections}</main>
<footer>样片与截图：LemoLab · <a href="https://github.com/lemomo-ai/lemo-opuscar">lemo-opuscar</a>（影片 CC BY 4.0，代码 MIT）·
官方画廊 <a href="{BASE}/">{BASE}/</a></footer>
<script>
let p='',q='';
function apply(){{document.querySelectorAll('.card').forEach(c=>c.classList.toggle('hide',!!(p&&!c.classList.contains(p))||!!(q&&!c.dataset.q.includes(q))));
document.querySelectorAll('section').forEach(s=>s.classList.toggle('hide',!s.querySelector('.card:not(.hide)')));}}
document.querySelectorAll('.chip').forEach(b=>b.onclick=()=>{{document.querySelectorAll('.chip').forEach(x=>x.classList.remove('on'));b.classList.add('on');p=b.dataset.p;apply();}});
document.getElementById('q').oninput=e=>{{q=e.target.value.trim().toLowerCase();apply();}};
document.addEventListener('play',e=>document.querySelectorAll('video').forEach(v=>v!==e.target&&v.pause()),true);
</script></body></html>'''


if __name__ == '__main__':
    embed = len(sys.argv) > 1 and sys.argv[1] == 'artifact'
    out = os.path.join(HERE, 'artifact.html' if embed else 'index.html')
    open(out, 'w').write(build(embed))
    print(out, os.path.getsize(out))
