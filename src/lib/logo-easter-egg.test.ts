import { describe, expect, it } from "vitest";
import {
  advanceLogoEasterEggClick,
  createInitialLogoEasterEggClickState,
  LOGO_EASTER_EGG_WINDOW_MS,
} from "./logo-easter-egg";

describe("logo easter egg sequence", () => {
  it("triggers clouds once on the sixth click and ice on the tenth", () => {
    let state = createInitialLogoEasterEggClickState();

    for (let click = 1; click <= 5; click += 1) {
      const result = advanceLogoEasterEggClick(state, click * 100);
      state = result.state;
      expect(result.effect).toBeNull();
    }

    const cloudResult = advanceLogoEasterEggClick(state, 600);
    state = cloudResult.state;
    expect(cloudResult.effect).toBe("clouds");
    expect(state.clickCount).toBe(6);

    for (let click = 7; click <= 9; click += 1) {
      const result = advanceLogoEasterEggClick(state, click * 100);
      state = result.state;
      expect(result.effect).toBeNull();
    }

    const iceResult = advanceLogoEasterEggClick(state, 1_000);
    expect(iceResult.effect).toBe("ice");
    expect(iceResult.state).toEqual(createInitialLogoEasterEggClickState());
  });

  it("starts a new sequence only after more than eight seconds of inactivity", () => {
    const first = advanceLogoEasterEggClick(createInitialLogoEasterEggClickState(), 100);
    const boundaryClick = advanceLogoEasterEggClick(first.state, 100 + LOGO_EASTER_EGG_WINDOW_MS);
    const expiredClick = advanceLogoEasterEggClick(boundaryClick.state, 101 + LOGO_EASTER_EGG_WINDOW_MS * 2);

    expect(boundaryClick.state.clickCount).toBe(2);
    expect(expiredClick.state).toEqual({
      clickCount: 1,
      lastClickAt: 101 + LOGO_EASTER_EGG_WINDOW_MS * 2,
    });
  });
});
