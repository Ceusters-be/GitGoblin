import { parseDiffFiles, splitDiffLines } from './diff';
import { diffFileStatus } from './diff-files';
import { diffWindow, type DiffChange } from './diff-window';

export function prepareDiff(text: string) {
  return parseDiffFiles(text).map(file => ({ ...file, hunks: file.hunks.map(hunk => ({ ...hunk, rows: splitDiffLines(hunk.lines) })) }));
}

export function diffGeometry(text: string, layout: string, rowHeight: number, fontSize: number, selectedFile = '', parsed = prepareDiff(text)) {
  const displayed = selectedFile ? parsed.filter(file => diffFileStatus(file.header)?.path === selectedFile) : parsed;

  let offset = 0,
    width = 0;
  const longest = { left: "", right: "" };
  const changes: DiffChange[] = [];
  const lastChange = new Map<string, DiffChange>();
  const files = displayed.map((file) => {
    if (displayed.length > 1) offset += 32;
    if (layout === "split" && file.hunks.length) offset += 29;
    const plainHeight =
      (file.header || "No text changes to display.").split("\n").length * 20 +
      24;
    if (!file.hunks.length) offset += plainHeight;
    const hunks = file.hunks.map((hunk) => {
      offset += 50;
      const top = offset;
      const rows = layout === "split" ? hunk.rows : [];
      for (const row of rows)
        for (const side of ["left", "right"] as const) {
          const line = row[side];
          const text = (
            line?.kind === "meta" ? line.text : line?.text.slice(1) || ""
          ).replace(/\t/g, "  ");
          if (text.length > longest[side].length) longest[side] = text;
        }
      const lines =
        layout === "split"
          ? rows.map((row) => [row.left, row.right])
          : hunk.lines.map((line) => [line]);
      lines.forEach((pair, i) =>
        pair.forEach((line) => {
          if (!line) return;
          width = Math.max(width, line.text.replace(/\t/g, "  ").length);
          if (line.kind === "add" || line.kind === "delete") {
            const position = top + i * rowHeight;
            const previous = lastChange.get(line.kind);
            if (previous && previous.offset + previous.height === position) previous.height += rowHeight;
            else {
              const change = { offset: position, height: rowHeight, kind: line.kind, line: String(line.next || line.old) };
              changes.push(change);
              lastChange.set(line.kind, change);
            }
          }
        }),
      );
      offset += lines.length * rowHeight;
      return { ...hunk, rows, top, count: lines.length };
    });
    return { ...file, hunks, plainHeight };
  });
  return {
    files,
    navigationFiles: parsed.flatMap(file => { const status = diffFileStatus(file.header); return status ? [status] : []; }),
    changes,
    longest,
    width: width * fontSize * 0.61 + 125,
  };
}

export function diffViewport(geometry: ReturnType<typeof diffGeometry>, scroll: number, height: number, rowHeight: number) {
  const large = geometry.files.reduce((n, file) => n + file.hunks.reduce((n, hunk) => n + hunk.lines.length, 0), 0) > 500;
  // The minimap has finite pixels; bound its payload even for alternating changes.
  const changes: DiffChange[] = [];
  const buckets = new Map<string, DiffChange>();
  const extent = geometry.changes.reduce((end, change) => Math.max(end, change.offset + change.height), 1);
  for (const change of geometry.changes) {
    const key = `${change.kind}:${Math.floor(change.offset / extent * 1000)}`;
    const previous = buckets.get(key);
    if (previous) previous.height = Math.max(previous.height, change.offset + change.height - previous.offset);
    else { const copy = { ...change }; buckets.set(key, copy); changes.push(copy); }
  }
  return { ...geometry, large, changes, files: geometry.files.map(file => ({ ...file, hunks: file.hunks.map(hunk => {
    const window = large ? diffWindow(hunk.count, hunk.top, scroll, height, rowHeight)
      : { start: 0, end: hunk.count, before: 0, after: 0 };
    const { lines, rows, ...summary } = hunk;
    return { ...summary, window, visibleLines: lines.slice(window.start, window.end), visibleRows: rows.slice(window.start, window.end) };
  }) })) };
}
