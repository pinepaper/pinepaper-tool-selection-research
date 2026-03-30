/**
 * Pine Paper LLM v0 — Synthetic Tool Generator
 *
 * Generates ~400 synthetic MCP tool definitions following the
 * pinepaper_<verb>_<noun> naming pattern across extended categories.
 * Used to scale the benchmark from 124 real tools to 500+ for
 * statistical power.
 *
 * Each tool has 1-3 associated SyntheticMethod definitions with rich
 * parameter schemas (typed, min/max, defaults, enums), enabling KG
 * integration via `implements`, `similar`, and cross-domain bridge edges.
 */

// ============================================================================
// Types
// ============================================================================

export interface SyntheticToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
  tags: string[];
  category: string;
  synthetic: true;
}

export interface SyntheticMethodParameter {
  name: string;
  type: 'number' | 'string' | 'boolean' | 'color' | 'enum' | 'array' | 'object';
  required: boolean;
  description: string;
  default?: unknown;
  min?: number;
  max?: number;
  enumValues?: string[];
}

export interface SyntheticMethod {
  id: string;
  name: string;
  category: string;
  mcpTool: string;
  description: string;
  parameters: SyntheticMethodParameter[];
  examples: Array<{ instruction: string; code: string }>;
  relatedMethods: string[];
  tags: string[];
}

export interface SimilarEdge {
  source: string;
  target: string;
  weight: number;
  reason: 'param_overlap_3' | 'param_overlap_2' | 'same_category' | 'cross_domain';
}

export interface SyntheticToolWithMethods extends SyntheticToolDefinition {
  methods: SyntheticMethod[];
}

/**
 * Shell composite node — mirrors biological shell metaphor.
 * Outer surface uses user vocabulary; interior uses technical vocabulary.
 */
export interface SyntheticShell {
  id: string;                    // 'shell.data_dashboard'
  surfaceLabel: string;          // User-facing: "Interactive data dashboard"
  surfaceDescription: string;    // User vocabulary
  interiorDescription: string;   // Technical vocabulary
  toolIds: string[];             // Interior tools
  tags: string[];                // Surface tags (user vocabulary)
  technicalTags: string[];       // Interior tags (system vocabulary)
  category: string;
}

// ============================================================================
// Shared Semantic Parameter Pools
// ============================================================================

type SemanticPool = 'spatial' | 'color' | 'animation' | 'effect' | 'control';

const SEMANTIC_PARAM_POOLS: Record<SemanticPool, SyntheticMethodParameter[]> = {
  spatial: [
    { name: 'x', type: 'number', required: false, description: 'X position', default: 0, min: -10000, max: 10000 },
    { name: 'y', type: 'number', required: false, description: 'Y position', default: 0, min: -10000, max: 10000 },
    { name: 'width', type: 'number', required: false, description: 'Width in pixels', default: 100, min: 1, max: 10000 },
    { name: 'height', type: 'number', required: false, description: 'Height in pixels', default: 100, min: 1, max: 10000 },
    { name: 'radius', type: 'number', required: false, description: 'Radius in pixels', default: 50, min: 0, max: 5000 },
  ],
  color: [
    { name: 'color', type: 'color', required: false, description: 'Primary color', default: '#000000' },
    { name: 'strokeColor', type: 'color', required: false, description: 'Stroke/border color', default: '#333333' },
    { name: 'fillColor', type: 'color', required: false, description: 'Fill color', default: '#ffffff' },
    { name: 'backgroundColor', type: 'color', required: false, description: 'Background color', default: '#f0f0f0' },
  ],
  animation: [
    { name: 'duration', type: 'number', required: false, description: 'Duration in milliseconds', default: 1000, min: 0, max: 60000 },
    { name: 'speed', type: 'number', required: false, description: 'Animation speed multiplier', default: 1, min: 0.01, max: 100 },
    { name: 'easing', type: 'enum', required: false, description: 'Easing function', default: 'ease-in-out', enumValues: ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'cubic-bezier', 'spring'] },
    { name: 'delay', type: 'number', required: false, description: 'Start delay in milliseconds', default: 0, min: 0, max: 30000 },
    { name: 'iterations', type: 'number', required: false, description: 'Number of repetitions', default: 1, min: 1, max: 1000 },
  ],
  effect: [
    { name: 'intensity', type: 'number', required: false, description: 'Effect intensity', default: 0.5, min: 0, max: 1 },
    { name: 'amount', type: 'number', required: false, description: 'Effect amount', default: 1, min: 0, max: 10 },
    { name: 'blendMode', type: 'enum', required: false, description: 'Blend mode', default: 'normal', enumValues: ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn'] },
    { name: 'opacity', type: 'number', required: false, description: 'Layer opacity', default: 1, min: 0, max: 1 },
  ],
  control: [
    { name: 'targetId', type: 'string', required: true, description: 'Target element ID' },
    { name: 'elementId', type: 'string', required: false, description: 'Source element ID' },
    { name: 'count', type: 'number', required: false, description: 'Number of items', default: 1, min: 1, max: 1000 },
    { name: 'enabled', type: 'boolean', required: false, description: 'Enable or disable feature', default: true },
  ],
};

/** Which semantic pools each category draws from */
const CATEGORY_SEMANTIC_POOLS: Record<string, SemanticPool[]> = {
  data_visualization: ['spatial', 'color', 'control'],
  '3d_rendering': ['spatial', 'color', 'animation', 'effect'],
  collaboration: ['control'],
  accessibility: ['control'],
  typography: ['spatial', 'color', 'control'],
  image_processing: ['spatial', 'color', 'effect'],
  layout: ['spatial', 'control'],
  motion_design: ['animation', 'spatial', 'effect'],
  vector_operations: ['spatial', 'control'],
  prototyping: ['animation', 'control', 'spatial'],
};

// ============================================================================
// Technical Description Templates (API-doc style, system vocabulary)
// ============================================================================

/**
 * Technical descriptions for tool nodes — formal, parameter-heavy text
 * that mirrors real method descriptions. These form the "interior" of the
 * shell abstraction (what the system stores).
 */
const TECHNICAL_DESCRIPTIONS: Record<string, string[]> = {
  data_visualization: [
    'Render a categorical data comparison using vertical bar segments with configurable axis parameters, series bindings, and palette mappings',
    'Execute a multi-series line rendering pipeline with interpolation mode selection, axis scaling, and marker configuration',
    'Compute proportional sector allocation from weighted dataset entries with label positioning and explode offset parameters',
    'Project bivariate data coordinates onto a Cartesian plane with configurable point geometry, regression overlays, and axis transforms',
    'Aggregate frequency distributions into configurable bin ranges with density normalization and cumulative mode support',
  ],
  '3d_rendering': [
    'Instantiate a geometric primitive with mesh subdivision level, material binding, and transform matrix application',
    'Configure photometric light source parameters including falloff attenuation, shadow map resolution, and spectral intensity',
    'Initialize perspective projection matrix with configurable field-of-view, near/far clip planes, and aspect ratio correction',
    'Bind PBR material properties to mesh surface including albedo map, normal perturbation, metallic-roughness workflow',
    'Spawn GPU particle emitter with velocity field, lifetime distribution, and per-particle size/color gradient curves',
  ],
  collaboration: [
    'Attach threaded annotation instance to canvas element with positional anchor, visibility scope, and resolution state',
    'Initialize conflict resolution protocol for concurrent document modifications with three-way merge strategy',
    'Configure granular permission matrix for workspace resource access with role-based inheritance chain',
    'Broadcast real-time cursor position and selection state through WebSocket channel with presence protocol',
    'Create versioned snapshot of document state with delta compression and branch metadata for rollback support',
  ],
  accessibility: [
    'Compute WCAG 2.1 contrast ratio between foreground and background color pairs with luminance-based AA/AAA threshold evaluation',
    'Generate semantic alt-text descriptor from visual element properties using structural hierarchy and role annotation',
    'Configure sequential focus traversal order across interactive elements with skip-link insertion and landmark registration',
    'Validate color-blind safe palette by simulating protanopia, deuteranopia, and tritanopia transformations on design tokens',
    'Map keyboard shortcut bindings to interactive element actions with modifier key detection and conflict resolution',
  ],
  typography: [
    'Configure OpenType feature registry with ligature activation, stylistic alternates, and contextual swash selection',
    'Apply variable font axis interpolation across weight, width, and optical-size dimensions with instance clamping',
    'Compute optimal line-height ratio from cap-height, ascender, and descender metrics with grid-snap alignment',
    'Execute text shaping pipeline with BiDi algorithm, script itemization, and glyph cluster boundary detection',
    'Configure hanging punctuation offset and optical margin alignment for justified text block composition',
  ],
  image_processing: [
    'Execute non-destructive curves adjustment with per-channel control points, histogram preview, and clipping indicator',
    'Apply convolution kernel for spatial frequency filtering with configurable radius, sigma, and edge handling mode',
    'Compute adaptive threshold using local mean or Gaussian-weighted neighborhood with morphological post-processing',
    'Execute color lookup table transformation with tetrahedral interpolation across 3D LUT cube entries',
    'Apply grain synthesis with configurable ISO simulation, chromatic/luminance split, and temporal coherence seed',
  ],
  layout: [
    'Configure CSS Grid template with explicit track sizing, named area assignment, and auto-placement algorithm selection',
    'Execute constraint-based layout solver with priority-weighted anchoring rules and intrinsic content size propagation',
    'Compute equal-distribution spacing across element collection with configurable axis, alignment mode, and overflow handling',
    'Apply responsive breakpoint cascade with media-query-driven layout reflow and container-query fallback strategy',
    'Configure masonry layout engine with column count, gutter width, and item sizing strategy (fixed/ratio/intrinsic)',
  ],
  motion_design: [
    'Configure keyframe interpolation sequence with cubic-bezier control points, hold frames, and overshoot damping',
    'Initialize spring physics simulation with mass, stiffness, and damping ratio parameters for natural motion curves',
    'Execute scroll-driven animation binding with viewport intersection threshold, scrub range, and pin configuration',
    'Configure stagger distribution across element collection with cascade delay, direction mode, and easing per-item override',
    'Apply squash-and-stretch deformation along motion vector with anticipation lead-in and follow-through decay',
  ],
  vector_operations: [
    'Execute boolean path operation using Greiner-Hormann clipping with winding-number fill-rule determination',
    'Compute path offset using Clipper library with configurable miter limit, join style, and end cap type',
    'Apply Ramer-Douglas-Peucker simplification with tolerance threshold and curvature-preserving constraint',
    'Convert anchor point between smooth and corner mode with handle symmetry control and tangent continuity',
    'Execute bitmap-to-vector tracing with centerline detection, corner threshold, and path-smoothing post-pass',
  ],
  prototyping: [
    'Configure interaction trigger-action binding with gesture recognizer, state condition evaluation, and response dispatch',
    'Initialize component variant state machine with transition rules, guard conditions, and property interpolation',
    'Apply smart-animate layer matching with transform decomposition, opacity crossfade, and clip-mask transition',
    'Configure scroll simulation with momentum physics, snap-point magnetism, and rubber-band overscroll behavior',
    'Record interaction replay sequence with timing-preserving event capture and viewport-normalized coordinate mapping',
  ],
};

