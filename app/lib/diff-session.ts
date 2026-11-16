import { diffGeometry, diffViewport, prepareDiff } from './diff-geometry';
import { selectedPatch } from './diff';

export interface DiffViewRequest {
  id: number;
  text?: string;
  layout: string;
  rowHeight: number;
  fontSize: number;
  selectedFile: string;
  scroll: number;
  height: number;
}
export interface DiffPatchRequest { id: number; patch: true; indices?: number[]; hunkStart?: number; reverse: boolean }

export function createDiffSession() {
  let text = '', prepared = prepareDiff(''), settings = '';
  let geometry = diffGeometry('', 'split', 23, 11, '', prepared);
  return (request: DiffViewRequest | DiffPatchRequest) => {
    try {
      if ('patch' in request) {
        const hunk = prepared.flatMap(file => file.hunks).find(hunk => hunk.start === request.hunkStart);
        const indices = request.hunkStart === undefined ? request.indices || []
          : hunk?.lines.filter(line => line.kind === 'add' || line.kind === 'delete').map(line => line.index) || [];
        return { id: request.id, patch: selectedPatch(text, new Set(indices), request.reverse) };
      }
      if (request.text !== undefined && request.text !== text) {
        text = request.text;
        prepared = prepareDiff(text);
        settings = '';
      }
      const next = JSON.stringify([request.layout, request.rowHeight, request.fontSize, request.selectedFile]);
      if (next !== settings) {
        geometry = diffGeometry(text, request.layout, request.rowHeight, request.fontSize, request.selectedFile, prepared);
        settings = next;
      }
      return { id: request.id, view: diffViewport(geometry, request.scroll, request.height, request.rowHeight) };
    } catch (error) { return { id: request.id, error: String(error) }; }
  };
}
