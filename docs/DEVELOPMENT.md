# Development guidelines (RC-600)

**Family (shared):** https://github.com/r4free/boss-editor-guidelines  

**This device:** [devices/rc-600.md](https://github.com/r4free/boss-editor-guidelines/blob/main/devices/rc-600.md)

## Local stack

| | |
|---|---|
| API | Node server → `:5191` (see README) |
| UI | `npm run ui` → `:5190` |
| App URL | **https://rc.test** |

## Local Cursor rules (device-only)

- `ui-language.mdc` — English-only user-visible UI
- `memory-editor.mdc` — horizontal tabs, ParamDef widgets, MDI / InfoTip

## Shared rules also installed

- `feature-registry.mdc` — keep [FEATURES.md](./FEATURES.md) in sync
- `restart-services.mdc` — do not kill a healthy stack
