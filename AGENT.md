# AGENT.md — THE 26TH (news-image-20261126)

Entry for make.fun's "Sum up 26 November's world news in one image" bounty.
Built in one session on 26 Nov 2026, after the competition opened.

## What it is

A 1024×1024 broadsheet front page, "THE 26TH", in a crimson-and-gold
identity on warm ivory paper: 3 illustrated leads, 12 picture stories,
a world map with 8 numbered pins, 35 icon briefs, a numbers ticker, and a
date-check footer. 50 stories in total, each with its own picture and a
named source. Every story was reported on Thursday 26 November 2026.

## Files

- `draw.mjs` — draws `entry.png` in pure Node (stdlib only): RGBA canvas,
  vector stroke font, flat-colour illustrations, hand-rolled PNG encoder.
- `entry.png` — the finished image (1024×1024, under 1 MiB).
- `main.ts` — copies `entry.png` to the output directory (deterministic).
- `README.md`, `LICENSE` (MIT).

## Run

```sh
node draw.mjs                              # redraw entry.png
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # test the entrypoint
```