// ============================================================================
// Noun Aliases (user vocabulary → indirect references)
// ============================================================================

/**
 * Maps each tool noun to 2–3 indirect aliases used in query templates.
 * Breaks the circular vocabulary dependency: queries use aliases,
 * NOT the raw noun, so BM25 can't get a free lexical signal.
 */
export const NOUN_ALIASES: Record<string, string[]> = {
  // data_visualization
  bar_chart: ['column graph', 'categorical comparison', 'grouped bars display'],
  line_chart: ['trend line plot', 'time series curve', 'continuous data trace'],
  pie_chart: ['proportional sectors', 'percentage wheel', 'share breakdown'],
  scatter_plot: ['data point cloud', 'XY distribution', 'correlation view'],
  histogram: ['frequency distribution', 'bin count display', 'value spread'],
  heatmap: ['intensity matrix', 'color density grid', 'value gradient map'],
  treemap: ['hierarchical area partition', 'nested rectangle display', 'proportional tiles'],
  bubble_chart: ['sized point plot', 'weighted scatter', 'dimensional dot display'],
  radar_chart: ['spider web plot', 'multi-axis profile', 'radial comparison'],
  funnel_chart: ['conversion pipeline', 'stage attrition display', 'narrowing flow'],
  waterfall_chart: ['cumulative delta display', 'running total bridge', 'sequential change view'],
  gantt_chart: ['timeline task schedule', 'project phase bar', 'duration block chart'],
  sankey_diagram: ['flow allocation diagram', 'weighted stream path', 'resource transfer map'],
  chord_diagram: ['circular relationship arc', 'interconnection ring', 'bidirectional flow circle'],
  sunburst_chart: ['concentric ring hierarchy', 'radial drill-down', 'nested arc sectors'],
  area_chart: ['filled region curve', 'stacked magnitude plot', 'cumulative area trace'],
  box_plot: ['quartile range diagram', 'statistical spread box', 'distribution whisker'],
  violin_plot: ['density mirror profile', 'probability contour', 'distribution shape'],
  // 3d_rendering
  cube: ['rectangular prism', 'box solid', 'hexahedral shape'],
  sphere: ['round solid', 'geodesic ball', 'orbital shape'],
  cylinder: ['tube solid', 'circular extrusion', 'barrel shape'],
  cone: ['pointed solid', 'tapered extrusion', 'pyramidal cone'],
  torus: ['doughnut ring', 'toroidal loop', 'circular sweep'],
  plane: ['flat surface', 'ground quad', 'planar face'],
  mesh: ['polygon surface', 'vertex network', 'triangulated shell'],
  point_light: ['omni source', 'radial illumination', 'spherical emitter'],
  directional_light: ['sun lamp', 'parallel ray source', 'infinite distance illumination'],
  ambient_light: ['environment fill', 'uniform illumination', 'global base light'],
  spot_light: ['focused beam', 'conical illumination', 'directed projector'],
  camera_3d: ['viewpoint controller', 'perspective eye', 'scene observer'],
  material: ['surface shader', 'appearance binding', 'rendering property set'],
  texture: ['surface image', 'UV-mapped bitmap', 'detail overlay'],
  shader: ['GPU program', 'rendering kernel', 'fragment processor'],
  particle_system: ['point emitter cloud', 'dynamic sprite swarm', 'procedural effect stream'],
  skybox: ['environment backdrop', 'panoramic enclosure', 'scene surround'],
  terrain: ['height field surface', 'landscape mesh', 'topographic ground'],
  fog: ['atmospheric haze', 'depth fade', 'volumetric mist'],
  reflection_probe: ['environment capture', 'reflection sampler', 'IBL source'],
  // collaboration
  comment: ['feedback note', 'discussion remark', 'review annotation'],
  annotation: ['markup callout', 'pinned observation', 'contextual note'],
  review: ['design critique', 'feedback session', 'approval round'],
  version: ['saved revision', 'document checkpoint', 'state snapshot'],
  branch: ['parallel variant', 'divergent copy', 'forked revision'],
  snapshot: ['point-in-time capture', 'frozen state', 'archived copy'],
  permission: ['access grant', 'role authorization', 'privilege setting'],
  workspace: ['shared environment', 'team project space', 'collaborative room'],
  channel: ['communication stream', 'message thread', 'notification feed'],
  notification: ['activity alert', 'event signal', 'status update message'],
  cursor: ['position indicator', 'pointer tracker', 'live selection marker'],
  selection_share: ['highlighted region broadcast', 'selection sync', 'collaborative highlight'],
  conflict: ['edit collision', 'concurrent change clash', 'merge disagreement'],
  change_request: ['modification proposal', 'edit suggestion', 'revision petition'],
  approval: ['sign-off confirmation', 'acceptance stamp', 'review clearance'],
  // accessibility
  alt_text: ['image descriptor', 'visual description', 'assistive label'],
  aria_label: ['screen reader tag', 'semantic descriptor', 'assistive name'],
  contrast_check: ['readability validator', 'luminance ratio test', 'visibility compliance'],
  screen_reader_hint: ['assistive navigation cue', 'spoken label', 'voice guidance tag'],
  focus_order: ['tab sequence', 'keyboard navigation path', 'interaction flow order'],
  keyboard_shortcut: ['hotkey binding', 'accelerator key', 'quick access combo'],
  color_blind_mode: ['CVD simulation', 'dichromacy preview', 'accessible palette view'],
  high_contrast: ['enhanced visibility mode', 'bold distinction', 'amplified differentiation'],
  text_to_speech: ['voice synthesis', 'audio narration', 'spoken content'],
  magnification: ['zoom enhancement', 'enlarged view', 'scale increase'],
  caption: ['subtitle overlay', 'text transcript', 'media annotation'],
  audio_description: ['narrated visual', 'spoken scene depiction', 'verbal imagery'],
  skip_link: ['navigation bypass', 'content jump', 'header skip anchor'],
  landmark: ['structural marker', 'page region label', 'navigation waypoint'],
  reading_order: ['content sequence', 'logical flow path', 'document traversal order'],
  // typography
  font_family: ['typeface selection', 'font stack', 'glyph set'],
  font_weight: ['stroke thickness', 'boldness level', 'type density'],
  font_style: ['italic mode', 'oblique setting', 'type slant'],
  line_height: ['vertical rhythm', 'leading measure', 'inter-line spacing'],
  letter_spacing: ['tracking adjustment', 'character gap', 'glyph interval'],
  word_spacing: ['inter-word gap', 'word interval', 'lexical spacing'],
  text_decoration: ['underline style', 'strikethrough rule', 'text ornament'],
  text_transform: ['case conversion', 'capitalization rule', 'text mutation'],
  text_shadow: ['type glow', 'character shade', 'text depth effect'],
  font_variant: ['stylistic alternate', 'glyph variant', 'type form selection'],
  text_indent: ['paragraph inset', 'first-line offset', 'block indentation'],
  text_wrap: ['line-break mode', 'soft-wrap rule', 'overflow wrapping'],
  hyphenation: ['word-break algorithm', 'syllable split', 'line-end division'],
  opentype_feature: ['glyph substitution rule', 'font feature toggle', 'OT layout flag'],
  variable_font_axis: ['design space coordinate', 'font interpolation slider', 'axis instance'],
  text_outline: ['character stroke', 'type contour', 'glyph border'],
  drop_cap: ['initial capital', 'oversized first letter', 'decorative lead-in'],
  small_caps: ['petite capitals', 'reduced uppercase', 'small-height caps'],
  ligatures: ['character joins', 'glyph fusions', 'connected letterforms'],
  // image_processing
  color_correction: ['tone adjustment', 'chromatic balance', 'color calibration'],
  white_balance: ['temperature compensation', 'color cast removal', 'neutral calibration'],
  curves: ['tonal response curve', 'channel transfer function', 'brightness mapping'],
  levels: ['histogram stretch', 'input-output mapping', 'tonal range clamp'],
  histogram_eq: ['contrast normalization', 'dynamic range expansion', 'tonal redistribution'],
  sharpen: ['edge enhancement', 'detail amplification', 'acutance boost'],
  denoise: ['noise suppression', 'grain reduction', 'signal cleanup'],
  vignette: ['edge darkening', 'peripheral fade', 'corner fall-off'],
  lens_correction: ['distortion compensation', 'barrel/pin fix', 'optical rectification'],
  chromatic_aberration: ['color fringe removal', 'lateral dispersion fix', 'spectral realignment'],
  grain: ['film texture overlay', 'ISO simulation', 'photographic noise'],
  halftone: ['dot pattern conversion', 'screen frequency raster', 'print-style dithering'],
  dither: ['quantization noise', 'banding reducer', 'palette smoothing'],
  threshold: ['binary cutoff', 'black-white separation', 'intensity gate'],
  edge_detect: ['contour extraction', 'boundary finder', 'gradient magnitude map'],
  color_lookup: ['LUT transform', 'color grade table', 'tone mapping preset'],
  channel_mixer: ['color channel blend', 'component remapping', 'spectral crossfade'],
  gradient_map: ['tonal color mapping', 'luminance-to-hue transfer', 'value-based palette'],
  selective_color: ['targeted hue adjustment', 'per-color channel edit', 'masked chromatic shift'],
  // layout
  grid_layout: ['track-based positioning', 'row-column structure', 'cell arrangement'],
  flex_layout: ['flexible box model', 'elastic container', 'adaptive sizing'],
  auto_flow: ['automatic placement', 'self-arranging container', 'flow positioning'],
  constraint: ['positional rule', 'anchor binding', 'relational limit'],
  guide: ['alignment reference', 'snap ruler', 'positioning aide'],
  margin: ['outer spacing', 'element clearance', 'boundary buffer'],
  padding: ['inner spacing', 'content inset', 'internal buffer'],
  gap: ['inter-element spacing', 'item gutter', 'child separation'],
  alignment: ['edge registration', 'element synchronization', 'positional coordination'],
  distribution: ['equal spacing allocation', 'uniform interval', 'balanced arrangement'],
  responsive_breakpoint: ['viewport threshold', 'media query trigger', 'adaptive layout switch'],
  artboard: ['design canvas area', 'bounded composition region', 'frame workspace'],
  frame: ['bounding container', 'clip region', 'content viewport'],
  stack: ['layered element group', 'z-ordered pile', 'depth arrangement'],
  wrap: ['overflow reflow', 'line-break container', 'multi-row flow'],
  masonry_layout: ['staggered grid', 'waterfall arrangement', 'packed column flow'],
  radial_layout: ['circular arrangement', 'spoke-based distribution', 'orbital positioning'],
  spiral_layout: ['logarithmic arrangement', 'fibonacci placement', 'coiled distribution'],
  pack_layout: ['circle packing', 'nested containment', 'space-filling arrangement'],
  // motion_design
  transition: ['smooth state change', 'crossfade animation', 'visual shift'],
  morph: ['shape interpolation', 'form transition', 'tween transformation'],
  path_animation: ['motion along curve', 'trajectory-guided movement', 'spline-following motion'],
  spring_animation: ['elastic bounce motion', 'damped oscillation', 'physics-driven easing'],
  physics_simulation: ['force-based dynamics', 'gravity model', 'collision response'],
  scroll_trigger: ['viewport-driven activation', 'scroll-linked event', 'intersection callback'],
  gesture_animation: ['touch-driven motion', 'swipe response', 'drag-coupled animation'],
  state_machine: ['condition-driven mode switch', 'finite automaton', 'behavioral state graph'],
  timeline_marker: ['animation cue point', 'keyframe bookmark', 'playhead anchor'],
  loop: ['repeat cycle', 'iteration wrap', 'continuous playback'],
  reverse: ['backward playback', 'inverted sequence', 'direction flip'],
  stagger: ['cascading delay', 'sequential offset', 'wave-spread timing'],
  parallax: ['depth-based scroll offset', 'layered speed differential', 'perspective scroll'],
  inertia: ['momentum continuation', 'velocity decay', 'friction slowdown'],
  snap_point: ['position detent', 'magnetic stop', 'grid-aligned rest'],
  motion_blur_anim: ['velocity smear', 'directional blur effect', 'speed streak'],
  squash_stretch: ['elastic deformation', 'impact distortion', 'cartoon physics'],
  anticipation: ['wind-up motion', 'preparatory move', 'pre-action cue'],
  // vector_operations
  boolean_union: ['shape merger', 'path combination', 'additive join'],
  boolean_subtract: ['shape cutout', 'path difference', 'subtractive clip'],
  boolean_intersect: ['overlap extraction', 'common area select', 'shared region clip'],
  boolean_exclude: ['non-overlapping extract', 'mutual exclusion', 'XOR region'],
  path_offset: ['outline expansion', 'contour inset/outset', 'parallel path'],
  path_simplify: ['point reduction', 'curve cleanup', 'node pruning'],
  path_smooth: ['curve refinement', 'bezier optimization', 'handle adjustment'],
  path_reverse: ['direction flip', 'winding swap', 'traversal inversion'],
  anchor_add: ['node insertion', 'control point creation', 'path point addition'],
  anchor_delete: ['node removal', 'control point elimination', 'path point deletion'],
  anchor_convert: ['node type switch', 'handle mode toggle', 'smooth-corner conversion'],
  handle_adjust: ['tangent control', 'bezier arm tuning', 'curve tension change'],
  outline_stroke: ['stroke expansion', 'path widening', 'line-to-fill conversion'],
  expand_appearance: ['style flattening', 'effect rasterization', 'appearance baking'],
  flatten_transparency: ['opacity merge', 'blend resolution', 'alpha compositing'],
  trace_bitmap: ['raster-to-vector conversion', 'auto-trace', 'image vectorization'],
  vectorize: ['outline extraction', 'shape detection', 'curve fitting'],
  corner_radius: ['edge rounding', 'fillet application', 'smooth corner'],
  // prototyping
  interaction: ['user event binding', 'click/tap response', 'input handler'],
  hotspot: ['clickable region', 'touch target', 'interactive area'],
  overlay: ['floating layer', 'modal surface', 'popup panel'],
  scroll_area: ['scrollable container', 'overflow region', 'bounded scroll'],
  fixed_element: ['pinned component', 'sticky item', 'viewport-locked element'],
  variable: ['dynamic value', 'stateful property', 'bound parameter'],
  condition: ['logic gate', 'state predicate', 'conditional branch'],
  action: ['triggered operation', 'event response', 'command dispatch'],
  device_frame: ['hardware mockup', 'device bezel', 'screen wrapper'],
  flow: ['navigation sequence', 'screen chain', 'user journey path'],
  component_state: ['variant mode', 'interactive pose', 'visual configuration'],
  variant: ['component variation', 'alternate version', 'style permutation'],
  swap_instance: ['component replacement', 'instance exchange', 'widget substitution'],
  smart_animate: ['auto-tween', 'layer-matched transition', 'implicit motion'],
  voice_command: ['spoken trigger', 'audio activation', 'verbal instruction'],
  haptic_feedback: ['tactile response', 'vibration signal', 'touch sensation'],
};

