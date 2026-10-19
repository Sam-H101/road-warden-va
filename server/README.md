# Online saves: sync worker

GitHub Pages only serves files, so it cannot check a sign-in or write to
GitHub. This folder is a small Cloudflare Worker that does both:

```
game (GitHub Pages) --Google sign-in--> worker /auth  -> checks the Google ID token, returns a 30-day session
game                --session--------> worker /progress/<state>  -> reads/writes JSON in a private GitHub repo
```

- Progress is stored in a **private** GitHub repository as
  `users/<player key>/<state>.json`. The player key is a SHA-256 hash of the
  Google account id: no names or emails are stored.
- Each save is a commit, so the repository history is a full backup.
- The game still saves on the device first and works offline. Online saves
  merge both copies, so playing on two devices never loses progress.
- The game hides the "Save online" panel unless the build has both
  `VITE_GOOGLE_CLIENT_ID` and `VITE_SYNC_URL`.

## One-time setup

1. **Data repository.** Create a private repo, e.g. `Sam-H101/road-warden-data`,
   with a README so `main` exists. If you use another name, change `DATA_REPO`
   in `wrangler.toml`.
2. **GitHub token.** Create a fine-grained personal access token with access to
   only that repo and the permission *Contents: Read and write*.
3. **Google client ID.** In Google Cloud Console, APIs & Services, Credentials,
   create an *OAuth client ID* of type *Web application*. Under *Authorized
   JavaScript origins* add `https://sam-h101.github.io` (and
   `http://localhost:5173` for development). No redirect URI is needed. Set up
   the OAuth consent screen with the `openid`, `email` and `profile` scopes.
4. **Deploy the worker** (needs a free Cloudflare account):

   ```bash
   cd server
   npm ci
   npx wrangler@4 login
   npx wrangler@4 secret put GOOGLE_CLIENT_ID   # the client ID from step 3
   npx wrangler@4 secret put GITHUB_TOKEN       # the token from step 2
   npx wrangler@4 secret put SESSION_SECRET     # any long random string, e.g. `openssl rand -hex 32`
   npx wrangler@4 deploy
   ```

   It prints the worker URL, e.g. `https://road-warden-sync.<you>.workers.dev`.
5. **Turn it on in the game.** In the GitHub repo, Settings, Secrets and
   variables, Actions, *Variables* tab, add:
   - `GOOGLE_CLIENT_ID` = the client ID from step 3
   - `SYNC_URL` = the worker URL from step 4

   Then re-run the "Test and publish game" workflow.
6. **Optional auto-deploy.** Add the Actions *secrets* `CLOUDFLARE_API_TOKEN`
   (a token with the "Edit Cloudflare Workers" template) and
   `CLOUDFLARE_ACCOUNT_ID`, and pushes that change `server/` deploy the worker.

If the game is served from another address, add it to `ALLOWED_ORIGINS` in
`wrangler.toml` and to the Google client's JavaScript origins.

## Develop

```bash
npm ci
npx vitest run          # tests (fake Google keys and a fake GitHub)
npx tsc --noEmit        # typecheck
npx wrangler@4 dev      # local worker; put secrets in .dev.vars (git-ignored)
```

For local play against a local worker, run the game with
`VITE_GOOGLE_CLIENT_ID=... VITE_SYNC_URL=http://localhost:8787 npm run dev`.

## API

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/auth` | `{ credential }` (Google ID token) | `{ token, expiresAt, user: { name, picture } }` |
| GET | `/progress/<state>` | | `{ updatedAt, data }` (`data` is `null` for a new player) |
| PUT | `/progress/<state>?base=<updatedAt>` | `{ updatedAt, data }` | `{ updatedAt }`, or 409 with `remote` when another device saved since `base` |

`/progress` needs `Authorization: Bearer <token>`. Saves over 512 KB are refused.
