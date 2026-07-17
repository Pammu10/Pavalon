# Voice Chat Rebuild on LiveKit Cloud Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the buggy hand-rolled P2P WebRTC voice mesh with LiveKit Cloud on web, and add voice chat to the Flutter mobile client.

**Architecture:** The game server mints LiveKit access tokens via a new `GET /api/voice/token` endpoint and does nothing else for voice.
Both clients connect to the LiveKit Cloud room named by the game `roomCode`, with participant identity `String(player.userId)`.
All old signaling (offer/answer/ICE relay, `voice:user-left`, `/api/webrtc/ice-servers`) is deleted.

**Tech Stack:** `livekit-server-sdk` (Node), `livekit-client` (web), `livekit_client` + `permission_handler` (Flutter), vitest (server tests), Playwright with Chromium fake-audio flags (E2E).

**Spec:** `docs/superpowers/specs/2026-07-17-voice-chat-livekit-design.md`

## Global Constraints

- Env vars (already present in `server/.env`, never commit them): `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
- LiveKit participant identity is `String(player.userId)`; participant name is `player.name`.
- Bots have `userId < 0` and must never appear in voice UI lists.
- LiveKit room name is the game `roomCode`.
- Features kept: talk, self-mute, speaking indicators, per-player local volume and mute.
- Features dropped: BGM ducking (`setBgmDucked` wiring), mic monitoring (self-hear).
- Commit messages: conventional style, no co-author trailer.
- Markdown files: one sentence per line, no em dashes.

---

### Task 1: Server voice-token endpoint

**Files:**
- Create: `server/routes/voice.ts`
- Create: `server/routes/voice.test.ts`
- Modify: `server/server.ts:9-11` (imports) and `server/server.ts:37-41` (route registration)

**Interfaces:**
- Consumes: `gameService.getGameByRoomCode(roomCode)` (existing, returns `GameState | undefined` whose `players: Player[]` each have `userId: number`, `name: string`, `status: 'CONNECTED' | 'DISCONNECTED'`), `authMiddleware` from `server/auth.ts` (sets `(req as any).user = { id, username, isAdmin }`).
- Produces: `GET /api/voice/token?roomCode=X` → `200 { url: string, token: string }`; errors `400` (missing roomCode), `404` (room not found), `403` (requester not a player in that room), `503` (LiveKit env vars unset).
  Also exports `mintVoiceToken(games: VoiceGameLookup, userId: number, roomCode: string): Promise<{ url: string; token: string }>` and `class VoiceTokenError extends Error { code: 'NOT_CONFIGURED' | 'ROOM_NOT_FOUND' | 'NOT_IN_ROOM' }` for tests.

- [ ] **Step 1: Install the LiveKit server SDK**

```bash
cd /home/pramo/Pavalon/server && npm install livekit-server-sdk
```

Expected: `livekit-server-sdk` appears in `server/package.json` dependencies.

- [ ] **Step 2: Write the failing test**

Create `server/routes/voice.test.ts`.
Vitest is already configured (`npm test` runs `vitest run`; see the colocated `server/redaction.test.ts` pattern).

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { mintVoiceToken, VoiceTokenError, type VoiceGameLookup } from './voice';

const fakeGames = (players: { userId: number }[]): VoiceGameLookup => ({
    getGameByRoomCode: (roomCode: string) =>
        roomCode === 'ROOM1' ? ({ players } as any) : undefined,
});

describe('mintVoiceToken', () => {
    beforeEach(() => {
        process.env.LIVEKIT_URL = 'wss://test.livekit.cloud';
        process.env.LIVEKIT_API_KEY = 'testkey';
        process.env.LIVEKIT_API_SECRET = 'testsecret-testsecret-testsecret';
    });

    it('mints a token with room grant and userId identity', async () => {
        const { url, token } = await mintVoiceToken(fakeGames([{ userId: 42 }]), 42, 'ROOM1');
        expect(url).toBe('wss://test.livekit.cloud');
        const decoded = jwt.decode(token) as any;
        expect(decoded.sub).toBe('42');
        expect(decoded.video).toMatchObject({ room: 'ROOM1', roomJoin: true });
    });

    it('rejects when the room does not exist', async () => {
        await expect(mintVoiceToken(fakeGames([{ userId: 42 }]), 42, 'NOPE'))
            .rejects.toMatchObject({ code: 'ROOM_NOT_FOUND' });
    });

    it('rejects when the user is not a player in the room', async () => {
        await expect(mintVoiceToken(fakeGames([{ userId: 42 }]), 99, 'ROOM1'))
            .rejects.toMatchObject({ code: 'NOT_IN_ROOM' });
    });

    it('rejects when LiveKit is not configured', async () => {
        delete process.env.LIVEKIT_URL;
        await expect(mintVoiceToken(fakeGames([{ userId: 42 }]), 42, 'ROOM1'))
            .rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
    });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd /home/pramo/Pavalon/server && npx vitest run routes/voice.test.ts`
Expected: FAIL - cannot resolve `./voice` (module does not exist yet).

