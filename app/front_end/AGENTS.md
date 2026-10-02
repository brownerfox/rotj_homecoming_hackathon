<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- Frontend only: all data goes through `src/lib/api.ts` to an external FastAPI server (contract in `API_CONTRACT.md`); no Lovable Cloud or in-app AI, because the backend and AI pipelines are built separately.
- `src/lib/mock-api.ts` mirrors the same contract in localStorage and is used when `VITE_USE_MOCKS` is not "false", so the demo runs before the server exists.
