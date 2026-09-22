import { clamp, FIXED_STEP, springValue, stepSpring } from "./math.js";

export function bindCharacterInteraction(engine) {
  const svg = engine.svg;
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("class", "drippy-interaction");
  for (const child of [...svg.children]) if (child.tagName?.toLowerCase() !== "defs") group.appendChild(child);
  svg.appendChild(group);
  engine.interactionGroup = group;
  const pose = { x: springValue(0), y: springValue(0), press: springValue(0) };
  let pointer = null, dragged = false;
  const enabled = () => engine.getConfig().interactive && !engine.paused;
  const end = () => {
    const id = pointer?.id;
    pointer = null;
    pose.x.target = pose.y.target = pose.press.target = 0;
    if (id != null && svg.hasPointerCapture?.(id)) svg.releasePointerCapture(id);
  };
  const down = event => {
    if (!enabled() || pointer || event.button !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    dragged = false;
    pose.press.target = 1;
    svg.setPointerCapture(event.pointerId);
  };
  const move = event => {
    if (!pointer || event.pointerId !== pointer.id) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    dragged ||= Math.hypot(dx, dy) > 5;
    const factor = 228.54 / (svg.getBoundingClientRect().width || 228.54);
    pose.x.target = clamp(dx * factor, -28, 28);
    pose.y.target = clamp(dy * factor, -28, 28);
  };
  const key = event => {
    if (![" ", "Enter"].includes(event.key) || !enabled()) return;
    event.preventDefault();
    pose.press.target = event.type === "keydown" ? 1 : 0;
  };
  const click = event => { if (dragged) { event.preventDefault(); event.stopPropagation(); dragged = false; } };
  const listeners = { pointerdown: down, pointermove: move, pointerup: end, pointercancel: end, lostpointercapture: end, keydown: key, keyup: key, blur: end, click };
  for (const [type, listener] of Object.entries(listeners)) svg.addEventListener?.(type, listener);
  engine.renderInteraction = (delta, reducedMotion) => {
    const interactive = Boolean(engine.getConfig().interactive);
    if (!interactive || engine.paused) end();
    if (interactive) { svg.setAttribute("tabindex", "0"); svg.setAttribute("role", "button"); svg.setAttribute("aria-label", "Drippy: pressione ou arraste para interagir"); }
    else { svg.removeAttribute("tabindex"); svg.removeAttribute("role"); svg.removeAttribute("aria-label"); }
    svg.style.touchAction = interactive ? "none" : "";
    svg.style.cursor = interactive ? pointer ? "grabbing" : "grab" : "";
    for (const spring of Object.values(pose)) {
      if (reducedMotion) { spring.x = spring.target; spring.v = 0; }
      else {
        const steps = Math.max(1, Math.ceil(delta / FIXED_STEP));
        for (let i = 0; i < steps; i++) stepSpring(spring, 15, 0.68, delta / steps);
      }
    }
    const press = pose.press.x;
    const grow = pointer && dragged ? 0.04 : 0;
    group.setAttribute("transform", `translate(${pose.x.x} ${pose.y.x}) translate(114.27 114.27) rotate(${reducedMotion ? 0 : pose.x.x * 0.2}) scale(${1 + press * 0.045 + grow} ${1 - press * 0.07 + grow}) translate(-114.27 -114.27)`);
  };
  engine.releaseInteraction = () => {
    end();
    for (const [type, listener] of Object.entries(listeners)) svg.removeEventListener?.(type, listener);
  };
}
