*
# Local UI skins (not published to GitHub)

Drop paid or private template adapters here. Each pack is a folder with `skin.ts`:

```
apps/ui/src/skins/local/soft-ui-pro/
  skin.ts          # export default UiSkin
  Layout.tsx       # optional companion files
  theme.ts
```

## soft-ui-pro (example after purchase)

1. Unzip Soft UI Pro under `Template/soft-ui-pro/` (gitignored via `Template/`).
2. Create `apps/ui/src/skins/local/soft-ui-pro/skin.ts` that exports a `UiSkin`
   wrapping Soft UI theme + layout; map menu items to Nexternel routes.
3. FileZilla upload `apps/ui/src/skins/local/` to the server (do **not** run
   export-for-github with this folder — it is excluded).
4. Rebuild UI: `docker compose build --no-cache ui && docker compose up -d ui`
5. System → Appearance → select the skin.

Everything in this folder except this README and `.gitkeep` is gitignored.
