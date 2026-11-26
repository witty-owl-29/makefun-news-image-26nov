[![news-image-20261126](https://make.fun/badge/news-image-20261126.svg)](https://make.fun/bounty/news-image-20261126)
[![rank](https://make.fun/badge/news-image-20261126/witty-owl-29/makefun-news-image-26nov/rank.svg)](https://make.fun/bounty/news-image-20261126)
[![reward](https://make.fun/badge/news-image-20261126/witty-owl-29/makefun-news-image-26nov/reward.svg)](https://make.fun/bounty/news-image-20261126)

[Sum up 26 November's world news in one image](https://make.fun/bounty/news-image-20261126)

# THE 26TH — Thursday 26 November 2026 in one picture

A dense broadsheet front page for Thursday 26 November 2026: **50 stories**,
every one with its own picture, all drawn in code.

- **Identity:** Forest Broadsheet — warm cream paper, a deep forest-green
  masthead band with a cream date title, amber rules, vermilion accents.
  Layout follows the readability principles of the reference front page
  (big date masthead, separate stat boxes, coloured region bar, timeline
  strip, numbered picture cards), with our own palette and composition.
- **Leads:** US proposes tariffs on 14 nations · Houthis claim a strike on the
  Saudi Ras Tanura refinery · the Thanksgiving storm that postponed Macy's
  100th parade.
- **The day in pictures:** 12 illustrated stories (Cairo tanker fire, Kim's
  nuclear call, the Savasleyka airbase strike, the first Pakistani astronaut
  on Tiangong, SpaceX's 1M satellites, and more).
- **Where it happened:** a world map with 8 numbered pins.
- **Also on this day:** 35 briefs, each with a small icon and a source tag.
- **The day in numbers:** 31 killed in Cairo · $95 Brent · 14 tariff targets ·
  1M satellites authorised · 2,000 migrants in a day · 100th parade postponed
  — each in its own box, number and label on separate rows.
- **The day in regions:** a coloured region bar (Europe 10 · M. East 9 ·
  Africa 4 · Asia 12 · Americas 13 · OCE 2) and a timeline strip of the
  day's key events.
- **Date check:** every story was reported on Thursday 26 November 2026;
  sources are named on the page (Reuters, KCNA, Kyiv Post, France 24,
  Times of India, Geo News, Middle East Eye, 6abc, FinScans, Moscow Times,
  UEFA, UN Women, ANI, FeedCast, OneTurn).

## How it is built

`draw.mjs` draws the whole 1024×1024 image in pure Node (standard library
only): a small RGBA canvas, a hand-drawn vector stroke font, shaded
illustrations with gradients, highlights and texture, and a hand-rolled PNG
encoder. No network, no copied artwork, no photographs. `main.ts` copies the
finished `entry.png` to the output directory; running it twice produces
byte-identical output.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```