- [ ] **Step 4: Implement `server/routes/voice.ts`**

```ts
import { Router } from 'express';
import { AccessToken } from 'livekit-server-sdk';
import { authMiddleware } from '../auth';
import { GameState } from '../types';
import { logger } from '../logger';

export interface VoiceGameLookup {
    getGameByRoomCode(roomCode: string): GameState | undefined;
}

export class VoiceTokenError extends Error {
    constructor(public code: 'NOT_CONFIGURED' | 'ROOM_NOT_FOUND' | 'NOT_IN_ROOM') {
        super(code);
    }
}

export async function mintVoiceToken(
    games: VoiceGameLookup,
    userId: number,
    roomCode: string,
): Promise<{ url: string; token: string }> {
    const url = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!url || !apiKey || !apiSecret) throw new VoiceTokenError('NOT_CONFIGURED');

    const game = games.getGameByRoomCode(roomCode);
    if (!game) throw new VoiceTokenError('ROOM_NOT_FOUND');

    const player = game.players.find((p) => p.userId === userId);
    if (!player) throw new VoiceTokenError('NOT_IN_ROOM');

    const at = new AccessToken(apiKey, apiSecret, {
        identity: String(userId),
        name: player.name,
        ttl: '6h',
    });
    at.addGrant({ room: roomCode, roomJoin: true, canPublish: true, canSubscribe: true });
    return { url, token: await at.toJwt() };
}

export function createVoiceRouter(games: VoiceGameLookup): Router {
    const router = Router();

    router.get('/token', authMiddleware, async (req, res) => {
        const roomCode = req.query.roomCode;
        if (typeof roomCode !== 'string' || !roomCode) {
            return res.status(400).json({ message: 'roomCode is required' });
        }
        const userId = (req as any).user.id as number;
        try {
            const result = await mintVoiceToken(games, userId, roomCode);
            res.json(result);
        } catch (err) {
            if (err instanceof VoiceTokenError) {
                const status =
                    err.code === 'NOT_CONFIGURED' ? 503 : err.code === 'ROOM_NOT_FOUND' ? 404 : 403;
                return res.status(status).json({ message: err.code });
            }
            logger.error('Failed to mint voice token', { err });
            res.status(500).json({ message: 'Failed to mint voice token' });
        }
    });

    return router;
}
```

Note: `GameState` players are typed `Player[]` which includes `userId`, so the fake in the test satisfies the lookup with a cast.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd /home/pramo/Pavalon/server && npx vitest run routes/voice.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 6: Register the route in `server/server.ts`**

Add the import next to the other route imports (line 8-11):

```ts
import { createVoiceRouter } from './routes/voice';
```

Add the registration next to the other `app.use` calls (line 37-41):

```ts
app.use('/api/voice', createVoiceRouter(gameService));
```

- [ ] **Step 7: Verify the full server test suite and boot**

Run: `cd /home/pramo/Pavalon/server && npm test`
Expected: all tests PASS.
Run: `cd /home/pramo/Pavalon/server && npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 8: Commit**

```bash
cd /home/pramo/Pavalon
git add server/routes/voice.ts server/routes/voice.test.ts server/server.ts server/package.json server/package-lock.json
git commit -m "feat(server): LiveKit voice token endpoint"
```

---

### Task 2: Rewrite web VoiceContext on livekit-client

**Files:**
- Modify: `client/components/context/VoiceContext.tsx` (full rewrite, ~785 lines → ~250)
- Modify: `client/components/ui/VoiceControls.tsx`
- Modify: `client/components/ui/PlayerTile.tsx:44-48`
- Modify: `client/package.json` (add `livekit-client`)

**Interfaces:**
- Consumes: `GET /api/voice/token?roomCode=X` from Task 1 via the existing `api` axios instance (Bearer token already set globally in `GameContext`), `useGame()` for `gameState.roomCode`, `gameState.players`, `playerId`.
- Produces: the new `VoiceContextType` consumed by `VoiceControls` and `PlayerTile`:

```ts
interface PeerState { volume: number; isMuted: boolean; isSpeaking: boolean; }
type VoiceConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
interface VoiceContextType {
    isMuted: boolean;
    isSelfSpeaking: boolean;
    isVoiceEnabled: boolean;
    connectionState: VoiceConnectionState;
    peerStates: { [userId: string]: PeerState };   // keyed by String(player.userId), NOT player.id
    permissionState: 'prompt' | 'granted' | 'denied';
    toggleMute: () => void;
    toggleVoiceChat: () => void;
    setPeerVolume: (userId: string, volume: number) => void;
    togglePeerMute: (userId: string) => void;
}
```

- [ ] **Step 1: Install the LiveKit web SDK**

```bash
cd /home/pramo/Pavalon/client && npm install livekit-client
```

- [ ] **Step 2: Rewrite `client/components/context/VoiceContext.tsx`**

Replace the entire file with:

```tsx
import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useRef,
    ReactNode,
} from "react";
import {
    Room,
    RoomEvent,
    ConnectionState,
    RemoteParticipant,
    RemoteTrack,
    RemoteTrackPublication,
    Track,
    Participant,
} from "livekit-client";
import { useGame } from "./GameContext";
import { toast } from "sonner";
import api from "@/services/api";

