# Roadmap and project state

Last updated: 2026-10-03. This file is the hand-off between work sessions: what is done, what
is next, and the decisions and habits that are not obvious from the code. `CLAUDE.md` holds the
product goals; this file holds the progress.

## Where we are

| Phase                   | State                                                      |
| ----------------------- | ---------------------------------------------------------- |
| 0. Monorepo             | Done                                                       |
| 1. Secure AWS account   | Done                                                       |
| 2. Infrastructure (CDK) | Done                                                       |
| 3. Backend              | Upload, processing and playback done. **Next: moderation** |
| 4. Web app              | Sign-in, upload, library and player done. Not deployed     |
| 5. Mobile app (Expo)    | Not started                                                |
| After the MVP           | README for GitHub, differentiating features                |

## What to do next, in order

### 3a. Moderation (next)

Goal: people other than the owner can watch a video once it is approved.

1. Domain: moderation transitions (`pending -> approved | flagged | rejected`, and admin
   decisions on flagged videos). Who can view: owner always; everyone else only if `approved`
   and `ready`.
2. Use cases: `ReviewVideo` (admin approves or rejects), `ListReviewQueue` (admin),
   `ListLibrary` (approved videos for everyone), and widen `GetPlayback` to the "who can view"
   rule.
3. Adapters: write `GSI3` (`MODERATION#flagged`, sparse) for the review queue and `GSI2` for
   approved videos. Both indexes already exist on the table and are empty.
4. Endpoints, admin-only ones checked against the `cognito:groups` claim (`parseGroups`).
5. Decide the MVP review flow with the user before coding: manual approval by an admin first;
   automatic checks (Rekognition, or ffmpeg frames + image moderation) cost money and need a
   cost warning. `CLAUDE.md` also asks for report-a-video and block-a-user.
6. Web: admin review screen; a shared library section.

### 3b. Categories and continuous playlist

1. `Category` entity (`CATEGORY#{id}` / `META`; listed through `GSI2PK = CATEGORIES`).
2. Admin creates and manages categories; users pick one when uploading (the domain already
   accepts `categoryId`, the upload request does not yet).
3. Playlist: approved videos of a category in `position` order (`GSI2`), and a player that
   autoplays the next one.

### 3c. Fargate re-encoding

For videos the Lambda cannot handle: codecs other than H.264/HEVC, and files over 9 GiB. Today
they are marked `failed` with `UNSUPPORTED_VIDEO_CODEC` or `TOO_LARGE`. Fargate costs money per
minute of CPU: give the user a cost estimate before building it.

### 4. Finish the web app

- Step 6: deploy to AWS Amplify Hosting; add its domain to `webOrigins` in `infra/bin/app.ts`
  (API CORS + uploads bucket CORS). Small cost: warn first.
- Forgot password, Google sign-in, MFA at sign-in.
- A full pass with the `web-design-guidelines` skill.
- The landing page (`landing-01` block, `design-taste-frontend` skill).
- Playwright E2E tests in the repo (so far the browser checks were manual runs with
  `playwright-cli`).

### 5. Mobile app

Expo development build. Reuse `packages/upload-client`: implement `putPart` with the native
background uploader. Player with `expo-video`.

### After the MVP

- A polished `README.md` for GitHub (the user asked for it; not before the MVP is finished).
- Differentiators from `CLAUDE.md`, one at a time. Audio mode is the suggested first one, and it
  is when HLS and an audio-only rendition get added.

## What exists

### AWS (account region `us-east-1`, all stacks prefixed `cvp-dev-`)

| Stack        | Contents                                                                               |
| ------------ | -------------------------------------------------------------------------------------- |
| `auth`       | Cognito user pool (invite-only, email sign-in), groups `admin` and `user`, app client  |
| `data`       | DynamoDB single table `cvp-dev-data`, `GSI1`..`GSI3`, PITR, TTL on `expiresAt`         |
| `storage`    | `uploads` bucket (originals), `media` bucket (playable copies), CloudFront + key group |
| `processing` | SQS queue + dead-letter queue, ffmpeg layer, processor Lambda                          |
| `api`        | HTTP API with Cognito JWT authorizer, one Lambda per route                             |

API routes: `GET /health`, `GET /me/storage`, `POST /uploads`, `GET /uploads/{id}/parts`,
`POST /uploads/{id}/complete`, `DELETE /uploads/{id}`, `GET /videos`,
`GET /videos/{id}/playback`.

