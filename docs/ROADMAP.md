# Roadmap and project state

Last updated: 2026-10-04 (web app deployed; events, invites and open sign-up done). This file
is the hand-off between work sessions: what is done, what is next, and the decisions and
habits that are not obvious from the code. `CLAUDE.md` holds the
product goals; this file holds the progress.

## Where we are

| Phase                   | State                                                    |
| ----------------------- | -------------------------------------------------------- |
| 0. Monorepo             | Done                                                     |
| 1. Secure AWS account   | Done                                                     |
| 2. Infrastructure (CDK) | Done                                                     |
| 3. Backend              | Upload to playback, moderation, delete. **Next: events** |
| 4. Web app              | Deployed on Amplify: sign-in/up, upload, player, events  |
| 5. Mobile app (Expo)    | Not started                                              |
| After the MVP           | README for GitHub, differentiating features              |

## What to do next, in order

### Now: fixes and requests from family testing (plan approved 2026-10-09)

1. **Privacy: done and deployed 2026-10-09.** There is no library that every account sees.
   A video outside an event is visible only to its owner (and to admins, to review it). Other
   people reach a video only through an event they belong to, once it is approved. `GET /library`
   is now "Shared with me": other people's approved videos from the events the caller owns or
   joined. `GSI3` holds only the review queue. Tested on the deployed API with temporary
   accounts (a fresh account gets an empty list and 404 on playback).
2. **"A removed video comes back in the event" (IMG_9837): hardened, cause not proven.**
   No code path adds a video by itself, and it has not come back since the owner removed it
   on 2026-10-09 06:23 UTC. Done and deployed 2026-10-09: every add/remove writes one log line
   in the `SetVideoEvent` function (`videoId`, `to`, `userId`); an event's videos are found in
   `GSI2` and then read consistently from the table; review and report update only the
   moderation fields (`saveModeration`); "Add your videos" is a checklist with one button.
   If it happens again, read that log first.
3. **Rename a video: done.** `PATCH /videos/{videoId}`, owner only; pencil on "Your videos" and
   on the player page.
4. **Invited people can reorder an event: done.** Ids the caller did not send keep their place
   after the sent ones; the order is stored with a targeted update (`saveOrder`).
5. **Web: upload preview and camera button: done.** Each upload row shows a thumbnail and the
   duration read from the local file in the browser (`lib/upload/preview.ts`; a file the
   browser cannot decode keeps the film icon). On touch devices "Record a video" opens the
   camera (`capture="environment"`). Not checked on a real phone yet.
6. **Web: Download button: done and deployed 2026-10-09.** `GET /videos/{videoId}/download` returns
   a 15-minute presigned link to the playable MP4 (same permission as playback). Billed as
   data leaving S3: about $0.09 per GB after the free 100 GB a month.
7. **Web: uploads keep running across pages: done.** The upload manager lives in the app
   shell (`lib/upload/uploads-context.tsx`); a strip under the navigation says how many are
   running or need attention. On iPhone/iPad a note explains the wait before an upload starts.
8. Mobile (phase 5) must also offer: offline library from the download route, record with the
   camera, upload preview, rename, reorder by members, and the upload fix below.

