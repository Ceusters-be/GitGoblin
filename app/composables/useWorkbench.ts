import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { open } from "@tauri-apps/plugin-dialog";
import { git, desktop, invoke } from "~/lib/native";
import { createDiffCache } from "~/lib/diff-cache";
import { comparisonBase } from "~/lib/branches";
import { demoSnapshot, demoCommits, demoDiff } from "~/lib/demo";
import type {
  Snapshot,
  Commit,
  Diff,
  FileStatus,
  GitRequest,
} from "~/lib/types";

export function useWorkbench() {
  const repo = ref(""),
    recent = ref<string[]>([]),
    favorites = ref<string[]>([]),
    snapshot = ref<Snapshot>(),
    commits = ref<Commit[]>([]);
  const historyLoading = ref(false), historyHasMore = ref(false);
  const historyBranch = ref<{ name: string; mode: 'only' | 'exclude' }>();
  function filterHistory(name?: string, mode: 'only' | 'exclude' = 'only') {
    historyBranch.value = name ? { name, mode } : undefined;
    commits.value = [];
    void loadHistory(true);
  }
  watch(repo, () => { historyBranch.value = undefined; }, { flush: 'sync' });
  const historyPageSize = 500;
  let historyGeneration = 0, historyQuery = '';
  async function loadHistory(reset = false) {
    if (example.value || (!reset && (historyLoading.value || !historyHasMore.value))) return;
    const request = ++historyGeneration;
    const root = repo.value;
    const query = reset ? search.value : historyQuery;
    const offset = reset ? 0 : commits.value.length;
    historyLoading.value = true;
    try {
      const page = await git<Commit[]>({ repo: root, action: 'history', text: query, target: historyBranch.value?.name, mode: historyBranch.value?.mode, offset, limit: historyPageSize + 1 });
      if (request !== historyGeneration || root !== repo.value) return;
      const items = page.slice(0, historyPageSize);
      if (reset) {
        // Keep older loaded pages when a refresh leaves the first page unchanged.
        const unchanged = query === historyQuery && items.length === historyPageSize && items.every((item, i) => commits.value[i]?.id === item.id);
        if (!unchanged) { commits.value = items; historyHasMore.value = page.length > historyPageSize; }
        else commits.value = [...items, ...commits.value.slice(historyPageSize)];
      } else {
        const seen = new Set(commits.value.map((commit) => commit.id));
        commits.value = [...commits.value, ...items.filter((commit) => !seen.has(commit.id))];
        historyHasMore.value = page.length > historyPageSize;
      }
      historyQuery = query;
    } catch (e) {
      if (request === historyGeneration) error.value = String(e);
    } finally {
      if (request === historyGeneration) historyLoading.value = false;
    }
  }
  const diffCache = createDiffCache();
  const diffClientId = crypto.randomUUID();
  const diffLoading = ref(false);
  const repositoryLoading = ref(false);
  let repositoryRequest = 0;
  let metadataLoadedAt = 0;
  let repositoryPersistence = Promise.resolve();
  const wholeFile = ref(false);
  let displayedDiffKey = "";
  const selected = ref(""),
    diff = ref<Diff>({ text: "", fingerprint: "" }),
    mode = ref("working"),
    base = ref("main");
  const view = ref("changes"),
    search = ref(""),
    busy = ref(false),
    error = ref(""),
    notice = ref(""),
    example = ref(false);
  const branchFiles = ref<string[]>([]),
    selectedCommit = ref<Commit>(),
    historyDiff = ref(""),
    reflog = ref("");
  let timer: ReturnType<typeof setInterval> | undefined,
    generation = 0,
    diffGeneration = 0,
    polling = false;
  const pendingStages = ref<{ paths: Set<string>; stage: boolean }[]>([]);
  const staging = computed(() => pendingStages.value.length > 0);
  let stageQueue = Promise.resolve();
  const visibleFiles = computed(() => {
    let files = snapshot.value?.files || [];
    for (const pending of pendingStages.value) {
      files = files.map(file => {
        if (!pending.paths.has(file.path) || file.conflict) return file;
        if (pending.stage) return { ...file, index: file.worktree === '?' ? 'A' : file.worktree === ' ' ? file.index : file.worktree, worktree: ' ' };
        return { ...file, index: ' ', worktree: file.index === 'A' ? '?' : file.worktree === ' ' ? file.index : file.worktree };
      });
    }
    return files;
  });
  const working = computed(
    () =>
      visibleFiles.value.filter((f) => f.worktree !== " " || f.conflict) ||
      [],
  );
  const staged = computed(
    () =>
      visibleFiles.value.filter(
        (f) => f.index !== " " && f.index !== "?" && !f.conflict,
      ) || [],
  );
  const currentFiles = computed<FileStatus[]>(() =>
    mode.value === "branch"
      ? branchFiles.value.map((path) => ({
          path,
          index: " ",
          worktree: "M",
          conflict: false,
        }))
      : mode.value === "staged"
        ? staged.value
        : working.value,
  );
  const selectedFile = computed(() =>
    snapshot.value?.files.find((f) => f.path === selected.value),
  );
  async function read<T>(action: string, extra: Partial<GitRequest> = {}) {
    return git<T>({ repo: repo.value, action, ...extra });
  }
  async function loadDiff(background = false, conditional = background) {
    const request = ++diffGeneration;
    const file = selected.value;
    const key = JSON.stringify([repo.value, mode.value, base.value, file, wholeFile.value]);
    const switchedFile = key !== displayedDiffKey;
    if (switchedFile) {
      diff.value = diffCache.get(key) || { text: "", fingerprint: "" };
      displayedDiffKey = key;
    }
    if (!file) {
      diffLoading.value = false;
      diff.value = { text: "", fingerprint: "" };
      return;
    }
    if (example.value) {
      diffLoading.value = false;
      diff.value = demoDiff;
      return;
    }
    if (!background || switchedFile) diffLoading.value = !diffCache.get(key);
    try {
      const cached = diffCache.get(key);
      const next = await diffCache.load(key, async () => {
        const result = await read<Diff & { unchanged?: boolean }>("diff", {
          clientId: diffClientId, requestId: request,
          path: file, mode: mode.value, target: base.value, wholeFile: wholeFile.value,
          fingerprint: conditional && mode.value !== 'branch' ? cached?.fingerprint : undefined,
        });
        return result.unchanged && cached ? cached : result;
      });
      if (request === diffGeneration && (next.text !== diff.value.text || next.fingerprint !== diff.value.fingerprint)) diff.value = next;
    } catch (e) {
      if (request === diffGeneration) {
        if (String(e).includes('Diff request superseded')) { await loadDiff(background, conditional); return; }
        diff.value = { text: "", fingerprint: "" };
        error.value = String(e);
      }
    } finally {
      if (request === diffGeneration) diffLoading.value = false;
    }
  }
  async function refresh(full = false) {
    if (!repo.value || example.value || polling || busy.value || repositoryLoading.value) return;
    const request = generation;
    polling = true;
    try {
      const metadataDue = full || !snapshot.value || Date.now() - metadataLoadedAt >= 15_000;
      const lightweight = metadataDue ? undefined : await read<{ files: FileStatus[]; head: string }>('refresh');
      if (request !== generation) return;
      const reloadMetadata = metadataDue || lightweight!.head !== snapshot.value?.head;
      const next = reloadMetadata ? await read<Snapshot>('snapshot') : { ...snapshot.value!, ...lightweight! };
      if (reloadMetadata) metadataLoadedAt = Date.now();
      if (request !== generation) return;
      const changed = next.head !== snapshot.value?.head;
      if (changed) diffCache.invalidate(key => JSON.parse(key)[0] === repo.value);
      if (JSON.stringify(next) !== JSON.stringify(snapshot.value)) snapshot.value = next;
      base.value = comparisonBase(next, base.value);
      if (mode.value === "branch" && base.value) {
        const files = await read<string[]>("branch-files", {
          target: base.value,
        });
        if (request !== generation) return;
        branchFiles.value = files;
      }
      if (!currentFiles.value.some((f) => f.path === selected.value))
        selected.value = currentFiles.value[0]?.path || "";
      const loading = loadDiff(true, !reloadMetadata);
      await loading;
      if (full || changed) {
        await loadHistory(true);
      }
    } catch (e) {
      if (request === generation) error.value = String(e);
    } finally {
      polling = false;
    }
  }
  async function openRepo(path?: string) {
    if (busy.value && !repositoryLoading.value) {
      error.value =
        "Wait for the current Git operation before switching repositories.";
      return;
    }
    if (!desktop()) {
      error.value = "Local repositories require the GitGoblin desktop app.";
      return;
    }
    const result =
      path ||
      (await open({
        directory: true,
        multiple: false,
        title: "Open a Git repository",
      }));
    if (typeof result !== "string") return;
    const request = ++repositoryRequest;
    generation++;
    diffGeneration++;
    historyGeneration++;
    repositoryLoading.value = true;
    busy.value = true;
    error.value = "";
    try {
      const loaded = await git<Snapshot>({ repo: result, action: "snapshot" });
      if (request !== repositoryRequest) return;
      generation++;
      historyGeneration++;
      historyLoading.value = false;
      historyHasMore.value = false;
      selectedCommit.value = undefined;
      historyDiff.value = "";
      diffGeneration++;
      repo.value = loaded.root;
      example.value = false;
      snapshot.value = loaded;
      metadataLoadedAt = Date.now();
      commits.value = [];
      diff.value = { text: "", fingerprint: "" };
      view.value = "changes";
      mode.value = "working";
      base.value = comparisonBase(loaded, base.value);
      selected.value = currentFiles.value[0]?.path || "";
      void loadDiff();
      void loadHistory(true);
      const repositoryRoot = loaded.repositoryRoot || loaded.worktrees[0]?.path || loaded.root;
      const worktreePaths = new Set(loaded.worktrees.map(tree => normalize(tree.path)));
      recent.value = [
        repositoryRoot,
        ...recent.value.filter((p) => normalize(p) !== normalize(repositoryRoot) && !worktreePaths.has(normalize(p))),
      ].slice(0, 12);
      const repositories = recent.value;
      repositoryPersistence = repositoryPersistence.then(async () => {
        await invoke("repositories_save", { repositories });
        const saved = await invoke<string[]>("repositories_load");
        if (request === repositoryRequest) recent.value = saved;
      }).catch((e) => {
        if (request === repositoryRequest) error.value = `Repository opened, but history could not be saved: ${e}`;
      });
    } catch (e) {
      if (request === repositoryRequest) error.value = String(e);
    } finally {
      if (request === repositoryRequest) {
        repositoryLoading.value = false;
        busy.value = false;
      }
    }
  }
  function showExample() {
    generation++;
    historyGeneration++;
    historyLoading.value = false;
    historyHasMore.value = false;
    selectedCommit.value = undefined;
    historyDiff.value = "";
    diffGeneration++;
    diffCache.clear();
    example.value = true;
    repo.value = demoSnapshot.root;
    snapshot.value = structuredClone(demoSnapshot);
    base.value = comparisonBase(demoSnapshot, base.value);
    commits.value = demoCommits;
    mode.value = "working";
    selected.value = demoSnapshot.files[0]!.path;
    diff.value = demoDiff;
    view.value = "changes";
    error.value = "";
  }
  async function refreshFiles() {
    try {
      const files = await read<FileStatus[]>('status');
      if (snapshot.value) snapshot.value = { ...snapshot.value, files };
      if (!currentFiles.value.some(file => file.path === selected.value))
        selected.value = currentFiles.value[0]?.path || '';
      void loadDiff(true);
    } catch (e) {
      error.value = `Could not refresh changed files: ${e}`;
    }
  }
  async function runMutation(operation: () => Promise<string>, indexOnly = false, paths?: string[]) {
    if (example.value)
      throw new Error(
        "This is an example workspace. Open a real repository in the desktop app to make changes.",
      );
    if (busy.value)
      throw new Error("Wait for the current Git operation to finish.");
    busy.value = true;
    generation++;
    diffGeneration++;
    if (paths?.length) {
      const changed = new Set(paths);
      diffCache.invalidate(key => { const [root, , , path] = JSON.parse(key); return root === repo.value && changed.has(path); });
    } else diffCache.clear();
    error.value = "";
    notice.value = "";
    try {
      const out = await operation();
      notice.value = out?.trim() || "Done";
      return out;
    } catch (e) {
      error.value = String(e);
      throw e;
    } finally {
      if (indexOnly) await refreshFiles();
      busy.value = false;
      if (!indexOnly) await refresh(true);
    }
  }
  async function mutate(action: string, extra: Partial<GitRequest> = {}) {
    if ((action === 'stage' || action === 'unstage') && extra.path)
      return stageFiles([extra.path], action === 'stage' ? 'working' : 'staged');
    return runMutation(() => read<string>(action, extra), ['stage', 'unstage', 'patch'].includes(action), ['stage', 'unstage', 'patch'].includes(action) && extra.path ? [extra.path] : undefined);
  }
  async function stageFiles(paths: string[], fileMode: string) {
    if (!paths.length || !['working', 'staged'].includes(fileMode)) return;
    const action = fileMode === 'staged' ? 'unstage' : 'stage';
    if (example.value) throw new Error("This is an example workspace. Open a real repository in the desktop app to make changes.");
    if (busy.value && !staging.value) throw new Error("Wait for the current Git operation to finish.");
    if (!staging.value) error.value = "";
    const pending = { paths: new Set(paths), stage: action === 'stage' };
    pendingStages.value.push(pending);
    busy.value = true;
    generation++;
    diffGeneration++;
    diffCache.invalidate(key => { const [root, , , path] = JSON.parse(key); return root === repo.value && pending.paths.has(path); });
    const operation = stageQueue.then(async () => {
      notice.value = `${action === 'stage' ? 'Staging' : 'Unstaging'} ${paths.length} files...`;
      try {
        const out = await read<string>(paths.length > 1 ? `${action}-files` : action,
          paths.length > 1 ? { files: paths.map(path => ({ path })) } : { path: paths[0] });
        notice.value = out?.trim() || "Done";
        return out;
      } catch (e) {
        const failure = paths.length === 1 ? new Error(`0 of 1 files ${action === 'stage' ? 'staged' : 'unstaged'}. ${e}`) : e;
        error.value = String(failure);
        throw failure;
      } finally {
        // Keep later queued moves visible while reconciling this write with Git.
        try {
          const files = await read<FileStatus[]>('status');
          if (snapshot.value) snapshot.value = { ...snapshot.value, files };
        } catch (e) {
          error.value += ` Could not refresh changed files: ${e}`;
        }
        pendingStages.value.shift();
        busy.value = staging.value;
        if (!currentFiles.value.some(file => file.path === selected.value))
          selected.value = currentFiles.value[0]?.path || '';
        if (!staging.value) void loadDiff(true);
      }
    });
    stageQueue = operation.then(() => {}, () => {});
    return operation;
  }
  async function selectCommit(commit: Commit) {
    selectedCommit.value = commit;
    historyDiff.value = "";
    if (example.value) {
      historyDiff.value = demoDiff.text;
      return;
    }
    try {
      const result = await read<string>("commit-diff", { target: commit.id });
      if (selectedCommit.value?.id === commit.id) historyDiff.value = result;
    } catch (e) {
      error.value = String(e);
    }
  }
  async function searchHistory() {
    if (example.value) {
      commits.value = demoCommits.filter((c) =>
        c.subject.toLowerCase().includes(search.value.toLowerCase()),
      );
      return;
    }
    await loadHistory(true);
  }
  watch([selected, mode, base, wholeFile], () => void loadDiff());
  watch([mode, base], async () => {
    if (mode.value === "branch" && !example.value && base.value) {
      try {
        branchFiles.value = await read<string[]>("branch-files", {
          target: base.value,
        });
      } catch (e) {
        error.value = String(e);
      }
    }
    if (!currentFiles.value.some((file) => file.path === selected.value))
      selected.value = currentFiles.value[0]?.path || "";
  });
  watch(view, async () => {
    if (view.value === "reflog") {
      if (example.value) {
        reflog.value =
          "f37a21d\tHEAD@{0}\tcommit: Keep conversations and worktrees in sync";
        return;
      }
      try {
        reflog.value = await read<string>("reflog");
      } catch (e) {
        error.value = String(e);
      }
    }
  });
  const normalize = (path: string) => path.replaceAll('\\', '/').replace(/\/$/, '').toLowerCase();
  const repositoryNames = ref<Record<string, string>>({});
  const nameSaving = ref(false);
  const repositoryName = (path: string) => repositoryNames.value[normalize(path)] || path.replaceAll('\\', '/').split('/').filter(Boolean).at(-1) || 'GitGoblin';
  const repositoryAlias = (path: string) => repositoryNames.value[normalize(path)] || '';
  async function renameRepository(path: string, name: string) {
    if (nameSaving.value) return false;
    nameSaving.value = true;
    const next = { ...repositoryNames.value };
    if (name.trim()) next[normalize(path)] = name.trim();
    else delete next[normalize(path)];
    try {
      if (desktop()) await invoke("repository_names_save", { names: next });
      else localStorage.setItem("gitgoblin.repositoryNames", JSON.stringify(next));
      repositoryNames.value = next;
      return true;
    } catch (e) {
      error.value = `Could not save repository name: ${e}`;
      return false;
    } finally {
      nameSaving.value = false;
    }
  }
  onMounted(async () => {
    try {
      const saved = desktop() ? await invoke<Record<string, string>>("repository_names_load") : JSON.parse(localStorage.getItem("gitgoblin.repositoryNames") || "{}");
      if (saved && typeof saved === 'object' && !Array.isArray(saved))
        repositoryNames.value = Object.fromEntries(Object.entries(saved).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
    } catch (e) {
      error.value = `Could not restore repository names: ${e}`;
    }
  });
  const isFavorite = (path: string) => favorites.value.some(saved => normalize(saved) === normalize(path));
  const favoriteSaving = ref(false);
  async function removeRepository(path: string) {
    if (busy.value || favoriteSaving.value) return;
    busy.value = true;
    favoriteSaving.value = true;
    error.value = "";
    try {
      const nextFavorites = favorites.value.filter(saved => normalize(saved) !== normalize(path));
      const nextRecent = recent.value.filter(saved => normalize(saved) !== normalize(path));
      if (desktop()) await invoke("favorites_save", { repositories: nextFavorites });
      else localStorage.setItem("gitgoblin.favorites", JSON.stringify(nextFavorites));
      favorites.value = nextFavorites;
      if (desktop()) await invoke("repositories_save", { repositories: nextRecent });
      else localStorage.setItem("gitgoblin.repositories", JSON.stringify(nextRecent));
      recent.value = nextRecent;
      notice.value = "Removed from GitGoblin’s repository list. The folder is still on disk.";
    } catch (e) {
      error.value = `Could not remove repository from the list: ${e}`;
    } finally {
      favoriteSaving.value = false;
      busy.value = false;
    }
  }
  async function toggleFavorite(path: string) {
    if (favoriteSaving.value) return;
    favoriteSaving.value = true;
    const next = isFavorite(path) ? favorites.value.filter(saved => normalize(saved) !== normalize(path)) : [...favorites.value, path];
    try {
      if (desktop()) await invoke("favorites_save", { repositories: next });
      else localStorage.setItem("gitgoblin.favorites", JSON.stringify(next));
      favorites.value = next;
    } catch (e) {
      error.value = `Could not save favorite repositories: ${e}`;
    } finally {
      favoriteSaving.value = false;
    }
  }
  onMounted(async () => {
    try {
      const saved = desktop() ? await invoke<string[] | null>("favorites_load") : JSON.parse(localStorage.getItem("gitgoblin.favorites") || "[]");
      favorites.value = Array.isArray(saved) ? saved.filter((path): path is string => typeof path === 'string') : [];
    } catch (e) {
      error.value = `Could not restore favorite repositories: ${e}`;
    }
  });
  onMounted(async () => {
    try {
      const saved = desktop()
        ? await invoke<string[] | null>("repositories_load")
        : null;
      if (saved !== null) {
        recent.value = saved;
      } else {
        const stored = JSON.parse(localStorage.getItem("gitgoblin.repositories") || "[]");
        if (Array.isArray(stored))
          recent.value = stored.filter((v) => typeof v === "string").slice(0, 12);
        if (desktop() && recent.value.length)
          await invoke("repositories_save", { repositories: recent.value });
      }
      if (desktop() && recent.value[0]) await openRepo(recent.value[0]);
    } catch (e) {
      error.value = `Could not restore repository history: ${e}`;
    }
    timer = setInterval(() => void refresh(), 2500);
  });
  onUnmounted(() => {
    generation++;
    clearInterval(timer);
  });
  return {
    repo,
    recent,
    favorites,
    repositoryName,
    repositoryAlias,
    renameRepository,
    nameSaving,
    isFavorite,
    toggleFavorite,
    favoriteSaving,
    removeRepository,
    snapshot,
    commits,
    historyBranch,
    filterHistory,
    historyLoading,
    historyHasMore,
    loadHistory,
    selected,
    diff,
    diffLoading,
    repositoryLoading,
    wholeFile,
    mode,
    base,
    view,
    search,
    busy,
    error,
    notice,
    example,
    working,
    staged,
    currentFiles,
    selectedFile,
    selectedCommit,
    historyDiff,
    reflog,
    openRepo,
    showExample,
    refresh,
    loadDiff,
    read,
    mutate,
    stageFiles,
    staging,
    selectCommit,
    searchHistory,
  };
}