// ============================================================================
// Shell Definitions (composite groupings)
// ============================================================================

interface ShellSpec {
  id: string;
  surfaceLabel: string;
  surfaceDescription: string;
  toolNouns: string[];  // nouns from the category to include
  tags: string[];
  technicalTags: string[];
}

const SHELL_SPECS: Record<string, ShellSpec[]> = {
  data_visualization: [
    {
      id: 'shell.interactive_data_dashboard',
      surfaceLabel: 'Interactive data dashboard',
      surfaceDescription: 'Visualize and compare data interactively with multiple chart types',
      toolNouns: ['bar_chart', 'line_chart', 'pie_chart', 'area_chart'],
      tags: ['dashboard', 'interactive', 'data overview', 'comparison'],
      technicalTags: ['multi-chart', 'axis-binding', 'series-config', 'palette-mapping'],
    },
    {
      id: 'shell.statistical_analysis_view',
      surfaceLabel: 'Statistical analysis view',
      surfaceDescription: 'Explore data distributions and correlations',
      toolNouns: ['scatter_plot', 'histogram', 'box_plot', 'violin_plot'],
      tags: ['statistics', 'distribution', 'correlation', 'analysis'],
      technicalTags: ['regression-overlay', 'bin-config', 'quartile-compute', 'density-estimate'],
    },
    {
      id: 'shell.hierarchical_flow_display',
      surfaceLabel: 'Hierarchical flow display',
      surfaceDescription: 'Show relationships and hierarchies in data',
      toolNouns: ['treemap', 'sankey_diagram', 'chord_diagram', 'sunburst_chart', 'funnel_chart'],
      tags: ['hierarchy', 'flow', 'relationship', 'structure'],
      technicalTags: ['node-weight', 'edge-flow', 'partition-algorithm', 'arc-computation'],
    },
    {
      id: 'shell.project_timeline_tracker',
      surfaceLabel: 'Project timeline tracker',
      surfaceDescription: 'Track project phases, milestones, and progress over time',
      toolNouns: ['gantt_chart', 'waterfall_chart', 'radar_chart'],
      tags: ['timeline', 'project', 'progress', 'tracking'],
      technicalTags: ['duration-block', 'delta-computation', 'multi-axis-profile'],
    },
  ],
  '3d_rendering': [
    {
      id: 'shell.3d_scene_builder',
      surfaceLabel: '3D scene builder',
      surfaceDescription: 'Build and compose three-dimensional scenes with objects and materials',
      toolNouns: ['cube', 'sphere', 'cylinder', 'cone', 'torus', 'plane', 'mesh'],
      tags: ['3d scene', 'modeling', 'composition', 'objects'],
      technicalTags: ['mesh-subdivision', 'transform-matrix', 'geometry-instancing', 'PBR-binding'],
    },
    {
      id: 'shell.lighting_environment',
      surfaceLabel: 'Lighting and environment',
      surfaceDescription: 'Set up lighting, atmosphere, and environmental effects for a scene',
      toolNouns: ['point_light', 'directional_light', 'ambient_light', 'spot_light', 'skybox', 'fog', 'reflection_probe'],
      tags: ['lighting', 'atmosphere', 'environment', 'mood'],
      technicalTags: ['photometric-config', 'shadow-map', 'IBL-capture', 'attenuation-falloff'],
    },
    {
      id: 'shell.surface_appearance',
      surfaceLabel: 'Surface appearance',
      surfaceDescription: 'Define how surfaces look with materials, textures, and shaders',
      toolNouns: ['material', 'texture', 'shader', 'terrain'],
      tags: ['surface', 'appearance', 'visual quality', 'realism'],
      technicalTags: ['albedo-map', 'normal-perturbation', 'metallic-roughness', 'UV-mapping'],
    },
  ],
  collaboration: [
    {
      id: 'shell.design_review_workflow',
      surfaceLabel: 'Design review workflow',
      surfaceDescription: 'Collaborate on design reviews with comments, annotations, and approvals',
      toolNouns: ['comment', 'annotation', 'review', 'approval', 'change_request'],
      tags: ['review', 'feedback', 'approval', 'team discussion'],
      technicalTags: ['threaded-annotation', 'resolution-state', 'approval-chain', 'delta-diff'],
    },
    {
      id: 'shell.version_control',
      surfaceLabel: 'Version control',
      surfaceDescription: 'Manage document versions, branches, and conflict resolution',
      toolNouns: ['version', 'branch', 'snapshot', 'conflict'],
      tags: ['version', 'history', 'branching', 'rollback'],
      technicalTags: ['delta-compression', 'three-way-merge', 'branch-metadata', 'conflict-protocol'],
    },
    {
      id: 'shell.real_time_collaboration',
      surfaceLabel: 'Real-time collaboration',
      surfaceDescription: 'Work together in real time with live cursors, notifications, and sharing',
      toolNouns: ['cursor', 'selection_share', 'notification', 'channel', 'permission', 'workspace'],
      tags: ['real-time', 'live editing', 'shared workspace', 'team'],
      technicalTags: ['WebSocket-presence', 'cursor-broadcast', 'permission-matrix', 'CRDT-sync'],
    },
  ],
  accessibility: [
    {
      id: 'shell.content_accessibility',
      surfaceLabel: 'Content accessibility',
      surfaceDescription: 'Make content accessible with descriptions, labels, and captions',
      toolNouns: ['alt_text', 'aria_label', 'screen_reader_hint', 'caption', 'audio_description'],
      tags: ['accessible content', 'descriptions', 'labels', 'assistive'],
      technicalTags: ['semantic-descriptor', 'ARIA-role', 'caption-sync', 'alt-generation'],
    },
    {
      id: 'shell.visual_accessibility',
      surfaceLabel: 'Visual accessibility',
      surfaceDescription: 'Ensure visual designs are accessible for all users',
      toolNouns: ['contrast_check', 'color_blind_mode', 'high_contrast', 'magnification'],
      tags: ['visual accessibility', 'contrast', 'color-safe', 'readability'],
      technicalTags: ['WCAG-evaluation', 'luminance-ratio', 'CVD-simulation', 'zoom-scaling'],
    },
    {
      id: 'shell.navigation_accessibility',
      surfaceLabel: 'Navigation accessibility',
      surfaceDescription: 'Set up keyboard navigation, focus management, and reading order',
      toolNouns: ['focus_order', 'keyboard_shortcut', 'skip_link', 'landmark', 'reading_order', 'text_to_speech'],
      tags: ['navigation', 'keyboard', 'focus', 'reading order'],
      technicalTags: ['tab-sequence', 'shortcut-binding', 'skip-anchor', 'landmark-registration'],
    },
  ],
  typography: [
    {
      id: 'shell.type_styling',
      surfaceLabel: 'Type styling',
      surfaceDescription: 'Style text with fonts, weights, and decorative treatments',
      toolNouns: ['font_family', 'font_weight', 'font_style', 'text_decoration', 'text_shadow', 'text_outline'],
      tags: ['text style', 'fonts', 'type treatment', 'decorative'],
      technicalTags: ['font-stack', 'weight-interpolation', 'oblique-config', 'glyph-stroke'],
    },
    {
      id: 'shell.text_spacing_rhythm',
      surfaceLabel: 'Text spacing and rhythm',
      surfaceDescription: 'Fine-tune text spacing, rhythm, and readability',
      toolNouns: ['line_height', 'letter_spacing', 'word_spacing', 'text_indent', 'text_wrap', 'hyphenation'],
      tags: ['spacing', 'rhythm', 'readability', 'composition'],
      technicalTags: ['leading-metric', 'tracking-value', 'BiDi-algorithm', 'soft-wrap-rule'],
    },
    {
      id: 'shell.advanced_typography',
      surfaceLabel: 'Advanced typography',
      surfaceDescription: 'Use advanced typographic features like variable fonts and OpenType',
      toolNouns: ['font_variant', 'opentype_feature', 'variable_font_axis', 'text_transform', 'drop_cap', 'small_caps', 'ligatures'],
      tags: ['OpenType', 'variable fonts', 'typographic features', 'advanced'],
      technicalTags: ['OT-layout', 'axis-interpolation', 'glyph-substitution', 'feature-registry'],
    },
  ],
  image_processing: [
    {
      id: 'shell.color_tone_adjustment',
      surfaceLabel: 'Color and tone adjustment',
      surfaceDescription: 'Adjust colors, tones, and overall image appearance',
      toolNouns: ['color_correction', 'white_balance', 'curves', 'levels', 'histogram_eq', 'color_lookup', 'gradient_map'],
      tags: ['color grading', 'tone', 'brightness', 'color balance'],
      technicalTags: ['transfer-function', 'LUT-interpolation', 'histogram-stretch', 'channel-curve'],
    },
    {
      id: 'shell.detail_texture_enhancement',
      surfaceLabel: 'Detail and texture enhancement',
      surfaceDescription: 'Enhance or add texture details to images',
      toolNouns: ['sharpen', 'denoise', 'grain', 'halftone', 'dither'],
      tags: ['detail', 'texture', 'sharpness', 'film effect'],
      technicalTags: ['convolution-kernel', 'noise-suppression', 'ISO-simulation', 'screen-frequency'],
    },
    {
      id: 'shell.artistic_effects',
      surfaceLabel: 'Artistic image effects',
      surfaceDescription: 'Apply creative and artistic effects to images',
      toolNouns: ['vignette', 'lens_correction', 'chromatic_aberration', 'threshold', 'edge_detect', 'channel_mixer', 'selective_color'],
      tags: ['artistic', 'creative effects', 'photo manipulation', 'filters'],
      technicalTags: ['edge-extraction', 'distortion-fix', 'channel-blend', 'masked-hue-shift'],
    },
  ],
  layout: [
    {
      id: 'shell.grid_flex_system',
      surfaceLabel: 'Grid and flex system',
      surfaceDescription: 'Create responsive layouts with grid and flexbox systems',
      toolNouns: ['grid_layout', 'flex_layout', 'auto_flow', 'responsive_breakpoint'],
      tags: ['responsive layout', 'grid', 'flexbox', 'adaptive'],
      technicalTags: ['track-sizing', 'auto-placement', 'media-query', 'container-query'],
    },
    {
      id: 'shell.spacing_alignment',
      surfaceLabel: 'Spacing and alignment',
      surfaceDescription: 'Control spacing, alignment, and distribution of elements',
      toolNouns: ['margin', 'padding', 'gap', 'alignment', 'distribution', 'guide', 'constraint'],
      tags: ['spacing', 'alignment', 'distribution', 'precise positioning'],
      technicalTags: ['anchor-binding', 'snap-ruler', 'interval-compute', 'constraint-solver'],
    },
    {
      id: 'shell.creative_layout',
      surfaceLabel: 'Creative layout',
      surfaceDescription: 'Use creative layout patterns like masonry, radial, and spiral',
      toolNouns: ['masonry_layout', 'radial_layout', 'spiral_layout', 'pack_layout', 'artboard', 'frame', 'stack', 'wrap'],
      tags: ['creative arrangement', 'unique layout', 'artistic composition', 'special arrangement'],
      technicalTags: ['column-packing', 'spoke-distribution', 'fibonacci-placement', 'z-ordering'],
    },
  ],
  motion_design: [
    {
      id: 'shell.basic_motion',
      surfaceLabel: 'Basic motion',
      surfaceDescription: 'Add smooth transitions and shape morphing to your design',
      toolNouns: ['transition', 'morph', 'path_animation', 'loop', 'reverse'],
      tags: ['transition', 'smooth motion', 'morphing', 'basic animation'],
      technicalTags: ['keyframe-sequence', 'bezier-interpolation', 'path-following', 'iteration-wrap'],
    },
    {
      id: 'shell.physics_motion',
      surfaceLabel: 'Physics-based motion',
      surfaceDescription: 'Create natural-feeling motion with physics and spring dynamics',
      toolNouns: ['spring_animation', 'physics_simulation', 'inertia', 'squash_stretch', 'anticipation', 'motion_blur_anim'],
      tags: ['physics', 'natural motion', 'spring', 'realistic movement'],
      technicalTags: ['spring-config', 'force-dynamics', 'velocity-decay', 'deformation-vector'],
    },
    {
      id: 'shell.interactive_motion',
      surfaceLabel: 'Interactive motion',
      surfaceDescription: 'Trigger animations based on user interaction and scrolling',
      toolNouns: ['scroll_trigger', 'gesture_animation', 'state_machine', 'snap_point', 'parallax', 'stagger', 'timeline_marker'],
      tags: ['interactive', 'scroll-driven', 'gesture', 'user-triggered'],
      technicalTags: ['intersection-threshold', 'gesture-recognizer', 'finite-automaton', 'cascade-delay'],
    },
  ],
  vector_operations: [
    {
      id: 'shell.boolean_path_ops',
      surfaceLabel: 'Boolean path operations',
      surfaceDescription: 'Combine and cut shapes using boolean operations',
      toolNouns: ['boolean_union', 'boolean_subtract', 'boolean_intersect', 'boolean_exclude'],
      tags: ['combine shapes', 'cut out', 'intersection', 'merge'],
      technicalTags: ['Greiner-Hormann', 'winding-number', 'fill-rule', 'clip-polygon'],
    },
    {
      id: 'shell.path_editing',
      surfaceLabel: 'Path editing',
      surfaceDescription: 'Edit and refine vector paths and anchor points',
      toolNouns: ['path_offset', 'path_simplify', 'path_smooth', 'path_reverse', 'anchor_add', 'anchor_delete', 'anchor_convert', 'handle_adjust', 'corner_radius'],
      tags: ['path editing', 'anchor points', 'curve refinement', 'node editing'],
      technicalTags: ['RDP-simplification', 'bezier-optimization', 'offset-miter', 'tangent-control'],
    },
    {
      id: 'shell.vector_conversion',
      surfaceLabel: 'Vector conversion',
      surfaceDescription: 'Convert between raster and vector formats',
      toolNouns: ['outline_stroke', 'expand_appearance', 'flatten_transparency', 'trace_bitmap', 'vectorize'],
      tags: ['conversion', 'tracing', 'vectorize', 'flatten'],
      technicalTags: ['stroke-expansion', 'appearance-baking', 'alpha-compositing', 'centerline-detect'],
    },
  ],
  prototyping: [
    {
      id: 'shell.interaction_design',
      surfaceLabel: 'Interaction design',
      surfaceDescription: 'Design user interactions with clickable areas and responses',
      toolNouns: ['interaction', 'hotspot', 'action', 'gesture_animation', 'voice_command', 'haptic_feedback'],
      tags: ['interactions', 'user actions', 'click targets', 'responses'],
      technicalTags: ['trigger-action', 'gesture-recognizer', 'event-dispatch', 'haptic-signal'],
    },
    {
      id: 'shell.prototype_layout',
      surfaceLabel: 'Prototype layout',
      surfaceDescription: 'Set up scrolling, fixed elements, and device frames for prototypes',
      toolNouns: ['overlay', 'scroll_area', 'fixed_element', 'device_frame', 'flow'],
      tags: ['prototype frame', 'scrolling', 'fixed header', 'device preview'],
      technicalTags: ['overflow-region', 'viewport-lock', 'device-bezel', 'screen-chain'],
    },
    {
      id: 'shell.component_logic',
      surfaceLabel: 'Component logic',
      surfaceDescription: 'Add logic and state management to prototype components',
      toolNouns: ['variable', 'condition', 'component_state', 'variant', 'swap_instance', 'smart_animate'],
      tags: ['logic', 'states', 'variants', 'conditional behavior'],
      technicalTags: ['state-machine', 'guard-condition', 'property-interpolation', 'layer-matching'],
    },
  ],
};

