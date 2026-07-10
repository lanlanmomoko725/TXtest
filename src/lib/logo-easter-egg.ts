export const LOGO_EASTER_EGG_WINDOW_MS = 8_000;
export const CLOUD_TRIGGER_COUNT = 6;
export const ICE_TRIGGER_COUNT = 10;

export type LogoEasterEggEffect = "clouds" | "ice";

export interface LogoEasterEggClickState {
  clickCount: number;
  lastClickAt: number | null;
}

export interface LogoEasterEggClickResult {
  state: LogoEasterEggClickState;
  effect: LogoEasterEggEffect | null;
}

export function createInitialLogoEasterEggClickState(): LogoEasterEggClickState {
  return {
    clickCount: 0,
    lastClickAt: null,
  };
}

export function advanceLogoEasterEggClick(
  state: LogoEasterEggClickState,
  clickedAt: number,
): LogoEasterEggClickResult {
  const expired = state.lastClickAt === null || clickedAt - state.lastClickAt > LOGO_EASTER_EGG_WINDOW_MS;
  const clickCount = expired ? 1 : state.clickCount + 1;

  if (clickCount === ICE_TRIGGER_COUNT) {
    return {
      state: createInitialLogoEasterEggClickState(),
      effect: "ice",
    };
  }

  return {
    state: {
      clickCount,
      lastClickAt: clickedAt,
    },
    effect: clickCount === CLOUD_TRIGGER_COUNT ? "clouds" : null,
  };
}
