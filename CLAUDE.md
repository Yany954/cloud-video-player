# CLAUDE.md

> **Progress, next steps and working agreements live in [`docs/ROADMAP.md`](docs/ROADMAP.md). Read it at the start of every session and update it when a step is finished.**

## Project goal
A secure mobile app (iOS + Android) plus a web admin to store and stream heavy, high-quality video files (concerts, presentations) without using personal storage like iCloud. Focused on live events and sharing among family and friends.

## Platforms
- **Mobile app**: React Native + Expo (DECIDED). Main experience: watch AND upload. Needs Picture-in-Picture, background audio with lock-screen controls, AirPlay/Chromecast, background/resumable uploads. Use Expo development builds (not Expo Go) since these need native config.
- **Web (app + admin + landing)**: every signed-in user can upload and watch; admins also moderate and manage. Landing page. React + shadcn/ui. Responsive, WCAG 2.2 AA.

## Core features (MVP)
1. **Upload & storage**: resumable multipart upload of large files straight to S3 via presigned URLs. Preserve original quality.
2. **Any format, no work for the user**: accept MP4, MOV, MKV, AVI. Backend normalizes once after upload: remux when the codec is compatible (lossless, fast), transcode only when it is not. Output: MP4/HLS playable by native players (AVPlayer / ExoPlayer). Never transcode on the phone.
3. **Categories & continuous player**: videos grouped by event/artist/topic. "Play" on a category autoplays the whole playlist in order.
4. **Auth & roles**: AWS Cognito. `user` uploads (web AND mobile, MVP must prove both) and watches; uploads stay `pending` until moderated. `admin` does everything a user does plus moderation, user management and categories. Email + Google sign-in (no GitHub).
5. **Storage usage widget & quota**: track `bytesUsed` per user/library in DynamoDB, updated on upload complete. Never compute it by listing S3. Per-user quota: 50 GB (checked before an upload starts and re-checked with the real size on complete).
6. **Privacy & security**: videos never public; CloudFront signed URLs. Follow data protection laws and security best practices.

## Differentiating features (build AFTER the core works, one at a time)
1. **Audio mode**: keep listening with the screen locked / app in background, lock-screen controls, data-saving audio-only rendition.
2. **Picture-in-Picture**: mini floating player while using other apps.
3. **Auto chapters**:
   - Presentations: transcription (e.g., Amazon Transcribe) -> LLM segments by topic -> chapters + full-text search that jumps to the exact second.
   - Concerts: detect song boundaries (applause, silence, talking between songs) -> suggested chapters; user confirms/renames. Optional song recognition later.
4. **Multi-angle sync**: several people upload recordings of the same event. Align them by audio (cross-correlation / audio fingerprint) to compute each video's offset on a shared event timeline. Player lets you switch angle keeping the same moment (seek to currentTime + offset). Handle clips that only cover part of the event.
5. **Clips & moments**: mark a moment and share a short clip.
6. **Timestamped comments**: comments pinned to an exact second, visible on the progress bar.
7. **Collaborative collections**: one album per event where invited people upload their recordings (feeds multi-angle).

Explicitly out of scope: watch party.

## Phases
- **Phase 1 (MVP)**: personal use, family and friends. Core features + one differentiator. Keep costs minimal.
- **Phase 2**: more differentiators, subscriptions/payments.
  - Payments ONLY on the web with Stripe (checkout, customer portal, webhooks -> update membership in DynamoDB).
  - Mobile app shows the user's membership/plan and, to upgrade, links out to the web checkout in the external browser (not an in-app webview). No in-app purchases.
  - Store rules on link-outs are changing (US currently allows link-outs; Apple and Google have proposed fees; rules differ outside the US). RE-CHECK Apple App Review Guidelines 3.1.x and Google Play policies right before implementing. Design so the link-out button can be shown/hidden per country (storefront) via config.

