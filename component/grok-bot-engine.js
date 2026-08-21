import {
  CIRCLE_RING,
  EXPRESSIONS,
  EYE_HALF,
  HEAD_C,
  SHAPES,
  STAR_GOLD,
  STAR_PATH,
} from "./original-data.js";

const MORPH_SIZES = {
  dots: 22,
  orbit: 19,
  radar: 19,
  progress: 19,
  gather: 19,
  wave: 16,
  send: 20,
  receive: 20,
  dock: 20,
  ball: 18,
  whirl: 15,
  pencil: 17,
  bang: 13,
  standby: 13,
};

const MORPH_EFFECTS = Object.keys(MORPH_SIZES);

const MORPH_VIEWBOX = {
  dots: 1.5,
  orbit: 1.14,
  radar: 1.14,
  progress: 1.32,
  gather: 1.15,
  wave: 1.42,
  send: 1.12,
  receive: 1.12,
  dock: 1.3,
  ball: 1.22,
  whirl: 1.45,
  pencil: 1.18,
  bang: 1.28,
  standby: 1.75,
};

const COLORS = ["#f9705c", "#5b95f0", "#3fbe86", "#f5b13f", "#9a72ee", "#35c3bd"];
const SVG_NS = "http://www.w3.org/2000/svg";
const REDUCE_MOTION = typeof globalThis.matchMedia === "function"
  ? globalThis.matchMedia("(prefers-reduced-motion: reduce)")
  : { matches: false };
const FIXED_STEP = 1 / 120;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const random = (min, max) => min + Math.random() * (max - min);
const cubicInOut = (value) => value < 0.5 ? 4 * value ** 3 : 1 - ((-2 * value + 2) ** 3) / 2;
const cubicOut = (value) => 1 - (1 - value) ** 3;
const backOut = (value) => 1 + 2.70158 * (value - 1) ** 3 + 1.70158 * (value - 1) ** 2;
const smoothstep = (value) => value * value * (3 - 2 * value);
const springValue = (value) => ({ x: value, v: 0, target: value });

function stepSpring(spring, frequency, damping, delta) {
  spring.v += (-2 * damping * frequency * spring.v - frequency ** 2 * (spring.x - spring.target)) * delta;
  spring.x += spring.v * delta;
  if (!Number.isFinite(spring.x) || !Number.isFinite(spring.v)) {
    spring.x = spring.target;
    spring.v = 0;
  }
}

function centroid(ring) {
  let x = 0;
  let y = 0;
  for (const point of ring) {
    x += point[0];
    y += point[1];
  }
  return [x / ring.length, y / ring.length];
}

function lerpRing(from, to, amount) {
  return from.map(([x, y], index) => [x + (to[index][0] - x) * amount, y + (to[index][1] - y) * amount]);
}

function ringPath(ring) {
  return `M${ring.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join("L")}Z`;
}

function ringOutline(ring) {
  const round = (value) => Math.round(value * 100) / 100;
  const length = ring.length;
  let path = `M${round(ring[0][0])} ${round(ring[0][1])}`;
  for (let index = 0; index < length; index += 1) {
    const previous = ring[(index - 1 + length) % length];
    const point = ring[index];
    const next = ring[(index + 1) % length];
    const after = ring[(index + 2) % length];
    path += `C${round(point[0] + (next[0] - previous[0]) / 6)} ${round(point[1] + (next[1] - previous[1]) / 6)} ${round(next[0] - (after[0] - point[0]) / 6)} ${round(next[1] - (after[1] - point[1]) / 6)} ${round(next[0])} ${round(next[1])}`;
  }
  return `${path}Z`;
}

function spanAt(ring, y) {
  let left = -Infinity;
  let right = Infinity;
  for (let index = 0; index < ring.length; index += 1) {
    const start = ring[index];
    const end = ring[(index + 1) % ring.length];
    if ((start[1] <= y) === (end[1] <= y)) continue;
    const x = start[0] + ((end[0] - start[0]) * (y - start[1])) / (end[1] - start[1]);
    if (x <= HEAD_C) left = Math.max(left, x);
    else right = Math.min(right, x);
  }
  return [Number.isFinite(left) ? left : HEAD_C, Number.isFinite(right) ? right : HEAD_C];
}

function shapeSpanAt(shape, y) {
  if (!shape.spanSamples?.length) return spanAt(shape.ring, y);
  const count = shape.spanSamples.length;
  const position = clamp(((y - shape.top) / (shape.bottom - shape.top)) * count - 0.5, 0, count - 1);
  const start = Math.floor(position);
  const end = Math.min(start + 1, count - 1);
  const amount = position - start;
  return [
    shape.spanSamples[start][0] + (shape.spanSamples[end][0] - shape.spanSamples[start][0]) * amount,
    shape.spanSamples[start][1] + (shape.spanSamples[end][1] - shape.spanSamples[start][1]) * amount,
  ];
}

function radialSolidProfile(solid, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const raw = Array.from({ length: 96 }, (_, index) => {
    const theta = index / 96 * Math.PI * 2;
    const directionX = Math.cos(theta);
    const directionY = Math.sin(theta);
    let radius = 0;
    for (const [x, y, z, sphereRadius] of solid) {
      const rotatedX = x * cosine + z * sine;
      const projection = directionX * rotatedX + directionY * y;
      const discriminant = projection ** 2 - (rotatedX ** 2 + y ** 2) + sphereRadius ** 2;
      if (discriminant > 0) radius = Math.max(radius, projection + Math.sqrt(discriminant));
    }
    return radius;
  });
  return raw.map((value, index, values) => (
    values[(index - 2 + 96) % 96] + 4 * values[(index - 1 + 96) % 96] + 6 * value +
    4 * values[(index + 1) % 96] + values[(index + 2) % 96]
  ) / 16);
}

const solidBaselines = new Map();
function turnedShapeRing(shape, angle) {
  if (shape.solid) {
    let baseline = solidBaselines.get(shape);
    if (!baseline) {
      baseline = radialSolidProfile(shape.solid, 0);
      solidBaselines.set(shape, baseline);
    }
    let profile = radialSolidProfile(shape.solid, angle).map((value, index) => clamp((value + 12) / (baseline[index] + 12), 0.32, 1.5));
    for (let pass = 0; pass < 3; pass += 1) {
      const source = profile;
      profile = source.map((value, index) => (
        source[(index - 2 + 96) % 96] + 4 * source[(index - 1 + 96) % 96] + 6 * value +
        4 * source[(index + 1) % 96] + source[(index + 2) % 96]
      ) / 16);
    }
    return shape.ring.map(([x, y], index) => [HEAD_C + (x - HEAD_C) * profile[index], HEAD_C + (y - HEAD_C) * profile[index]]);
  }
  if (shape.sides) {
    const segment = Math.PI * 2 / shape.sides;
    const factor = 1 + (Math.cos((((angle % segment) + segment) % segment) - segment / 2) / Math.cos(segment / 2) - 1) * 0.45;
    return shape.ring.map(([x, y]) => [HEAD_C + (x - HEAD_C) * factor, y]);
  }
  return shape.ring;
}

function lerpFace(from, to, amount) {
  return {
    x: from.x + (to.x - from.x) * amount,
    y: from.y + (to.y - from.y) * amount,
    sx: from.sx + (to.sx - from.sx) * amount,
    sy: from.sy + (to.sy - from.sy) * amount,
    eye: from.eye + (to.eye - from.eye) * amount,
  };
}

const teardrop = SHAPES.teardrop.ring;
const halfDrop = teardrop.length / 2;
const dropAngle = halfDrop / teardrop.length * Math.PI * 2;
const PENCIL_RING = Array.from({ length: teardrop.length }, (_, index) => {
  const [x, y] = teardrop[((index - halfDrop) % teardrop.length + teardrop.length) % teardrop.length];
  const dx = x - HEAD_C;
  const dy = y - HEAD_C;
  return [HEAD_C + dx * Math.cos(dropAngle) - dy * Math.sin(dropAngle), HEAD_C + dx * Math.sin(dropAngle) + dy * Math.cos(dropAngle)];
});

const CIRCLE_PATH = ringOutline(CIRCLE_RING);
const PENCIL_GLYPH = `M${HEAD_C - 15} ${HEAD_C - 29}A15 15 0 0 1 ${HEAD_C + 15} ${HEAD_C - 29}L${HEAD_C + 15} ${HEAD_C + 29}A15 15 0 0 1 ${HEAD_C - 15} ${HEAD_C + 29}Z`;
const ALERT_GLYPH = `M${HEAD_C - 15} ${HEAD_C - 33}A15 15 0 0 1 ${HEAD_C + 15} ${HEAD_C - 33}L${HEAD_C + 8.5} ${HEAD_C + 39.5}A8.5 8.5 0 0 1 ${HEAD_C - 8.5} ${HEAD_C + 39.5}Z`;

class ParticleSystem {
  constructor(back, front, { idPrefix, reduceMotion, radius }) {
    this.back = back;
    this.front = front;
    this.idPrefix = idPrefix;
    this.reduceMotion = reduceMotion;
    this.radius = radius;
    this.particles = [];
    this.spinAngle = random(0, Math.PI * 2);
    this.lastSpinAngle = 0;
    this.angularVelocity = 0;
    this.trailActive = false;
    this.emissionQueue = [];
    this.gradientIndex = 0;
    this.orbitLayouts = [];
    this.hue = 0;
    this.orbitCount = 4;
    this.sizeScale = 1;
    this.wideStyle = false;
  }

  clear() {
    for (const particle of this.particles) {
      particle.element?.remove();
      particle.trailElement?.remove();
      particle.trailFrontElement?.remove();
      particle.gradientElement?.remove();
    }
    this.particles = [];
  }

  resetOrbitStyle(layoutCount = 1) {
    const roll = random(-0.85, 0.85);
    this.orbitLayouts = Array.from({ length: layoutCount }, (_, index) => ({
      tilt: random(0.16, 0.5),
      roll: roll + index * Math.PI / layoutCount + random(-0.12, 0.12),
    }));
    this.orbitCount = layoutCount > 1 ? 3 * layoutCount : Math.round(random(3, 5));
    this.hue = random(0, 360);
  }

  spawnOrbitParticle(angle, direction, index) {
    if (this.particles.length > 110) return;
    if (!this.orbitLayouts.length) this.resetOrbitStyle();
    const layout = this.orbitLayouts[index % this.orbitLayouts.length];
    const countPerLayout = Math.max(Math.ceil(this.orbitCount / this.orbitLayouts.length) - 1, 1);
    const baseRadius = 116 * (this.radius() / HEAD_C);
    this.particles.push({
      x: HEAD_C,
      y: HEAD_C,
      vx: 0,
      vy: 0,
      returnAmount: 0,
      life: 0,
      max: 9,
      radius: (this.orbitCount <= 3 ? random(8, 10.5) : this.orbitCount === 4 ? random(6.6, 8.6) : random(5.6, 7.4)),
      rotation: random(0, 360),
      rotationSpeed: random(-240, 240),
      curl: 0,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      round: true,
      isStar: false,
      hue: this.hue + 360 * index / Math.max(this.orbitCount, 1) + random(-14, 14),
      hueSpan: random(45, 95) * (Math.random() < 0.5 ? 1 : -1),
      hueVelocity: random(18, 42) * (Math.random() < 0.5 ? 1 : -1),
      orbit: {
        angle,
        angularVelocity: direction * random(0.5, 1.1),
        tilt: layout.tilt + random(-0.04, 0.04),
        roll: layout.roll + random(-0.05, 0.05),
        radius: baseRadius + Math.floor(index / this.orbitLayouts.length) * (38 / countPerLayout) + random(-1.5, 1.5),
        radiusVelocity: random(0, 2.5),
        follow: random(0.74, 0.94),
        carry: 0,
        arc: random(2.2, 3.4),
      },
      history: [],
      element: null,
    });
  }

  burst(count = 20, force = 1, curl = 0) {
    if (this.reduceMotion() || !this.back || this.particles.length > 120) return;
    for (let index = 0; index < count; index += 1) {
      const angle = index / count * Math.PI * 2 + random(-0.35, 0.35);
      const distance = random(96, 116) * (this.radius() / HEAD_C);
      const speed = random(170, 360) * force;
      const tangentX = -Math.sin(angle);
      const tangentY = Math.cos(angle);
      const curlVelocity = curl * speed * 0.2;
      const isStar = Math.random() < 0.18;
      const round = !isStar && Math.random() < 0.3;
      this.particles.push({
        element: null,
        x: HEAD_C + Math.cos(angle) * distance,
        y: HEAD_C + Math.sin(angle) * distance,
        vx: Math.cos(angle) * speed + tangentX * curlVelocity,
        vy: Math.sin(angle) * speed + tangentY * curlVelocity - random(20, 75),
        life: 0,
        max: random(0.45, 0.85),
        radius: isStar ? random(4, 7) : random(3.5, 8),
        rotation: random(0, 360),
        rotationSpeed: random(-260, 260),
        curl: 0,
        color: isStar ? STAR_GOLD : COLORS[Math.floor(Math.random() * COLORS.length)],
        isStar,
        round,
        returnAmount: 0,
        orbit: null,
      });
    }
  }

