import { gsap } from "gsap";
import { Flip } from "gsap/Flip";

gsap.registerPlugin(Flip);

export type DeckLayoutState = ReturnType<typeof Flip.getState>;
export type RenderReason = "initial" | "external" | "mutation" | "refresh" | "expand" | "collapse" | "error";

export function createDeckMotion(root: HTMLElement) {
  let motionEnabled = true;
  let settleCall: ReturnType<typeof gsap.delayedCall> | null = null;
  const media = gsap.matchMedia(root);

  media.add(
    {
      motionAllowed: "(prefers-reduced-motion: no-preference)",
      reduceMotion: "(prefers-reduced-motion: reduce)",
    },
    (context) => {
      motionEnabled = Boolean(context.conditions?.motionAllowed);
      root.dataset.motion = motionEnabled ? "enabled" : "reduced";
      root.dataset.motionState = "idle";
      if (!motionEnabled) gsap.set(root.querySelectorAll("*"), { clearProps: "transform,opacity,visibility" });
      return () => gsap.killTweensOf(root.querySelectorAll("*"));
    },
  );

  function captureLayout(): DeckLayoutState | null {
    if (!motionEnabled) return null;
    const targets = root.querySelectorAll<HTMLElement>("[data-flip-id]");
    return targets.length ? Flip.getState(targets) : null;
  }

  function animateRender(layoutState: DeckLayoutState | null, reason: RenderReason): void {
    if (!motionEnabled) return;
    markAnimating(0.36);
    const flipTargets = root.querySelectorAll<HTMLElement>("[data-flip-id]");
    if (layoutState && flipTargets.length) {
      Flip.from(layoutState, {
        targets: flipTargets,
        duration: 0.24,
        ease: "power3.out",
        fade: true,
        prune: true,
        scale: true,
        simple: true,
        onEnter: (elements) => {
          gsap.fromTo(elements, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.2, ease: "power3.out", stagger: 0.02 });
        },
      });
    } else if (reason === "initial" || reason === "external") {
      const panels = root.querySelectorAll<HTMLElement>(".deck-header, .now-card, .deck-section, .available-section, .deck-footer");
      gsap.fromTo(panels, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.24, ease: "power3.out", stagger: 0.025 });
    }

    if (reason === "expand") {
      const expanded = root.querySelectorAll<HTMLElement>('.section-toggle[aria-expanded="true"] + .thread-list > *');
      gsap.fromTo(expanded, { autoAlpha: 0, y: -7 }, { autoAlpha: 1, y: 0, duration: 0.2, ease: "power3.out", stagger: 0.025 });
      const chevrons = root.querySelectorAll<HTMLElement>('.section-toggle[aria-expanded="true"] .chevron');
      gsap.fromTo(chevrons, { rotation: -90 }, { rotation: 0, duration: 0.24, ease: "power3.out" });
    }

    if (reason === "refresh") {
      const now = root.querySelector<HTMLElement>(".now-card");
      if (now) gsap.fromTo(now, { scale: 0.992, autoAlpha: 0.82 }, { scale: 1, autoAlpha: 1, duration: 0.22, ease: "power3.out" });
    }

    if (reason === "error") {
      const panel = root.querySelector<HTMLElement>(".error-panel");
      if (panel) gsap.fromTo(panel, { autoAlpha: 0, y: -6 }, { autoAlpha: 1, y: 0, duration: 0.24, ease: "power3.out" });
    }
  }

  function animateCollapse(button: HTMLElement, list: HTMLElement | null, collapsing: boolean): Promise<void> {
    if (!motionEnabled) return Promise.resolve();
    markAnimating(collapsing ? 0.2 : 0.24);
    const chevron = button.querySelector<HTMLElement>(".chevron");
    if (chevron) gsap.to(chevron, { rotation: collapsing ? -90 : 0, duration: 0.22, ease: "power3.out" });
    if (!collapsing || !list) return Promise.resolve();
    return new Promise((resolve) => {
      gsap.to(list, {
        autoAlpha: 0,
        y: -7,
        duration: 0.18,
        ease: "power2.out",
        onComplete: () => {
          gsap.set(list, { clearProps: "transform,opacity,visibility" });
          resolve();
        },
      });
    });
  }

  function filterRow(row: HTMLElement, visible: boolean): void {
    gsap.killTweensOf(row);
    if (!motionEnabled) {
      row.hidden = !visible;
      return;
    }
    if (visible) {
      const wasHidden = row.hidden;
      row.hidden = false;
      gsap.set(row, { clearProps: "transform,opacity,visibility" });
      if (!wasHidden) return;
      markAnimating(0.22);
      gsap.fromTo(row, { autoAlpha: 0, y: -5 }, { autoAlpha: 1, y: 0, duration: 0.2, ease: "power3.out", clearProps: "transform,opacity,visibility" });
      return;
    }
    if (row.hidden) {
      gsap.set(row, { clearProps: "transform,opacity,visibility" });
      return;
    }
    markAnimating(0.22);
    gsap.to(row, {
      autoAlpha: 0,
      y: -5,
      duration: 0.14,
      ease: "power2.out",
      onComplete: () => {
        row.hidden = true;
        gsap.set(row, { clearProps: "transform,opacity,visibility" });
      },
    });
  }

  function bindPress(element: HTMLElement): void {
    const press = () => {
      if (!motionEnabled) return;
      gsap.to(element, { scale: 0.97, duration: 0.08, ease: "power2.out", overwrite: true });
    };
    const release = () => {
      if (!motionEnabled) return;
      gsap.to(element, { scale: 1, duration: 0.2, ease: "power3.out", overwrite: true, clearProps: "transform" });
    };
    element.addEventListener("pointerdown", press);
    element.addEventListener("pointerup", release);
    element.addEventListener("pointercancel", release);
    element.addEventListener("pointerleave", release);
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") press();
    });
    element.addEventListener("keyup", release);
  }

  function acknowledgeOpen(element: HTMLElement): Promise<void> {
    if (!motionEnabled) return Promise.resolve();
    markAnimating(0.28);
    const arrow = element.querySelector<HTMLElement>("[data-open-arrow]");
    return new Promise((resolve) => {
      const timeline = gsap.timeline({ onComplete: resolve });
      timeline.to(element, { scale: 0.975, duration: 0.07, ease: "power2.out" });
      if (arrow) timeline.to(arrow, { x: 4, duration: 0.12, ease: "power3.out" }, 0);
      timeline.to(element, { scale: 1, duration: 0.16, ease: "power3.out", clearProps: "transform" });
    });
  }

  function setBusy(isBusy: boolean, label = "Updating Gajendra"): void {
    if (isBusy) root.setAttribute("aria-busy", "true");
    else root.removeAttribute("aria-busy");

    root.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      if (isBusy) {
        button.dataset.wasDisabled = String(button.disabled);
        button.disabled = true;
      } else if (button.dataset.wasDisabled !== undefined) {
        button.disabled = button.dataset.wasDisabled === "true";
        delete button.dataset.wasDisabled;
      }
    });

    const status = root.querySelector<HTMLElement>("[data-refresh-status]");
    if (status) status.textContent = isBusy ? label : "Gajendra is up to date";
    const refreshLabel = root.querySelector<HTMLElement>("[data-refresh-label]");
    if (refreshLabel) refreshLabel.textContent = isBusy ? "Refreshing" : "Refresh";
    const refreshIcon = root.querySelector<HTMLElement>(".refresh-icon");
    if (refreshIcon) {
      gsap.killTweensOf(refreshIcon);
      if (isBusy && motionEnabled) gsap.to(refreshIcon, { rotation: 360, duration: 0.8, ease: "none", repeat: -1 });
      else gsap.set(refreshIcon, { rotation: 0, clearProps: "transform" });
    }
  }

  function destroy(): void {
    settleCall?.kill();
    media.revert();
  }

  function markAnimating(duration: number): void {
    root.dataset.motionState = "animating";
    settleCall?.kill();
    settleCall = gsap.delayedCall(duration, () => {
      root.dataset.motionState = "idle";
      settleCall = null;
    });
  }

  return { acknowledgeOpen, animateCollapse, animateRender, bindPress, captureLayout, destroy, filterRow, setBusy };
}
