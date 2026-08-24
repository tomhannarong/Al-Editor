# AI Editor Review Studio shell

This Phase-0 shell establishes the human-review boundary without introducing a frontend framework dependency.

It exposes stable semantic surfaces for preview, canonical timeline review, replace/trim/lock/create-revision actions, revision evidence and decision evidence. Controls are intentionally disabled until the immutable revision APIs are migrated. The UI is a projection/review surface only: it must never become canonical timing, persistence or renderer authority.

Static contract verification:

```bash
node scripts/verify-review-ui-shell.mjs
```