**Why iPhone uploads start slowly on the web, and the real fix (owner's report, 2026-10-09).**
Picking a video from Photos in Safari makes iOS fetch it from iCloud and prepare it before the
page receives the file: a 50-second video took about 4 minutes. A web page gets no file, no
progress and no event during that time, and Safari stops a page that is closed or in the
background, so the web cannot queue, show or continue it. Checked on the owner's 14 uploads:
resolution was never reduced (4K stayed 4K). The codec is not stored, so a re-encode by the
phone cannot be ruled out.
The fix is the mobile app, which must:

- ask Photos for the original file and **show the iCloud download progress**;
- **hand the upload to iOS** (background upload session) so it continues with the app closed
  or the phone locked, and resumes after a lost connection;
- do the same on Android with its background upload service.

### 3a. Moderation: done (manual review)

An admin approves or rejects each playable video. Approval lets the people of the video's
event watch it (until 2026-10-09 approved videos outside an event were in a library for all). Automatic checks (Rekognition, roughly $0.10 per minute of video:
confirm the price and warn before building) are not built; `flagged` is reserved for them and
for reports.

### 3a-2. Delete video: done

`DELETE /videos/{id}`: the owner, or an admin for any video. Removes the row, the original,
the playable copy and the poster; the bytes go back to the owner in the same transaction.

### 3a-3. Report a video, block a user: done

- **Report** (`POST /videos/{id}/reports`): anyone who can see a video, except its uploader,
  once per person; reasons violence, sexual, harassment, other; optional note. An approved
  video becomes `flagged` at once (hidden from everyone but its uploader and admins) and
  returns to the review queue, where admins see each report with the reporter's email.
- **Block** (`POST /me/blocks` with a `videoId`, `GET /me/blocks`, `DELETE /me/blocks/{id}`):
  one-way and silent. The blocker stops seeing that person's videos (library, events, direct
  link); the blocked person is removed from the blocker's events and their invite links
  answer "not valid". Admins still open blocked people's videos to review them.
- Rows: `VIDEO#{id}` / `REPORT#{reporterId}` and `USER#{blockerId}` / `BLOCK#{blockedId}`.
  Reports go when their video is deleted; a block list goes with its owner's account.
- Suspending and deleting accounts (the "ban" part) are in the Users view.

### 3b. Events (categories), continuous playlist and collaborators

The user's words: categorise a video as "Concert Twenty One Pilots October 2026", and add a
collaborator (their boyfriend) so he can upload what he filmed that day to the same event.
Explain the design and agree on it before coding.

Decided by the user:

- **Any user creates events** for their own videos (this replaces "admins manage categories"
  in `CLAUDE.md`). In code the entity is `Category`; the interface calls it an "event".
- **Events are private: only the owner and the people they invite see them.** The user does
  not want an "everyone" option, so the web app only creates private events and offers no way
  to share one with all users. The API and domain still support `shared`; leave it unused.
- **Collaborators** are invited to add their own recordings to an event.
- **Manual reordering**: an up arrow moves a video one place earlier, and a temporary
  "reorder" view lets the user drag videos up or down, then save.
- **Autoplay-next switch** in the player, on or off.
- Continuous play must keep working **in Picture-in-Picture and with the phone locked**.

Design in the domain (`domain/category.ts`, done):

- Which videos belong to an event is recorded on each video (`categoryId`). The event keeps
  only the playing `order`; videos it does not mention yet go last, oldest first.
- Others see a video only if it is approved and they are members of its event (`private` is
  still stored but no rule depends on it). Moderation still applies.
- Only the owner renames, reorders, changes visibility or deletes an event. Members add only
  their own videos.

Slices, in order:

1. **Events: done.** Create, rename, private/shared, delete; add and remove videos on the
   event page; reorder with the up arrow or in a temporary drag view (`@dnd-kit`, with arrow
   buttons and keyboard dragging as alternatives).
2. **Continuous play: done (web).** "Play all" on the event page opens
   `/events/{id}/play?v=<videoId>`: one `<video>` element whose source changes, so
   Picture-in-Picture and full screen survive; the next video's signed link is fetched ahead;
   Previous/Next buttons; an "Autoplay next video" switch remembered in `localStorage`; the
   Media Session API gives the lock screen, media keys and PiP window a title and
   previous/next. Not verified: real Picture-in-Picture, a phone, and Safari.
