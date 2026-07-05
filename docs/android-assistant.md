# Android Digital Assistant Integration

Ember can be selected as the device's digital assistant. The assist gesture
(hold power button / corner swipe / long-press home, device-dependent) opens a
bottom overlay with an animated flame that reacts to your voice, streams the
agent's reply above it, and re-arms the mic for follow-ups.

## Architecture

Fully native (no WebView) under `android/app/src/main/java/app/ember/mobile/assist/`:

| Component | Role |
| --- | --- |
| `EmberVoiceInteractionService` | Assistant entry point (manifest + `res/xml/voice_interaction_service.xml`) |
| `EmberSessionService` / `EmberAssistSession` | Creates and drives the overlay UI state machine |
| `EmberStubRecognitionService` | Stub; the metadata requires a `recognitionService` attribute |
| `SpeechTurnRecognizer` | One `SpeechRecognizer` per utterance; its endpointing triggers the send |
| `RespondClient` | OkHttp SSE client for `POST /v1/respond` (mirrors `src/api/sse.ts` framing) |
| `FlameView` | Canvas flame; height/flicker driven by `onRmsChanged` through an attack/decay envelope |
| `EmberSettings` | Reads server URL / user id / mic language from `CapacitorStorage` SharedPreferences |

Settings reach native code via a write-through mirror: the web app copies
`ts-llm.server_url`, `ts-llm.user_id`, and `ts-llm.mic_language` into
`@capacitor/preferences` on every change (see `src/native/settingsMirror.ts`),
whose Android backing store the assistant can read. localStorage stays the
source of truth.

Server sessions are ephemeral per invocation: the first turn starts a new
session, follow-ups while the overlay is open reuse its `session_id`, and
dismissing the overlay drops it.

## Requirements

- The agent server URL must be set in Ember's Settings (the assistant shows a
  hint otherwise).
- `RECORD_AUDIO` must already be granted — open Ember and use the mic once, or
  `adb shell pm grant app.ember.mobile android.permission.RECORD_AUDIO`. The
  assistant overlay cannot show permission dialogs itself.
- The backend must send CORS headers only for the WebView app; the native
  assistant is not subject to CORS.

## Selecting Ember as the assistant

Settings → Apps → Default apps → Digital assistant app → Ember.

Via adb (emulator/dev):

```sh
adb shell settings put secure voice_interaction_service app.ember.mobile/app.ember.mobile.assist.EmberVoiceInteractionService
adb shell settings put secure assistant app.ember.mobile/app.ember.mobile.assist.EmberVoiceInteractionService
```

If Ember does not appear in the default-apps list, the manifest/XML metadata
failed to parse — check `res/xml/voice_interaction_service.xml`.

## Testing on the emulator

```sh
adb shell input keyevent KEYCODE_ASSIST      # trigger the assist gesture
adb logcat -s EmberAssist:V                  # session lifecycle + HTTP logs
```

Use a Play-services image (Google provides the recognition service) and enable
host audio input (extended controls → Microphone, or start the emulator with
`-allow-host-audio`). Host-mic recognition on emulators is unreliable; the
compose (keyboard) input in the overlay is the deterministic test path.
`adb shell cmd voiceinteraction show` is permission-blocked on some builds —
use `KEYCODE_ASSIST` instead.