  projectOrbit(orbit, angle) {
    const horizontal = orbit.radius * Math.sin(angle);
    const vertical = -orbit.radius * Math.cos(angle) * Math.sin(orbit.tilt);
    const cosine = Math.cos(orbit.roll);
    const sine = Math.sin(orbit.roll);
    return {
      x: HEAD_C + horizontal * cosine - vertical * sine,
      y: HEAD_C + horizontal * sine + vertical * cosine,
    };
  }

  orbitDepth(orbit, angle) {
    return Math.cos(angle) * Math.cos(orbit.tilt);
  }

  trailPaths(points, width) {
    const round = (value) => Math.round(value * 10) / 10;
    let length = 0;
    for (let index = 1; index < points.length; index += 1) length += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
    const actualWidth = Math.min(width, 0.34 * length);
    const normalX = [];
    const normalY = [];
    for (let index = 0; index < points.length; index += 1) {
      const previous = points[index > 0 ? index - 1 : 0];
      const next = points[index < points.length - 1 ? index + 1 : points.length - 1];
      let dx = next.x - previous.x;
      let dy = next.y - previous.y;
      const magnitude = Math.hypot(dx, dy) || 1;
      dx /= magnitude;
      dy /= magnitude;
      const halfWidth = actualWidth * (0.5 + index / (points.length - 1) * 0.5) / 2;
      normalX.push(-dy * halfWidth);
      normalY.push(dx * halfWidth);
    }
    const cap = (index) => {
      const radius = Math.max(Math.hypot(normalX[index], normalY[index]), 0.2);
      return `A${round(radius)} ${round(radius)} 0 0 0 `;
    };
    const segment = (start, end) => {
      let path = "";
      for (let index = start; index <= end; index += 1) path += `${index === start ? "M" : "L"}${round(points[index].x + normalX[index])} ${round(points[index].y + normalY[index])}`;
      path += end === points.length - 1 ? cap(end) : "L";
      for (let index = end; index >= start; index -= 1) path += `${index === end ? "" : "L"}${round(points[index].x - normalX[index])} ${round(points[index].y - normalY[index])}`;
      if (start === 0) path += `${cap(0)}${round(points[0].x + normalX[0])} ${round(points[0].y + normalY[0])}`;
      return `${path}Z`;
    };
    if (length < 2) return { front: "", back: "" };
    let front = "";
    let back = "";
    let cursor = 0;
    while (cursor < points.length) {
      const isFront = points[cursor].z >= 0;
      let end = cursor;
      while (end + 1 < points.length && (points[end + 1].z >= 0) === isFront) end += 1;
      const segmentStart = Math.max(cursor - 1, 0);
      const segmentEnd = Math.min(end + 1, points.length - 1);
      if (segmentEnd > segmentStart) {
        const path = segment(segmentStart, segmentEnd);
        if (isFront) front += path;
        else back += path;
      }
      cursor = end + 1;
    }
    return { front, back };
  }

  update(now, delta, { spinAngle, sizeScale, wideStyle, enabled = true }) {
    this.sizeScale = sizeScale;
    this.spinAngle = spinAngle;
    this.wideStyle = wideStyle;
    if (!enabled) {
      if (this.particles.length) this.clear();
      this.emissionQueue = [];
      this.trailActive = false;
      this.angularVelocity = 0;
      this.lastSpinAngle = this.spinAngle;
      return;
    }
    let difference = this.spinAngle - this.lastSpinAngle;
    if (!Number.isFinite(difference) || Math.abs(difference) > 1.2) difference = 0;
    this.lastSpinAngle = this.spinAngle;
    const wasSpinning = Math.abs(this.angularVelocity) >= 0.9;
    this.angularVelocity = delta > 0 ? difference / delta : 0;
    const isSpinning = Math.abs(this.angularVelocity) >= 0.9;
    if (!wasSpinning && isSpinning) {
      this.resetOrbitStyle(this.wideStyle ? 3 : 1);
      this.trailActive = false;
    }
    if (wasSpinning && !isSpinning) this.emissionQueue = [];
    if (!this.reduceMotion() && this.back) {
      if (!this.trailActive && Math.abs(this.angularVelocity) >= 5) {
        this.trailActive = true;
        this.emissionQueue = Array.from({ length: this.orbitCount }, (_, index) => ({ at: now + index * random(55, 105), index }));
      }
      while (this.emissionQueue.length && now >= this.emissionQueue[0].at) {
        const queued = this.emissionQueue.shift();
        this.spawnOrbitParticle(this.spinAngle - random(0, 0.18), Math.sign(this.angularVelocity) || 1, queued.index);
      }
    }

    const alive = [];
    for (const particle of this.particles) {
      particle.life += delta;
      const progress = clamp(particle.life / particle.max, 0, 1);
      if (particle.orbit) {
        const shouldReturn = !isSpinning || progress > 0.55;
        particle.returnAmount = clamp(particle.returnAmount + (shouldReturn ? delta / 0.5 : -delta / 0.35), 0, 1);
        if (particle.returnAmount >= 1) {
          particle.trailElement?.remove();
          particle.trailFrontElement?.remove();
          particle.gradientElement?.remove();
          continue;
        }
      } else if (particle.life >= particle.max) {
        particle.element?.remove();
        continue;
      }

      const opacity = particle.orbit ? Math.min(1, particle.life / 0.26) : progress < 0.1 ? progress / 0.1 : (1 - (progress - 0.1) / 0.9) ** 1.7;
      if (particle.orbit) {
        const orbit = particle.orbit;
        if (isSpinning) {
          orbit.carry = this.angularVelocity * orbit.follow;
          orbit.angle += this.angularVelocity * delta * orbit.follow + orbit.angularVelocity * delta;
        } else {
          orbit.angle += (orbit.carry + orbit.angularVelocity) * delta;
          orbit.carry *= Math.exp(-2.6 * delta);
          orbit.angularVelocity *= Math.exp(-2.6 * delta);
        }
        orbit.radius += orbit.radiusVelocity * delta;
        const position = this.projectOrbit(orbit, orbit.angle);
        particle.x = position.x;
        particle.y = position.y;
        const depth = this.orbitDepth(orbit, orbit.angle);
        const depthScale = 0.72 + 0.28 * clamp(depth, 0, 1);
        const enter = Math.min(particle.life / 0.34, 1);
        const smoothEnter = enter * enter * (3 - 2 * enter);
        const width = Math.max(particle.radius * depthScale * 1.7 * this.sizeScale * smoothEnter * (1 - 0.72 * particle.returnAmount ** 2), 0.5);

        if (!particle.trailElement) {
          const trail = document.createElementNS(SVG_NS, "path");
          trail.setAttribute("data-trail", "");
          trail.setAttribute("stroke", "none");
          const gradient = document.createElementNS(SVG_NS, "linearGradient");
          const gradientId = `${this.idPrefix}t${this.gradientIndex++}`;
          gradient.setAttribute("id", gradientId);
          gradient.setAttribute("gradientUnits", "userSpaceOnUse");
          particle.stops = [];
          for (let index = 0; index < 5; index += 1) {
            const stop = document.createElementNS(SVG_NS, "stop");
            stop.setAttribute("offset", (index / 4).toFixed(3));
            gradient.appendChild(stop);
            particle.stops.push(stop);
          }
          this.back.appendChild(gradient);
          particle.gradientElement = gradient;
          trail.setAttribute("fill", `url(#${gradientId})`);
          this.back.appendChild(trail);
          particle.trailElement = trail;
          const frontTrail = document.createElementNS(SVG_NS, "path");
          frontTrail.setAttribute("data-trail", "");
          frontTrail.setAttribute("stroke", "none");
          frontTrail.setAttribute("fill", trail.getAttribute("fill") || particle.color);
          this.front?.appendChild(frontTrail);
          particle.trailFrontElement = frontTrail;
        }

        const history = particle.history;
        const previousAngle = history.length ? history.at(-1).angle : orbit.angle;
        const angleChange = orbit.angle - previousAngle;
        const subdivisions = Math.min(Math.ceil(Math.abs(angleChange) / 0.09), 24);
        for (let index = 1; index <= subdivisions; index += 1) {
          const angle = previousAngle + angleChange * index / subdivisions;
          const point = this.projectOrbit(orbit, angle);
          history.push({ x: point.x, y: point.y, angle, z: this.orbitDepth(orbit, angle) });
        }
        if (!history.length) history.push({ x: particle.x, y: particle.y, angle: orbit.angle, z: depth });
        const arc = orbit.arc * (1 - particle.returnAmount ** 2 * (3 - 2 * particle.returnAmount));
        while (history.length > 2 && Math.abs(orbit.angle - history[0].angle) > arc) history.shift();
        const excess = Math.abs(orbit.angle - history[0].angle) - arc;
        if (history.length >= 2 && excess > 0) {
          const angle = history[0].angle + Math.sign(orbit.angle - history[0].angle) * excess;
          const point = this.projectOrbit(orbit, angle);
          history[0] = { x: point.x, y: point.y, angle, z: this.orbitDepth(orbit, angle) };
        }
        if (history.length > 48) history.splice(0, history.length - 48);
        if (history.length >= 2) {
          const paths = this.trailPaths(history, width);
          const trailOpacity = opacity.toFixed(3);
          particle.trailElement.setAttribute("d", paths.back);
          particle.trailElement.setAttribute("opacity", trailOpacity);
          particle.trailFrontElement?.setAttribute("d", paths.front);
          particle.trailFrontElement?.setAttribute("opacity", trailOpacity);
          const hue = particle.hue + particle.hueVelocity * particle.life;
          for (let index = 0; index < particle.stops.length; index += 1) {
            const position = index / (particle.stops.length - 1);
            const value = hue + position * particle.hueSpan;
            particle.stops[index].setAttribute("stop-color", `hsl(${(((value % 360) + 360) % 360).toFixed(0)} 56% ${(56 + 11 * position).toFixed(0)}%)`);
          }
          const first = history[0];
          const last = history.at(-1);
          particle.gradientElement.setAttribute("x1", first.x.toFixed(1));
          particle.gradientElement.setAttribute("y1", first.y.toFixed(1));
          particle.gradientElement.setAttribute("x2", last.x.toFixed(1));
          particle.gradientElement.setAttribute("y2", last.y.toFixed(1));
        } else {
          particle.trailElement.setAttribute("opacity", "0");
          particle.trailFrontElement?.setAttribute("opacity", "0");
        }
        alive.push(particle);
        continue;
      }

      if (particle.curl) {
        const cosine = Math.cos(particle.curl * delta);
        const sine = Math.sin(particle.curl * delta);
        const vx = particle.vx * cosine - particle.vy * sine;
        const vy = particle.vx * sine + particle.vy * cosine;
        particle.vx = vx;
        particle.vy = vy;
      }
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      const drag = 0.94 ** (60 * delta);
      particle.vx *= drag;
      particle.vy = particle.vy * drag + 40 * delta;
      const size = Math.max(particle.radius * (1 - 0.4 * progress), 0.5);

      if (!particle.element) {
        particle.element = document.createElementNS(SVG_NS, particle.isStar ? "path" : particle.round ? "circle" : "rect");
        if (particle.isStar) particle.element.setAttribute("d", STAR_PATH);
        particle.element.setAttribute("fill", particle.color);
        this.back.appendChild(particle.element);
      }
      particle.element.setAttribute("opacity", opacity.toFixed(3));
      if (particle.isStar) {
        particle.rotation += particle.rotationSpeed * delta;
        particle.element.setAttribute("transform", `translate(${particle.x.toFixed(1)} ${particle.y.toFixed(1)}) rotate(${particle.rotation.toFixed(1)}) scale(${size.toFixed(2)})`);
      } else if (particle.round) {
        particle.element.setAttribute("cx", particle.x.toFixed(1));
        particle.element.setAttribute("cy", particle.y.toFixed(1));
        particle.element.setAttribute("r", size.toFixed(2));
      } else {
        const width = Math.max(2 * size, Math.min(0.05 * Math.hypot(particle.vx, particle.vy), 30));
        const height = 1.5 * size;
        particle.element.setAttribute("width", width.toFixed(1));
        particle.element.setAttribute("height", height.toFixed(1));
        particle.element.setAttribute("rx", (height / 2).toFixed(2));
        particle.element.setAttribute("x", (particle.x - width / 2).toFixed(1));
        particle.element.setAttribute("y", (particle.y - height / 2).toFixed(1));
        particle.element.setAttribute("transform", `rotate(${(Math.atan2(particle.vy, particle.vx) * 180 / Math.PI).toFixed(1)} ${particle.x.toFixed(1)} ${particle.y.toFixed(1)})`);
      }
      alive.push(particle);
    }
    this.particles = alive;
  }
}

