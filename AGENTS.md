# Thaalam Radio Website

## Codex workflow

- Do not use the Sites skill or Sites hosting workflow for this project.
- Use the installed `gpt-tasteskill` for UI direction and frontend implementation.
- Use the GPT task workflow for implementation, verification, and handoff.
- Keep project instructions in this file and update them when the requested stack or workflow changes.
- Use the Thaalam HLS stream for playback and AzuraCast public APIs for now-playing metadata, artwork, and schedule data.

## Project intent

Build a modern, responsive radio website that makes the live station experience feel immediate and editorial. The site should present station details, current live metadata, album artwork as part of a record/disc visual, and curated iTunes chart data.

## Product priorities

1. Make the live player the primary action.
2. Show the currently playing track, artist, album art, and live status clearly.
3. Keep playback controls simple: play, pause, and volume where practical.
4. Present charts as useful, scannable modules rather than dense tables.
5. Work well on mobile, tablet, and desktop.
6. Prefer accessible semantic HTML, visible focus states, readable contrast, and keyboard-friendly controls.

## Visual direction

- Use a contemporary dark radio/editorial aesthetic with one warm accent color.
- Use album art inside a record, disc, or similarly modern visual treatment; do not make the page a full-bleed album-art gallery.
- Create strong hierarchy: station identity, live player, current track, then charts and station information.
- Avoid excessive gradients, tiny text, generic dashboard styling, and unnecessary decorative UI.

## Technology stack

- Use React with JavaScript for the application UI.
- Prefer a simple Vite-based React setup unless a later instruction specifies another React framework.
- Use JSX, functional components, and React hooks.
- Keep reusable UI sections in separate components where that improves clarity.

## Implementation guidance

- Keep the first version lightweight, but use the React build tooling once the app is scaffolded.
- Keep data-fetching logic isolated from presentation logic.
- Treat external stream URLs, metadata endpoints, and chart APIs as configurable values.
- Provide graceful fallback content when live metadata or chart data is unavailable.
- Do not autoplay audio; playback must begin from an explicit user action.
- Use CSS animations sparingly and respect `prefers-reduced-motion`.

## Verification checklist

- The page loads without console errors.
- The player toggles between play and pause states.
- Live metadata and album-art fallback states render correctly.
- Chart cards remain readable at narrow widths.
- Interactive controls have labels, focus states, and usable touch targets.
- No secrets or API keys are committed to the repository.
