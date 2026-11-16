import { createDiffSession } from './diff-session';
const receive = createDiffSession();
self.onmessage = ({ data }) => self.postMessage(receive(data));