## Architecture (AWS)
| Layer | Service |
|---|---|
| Auth | Cognito (groups for roles) |
| Upload | S3 multipart + presigned URLs |
| Processing | SQS message (sent once an upload is accepted) -> Lambda + ffmpeg: remux to a fast-start MP4 with stream copy (no re-encode) when codecs are compatible; HLS comes with audio mode. Only for incompatible codecs or files over 9 GiB: re-encode in a Fargate/Batch ffmpeg job (no 15-min limit). MediaConvert only if needed later. |
| Storage policy | Serve the converted good-quality version. Move the original to Glacier as backup. S3 Intelligent-Tiering for served files (DECIDED). |
| Delivery | CloudFront with signed URLs |
| API | API Gateway + Lambda (Node/TypeScript) |
| Data | DynamoDB |
| Infra as code | AWS CDK (TypeScript) |

## Content moderation (no violent or sexual content)
- Sign-up is open (decided 2026-10-04, so people invited to an event can create their own account); the email address must be confirmed with a code. Videos stay private by default: a new account sees only its own videos, events it was invited to, and approved library videos.
- Every upload starts as `pending`: not visible to anyone except the uploader until approved.
- After upload, run automatic moderation (e.g., Amazon Rekognition video content moderation, or ffmpeg-extracted frames + image moderation to lower cost). Results: `approved` / `flagged` / `rejected`.
- Flagged videos go to an admin review queue in the web admin.
- Users can report a video and block users. Ban/suspend accounts that violate the rules.
- Terms of Service must define prohibited content. App stores require filtering, reporting and blocking for apps with user-generated content.
- Before any public launch (Phase 2): research legal reporting obligations for illegal content (e.g., child sexual abuse material must be reported, not just deleted) and hash-matching tools.

## Legal & compliance checklist (draft with Claude, have a lawyer review before public launch / Phase 2)
1. Privacy policy
2. Terms of service (include prohibited content)
3. Refund policy (Phase 2)
4. Cookie policy (web)
5. Cookie consent banner (web)
6. Check consents in every form
7. Collect no unnecessary data (data minimization)
8. Audit third-party SDKs (what data they collect)
9. No dark patterns (e.g., easy to cancel subscription)
10. No hidden fees; show full price up front
11. No fake reviews or testimonials
12. No unsupported claims in marketing copy
13. Alt text on images (accessibility)
14. Sufficient color contrast (WCAG AA)
15. Full keyboard navigation (web)
16. Business details visible (name, contact)
17. Age requirements / parental consent for minors' data
18. Unsubscribe link in every marketing email
19. Licensed fonts, images, music and AI-generated assets
20. Data deletion requests: users can delete their account and data (also required in-app by Apple for apps with account creation) — built for the web (Profile page); the mobile app must offer it too

## Web framework & hosting
- **Next.js** (DECIDED) for landing, pricing, admin and Stripe checkout.
- **Hosting: AWS Amplify Hosting** for the MVP (simplest: git push -> deploy). Live at https://main.d1fywgy7g1rdyk.amplifyapp.com. Avoid relying on advanced Next.js features with spotty Amplify support (on-demand ISR, streaming, i18n auto-detection). Fallback if Amplify causes problems: SST/OpenNext (deploys Next.js to Lambda + CloudFront + S3 in our AWS account).

## Future phase (ONLY after everything above works and is tested)
- **Physical CD / vinyl orders**: order a whole category (e.g., "Concierto Rosalía") as a CD or vinyl, with a custom AI-generated cover. Keep the data model flexible so a category can later become an "album" (ordered tracks, audio extraction, cover image).

## Conventions
- Language: TypeScript end to end where possible.
- Clean architecture: `domain/` -> `application/` (use cases) -> `infrastructure/` (AWS adapters) -> `interfaces/` (handlers/UI). Domain has no AWS imports.
- Monorepo:
  ```
  apps/mobile/   apps/web/
  services/api/src/{domain,application,infrastructure,interfaces}
  infra/         (CDK stacks)
  packages/shared/ (shared types)   packages/upload-client/ (upload engine for web + mobile)
  ```
