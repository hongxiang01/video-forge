#!/usr/bin/env python3
"""统一总目录：把各个画风库 / 动效库 / 自己的画风合成一份索引。
输出：index/index.json（机器读）+ index/catalog.md（人读）。
数据来源与路径都读 deps.json；某个库本机没有时跳过并在总目录里标出"未下载"。
用法：python3 ~/video-forge/index/build_index.py
"""
import json, os, re, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEPS = json.load(open(f'{ROOT}/deps.json', encoding='utf-8'))['deps']
P = {d['id']: os.path.expanduser(d['path']) for d in DEPS}
RAW = {d['id']: d['path'] for d in DEPS}  # 写进索引的路径保留 ~，换机器也能用
LIC = {d['id']: d['license'] for d in DEPS}
items, missing = [], []


def add(**k):
    items.append(k)


# ── lemo-opuscar：66 种画风 ──
lemo = P['lemo-opuscar']
cat = f'{lemo}/styleboard/catalog.json'
if os.path.exists(cat):
    for s in json.load(open(cat, encoding='utf-8')):
        add(type='画风', sub=s.get('cat', ''), name=s['cn'], id=s['slug'], src='lemo-opuscar',
            desc=s.get('line_cn', ''), tags=s.get('uses', []),
            local=os.path.isdir(f"{lemo}/styles/{s['slug']}"),
            path=f"styles/{s['slug']}/STYLE.md", fetch=f"git -C {RAW['lemo-opuscar']} sparse-checkout add styles/{s['slug']}")
else:
    missing.append('lemo-opuscar')

# ── huashu-art-motion：艺术风格配方 + 解说动画语法 ──
hu = P['huashu-art-motion']
idx = f'{hu}/references/风格配方/INDEX.md'
if os.path.exists(idx):
    seen, section = set(), ''
    for line in open(idx, encoding='utf-8'):
        if line.startswith('## '):
            section = line[3:].strip()
            continue
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        if len(cells) < 3:
            continue
        m = re.match(r'\[?([0-9]+_[A-Za-z_]+)\]?(?:\(([^)]+)\))?$', cells[0])
        if not m or m.group(1) in seen:
            continue
        sid = m.group(1)
        seen.add(sid)
        if m.group(2):  # 研究配方表：| [id](file) | 研究范围 | 状态 |
            sub, name, desc = '艺术风格·研究配方（未达实做）', cells[1].split('：')[0], cells[1] + '；' + cells[2]
        else:  # 材料层 / 时代标本表：| id | 风格 | 渲染器 | 母题 | 转场 | 质量 | 短板 |
            layer = '材料层' if '材料层' in section else ('时代标本' if '时代' in section else section[:8])
            sub, name = f'艺术风格·{layer}', cells[1]
            q = cells[5] if len(cells) > 5 else ''
            short = cells[6] if len(cells) > 6 else ''
            desc = f"{q} {cells[2]}" + (f"；短板：{short}" if short and short != '—' else '')
        add(type='画风', sub=sub, name=name, id=sid, src='huashu-art-motion', desc=desc[:140], tags=[], local=True,
            path=f'references/风格配方/{sid}.md', fetch='')
    for f in sorted(glob.glob(f'{hu}/references/动画语法/*.md')):
        txt = open(f, encoding='utf-8').read()
        title = txt.splitlines()[0].lstrip('# ').strip()
        one = re.search(r'一句话：(.+)', txt)
        add(type='解说语法', sub='动画语法', name=title, id=os.path.basename(f)[:-3], src='huashu-art-motion',
            desc=(one.group(1) if one else '')[:120], tags=[], local=True, path=os.path.relpath(f, hu), fetch='')
else:
    missing.append('huashu-art-motion')

# ── video-talkcraft：108 张动效卡 ──
tc = P['video-talkcraft']
ci = f'{tc}/references/cards-index.json'
if os.path.exists(ci):
    for c in json.load(open(ci, encoding='utf-8'))['cards']:
        add(type='动效', sub=c.get('category', ''), name=c['title'], id=c['slug'], src='video-talkcraft',
            desc=re.sub(r'\*\*', '', c.get('oneliner', ''))[:120], tags=c.get('semantics', []) + ([f"能量{c['energy']}"] if c.get('energy') else []),
            local=os.path.exists(f"{tc}/template/cards/{c['slug']}.tsx"), path=f"template/cards/{c['slug']}.tsx", fetch='')
else:
    missing.append('video-talkcraft')

# ── anything2explainer：流程 ──
ae = P['anything2explainer']
if os.path.isdir(ae):
    add(type='流程', sub='讲解片流水线', name='anything2explainer', id='anything2explainer', src='anything2explainer',
        desc='主题→调研→口播稿→TTS 时间轴→分镜→多 agent 并行构建→QC；文案写法 narration-guidance.md、踩坑 lessons.md', tags=['科普'], local=True, path='SKILL.md', fetch='')
else:
    missing.append('anything2explainer')

# ── 自己的：我的画风 / 方案 ──
for d in sorted(glob.glob(f'{ROOT}/my-styles/*/')):
    n = os.path.basename(d.rstrip('/'))
    add(type='画风', sub='我的画风', name=n, id=n, src='自有', desc='', tags=[], local=True, path=os.path.relpath(d, ROOT) + 'STYLE.md', fetch='')
for f in sorted(glob.glob(f'{ROOT}/recipes/*.md')):
    n = os.path.basename(f)[:-3]
    if n.startswith('_'):
        continue
    add(type='方案', sub='我的方案', name=n, id=n, src='自有', desc='', tags=[], local=True, path=os.path.relpath(f, ROOT), fetch='')

for it in items:
    it['license'] = LIC.get(it['src'], '自有')

os.makedirs(f'{ROOT}/索引', exist_ok=True)
json.dump({'missing': missing, 'items': items}, open(f'{ROOT}/index/index.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# ── 人读版 ──
order = ['方案', '画风', '解说语法', '动效', '流程']
L = ['# 总目录（自动生成，勿手改；重建：`python3 ~/video-forge/index/build_index.py`）', '']
L.append('| 类型 | 数量 | 来源 |')
L.append('|---|---|---|')
for t in order:
    xs = [i for i in items if i['type'] == t]
    if xs:
        L.append(f"| {t} | {len(xs)} | {'、'.join(sorted(set(i['src'] for i in xs)))} |")
if missing:
    L += ['', f"**未下载的库**：{'、'.join(missing)}（运行 `bash ~/video-forge/bootstrap.sh <库id>`）"]
L += ['', '许可：MIT / CC BY 可商用（注明出处）；PolyForm NC 仅非商业，代码不复制进本仓库。', '']
for t in order:
    xs = [i for i in items if i['type'] == t]
    if not xs:
        continue
    L += [f'## {t}', '']
    for sub in sorted(set(i['sub'] for i in xs), key=lambda s: (s != '我的画风', s)):
        ys = [i for i in xs if i['sub'] == sub]
        L += [f'### {sub}（{len(ys)}）', '', '| 名称 | id | 来源 | 本机 | 说明 | 标签 |', '|---|---|---|---|---|---|']
        for i in ys:
            d = i['desc'].replace('|', '／').replace('\n', ' ')
            L.append(f"| {i['name']} | `{i['id']}` | {i['src']} | {'✓' if i['local'] else '未拉'} | {d} | {'、'.join(i['tags'][:5])} |")
        L.append('')
open(f'{ROOT}/index/catalog.md', 'w', encoding='utf-8').write('\n'.join(L))
print(f"{len(items)} 条；缺：{missing or '无'}")
for t in order:
    print(t, sum(1 for i in items if i['type'] == t))
