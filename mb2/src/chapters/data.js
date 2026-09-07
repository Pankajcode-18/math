'use strict';

// ═══════════════════════════════════════════════
// NEPAL SEE MATHEMATICS — CHAPTER DEFINITIONS
// ═══════════════════════════════════════════════

const CHAPTERS = [
  {
    id: 1,
    name: 'Sets',
    badge: 'interactive',
    icon: '∪',
    tools: ['venn'],
    desc: 'Venn diagrams, set operations'
  },
  {
    id: 2,
    name: 'Compound Interest',
    badge: 'interactive',
    icon: '%',
    tools: ['ci'],
    desc: 'CI, SI, Amount calculator'
  },
  {
    id: 3,
    name: 'Growth & Depreciation',
    badge: 'interactive',
    icon: '↑↓',
    tools: ['gd'],
    desc: 'Population growth, asset depreciation'
  },
  {
    id: 4,
    name: 'Currency & Exchange Rate',
    badge: 'interactive',
    icon: '₹$',
    tools: ['fx'],
    desc: 'Currency conversion, buying/selling rates'
  },
  {
    id: 5,
    name: 'Area and Volume',
    badge: 'interactive',
    icon: '□',
    tools: ['area2d', 'area3d'],
    desc: '2D area, 3D volume with live shapes'
  },
  {
    id: 6,
    name: 'Sequence & Series',
    badge: 'interactive',
    icon: '…',
    tools: ['seq'],
    desc: 'AP, GP — terms, sum, nth term'
  },
  {
    id: 7,
    name: 'Quadratic Equation',
    badge: 'interactive',
    icon: 'x²',
    tools: ['quad'],
    desc: 'Discriminant, roots, factored form'
  },
  {
    id: 8,
    name: 'Algebraic Fraction',
    badge: 'board',
    icon: 'a/b',
    tools: [],
    desc: 'Use the board to write and simplify'
  },
  {
    id: 9,
    name: 'Indices',
    badge: 'board',
    icon: 'aⁿ',
    tools: [],
    desc: 'Laws of indices — write on board'
  },
  {
    id: 10,
    name: 'Triangles & Quadrilaterals',
    badge: 'interactive',
    icon: '△',
    tools: ['tri'],
    desc: 'Properties, Heron\'s formula, angles'
  },
  {
    id: 11,
    name: 'Construction',
    badge: 'board',
    icon: '✎',
    tools: [],
    desc: 'Draw with the canvas tools'
  },
  {
    id: 12,
    name: 'Circle',
    badge: 'interactive',
    icon: '○',
    tools: ['circle'],
    desc: 'Area, arc, sector, chord, tangent'
  },
  {
    id: 13,
    name: 'Statistics',
    badge: 'interactive',
    icon: '∑',
    tools: ['stats'],
    desc: 'Mean, median, mode, SD, bar chart'
  },
  {
    id: 14,
    name: 'Probability',
    badge: 'interactive',
    icon: 'P',
    tools: ['prob'],
    desc: 'P(E), Venn, dice & coin simulator'
  }
];

// Shape definitions for the canvas
const SHAPE_DEFS = {
  // ── 2D Basic (Ch 5 — Area & Volume) ──
  rectangle:      { label: 'Rectangle',       w: 160, h: 100 },
  square:         { label: 'Square',          w: 110, h: 110 },
  circle:         { label: 'Circle',          r: 65 },
  triangle:       { label: 'Triangle',        base: 140, height: 110 },
  equilateral:    { label: 'Equil. Triangle', side: 130 },
  rightTriangle:  { label: 'Right Triangle',  base: 130, height: 100 },
  trapezium:      { label: 'Trapezium',       a: 80, b: 150, h: 80 },
  parallelogram:  { label: 'Parallelogram',   base: 150, h: 80, slant: 40 },
  rhombus:        { label: 'Rhombus',         d1: 130, d2: 80 },
  sector:         { label: 'Sector',          r: 90, angle: 90 },
  semicircle:     { label: 'Semicircle',      r: 70 },
  ellipse:        { label: 'Ellipse',         rx: 90, ry: 50 },
  // ── 2D Polygons ──
  pentagon:       { label: 'Pentagon',        r: 70, sides: 5 },
  hexagon:        { label: 'Hexagon',         r: 70, sides: 6 },
  octagon:        { label: 'Octagon',         r: 70, sides: 8 },
  kite:           { label: 'Kite',            w: 100, h1: 70, h2: 110 },
  // ── Tools ──
  'number-line':  { label: 'Number Line',     length: 240, min: 0, max: 10 },
  protractor:     { label: 'Protractor',      r: 90 },
  // ── 3D (Ch 5 — Volume & Surface Area) ──
  cube:           { label: 'Cube',            side: 90 },
  cuboid:         { label: 'Cuboid',          w: 140, h: 90, d: 60 },
  cylinder:       { label: 'Cylinder',        r: 50, h: 110 },
  hollowCylinder: { label: 'Hollow Cylinder', R: 60, r: 40, h: 110 },
  cone:           { label: 'Cone',            r: 55, h: 110 },
  sphere:         { label: 'Sphere',          r: 70 },
  hemisphere:     { label: 'Hemisphere',      r: 70 },
  prism:          { label: 'Tri. Prism',      base: 100, height: 80, depth: 120 },
  rectPrism:      { label: 'Rect. Prism',     w: 120, h: 70, depth: 100 },
  pentPrism:      { label: 'Pent. Prism',     r: 55, depth: 110 },
  hexPrism:       { label: 'Hex. Prism',      r: 55, depth: 110 },
  pyramid:        { label: 'Sq. Pyramid',     base: 110, h: 120 },
};

// Colors for palette
const PALETTE_COLORS = [
  { hex: '#ffffff', name: 'White' },
  { hex: '#dc2626', name: 'Red' },
  { hex: '#16a34a', name: 'Green' },
  { hex: '#c9a84c', name: 'Gold' },
  { hex: '#7c3aed', name: 'Purple' },
  { hex: '#ea580c', name: 'Orange' },
  { hex: '#0891b2', name: 'Cyan' },
  { hex: '#be185d', name: 'Pink' },
  { hex: '#374151', name: 'Dark' },
  { hex: '#ffffff', name: 'White' }
];

const PEN_SIZES = [
  { size: 2,  dot: 4  },
  { size: 4,  dot: 7  },
  { size: 8,  dot: 11 },
  { size: 16, dot: 16 }
];