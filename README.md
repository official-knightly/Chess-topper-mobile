<p align="center"><img src="src/assets/chess-topper-wordmark.png" alt="Chess Topper Mobile" width="360"></p>

<h1 align="center">Chess Topper Mobile</h1>

<p align="center">A mobile-first Android chess training and analysis assistant with a floating knight launcher and compact quick-controls panel.</p>

## Android app

Chess Topper Mobile is an Android application. This repository contains the mobile app only.

- Responsive, touch-friendly Chess Topper interface.
- Top-left menu for Evaluation, Apps, Setup, About and Settings.
- Chessboard and an **Overlay app** control below the board.
- Select Chess.com, Lichess and other installed apps as overlay targets.
- Floating knight launcher and a compact panel with user-selected shortcuts.
- Shortcuts can include engine ELO limit, analysis depth, skill level, threads and hash settings.
- Android accessibility service receives foreground-window state events only. It does not inspect screen contents or control chess moves.

## Fair-play use

The floating assistant is for training boards, puzzles, self-play and post-game review. It must not provide engine moves or automated play during live rated games. Selecting an app only enables the floating launcher over that app; it does not mean the app can read every chessboard.

## Stockfish for Android

The planned engine setup downloads the official Stockfish Android binary on first engine setup, selects the matching Android CPU architecture, verifies the download, and stores it in app-private storage for later offline use. The engine integration is intended for positions entered in Chess Topper, puzzles and completed-game analysis. Do not use it to obtain outside assistance during live rated games.

Stockfish is distributed under GPLv3. Any release that redistributes a Stockfish binary must include the corresponding source code or a clear source pointer and the required license notices.

## App connections

The Apps page lets users select installed Android apps, including Chess.com and Lichess, as overlay targets. Account linking and completed-game import are separate integrations and require the relevant official account/API authorization. App selection alone does not sign in to an account.

## Build the Android app

Requirements: Node.js 22+, Java 21, Android Studio and Android SDK.

```bash
npm install
npm run android:setup
npm run android:sync
npm run android:open
```

Build a local debug APK:

```bash
npm run android:build
```

## GitHub Actions and releases

Every push to `main` builds an installable Android APK. The workflow uploads a 30-day artifact and publishes the APK asset to the GitHub release tagged `mobile-latest`.

- [Latest Android APK release](https://github.com/official-knightly/Chess-topper-mobile/releases/tag/mobile-latest)
- [Android build workflow](https://github.com/official-knightly/Chess-topper-mobile/actions/workflows/android.yml)

## Project structure

- `src/` — mobile React interface and screens.
- `src/mobile/` — Capacitor bridge and mobile-specific behavior.
- `native-android/` — Android plugin, floating overlay service and configuration.
- `scripts/setup-android.mjs` — generates the native Android project.
- `android/` — Android Studio project.