- Testing: Vitest for domain and use cases; Playwright E2E for web; mobile E2E tool TBD with framework. Verify checks by exit code and never with `pnpm -s` (it hides sub-package errors).
- Secrets: never commit keys; `.env` files in `.gitignore`.
- AWS cost safety: account is on the paid (pay-as-you-go) plan, no free credits; only always-free limits apply. Monthly budget `cvp-monthly` ($10, alerts at 85%/100% actual and 100% forecast), Free Tier alerts and Cost Anomaly Detection (daily summary, >$5) email me. Budgets only alert, they never stop resources. Warn me before creating any resource that costs money beyond free tier (e.g., MediaConvert jobs), and before any console step with billing side effects.
- AWS access: region `us-east-1`. Daily work through IAM Identity Center (user with AdministratorAccess, MFA always-on); CLI profile `cvp-dev` via SSO. Never use root or long-lived access keys.

## Design resources
- Skills: taste-skill (+ image-to-code-skill), web-design-guidelines, playwright-cli. Reference DESIGN.md from awesome-design-md.
- Web shadcn blocks: `landing-01`; auth `https://registry.watermelon.sh/r/auth-05.json` (remove the GitHub button); navigation `https://registry.watermelon.sh/r/navigation-4.json`; storage widget `https://registry.watermelon.sh/r/widget-2.json`.
- Motion (web): Motion Primitives (motion-primitives.com; React + Tailwind + Motion, shadcn-style copy-in components). Use for the landing and key moments (category card -> player transition, scroll reveals, thumbnail effects). Keep the admin mostly static.
- Motion (mobile): Motion Primitives does NOT run in React Native. Use it only as visual inspiration and implement with React Native Reanimated (or Moti).
- Visual effects (WEB only, DECIDED 2026-10-04; build in a later phase, plan in `docs/ROADMAP.md`): ShaderGradient (`@shadergradient/react` + `@react-three/fiber` v9 + `three`), a liquid-glass effect, and the LiquidMetal shader from `@paper-design/shaders` (Apache-2.0) for the logo. Never copy code from `paper-design/liquid-logo` (PolyForm Shield licence). Use them only on the landing hero, the login/sign-up page, the event header (gradient in that event's colors) and a floating navigation bar. Never in the admin panel, upload forms, video lists, or on top of a playing video.
- Built 2026-10-04: landing page at `/` (signed-in home is `/videos`) with the ShaderGradient hero and liquid-metal logo; effect components in `apps/web/src/components/effects/`, always over a static fallback. `three` 0.186 and `@react-three/fiber` 9.8 are required beside `@shadergradient/react`.
- Decided 2026-10-04: no liquid-glass effect (Safari support); the floating bar uses plain CSS that works in every browser. Versions checked: `@shadergradient/react` 2.4 (MIT, React 18/19), `@react-three/fiber` 9.8 (needs React 19.0 to 19.3), `@paper-design/shaders-react` 0.0.81 (Apache-2.0, pre-1.0: pin the exact version).
- Mobile will not use those libraries (they do not run in React Native): recreate the look later with Reanimated / Expo native glass.
- Always respect reduced-motion preferences (`prefers-reduced-motion` on web, OS "Reduce Motion" setting on mobile). Animations must never block or delay playback.

## About me / how to work with me
- Software engineer, ~2.5 years. Flutter, React.js, Firebase, GCP. Usually TypeScript with clean architecture. First time with AWS and Claude Code.
- I want to UNDERSTAND the decisions, not just receive finished code. Before implementing, explain the approach and trade-offs briefly.
- Work in small steps: plan first, one feature at a time.
- Suggest a git commit after each working step.
- I may write in Spanish or English; answer in the language I use.
