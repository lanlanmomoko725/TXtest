import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  advanceLogoEasterEggClick,
  createInitialLogoEasterEggClickState,
  LOGO_EASTER_EGG_WINDOW_MS,
  type LogoEasterEggEffect,
} from "@/lib/logo-easter-egg";

type EffectRun = {
  id: number;
  kind: LogoEasterEggEffect;
};

type IceKind = "tabular" | "solidColumn" | "dendritic" | "needleColumn";

type LogoEasterEggContextValue = {
  recordLogoClick: () => void;
};

const LogoEasterEggContext = createContext<LogoEasterEggContextValue | null>(null);

const EFFECT_DURATIONS: Record<LogoEasterEggEffect, number> = {
  clouds: 5_800,
  ice: 6_800,
};

const CLOUD_PRESETS = [
  { left: "-7%", top: "-6rem", width: "clamp(9rem, 17vw, 17rem)", delay: "0ms", driftX: "14vw", driftY: "18vh" },
  { left: "16%", top: "-8rem", width: "clamp(8rem, 14vw, 14rem)", delay: "220ms", driftX: "-7vw", driftY: "24vh" },
  { left: "37%", top: "-11rem", width: "clamp(10rem, 16vw, 16rem)", delay: "110ms", driftX: "8vw", driftY: "16vh" },
  { left: "58%", top: "-7rem", width: "clamp(8rem, 13vw, 13rem)", delay: "460ms", driftX: "-9vw", driftY: "27vh" },
  { left: "77%", top: "-9rem", width: "clamp(9rem, 15vw, 15rem)", delay: "320ms", driftX: "5vw", driftY: "20vh" },
  { left: "91%", top: "-5rem", width: "clamp(7rem, 12vw, 12rem)", delay: "640ms", driftX: "-12vw", driftY: "23vh" },
] as const;

const ICE_ASSETS: Record<IceKind, string> = {
  tabular: "/easter-eggs/ice-tabular.png",
  solidColumn: "/easter-eggs/ice-solid-column.png",
  dendritic: "/easter-eggs/ice-dendritic.png",
  needleColumn: "/easter-eggs/ice-needle-column.png",
};

const ICE_PRESETS: Array<{
  kind: IceKind;
  left: string;
  width: string;
  delay: string;
  duration: string;
  driftX: string;
  rotation: string;
}> = [
  { kind: "tabular", left: "3%", width: "clamp(2rem, 3.7vw, 3.7rem)", delay: "0ms", duration: "5.2s", driftX: "-4vw", rotation: "130deg" },
  { kind: "solidColumn", left: "11%", width: "clamp(1.7rem, 2.7vw, 2.8rem)", delay: "280ms", duration: "5.8s", driftX: "3vw", rotation: "-110deg" },
  { kind: "dendritic", left: "20%", width: "clamp(2rem, 3.3vw, 3.4rem)", delay: "120ms", duration: "5.5s", driftX: "-2vw", rotation: "180deg" },
  { kind: "needleColumn", left: "28%", width: "clamp(1.6rem, 2.3vw, 2.5rem)", delay: "520ms", duration: "6s", driftX: "5vw", rotation: "-150deg" },
  { kind: "tabular", left: "36%", width: "clamp(1.8rem, 3vw, 3rem)", delay: "740ms", duration: "5.4s", driftX: "-5vw", rotation: "105deg" },
  { kind: "solidColumn", left: "44%", width: "clamp(1.7rem, 2.6vw, 2.7rem)", delay: "160ms", duration: "5.9s", driftX: "2vw", rotation: "-135deg" },
  { kind: "dendritic", left: "53%", width: "clamp(2.2rem, 3.8vw, 3.8rem)", delay: "400ms", duration: "5.3s", driftX: "4vw", rotation: "165deg" },
  { kind: "needleColumn", left: "61%", width: "clamp(1.5rem, 2.2vw, 2.4rem)", delay: "910ms", duration: "6.1s", driftX: "-4vw", rotation: "-125deg" },
  { kind: "tabular", left: "69%", width: "clamp(1.9rem, 3.1vw, 3.2rem)", delay: "250ms", duration: "5.6s", driftX: "2vw", rotation: "145deg" },
  { kind: "solidColumn", left: "78%", width: "clamp(1.6rem, 2.5vw, 2.6rem)", delay: "650ms", duration: "5.7s", driftX: "-3vw", rotation: "-118deg" },
  { kind: "dendritic", left: "86%", width: "clamp(2rem, 3.4vw, 3.4rem)", delay: "70ms", duration: "5.4s", driftX: "4vw", rotation: "190deg" },
  { kind: "needleColumn", left: "95%", width: "clamp(1.5rem, 2.2vw, 2.3rem)", delay: "820ms", duration: "6.1s", driftX: "-6vw", rotation: "-145deg" },
];