// ============================================================================
// Category Definitions
// ============================================================================

interface CategorySpec {
  category: string;
  verbs: string[];
  nouns: string[];
  descriptionTemplates: string[];
  paramPool: Array<{ name: string; type: string; description: string }>;
  tags: string[];
}

const EXTENDED_CATEGORIES: CategorySpec[] = [
  {
    category: 'data_visualization',
    verbs: ['create', 'update', 'configure', 'render', 'export'],
    nouns: [
      'bar_chart', 'line_chart', 'pie_chart', 'scatter_plot', 'histogram',
      'heatmap', 'treemap', 'bubble_chart', 'radar_chart', 'funnel_chart',
      'waterfall_chart', 'gantt_chart', 'sankey_diagram', 'chord_diagram',
      'sunburst_chart', 'area_chart', 'box_plot', 'violin_plot',
    ],
    descriptionTemplates: [
      'Create a {noun} visualization with the specified data and styling',
      'Render an interactive {noun} with customizable axes and legends',
      'Generate a {noun} from the provided dataset',
      'Configure the appearance and behavior of a {noun}',
      'Export a {noun} as a static image or interactive widget',
    ],
    paramPool: [
      { name: 'data', type: 'array', description: 'Data points for the visualization' },
      { name: 'title', type: 'string', description: 'Chart title' },
      { name: 'xAxis', type: 'string', description: 'X-axis label' },
      { name: 'yAxis', type: 'string', description: 'Y-axis label' },
      { name: 'colorScheme', type: 'string', description: 'Color palette name' },
      { name: 'width', type: 'number', description: 'Chart width in pixels' },
      { name: 'height', type: 'number', description: 'Chart height in pixels' },
      { name: 'legend', type: 'boolean', description: 'Show legend' },
    ],
    tags: ['visualization', 'chart', 'data', 'graph'],
  },
  {
    category: '3d_rendering',
    verbs: ['create', 'transform', 'apply', 'set', 'animate'],
    nouns: [
      'cube', 'sphere', 'cylinder', 'cone', 'torus', 'plane', 'mesh',
      'point_light', 'directional_light', 'ambient_light', 'spot_light',
      'camera_3d', 'material', 'texture', 'shader', 'particle_system',
      'skybox', 'terrain', 'fog', 'reflection_probe',
    ],
    descriptionTemplates: [
      'Create a 3D {noun} with specified geometry and material',
      'Apply transformations to a {noun} in the 3D scene',
      'Configure {noun} properties for realistic rendering',
      'Animate a {noun} with keyframe-based 3D transforms',
      'Set {noun} parameters for the rendering pipeline',
    ],
    paramPool: [
      { name: 'position', type: 'object', description: 'XYZ position in 3D space' },
      { name: 'rotation', type: 'object', description: 'Euler rotation angles' },
      { name: 'scale', type: 'object', description: 'XYZ scale factors' },
      { name: 'color', type: 'string', description: 'Material color' },
      { name: 'intensity', type: 'number', description: 'Light or effect intensity' },
      { name: 'metalness', type: 'number', description: 'Material metalness (0-1)' },
      { name: 'roughness', type: 'number', description: 'Material roughness (0-1)' },
    ],
    tags: ['3d', 'rendering', 'geometry', 'material'],
  },
  {
    category: 'collaboration',
    verbs: ['create', 'share', 'lock', 'merge', 'resolve', 'assign'],
    nouns: [
      'comment', 'annotation', 'review', 'version', 'branch', 'snapshot',
      'permission', 'workspace', 'channel', 'notification', 'cursor',
      'selection_share', 'conflict', 'change_request', 'approval',
    ],
    descriptionTemplates: [
      'Create a {noun} for collaborative editing',
      'Share a {noun} with team members',
      'Lock a {noun} to prevent conflicting edits',
      'Merge changes from a {noun} into the main document',
      'Resolve a {noun} during collaborative editing',
      'Assign a {noun} to a specific team member',
    ],
    paramPool: [
      { name: 'userId', type: 'string', description: 'User identifier' },
      { name: 'message', type: 'string', description: 'Comment or annotation text' },
      { name: 'targetId', type: 'string', description: 'Target element ID' },
      { name: 'permissions', type: 'array', description: 'Permission levels' },
      { name: 'timestamp', type: 'number', description: 'Unix timestamp' },
    ],
    tags: ['collaboration', 'team', 'sharing', 'editing'],
  },
  {
    category: 'accessibility',
    verbs: ['add', 'check', 'configure', 'generate', 'validate'],
    nouns: [
      'alt_text', 'aria_label', 'contrast_check', 'screen_reader_hint',
      'focus_order', 'keyboard_shortcut', 'color_blind_mode', 'high_contrast',
      'text_to_speech', 'magnification', 'caption', 'audio_description',
      'skip_link', 'landmark', 'reading_order',
    ],
    descriptionTemplates: [
      'Add {noun} to improve accessibility of the design',
      'Check {noun} compliance with WCAG guidelines',
      'Configure {noun} settings for accessible output',
      'Generate {noun} automatically from design content',
      'Validate {noun} against accessibility standards',
    ],
    paramPool: [
      { name: 'elementId', type: 'string', description: 'Target element ID' },
      { name: 'text', type: 'string', description: 'Descriptive text' },
      { name: 'level', type: 'string', description: 'WCAG conformance level (A, AA, AAA)' },
      { name: 'language', type: 'string', description: 'Content language' },
    ],
    tags: ['accessibility', 'a11y', 'wcag', 'inclusive'],
  },
  {
    category: 'typography',
    verbs: ['set', 'apply', 'create', 'adjust', 'convert'],
    nouns: [
      'font_family', 'font_weight', 'font_style', 'line_height', 'letter_spacing',
      'word_spacing', 'text_decoration', 'text_transform', 'text_shadow',
      'font_variant', 'text_indent', 'text_wrap', 'hyphenation',
      'opentype_feature', 'variable_font_axis', 'text_outline',
      'drop_cap', 'small_caps', 'ligatures',
    ],
    descriptionTemplates: [
      'Set {noun} for the selected text element',
      'Apply {noun} styling to improve typography',
      'Create a {noun} preset for consistent text styling',
      'Adjust {noun} for optimal readability',
      'Convert text using {noun} transformation',
    ],
    paramPool: [
      { name: 'value', type: 'string', description: 'Property value' },
      { name: 'elementId', type: 'string', description: 'Target text element' },
      { name: 'size', type: 'number', description: 'Font size in points' },
      { name: 'unit', type: 'string', description: 'CSS unit (px, em, rem)' },
    ],
    tags: ['typography', 'text', 'font', 'styling'],
  },
  {
    category: 'image_processing',
    verbs: ['apply', 'adjust', 'crop', 'resize', 'transform'],
    nouns: [
      'color_correction', 'white_balance', 'curves', 'levels', 'histogram_eq',
      'sharpen', 'denoise', 'vignette', 'lens_correction', 'chromatic_aberration',
      'grain', 'halftone', 'dither', 'threshold', 'edge_detect',
      'color_lookup', 'channel_mixer', 'gradient_map', 'selective_color',
    ],
    descriptionTemplates: [
      'Apply {noun} processing to the image layer',
      'Adjust {noun} parameters for the selected image',
      'Transform the image using {noun} algorithm',
      'Apply non-destructive {noun} adjustment',
      'Configure {noun} settings for batch processing',
    ],
    paramPool: [
      { name: 'intensity', type: 'number', description: 'Effect intensity (0-1)' },
      { name: 'radius', type: 'number', description: 'Effect radius in pixels' },
      { name: 'threshold', type: 'number', description: 'Threshold value' },
      { name: 'layerId', type: 'string', description: 'Target layer ID' },
      { name: 'blendMode', type: 'string', description: 'Blend mode for adjustment' },
    ],
    tags: ['image', 'processing', 'adjustment', 'photo'],
  },
  {
    category: 'layout',
    verbs: ['create', 'set', 'apply', 'distribute', 'align'],
    nouns: [
      'grid_layout', 'flex_layout', 'auto_flow', 'constraint', 'guide',
      'margin', 'padding', 'gap', 'alignment', 'distribution',
      'responsive_breakpoint', 'artboard', 'frame', 'stack', 'wrap',
      'masonry_layout', 'radial_layout', 'spiral_layout', 'pack_layout',
    ],
    descriptionTemplates: [
      'Create a {noun} for organizing elements on the canvas',
      'Set {noun} properties for precise element positioning',
      'Apply {noun} rules to the selected elements',
      'Distribute elements using {noun} algorithm',
      'Align elements with {noun} constraints',
    ],
    paramPool: [
      { name: 'spacing', type: 'number', description: 'Spacing between elements' },
      { name: 'columns', type: 'number', description: 'Number of columns' },
      { name: 'rows', type: 'number', description: 'Number of rows' },
      { name: 'direction', type: 'string', description: 'Layout direction (row, column)' },
      { name: 'wrap', type: 'boolean', description: 'Enable wrapping' },
    ],
    tags: ['layout', 'positioning', 'grid', 'alignment'],
  },
  {
    category: 'motion_design',
    verbs: ['create', 'apply', 'configure', 'trigger', 'sequence'],
    nouns: [
      'transition', 'morph', 'path_animation', 'spring_animation',
      'physics_simulation', 'scroll_trigger', 'gesture_animation',
      'state_machine', 'timeline_marker', 'loop', 'reverse',
      'stagger', 'parallax', 'inertia', 'snap_point',
      'motion_blur_anim', 'squash_stretch', 'anticipation',
    ],
    descriptionTemplates: [
      'Create a {noun} for smooth UI transitions',
      'Apply {noun} to the selected animation timeline',
      'Configure {noun} parameters for natural motion',
      'Trigger a {noun} based on user interaction',
      'Sequence multiple elements with {noun} timing',
    ],
    paramPool: [
      { name: 'duration', type: 'number', description: 'Animation duration in ms' },
      { name: 'easing', type: 'string', description: 'Easing function name' },
      { name: 'delay', type: 'number', description: 'Start delay in ms' },
      { name: 'iterations', type: 'number', description: 'Number of repetitions' },
      { name: 'direction', type: 'string', description: 'Animation direction' },
    ],
    tags: ['motion', 'animation', 'transition', 'interaction'],
  },
  {
    category: 'vector_operations',
    verbs: ['perform', 'apply', 'create', 'convert', 'simplify'],
    nouns: [
      'boolean_union', 'boolean_subtract', 'boolean_intersect', 'boolean_exclude',
      'path_offset', 'path_simplify', 'path_smooth', 'path_reverse',
      'anchor_add', 'anchor_delete', 'anchor_convert', 'handle_adjust',
      'outline_stroke', 'expand_appearance', 'flatten_transparency',
      'trace_bitmap', 'vectorize', 'corner_radius',
    ],
    descriptionTemplates: [
      'Perform {noun} on the selected vector paths',
      'Apply {noun} transformation to the path',
      'Create a new path using {noun} operation',
      'Convert the selection using {noun}',
      'Simplify the path with {noun} algorithm',
    ],
    paramPool: [
      { name: 'pathIds', type: 'array', description: 'IDs of paths to operate on' },
      { name: 'tolerance', type: 'number', description: 'Simplification tolerance' },
      { name: 'offset', type: 'number', description: 'Offset distance' },
      { name: 'cornerType', type: 'string', description: 'Corner style (round, miter, bevel)' },
    ],
    tags: ['vector', 'path', 'boolean', 'geometry'],
  },
  {
    category: 'prototyping',
    verbs: ['create', 'connect', 'configure', 'preview', 'record'],
    nouns: [
      'interaction', 'hotspot', 'overlay', 'scroll_area', 'fixed_element',
      'variable', 'condition', 'action', 'device_frame', 'flow',
      'component_state', 'variant', 'swap_instance', 'smart_animate',
      'voice_command', 'haptic_feedback',
    ],
    descriptionTemplates: [
      'Create a {noun} for the interactive prototype',
      'Connect screens with a {noun} interaction',
      'Configure {noun} behavior for the prototype',
      'Preview the prototype with {noun} enabled',
      'Record user interactions with {noun} tracking',
    ],
    paramPool: [
      { name: 'trigger', type: 'string', description: 'Interaction trigger (click, hover, drag)' },
      { name: 'targetScreen', type: 'string', description: 'Target screen ID' },
      { name: 'animation', type: 'string', description: 'Transition animation type' },
      { name: 'duration', type: 'number', description: 'Transition duration' },
    ],
    tags: ['prototyping', 'interaction', 'preview', 'flow'],
  },
];