interface PeerState {
    volume: number;
    isMuted: boolean;
    isSpeaking: boolean;
}

type VoiceConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

interface VoiceContextType {
    isMuted: boolean;
    isSelfSpeaking: boolean;
    isVoiceEnabled: boolean;
    connectionState: VoiceConnectionState;
    peerStates: { [userId: string]: PeerState };
    permissionState: "prompt" | "granted" | "denied";
    toggleMute: () => void;
    toggleVoiceChat: () => void;
    setPeerVolume: (userId: string, volume: number) => void;
    togglePeerMute: (userId: string) => void;
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

const defaultPeerState: PeerState = { volume: 1, isMuted: false, isSpeaking: false };

export const VoiceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { gameState } = useGame();

    const [isMuted, setIsMuted] = useState(false);
    const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
    const [isSelfSpeaking, setIsSelfSpeaking] = useState(false);
    const [connectionState, setConnectionState] = useState<VoiceConnectionState>("disconnected");
    const [permissionState, setPermissionState] = useState<"prompt" | "granted" | "denied">("prompt");
    const [peerStates, setPeerStates] = useState<{ [userId: string]: PeerState }>({});

    const roomRef = useRef<Room | null>(null);
    const audioContainerRef = useRef<HTMLDivElement | null>(null);
    // Latest volume/mute settings, applied to late-arriving participants.
    const peerStatesRef = useRef(peerStates);
    peerStatesRef.current = peerStates;

    const applyPeerAudio = useCallback((participant: RemoteParticipant) => {
        const state = peerStatesRef.current[participant.identity] ?? defaultPeerState;
        participant.setVolume(state.isMuted ? 0 : state.volume);
    }, []);

    // Connect/disconnect lifecycle.
    useEffect(() => {
        const roomCode = gameState.roomCode;
        if (!roomCode || !isVoiceEnabled) return;

        let cancelled = false;
        const room = new Room();
        roomRef.current = room;

        room
            .on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
                if (state === ConnectionState.Connected) setConnectionState("connected");
                else if (state === ConnectionState.Reconnecting) setConnectionState("reconnecting");
                else if (state === ConnectionState.Connecting) setConnectionState("connecting");
                else setConnectionState("disconnected");
            })
            .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
                if (track.kind === Track.Kind.Audio) {
                    const el = track.attach();
                    audioContainerRef.current?.appendChild(el);
                    applyPeerAudio(participant);
                }
            })
            .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
                track.detach().forEach((el) => el.remove());
            })
            .on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
                setPeerStates((prev) => {
                    if (!(participant.identity in prev)) return prev;
                    const next = { ...prev };
                    delete next[participant.identity];
                    return next;
                });
            })
            .on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
                const speakingIds = new Set(speakers.map((s) => s.identity));
                setIsSelfSpeaking(room.localParticipant ? speakingIds.has(room.localParticipant.identity) : false);
                setPeerStates((prev) => {
                    const next: { [userId: string]: PeerState } = { ...prev };
                    let changed = false;
                    room.remoteParticipants.forEach((p) => {
                        const cur = next[p.identity] ?? defaultPeerState;
                        const speaking = speakingIds.has(p.identity);
                        if (cur.isSpeaking !== speaking || !(p.identity in next)) {
                            next[p.identity] = { ...cur, isSpeaking: speaking };
                            changed = true;
                        }
                    });
                    return changed ? next : prev;
                });
            });

        const connect = async () => {
            setConnectionState("connecting");
            try {
                const { data } = await api.get(`/voice/token?roomCode=${encodeURIComponent(roomCode)}`);
                if (cancelled) return;
                await room.connect(data.url, data.token);
                if (cancelled) return;
                try {
                    await room.localParticipant.setMicrophoneEnabled(!isMuted);
                    setPermissionState("granted");
                } catch (err: any) {
                    if (err?.name === "NotAllowedError") {
                        setPermissionState("denied");
                    } else {
                        throw err;
                    }
                }
            } catch (err) {
                if (cancelled) return;
                console.error("[voice] Failed to join voice room:", err);
                setConnectionState("disconnected");
                toast.error("Voice chat unavailable", {
                    description: "Could not connect to the voice server. The game will continue without voice.",
                });
            }
        };
        connect();

        return () => {
            cancelled = true;
            roomRef.current = null;
            room.disconnect();
            setConnectionState("disconnected");
            setPeerStates({});
            setIsSelfSpeaking(false);
        };
        // isMuted intentionally excluded: mute toggles are applied imperatively below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameState.roomCode, isVoiceEnabled, applyPeerAudio]);

    // Reset permission state when leaving the room so the user can be prompted again.
    useEffect(() => {
        if (!gameState.roomCode) setPermissionState("prompt");
    }, [gameState.roomCode]);

    useEffect(() => {
        if (permissionState === "denied") {
            toast.error("Microphone access denied", {
                description:
                    "Voice chat will be disabled. Please grant microphone permissions in your browser settings and rejoin.",
            });
        }
    }, [permissionState]);

    const toggleMute = useCallback(() => {
        setIsMuted((prev) => {
            const next = !prev;
            roomRef.current?.localParticipant.setMicrophoneEnabled(!next).catch((err) => {
                console.error("[voice] Failed to toggle microphone:", err);
            });
            return next;
        });
    }, []);

    const toggleVoiceChat = useCallback(() => {
        setIsVoiceEnabled((prev) => {
            if (prev) setPermissionState("prompt");
            return !prev;
        });
    }, []);

    const updatePeerState = useCallback(
        (userId: string, patch: Partial<PeerState>) => {
            setPeerStates((prev) => {
                const cur = prev[userId] ?? defaultPeerState;
                const nextState = { ...cur, ...patch };
                const room = roomRef.current;
                const participant = room?.remoteParticipants.get(userId);
                participant?.setVolume(nextState.isMuted ? 0 : nextState.volume);
                return { ...prev, [userId]: nextState };
            });
        },
        [],
    );

    const setPeerVolume = useCallback(
        (userId: string, volume: number) => updatePeerState(userId, { volume }),
        [updatePeerState],
    );

    const togglePeerMute = useCallback(
        (userId: string) => {
            setPeerStates((prev) => {
                const cur = prev[userId] ?? defaultPeerState;
                const nextState = { ...cur, isMuted: !cur.isMuted };
                roomRef.current?.remoteParticipants.get(userId)?.setVolume(nextState.isMuted ? 0 : nextState.volume);
                return { ...prev, [userId]: nextState };
            });
        },
        [],
    );

    const contextValue: VoiceContextType = {
        isMuted,
        isSelfSpeaking,
        isVoiceEnabled,
        connectionState,
        peerStates,
        permissionState,
        toggleMute,
        toggleVoiceChat,
        setPeerVolume,
        togglePeerMute,
    };

    return (
        <VoiceContext.Provider value={contextValue}>
            {children}
            <div ref={audioContainerRef} id="audio-container" style={{ display: "none" }} />
        </VoiceContext.Provider>
    );
};

