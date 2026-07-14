// Safe wrapper around the Vibration API — no-ops on unsupported devices (iOS Safari, desktop).
function vibrate(pattern: number | number[]): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
            navigator.vibrate(pattern);
        } catch {
            // ignore — some browsers throw when vibration is blocked
        }
    }
}

export const haptics = {
    /** Light tick — button presses, selections, emote send */
    tap: () => vibrate(10),
    /** Confirm — vote cast, team proposed */
    confirm: () => vibrate([15, 30, 15]),
    /** Success — quest passed, team approved */
    success: () => vibrate([20, 40, 20, 40, 60]),
    /** Failure — quest failed, team rejected */
    failure: () => vibrate([60, 40, 60]),
    /** Dramatic — game over, assassination */
    dramatic: () => vibrate([100, 50, 100, 50, 200]),
};
