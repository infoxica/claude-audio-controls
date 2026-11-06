# Store artwork

- `logo-300.png`: owner-supplied project logo, rendered from `public/icons/brand.svg`.
- `small-tile.png`: 440×280 promotional tile.
- `marquee.png`: 1400×560 promotional tile.
- `screenshots/composer-seek.png`, `bottom-right-seek.png`, `left-seek.png`: 1280×800 screenshots of the current built player on the fictional Claude-style chat fixture.
- `screenshots/settings.png`: 1280×800 screenshot of the actual options UI.

Generate player screenshots with `node scripts/capture-layouts.mjs --store`, then create the logo/tiles/settings copy with `node scripts/build-store-assets.mjs`.

These images contain no private conversations, account information, ratings or invented user counts. Fixture screenshots illustrate the interface; they do not establish live-platform acceptance.