3. **Collaborators: done, through an invite link.** The owner creates a link on the event
   page (`/events/{id}/join#<secret>`); whoever opens it while signed in becomes a
   collaborator. A signed-out visitor goes to the login page and returns to the event after
   signing in (the destination is kept in session storage, never in the URL). The owner can
   make a new link, turn it off, and remove people; collaborators can leave.
   **Open sign-up: done.** Anyone can create an account from the login page ("Create an
   account"); Cognito emails a 6-digit code that must be entered before the first sign-in.
4. Mobile (Phase 5): background audio, lock-screen controls and PiP for the same playlist.

### 3d. User management and profile: done

- Admin **Users** page: every account with role, status and storage; invite by email
  (Cognito sends a temporary password); storage limit in GB per account; make/remove admin;
  suspend/reactivate. Admins cannot suspend themselves or drop their own admin role.
- **Profile** page for everyone (the email in the header links to it): email, role, storage,
  change password.
- Routes: `GET /admin/users`, `POST /admin/users`, `PATCH` and `DELETE /admin/users/{userId}`, `POST /me/deletion`,
  `POST /videos/{id}/reports`, `POST` and `GET /me/blocks`, `DELETE /me/blocks/{userId}`. No Lambda may
  delete a user or read or set a password (a CDK test enforces it).

### 3e. Delete an account and its data: done

- `POST /me/deletion` (own account; the server checks the password by signing in with it) and
  `DELETE /admin/users/{userId}` (admins, never their own). Both only suspend the account and
  put a message on the `account-deletion` queue.
- The `AccountDeleter` function (processing stack) then removes the person's videos and files,
  the events they own, their memberships, their storage record and, last, the Cognito user.
  It retries 3 times, 11 minutes apart, then parks the message in the dead-letter queue.
- The last admin cannot be deleted.
- Other people's videos in a deleted event are kept with `categoryId: null` (the user's
  choice): visible only to their uploader.

### 3c. Fargate re-encoding

For videos the Lambda cannot handle: codecs other than H.264/HEVC, and files over 9 GiB. Today
they are marked `failed` with `UNSUPPORTED_VIDEO_CODEC` or `TOO_LARGE`. Fargate costs money per
minute of CPU: give the user a cost estimate before building it.

### 4. Finish the web app

- **Deployed on AWS Amplify Hosting: done.** https://main.d1fywgy7g1rdyk.amplifyapp.com
  (app `cvp-web`, created in the console and connected to the GitHub repo; every push to
  `main` builds and deploys, about 4 minutes and $0.04; put `[skip-cd]` in a commit message
  to skip the build, e.g. for docs-only commits). Build settings are in `amplify.yml`; the
  three `NEXT_PUBLIC_*` settings are environment variables of the Amplify app. Next.js 16
  runs there although Amplify's documentation lists versions 12 to 15: if a later upgrade
  breaks, the agreed fallback is to downgrade to Next.js 15.
- **Forgot password: done** ("Reset your password" on the sign-in page; Cognito emails a
  code; the answer is the same whether or not the address has an account).