export class GrokBotEngine {
  constructor(svg, getConfig) {
    this.svg = svg;
    this.getConfig = getConfig;
    this.head = svg.querySelector("#head-path");
    this.clipHead = svg.querySelector("#head-clip-path");
    this.transformGroup = svg.querySelector("#bot-transform");
    this.eyes = [...svg.querySelectorAll(".eye-path")];
    this.morphHeads = [...svg.querySelectorAll(".morph-head")];
    this.rings = [...svg.querySelectorAll(".morph-ring")];
    this.parts = [...svg.querySelectorAll(".morph-part")];
    this.glyphs = [...svg.querySelectorAll(".morph-glyph")];
    this.baseMorphLayer = {
      group: null,
      heads: this.morphHeads,
      rings: this.rings,
      parts: this.parts,
      glyphs: this.glyphs,
    };
    this.morphLayers = new Map();
    this.badge = svg.querySelector("#notify-badge");
    this.currentBeltRadius = SHAPES.blob.beltRadius;
    this.particleSpinAngle = 0;
    this.particles = new ParticleSystem(svg.querySelector("#particles-back"), svg.querySelector("#particles-front"), {
      idPrefix: `${svg.id || "grok-bot"}-`,
      reduceMotion: () => REDUCE_MOTION.matches,
      radius: () => this.currentBeltRadius,
    });
    this.pointer = { active: false, clientX: 0, clientY: 0, x: 0, y: 0, targetX: 0, targetY: 0 };
    this.state = "idle";
    this.startedAt = performance.now();
    this.stateStartedAt = this.startedAt;
    this.lastTime = this.startedAt;
    this.clockTime = this.startedAt;
    this.playbackRate = 1;
    this.paused = false;
    this.pendingStep = 0;
    this.expressionFrom = [EXPRESSIONS[0][0], EXPRESSIONS[0][1]];
    this.expressionTo = this.expressionFrom;
    this.expressionIndex = 0;
    this.expressionSpring = springValue(1);
    this.expressionFrequency = 7;
    this.rotation = springValue(0);
    this.headX = springValue(0);
    this.headY = springValue(0);
    this.scaleY = springValue(1);
    this.eyeOpen = springValue(1);
    this.eyeScale = springValue(1);
    this.aimX = springValue(0);
    this.aimY = springValue(0);
    this.morph = springValue(0);
    this.morphBlend = springValue(1);
    this.shapeBlend = springValue(1);
    this.turn = springValue(0);
    this.notify = springValue(0);
    this.humming = springValue(0);
    this.stateVersion = 0;
    this.requestedMorphEffect = null;
    this.morphEffect = null;
    this.previousMorphEffect = null;
    this.morphVisible = false;
    this.morphStartedAt = this.startedAt;
    this.morphShotStartedAt = this.startedAt;
    this.morphRestStartedAt = 0;
    this.oneShotResting = false;
    this.morphPreview = null;
    this.turnDirection = 1;
    this.spinAngle = 0;
    this.expressionCursor = 0;
    this.expressionNext = 0;
    this.blinkNext = 0;
    this.gazeNext = 0;
    this.blinkQueue = [];
    this.blinkTarget = null;
    this.wakeBurst = false;
    this.drowsyStartedAt = 0;
    this.listenNodUntil = 0;
    this.listenNodNext = 0;
    this.impulseNext = 0;
    this.impulseUntil = 0;
    this.behaviorNext = 0;
    this.winkAt = -Infinity;
    this.winkEye = 0;
    this.winkNext = this.startedAt + random(3000, 8000);
    this.dragCycle = -1;
    this.notifyTriggered = false;
    this.receiveCycle = -1;
    this.receiveAngle = -0.7;
    this.writingTrail = [];
    this.shapeId = SHAPES[getConfig()?.shape] ? getConfig().shape : "blob";
    this.shapeFromRing = SHAPES[this.shapeId].ring;
    this.shapeFromFace = SHAPES[this.shapeId].face;
    this.shapeFromTiltScale = SHAPES[this.shapeId].tiltScale;
    this.shapeFromBeltRadius = SHAPES[this.shapeId].beltRadius;
    this.shapeChangeCycle = Math.floor(random(0, 5));
    this.shapeChangeWide = false;
    this.spinSpring = null;
    this.gesture = null;
    this.bounceStartedAt = -1;
    this.ambientNext = this.startedAt + random(2500, 5000);
    this.celebrateCycle = -1;
    this.celebrateWildActive = false;
    this.directTurn = 0;
    this.directRotation = 0;
    this.directX = 0;
    this.directY = 0;
    this.directGazeX = 0;
    this.directGazeY = 0;
    this.boundFrame = (time) => this.frame(time);
    this.pointerMove = (event) => {
      this.pointer.active = true;
      this.pointer.clientX = event.clientX;
      this.pointer.clientY = event.clientY;
    };
    this.pointerLeave = () => { this.pointer.active = false; };
    window.addEventListener("pointermove", this.pointerMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", this.pointerLeave);
    this.setState("idle", true);
    this.frameId = requestAnimationFrame(this.boundFrame);
  }

  destroy() {
    cancelAnimationFrame(this.frameId);
    window.removeEventListener("pointermove", this.pointerMove);
    document.documentElement.removeEventListener("mouseleave", this.pointerLeave);
    for (const layer of this.morphLayers.values()) layer.group.remove();
  }

  setState(state, immediate = false) {
    if (!immediate && state === this.state) return;
    const now = this.clockTime;
    this.state = state;
    this.stateStartedAt = now;
    this.stateVersion += 1;
    const config = this.getConfig();
    this.expressionCursor = 0;
    this.expressionNext = now + random(config.expressionCadence[0], config.expressionCadence[1]) * config.tempo;
    this.blinkNext = now + random(1500, 7000);
    this.gazeNext = now + random(500, 1400);
    this.listenNodNext = now + random(1200, 2200);
    this.impulseNext = now + random(500, 1200);
    this.behaviorNext = now + (
      state === "excited" ? random(400, 1100)
        : state === "searching" ? random(800, 1600)
          : state === "working" ? random(1200, 2400)
            : random(6000, 10000)
    );
    this.winkNext = now + random(3000, 8000);
    this.blinkQueue = [];
    this.blinkTarget = null;
    this.wakeBurst = false;
    this.drowsyStartedAt = 0;
    this.dragCycle = -1;
    this.notifyTriggered = false;
    this.receiveCycle = -1;
    this.writingTrail = [];
    this.oneShotResting = false;
    this.morphPreview = null;
    this.celebrateWildActive = false;
    this.morphShotStartedAt = now;
    if (state === "celebrate") {
      this.turnDirection = Math.random() < 0.5 ? 1 : -1;
      this.celebrateCycle = -1;
    }
    const firstExpression = config.expressionPool[0] ?? 0;
    if (state !== "waking" && state !== "sleeping") {
      if (state !== "drowsy") this.scheduleBlink(now);
      this.setExpression(firstExpression, state === "excited" ? 10 : 8);
    }
  }

  setExpression(index, frequency = 7) {
    if (index === this.expressionIndex && this.expressionSpring.target === 1) return;
    const amount = clamp(this.expressionSpring.x, 0, 1);
    this.expressionFrom = [
      lerpRing(this.expressionFrom[0], this.expressionTo[0], amount),
      lerpRing(this.expressionFrom[1], this.expressionTo[1], amount),
    ];
    this.expressionTo = [EXPRESSIONS[index][0], EXPRESSIONS[index][1]];
    this.expressionIndex = index;
    this.expressionSpring.x = 0;
    this.expressionSpring.v = 0;
    this.expressionSpring.target = 1;
    this.expressionFrequency = frequency;
  }

  scheduleBlink(now) {
    this.blinkTarget = this.eyeOpen.target;
    this.blinkQueue.push(
      { at: now, value: 0.05 },
      { at: now + 70, value: 0.05 },
      { at: now + 150, value: 1.08 },
      { at: now + 300, value: 1 },
    );
    if (Math.random() < 0.14) this.blinkQueue.push({ at: now + 370, value: 0.05 }, { at: now + 480, value: 1 });
  }

  frame(realNow) {
    const realDelta = Math.min(Math.max((realNow - this.lastTime) / 1000, 0), 0.1);
    this.lastTime = realNow;
    let delta = this.paused ? 0 : realDelta * this.playbackRate;
    if (this.pendingStep > 0) {
      delta = this.pendingStep;
      this.pendingStep = 0;
    }
    this.clockTime += delta * 1000;
    const now = this.clockTime;
    this.delta = delta;
    const config = this.getConfig();
    this.svg.dataset.state = this.state;
    this.svg.style.setProperty("--fg", config.color);
    this.svg.style.setProperty("--bg", config.eyeColor);
    this.svg.style.setProperty("--bot-size", `${config.size}px`);
    this.svg.style.transform = config.flipX ? "scaleX(-1)" : "";
    this.updateMorph(now, config);
    this.updateStateTargets(now, config, delta);
    const steps = Math.max(1, Math.ceil(delta / FIXED_STEP));
    const step = delta / steps;
    for (let index = 0; index < steps; index += 1) {
      stepSpring(this.expressionSpring, this.expressionFrequency, 1, step);
      stepSpring(this.rotation, 5, 0.9, step);
      stepSpring(this.headX, 3.5, 1, step);
      stepSpring(this.headY, 4, 1, step);
      stepSpring(this.scaleY, 10, 0.8, step);
      stepSpring(this.eyeOpen, 26, 1, step);
      stepSpring(this.eyeScale, 9, 0.85, step);
      stepSpring(this.aimX, 13, 1, step);
      stepSpring(this.aimY, 13, 1, step);
      stepSpring(this.morph, 14, 1, step);
      stepSpring(this.morphBlend, 11, 1, step);
      stepSpring(this.shapeBlend, 10, 1, step);
      stepSpring(this.turn, 14, 1, step);
      stepSpring(this.notify, 9, 0.55, step);
      stepSpring(this.humming, 6, 1, step);
      if (this.spinSpring) stepSpring(this.spinSpring, 6.2, 1, step);
    }
    if (REDUCE_MOTION.matches) {
      this.expressionSpring.x = 1;
      this.morph.x = this.morph.target;
      this.morphBlend.x = this.morphBlend.target;
      this.shapeBlend.x = this.shapeBlend.target;
      this.turn.x = this.turn.target;
    }
    this.render(now, config);
    if (this.spinSpring && Math.abs(this.spinSpring.target - this.spinSpring.x) < 0.004 && Math.abs(this.spinSpring.v) < 0.015) {
      this.spinSpring = null;
      this.shapeChangeWide = false;
    }
    if (this.spinSpring) this.particleSpinAngle = this.spinSpring.x;
    else if (Math.abs(this.directTurn) > 0.001) this.particleSpinAngle = this.directTurn;
    else if (this.state === "humming" || this.state === "loading") this.particleSpinAngle = this.spinAngle;
    const width = this.svg.getBoundingClientRect().width || 380;
    const sizeScale = clamp((340 / width) ** 0.7, 1, 2.6);
    this.particles.update(now, delta, {
      spinAngle: this.particleSpinAngle,
      sizeScale,
      wideStyle: this.state === "humming" || this.celebrateWildActive || this.shapeChangeWide,
      enabled: config.particlesEnabled !== false,
    });
    this.frameId = requestAnimationFrame(this.boundFrame);
  }

  setPlaybackRate(rate) {
    const numeric = Number(rate);
    this.playbackRate = Number.isFinite(numeric) ? clamp(numeric, 0.1, 4) : 1;
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
    return this.paused;
  }

  togglePaused() {
    return this.setPaused(!this.paused);
  }

  stepFrame(seconds = 1 / 60) {
    this.paused = true;
    this.pendingStep += Math.max(0, Number(seconds) || 1 / 60);
  }

  getSnapshot() {
    return {
      state: this.state,
      expressionIndex: this.expressionIndex,
      eyeOpen: this.eyeOpen.x,
      eyeOpenTarget: this.eyeOpen.target,
      morphEffect: this.morphEffect,
      morphAmount: this.morph.x,
      morphPhase: this.getMorphPhase(),
      elapsed: Math.max(0, (this.clockTime - this.stateStartedAt) / 1000),
      playbackRate: this.playbackRate,
      paused: this.paused,
    };
  }

  getMorphPhase() {
    if (this.morphPreview) return this.morphPreview.phase.toUpperCase();
    if (this.oneShotResting) return "REST";
    if (this.morph.target > 0.5) return this.morph.x < 0.996 ? "ENTER" : "HOLD";
    if (this.morph.x > 0.004) return "EXIT";
    return "IDLE";
  }

  triggerMorphPreview(effect, duration = 2500) {
    if (!MORPH_EFFECTS.includes(effect)) return false;
    this.morphPreview = {
      effect,
      duration: clamp(Number(duration) || 2500, 100, 20000),
      phase: "reset",
      phaseStartedAt: this.clockTime,
    };
    this.oneShotResting = false;
    return true;
  }

  clearMorphPreview() {
    this.morphPreview = null;
  }

  updateMorph(now, config) {
    let requestedEffect = config.morph === "none" ? null : config.morph;
    if (this.morphPreview) {
      const preview = this.morphPreview;
      if (preview.phase === "reset") {
        requestedEffect = null;
        if (this.morph.x < 0.004) {
          preview.phase = "enter";
          preview.phaseStartedAt = now;
          requestedEffect = preview.effect;
        }
      } else if (preview.phase === "enter") {
        requestedEffect = preview.effect;
        if (this.morph.x > 0.996) {
          preview.phase = "hold";
          preview.phaseStartedAt = now;
        }
      } else if (preview.phase === "hold") {
        requestedEffect = preview.effect;
        if (now - preview.phaseStartedAt >= preview.duration) {
          preview.phase = "exit";
          preview.phaseStartedAt = now;
          requestedEffect = null;
        }
      } else if (preview.phase === "exit") {
        requestedEffect = null;
        if (this.morph.x < 0.004) {
          preview.phase = "done";
          preview.phaseStartedAt = now;
        }
      } else requestedEffect = null;
    }
    if (requestedEffect !== this.requestedMorphEffect) {
      this.requestedMorphEffect = requestedEffect;
      this.morphShotStartedAt = now;
      this.oneShotResting = false;
    }
    let visible = Boolean(requestedEffect);
    if (!this.morphPreview && (this.state === "progress" || this.state === "spawning") && requestedEffect) {
      const shot = this.state === "progress" ? 2500 : 2000;
      if (!this.oneShotResting && now - this.morphShotStartedAt > shot) {
        this.oneShotResting = true;
        this.morphRestStartedAt = now;
      } else if (this.oneShotResting && now - this.morphRestStartedAt > 1500) {
        this.oneShotResting = false;
        this.morphShotStartedAt = now;
      }
      visible = !this.oneShotResting;
    }
    this.morph.target = visible ? 1 : 0;

    if (requestedEffect && requestedEffect !== this.morphEffect) {
      if (this.morphEffect && this.morph.x > 0.02) {
        this.previousMorphEffect = this.morphEffect;
        this.morphBlend.x = 0;
        this.morphBlend.v = 0;
        this.morphBlend.target = 1;
      } else {
        this.previousMorphEffect = null;
        this.morphBlend.x = 1;
        this.morphBlend.v = 0;
        this.morphBlend.target = 1;
      }
      this.morphEffect = requestedEffect;
      this.morphStartedAt = now;
    }

    // Keep rendering the outgoing effect until its morph spring has returned
    // to the base character. Clearing it immediately turns an exiting morph
    // (notably thinking's dots) into an unrelated tiny circle for a few frames.
    if (!requestedEffect && this.morph.x < 0.004) {
      this.morphEffect = null;
      this.previousMorphEffect = null;
      this.morphBlend.x = 1;
      this.morphBlend.v = 0;
      this.morphBlend.target = 1;
    }
    if (this.previousMorphEffect && this.morphBlend.x > 0.996) this.previousMorphEffect = null;

    if (visible !== this.morphVisible) {
      if (visible && !REDUCE_MOTION.matches) this.turnDirection = Math.random() < 0.5 ? 1 : -1;
      if (!REDUCE_MOTION.matches) this.turn.target += Math.PI * this.turnDirection;
      this.morphVisible = visible;
    }
  }

  updateStateTargets(now, config, delta) {
    const elapsed = (now - this.stateStartedAt) / 1000;
    const runtime = (now - this.startedAt) / 1000;
    const motion = config.motionScale;
    let eyeOpen = 1;
    let eyeScale = 1;
    let rotation = 0;
    let x = 0;
    let y = 0;
    let scaleY = 1;
    const gesture = REDUCE_MOTION.matches ? this.emptyGesture() : this.updateGestures(now);

    if (REDUCE_MOTION.matches) {
      this.setExpression(config.expressionPool[0] ?? 0);
    } else {
      switch (this.state) {
        case "sleeping": {
          if (config.expressionPool.includes(this.expressionIndex)) eyeOpen = this.expressionSpring.x > 0.85 ? 1 : 0.08;
          else if (elapsed < 1.2) eyeOpen = Math.max(0.08, 1 - Math.min(1, elapsed) * (1 + 0.15 * Math.sin(6.5 * elapsed)));
          else { eyeOpen = 0.08; if (this.eyeOpen.x < 0.18) this.setExpression(13, 11); }
          const settle = Math.min(elapsed / 2, 1);
          const dip = Math.sin(clamp(elapsed / 0.5, 0, 1) * Math.PI);
          rotation = 4 * settle + 2 * Math.sin(0.25 * runtime);
          x = -2 * settle;
          y = 8 * settle + 3 * Math.sin(0.55 * runtime) - 5 * dip;
          scaleY = 1 + 0.016 * Math.sin(0.55 * runtime) + 0.05 * dip;
          break;
        }
        case "waking":
          if (elapsed < 0.5) { eyeOpen = 0.07; this.setExpression(3, 12); y = 6; }
          else if (elapsed < 1.2) {
            eyeOpen = 1; eyeScale = 1.12; y = -5; scaleY = 1.04;
            if (!this.wakeBurst) { this.particles.burst(Math.round(random(9, 13)), 0.8); this.wakeBurst = true; }
          } else if (elapsed < 2.2) {
            if (!this.blinkQueue.length && elapsed < 1.4) this.scheduleBlink(now);
            this.setExpression(0);
          }
          else { const settle = Math.min((elapsed - 2.2) / 0.8, 1); rotation = 6 * Math.sin(settle * Math.PI * 3) * (1 - settle); y = 2 * Math.sin(0.9 * runtime); }
          break;
        case "idle":
          rotation = 1.5 * Math.sin(0.5 * runtime) + 0.6 * Math.sin(0.17 * runtime);
          x = Math.sin(0.27 * runtime); y = 1.2 * Math.sin(0.85 * runtime); scaleY = 1 + 0.007 * Math.sin(0.85 * runtime);
          break;
        case "listening":
          rotation = 8 + 1.5 * Math.sin(0.5 * runtime); x = 2; y = -2 + 0.8 * Math.sin(0.8 * runtime); scaleY = 1.015;
          if (now >= this.listenNodNext) { this.listenNodUntil = now + 380; this.listenNodNext = now + random(1800, 3200); }
          if (now < this.listenNodUntil) { const phase = 1 - (this.listenNodUntil - now) / 380; y += 4.5 * Math.sin(phase * Math.PI); rotation += 2 * Math.sin(phase * Math.PI); }
          break;
        case "thinking":
          rotation = -9 + 5 * Math.sin(0.35 * runtime); x = 5 * Math.sin(0.3 * runtime); y = 2.5 * Math.sin(0.6 * runtime);
          break;
        case "searching": { const wave = Math.sin(1.3 * runtime); rotation = 13 * wave; x = 7 * wave; y = 3 * Math.sin(1.7 * runtime); break; }
        case "working": { const wave = Math.sin(runtime * Math.PI * 3.2); rotation = 4 + 2.5 * wave; x = 3; y = 1.5 + 3 * Math.max(0, wave); scaleY = 1 - 0.02 * Math.max(0, wave); break; }
        case "excited": { const phase = (2.2 * runtime) % 1; y = -10 * Math.sin(phase * Math.PI) + 2; scaleY = phase < 0.1 ? 0.92 : phase < 0.3 ? 1.05 : 1; x = 4 * Math.sin(1.1 * runtime); eyeScale = 1.06; rotation = 7 * Math.sin(runtime * Math.PI * 2.2); break; }
        case "surprised": { const settle = Math.min(elapsed / 1.2, 1); x = -4 * (1 - settle); y = -8 * (1 - settle); scaleY = elapsed < 0.2 ? 1.08 : 1; eyeScale = 1.15 - 0.08 * settle; rotation = 1.5 * Math.sin(11 * runtime) * (1 - settle); break; }
        case "suspicious":
          rotation = -6 + 3 * Math.sin(0.3 * runtime); x = -4 * Math.sin(0.25 * runtime); y = 1 + 1.2 * Math.sin(0.45 * runtime); eyeOpen = 0.85;
          if (now >= this.impulseNext) { this.rotation.v += 30 * Math.PI / 180; this.impulseNext = now + random(4000, 7000); }
          break;
        case "angry":
          if (now >= this.impulseNext) { this.impulseUntil = now + 420; this.headY.v += 70; this.impulseNext = now + random(1800, 3200); }
          rotation = now < this.impulseUntil ? 4.5 * Math.sin(0.05 * now) : 0; y = 3.5; scaleY = 0.975;
          break;
        case "drowsy":
          rotation = 2.5 * Math.sin(0.32 * runtime); x = 1.5 * Math.sin(0.2 * runtime); y = 6 + 2.2 * Math.sin(0.36 * runtime); scaleY = 1 + 0.022 * Math.sin(0.36 * runtime); eyeOpen = 0.34 + 0.07 * Math.sin(0.8 * runtime);
          if (now >= this.listenNodNext && !this.drowsyStartedAt) this.drowsyStartedAt = now;
          if (this.drowsyStartedAt) {
            const phase = (now - this.drowsyStartedAt) / 1000;
            if (phase < 1.7) { const progress = phase / 1.7; const squared = progress ** 2; y = 6 + 19 * squared + 2.2 * Math.sin(progress * Math.PI * 2.5) * (1 - progress); rotation = 10 * squared; eyeOpen = 0.34 - squared * 0.3; scaleY = 1 - 0.045 * squared; }
            else if (phase < 2) { const rebound = Math.sin((phase - 1.7) / 0.3 * Math.PI); y = 25 - 7 * rebound; rotation = 10 - 4 * rebound; eyeOpen = 0.04 + 0.42 * rebound; }
            else if (phase < 3.5) { const progress = (phase - 2) / 1.5; const recovery = 1 - (1 - progress) ** 2.2; y = 25 - 19 * recovery; rotation = 10 * (1 - recovery); eyeOpen = 0.46 - 0.12 * recovery; if (progress > 0.32 && progress < 0.46) eyeOpen = 0.05; }
            else { this.drowsyStartedAt = 0; this.listenNodNext = now + random(1500, 3500); }
          }
          break;
        case "happy": { const wave = Math.sin(2.4 * runtime); rotation = 3 * Math.sin(1.2 * runtime); x = 2.5 * Math.sin(1.1 * runtime); y = -3 * Math.abs(wave); scaleY = 1 + 0.02 * wave; eyeScale = 1.05; break; }
        case "curious":
          rotation = 10 + 6 * Math.sin(0.7 * runtime); x = 5 * Math.sin(0.6 * runtime); y = -2 + 1.5 * Math.sin(0.9 * runtime); scaleY = 1.01; eyeScale = 1.08;
          if (now >= this.listenNodNext) { this.listenNodUntil = now + 440; this.listenNodNext = now + random(1600, 2800); }
          if (now < this.listenNodUntil) { const phase = 1 - (this.listenNodUntil - now) / 440; x += 8 * Math.sin(phase * Math.PI); rotation += 5 * Math.sin(phase * Math.PI); }
          break;
        case "confused": { const wave = Math.sin(0.8 * runtime); rotation = 12 * wave; x = 3 * wave; y = 2 * Math.sin(0.5 * runtime); eyeOpen = 0.9; if (now >= this.impulseNext) { this.rotation.v += 22 * Math.PI / 180; this.impulseNext = now + random(2600, 4200); } break; }
        case "bored":
          rotation = -3 + 4 * Math.sin(0.25 * runtime); x = 4 * Math.sin(0.2 * runtime); y = 5 + 1.5 * Math.sin(0.35 * runtime); scaleY = 0.99; eyeOpen = 0.6; eyeScale = 0.98;
          if (now >= this.impulseNext) { this.impulseUntil = now + 600; this.impulseNext = now + random(4000, 7000); }
          if (now < this.impulseUntil) { const phase = 1 - (this.impulseUntil - now) / 600; scaleY = 1 + 0.05 * Math.sin(phase * Math.PI); y += 3 * Math.sin(phase * Math.PI); }
          break;
        case "proud": rotation = 2.5 * Math.sin(0.4 * runtime); x = 2 * Math.sin(0.35 * runtime); y = -4 + Math.sin(0.6 * runtime); scaleY = 1.03; eyeScale = 1.02; eyeOpen = 0.9; break;
        case "shy": rotation = -8 + 3 * Math.sin(0.5 * runtime); x = -3 + 2 * Math.sin(0.4 * runtime); y = 3; scaleY = 0.98; eyeScale = 0.95; eyeOpen = 0.85; break;
        case "sad": rotation = 3 + 2 * Math.sin(0.3 * runtime); x = 1.5 * Math.sin(0.25 * runtime); y = 7 + Math.sin(0.4 * runtime); scaleY = 0.97; eyeScale = 0.97; eyeOpen = 0.7; break;
        case "laughing": { const wave = Math.sin(runtime * Math.PI * 6.4); rotation = 4 * wave; x = 2 * Math.sin(2 * runtime); y = -5 * Math.abs(wave); scaleY = 1 + 0.03 * wave; eyeOpen = 0.7; break; }
        case "scared": rotation = 2 * Math.sin(0.04 * now); x = -2 + 1.5 * Math.sin(0.05 * now); y = 2 + Math.sin(1.5 * runtime); scaleY = 0.97; eyeScale = 1.12; eyeOpen = 1.05; break;
        case "playful": rotation = 8 * Math.sin(1.4 * runtime); x = 4 * Math.sin(1.1 * runtime); y = -3 * Math.abs(Math.sin(2.2 * runtime)); scaleY = 1 + 0.015 * Math.sin(2.2 * runtime); eyeScale = 1.06; break;
        case "celebrate": {
          y = -2.5 * Math.abs(Math.sin(1.6 * runtime)); eyeScale = 1.1; eyeOpen = 1.1;
          const wild = this.celebratePose(elapsed);
          Object.assign(gesture, wild);
          break;
        }
        case "dragging": { const phase = (elapsed % 3.4) / 3.4; const cycle = Math.floor(elapsed / 3.4); if (phase < 0.12) { x = -16; y = -22; rotation = -5; } else if (phase < 0.62) { x = -16 + 32 * cubicInOut((phase - 0.12) / 0.5); y = -22 + 2 * Math.sin(1.4 * runtime); rotation = 6 * Math.sin(2.6 * runtime); eyeScale = 1.06; } else { if (cycle !== this.dragCycle) { this.dragCycle = cycle; this.headY.v += 90; } x = 16; } break; }
        case "humming": rotation = 2 * Math.sin(0.4 * runtime); x = 1.5 * Math.sin(0.3 * runtime); y = 1.5 * Math.sin(0.7 * runtime); break;
        case "notifying": if (!this.notifyTriggered && elapsed > 0.12) { this.notifyTriggered = true; this.headY.v -= 26; this.scheduleBlink(now); } eyeScale = 1 + 0.05 * Math.exp(-3 * elapsed); rotation = 3; x = 2; y = -1; break;
        default: break;
      }

      var blinkOverride = this.updateExpressionAndBlink(now, config);
      this.updateAim(now, config);
    }

    if (gesture.eyeOpen !== null) eyeOpen = gesture.eyeOpen;
    if (gesture.eyeScale !== null) eyeScale = gesture.eyeScale;
    this.directTurn = gesture.turn;
    this.directRotation = gesture.rotation;
    this.directX = gesture.x;
    this.directY = gesture.y + gesture.bounceY;
    this.directGazeX = gesture.gazeX;
    this.directGazeY = gesture.gazeY;

    this.rotation.target = (rotation * motion + config.headRotation) * Math.PI / 180;
    this.headX.target = x * motion + config.headX;
    this.headY.target = y * motion + config.headY;
    this.scaleY.target = scaleY * config.scaleY;
    this.eyeOpen.target = (blinkOverride ?? eyeOpen) * config.eyeOpen;
    this.eyeScale.target = eyeScale * config.eyeScale;
    this.notify.target = this.state === "notifying" ? 1 : 0;
    this.humming.target = this.state === "humming" ? 1 : 0;

    if ((this.state === "humming" || this.state === "loading") && !REDUCE_MOTION.matches) {
      const speed = elapsed < 0.5 ? 7 * cubicInOut(elapsed / 0.5) : elapsed < 1.3 ? 7 + ((this.state === "loading" ? 3 : 1.6) - 7) * cubicInOut((elapsed - 0.5) / 0.8) : (this.state === "loading" ? 3 : 1.6) + 0.3 * Math.sin(0.5 * elapsed);
      this.spinAngle += speed * delta;
    } else if (this.state !== "celebrate") this.spinAngle *= 0.94;
  }

  updateExpressionAndBlink(now, config) {
    if (this.state !== "waking" && this.state !== "sleeping" && now >= this.expressionNext) {
      const pool = config.expressionPool;
      if (pool.length) {
        const weights = config.expressionWeights || {};
        const customWeights = pool.some((index) => Math.abs((Number(weights[index]) || 1) - 1) > 0.0001);
        if (customWeights && pool.length > 1) {
          const candidates = pool.map((index, position) => ({ position, weight: Math.max(0.01, Number(weights[index]) || 1) }))
            .filter((candidate) => candidate.position !== this.expressionCursor);
          const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
          let pick = Math.random() * total;
          this.expressionCursor = candidates[candidates.length - 1].position;
          for (const candidate of candidates) {
            pick -= candidate.weight;
            if (pick <= 0) { this.expressionCursor = candidate.position; break; }
          }
        } else {
          this.expressionCursor = (this.expressionCursor + 1 + Math.floor(random(0, Math.max(pool.length - 1, 1)))) % pool.length;
        }
        this.setExpression(pool[this.expressionCursor], this.state === "searching" || this.state === "excited" ? 10 : 6);
      }
      this.expressionNext = now + random(config.expressionCadence[0], config.expressionCadence[1]) * config.tempo;
    }
    if (config.blinkCadence && now >= this.blinkNext) {
      this.scheduleBlink(now);
      this.blinkNext = now + random(config.blinkCadence[0], config.blinkCadence[1]) * config.tempo;
    }
    while (this.blinkQueue.length && now >= this.blinkQueue[0].at) this.blinkTarget = this.blinkQueue.shift().value;
    if (this.blinkQueue.length) return this.blinkTarget;
    if (this.blinkTarget !== null) {
      const finalValue = this.blinkTarget;
      this.blinkTarget = null;
      return finalValue;
    }
    return null;
  }

  updateAim(now, config) {
    if (now < this.gazeNext) return;
    const direction = () => Math.random() < 0.5 ? -1 : 1;
    let x = 0;
    let y = 0;
    let min = 2500;
    let max = 5000;
    switch (this.state) {
      case "idle": min = 2500; max = 5500; break;
      case "listening": x = 15 * random(-0.3, 0.3); y = 9 * random(-0.25, 0.25); min = 2200; max = 4200; break;
      case "thinking": x = direction() * random(0.5, 1) * 15; y = -9 * random(0.4, 1); min = 1500; max = 2800; break;
      case "searching": x = direction() * random(0.7, 1) * 15; y = 9 * random(-1, 1); min = 550; max = 1150; break;
      case "working": x = 15 * random(-0.4, 0.4); y = 9 * random(0.4, 1); min = 1200; max = 2400; break;
      case "excited": x = 15 * random(-1, 1); y = 9 * random(-1, 0.3); min = 700; max = 1400; break;
      case "surprised": min = 1600; max = 2600; break;
      case "suspicious": x = 15 * direction(); y = 2.7; min = 2200; max = 4200; break;
      case "angry": x = 15 * random(-0.2, 0.2); y = 1.8; min = 1800; max = 3200; break;
      case "drowsy": x = 15 * random(-0.4, 0.4); y = 9 * random(0.4, 1); min = 2500; max = 4500; break;
      case "happy": x = 15 * random(-0.7, 0.7); y = -9 * random(0, 0.6); min = 1800; max = 3400; break;
      case "curious": x = direction() * random(0.6, 1) * 15; y = 9 * random(-1, 1); min = 950; max = 1900; break;
      case "confused": x = direction() * random(0.5, 1) * 15; y = 9 * random(-0.6, 1); min = 1100; max = 2300; break;
      case "bored": x = direction() * random(0.7, 1) * 15; y = 9 * random(0.4, 0.9); min = 3000; max = 6000; break;
      case "proud": x = 15 * random(-0.3, 0.3); y = -9 * random(0.3, 0.7); min = 2600; max = 4600; break;
      case "shy": x = direction() * random(0.6, 1) * 15; y = 9 * random(0.5, 1); min = 2000; max = 4000; break;
      case "sad": x = 15 * random(-0.3, 0.3); y = 9 * random(0.6, 1); min = 2800; max = 5000; break;
      case "laughing": x = 15 * random(-0.5, 0.5); y = -9 * random(0.2, 0.6); min = 800; max = 1700; break;
      case "scared": x = direction() * random(0.7, 1) * 15; y = 9 * random(-0.6, 0.6); min = 450; max = 1050; break;
      case "playful": x = direction() * random(0.5, 1) * 15; y = -9 * random(0, 0.6); min = 900; max = 1800; break;
      case "notifying": { const focused = Math.random() < 0.72; x = (focused ? 0.45 : 0.1) * 15; y = -9 * (focused ? 0.3 : 0.05); min = 1200; max = 2400; break; }
      default: x = 15 * random(-0.4, 0.4); y = 9 * random(-0.3, 0.3);
    }
    this.aimX.target = x * config.gazeScale;
    this.aimY.target = y * config.gazeScale;
    this.gazeNext = now + random(min, max) * config.tempo;
  }

  emptyGesture() {
    return { turn: 0, rotation: 0, x: 0, y: 0, bounceY: 0, gazeX: 0, gazeY: 0, eyeOpen: null, eyeScale: null };
  }

  startSpin(turns = 1, direction = Math.random() < 0.5 ? 1 : -1) {
    if (this.spinSpring) return false;
    this.spinSpring = { x: 0, v: 0, target: turns * Math.PI * 2 * direction };
    return true;
  }

  startGesture(kind) {
    if (this.gesture || this.spinSpring) return;
    const turns = kind === "spinDizzy" ? Math.round(random(3, 4)) : 1;
    this.gesture = { kind, startedAt: this.clockTime, direction: Math.random() < 0.5 ? 1 : -1, turns };
  }

  startBounce(now) {
    if (this.bounceStartedAt < 0) this.bounceStartedAt = now;
  }

  updateGestures(now) {
    const output = this.emptyGesture();
    if (["idle", "happy", "excited", "curious", "playful"].includes(this.state) && now >= this.winkNext) {
      this.winkAt = now;
      this.winkEye = Math.random() < 0.5 ? 0 : 1;
      this.winkNext = now + random(4500, 10000);
    }
    if (now >= this.behaviorNext && !this.gesture && !this.spinSpring) {
      if (this.state === "searching") { this.startSpin(); this.behaviorNext = now + random(4000, 7000); }
      else if (this.state === "working") { this.startSpin(1, 1); this.behaviorNext = now + random(6000, 9000); }
      else if (this.state === "excited") { this.startSpin(1); this.behaviorNext = now + random(2800, 5000); }
      else if (this.state === "playful") { this.startSpin(1); this.behaviorNext = now + random(3500, 6000); }
    }
    if (now >= this.ambientNext) {
      if (!this.gesture && !this.spinSpring) {
        const roll = Math.random();
        if (["happy", "excited", "proud"].includes(this.state)) roll < 0.55 ? this.startSpin(1) : this.startGesture("spinBounce");
        else if (this.state === "playful") {
          if (roll < 0.34) this.startGesture("spinBounce");
          else if (roll < 0.62) this.startBounce(now);
          else if (roll < 0.86) this.startGesture("spinDizzy");
          else this.startSpin(1);
        }
      }
      this.ambientNext = now + random(9000, 18000);
    }
    if (this.gesture) {
      const elapsed = (now - this.gesture.startedAt) / 1000;
      const { kind, direction, turns } = this.gesture;
      if (kind === "spinBounce") {
        if (elapsed < 0.7) output.turn = turns * Math.PI * 2 * direction * cubicInOut(elapsed / 0.7);
        else { this.startBounce(now); this.gesture = null; }
      } else if (kind === "spinDizzy") {
        const spinDuration = 0.55 + 0.16 * turns;
        if (elapsed < spinDuration) output.turn = turns * Math.PI * 2 * direction * (elapsed / spinDuration) ** 2;
        else if (elapsed < spinDuration + 1.5) {
          const shakeTime = elapsed - spinDuration;
          const envelope = (1 - shakeTime / 1.5) ** 1.3;
          output.rotation = 17 * Math.sin(10 * shakeTime) * direction * envelope;
          output.x = 10 * Math.cos(10 * shakeTime) * direction * envelope;
          output.y = 3 * Math.sin(20 * shakeTime) * envelope;
          output.eyeOpen = 0.46 + 0.14 * Math.sin(21 * shakeTime);
          output.eyeScale = 1.03;
        } else this.gesture = null;
      }
    }
    if (this.bounceStartedAt >= 0) {
      const sequence = [{ h: 48, d: 0.5 }, { h: 28, d: 0.382 }, { h: 14, d: 0.27 }, { h: 6, d: 0.177 }];
      let elapsed = (now - this.bounceStartedAt) / 1000;
      let step = 0;
      while (step < sequence.length && elapsed >= sequence[step].d) { elapsed -= sequence[step].d; step += 1; }
      if (step >= sequence.length) this.bounceStartedAt = -1;
      else { const phase = elapsed / sequence[step].d; output.bounceY = -4 * sequence[step].h * phase * (1 - phase); }
    }
    return output;
  }

  celebratePose(elapsed) {
    const output = this.emptyGesture();
    this.celebrateWildActive = false;
    const activeElapsed = elapsed - 0.14;
    if (activeElapsed < 0) return output;
    const cycleIndex = Math.floor(activeElapsed / 6.2);
    if (cycleIndex !== this.celebrateCycle) {
      this.celebrateCycle = cycleIndex;
      this.turnDirection = Math.random() < 0.5 ? 1 : -1;
    }
    const cycle = activeElapsed % 6.2;
    if (cycle > 5.49 || REDUCE_MOTION.matches) return output;
    this.celebrateWildActive = true;
    const turns = 9;
    const direction = this.turnDirection;
    const speed = (turns * Math.PI * 2 + 0.5) / (0.15 + 2 + 0.3125);
    let angle;
    if (cycle < 0.24) angle = -0.25 * (1 - Math.cos(cycle / 0.24 * Math.PI));
    else if (cycle < 0.54) { const time = cycle - 0.24; angle = -0.5 + speed * time ** 2 / 0.6; }
    else if (cycle < 2.54) angle = -0.5 + speed * (0.15 + cycle - 0.54);
    else if (cycle < 3.79) angle = -0.5 + speed * 2.15 + 1.25 * speed * (1 - (1 - (cycle - 2.54) / 1.25) ** 4) / 4;
    else angle = turns * Math.PI * 2;
    output.turn = angle * direction;
    let envelope = 0;
    if (cycle > 2.54) {
      const progress = Math.min((cycle - 2.54) / 1.25, 1);
      envelope = progress < 0.4 ? 0 : ((progress - 0.4) / 0.6) ** 2;
      if (cycle >= 3.79) envelope = Math.max(0, (1 - (cycle - 3.79) / 1.7) ** 1.6);
    }
    const shakeTime = Math.max(cycle - 2.54, 0);
    output.rotation = angle / (turns * Math.PI * 2) * 1080 * direction + 11 * Math.sin(9.2 * shakeTime) * direction * envelope;
    output.x = (Math.cos(9.2 * shakeTime) - 1) * 6 * direction * envelope;
    output.y = 2.6 * Math.sin(18.4 * shakeTime) * envelope;
    output.gazeX = 13 * Math.sin(11.5 * shakeTime) * direction * envelope;
    output.gazeY = (Math.cos(9 * shakeTime) - 1) * 3.5 * envelope;
    output.eyeOpen = 1.14 - 0.44 * envelope + 0.1 * Math.sin(16 * shakeTime) * envelope;
    output.eyeScale = 1.12 - 0.09 * envelope;
    return output;
  }

  triggerShapeChangeMotion() {
    if (REDUCE_MOTION.matches) return;
    this.shapeChangeCycle = (this.shapeChangeCycle + 1) % 5;
    if (this.shapeChangeCycle === 0) this.startSpin(1);
    else if (this.shapeChangeCycle === 1) this.shapeChangeWide = this.startSpin(2);
    else if (this.shapeChangeCycle === 2) this.startGesture("spinBounce");
    else if (this.shapeChangeCycle === 3) this.startGesture("spinDizzy");
    else {
      this.startSpin(1);
      this.particles.burst(16, 0.95, 0.3);
    }
  }

  resolveShape(shapeId) {
    const requestedId = SHAPES[shapeId] ? shapeId : "blob";
    if (requestedId !== this.shapeId) {
      const previous = SHAPES[this.shapeId];
      const currentAmount = cubicInOut(clamp(this.shapeBlend.x, 0, 1));
      this.shapeFromRing = currentAmount >= 1
        ? previous.ring
        : lerpRing(this.shapeFromRing, previous.ring, currentAmount);
      this.shapeFromFace = currentAmount >= 1
        ? previous.face
        : lerpFace(this.shapeFromFace, previous.face, currentAmount);
      this.shapeFromTiltScale += (previous.tiltScale - this.shapeFromTiltScale) * currentAmount;
      this.shapeFromBeltRadius += (previous.beltRadius - this.shapeFromBeltRadius) * currentAmount;
      this.shapeId = requestedId;
      this.shapeBlend.x = 0;
      this.shapeBlend.v = 0;
      this.shapeBlend.target = 1;
      this.triggerShapeChangeMotion();
    }

    const shape = SHAPES[this.shapeId];
    const amount = cubicInOut(clamp(this.shapeBlend.x, 0, 1));
    const transitioning = amount < 0.999;
    return {
      shape,
      transitioning,
      ring: transitioning ? lerpRing(this.shapeFromRing, shape.ring, amount) : shape.ring,
      face: transitioning ? lerpFace(this.shapeFromFace, shape.face, amount) : shape.face,
      tiltScale: transitioning
        ? this.shapeFromTiltScale + (shape.tiltScale - this.shapeFromTiltScale) * amount
        : shape.tiltScale,
      beltRadius: transitioning
        ? this.shapeFromBeltRadius + (shape.beltRadius - this.shapeFromBeltRadius) * amount
        : shape.beltRadius,
    };
  }

  render(now, config) {
    const geometry = this.resolveShape(config.shape);
    const shape = geometry.shape;
    const effectiveShape = {
      ...shape,
      face: geometry.face,
      tiltScale: geometry.tiltScale,
      beltRadius: geometry.beltRadius,
      top: geometry.transitioning ? Math.min(...geometry.ring.map((point) => point[1])) : shape.top,
      bottom: geometry.transitioning ? Math.max(...geometry.ring.map((point) => point[1])) : shape.bottom,
      spanSamples: geometry.transitioning ? null : shape.spanSamples,
    };
    const morphAmount = clamp(this.morph.x, 0, 1);
    this.currentBeltRadius = geometry.beltRadius + (this.state === "loading" ? (52 - geometry.beltRadius) * morphAmount : 0);
    const morphBlend = clamp(this.morphBlend.x, 0, 1);
    const previousMorphEffect = morphBlend < 0.999 ? this.previousMorphEffect : null;
    const morphIsTurning = this.morph.x > 0.001 || Math.abs(this.turn.target - this.turn.x) > 0.01;
    const morphTurn = morphIsTurning ? this.turn.x : 0;
    const turnAngle = morphTurn + (this.spinSpring?.x ?? 0) + this.directTurn;
    const baseShapeRing = geometry.ring;
    const shapeRing = Math.abs(turnAngle) > 0.001 && !geometry.transitioning ? turnedShapeRing(shape, turnAngle) : baseShapeRing;
    const activeMorphRing = this.morphEffect === "pencil" ? PENCIL_RING : CIRCLE_RING;
    const previousMorphRing = previousMorphEffect === "pencil" ? PENCIL_RING : CIRCLE_RING;
    const morphRing = previousMorphEffect
      ? lerpRing(previousMorphRing, activeMorphRing, cubicInOut(morphBlend))
      : activeMorphRing;
    const morphPathAmount = clamp(morphAmount / 0.62, 0, 1);
    const headRing = morphPathAmount <= 0 ? shapeRing : lerpRing(shapeRing, morphRing, cubicInOut(morphPathAmount));
    const headPath = morphPathAmount <= 0
      ? geometry.transitioning || (Math.abs(turnAngle) > 0.001 && (shape.solid || shape.sides)) ? ringOutline(shapeRing) : shape.path
      : ringOutline(headRing);
    this.head.setAttribute("d", headPath);
    this.clipHead.setAttribute("d", headPath);

    this.renderEyes(now, config, effectiveShape, shapeRing, turnAngle, morphAmount);
    const effect = this.morphEffect;
    const activeMorphSize = effect ? MORPH_SIZES[effect] : 19;
    const previousMorphSize = previousMorphEffect ? MORPH_SIZES[previousMorphEffect] : activeMorphSize;
    const morphSize = activeMorphSize * morphBlend + previousMorphSize * (1 - morphBlend);
    const morphScale = morphSize / HEAD_C;
    const effectPose = this.renderMorphEffects(morphAmount, morphBlend, previousMorphEffect, morphSize, now);
    this.renderHummingMarkers(effectiveShape);
    const normal = 1 - morphAmount;
    const translateX = this.headX.x * normal + this.directX * normal + effectPose.x;
    const translateY = this.headY.x * normal + this.directY * normal + effectPose.y;
    const rotation = this.rotation.x * 180 / Math.PI * geometry.tiltScale * normal + this.directRotation * normal + effectPose.rotation;
    const scaleX = config.scaleX * normal + morphScale * effectPose.scale * morphAmount;
    const scaleY = this.scaleY.x * normal + morphScale * effectPose.scale * morphAmount;
    this.transformGroup.setAttribute("transform", `translate(${(HEAD_C + translateX).toFixed(2)} ${(HEAD_C + translateY).toFixed(2)}) rotate(${rotation.toFixed(2)}) scale(${scaleX.toFixed(4)} ${scaleY.toFixed(4)}) translate(${-HEAD_C} ${-HEAD_C})`);
    this.transformGroup.style.opacity = effectPose.opacity.toFixed(3);

    const badgeAmount = clamp(this.notify.x, 0, 1.4);
    if (badgeAmount <= 0.01) this.badge.hidden = true;
    else {
      const badgeAnchor = shapeRing[Math.round(7 * shapeRing.length / 8) % shapeRing.length];
      this.badge.hidden = false;
      this.badge.setAttribute("fill", config.badgeColor);
      this.badge.setAttribute("stroke", config.eyeColor);
      this.badge.setAttribute("stroke-width", "10");
      this.badge.setAttribute("cx", badgeAnchor[0].toFixed(1));
      this.badge.setAttribute("cy", badgeAnchor[1].toFixed(1));
      this.badge.setAttribute("r", (20 * config.badgeScale * badgeAmount).toFixed(2));
    }

    const width = this.svg.getBoundingClientRect().width || 380;
    const responsive = 1 - smoothstep(clamp((width - 44) / 90, 0, 1));
    const activeExpansion = effect ? MORPH_VIEWBOX[effect] : 1;
    const previousExpansion = previousMorphEffect ? MORPH_VIEWBOX[previousMorphEffect] : activeExpansion;
    const expansion = activeExpansion * morphBlend + previousExpansion * (1 - morphBlend);
    const radius = 129.5 / (1 + (expansion - 1) * morphAmount * responsive);
    this.svg.setAttribute("viewBox", `${(114.5 - radius).toFixed(2)} ${(114.5 - radius).toFixed(2)} ${(2 * radius).toFixed(2)} ${(2 * radius).toFixed(2)}`);
  }

  renderEyes(now, config, shape, shapeRing, turnAngle, morphAmount) {
    const amount = clamp(this.expressionSpring.x, 0, 1);
    const eyeRings = [
      lerpRing(this.expressionFrom[0], this.expressionTo[0], amount),
      lerpRing(this.expressionFrom[1], this.expressionTo[1], amount),
    ];
    const centers = eyeRings.map(centroid);
    const face = shape.face;
    let top = shape.top;
    let bottom = shape.bottom;
    if (Math.abs(turnAngle) > 0.001) {
      top = Math.min(...shapeRing.map((point) => point[1]));
      bottom = Math.max(...shapeRing.map((point) => point[1]));
    }
    let leftHalf = 0;
    let rightHalf = 0;
    for (const point of eyeRings[0]) leftHalf = Math.max(leftHalf, Math.abs(point[0] - centers[0][0]));
    for (const point of eyeRings[1]) rightHalf = Math.max(rightHalf, Math.abs(point[0] - centers[1][0]));
    const distance = Math.abs(centers[1][0] - centers[0][0]) * face.sx;
    const fit = leftHalf + rightHalf > 0.5 ? clamp((distance - 5) / (leftHalf + rightHalf), 0.35, 4) : 4;

    if (config.pointer && this.pointer.active) {
      const bounds = this.svg.getBoundingClientRect();
      const flip = config.flipX ? -1 : 1;
      this.pointer.targetX = 22 * clamp((this.pointer.clientX - (bounds.left + bounds.width / 2)) / bounds.width, -0.6, 0.6) * flip;
      this.pointer.targetY = 14 * clamp((this.pointer.clientY - (bounds.top + bounds.height / 2)) / bounds.height, -0.6, 0.6);
    } else { this.pointer.targetX = 0; this.pointer.targetY = 0; }
    const smoothing = 1 - Math.exp(60 * Math.log(0.91) * (this.delta || 1 / 60));

    for (let index = 0; index < 2; index += 1) {
      this.pointer.x += (this.pointer.targetX - this.pointer.x) * smoothing;
      this.pointer.y += (this.pointer.targetY - this.pointer.y) * smoothing;
      const element = this.eyes[index];
      const ring = eyeRings[index];
      const [centerX, centerY] = centers[index];
      element.setAttribute("d", ringPath(ring));
      let localCenter = HEAD_C + face.x;
      let offsetX = (centerX - HEAD_C) * face.sx;
      let perspectiveX = 1;
      let visible = true;
      let perspectiveFade = 1;
      if (Math.abs(turnAngle) > 0.001) {
        const [left, right] = spanAt(shapeRing, clamp(HEAD_C + face.y + (centerY - HEAD_C) * face.sy, top + 2, bottom - 2));
        const radius = Math.max((right - left) / 2, 12);
        localCenter = (left + right) / 2;
        const initial = Math.asin(clamp(offsetX / radius, -1, 1));
        const turned = initial + turnAngle;
        const cosine = Math.cos(turned);
        const baseCosine = Math.max(Math.cos(initial), 0.02);
        visible = cosine > 0.02;
        perspectiveX = Math.max(cosine, 0.02) / baseCosine;
        offsetX = radius * Math.sin(turned);
        perspectiveFade = smoothstep(clamp(cosine / 0.5, 0, 1));
      }
      const pulse = 1 + 0.07 * Math.sin(amount * Math.PI);
      let driftX = 1.4 * Math.sin(0.00042 * now + index) + 0.5 * Math.sin(0.001 * now + 2 * index);
      let driftY = 0.9 * Math.sin(0.00058 * now + index);
      const autonomousGazeWeight = config.pointer && this.pointer.active ? 0.2 : 1;
      driftX += this.pointer.x + this.aimX.x * autonomousGazeWeight + this.directGazeX;
      driftY += this.pointer.y + this.aimY.x * autonomousGazeWeight + this.directGazeY;
      const notification = clamp(this.notify.x, 0, 1);
      driftX -= 10 * notification;
      driftY += 7 * notification;
      const eyeScale = Math.min(clamp(this.eyeScale.x, 0.2, 2) * face.eye, fit / pulse);
      const scaleX = clamp(perspectiveX * eyeScale * pulse, 0.02, 2.4);
      let winkScale = 1;
      if (index === this.winkEye && now < this.winkAt + 320) {
        const phase = (now - this.winkAt) / 320;
        winkScale = Math.max(phase < 0.42 ? 1 - phase / 0.42 : (phase - 0.42) / 0.58, 0.04);
      }
      const scaleY = clamp(Math.max(this.eyeOpen.x * winkScale, 0.04) * eyeScale * pulse, 0.02, 2.4);
      element.style.display = visible && morphAmount < 0.5 ? "" : "none";
      const halfHeight = EYE_HALF * scaleY + 2;
      const y = clamp(HEAD_C + face.y + (centerY + driftY - HEAD_C) * face.sy, top + halfHeight, bottom - halfHeight);
      let maxLeft = -Infinity;
      let minRight = Infinity;
      for (let point = 0; point < ring.length; point += 2) {
        const scaledX = (ring[point][0] - centerX) * scaleX;
        const sampleY = y + (ring[point][1] - centerY) * scaleY;
        const [left, right] = Math.abs(turnAngle) > 0.001 ? spanAt(shapeRing, sampleY) : shapeSpanAt(shape, sampleY);
        maxLeft = Math.max(maxLeft, left - scaledX);
        minRight = Math.min(minRight, right - scaledX);
      }
      const desired = localCenter + offsetX + driftX * face.sx;
      const bounded = maxLeft <= minRight ? clamp(desired, maxLeft, minRight) : (maxLeft + minRight) / 2;
      let finalX = bounded + (desired - bounded) * (1 - perspectiveFade);
      let finalY = y;
      if (notification > 0.01) {
        const badgeAnchor = shapeRing[Math.round(7 * shapeRing.length / 8) % shapeRing.length];
        const dx = finalX - badgeAnchor[0];
        const dy = finalY - badgeAnchor[1];
        const distance = Math.hypot(dx, dy) || 1;
        const directionX = dx / distance;
        const directionY = dy / distance;
        const eyeHalf = index === 0 ? leftHalf : rightHalf;
        const needed = 20 * clamp(this.notify.x, 0, 1.4) + Math.hypot(eyeHalf * scaleX * directionX, EYE_HALF * scaleY * directionY) + 5;
        if (distance < needed) {
          finalX += directionX * (needed - distance);
          finalY += directionY * (needed - distance);
        }
      }
      element.setAttribute("transform", `translate(${finalX.toFixed(2)} ${finalY.toFixed(2)}) scale(${scaleX.toFixed(4)} ${scaleY.toFixed(4)}) translate(${(-centerX).toFixed(2)} ${(-centerY).toFixed(2)})`);
    }
  }

  createMorphLayer(effect) {
    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute("class", "morph-effect-layer");
    group.setAttribute("data-morph-effect", effect);
    const create = (tag, className, count) => Array.from({ length: count }, () => {
      const element = document.createElementNS(SVG_NS, tag);
      element.setAttribute("class", className);
      if (tag === "circle") {
        element.setAttribute("cx", HEAD_C);
        element.setAttribute("cy", HEAD_C);
        element.setAttribute("r", 0);
      }
      element.hidden = true;
      group.appendChild(element);
      return element;
    });
    const layer = {
      group,
      heads: create("path", "grok-bot-mark__head morph-head", 2),
      rings: create("circle", "morph-ring", 5),
      parts: create("circle", "grok-bot-mark__head morph-part", 5),
      glyphs: create("path", "morph-glyph", 3),
    };
    this.svg.insertBefore(group, this.transformGroup);
    this.morphLayers.set(effect, layer);
    return layer;
  }

  useMorphLayer(layer) {
    this.morphHeads = layer.heads;
    this.rings = layer.rings;
    this.parts = layer.parts;
    this.glyphs = layer.glyphs;
  }

  hideMorphElements() {
    for (const element of [...this.morphHeads, ...this.rings, ...this.parts, ...this.glyphs]) element.hidden = true;
  }

  renderHummingMarkers(shape) {
    const amount = clamp(this.humming.x, 0, 1);
    if (amount <= 0.01) return;
    for (let index = 0; index < 2; index += 1) {
      const element = this.parts[3 + index];
      const angle = 0.85 * this.spinAngle + index * Math.PI;
      const radius = 1.3 * shape.radius;
      const depth = 0.55 + 0.45 * clamp((Math.cos(angle) + 1) / 2, 0, 1);
      element.hidden = false;
      element.setAttribute("cx", (HEAD_C + radius * Math.sin(angle)).toFixed(1));
      element.setAttribute("cy", (HEAD_C - 0.38 * radius * Math.cos(angle) - 8).toFixed(1));
      element.setAttribute("r", (7.5 * depth * amount).toFixed(2));
      element.setAttribute("opacity", ((0.3 + 0.7 * depth) * amount).toFixed(3));
    }
  }

  renderMorphEffects(morphAmount, morphBlend, previousMorphEffect, morphSize, now) {
    this.useMorphLayer(this.baseMorphLayer);
    this.hideMorphElements();
    for (const layer of this.morphLayers.values()) layer.group.hidden = true;
    const pose = { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 };
    if (!this.morphEffect || morphAmount <= 0.004) return pose;

    const effectAmount = (effect) => {
      if (effect === this.morphEffect) return morphAmount * morphBlend;
      if (effect === previousMorphEffect) return morphAmount * (1 - morphBlend);
      return 0;
    };
    const elapsed = now - this.stateStartedAt;

    for (const effect of MORPH_EFFECTS) {
      const amount = effectAmount(effect);
      if (amount <= 0.004) continue;
      const layer = this.morphLayers.get(effect) || this.createMorphLayer(effect);
      layer.group.hidden = false;
      this.useMorphLayer(layer);
      this.hideMorphElements();
      switch (effect) {
        case "dots": {
          this.renderDots(amount, now);
          const distance = Math.abs(((((now - this.morphStartedAt) / 1400 + 0.119) % 1 + 1) % 1) - 1 / 3);
          const pulseDistance = Math.min(distance, 1 - distance);
          const pulse = REDUCE_MOTION.matches ? 1 : Math.exp(-(pulseDistance ** 2) / 0.045);
          const pop = REDUCE_MOTION.matches ? 1 : 0.84 + 0.22 * pulse;
          pose.scale *= 1 + (pop - 1) * (amount / Math.max(morphAmount, 0.001));
          pose.y -= REDUCE_MOTION.matches ? 0 : 9 * pulse * amount * morphAmount;
          pose.opacity *= 1 - (REDUCE_MOTION.matches ? 0 : 0.5 * (1 - pulse)) * amount;
          break;
        }
        case "orbit": this.renderOrbit(amount, now); break;
        case "radar": this.renderRadar(amount, now, morphSize); break;
        case "progress": this.renderProgress(amount, now); break;
        case "gather": this.renderGather(amount, now); break;
        case "wave": this.renderWave(amount, now); break;
        case "send": {
          this.renderSend(amount, now);
          const phase = ((((elapsed / 1500) % 1) + 1) % 1);
          pose.scale *= 1 + (phase < 0.18 ? -0.06 * Math.sin(phase / 0.18 * Math.PI) : phase < 0.42 ? 0.05 * Math.sin((phase - 0.18) / 0.24 * Math.PI) : 0) * amount;
          break;
        }
        case "receive": {
          this.renderReceive(amount, now);
          const phase = clamp((((((elapsed / 1700) % 1) + 1) % 1) - 0.58) / 0.34, 0, 1);
          pose.scale *= 1 + 0.11 * Math.sin(phase * Math.PI) * amount;
          break;
        }
        case "dock": this.renderDock(amount, now); break;
        case "pencil": {
          const pencil = this.renderPencil(amount, now);
          pose.x += pencil.x * amount * morphAmount;
          pose.y += pencil.y * amount * morphAmount;
          pose.rotation += pencil.rotation * amount * morphAmount;
          break;
        }
        case "bang":
          this.renderBang(amount, now);
          pose.y += 58 * amount * morphAmount;
          pose.scale *= 1 + 0.04 * Math.exp(-((elapsed / 1000 % 2.2) * 5.5)) * amount;
          break;
        case "standby":
          this.renderStandby(amount, now);
          pose.opacity *= 1 - (0.28 + 0.2 * Math.sin(0.0016 * now)) * amount;
          break;
        case "whirl":
          pose.x += (2 * Math.sin(0.0009 * now) + 0.8 * Math.sin(0.0017 * now)) * amount * morphAmount;
          pose.y += (2.4 * Math.sin(0.0013 * now) + 1.2 * Math.sin(0.0006 * now)) * amount * morphAmount;
          break;
        case "ball": {
          const seconds = elapsed / 1000;
          const gravity = 416 / 0.3844;
          const fall = Math.sqrt(80 / gravity);
          const cycle = ((((seconds - fall) / 0.62) % 1 + 1) % 1);
          const height = seconds < fall ? 40 - 0.5 * gravity * seconds ** 2 : 208 * cycle * (1 - cycle);
          pose.y += (40 - height) * amount * morphAmount;
          break;
        }
        default: break;
      }
    }
    this.useMorphLayer(this.baseMorphLayer);
    return pose;
  }

  renderDots(amount, now) {
    const anchors = [HEAD_C - 62, HEAD_C + 62];
    for (let index = 0; index < 2; index += 1) {
      const element = this.morphHeads[index];
      const phase = clamp((amount - 0.12 * index) / (1 - 0.12 * index), 0, 1);
      if (phase <= 0.004) continue;
      const grow = cubicOut(phase);
      const enter = backOut(phase);
      const pulseDistance = Math.abs(((((now - this.morphStartedAt) / 1400 + 0.119) % 1 + 1) % 1) - index * 2 / 3);
      const distance = Math.min(pulseDistance, 1 - pulseDistance);
      const pulse = REDUCE_MOTION.matches ? 1 : Math.exp(-(distance ** 2) / 0.045);
      const lift = REDUCE_MOTION.matches ? 0 : 9 * pulse * amount;
      const pop = REDUCE_MOTION.matches ? 1 : 0.84 + 0.22 * pulse;
      const scale = 22 * grow * pop / HEAD_C * 1.02;
      element.hidden = false;
      element.setAttribute("d", CIRCLE_PATH);
      element.setAttribute("transform", `translate(${(HEAD_C + (anchors[index] - HEAD_C) * enter).toFixed(1)} ${(HEAD_C - lift).toFixed(1)}) scale(${scale.toFixed(4)}) translate(${-HEAD_C} ${-HEAD_C})`);
      element.setAttribute("opacity", (grow * (1 - 0.5 * (1 - pulse))).toFixed(3));
    }
  }

  renderOrbit(amount, now) {
    const radius = 52 * backOut(amount);
    for (let index = 0; index < 5; index += 1) {
      const element = this.parts[index];
      const phase = 0.0017 * now + index * Math.PI * 2 / 5;
      const cosine = Math.cos(phase);
      const depth = 0.5 + 0.5 * clamp(cosine, 0, 1);
      element.hidden = false;
      element.setAttribute("cx", (HEAD_C + radius * Math.sin(phase)).toFixed(1));
      element.setAttribute("cy", (HEAD_C - 0.42 * radius * Math.cos(phase)).toFixed(1));
      element.setAttribute("r", Math.max(12 * depth * cubicOut(amount), 0.3).toFixed(2));
      element.setAttribute("opacity", (clamp((cosine + 0.4) / 0.6, 0.18, 1) * cubicOut(amount)).toFixed(3));
    }
  }

  renderRadar(amount, now, baseRadius) {
    for (let index = 0; index < 3; index += 1) {
      const element = this.rings[index];
      const phase = ((now / 1300 + index / 3) % 1 + 1) % 1;
      element.hidden = false;
      element.setAttribute("fill", "none");
      element.setAttribute("stroke", "var(--fg)");
      element.setAttribute("r", (baseRadius + (104 - baseRadius) * phase).toFixed(1));
      element.setAttribute("stroke-width", (3.4 * (1 - 0.55 * phase)).toFixed(2));
      element.setAttribute("opacity", (cubicOut(amount) * (1 - phase) * 0.9).toFixed(3));
    }
  }

  renderProgress(amount, now) {
    const radius = 62 * backOut(amount);
    const track = this.rings[3];
    const value = this.rings[4];
    track.hidden = false;
    track.setAttribute("fill", "none"); track.setAttribute("stroke", "var(--fg)"); track.setAttribute("r", radius.toFixed(1)); track.setAttribute("stroke-width", "5"); track.setAttribute("opacity", (0.16 * cubicOut(amount)).toFixed(3));
    const progress = clamp((now - this.morphShotStartedAt) / 2500 / 0.85, 0, 1);
    const circumference = 2 * Math.PI * radius;
    value.hidden = false;
    value.setAttribute("fill", "none"); value.setAttribute("stroke", "var(--fg)"); value.setAttribute("r", radius.toFixed(1)); value.setAttribute("stroke-width", "5"); value.setAttribute("stroke-dasharray", circumference.toFixed(1)); value.setAttribute("stroke-dashoffset", (circumference * (1 - progress)).toFixed(1)); value.setAttribute("transform", `rotate(-90 ${HEAD_C} ${HEAD_C})`); value.setAttribute("opacity", cubicOut(amount).toFixed(3));
  }

  renderGather(amount, now) {
    for (let index = 0; index < 5; index += 1) {
      const element = this.parts[index];
      const phase = clamp(((now - this.morphShotStartedAt) / 2000 - 0.09 * index) / 0.62, 0, 1);
      if (phase >= 1) continue;
      const settle = 1 - (1 - phase) ** 3;
      const angle = 2.4 * index + 2.2 * phase;
      const radius = 96 * (1 - settle);
      element.hidden = false;
      element.setAttribute("cx", (HEAD_C + radius * Math.cos(angle)).toFixed(1));
      element.setAttribute("cy", (HEAD_C + radius * Math.sin(angle) * 0.8).toFixed(1));
      element.setAttribute("r", (9 * (0.5 + 0.5 * settle) * cubicOut(amount)).toFixed(2));
      element.setAttribute("opacity", (cubicOut(amount) * clamp(5 * phase, 0, 1) * (1 - 0.25 * settle)).toFixed(3));
    }
  }

  renderWave(amount, now) {
    const offsets = [-2, -1, 1, 2];
    for (let index = 0; index < 4; index += 1) {
      const element = index < 2 ? this.morphHeads[index] : this.parts[index - 2];
      const offset = offsets[index];
      const phase = clamp((amount - 0.1 * Math.abs(offset)) / (1 - 0.1 * Math.abs(offset)), 0, 1);
      if (phase <= 0.004) continue;
      const energy = (0.42 + 0.29 * Math.sin(0.0021 * now) * Math.sin(0.0034 * now) + 0.29 * Math.sin(0.0013 * now + 1.7)) * (0.55 + 0.45 * Math.sin(0.012 * now - 1.05 * Math.abs(offset)));
      const size = (7 + 9 * clamp(energy, 0.08, 1)) * cubicOut(phase);
      const lift = 6 * clamp(energy, 0, 1) * phase;
      element.hidden = false;
      if (index < 2) {
        const scale = size / HEAD_C * 1.02;
        element.setAttribute("d", CIRCLE_PATH);
        element.setAttribute("transform", `translate(${(HEAD_C + 44 * offset * backOut(phase)).toFixed(1)} ${(HEAD_C - lift).toFixed(1)}) scale(${scale.toFixed(4)}) translate(${-HEAD_C} ${-HEAD_C})`);
      } else {
        element.setAttribute("cx", (HEAD_C + 44 * offset * backOut(phase)).toFixed(1)); element.setAttribute("cy", (HEAD_C - lift).toFixed(1)); element.setAttribute("r", size.toFixed(2));
      }
      element.setAttribute("opacity", phase.toFixed(3));
    }
  }

  renderSend(amount, now) {
    const phase = ((((now - this.stateStartedAt) / 1500) % 1) + 1) % 1;
    const travel = clamp((phase - 0.18) / 0.55, 0, 1);
    const eased = travel ** 2 * (0.4 + 0.6 * travel);
    const distance = 108 * eased;
    const first = this.parts[0];
    if (travel > 0 && travel < 1) { first.hidden = false; first.setAttribute("cx", (HEAD_C + 0.74 * distance).toFixed(1)); first.setAttribute("cy", (HEAD_C - 0.62 * distance).toFixed(1)); first.setAttribute("r", (10 * (1 - 0.55 * eased) * cubicOut(amount)).toFixed(2)); first.setAttribute("opacity", (cubicOut(amount) * (1 - eased ** 2)).toFixed(3)); }
    const secondTravel = clamp((phase - 0.26) / 0.55, 0, 1);
    const secondEase = secondTravel ** 2 * (0.4 + 0.6 * secondTravel);
    const second = this.parts[1];
    if (travel > 0 && secondTravel > 0 && secondTravel < 1) { const secondDistance = 108 * secondEase; second.hidden = false; second.setAttribute("cx", (HEAD_C + 0.74 * secondDistance).toFixed(1)); second.setAttribute("cy", (HEAD_C - 0.62 * secondDistance).toFixed(1)); second.setAttribute("r", (5 * (1 - 0.6 * secondEase) * cubicOut(amount)).toFixed(2)); second.setAttribute("opacity", (0.3 * cubicOut(amount) * (1 - secondEase)).toFixed(3)); }
    const ringPhase = clamp((phase - 0.18) / 0.3, 0, 1);
    if (ringPhase > 0 && ringPhase < 1) { const ring = this.rings[0]; ring.hidden = false; ring.setAttribute("fill", "none"); ring.setAttribute("stroke", "var(--fg)"); ring.setAttribute("r", (20 + 34 * cubicOut(ringPhase)).toFixed(1)); ring.setAttribute("stroke-width", (2.8 * (1 - ringPhase)).toFixed(2)); ring.setAttribute("opacity", (cubicOut(amount) * (1 - ringPhase) * 0.8).toFixed(3)); }
  }

  renderReceive(amount, now) {
    const elapsed = now - this.stateStartedAt;
    const cycle = Math.floor(elapsed / 1700);
    if (cycle !== this.receiveCycle) { this.receiveCycle = cycle; this.receiveAngle = random(-1.25 * Math.PI, 0.25 * Math.PI); }
    const phase = (((elapsed / 1700) % 1) + 1) % 1;
    const travel = clamp(phase / 0.6, 0, 1);
    const eased = 1 - (1 - travel) ** 3;
    const radius = 108 * (1 - eased);
    const orbit = 18 * Math.sin(travel * Math.PI) * (1 - 0.7 * eased);
    const cosine = Math.cos(this.receiveAngle || 0);
    const sine = Math.sin(this.receiveAngle || 0);
    const part = this.parts[0];
    if (travel < 1) { part.hidden = false; part.setAttribute("cx", (HEAD_C + cosine * radius - sine * orbit).toFixed(1)); part.setAttribute("cy", (HEAD_C + sine * radius + cosine * orbit).toFixed(1)); part.setAttribute("r", (3.5 + 6.5 * eased).toFixed(2)); part.setAttribute("opacity", (cubicOut(amount) * clamp(3.5 * travel, 0, 1) * (0.3 + 0.7 * eased)).toFixed(3)); }
    const ringPhase = clamp((phase - 0.58) / 0.32, 0, 1);
    if (ringPhase > 0 && ringPhase < 1) { const ring = this.rings[1]; ring.hidden = false; ring.setAttribute("fill", "none"); ring.setAttribute("stroke", "var(--fg)"); ring.setAttribute("r", (20 + 26 * cubicOut(ringPhase)).toFixed(1)); ring.setAttribute("stroke-width", (2.8 * (1 - ringPhase)).toFixed(2)); ring.setAttribute("opacity", (cubicOut(amount) * (1 - ringPhase) * 0.8).toFixed(3)); }
  }

  renderDock(amount, now) {
    const elapsed = (now - this.stateStartedAt) / 1000;
    for (let index = 0; index < 2; index += 1) {
      const part = this.parts[index];
      const phase = clamp((elapsed - (0.2 + 1.3 * index)) / 0.9, 0, 1);
      if (phase <= 0) continue;
      const eased = 1 - (1 - phase) ** 3;
      const angle = 0.0011 * now + index * Math.PI;
      const targetX = HEAD_C + 42 * Math.sin(angle);
      const targetY = HEAD_C + 21 * Math.cos(angle) + 2 * Math.sin(0.003 * now + index);
      const startX = HEAD_C - 120 + 30 * index;
      const startY = HEAD_C + 95;
      part.hidden = false; part.setAttribute("cx", (startX + (targetX - startX) * eased).toFixed(1)); part.setAttribute("cy", (startY + (targetY - startY) * eased).toFixed(1)); part.setAttribute("r", ((7 + 3 * eased) * cubicOut(amount)).toFixed(2)); part.setAttribute("opacity", (cubicOut(amount) * clamp(4 * phase, 0, 1)).toFixed(3));
    }
  }

  pencilPose(now) {
    const elapsed = now - this.stateStartedAt;
    const cycle = (((elapsed / 2500) % 1) + 1) % 1;
    if (cycle < 0.68) { const phase = cycle / 0.68; const envelope = clamp(phase / 0.08, 0, 1) * clamp((1 - phase) / 0.08, 0, 1); return { x: -54 + smoothstep(phase) * 118, y: 26, wiggle: 3.2 * Math.sin(24 * phase) * envelope, rotation: 17 + Math.sin(0.0006 * elapsed), lift: false }; }
    const phase = cubicInOut((cycle - 0.68) / 0.32);
    return { x: 64 - 118 * phase, y: 26 - 20 * Math.sin(phase * Math.PI), wiggle: 0, rotation: 17 - 2 * Math.sin(phase * Math.PI) + Math.sin(0.0006 * elapsed), lift: true };
  }

  renderPencil(amount, now) {
    const pose = this.pencilPose(now);
    const glyph = this.glyphs[0];
    const angle = (pose.rotation - 90) * Math.PI / 180;
    const offsetX = 68 * Math.cos(angle);
    const offsetY = 68 * Math.sin(angle);
    glyph.hidden = false; glyph.setAttribute("d", PENCIL_GLYPH); glyph.setAttribute("fill", "var(--fg)"); glyph.setAttribute("transform", `translate(${(HEAD_C + (pose.x + offsetX) * amount).toFixed(1)} ${(HEAD_C + (pose.y + 0.15 * pose.wiggle + offsetY) * amount).toFixed(1)}) rotate(${(pose.rotation * amount).toFixed(1)}) scale(${cubicOut(amount).toFixed(3)}) translate(${-HEAD_C} ${-HEAD_C})`); glyph.setAttribute("opacity", clamp(1.6 * amount - 0.3, 0, 1).toFixed(3));
    if (amount > 0.6 && !pose.lift) {
      const point = [HEAD_C + pose.x, HEAD_C + pose.y + pose.wiggle + 19];
      const last = this.writingTrail.at(-1);
      if (!last || Math.hypot(point[0] - last[0], point[1] - last[1]) > 2.4) {
        this.writingTrail.push(point);
        if (this.writingTrail.length > 64) this.writingTrail.shift();
      } else {
        last[0] = point[0];
        last[1] = point[1];
      }
    }
    else if (this.writingTrail.length) this.writingTrail.splice(0, 2);
    const trail = this.glyphs[1];
    if (this.writingTrail.length >= 2) {
      const points = this.writingTrail;
      let path = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
      if (points.length === 2) path += `L${points[1][0].toFixed(1)} ${points[1][1].toFixed(1)}`;
      else {
        for (let index = 0; index < points.length - 1; index += 1) {
          const previous = points[Math.max(index - 1, 0)];
          const point = points[index];
          const next = points[index + 1];
          const after = points[Math.min(index + 2, points.length - 1)];
          const control1X = point[0] + (next[0] - previous[0]) / 6;
          const control1Y = point[1] + (next[1] - previous[1]) / 6;
          const control2X = next[0] - (after[0] - point[0]) / 6;
          const control2Y = next[1] - (after[1] - point[1]) / 6;
          path += `C${control1X.toFixed(1)} ${control1Y.toFixed(1)} ${control2X.toFixed(1)} ${control2Y.toFixed(1)} ${next[0].toFixed(1)} ${next[1].toFixed(1)}`;
        }
      }
      trail.hidden = false;
      trail.setAttribute("fill", "none");
      trail.setAttribute("stroke", "var(--fg)");
      trail.setAttribute("stroke-width", "6");
      trail.setAttribute("stroke-linecap", "round");
      trail.setAttribute("stroke-linejoin", "round");
      trail.setAttribute("d", path);
      trail.setAttribute("opacity", clamp(1.2 * amount, 0, 1).toFixed(3));
    }
    return { x: pose.x, y: pose.y + 0.5 * pose.wiggle, rotation: pose.rotation, scale: 1, opacityLoss: 0 };
  }

  renderBang(amount, now) {
    const glyph = this.glyphs[2];
    const elapsed = (now - this.stateStartedAt) / 1000;
    const enter = cubicOut(clamp(1.1 * amount, 0, 1));
    const shake = 2.2 * Math.sin(42 * elapsed) * Math.exp(-((elapsed % 2.2) * 5.5));
    glyph.hidden = false; glyph.setAttribute("d", ALERT_GLYPH); glyph.setAttribute("fill", "var(--fg)"); glyph.setAttribute("transform", `translate(0 ${(-26 - (1 - enter) * 70).toFixed(1)}) rotate(${shake.toFixed(2)} ${HEAD_C} ${(HEAD_C - 74).toFixed(1)}) translate(${HEAD_C} ${HEAD_C}) scale(${clamp(1.2 * amount, 0, 1).toFixed(3)}) translate(${-HEAD_C} ${-HEAD_C})`); glyph.setAttribute("opacity", clamp(1.5 * amount - 0.2, 0, 1).toFixed(3));
    return { x: 0, y: 58, rotation: 0, scale: 1, opacityLoss: 0 };
  }

  renderStandby(amount, now) {
    const glow = this.parts[4];
    const pulse = 0.5 + 0.5 * Math.sin(0.0016 * now);
    glow.hidden = false; glow.setAttribute("cx", HEAD_C); glow.setAttribute("cy", HEAD_C); glow.setAttribute("r", (26 + 7 * pulse).toFixed(1)); glow.setAttribute("opacity", (cubicOut(amount) * (0.06 + 0.1 * pulse)).toFixed(3));
    if (amount < 0.995) { const ring = this.rings[2]; ring.hidden = false; ring.setAttribute("fill", "none"); ring.setAttribute("stroke", "var(--fg)"); ring.setAttribute("r", (104 - 88 * cubicOut(amount)).toFixed(1)); ring.setAttribute("stroke-width", "2.4"); ring.setAttribute("opacity", ((1 - cubicOut(amount)) * 0.5).toFixed(3)); }
  }
}

export { MORPH_SIZES };
