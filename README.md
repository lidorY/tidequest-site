# tidequest-site

Static site for [TideQuest](https://tidequestgame.com), served by GitHub Pages. Plain HTML, CSS and vanilla JavaScript, no build step.

**Proprietary. All rights reserved; see [LICENSE](LICENSE).** Nothing here may be copied, extracted, reverse engineered or reused.

## Layout

| Path | What |
|---|---|
| `index.html` | Home page: TideQuest logo and tagline above the Discord (`/discord/`) and X (`x.com/tidequestgame`) links, over the interactive sea; holds the privacy and accessibility notices as dialogs (`#privacy`, `#accessibility`) |
| `discord/index.html` | Instant redirect to the Discord invite, with its own share card |
| `404.html` | Not-found page (uses root-absolute paths) |
| `assets/site.css` | Shared stylesheet for all pages |
| `assets/sea.wasm` | The game's sea shader with dual-grid sand tiles, the tide and the sand sound effects, rendered on the CPU (built from a private source repo) |
| `assets/sea.js` | Loads `sea.wasm`, draws its frames, scatters a few random islands, forwards mouse and touch input, and plays the sound effects (with a mute button) |
| `assets/parallax.js` | Mouse parallax on the foreground |
| `assets/legal.js` | Opens the privacy and accessibility dialogs from the footer links and URL hash |
| `assets/` | Font, logo (SVG) and the fallback screenshot (WebP) |
| `img/` | 1200x630 share cards and icons |
| `CNAME` | Custom domain for GitHub Pages |

## Common edits

- **Discord invite:** update the URL in `discord/index.html` (meta refresh, `location.replace` and the link). The home page links to `/discord/`, so it needs no change.
- **Legal pages:** the privacy and accessibility notices are `<dialog>`s at the end of `index.html`; update their “Last updated” date whenever you change them. If you ever add cookies, analytics or third-party embeds, the privacy notice must change first, and non-essential cookies need a consent banner.
- **Share cards:** `img/og-card.png` (home) and `img/discord-card.png` are 1200x630 renders of the pages over the fallback screenshot, with the footer hidden and the link labels shown beside their icons (the Discord one with its redirect removed). Platforms cache cards, so re-scrape after changing them.
- **Sea and tide:** built from the private `tidequest-site-src` repo; change it there and run its `build.ps1`, which updates `assets/sea.wasm` and `assets/sea.js`.

## Credits

- [Lilita One](https://fonts.google.com/specimen/Lilita+One) by Juan Montoreano, [SIL OFL 1.1](https://openfontlicense.org); unmodified, wrapped as WOFF.
- Sea rendering, tile layout and the background dim follow the game's own shaders, TileMapDual layout and Quit Modal overlay.
- Game art, tile data, sound effects, screenshots, the TideQuest logo and icon are © 2026 TideQuest, all rights reserved.