- **Choosing an event while uploading: done** (a select above the drop zone on "Your videos",
  listing the user's own events and the ones they were invited to).
- **Light and dark mode: done.** A sun/moon button in the header and on the sign-in page; the
  Profile page offers "Match my device", Light and Dark. The choice is in `localStorage`
  (`cvp.theme`) and applied to `<html data-theme>` by a script before the first paint.
- **Google sign-in: postponed by the user (2026-10-04), "leave it for later".** It needs a
  Google Cloud OAuth client created by the user and a Cognito domain. MFA at sign-in: later.

Decided by the user on 2026-10-04 for the three items below:

- Name shown: **Cloud Video Player**. Operated from the **United States**.
- **Minimum age 13.** (Draft the terms so that people aged 13 to 17 need a parent's or
  guardian's permission: Colombia and several other countries treat under-18s as minors.)
- Spanish: **neutral Latin American, using "tú"**.
- **No liquid glass.** The floating bar gets something distinctive that works in every browser.
- **Contact email for the legal pages and the landing page:
  cloudvideoplayer.contact@gmail.com** (a mailbox made for the app; never the user's personal
  address or one at their former employer's domain).

Asked by the user on 2026-10-04, in this order (agree each plan before coding):

1. **English and Spanish: done for the whole web app.** Every screen, dialog, error message,
   label for screen readers, date and number. Cognito's emails (confirmation and reset code, invitation) carry both languages in one
   message (`infra/lib/auth-stack.ts`); how they look in an inbox was not checked.
   How it works: texts live in `apps/web/src/lib/i18n/messages/en.ts` (the source) and
   `es.ts` (same shape, checked by a test); texts with values are functions. The language is
   the `cvp.lang` cookie if set, else the browser's `Accept-Language`, read on the server in
   the root layout, so every page is rendered per request and the first paint is already in
   the right language. `useI18n()` gives `t` in client components, `useFormat()` gives
   language-aware sizes and dates, `messagesFor(await getLocale())` serves server components.
   Helpers that return text (`authErrorMessage`, `uploadErrorMessage`, `videoStatusLabel`)
   take the messages as an argument. New screens must add their texts to both files.
   Spanish is neutral Latin American with "tú" and «» quotes. The user has family in Colombia.
2. **Legal pages: drafted and published, NOT yet reviewed by a lawyer.** `/privacy`,
   `/terms` and `/cookies`, in English and Spanish, linked from the landing page, the sign-in
   page and the app's footer. Their text is in `apps/web/src/content/legal/` (one file per
   document, both languages in it; a test checks the two languages have the same outline and
   that the cookie policy names every item the code stores). `LEGAL_UPDATED` is the date shown.
   Creating an account requires ticking "I am at least 13 years old, and I agree to the Terms
   of service and the Privacy policy".
   No cookie banner: the app stores only what it needs to work and preferences the visitor
   sets; if analytics or anything similar is ever added, a banner becomes necessary.
   Keep the texts true: when the app changes what it stores, who can see it, or how long,
   change the policy in both languages.
   Open points for the lawyer and the user:
   - The terms say "the laws of the United States" without a state; a lawyer should name one.
   - Copyright complaints go to the contact email; a registered DMCA agent may be advisable.
   - The consent is a required checkbox in the browser; the server keeps no record of it.
   - Commitments made in the text: answer data requests within 30 days; notify users of a
     breach that affects them; give reasonable notice before closing the service.
   - Refund policy and unsubscribe links are not applicable (no payments, no marketing email).

3. **Landing page: done.** `/` is the public landing page (`apps/web/src/app/page.tsx`); the
   signed-in home moved to `/videos` (`HOME` in `lib/auth/return-to.ts`). A `cvp.session`
   cookie, set while signed in, is only a hint that lets the server send signed-in visitors
   from `/` straight to `/videos`; it is not a credential.
   Effects live in `apps/web/src/components/effects/`: `StageGradient` (ShaderGradient) and
   `LiquidMetalLogo` (Paper's LiquidMetal shader, with our own `public/brand-mark.svg`). Each
   is loaded in the browser only, after the first paint, over a static fallback that is the
   server's HTML; removed while off screen; never created with reduced motion, without WebGL
   or with data-saving on (`use-effects-allowed.ts`). The landing page has two canvases, the
   sign-in page one. The floating bar is plain CSS (`.light-rim`), no liquid glass.
   Contact shown in the footer: cloudvideoplayer.contact@gmail.com (a mailbox the user made
   for the app). Content rule: only what the product does today; no testimonials or counts.

### 4b. Visual effects on the web: done (landing, sign-in, event header)

Web only (Next.js), in a few key places. Before writing code: explain the plan, the
components, where they live and the trade-offs, and get the user's OK.

Libraries:

1. **ShaderGradient**: `@shadergradient/react` + `@react-three/fiber` + `three`. The web app is
   on Next.js 16 and React 19.2, so it needs R3F v9. Check compatibility first.
2. **Liquid glass**: evaluate `shuding/liquid-glass` (SVG filters) against a glass built with
   R3F. Check Safari and iOS support first; if it does not work in Safari, propose the
   alternative.
3. **Liquid metal logo**: the LiquidMetal shader from `@paper-design/shaders` (Apache-2.0).
   Do NOT copy code from `paper-design/liquid-logo` (PolyForm Shield licence).

Where:

- Landing hero: ShaderGradient background + liquid metal logo.
- Login / sign-up page: a subtle ShaderGradient background.
- Event (category/concert) header: a gradient in that event's colors. This needs an event to
  have colors: decide where they come from (chosen by the owner, or taken from a poster).
- Floating navigation bar: glass effect.
- NOT in: the admin panel, upload forms, video lists, or on top of a playing video.

Event header (done 2026-10-04): an event has a `theme`, one of eight (`CATEGORY_THEMES` in the
domain, `EVENT_THEMES` in `packages/shared`): stage, sunset, forest, ocean, ember, violet,
gold, steel. The owner picks it on the event page; an event with none gets one from its id
(`defaultTheme`), also for rows written before themes existed. The web app owns the colours
(`apps/web/src/lib/event/themes.ts`); a test keeps white text at AA on every colour through
the header's 60% scrim. Colours are not taken from posters: the browser may not read pixels
from signed image links.

Requirements:

- Load every WebGL component on the client only (dynamic import with `ssr: false`) and
  lazily, so it never slows the first paint.
- At most one or two WebGL canvases per page. Pause animations when off-screen or when the
  tab is hidden.
- `prefers-reduced-motion`: show a static image or CSS gradient instead.
- No WebGL available: fall back to a static CSS gradient.
- Text over glass or gradients keeps WCAG AA contrast.
- Test on mobile Safari and Chrome.
- The mobile app is out of scope for these libraries; it recreates the look later with
  Reanimated / Expo native glass (noted in `CLAUDE.md`).

Also asked in the same message, to clarify with the user when this phase starts: "listas
largas de videos" (long lists of videos), probably how an event page should handle many
videos (today it shows at most 200, with no paging).

### 5. Mobile app

Started 2026-10-09. Expo SDK 57 (React Native 0.86, React 19.2), TypeScript, Expo Router, in
`apps/mobile`. Builds are made on the Mac with Xcode (`pnpm --filter @cvp/mobile ios`): free,
no EAS. iPhone first, Android after. Sharing through TestFlight needs the Apple Developer
Program ($99 a year): decide when the app is worth sharing.

| Step                                                                 | State |
| -------------------------------------------------------------------- | ----- |
| 1. Skeleton in the monorepo, running in the simulator                | Done  |
| 2. Sign in, sign up, forgot password (Cognito), English/Spanish      | Built |
| 3. Watch: lists and player (PiP, locked-screen sound, AirPlay)       |       |
| 4. Events: play all, add from a checklist, reorder, rename           |       |
| 5. Upload with the app open: Photos or camera, preview, pause/resume |       |
| 6. Upload in the background + iCloud progress (small Swift module)   |       |
| 7. Offline library; report/block; delete account; legal pages        |       |
| 8. The owner's iPhone; TestFlight decision; then Android             |       |

Notes for whoever continues:

- Step 2 is built but **the sign-in itself has not been exercised**: the screens render in the
  simulator (English/light, Spanish/dark), and the token storage, texts and error messages
  have unit tests, but nothing on this Mac can tap or type in the simulator. Either the owner
  tries it by hand, or a UI test tool (Maestro is the usual one for Expo) is installed.
- Sign-in uses Amplify's SRP flow like the website (`src/lib/auth/cognito.ts` mirrors the
  web's). Tokens are kept in the Keychain / Keystore through `expo-secure-store`
  (`src/lib/auth/secure-storage.ts`), split in pieces because a stored value has a size limit.
- The app follows the phone's language (Spanish for any Spanish, English otherwise) and its
  light/dark appearance. There is no in-app switch yet.

- `apps/mobile/.env` holds the same public ids as the web's `.env.local`, with the
  `EXPO_PUBLIC_` prefix (`.env.example` shows the names).
- `ios/` and `android/` are generated by `expo prebuild` and not committed.
- Bundle id `com.cloudvideoplayer.app` is a placeholder: it can change until the first upload
  to App Store Connect.
- The app icon and splash image are still the Expo template's.
- The website's cloud build installs the whole workspace with a flat `node_modules`, mobile
  packages included. Two versions of `@types/react` there break the web's type check, so
  `pnpm-workspace.yaml` pins one version for everyone (`overrides`). Before pushing a change to
  mobile dependencies, reproduce that build locally: copy the repository, add
  `node-linker=hoisted` to `.npmrc`, `pnpm install --frozen-lockfile`, `pnpm --filter @cvp/web build`.

Expo development build. Reuse `packages/upload-client`: implement `putPart` with the native
background uploader. Player with `expo-video`.

Must-haves recorded under "Now: fixes and requests from family testing": original file from
Photos with iCloud download progress, uploads that continue with the app closed or the phone
locked, offline library, camera recording, upload preview, rename, reorder by members.

Cost while building it: AWS deploys (`cdk deploy`) are free; each push to `main` starts an
Amplify build of the website (about $0.04). Mobile-only commits should carry `[skip-cd]`, and
web changes should be pushed in batches. Building the app with EAS has its own free tier:
check the current limits before the first build.

### After the MVP

- **Security review of the whole MVP with the official Claude security plugin** (the user
  asked for it on 2026-10-04: not now, at the end of MVP development). Fix what it finds
  before calling the MVP done.
- A polished `README.md` for GitHub (the user asked for it; not before the MVP is finished).
- Differentiators from `CLAUDE.md`, one at a time. Audio mode is the suggested first one, and it
  is when HLS and an audio-only rendition get added.

## What exists

### AWS (account region `us-east-1`, all stacks prefixed `cvp-dev-`)

| Stack        | Contents                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------- |
| `auth`       | Cognito user pool (open sign-up, email confirmed by code), groups `admin`/`user`, client |
| `data`       | DynamoDB single table `cvp-dev-data`, `GSI1`..`GSI3`, PITR, TTL on `expiresAt`           |
| `storage`    | `uploads` bucket (originals), `media` bucket (playable copies), CloudFront + key group   |
| `processing` | SQS queue + dead-letter queue, ffmpeg layer, processor Lambda                            |
| `api`        | HTTP API with Cognito JWT authorizer, one Lambda per route                               |

API routes: `GET /health`, `GET /me/storage`, `POST /uploads`, `GET /uploads/{id}/parts`,
`POST /uploads/{id}/complete`, `DELETE /uploads/{id}`, `GET /videos`,
`GET /videos/{id}/playback`, `GET /library`, `GET /admin/review`,
`POST /admin/videos/{id}/review`, `DELETE /videos/{id}`, `POST /events`, `GET /events`,
`GET /events/{id}`, `PATCH /events/{id}`, `PUT /events/{id}/order`, `DELETE /events/{id}`,
`PUT /videos/{id}/event`, `PUT` and `DELETE /events/{id}/invite`, `POST /events/{id}/join`,
`DELETE /events/{id}/collaborators/{userId}`, `GET` and `POST /admin/users`,
`PATCH /admin/users/{userId}`. `POST /uploads` takes an optional `eventId`. The `/admin` routes check the `admin` group in the handler
and answer 403 otherwise.

Outside CDK: the Amplify app `cvp-web` (hosting for `apps/web`), the playback private key in SSM (`/cvp-dev/playback/private-key`), the budget
`cvp-monthly`, Free Tier alerts and Cost Anomaly Detection.

### Repository

```
apps/web                 Next.js 16: sign-in, upload, lists, player, review
packages/shared          API contracts (types + Zod schemas)
packages/upload-client   Upload engine and API client, shared by web and (later) mobile
services/api/src         domain -> application -> infrastructure -> interfaces
infra                    CDK stacks, tests, scripts (smoke tests, ffmpeg and key setup)
```

### Table key design

| Item     | PK              | SK        | Indexes                                                                                               |
| -------- | --------------- | --------- | ----------------------------------------------------------------------------------------------------- |
| User     | `USER#{sub}`    | `PROFILE` |                                                                                                       |
| Video    | `VIDEO#{id}`    | `META`    | `GSI1`: `OWNER#{userId}` / `createdAt`. `GSI3`: `MODERATION#queue` / `createdAt`                      |
| Category | `CATEGORY#{id}` | `META`    | `GSI1`: `OWNER#{userId}#CATEGORIES`. `GSI2`: `CATEGORIES` when shared. Videos: `GSI2` `CATEGORY#{id}` |

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
- **Who can watch a video:** its owner always; an admin any playable video (so admins can
  see every upload, which the Terms of Service must say); everyone else only approved ones.
  A video the caller may not see answers 404, never 403.
- **`GSI3` holds the review queue** (pending and flagged), written once a video is playable.
  Approved and rejected videos are not in it. `GSI2`
  stays free for categories.
- **Admin uploads also start as `pending`**: one rule for everyone.
- **Deleting removes the table row first, then the files**, and is refused while a video is
  being processed. The web app offers it only for ready or failed videos.
- **"Your videos" explains the review** under the upload area (the user asked for it): every
  upload is reviewed before others see it, and inappropriate content is rejected or taken
  down, with a link to the terms.
- **A decision can be changed later** (take down an approved video, approve a rejected one);
  the video records who decided and when.
- **New accounts get 5 GiB** (`DEFAULT_QUOTA_BYTES`); the owner's account keeps the 50 GiB
  stored in its profile row. Raising someone's quota means changing `quotaBytes` on their
  `USER#{sub}` / `PROFILE` row (a button for it belongs to the admin Users view).
- **Sign-up is open to anyone** (the user chose this over sign-up restricted to invite
  links, knowing the trade-off). Consequence: any stranger who finds the login page can create
  an account and upload up to 50 GiB, which the owner pays for. Not built yet, and worth
  proposing: a smaller quota for accounts nobody invited, an admin "approve new account"
  step, or a CloudWatch alarm on total storage. Cognito's built-in sender allows about 50
  emails a day; beyond that it needs Amazon SES.
- Web buttons use sentence case ("Take down"), not Title Case.
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

- Visual effects were checked in Chrome/Edge and in Playwright's WebKit (desktop and an
  emulated iPhone), never on a real iPhone or in real Safari.
- ShaderGradient needs `three` and `@react-three/fiber` installed beside it; together they are
  a script of about 1.1 MB (before compression) that only the landing and sign-in pages load,
  lazily.
- The web app sends basic security headers (HSTS, no framing, no MIME sniffing, referrer
  policy) but no Content-Security-Policy yet.
- Amplify builds on every push to `main`, including pushes that do not touch the web app.
- A video kept private after its event was deleted has no button to make it public again
  (its owner can add it to one of their own events, or delete it).
- The last-admin guard is unit-tested only: the real pool always has the owner as an admin.
- One report hides a video until an admin decides, so a person can temporarily hide someone
  else's video by reporting it (the user accepted this; admins see who reported).
- Blocks made against a person stay as rows after that person's account is deleted.
- Suspending a user or changing a role fully applies only when their current token expires
  (up to 1 hour).
- HEVC, audio conversion, large files and Safari/phone playback are unit-tested only.
- No captions on the player (WCAG 1.2.2); expected with the transcription feature.
- `GET /videos`, the library and the review queue return at most 100 videos, with no paging.
- Deleting does not invalidate CloudFront's cache: an edge may keep a deleted video for up to a
  day, watchable by someone holding a signed link that has not expired yet (6 hours at most).
  Fix: create an invalidation for `media/{id}/*` on delete (the first 1,000 a month are free).
- An event can be deleted only when empty, and a video moved only when it is ready or failed.
- Taking a video out of an event makes it visible to its owner only; the web app says so.
- A video moved at the same instant an admin reviews it can lose the move (the review rewrites
  the whole record). Rare; the owner repeats the move.
- An event page shows at most 200 videos; event lists at most 100 events.
- Anyone with an account and an event's invite link can join it. Removing a person does not
  stop them rejoining while the same link is on (the dialog says to make a new link).
- A removed collaborator's videos stay in the event, and they can no longer reach the event
  page to take them out (they can still delete them).
- Memberships are rows `USER#{sub}` / `MEMBER#{categoryId}`; the category's `collaboratorIds`
  is the source of truth.
- "Shared with me" does not say who uploaded a video: user names are not stored yet.
- A failed "enqueue" after a completed upload leaves the video at `uploaded`; there is no
  "reprocess" action yet.
- Resuming an upload after a page reload was only seen in the browser for an upload that had
  already sent all its parts.
- The legal and compliance checklist in `CLAUDE.md` is untouched.
