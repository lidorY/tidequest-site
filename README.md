# tidequest-site

Static site for [TideQuest](https://tidequestgame.com), served by GitHub Pages. Plain HTML, CSS and JavaScript with no build step.

Proprietary. All rights reserved, see [LICENSE](LICENSE). Nothing here may be copied, extracted, reverse engineered or reused.

## Files

| Path | What it is |
|---|---|
| `index.html` | Home page. TideQuest logo and tagline, the Discord (`/discord/`) and X links, and the interactive sea. The privacy and accessibility notices are dialogs at the end (`#privacy`, `#accessibility`). |
| `discord/index.html` | Redirects straight to the Discord invite and has its own share card |
| `404.html` | Not-found page (uses root-absolute paths) |
| `assets/site.css` | Stylesheet for all pages |
| `assets/sea.wasm` | The game's sea shader with dual-grid sand tiles, the tide and the sand sound effects, rendered on the CPU. Built from a private source repo. |
| `assets/sea.js` | Loads `sea.wasm`, draws its frames, adds a few random islands, handles mouse and touch, and plays the sound effects (with a mute button) |
| `assets/parallax.js` | Mouse parallax on the foreground |
| `assets/legal.js` | Opens the privacy and accessibility dialogs from the footer links and the URL hash |
| `assets/` | Font, logo (SVG) and the fallback screenshot (WebP) |
| `img/` | 1200x630 share cards and icons |
| `CNAME` | Custom domain for GitHub Pages |

## Making changes

To change the Discord invite, update the URL in `discord/index.html` in three places: the meta refresh, `location.replace` and the link. The home page links to `/discord/`, so it doesn't need a change.

The privacy and accessibility notices are the `<dialog>` elements at the end of `index.html`. Update their "Last updated" date when you change them. If you ever add cookies, analytics or third-party embeds, change the privacy notice first, and add a consent banner for any non-essential cookies.

The share cards `img/og-card.png` (home) and `img/discord-card.png` are 1200x630 screenshots of the pages over the fallback screenshot, with the footer hidden and the link labels shown next to their icons. The Discord one is taken with its redirect removed. Platforms cache cards, so re-scrape after changing them.

The sea and tide are built from the private `tidequest-site-src` repo. Change them there and run its `build.ps1`, which updates `assets/sea.wasm` and `assets/sea.js`.

## Credits

- [Lilita One](https://fonts.google.com/specimen/Lilita+One) by Juan Montoreano, [SIL OFL 1.1](https://openfontlicense.org), unmodified and wrapped as WOFF.
- The sea, the tile layout and the background dim follow the game's own shaders, TileMapDual layout and Quit Modal overlay.
- Game art, tile data, sound effects, screenshots, the TideQuest logo and icon are © 2026 TideQuest, all rights reserved.
