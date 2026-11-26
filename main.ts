// THE 26TH v2 — make.fun news-image-20261126 entry (Node 22, standard library only).
// The front page is drawn in code by draw.mjs and shipped as entry.png beside
// this file; this program copies that image to the grader's output directory.
// Local run: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
const src = new URL('./entry.png', import.meta.url);
copyFileSync(src, join(outDir, 'entry.png'));
