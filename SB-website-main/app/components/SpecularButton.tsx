"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Renderer, Program, Mesh, Triangle, Color } from "ogl";
import "./SpecularButton.css";

const PAD = 20;

const VERT = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uCenter;
uniform vec2 uHalfSize;
uniform float uRadius;
uniform float uAngle;
uniform float uPx;
uniform vec3 uLineColor;
uniform vec3 uBaseColor;
uniform float uIntensity;
uniform float uShineSize;
uniform float uShineFade;
uniform float uThickness;
uniform float uBaseWidth;
out vec4 fragColor;

float sdRoundedRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float gaussianLine(float d, float sigma) {
  float x = d / (sigma + 1e-6);
  return exp(-mix(1.0, 1.6, smoothstep(0.0, 1.5, x)) * x * x);
}

void main() {
  vec2 p = gl_FragCoord.xy - uCenter;
  float d = sdRoundedRect(p, uHalfSize, uRadius);
  vec2 light = vec2(cos(uAngle), sin(uAngle));
  float base = (1.0 - smoothstep(0.0, uBaseWidth, abs(d))) * 0.45;
  vec2 normal = normalize(p / (uHalfSize * uHalfSize) + 1e-6);
  float phi = acos(clamp(abs(dot(normal, light)), 0.0, 1.0));
  float rim = 1.0 - smoothstep(uShineSize - uShineFade, uShineSize + uShineFade + 1e-4, phi);
  float line = gaussianLine(d, uThickness);
  float edgeClamp = 1.0 - smoothstep(0.5 * uPx, 3.0 * uPx, abs(d));
  float highlight = line * rim * edgeClamp * uIntensity;
  vec3 color = uBaseColor * base + uLineColor * highlight;
  float alpha = clamp(base + highlight, 0.0, 1.0);
  fragColor = vec4(color, alpha);
}
`;

type ButtonSize = "sm" | "md" | "lg";

type SpecularButtonProps = {
  children?: React.ReactNode;
  size?: ButtonSize;
  radius?: number;
  tint?: string;
  tintOpacity?: number;
  blur?: number;
  textColor?: string;
  lineColor?: string;
  baseColor?: string;
  intensity?: number;
  shineSize?: number;
  shineFade?: number;
  thickness?: number;
  speed?: number;
  followMouse?: boolean;
  proximity?: number;
  autoAnimate?: boolean;
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  href?: string;
  type?: "button" | "submit" | "reset";
  className?: string;
};

export default function SpecularButton({
  children = "Get Started",
  size = "lg",
  radius = 18,
  tint = "#ffffff",
  tintOpacity = 0,
  blur = 0,
  textColor = "#f5f5f5",
  lineColor = "#ffffff",
  baseColor = "#525252",
  intensity = 1,
  shineSize = 10,
  shineFade = 40,
  thickness = 1,
  speed = 0.35,
  followMouse = true,
  proximity = 250,
  autoAnimate = false,
  disabled = false,
  onClick,
  href,
  type = "button",
  className = "",
}: SpecularButtonProps) {
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fxRef = useRef<HTMLSpanElement>(null);
  const propsRef = useRef({ radius, lineColor, baseColor, intensity, shineSize, shineFade, thickness, speed, followMouse, proximity, autoAnimate });

  useEffect(() => {
    propsRef.current = { radius, lineColor, baseColor, intensity, shineSize, shineFade, thickness, speed, followMouse, proximity, autoAnimate };
  }, [radius, lineColor, baseColor, intensity, shineSize, shineFade, thickness, speed, followMouse, proximity, autoAnimate]);

  useEffect(() => {
    const button = buttonRef.current;
    const fx = fxRef.current;
    if (!button || !fx) return;

    const dpr = window.devicePixelRatio || 1;
    const renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: true, dpr });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const geometry = new Triangle(gl);
    if (geometry.attributes.uv) delete geometry.attributes.uv;
    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uCenter: { value: [0, 0] },
        uHalfSize: { value: [1, 1] },
        uRadius: { value: 0 },
        uAngle: { value: 2.4 },
        uPx: { value: dpr },
        uLineColor: { value: [1, 1, 1] },
        uBaseColor: { value: [0.32, 0.32, 0.32] },
        uIntensity: { value: 1 },
        uShineSize: { value: 0.17 },
        uShineFade: { value: 0.7 },
        uThickness: { value: 1 },
        uBaseWidth: { value: dpr },
      },
    });
    const mesh = new Mesh(gl, { geometry, program });
    fx.appendChild(gl.canvas);

    const size = { width: 1, height: 1 };
    const resize = () => {
      const rect = button.getBoundingClientRect();
      size.width = rect.width;
      size.height = rect.height;
      renderer.setSize(rect.width + PAD * 2, rect.height + PAD * 2);
      program.uniforms.uCenter.value = [(PAD + rect.width / 2) * dpr, (PAD + rect.height / 2) * dpr];
      program.uniforms.uHalfSize.value = [(rect.width / 2) * dpr, (rect.height / 2) * dpr];
    };
    const observer = new ResizeObserver(resize);
    observer.observe(button);
    resize();

    let pointerAngle: number | null = null;
    let proximityT = 0;
    const onPointerMove = (event: PointerEvent) => {
      const rect = button.getBoundingClientRect();
      const dx = Math.max(rect.left - event.clientX, 0, event.clientX - rect.right);
      const dy = Math.max(rect.top - event.clientY, 0, event.clientY - rect.bottom);
      const distance = Math.hypot(dx, dy);
      pointerAngle = Math.atan2(rect.top + rect.height / 2 - event.clientY, event.clientX - (rect.left + rect.width / 2));
      const t = Math.max(0, 1 - distance / Math.max(propsRef.current.proximity, 1));
      proximityT = t * t * (3 - 2 * t);
    };
    window.addEventListener("pointermove", onPointerMove);

    let angle = 2.4;
    let last = performance.now();
    let animationFrame = 0;
    const lineColorValue = new Color();
    const baseColorValue = new Color();
    const update = (now: number) => {
      animationFrame = requestAnimationFrame(update);
      const delta = Math.min((now - last) / 1000, 0.05);
      last = now;
      const props = propsRef.current;
      const idleAngle = angle + props.speed * delta;
      const target = props.followMouse && pointerAngle !== null && (!props.autoAnimate || proximityT > 0) ? pointerAngle : idleAngle;
      const difference = ((target - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      angle += difference * (1 - Math.exp(-delta * 7));
      const brightness = props.autoAnimate ? 1 : proximityT;
      lineColorValue.set(props.lineColor);
      baseColorValue.set(props.baseColor);
      program.uniforms.uAngle.value = angle;
      program.uniforms.uRadius.value = Math.min(props.radius, Math.min(size.width, size.height) / 2) * dpr;
      program.uniforms.uLineColor.value = [lineColorValue.r, lineColorValue.g, lineColorValue.b];
      program.uniforms.uBaseColor.value = [baseColorValue.r, baseColorValue.g, baseColorValue.b];
      program.uniforms.uIntensity.value = props.intensity * brightness;
      program.uniforms.uShineSize.value = (props.shineSize * Math.PI) / 180;
      program.uniforms.uShineFade.value = (props.shineFade * Math.PI) / 180;
      program.uniforms.uThickness.value = props.thickness * dpr;
      renderer.render({ scene: mesh });
    };
    animationFrame = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      if (gl.canvas.parentNode === fx) fx.removeChild(gl.canvas);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return (
    <button
      ref={buttonRef}
      type={type}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && href) router.push(href);
      }}
      className={`specular-button specular-button--${size}${className ? ` ${className}` : ""}`}
      style={{ "--sb-radius": `${radius}px`, "--sb-tint": tint, "--sb-tint-opacity": tintOpacity, "--sb-blur": `${blur}px`, "--sb-text-color": textColor } as React.CSSProperties}
    >
      <span ref={fxRef} className="specular-button__fx" aria-hidden="true" />
      <span className="specular-button__label">{children}</span>
    </button>
  );
}
