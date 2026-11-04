#!/usr/bin/env python3
"""看门狗：盯住一个工作流的子 agent，发现卡住就退出（退出即通知主会话）。
用法（每次启动 Workflow 后，用 run_in_background 跑）：
  python3 watch_agents.py <工作流 transcript 目录> [--stall 秒，默认 660] [--every 秒，默认 30]
卡住的判定（满足任一条）：
  1. 某个 agent 最后一条记录是 api-request，且已过去 --stall 秒还没有回复；
  2. 某个 agent 连着两次 api-request 间隔 ≥ 9.5 分钟、中间没有回复（超时重试的特征）。
续跑（resumeFromRunId）时，被打断的旧 agent 会留下半截记录：journal 里同一个 label 后来又 started 过的旧 agent
不再检查（所以同一个工作流里每个 agent 的 label 要唯一）。
退出码：2 = 发现卡住（打印是哪个 agent、卡了多久）；0 = journal 里出现 workflow 结束标记。"""
import glob, json, os, sys, time
from datetime import datetime, timezone


def parse_ts(s):
    return datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp() if s else None


def agent_events(path):
    """返回 [(时间戳, 'req' | 'reply')]，只看请求和回复。"""
    out = []
    for line in open(path, errors='ignore'):
        try:
            j = json.loads(line)
        except ValueError:
            continue
        ts = parse_ts(j.get('timestamp'))
        if ts is None:
            continue
        if j.get('type') == 'api-request':
            out.append((ts, 'req'))
        elif (j.get('message') or {}).get('role') == 'assistant':
            out.append((ts, 'reply'))
    return out


def name_of(path):
    try:
        return json.load(open(path[:-6] + '.meta.json')).get('description', os.path.basename(path))
    except (OSError, ValueError):
        return os.path.basename(path)


def finished(d):
    try:
        lines = open(os.path.join(d, 'journal.jsonl')).read().splitlines()
    except OSError:
        return False
    return any(json.loads(l).get('type') in ('completed', 'done', 'finished', 'workflow-complete') for l in lines if l.strip())


def superseded(d):
    """同一个 label 后来又 started 过的旧 agentId（续跑前被打断、进程已经不在的）。"""
    latest, seen = {}, set()
    try:
        for l in open(os.path.join(d, 'journal.jsonl')):
            j = json.loads(l) if l.strip() else {}
            if j.get('type') == 'started' and j.get('agentId'):
                seen.add(j['agentId'])
                latest[j.get('label')] = j['agentId']
    except (OSError, ValueError):
        return set()
    return seen - set(latest.values())


def check(d, stall):
    now = time.time()
    skip = superseded(d)
    for f in glob.glob(os.path.join(d, 'agent-*.jsonl')):
        if os.path.basename(f)[len('agent-'):-len('.jsonl')] in skip:
            continue
        ev = agent_events(f)
        if not ev:
            continue
        for i, ((t1, k1), (t2, k2)) in enumerate(zip(ev, ev[1:])):
            if k1 == k2 == 'req' and t2 - t1 >= 570 and t2 > now - 1800:
                if any(k == 'reply' for _, k in ev[i + 2:]):   # 重试之后已经有回复：恢复了，不再报
                    continue
                return f'{name_of(f)}：{datetime.fromtimestamp(t1):%H:%M:%S} 发出的请求 {int((t2 - t1) / 60)} 分钟没回复，已经超时重试'
        t, k = ev[-1]
        if k == 'req' and now - t > stall:
            return f'{name_of(f)}：{datetime.fromtimestamp(t):%H:%M:%S} 发出的请求已经 {int((now - t) / 60)} 分钟没有回复'
    return None


def main():
    args = sys.argv[1:]
    d = args[0]
    stall = int(args[args.index('--stall') + 1]) if '--stall' in args else 660
    every = int(args[args.index('--every') + 1]) if '--every' in args else 30
    while True:
        msg = check(d, stall)
        if msg:
            print(f'✗ 卡住：{msg}\n  处理：停掉工作流，按 references/division-of-labor.md 把这一步拆小后重跑（已完成的 agent 用 resumeFromRunId 复用）。')
            sys.exit(2)
        if finished(d):
            print('✓ 工作流已结束，没有发现卡住的 agent')
            sys.exit(0)
        time.sleep(every)


if __name__ == '__main__':
    main()