function EasterEggOverlay({ runs }: { runs: EffectRun[] }) {
  if (runs.length === 0) return null;

  return (
    <div className="logo-easter-egg-overlay" aria-hidden="true">
      {runs.map((run) => (
        <div key={run.id} className="logo-easter-egg-run">
          {run.kind === "clouds"
            ? CLOUD_PRESETS.map((cloud, index) => (
                <img
                  key={`${run.id}-cloud-${index}`}
                  src="/easter-eggs/cloud.png"
                  alt=""
                  decoding="async"
                  draggable={false}
                  className="logo-easter-egg-cloud"
                  style={
                    {
                      left: cloud.left,
                      top: cloud.top,
                      width: cloud.width,
                      animationDelay: cloud.delay,
                      "--cloud-drift-x": cloud.driftX,
                      "--cloud-drift-y": cloud.driftY,
                    } as CSSProperties
                  }
                />
              ))
            : ICE_PRESETS.map((crystal, index) => (
                <img
                  key={`${run.id}-ice-${index}`}
                  src={ICE_ASSETS[crystal.kind]}
                  alt=""
                  decoding="async"
                  draggable={false}
                  className="logo-easter-egg-ice"
                  style={
                    {
                      left: crystal.left,
                      width: crystal.width,
                      animationDelay: crystal.delay,
                      animationDuration: crystal.duration,
                      "--ice-drift-x": crystal.driftX,
                      "--ice-rotation": crystal.rotation,
                    } as CSSProperties
                  }
                />
              ))}
        </div>
      ))}
    </div>
  );
}

export function LogoEasterEggProvider({ children }: { children: ReactNode }) {
  const [runs, setRuns] = useState<EffectRun[]>([]);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const clickStateRef = useRef(createInitialLogoEasterEggClickState());
  const sequenceTimeoutRef = useRef<number | null>(null);
  const runTimeoutsRef = useRef(new Map<LogoEasterEggEffect, number>());
  const runIdRef = useRef(0);

  const clearSequenceTimeout = useCallback(() => {
    if (sequenceTimeoutRef.current !== null) {
      window.clearTimeout(sequenceTimeoutRef.current);
      sequenceTimeoutRef.current = null;
    }
  }, []);

  const clearRunTimeouts = useCallback(() => {
    runTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
    runTimeoutsRef.current.clear();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches);
    syncPreference();
    mediaQuery.addEventListener("change", syncPreference);

    return () => mediaQuery.removeEventListener("change", syncPreference);
  }, []);

  useEffect(() => {
    if (!prefersReducedMotion) return;

    clickStateRef.current = createInitialLogoEasterEggClickState();
    clearSequenceTimeout();
    clearRunTimeouts();
    setRuns([]);
  }, [clearRunTimeouts, clearSequenceTimeout, prefersReducedMotion]);

  useEffect(() => {
    return () => {
      clearSequenceTimeout();
      clearRunTimeouts();
    };
  }, [clearRunTimeouts, clearSequenceTimeout]);

  const launchEffect = useCallback((kind: LogoEasterEggEffect) => {
    const activeTimeout = runTimeoutsRef.current.get(kind);
    if (activeTimeout !== undefined) {
      window.clearTimeout(activeTimeout);
    }

    const id = runIdRef.current + 1;
    runIdRef.current = id;
    setRuns((currentRuns) => [...currentRuns.filter((run) => run.kind !== kind), { id, kind }]);

    const timeout = window.setTimeout(() => {
      if (runTimeoutsRef.current.get(kind) === timeout) {
        runTimeoutsRef.current.delete(kind);
      }
      setRuns((currentRuns) => currentRuns.filter((run) => run.id !== id));
    }, EFFECT_DURATIONS[kind]);
    runTimeoutsRef.current.set(kind, timeout);
  }, []);

  const recordLogoClick = useCallback(() => {
    if (prefersReducedMotion) return;

    const result = advanceLogoEasterEggClick(clickStateRef.current, Date.now());
    clickStateRef.current = result.state;
    clearSequenceTimeout();

    if (result.state.clickCount > 0) {
      sequenceTimeoutRef.current = window.setTimeout(() => {
        clickStateRef.current = createInitialLogoEasterEggClickState();
        sequenceTimeoutRef.current = null;
      }, LOGO_EASTER_EGG_WINDOW_MS + 1);
    }

    if (result.effect) {
      launchEffect(result.effect);
    }
  }, [clearSequenceTimeout, launchEffect, prefersReducedMotion]);

  const value = useMemo<LogoEasterEggContextValue>(() => ({ recordLogoClick }), [recordLogoClick]);

  return (
    <LogoEasterEggContext.Provider value={value}>
      {children}
      <EasterEggOverlay runs={runs} />
    </LogoEasterEggContext.Provider>
  );
}

export function useLogoEasterEgg() {
  const context = useContext(LogoEasterEggContext);
  if (!context) {
    throw new Error("useLogoEasterEgg must be used within LogoEasterEggProvider");
  }
  return context;
}
