<script setup lang="ts">
import { ArrowDown, ArrowUp, ChevronsUpDown, RefreshCw } from "lucide-vue-next";
import { invoke } from "~/lib/native";

import { authorColor, compareRequests, creationAge, prColumns, type PrColumn } from "~/lib/pull-request-table";
import type { PullRequest } from "~/lib/types";
const props = defineProps<{ repo: string; visible: boolean }>();
defineEmits<{ select: [pr: PullRequest] }>();
const requests = ref<PullRequest[]>([]);

const column = ref<PrColumn>("createdAt");
const ascending = ref(false);
const sortedRequests = computed(() => [...requests.value].sort((a, b) => compareRequests(a, b, column.value, ascending.value)));
function sortBy(next: PrColumn) {
  ascending.value = column.value === next ? !ascending.value : next !== "createdAt";
  column.value = next;
}

const busy = ref(true);
const error = ref("");

async function load(signIn = false) {
  busy.value = true;
  error.value = "";
  try {
    if (signIn) await invoke("devops_sign_in");
    requests.value = await invoke<PullRequest[]>("devops_pull_requests", { repo: props.repo });
  } catch (e) {
    error.value = String(e);
  } finally {
    busy.value = false;
  }
}

onMounted(() => load());
watch(() => props.visible, visible => { if (visible && !busy.value) load(); });
</script>

<template>
  <section class="flex min-h-0 flex-1 flex-col" aria-label="Repository pull requests">
    <header class="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--panel)] px-4 py-3">
      <h1 class="text-base font-semibold">Pull Requests <span v-if="!busy && !error" class="ml-1 text-xs text-[var(--muted)]">{{ requests.length }}</span></h1>
      <AppButton :disabled="busy" @click="load()"><RefreshCw :size="14" :class="{ 'motion-safe:animate-spin': busy }" />{{ busy ? (requests.length ? "Refreshing" : "Loading") : "Refresh" }}</AppButton>
    </header>
    <div v-if="error" class="p-4">
      <AppHint role="alert">{{ error }}</AppHint>
      <AppButton :disabled="busy" @click="load(true)">Sign in to Azure DevOps</AppButton>
    </div>

    <AppHint v-else-if="!busy && !requests.length">No active pull requests for this repository.</AppHint>
    <div v-else class="min-h-0 overflow-auto" :aria-busy="busy">
      <span v-if="busy" class="sr-only" role="status">Loading pull requests</span>
      <AppHint v-if="requests.some(pr => pr.needsReview === null)">Your review assignments are unavailable. Refresh to retry.</AppHint>
      <table aria-label="Active pull requests" class="w-full border-collapse text-left text-xs">
        <thead class="sticky top-0 bg-[var(--panel)] text-[var(--muted)] [&_th]:px-4 [&_th]:py-2 [&_th]:font-medium">
          <tr>
            <th v-for="[key, label] in prColumns" :key="key" scope="col" :class="{ 'w-2/5 min-w-52': key === 'title' }"
              :aria-sort="key === column ? (ascending ? 'ascending' : 'descending') : undefined">
              <button type="button" class="inline-flex items-center gap-1 whitespace-nowrap hover:text-[var(--fg)]"
                :class="{ 'text-[var(--fg)]': key === column }" @click="sortBy(key)">
                {{ label }}<component :is="key !== column ? ChevronsUpDown : ascending ? ArrowUp : ArrowDown" :size="12" aria-hidden="true" />
              </button>
            </th>
          </tr>
        </thead>
        <tbody v-if="busy && !requests.length" aria-hidden="true" class="motion-safe:animate-pulse">
          <tr v-for="row in 4" :key="row" class="border-b border-[var(--line)] [&_td]:px-4 [&_td]:py-3">
            <td>
              <div class="h-2.5 rounded bg-[var(--line)]" :class="row % 2 ? 'w-3/4' : 'w-1/2'" />
              <div class="mt-2 h-2 w-14 rounded bg-[var(--line)]" />
            </td>
            <td v-for="column in 4" :key="column"><div class="h-2 w-2/3 rounded bg-[var(--line)]" /></td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr v-for="pr in sortedRequests" :key="pr.id" @click="$emit('select', pr)"
            class="cursor-pointer border-b border-[var(--line)] hover:bg-[var(--hover)] focus-within:bg-[var(--hover)] [&_td]:px-4 [&_td]:py-3">
            <td class="w-2/5 min-w-52">
              <button type="button" class="block text-left font-medium hover:underline" @click.stop="$emit('select', pr)">{{ pr.title }}</button>
              <div class="mt-1 flex flex-wrap items-center gap-2 text-[var(--muted)]">
                #{{ pr.id }}
                <span v-if="pr.draft" class="rounded-full bg-[var(--warning-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--warning)]">Draft</span>
                <span v-if="pr.myVote === -10" title="You rejected this PR" class="rounded-full bg-[var(--danger-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--danger)]">Rejected</span>
                <span v-else-if="pr.myVote === 10 || pr.myVote === 5" title="Your review decision" class="rounded-full bg-[var(--success-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--success)]">
                  {{ pr.myVote === 5 ? 'Approved with suggestions' : 'Approved' }}
                </span>
                <span v-if="pr.needsReview" class="rounded-full bg-[var(--selection)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                  Needs your review
                </span>
              </div>
            </td>
            <td><div class="flex items-center gap-2">
              <span aria-hidden="true" class="grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white"
                :style="{ backgroundColor: authorColor(pr.author) }">{{ pr.author.trim().split(/\s+/).slice(0, 2).map(word => word.charAt(0)).join('').toUpperCase() }}</span>
              {{ pr.author }}
            </div></td>
            <td class="break-all font-mono">{{ pr.source }}</td>
            <td class="break-all font-mono">{{ pr.target }}</td>
            <td class="whitespace-nowrap"><time v-if="pr.createdAt" :datetime="pr.createdAt" :title="new Date(pr.createdAt).toLocaleString()">{{ creationAge(pr.createdAt) }}</time><span v-else>Unknown</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
