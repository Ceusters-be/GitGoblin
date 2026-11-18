<script setup lang="ts">
import {
  ChevronRight,
  GitBranch,
  Check,
  ArrowDown,
  ArrowUp,
  Unplug,
  Search,
  Filter,
} from "lucide-vue-next";
import type { BranchNode } from "~/lib/branches";
import type { GitRef } from "~/lib/types";
defineProps<{
  nodes: BranchNode[];
  filtersDisabled?: boolean;
  activeFilter?: { name: string; mode: "only" | "exclude" };
}>();
const emit = defineEmits<{
  select: [branch: GitRef];
  rename: [branch: GitRef];
  filter: [branch: GitRef, mode: "only" | "exclude"];
  context: [event: MouseEvent | KeyboardEvent, branch: GitRef];
}>();
function renameWithKeyboard(event: KeyboardEvent, branch: GitRef) {
  if (!branch.name.startsWith("refs/heads/")) return;
  event.preventDefault();
  event.stopPropagation();
  emit("rename", branch);
}
function branchTitle(branch: GitRef) {
  if (!branch.name.startsWith("refs/heads/"))
    return branch.name.replace("refs/remotes/", "");
  const tracking = !branch.upstream
    ? "No upstream branch configured"
    : branch.upstreamGone
      ? `Upstream ${branch.upstream} is missing (fetch with prune to refresh)`
      : `${branch.upstream}: ${branch.behind || 0} incoming, ${branch.ahead || 0} outgoing commits (as of last fetch)`;
  return `${branch.name.slice("refs/heads/".length)}\n${tracking}`;
}
</script>

<template>
  <ul class="m-0 grid min-w-0 list-none grid-cols-1 gap-[2px] p-0 [details>&]:mt-[2px] [details>&]:pl-[14px]">
    <li v-for="node in nodes" :key="node.path">
      <details v-if="node.children.length" open>
        <AppTreeRow
          as="summary"
          class="tree-row min-h-[28px] cursor-pointer list-none hover:bg-[var(--hover)] hover:text-[var(--fg)] [&::-webkit-details-marker]:hidden"
          :title="node.path"
        >
          <ChevronRight
            class="shrink-0 [details[open]>summary>&]:rotate-90"
            :size="14"
          /><span>{{ node.name }}</span>
        </AppTreeRow>
        <BranchTree
          :nodes="node.children"
          :filters-disabled="filtersDisabled"
          :active-filter="activeFilter"
          @filter="(branch, mode) => $emit('filter', branch, mode)"
          @select="$emit('select', $event)"
          @rename="$emit('rename', $event)"
          @context="(event, branch) => $emit('context', event, branch)"
        />
      </details>
      <div
        v-else-if="node.branch"
        class="branch-row flex min-w-0 items-center rounded-[6px] hover:bg-[var(--hover)] focus-within:bg-[var(--hover)] [&.current]:bg-[var(--success-bg)]"
        :class="{ current: node.branch.current, 'has-filter': activeFilter?.name === node.branch.name }"
      >
        <AppTreeRow
          class="tree-row min-h-[28px] min-w-0 flex-1 hover:bg-transparent [.current>&]:font-semibold [.current>&]:text-[var(--success)] [.current>&>svg]:text-[var(--success)] [&>svg]:shrink-0"
          :title="branchTitle(node.branch)"
          :aria-current="node.branch.current ? 'true' : undefined"
          :aria-keyshortcuts="node.branch.name.startsWith('refs/heads/') && !filtersDisabled ? 'F2' : undefined"
          aria-haspopup="menu"
          @contextmenu="$emit('context', $event, node.branch)"
          @keydown.shift.f10.prevent="$emit('context', $event, node.branch)"
          @keydown.f2="renameWithKeyboard($event, node.branch)"
          @click="$emit('select', node.branch)"
        >
          <Check v-if="node.branch.current" :size="14" /><GitBranch
            v-else
            :size="14"
          />
          <span>{{ node.name }}</span>
          <span
            v-if="node.branch.name.startsWith('refs/heads/')"
            class="branch-tracking ml-auto flex shrink-0 gap-[5px] text-[10px] tabular-nums [&>span]:inline-flex [&>span]:items-center [&>span]:gap-[2px]"
          >
            <span
              v-if="!node.branch.upstream || node.branch.upstreamGone"
              class="upstream-warning text-[var(--warning)] text-[9px]"
            >
              <Unplug :size="12" aria-hidden="true" />
              <span v-if="node.branch.upstreamGone">Upstream gone</span>
              <span v-else class="sr-only">No upstream</span>
            </span>
            <template v-else>
              <span
                v-if="node.branch.behind"
                class="incoming text-[var(--accent)]"
                :title="`${node.branch.behind} commits to pull from ${node.branch.upstream}`"
                ><ArrowDown :size="12" />{{ node.branch.behind }}</span
              >
              <span
                v-if="node.branch.ahead"
                class="outgoing text-[var(--success)]"
                :title="`${node.branch.ahead} commits ahead of ${node.branch.upstream}`"
                ><ArrowUp :size="12" />{{ node.branch.ahead }}</span
              >
            </template>
          </span>
        </AppTreeRow>
        <div class="branch-actions flex shrink-0 items-center pr-[3px]">
          <AppButton
            size="icon"
            class="!w-[22px] !h-[22px] !p-[3px] aria-pressed:bg-[var(--selection)] aria-pressed:text-[var(--fg)] aria-pressed:border-[var(--line)] aria-pressed:hover:bg-[var(--selection)]"
            :disabled="filtersDisabled"
            :title="`Only view ${node.name}`"
            :aria-label="`Only view ${node.name}`"
            :aria-pressed="activeFilter?.name === node.branch.name && activeFilter.mode === 'only'"
            @click="$emit('filter', node.branch, 'only')"
            ><Search :size="13"
          /></AppButton>
          <AppButton
            size="icon"
            class="!w-[22px] !h-[22px] !p-[3px] aria-pressed:bg-[var(--selection)] aria-pressed:text-[var(--fg)] aria-pressed:border-[var(--line)] aria-pressed:hover:bg-[var(--selection)]"
            :disabled="filtersDisabled"
            :title="`Exclude ${node.name} from history`"
            :aria-label="`Exclude ${node.name} from history`"
            :aria-pressed="activeFilter?.name === node.branch.name && activeFilter.mode === 'exclude'"
            @click="$emit('filter', node.branch, 'exclude')"
            ><Filter :size="13"
          /></AppButton>
        </div>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.branch-tracking :deep(svg) {
  color: inherit;
}

@media (hover: hover) and (pointer: fine) {
  .branch-row:not(.current, .has-filter, :hover, :focus-within) .branch-actions {
    opacity: 0;
  }
}
</style>
