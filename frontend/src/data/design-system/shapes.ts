import * as React from "react"
import type { SVGProps } from "react"

type ShapeProps = SVGProps<SVGSVGElement>

export function PriceBubble(props: ShapeProps) {
  return React.createElement(
    "svg",
    { viewBox: "0 0 220 220", fill: "none", xmlns: "http://www.w3.org/2000/svg", ...props },
    React.createElement("circle", { cx: 110, cy: 110, r: 96, fill: "currentColor" }),
    React.createElement("circle", {
      cx: 110,
      cy: 110,
      r: 78,
      stroke: "rgba(255,255,255,0.74)",
      strokeWidth: 6,
      strokeDasharray: "14 10",
    }),
  )
}

export function RibbonBanner(props: ShapeProps) {
  return React.createElement(
    "svg",
    { viewBox: "0 0 320 110", fill: "none", xmlns: "http://www.w3.org/2000/svg", ...props },
    React.createElement("path", {
      d: "M18 18H302L274 55L302 92H18L46 55L18 18Z",
      fill: "currentColor",
    }),
    React.createElement("path", {
      d: "M46 55L18 18V92L46 55ZM274 55L302 18V92L274 55Z",
      fill: "rgba(0,0,0,0.18)",
    }),
  )
}

export function Starburst(props: ShapeProps) {
  return React.createElement(
    "svg",
    { viewBox: "0 0 240 240", fill: "none", xmlns: "http://www.w3.org/2000/svg", ...props },
    React.createElement("path", {
      d: "M120 8L138 52L178 27L171 74L218 67L187 104L232 120L187 136L218 173L171 166L178 213L138 188L120 232L102 188L62 213L69 166L22 173L53 136L8 120L53 104L22 67L69 74L62 27L102 52L120 8Z",
      fill: "currentColor",
    }),
  )
}

export function Divider(props: ShapeProps) {
  return React.createElement(
    "svg",
    { viewBox: "0 0 360 32", fill: "none", xmlns: "http://www.w3.org/2000/svg", ...props },
    React.createElement("path", {
      d: "M4 16H140",
      stroke: "currentColor",
      strokeWidth: 8,
      strokeLinecap: "round",
    }),
    React.createElement("circle", { cx: 180, cy: 16, r: 10, fill: "currentColor" }),
    React.createElement("path", {
      d: "M220 16H356",
      stroke: "currentColor",
      strokeWidth: 8,
      strokeLinecap: "round",
    }),
  )
}

export function CornerAccent(props: ShapeProps) {
  return React.createElement(
    "svg",
    { viewBox: "0 0 180 180", fill: "none", xmlns: "http://www.w3.org/2000/svg", ...props },
    React.createElement("path", { d: "M0 0H180L0 180V0Z", fill: "currentColor" }),
    React.createElement("path", {
      d: "M24 24H124L24 124V24Z",
      fill: "rgba(255,255,255,0.28)",
    }),
  )
}