Outside CDK: the playback private key in SSM (`/cvp-dev/playback/private-key`), the budget
`cvp-monthly`, Free Tier alerts and Cost Anomaly Detection.

### Repository

```
apps/web                 Next.js 16: sign-in, upload, library, player
packages/shared          API contracts (types + Zod schemas)
packages/upload-client   Upload engine and API client, shared by web and (later) mobile
services/api/src         domain -> application -> infrastructure -> interfaces
infra                    CDK stacks, tests, scripts (smoke tests, ffmpeg and key setup)
```

### Table key design

| Item     | PK              | SK        | Indexes                                                                                        |
| -------- | --------------- | --------- | ---------------------------------------------------------------------------------------------- |
| User     | `USER#{sub}`    | `PROFILE` |                                                                                                |
| Video    | `VIDEO#{id}`    | `META`    | `GSI1`: `OWNER#{userId}` / `createdAt`. `GSI2`, `GSI3`: not written yet (moderation, playlist) |
| Category | `CATEGORY#{id}` | `META`    | planned                                                                                        |

## Decisions that differ from, or add to, CLAUDE.md

- **Every user can upload**, not only admins. Uploads stay `pending` until moderated.
- **Quota: 50 GiB per user**, counted on originals only, enforced atomically when an upload
  completes.
- **Processing is triggered by an SQS message sent after the upload is accepted**, not by an
  S3 event: S3 fires before the quota check, which can still delete the file.
- **Output is a single fast-start MP4**, not HLS, until audio mode needs more renditions.
- **Lambda handles H.264 and HEVC up to 9 GiB** by stream copy; audio that is not AAC is the
  only thing re-encoded. Everything else waits for Fargate.
- **ffmpeg reads the original through a local byte-range relay** (`s3-range-proxy.ts`): the
  static build cannot resolve hostnames.
- **Lambdas bundle their own AWS SDK** so that what is tested is what runs.
- **CloudFront lives in the storage stack**, to avoid a circular dependency with the media
  bucket's policy.
- **Completing an upload needs no ETags from the client**: the server lists the parts in S3.
- **Pausing an upload discards the parts in flight** (S3 keeps only complete parts), so the web
  app asks for confirmation and says how much will be sent again.
- **Playback is owner-only** until moderation exists.
- pnpm 10 (not 12: corepack 0.31 cannot run it) and TypeScript 5.9 (not 7: tooling).

## Working agreements

- Explain the approach and trade-offs before implementing; one small step at a time; suggest a
  commit after each working step. Show the `cdk diff` and get an OK before a deploy that the
  user has not already approved.
- **Verify checks by exit code.** Never use `pnpm -s`: it hides sub-package errors. The full
  set is `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`, plus
  `pnpm --filter @cvp/web build`. CI runs the same on every push.
- **Warn before anything that costs money or changes billing**, including console steps.
- **Browser and API tests use a temporary Cognito user** (created with a random password, no
  email sent, deleted afterwards, along with its S3 objects and table items). Never test with
  the user's own account or files without asking.
- **Do not open the user's videos or posters.** Check them structurally (type, size, layout).
- **Port 3000 may be the user's own dev server.** Use it, never stop it.
- Commits are authored as `Yany954`; the former-employer account must never appear.
- No account IDs, portal URLs or secrets in committed files beyond what CDK output already
  shows; `.env.local` and the ffmpeg binaries stay out of git.

## How to run things

```bash
aws sso login --profile cvp-dev                 # sessions last 4 hours
pnpm --filter @cvp/web dev                      # web app on http://localhost:3000
pnpm --filter @cvp/infra cdk:diff               # also downloads ffmpeg if missing
pnpm --filter @cvp/infra cdk:deploy --all
./infra/scripts/smoke-health.sh                 # sign-in -> API -> Lambda
./infra/scripts/smoke-upload.sh                 # full upload flow with a 100 MB file
./infra/scripts/create-playback-key.sh          # once per environment
```

## Known gaps

- HEVC, audio conversion, large files and Safari/phone playback are unit-tested only.
- No captions on the player (WCAG 1.2.2); expected with the transcription feature.
- `GET /videos` returns at most 100 videos, with no paging.
- A failed "enqueue" after a completed upload leaves the video at `uploaded`; there is no
  "reprocess" action yet.
- Resuming an upload after a page reload was only seen in the browser for an upload that had
  already sent all its parts.
- The legal and compliance checklist in `CLAUDE.md` is untouched.