// ============================================================================
// Example Instruction Templates per Category
// ============================================================================

const EXAMPLE_TEMPLATES: Record<string, string[]> = {
  data_visualization: [
    'Create a {noun} showing sales data by quarter',
    'Render a {noun} with the given dataset',
    'Display the statistics as a {noun}',
  ],
  '3d_rendering': [
    'Add a 3D {noun} to the scene',
    'Place a {noun} with metallic material',
    'Create a glowing {noun} in the center',
  ],
  collaboration: [
    'Add a {noun} for the design review',
    'Share the current {noun} with the team',
    'Create a new {noun} on the selected element',
  ],
  accessibility: [
    'Add {noun} to the selected element',
    'Check {noun} for the entire page',
    'Generate {noun} for all images',
  ],
  typography: [
    'Set the {noun} to a modern sans-serif',
    'Apply {noun} to the heading text',
    'Adjust the {noun} for better readability',
  ],
  image_processing: [
    'Apply {noun} to the photo layer',
    'Adjust {noun} for a warmer tone',
    'Process the image with {noun}',
  ],
  layout: [
    'Create a {noun} with 3 columns',
    'Apply {noun} to align the elements',
    'Set up a {noun} for the card grid',
  ],
  motion_design: [
    'Create a smooth {noun} between states',
    'Apply a {noun} to the button hover',
    'Configure a {noun} with spring physics',
  ],
  vector_operations: [
    'Perform {noun} on the selected shapes',
    'Apply {noun} to clean up the path',
    'Use {noun} to combine the layers',
  ],
  prototyping: [
    'Create a {noun} linking the two screens',
    'Add a {noun} to the button element',
    'Configure the {noun} for the modal',
  ],
};

