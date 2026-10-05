import { gsap } from "gsap";
import { Flip } from "gsap/Flip";

gsap.registerPlugin(Flip);

export type DeckLayoutState = ReturnType<typeof Flip.getState>;
export type RenderReason = "initial" | "external" | "mutation" | "refresh" | "expand" | "collapse" | "error";

export function createDeckMotion(root: HTMLElement) {
  let motionEnabled = true;
  let keyboardInput = false;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const headingAnimations = new Map<SVGElement, Animation>();
  let settleCall: ReturnType<typeof gsap.delayedCall> | null = null;
  const media = gsap.matchMedia(root);
  const onKeyboard = () => {
    keyboardInput = true;
    cancelHeadingAnimations();
  };
  const onPointer = () => { keyboardInput = false; };
  const onVisibility = () => { if (document.hidden) cancelHeadingAnimations(); };
  root.addEventListener("keydown", onKeyboard, true);
  root.addEventListener("pointerdown", onPointer, true);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("blur", cancelHeadingAnimations);
  finePointer.addEventListener("change", cancelHeadingAnimations);

  media.add(
    {
      motionAllowed: "(prefers-reduced-motion: no-preference)",
      reduceMotion: "(prefers-reduced-motion: reduce)",
    },
    (context) => {
      motionEnabled = Boolean(context.conditions?.motionAllowed);
      root.dataset.motion = motionEnabled ? "enabled" : "reduced";
      root.dataset.motionState = "idle";
      cancelHeadingAnimations();
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
    // Reading or synchronizing work should not move the interface under the pointer.
    if (!motionEnabled || keyboardInput || reason === "initial" || reason === "external" || reason === "refresh") return;
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
    }

    if (reason === "expand") {
      const expanded = root.querySelectorAll<HTMLElement>('.section-toggle[aria-expanded="true"] + .thread-list > *');
      gsap.fromTo(expanded, { autoAlpha: 0, y: -7 }, { autoAlpha: 1, y: 0, duration: 0.2, ease: "power3.out", stagger: 0.025 });
      const chevrons = root.querySelectorAll<HTMLElement>('.section-toggle[aria-expanded="true"] .chevron');
      gsap.fromTo(chevrons, { rotation: -90 }, { rotation: 0, duration: 0.24, ease: "power3.out" });
    }

    if (reason === "error") {
      const panel = root.querySelector<HTMLElement>(".error-panel");
      if (panel) gsap.fromTo(panel, { autoAlpha: 0, y: -6 }, { autoAlpha: 1, y: 0, duration: 0.24, ease: "power3.out" });
    }
  }

  function animateCollapse(button: HTMLElement, list: HTMLElement | null, collapsing: boolean): void {
    if (!motionEnabled || keyboardInput) return;
    markAnimating(collapsing ? 0.2 : 0.24);
    const chevron = button.querySelector<HTMLElement>(".chevron");
    if (chevron) gsap.to(chevron, { rotation: collapsing ? -90 : 0, duration: 0.22, ease: "power3.out" });
    if (!collapsing || !list) return;
    gsap.to(list, {
      autoAlpha: 0,
      y: -7,
      duration: 0.18,
      ease: "power2.out",
      onComplete: () => {
        gsap.set(list, { clearProps: "transform,opacity,visibility" });
      },
    });
  }

  function filterRow(row: HTMLElement, visible: boolean): void {
    gsap.killTweensOf(row);
    if (!motionEnabled || keyboardInput) {
      gsap.set(row, { clearProps: "transform,opacity,visibility" });
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
    const press = (event: PointerEvent) => {
      if (!motionEnabled || event.button !== 0 || !event.isPrimary || element.matches(":disabled")
        || (event.target as Element).closest("button, a") !== element) return;
      gsap.to(element, { scale: 0.97, duration: 0.1, ease: "power2.out", overwrite: true });
    };
    const release = () => {
      if (!motionEnabled) return;
      gsap.to(element, { scale: 1, duration: 0.16, ease: "power3.out", overwrite: true, clearProps: "transform" });
    };
    element.addEventListener("pointerdown", press);
    element.addEventListener("pointerup", release);
    element.addEventListener("pointercancel", release);
    element.addEventListener("pointerleave", release);
  }

  function cancelHeadingAnimations(): void {
    headingAnimations.forEach((animation) => animation.cancel());
    headingAnimations.clear();
  }

  // One short response per pointer entry. Only icon strokes move; headings, text and
  // targets retain their geometry. Exit retargets the live frame instead of replaying.
  function bindHeadingHover(element: HTMLButtonElement): void {
    const parts = Array.from(element.querySelectorAll<SVGElement>("[data-hover-part]"));
    const animatePart = (part: SVGElement, frames: Keyframe[], duration: number) => {
      headingAnimations.get(part)?.cancel();
      const animation = part.animate(frames, { duration, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
      headingAnimations.set(part, animation);
      const release = () => {
        if (headingAnimations.get(part) === animation) headingAnimations.delete(part);
      };
      animation.addEventListener("finish", release, { once: true });
      animation.addEventListener("cancel", release, { once: true });
    };
    element.addEventListener("pointerenter", (event) => {
      if (!motionEnabled || !finePointer.matches || event.pointerType === "touch" || element.disabled) return;
      keyboardInput = false;
      parts.forEach((part, index) => {
        const interrupted = headingAnimations.has(part);
        const current = getComputedStyle(part);
        if (part.dataset.hoverPart === "letter") {
          animatePart(part, [
            { transform: interrupted ? current.transform : "translateY(-4px)", opacity: interrupted ? current.opacity : 0 },
            { transform: "translateY(0)", opacity: 1 },
          ], 240);
        } else if (part.dataset.hoverPart === "bookmark") {
          animatePart(part, [
            { transform: current.transform },
            { transform: "translateY(-1.5px) rotate(-6deg)", offset: .4 },
            { transform: "translateY(0) rotate(0deg)" },
          ], 220);
        } else {
          animatePart(part, [
            { transform: current.transform },
            { transform: "scaleY(1.18)", offset: .25 + index * .12 },
            { transform: "scaleY(1)" },
          ], 240);
        }
      });
    });
    const exit = () => {
      parts.forEach((part) => {
        const current = getComputedStyle(part);
        const isLetter = part.dataset.hoverPart === "letter";
        const interrupted = headingAnimations.has(part);
        if (!motionEnabled || !finePointer.matches || keyboardInput) {
          headingAnimations.get(part)?.cancel();
          headingAnimations.delete(part);
          return;
        }
        if (!interrupted && !isLetter) return;
        animatePart(part, [
          { transform: current.transform, opacity: interrupted ? current.opacity : 1 },
          { transform: "none", opacity: isLetter ? 0 : 1 },
        ], 90);
      });
    };
    element.addEventListener("pointerleave", exit);
    element.addEventListener("pointercancel", exit);
  }

  function acknowledgeOpen(element: HTMLElement): void {
    if (!motionEnabled) return;
    markAnimating(0.28);
    const arrow = element.querySelector<HTMLElement>("[data-open-arrow]");
    const timeline = gsap.timeline();
    timeline.to(element, { scale: 0.975, duration: 0.07, ease: "power2.out" });
    if (arrow) timeline.to(arrow, { x: 4, duration: 0.12, ease: "power3.out" }, 0);
    timeline.to(element, { scale: 1, duration: 0.16, ease: "power3.out", clearProps: "transform" });
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
    if (status) status.textContent = isBusy ? label : "Ready";
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
    cancelHeadingAnimations();
    root.removeEventListener("keydown", onKeyboard, true);
    root.removeEventListener("pointerdown", onPointer, true);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("blur", cancelHeadingAnimations);
    finePointer.removeEventListener("change", cancelHeadingAnimations);
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

  return { acknowledgeOpen, animateCollapse, animateRender, bindHeadingHover, bindPress, captureLayout, destroy, filterRow, setBusy };
}
