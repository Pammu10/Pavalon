# Voice Chat Rebuild: LiveKit Cloud Design

**Date:** 2026-07-17
**Status:** Approved

## Problem

The current voice chat is a hand-rolled full-mesh P2P WebRTC implementation in the web client only.
It is unreliable in practice: voice sometimes fails to start, players are sometimes inaudible, and reliability degrades sharply as more players join.
The Flutter mobile client has no voice chat at all.

Code inspection identified concrete defects that explain the observed symptoms:

1. The local microphone is routed through a WebAudio `GainNode` for muting.
   If the `AudioContext` starts suspended (browsers require a user gesture), the processed stream is silent, and nothing ever calls `audioContext.resume()`.
   This matches the "people aren't audible" symptom.
2. When two peers negotiate simultaneously (glare), incoming offers are dropped with no retry, so the connection never forms.
   Glare probability rises with player count, matching the "breaks with multiple people" symptom.
3. ICE candidates that arrive before the peer connection or remote description exist are silently discarded.
4. Peer connections are torn down on the transient `disconnected` state with no reconnection logic, so brief network blips permanently kill audio.

Rather than patching each defect in a fragile mesh architecture, voice chat moves to a managed SFU.

## Decision Summary

- **Architecture:** Replace the P2P mesh with LiveKit Cloud (managed SFU, free tier).
- **Platforms:** Web (Next.js client) and mobile (Flutter client), with cross-platform calls in the same room.
- **Features kept:** join room and talk, self-mute, speaking indicators, per-player local volume and mute.
- **Features dropped:** BGM ducking, mic monitoring (self-hear).
  Dropping these removes the WebAudio processing path entirely.

## Architecture

### Room and identity mapping

- One LiveKit room per game room, named by the game `roomCode`.
- LiveKit participant identity is the player id, so player tiles map directly to voice participants on both clients.

### Token endpoint (game server)

- New endpoint `GET /voice/token?roomCode=...` behind the existing `authMiddleware`.
- The endpoint verifies the requesting player is currently in that room, then mints a LiveKit access token.
- Configuration via env vars: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
- The response contains the LiveKit URL and the token.
- This is the server's entire involvement; LiveKit Cloud handles media routing, NAT traversal, and reconnection.

### Deletions

- All hand-rolled WebRTC in `client/components/context/VoiceContext.tsx`: peer connections, offer/answer and glare logic, ICE handling, the GainNode mute path, and analyser-based speaking detection.
- Server signaling relays in `server/socket/handlers.ts`: `voice:offer`, `voice:answer`, `voice:ice-candidate`.
- The `voice:user-left` emits in `server/services/gameService.ts` and the corresponding type in `server/types.ts`.
- The `/webrtc/ice-servers` route (`server/routes/webrtc.ts`) including its hardcoded TURN credentials.
  The leaked metered.ca credentials should be rotated or the account retired.

## Web Client

- `VoiceContext.tsx` is rewritten around the `livekit-client` SDK.
- The context keeps the same public interface minus `micMonitoring`, `toggleMicMonitoring`, and the BGM ducking wiring, so `VoiceControls` and `PlayerTile` need only minimal edits.
- Join the LiveKit room when the player enters a game room and voice is enabled; disconnect on leave.
- Self-mute uses LiveKit track muting, which has no silent-AudioContext failure mode.
- Speaking indicators come from LiveKit active-speaker events.
- Per-player volume and mute use the SDK's per-participant volume API, applied locally.
- Connection state (connecting, connected, reconnecting) is exposed by the context and surfaced in the UI.

## Mobile Client

- Add the `livekit_client` Flutter package.
- New `VoiceService` mirroring the web context: join on entering a room, leave on exit, mute toggle, speaking indicators, per-player volume and mute.
- UI hookups: mute control, speaking highlight on player tiles, per-player volume and mute controls matching the web feature set.
- Android and iOS microphone permission entries as required by the SDK.

## Error Handling

- Microphone permission denied: toast plus voice-disabled state, as today.
- Network drops: LiveKit's built-in auto-reconnect, with a visible "reconnecting" indicator instead of silent permanent failure.
- Token endpoint failure: toast, voice stays off, game continues unaffected.

## Testing

- Web E2E: multiple Playwright browser contexts with Chromium's fake audio device flags feeding a known WAV file.
  Assert on the receiving participant's audio level via the LiveKit SDK so the test verifies audio actually flows end to end.
- Also assert speaking indicators appear on the correct player tile while the fake audio plays.
- Mobile: Flutter-web E2E recipe for UI-level checks, plus a manual check on a physical device for real microphone capture.

## Prerequisites

- A LiveKit Cloud account and project (free tier).
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` provided to the server environment.

## Out of Scope

- BGM ducking and mic monitoring (dropped features).
- Push-to-talk, spatial audio, or role-based voice channels.
- Self-hosting LiveKit.
