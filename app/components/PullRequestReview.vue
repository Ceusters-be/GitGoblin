<script setup lang="ts">
import { ArrowLeft, ArrowRight, ExternalLink, UserRound } from "lucide-vue-next";
import { invoke } from "~/lib/native";
import type { PullRequest } from "~/lib/types";

const props = defineProps<{ repo: string; pr: PullRequest }>();
defineEmits<{ back: []; editContext: [text: string] }>();
const patch = ref("");
const loading = ref(true);
const error = ref("");

const voteOptions = [
  { value: "approve", label: "Approve", status: "Approved", score: 10 },
  { value: "suggestions", label: "Approve with suggestions", status: "Approved with suggestions", score: 5 },
  { value: "wait", label: "Wait for author", status: "Waiting for author", score: -5 },
  { value: "reject", label: "Reject", status: "Rejected", score: -10 },
  { value: "decline", label: "Decline to review" },
  { value: "reset", label: "Reset vote", status: "No vote", score: 0 },
];
const voteStatus = ref("");
const voteBusy = ref(false);
const voteError = ref("");
const reviewKey = computed(() => "gitgoblin.reviewed." + JSON.stringify([props.pr.url, props.pr.base, props.pr.head]));

async function reviewVote(vote?: string) {
  voteBusy.value = true;
  voteError.value = "";
  try {
    const reviewer = await invoke<{ vote: number; hasDeclined?: boolean } | null>("devops_review_vote", {
      repo: props.repo, repositoryId: props.pr.repositoryId, id: props.pr.id, vote: vote ?? null,
    });
    voteStatus.value = reviewer?.hasDeclined ? "Declined to review"
      : voteOptions.find(option => option.score === (reviewer?.vote ?? 0))?.status || "No vote";
  } catch (e) {
    voteError.value = String(e);
  } finally {
    voteBusy.value = false;
  }
}
onMounted(() => reviewVote());

onMounted(async () => {
  try {
    const { base, head } = props.pr;
    if (!base || !head) throw new Error("PR commits are pending. Refresh the list and retry.");
    patch.value = await invoke<string>("devops_pr_diff", { repo: props.repo, base, head });
  } catch (e) {
    error.value = String(e);
  } finally {
    loading.value = false;
  }
});

async function openOnline() {
  try {
    await invoke("open_external_url", { url: props.pr.url });
  } catch (e) {
    error.value = String(e);
  }
}
</script>

<template>
  <header class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--panel)] px-4 py-3">
    <div class="min-w-0 flex-1">
      <AppButton class="mb-1 text-xs text-[var(--muted)]" @click="$emit('back')"><ArrowLeft :size="13" />Pull Requests</AppButton>
      <h1 class="text-base font-semibold">{{ pr.title }}</h1>
      <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
        <span>#{{ pr.id }}</span>
        <span class="inline-flex items-center gap-1"><UserRound :size="13" />Created by <strong class="text-[var(--fg)]">{{ pr.author }}</strong></span>
        <span v-if="pr.source && pr.target" class="inline-flex items-center gap-1 break-all">{{ pr.source }} <ArrowRight :size="12" /> {{ pr.target }}</span>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <span v-if="voteStatus" role="status" class="text-xs text-[var(--muted)]">Your vote: {{ voteStatus }}</span>
      <AppSelect aria-label="Submit review decision" placeholder="Review decision" :options="voteOptions"
        :model-value="''" :disabled="voteBusy" @update:model-value="reviewVote" />
      <AppButton aria-label="Open in Azure DevOps" title="Open in Azure DevOps" @click="openOnline"><ExternalLink :size="16" /></AppButton>
    </div>
  </header>
  <AppHint v-if="voteError" role="alert">{{ voteError }} <AppButton :disabled="voteBusy" @click="reviewVote()">Reload vote</AppButton></AppHint>
  <AppHint v-if="error" role="alert">{{ error }}</AppHint>
  <AppHint v-if="loading" role="status">Loading changes…</AppHint>
  <DiffViewer v-else-if="patch" :text="patch" :review-key="reviewKey" mode="pull-request" @edit-context="$emit('editContext', $event)" />
  <AppHint v-else-if="!error">This pull request has no file changes.</AppHint>
</template>
