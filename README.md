<p align="center"><img src="src/assets/chess-topper-wordmark.png" alt="Chess Topper" width="420"></p>

<h1 align="center">Chess Topper Mobile</h1>

<p align="center">Android companion app with the familiar Chess Topper interface, configurable quick settings and a floating knight control.</p>

## Mobile experience

- The hamburger menu in the top-left opens Evaluation, Chess apps, Setup, About and Settings.
- Evaluation keeps the chessboard and has an **Overlay app** panel directly below it.
- Select installed apps such as Chess.com or Lichess from **Chess apps**. You can also choose other launchable apps installed on the device.
- Enable the floating knight from **Setup**. Android then asks you to turn on the Chess Topper accessibility service.
- Tap the floating knight above a selected app to open the compact quick-settings panel.
- Add controls from the existing **Add shortcuts** picker in the navigation drawer. The floating panel reads the saved shortcut list (for example ELO, depth and skill level).

## Important compatibility note

The floating button can appear over selected apps. That does **not** mean Chess Topper can automatically read every chessboard. Live position detection, engine evaluation and board interaction require a compatible adapter for each chess app. The current mobile foundation implements app selection, foreground-app detection and quick settings; it does not claim universal live board recognition.

The accessibility service is configured to receive window-state events only and does not request access to window content, screen text or move input. Users must enable it manually in Android Accessibility settings. Android provides accessibility overlay windows specifically for accessibility services; the service is used here only to show the floating control panel.

## Build the Android app

Requirements: Node.js 22+, Java 21, Android Studio and Android SDK.

```bash
npm install
npm run android:setup
npm run android:sync
npm run android:open
```

To build a local debug APK:

```bash
npm run android:build
```

The generated project is under `android/`. GitHub Actions also builds a debug APK on pushes to `main` and uploads it as the `chess-topper-android-debug` workflow artifact.

## Native architecture

- `src/` and `ui-template/` — React interface reused from desktop Chess Topper.
- `src/mobile/` — Capacitor bridge and mobile styles.
- `native-android/` — native plugin, accessibility service and service configuration templates.
- `scripts/setup-android.mjs` — generates the Capacitor Android project and copies native components.
- `android/` — generated Android Studio project.

## Repositories

- [Chess Topper Mobile](https://github.com/official-knightly/Chess-topper-mobile)
- [Desktop Chess Topper](https://github.com/official-knightly/Chess-topper-app-)