// ============================================================================
// Generator Utilities
// ============================================================================

function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 0xffffffff;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function pickN<T>(arr: T[], n: number, rng: () => number): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n);
}

// ============================================================================
// Method Generation
// ============================================================================

/**
 * Generate rich methods for a synthetic tool using semantic parameter pools.
 */
function generateMethodsForTool(
  tool: SyntheticToolDefinition,
  methodCount: number,
  rng: () => number,
  methodIdCounter: { value: number },
): SyntheticMethod[] {
  const methods: SyntheticMethod[] = [];
  const pools = CATEGORY_SEMANTIC_POOLS[tool.category] || ['control'];
  const templates = EXAMPLE_TEMPLATES[tool.category] || ['Use {noun} tool'];
  const noun = tool.name.split('_').slice(2).join(' ');
  const verb = tool.name.split('_')[1] || 'create';

  for (let mi = 0; mi < methodCount; mi++) {
    methodIdCounter.value++;
    const methodId = `synth.${tool.category}.${methodIdCounter.value}`;
    const suffix = mi === 0 ? '' : mi === 1 ? ' Advanced' : ' Expert';
    const methodName = `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${noun}${suffix}`;

    // Build parameters from semantic pools + category-specific params
    const params: SyntheticMethodParameter[] = [];
    const usedParamNames = new Set<string>();

    // Draw 2-4 params from semantic pools
    const selectedPools = pickN(pools, Math.min(2 + mi, pools.length), rng);
    for (const poolName of selectedPools) {
      const pool = SEMANTIC_PARAM_POOLS[poolName];
      const drawn = pickN(pool, 1 + Math.floor(rng() * 2), rng);
      for (const p of drawn) {
        if (!usedParamNames.has(p.name)) {
          usedParamNames.add(p.name);
          params.push({ ...p });
        }
      }
    }

    // Add 1-2 category-specific params from the tool's paramPool
    const catParams = tool.inputSchema.properties;
    const catParamNames = Object.keys(catParams);
    const extraCount = 1 + Math.floor(rng() * 2);
    for (let ei = 0; ei < extraCount && ei < catParamNames.length; ei++) {
      const pName = catParamNames[(mi + ei) % catParamNames.length];
      if (!usedParamNames.has(pName)) {
        usedParamNames.add(pName);
        params.push({
          name: pName,
          type: catParams[pName].type as SyntheticMethodParameter['type'],
          required: ei === 0,
          description: catParams[pName].description,
        });
      }
    }

    // Mark first 1-2 params as required
    for (let ri = 0; ri < Math.min(2, params.length); ri++) {
      params[ri].required = true;
    }

    // Generate example instructions using aliases when available
    const examples: Array<{ instruction: string; code: string }> = [];
    const numExamples = 1 + Math.floor(rng() * 2);
    const rawNoun = tool.name.split('_').slice(2).join('_');
    const aliases = NOUN_ALIASES[rawNoun];
    for (let ei = 0; ei < numExamples; ei++) {
      const tmpl = pick(templates, rng);
      // Use alias 70% of the time, raw noun 30%
      const displayNoun = aliases && aliases.length > 0 && rng() < 0.7
        ? pick(aliases, rng)
        : noun;
      const instruction = tmpl.replace(/\{noun\}/g, displayNoun);
      examples.push({
        instruction,
        code: `await mcp.call("${tool.name}", { ${params.filter(p => p.required).map(p => `${p.name}: ${JSON.stringify(p.default ?? 'value')}`).join(', ')} })`,
      });
    }

    methods.push({
      id: methodId,
      name: methodName,
      category: tool.category,
      mcpTool: tool.name,
      description: tool.description + (mi > 0 ? ` (variant ${mi + 1})` : ''),
      parameters: params,
      examples,
      relatedMethods: [], // filled after all methods exist
      tags: [...tool.tags, ...(mi > 0 ? ['advanced'] : [])],
    });
  }

  return methods;
}