export const useVoice = (): VoiceContextType => {
    const context = useContext(VoiceContext);
    if (!context) {
        throw new Error("useVoice must be used within a VoiceProvider");
    }
    return context;
};
```

Notes for the implementer:
- `peerStates` is keyed by LiveKit identity, which is `String(player.userId)`.
- Remote audio playback goes through `track.attach()` elements inside the hidden container; `participant.setVolume()` controls them.
- There is no WebAudio graph anymore; mute is real track muting via `setMicrophoneEnabled`.
- The `useAudio`/`setBgmDucked` import and wiring are gone (BGM ducking dropped per spec).

- [ ] **Step 3: Update `client/components/ui/PlayerTile.tsx`**

The current lookup (lines 44-48) keys by `player.id`:

```tsx
const { peerStates, isSelfSpeaking } = useVoice();
const voiceState = peerStates[player.id];
const isSpeaking = isLocalPlayer ? isSelfSpeaking : voiceState?.isSpeaking ?? false;
```

Change the key to the stable userId:

```tsx
const { peerStates, isSelfSpeaking } = useVoice();
const voiceState = peerStates[String(player.userId)];
const isSpeaking = isLocalPlayer ? isSelfSpeaking : voiceState?.isSpeaking ?? false;
```

- [ ] **Step 4: Update `client/components/ui/VoiceControls.tsx`**

Make these changes:

1. Update the destructure (line 23): remove `micMonitoring`, `toggleMicMonitoring`; add `connectionState`.

```tsx
const { isMuted, peerStates, permissionState, toggleMute, setPeerVolume, togglePeerMute, isVoiceEnabled, toggleVoiceChat, connectionState } = useVoice();
```

2. Remove the Mic Monitoring toggle (line 75) and the now-unused `Ear`, `EarOff` imports (line 4).
3. Exclude bots and key peer controls by userId - replace line 46 and the peer lookup (lines 81-104):

```tsx
const otherPlayers = players.filter(p => p.id !== playerId && p.userId > 0);
```

```tsx
{otherPlayers.map(player => {
    const key = String(player.userId);
    const state = peerStates[key] || { volume: 1, isMuted: false, isSpeaking: false };

    return (
        <div key={player.id} className="p-3 bg-slate-800/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
                <span className={`font-semibold transition-all ${state.isSpeaking ? 'text-green-400 animate-pulse' : 'text-slate-300'}`}>
                    {player.name}
                </span>
                <button onClick={() => togglePeerMute(key)}>
                    {state.isMuted ? <VolumeX className="text-red-400" size={20} /> : <Volume2 className="text-slate-400 hover:text-white" size={20} />}
                </button>
            </div>
            <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={state.volume}
                onChange={(e) => setPeerVolume(key, parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                disabled={state.isMuted}
            />
        </div>
    );
})}
```

4. Add a connection status line under the Master Controls heading (after the Voice Chat `Toggle`, line 53):

```tsx
{isVoiceEnabled && connectionState !== 'connected' && (
    <p className="text-sm text-slate-400 text-center">
        {connectionState === 'reconnecting' ? 'Reconnecting to voice…' :
         connectionState === 'connecting' ? 'Connecting to voice…' :
         'Voice disconnected.'}
    </p>
)}
```

- [ ] **Step 5: Check for other consumers of removed context fields**

Run: `cd /home/pramo/Pavalon/client && grep -rn "micMonitoring\|toggleMicMonitoring\|setBgmDucked" components app --include="*.tsx" | grep -v ".next"`
Expected: `setBgmDucked` remains only in `AudioContext.tsx` (its definition; leave it - other audio code may use `isBgmDucked`).
No remaining references to `micMonitoring`/`toggleMicMonitoring` outside `AudioContext.tsx` definitions.
If any component still references them, remove those usages the same way as in `VoiceControls`.

- [ ] **Step 6: Build to verify**

Run: `cd /home/pramo/Pavalon/client && npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 7: Commit**

```bash
cd /home/pramo/Pavalon
git add client/components/context/VoiceContext.tsx client/components/ui/VoiceControls.tsx client/components/ui/PlayerTile.tsx client/package.json client/package-lock.json
git commit -m "feat(client): rebuild voice chat on LiveKit"
```

---

### Task 3: Delete legacy P2P signaling from the server

**Files:**
- Delete: `server/routes/webrtc.ts`
- Modify: `server/server.ts:9` (remove import), `server/server.ts:41` (remove `app.use('/api/webrtc', ...)`)
- Modify: `server/socket/handlers.ts:83-85` (remove the three `voice:*` relay handlers)
- Modify: `server/services/gameService.ts:858,899,1320,1346` (remove the four `voice:user-left` emits)
- Modify: `server/types.ts:386` (remove the `'voice:user-left'` event type)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing - this is pure deletion.
  The web client after Task 2 no longer listens to any of these events; verify before deleting (Step 1).

- [ ] **Step 1: Verify no client references remain**

Run: `cd /home/pramo/Pavalon && grep -rn "voice:offer\|voice:answer\|voice:ice-candidate\|voice:user-left\|webrtc/ice-servers" client/components client/services client/app mobileClient/lib`
Expected: no matches.
If there are matches, Task 2 is incomplete - fix that first.

- [ ] **Step 2: Delete the dead server code**

```bash
cd /home/pramo/Pavalon && git rm server/routes/webrtc.ts
```

Then remove, exactly:
- `server/server.ts` line 9: `import webrtcRoutes from './routes/webrtc';`
- `server/server.ts` line 41: `app.use('/api/webrtc', webrtcRoutes);`
- `server/socket/handlers.ts` lines 83-85: the three `socket.on('voice:offer' | 'voice:answer' | 'voice:ice-candidate', ...)` relays.
- `server/services/gameService.ts`: the four `this.io.to(roomCode).emit('voice:user-left', ...)` lines (858, 899, 1320, 1346 - re-grep for current line numbers).
- `server/types.ts` line 386: `'voice:user-left': (data: { socketId: string }) => void;`

- [ ] **Step 3: Verify nothing references the deleted code**

Run: `cd /home/pramo/Pavalon && grep -rn "voice:offer\|voice:answer\|voice:ice-candidate\|voice:user-left\|webrtcRoutes\|ice-servers" server --include="*.ts" | grep -v node_modules`
Expected: no matches.
Run: `cd /home/pramo/Pavalon/server && npx tsc --noEmit && npm test`
Expected: no type errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
cd /home/pramo/Pavalon
git add -A server
git commit -m "refactor(server): remove legacy P2P voice signaling and TURN route"
```

- [ ] **Step 5: Remind the user to rotate the leaked TURN credentials**

The metered.ca credentials that were hardcoded in `server/routes/webrtc.ts` remain in git history.
Tell the user to rotate or retire that metered.ca account; this cannot be done from the codebase.

---

### Task 4: Flutter mobile voice chat

**Files:**
- Modify: `mobileClient/pubspec.yaml` (add `livekit_client`, `permission_handler`)
- Modify: `mobileClient/android/app/src/main/AndroidManifest.xml` (permissions)
- Modify: `mobileClient/ios/Runner/Info.plist` (mic usage description)
- Modify: `mobileClient/lib/services/api_service.dart` (add `voiceToken`)
- Create: `mobileClient/lib/services/voice_service.dart`
- Create: `mobileClient/lib/widgets/voice_panel.dart`
- Modify: `mobileClient/lib/main.dart` (provider wiring + room sync)
- Modify: `mobileClient/lib/screens/game_shell.dart` (voice buttons in bottom chrome)
- Modify: `mobileClient/lib/widgets/player_tile.dart` (speaking indicator)

**Interfaces:**
- Consumes: `GET /api/voice/token?roomCode=X` → `{ url, token }` (Task 1); `GameProvider` exposing `gameState.roomCode` and `gameState.players` (each `Player` has `int userId`, `String name`, `bool get isBot => userId < 0`); `ApiService._send(method, path)` pattern for HTTP.
- Produces: `VoiceService extends ChangeNotifier` with:
  - `Future<void> syncRoom(String? roomCode)` - joins/leaves so current room matches `roomCode`
  - `void toggleMute()`, `bool get isMuted`
  - `bool get isSelfSpeaking`, `bool isPeerSpeaking(int userId)`
  - `void setPeerVolume(int userId, double volume)`, `void togglePeerMute(int userId)`, `PeerAudioState peerState(int userId)`
  - `VoiceStatus get status` (`disconnected | connecting | connected | reconnecting | permissionDenied`)

- [ ] **Step 1: Add dependencies**

In `mobileClient/pubspec.yaml` under `dependencies:` add:

```yaml
  livekit_client: ^2.3.0
  permission_handler: ^11.3.1
```

Run: `cd /home/pramo/Pavalon/mobileClient && flutter pub get`
Expected: resolves without conflicts (see the memory file `pavalon-flutter-mobile.md` for the toolchain; if version solving fails, take the latest compatible majors that `flutter pub get` suggests and keep both packages).

- [ ] **Step 2: Platform permission declarations**

`mobileClient/android/app/src/main/AndroidManifest.xml` - inside `<manifest>`, alongside existing `<uses-permission>` entries (add any that are missing):

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

`mobileClient/ios/Runner/Info.plist` - inside the top-level `<dict>`:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Pavalon uses your microphone for in-game voice chat.</string>
```

- [ ] **Step 3: Add the token fetch to `ApiService`**

In `mobileClient/lib/services/api_service.dart`, following the existing `_send` + record-return pattern:

```dart
Future<({String url, String token})> voiceToken(String roomCode) async {
  final d = await _send('GET', '/voice/token?roomCode=${Uri.encodeQueryComponent(roomCode)}')
      as Map<String, dynamic>;
  return (url: d['url'] as String, token: d['token'] as String);
}
```

- [ ] **Step 4: Create `mobileClient/lib/services/voice_service.dart`**

```dart
import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart' as webrtc;
import 'package:livekit_client/livekit_client.dart';
import 'package:permission_handler/permission_handler.dart';

import 'api_service.dart';

enum VoiceStatus { disconnected, connecting, connected, reconnecting, permissionDenied }

class PeerAudioState {
  double volume;
  bool isMuted;
  bool isSpeaking;
  PeerAudioState({this.volume = 1.0, this.isMuted = false, this.isSpeaking = false});
}

/// Manages the LiveKit room lifecycle for the current game room.
/// Identity convention: LiveKit participant identity == String(player.userId).
class VoiceService extends ChangeNotifier {
  VoiceService({required this.api});

  final ApiService api;

  Room? _room;
  EventsListener<RoomEvent>? _listener;
  String? _roomCode;
  bool _isMuted = false;
  bool _isSelfSpeaking = false;
  VoiceStatus _status = VoiceStatus.disconnected;
  final Map<int, PeerAudioState> _peers = {};

  bool get isMuted => _isMuted;
  bool get isSelfSpeaking => _isSelfSpeaking;
  VoiceStatus get status => _status;
  bool isPeerSpeaking(int userId) => _peers[userId]?.isSpeaking ?? false;
  PeerAudioState peerState(int userId) => _peers.putIfAbsent(userId, PeerAudioState.new);

  /// Join/leave so that the connected room matches [roomCode].
  Future<void> syncRoom(String? roomCode) async {
    if (roomCode == _roomCode) return;
    await _disconnect();
    _roomCode = roomCode;
    if (roomCode == null) return;

    final mic = await Permission.microphone.request();
    if (!mic.isGranted) {
      _status = VoiceStatus.permissionDenied;
      notifyListeners();
      return;
    }

    _status = VoiceStatus.connecting;
    notifyListeners();
    try {
      final creds = await api.voiceToken(roomCode);
      final room = Room();
      _room = room;
      _listener = room.createListener()
        ..on<ActiveSpeakersChangedEvent>(_onActiveSpeakers)
        ..on<TrackSubscribedEvent>((e) => _applyPeerAudio(e.participant))
        ..on<ParticipantDisconnectedEvent>((e) {
          final id = int.tryParse(e.participant.identity);
          if (id != null) _peers.remove(id);
          notifyListeners();
        })
        ..on<RoomReconnectingEvent>((_) {
          _status = VoiceStatus.reconnecting;
          notifyListeners();
        })
        ..on<RoomReconnectedEvent>((_) {
          _status = VoiceStatus.connected;
          notifyListeners();
        })
        ..on<RoomDisconnectedEvent>((_) {
          _status = VoiceStatus.disconnected;
          notifyListeners();
        });
      await room.connect(creds.url, creds.token);
      await room.localParticipant?.setMicrophoneEnabled(!_isMuted);
      _status = VoiceStatus.connected;
    } catch (e) {
      debugPrint('[voice] failed to join: $e');
      await _disconnect();
    }
    notifyListeners();
  }

  void _onActiveSpeakers(ActiveSpeakersChangedEvent e) {
    final speaking = e.speakers.map((p) => p.identity).toSet();
    final local = _room?.localParticipant;
    _isSelfSpeaking = local != null && speaking.contains(local.identity);
    _room?.remoteParticipants.forEach((_, p) {
      final id = int.tryParse(p.identity);
      if (id != null) {
        _peers.putIfAbsent(id, PeerAudioState.new).isSpeaking = speaking.contains(p.identity);
      }
    });
    notifyListeners();
  }

  void toggleMute() {
    _isMuted = !_isMuted;
    _room?.localParticipant?.setMicrophoneEnabled(!_isMuted);
    notifyListeners();
  }

  void setPeerVolume(int userId, double volume) {
    peerState(userId).volume = volume;
    _applyPeerAudioById(userId);
    notifyListeners();
  }

  void togglePeerMute(int userId) {
    final s = peerState(userId);
    s.isMuted = !s.isMuted;
    _applyPeerAudioById(userId);
    notifyListeners();
  }

  void _applyPeerAudioById(int userId) {
    final p = _room?.remoteParticipants['$userId'];
    if (p != null) _applyPeerAudio(p);
  }

  void _applyPeerAudio(RemoteParticipant participant) {
    final id = int.tryParse(participant.identity);
    if (id == null) return;
    final s = peerState(id);
    final effective = s.isMuted ? 0.0 : s.volume;
    for (final pub in participant.audioTrackPublications) {
      final track = pub.track;
      if (track != null) {
        webrtc.Helper.setVolume(effective, track.mediaStreamTrack);
      }
    }
  }

  Future<void> _disconnect() async {
    await _listener?.dispose();
    _listener = null;
    await _room?.disconnect();
    await _room?.dispose();
    _room = null;
    _peers.clear();
    _isSelfSpeaking = false;
    _status = VoiceStatus.disconnected;
  }

  @override
  void dispose() {
    _disconnect();
    super.dispose();
  }
}
```

Note: `flutter_webrtc` is a transitive dependency of `livekit_client`; `Helper.setVolume` is its cross-platform remote-audio volume API.
If the installed `livekit_client` version exposes `RemoteAudioTrack.setVolume` directly, prefer that and drop the `flutter_webrtc` import.

- [ ] **Step 5: Wire the provider and room sync in `mobileClient/lib/main.dart`**

Add to the `MultiProvider` list (after the existing providers, ~line 61):

```dart
ChangeNotifierProvider(create: (_) => VoiceService(api: api)),
```

Then make voice follow the game room.
Inside `RootGate`'s build (or its `State`), add a listener-based sync using `context.watch`:

```dart
// In RootGate's build method, before returning the UI:
final roomCode = context.select<GameProvider, String?>((g) => g.gameState.roomCode);
context.read<VoiceService>().syncRoom(roomCode);
```

`syncRoom` is idempotent (returns immediately when the room is unchanged), so calling it on every build is safe.
Match the actual `GameProvider` field names when implementing (re-check how `game_shell.dart` reads `roomCode`).

- [ ] **Step 6: Add voice controls to the game chrome**

In `mobileClient/lib/screens/game_shell.dart`, the `_BottomChromeBar` (~line 185) currently has emote and chat buttons built via `_chromeButton(LucideIcons.messageSquare, 'Chat', onChat)`.
Add two more buttons in the same style:

1. Mic toggle - icon `LucideIcons.mic` / `LucideIcons.micOff`, label `'Mic'`, `onTap: () => context.read<VoiceService>().toggleMute()`, red-tinted when muted (match the existing chrome button styling; use a `Consumer<VoiceService>` or `context.watch` so it rebuilds on mute changes).
2. Voice panel - icon `LucideIcons.headphones`, label `'Voice'`, `onTap: () => VoicePanel.show(context)`.

Create `mobileClient/lib/widgets/voice_panel.dart` as a modal bottom sheet mirroring `ChatPanel.show(context)`'s pattern (`showModalBottomSheet`, same theming as `chat_panel.dart`):

- A status row when not connected: "Connecting…", "Reconnecting…", "Microphone permission denied - enable it in system settings", or "Voice disconnected".
- One row per other human player (`gameState.players.where((p) => !p.isBot && p.userId != myUserId)`):
  - player name, highlighted (e.g. `Colors.greenAccent`) while `voice.isPeerSpeaking(p.userId)`
  - mute IconButton (`LucideIcons.volume2` / `LucideIcons.volumeX`) calling `voice.togglePeerMute(p.userId)`
  - a `Slider(value: voice.peerState(p.userId).volume, onChanged: (v) => voice.setPeerVolume(p.userId, v))`, disabled while that peer is muted.

Use `Consumer<VoiceService>` inside the sheet so it live-updates.

- [ ] **Step 7: Speaking indicator on player tiles**

In `mobileClient/lib/widgets/player_tile.dart`, read the speaking state for the tile's player:

```dart
final isSpeaking = context.select<VoiceService, bool>(
    (v) => v.isPeerSpeaking(player.userId) || (isLocalPlayer && v.isSelfSpeaking));
```

While `isSpeaking`, render a highlight consistent with the web client (web shows a pulsing green treatment; on mobile add a green glow border via `BoxDecoration(border: Border.all(color: ...), boxShadow: [...])` on the tile's existing decoration).
Match the tile's existing structure - add to the current decoration rather than restructuring the widget.
Check the memory file `visual-parity-requires-screenshots.md`: compare against a web screenshot when styling.

- [ ] **Step 8: Analyze and build**

Run: `cd /home/pramo/Pavalon/mobileClient && flutter analyze`
Expected: no errors (warnings pre-existing at baseline are acceptable).
Run: `cd /home/pramo/Pavalon/mobileClient && flutter build apk --debug`
Expected: build succeeds.

- [ ] **Step 9: Commit**

```bash
cd /home/pramo/Pavalon
git add mobileClient
git commit -m "feat(mobile): LiveKit voice chat with mute, speaking indicators, per-player volume"
```

---

### Task 5: End-to-end verification (web, real audio flow)

**Files:**
- Create: `/tmp/claude-scratch/voice-e2e/` artifacts only (tone WAV, screenshots) - nothing committed except fixes it uncovers.

**Interfaces:**
- Consumes: the running stack (see memory file `pavalon-dev-setup.md` for run commands and test users ctest1-3), Playwright MCP or scripted Playwright.
- Produces: verified evidence that audio flows end to end, or bug fixes.

- [ ] **Step 1: Generate a test tone WAV**

```bash
ffmpeg -f lavfi -i "sine=frequency=440:duration=60" -ar 48000 -ac 1 /tmp/claude-scratch/voice-e2e/tone.wav
```

(`ffmpeg` missing → `sudo apt-get install -y ffmpeg` or use `sox`.)

- [ ] **Step 2: Start the stack**

Start server and client per `pavalon-dev-setup.md` (server on :3001, client on :3000).
Confirm `server/.env` has the three `LIVEKIT_*` vars (already added).

- [ ] **Step 3: Two-browser voice test**

Launch two separate Chromium instances (separate user data dirs) with fake-audio flags:

```
--use-fake-ui-for-media-stream
--use-fake-device-for-media-stream
--use-file-for-fake-audio-capture=/tmp/claude-scratch/voice-e2e/tone.wav
```

Note: the flags must be set at browser launch (Playwright `launch({ args })`), one browser per player - two contexts in one browser share the fake device but permission auto-grant only applies with `--use-fake-ui-for-media-stream`, which is per-launch anyway.

Script:
1. Browser A: log in as `ctest1`, create a room, note the room code.
2. Browser B: log in as `ctest2`, join that room.
3. In Browser B, assert within 15s that ctest1's player tile shows the speaking indicator (the tone plays through ctest1's fake mic, LiveKit computes active speakers from real audio, so this indicator proves audio flows end to end).
4. In Browser A, assert ctest2's tile shows the speaking indicator too.
5. Browser A: open the voice panel, toggle Microphone off; assert in Browser B that ctest1's speaking indicator turns off within 5s and stays off for 10s.
6. Browser B: open voice controls, mute ctest1 locally; verify no errors and the mute icon state.
7. Screenshot each assertion point.

- [ ] **Step 4: Multi-player smoke (the original bug)**

Add a third browser as `ctest3` joining the same room with the same fake-audio flags.
Assert all three clients show speaking indicators for both other players.
This is the "multiple people join and it breaks" regression check - with an SFU there is no mesh to break, but verify.

- [ ] **Step 5: Fix anything found, then re-run**

Any failure here is a bug in Tasks 1-2; debug with the superpowers:systematic-debugging skill, fix, and re-run this task from Step 3.

- [ ] **Step 6: Mobile spot-check**

Per `pavalon-flutter-mobile.md`, run the Flutter client (web build for UI checks; the Flutter-web E2E recipe in memory).
Verify: mic/voice buttons render in the game chrome, the voice panel opens and lists players, no crashes when joining a room while the web clients are in voice.
Real microphone capture on a physical Android device is a manual user step - tell the user what to check (join a room from the APK and a browser, talk both ways).

- [ ] **Step 7: Final commit and wrap-up**

If fixes were made, commit them with focused messages.
Then run the full check suite one last time:

```bash
cd /home/pramo/Pavalon/server && npm test && npx tsc --noEmit
cd /home/pramo/Pavalon/client && npm run build
cd /home/pramo/Pavalon/mobileClient && flutter analyze
```

Expected: all pass.
Use the superpowers:finishing-a-development-branch skill to decide merge/PR next steps with the user.
