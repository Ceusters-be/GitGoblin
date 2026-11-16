import type { T3Message, T3Projection } from './types';
import { chatSubagents } from './chat-subagents';
import { chatActivities } from './chat-activity';

export function conversationTurns(projection: T3Projection | undefined, activeRunId?: string | null) {
  const pending = new Set(projection?.runs?.filter(run => run.status === 'queued' || (run.status === 'cancelled' && !run.startedAt)).map(run => run.userMessageId));
  const messages = [...(projection?.messages || [])].filter(message => !pending.has(message.id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const groups: T3Message[][] = [];
  for (const message of messages) {
    if (!groups.length || message.role === 'user') groups.push([]);
    groups.at(-1)!.push(message);
  }
  const messageGroups = new Map<string, number>();
  const runGroups = new Map<string, Set<number>>();
  function addRun(run: string, index: number) {
    if (!runGroups.has(run)) runGroups.set(run, new Set());
    runGroups.get(run)!.add(index);
  }
  groups.forEach((group, index) => {
    for (const message of group) {
      messageGroups.set(message.id, index);
      const run = message.runId || message.turnId;
      if (run) addRun(run, index);
    }
  });
  for (const run of projection?.runs || []) {
    const index = messageGroups.get(run.userMessageId);
    if (index !== undefined) addRun(run.id, index);
  }
  if (groups.length && activeRunId) addRun(activeRunId, groups.length - 1);
  function distribute<T>(items: T[], run: (item: T) => unknown, date: (item: T) => unknown, runOnly = false) {
    const buckets: T[][] = groups.map(() => []);
    for (const item of items) {
      const id = run(item);
      const targets = new Set(id ? runGroups.get(String(id)) : undefined);
      const time = date(item);
      if ((!runOnly || !id) && typeof time === 'string') {
        let low = 0, high = groups.length;
        while (low < high) {
          const middle = (low + high) >>> 1;
          if (groups[middle]![0]!.createdAt <= time) low = middle + 1;
          else high = middle;
        }
        if (low) targets.add(low - 1);
      }
      for (const index of targets) buckets[index]!.push(item);
    }
    return buckets;
  }
  const activityGroups = distribute(projection?.activities || [], item => item.turnId, item => item.createdAt);
  const itemGroups = distribute(projection?.turnItems || [], item => item.runId, item => item.startedAt || item.createdAt);
  const agentGroups = distribute(chatSubagents(projection), agent => agent.runId, agent => agent.startedAt || agent.updatedAt, true);
  return groups.map((group, index) => {
    const start = group[0]!.createdAt;
    const activities = chatActivities(projection && {
      ...projection, activities: activityGroups[index], turnItems: itemGroups[index]!,
    }, null, false);
    const subagents = agentGroups[index]!;
    const assistants = group.filter(message => message.role === 'assistant');
    const running = index === groups.length - 1 && (!!activeRunId || assistants.some(message => message.streaming));
    const final = assistants.at(-1);
    const work = group.filter(message => message.role !== 'user' && message !== final);
    const lastTime = final?.updatedAt || final?.createdAt;
    const seconds = lastTime ? Math.max(0, Math.round((Date.parse(lastTime) - Date.parse(start)) / 1000)) : NaN;
    const duration = Number.isFinite(seconds) ? seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s` : '';
    return { id: group[0]!.id, users: group.filter(message => message.role === 'user'), work, final, activities: activities.filter(activity => !subagents.some(agent => agent.itemId === activity.id)), subagents,
      summary: running ? 'Working…' : duration ? `Worked for ${duration}` : 'Work details' };
  });
}