// ============================================================================
// Similarity Computation
// ============================================================================

/**
 * Compute typed parameter overlap between two methods.
 * Returns the count of shared parameter names with matching types.
 */
function parameterOverlap(a: SyntheticMethod, b: SyntheticMethod): number {
  const aParams = new Map(a.parameters.map(p => [p.name, p.type]));
  let shared = 0;
  for (const p of b.parameters) {
    const aType = aParams.get(p.name);
    if (aType && aType === p.type) shared++;
  }
  return shared;
}

/**
 * Compute `similar` edges between all synthetic methods.
 * - >= 3 shared typed params: weight 0.7
 * - >= 2 shared typed params: weight 0.5
 * - Same category only: weight 0.3 (max 2 per method in this tier)
 * Returns top 3-5 similar methods per method.
 */
export function computeSimilarEdges(methods: SyntheticMethod[]): SimilarEdge[] {
  const edges: SimilarEdge[] = [];
  const edgesPerMethod = new Map<string, number>();

  // Pre-compute all pairwise overlaps (O(n^2) but n ~500 is fine)
  const candidates: Array<{ source: string; target: string; overlap: number; sameCategory: boolean }> = [];

  for (let i = 0; i < methods.length; i++) {
    for (let j = i + 1; j < methods.length; j++) {
      // Skip methods on the same tool
      if (methods[i].mcpTool === methods[j].mcpTool) continue;

      const overlap = parameterOverlap(methods[i], methods[j]);
      const sameCategory = methods[i].category === methods[j].category;

      if (overlap >= 2 || sameCategory) {
        candidates.push({
          source: methods[i].id,
          target: methods[j].id,
          overlap,
          sameCategory,
        });
      }
    }
  }

  // Sort by overlap descending to prioritize strong connections
  candidates.sort((a, b) => b.overlap - a.overlap);

  for (const c of candidates) {
    const srcCount = edgesPerMethod.get(c.source) || 0;
    const tgtCount = edgesPerMethod.get(c.target) || 0;

    // Cap at 5 edges per method
    if (srcCount >= 5 || tgtCount >= 5) continue;

    let weight: number;
    let reason: SimilarEdge['reason'];

    if (c.overlap >= 3) {
      weight = 0.7;
      reason = 'param_overlap_3';
    } else if (c.overlap >= 2) {
      weight = 0.5;
      reason = 'param_overlap_2';
    } else if (c.sameCategory) {
      // For same-category-only edges, cap at 2 per method
      if (srcCount >= 3 || tgtCount >= 3) continue;
      weight = 0.3;
      reason = 'same_category';
    } else {
      continue;
    }

    edges.push({ source: c.source, target: c.target, weight, reason });
    edgesPerMethod.set(c.source, srcCount + 1);
    edgesPerMethod.set(c.target, tgtCount + 1);
  }

  return edges;
}

// ============================================================================
// Cross-Domain Bridges
// ============================================================================

/**
 * Real method interface subset needed for bridge computation.
 */
interface RealMethodInfo {
  id: string;
  parameters: Array<{ name: string; type: string }>;
}

/**
 * Compute cross-domain `similar` edges between synthetic and real methods.
 * If a synthetic method shares >= 2 typed params with a real method,
 * create a bridge edge (weight 0.5, max 2 per synthetic method).
 */
export function computeCrossDomainBridges(
  syntheticMethods: SyntheticMethod[],
  realMethods: RealMethodInfo[],
): SimilarEdge[] {
  const edges: SimilarEdge[] = [];
  const edgesPerSynthetic = new Map<string, number>();

  for (const sm of syntheticMethods) {
    const smParams = new Map(sm.parameters.map(p => [p.name, p.type]));
    const methodEdges: Array<{ target: string; overlap: number }> = [];

    for (const rm of realMethods) {
      let shared = 0;
      for (const rp of rm.parameters) {
        const sType = smParams.get(rp.name);
        if (sType && sType === rp.type) shared++;
      }
      if (shared >= 2) {
        methodEdges.push({ target: rm.id, overlap: shared });
      }
    }

    // Sort by overlap and take top 2
    methodEdges.sort((a, b) => b.overlap - a.overlap);
    for (const me of methodEdges.slice(0, 2)) {
      edges.push({
        source: sm.id,
        target: me.target,
        weight: 0.5,
        reason: 'cross_domain',
      });
      edgesPerSynthetic.set(sm.id, (edgesPerSynthetic.get(sm.id) || 0) + 1);
    }
  }

  return edges;
}

// ============================================================================
// Shell Generator
// ============================================================================

/**
 * Generate shell composite nodes from SHELL_SPECS and actual generated tools.
 * Maps noun-based spec entries to full tool names.
 */
export function generateShells(
  tools: SyntheticToolWithMethods[],
): SyntheticShell[] {
  const shells: SyntheticShell[] = [];
  const toolByNoun = new Map<string, string[]>();

  // Index tools by noun
  for (const tool of tools) {
    const noun = tool.name.split('_').slice(2).join('_');
    if (!toolByNoun.has(noun)) toolByNoun.set(noun, []);
    toolByNoun.get(noun)!.push(tool.name);
  }

  for (const [category, specs] of Object.entries(SHELL_SPECS)) {
    for (const spec of specs) {
      const toolIds: string[] = [];
      for (const noun of spec.toolNouns) {
        const matches = toolByNoun.get(noun) || [];
        toolIds.push(...matches);
      }
      if (toolIds.length === 0) continue;

      // Build interior description from technical descriptions
      const techDescs = TECHNICAL_DESCRIPTIONS[category] || [];
      const interiorDescription = techDescs.slice(0, 3).join('. ');

      shells.push({
        id: spec.id,
        surfaceLabel: spec.surfaceLabel,
        surfaceDescription: spec.surfaceDescription,
        interiorDescription,
        toolIds,
        tags: spec.tags,
        technicalTags: spec.technicalTags,
        category,
      });
    }
  }

  return shells;
}

// ============================================================================
// Vocabulary Overlap Measurement
// ============================================================================

/**
 * Tokenize text into lowercase words (minimum 3 characters).
 */
function tokenizeText(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3),
  );
}

/**
 * Compute Jaccard similarity between two token sets.
 */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Measure vocabulary overlap between queries and their expected tool descriptions.
 * Returns average Jaccard similarity — target is ~0.24 (matching real taxonomy's 24.4%).
 */
export function measureVocabularyOverlap(
  queries: Array<{ prompt: string; expectedToolName: string }>,
  toolDescriptions: Map<string, string>,
): { averageOverlap: number; perQueryOverlaps: number[] } {
  const overlaps: number[] = [];

  for (const { prompt, expectedToolName } of queries) {
    const toolDesc = toolDescriptions.get(expectedToolName);
    if (!toolDesc) continue;

    const queryTokens = tokenizeText(prompt);
    const descTokens = tokenizeText(toolDesc);
    overlaps.push(jaccardSimilarity(queryTokens, descTokens));
  }

  const avg = overlaps.length > 0
    ? overlaps.reduce((s, v) => s + v, 0) / overlaps.length
    : 0;

  return { averageOverlap: avg, perQueryOverlaps: overlaps };
}

// ============================================================================
// Main Generator
// ============================================================================

/**
 * Generate synthetic MCP tool definitions (backward-compatible).
 */
export function generateSyntheticTools(
  count: number = 400,
  seed: number = 12345,
): SyntheticToolDefinition[] {
  return generateSyntheticToolsWithMethods(count, seed).tools;
}

/**
 * Generate synthetic tools with full method layer, similarity edges,
 * and optional cross-domain bridges to real methods.
 */
export function generateSyntheticToolsWithMethods(
  count: number = 400,
  seed: number = 12345,
  realMethods?: RealMethodInfo[],
): {
  tools: SyntheticToolWithMethods[];
  methods: SyntheticMethod[];
  similarEdges: SimilarEdge[];
  crossDomainBridges: SimilarEdge[];
  shells: SyntheticShell[];
} {
  const rng = seededRandom(seed);
  const tools: SyntheticToolWithMethods[] = [];
  const allMethods: SyntheticMethod[] = [];
  const usedNames = new Set<string>();
  const methodIdCounter = { value: 0 };

  // Distribute tools across categories
  const toolsPerCategory = Math.ceil(count / EXTENDED_CATEGORIES.length);

  for (const cat of EXTENDED_CATEGORIES) {
    let generated = 0;

    for (const verb of cat.verbs) {
      for (const noun of cat.nouns) {
        if (generated >= toolsPerCategory) break;
        if (tools.length >= count) break;

        const name = `pinepaper_${verb}_${noun}`;
        if (usedNames.has(name)) continue;
        usedNames.add(name);

        // Use technical description if available, fallback to generic template
        const techDescs = TECHNICAL_DESCRIPTIONS[cat.category];
        let description: string;
        if (techDescs && techDescs.length > 0) {
          description = pick(techDescs, rng);
        } else {
          const template = pick(cat.descriptionTemplates, rng);
          description = template.replace(/\{noun\}/g, noun.replace(/_/g, ' '));
        }

        // Pick 2-5 params
        const numParams = 2 + Math.floor(rng() * 4);
        const params = pickN(cat.paramPool, Math.min(numParams, cat.paramPool.length), rng);

        const properties: Record<string, { type: string; description: string }> = {};
        const required: string[] = [];

        for (let pi = 0; pi < params.length; pi++) {
          properties[params[pi].name] = {
            type: params[pi].type,
            description: params[pi].description,
          };
          if (pi < 2) required.push(params[pi].name);
        }

        const toolTags = [...cat.tags, noun.replace(/_/g, ' '), verb];

        const baseTool: SyntheticToolDefinition = {
          name,
          description,
          inputSchema: { type: 'object', properties, required },
          tags: toolTags,
          category: cat.category,
          synthetic: true,
        };

        // Decide method count: 1 (50%), 2 (35%), 3 (15%)
        const roll = rng();
        const methodCount = roll < 0.50 ? 1 : roll < 0.85 ? 2 : 3;

        const methods = generateMethodsForTool(baseTool, methodCount, rng, methodIdCounter);
        allMethods.push(...methods);

        tools.push({ ...baseTool, methods });
        generated++;
      }
    }
  }

  const trimmedTools = tools.slice(0, count);
  const trimmedToolNames = new Set(trimmedTools.map(t => t.name));
  const trimmedMethods = allMethods.filter(m => trimmedToolNames.has(m.mcpTool));

  // Compute similarity edges between synthetic methods
  const similarEdges = computeSimilarEdges(trimmedMethods);

  // Fill relatedMethods on each method from similarity edges
  const relatedMap = new Map<string, string[]>();
  for (const edge of similarEdges) {
    if (!relatedMap.has(edge.source)) relatedMap.set(edge.source, []);
    if (!relatedMap.has(edge.target)) relatedMap.set(edge.target, []);
    relatedMap.get(edge.source)!.push(edge.target);
    relatedMap.get(edge.target)!.push(edge.source);
  }
  for (const m of trimmedMethods) {
    m.relatedMethods = relatedMap.get(m.id) || [];
  }

  // Compute cross-domain bridges to real methods
  const crossDomainBridges = realMethods
    ? computeCrossDomainBridges(trimmedMethods, realMethods)
    : [];

  // Generate shell composite nodes
  const shells = generateShells(trimmedTools);

  return {
    tools: trimmedTools,
    methods: trimmedMethods,
    similarEdges,
    crossDomainBridges,
    shells,
  };
}

/**
 * Get the list of extended categories used for synthetic tools.
 */
export function getSyntheticCategories(): string[] {
  return EXTENDED_CATEGORIES.map(c => c.category);
}
