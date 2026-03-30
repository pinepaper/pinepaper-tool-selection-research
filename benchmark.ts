/**
 * Pine Paper LLM v0 — PinePaper-ToolBench
 *
 * Static benchmark dataset (~500 test cases) for evaluating KG-based tool
 * selection against flat-retrieval baselines. Organized in 6 complexity tiers:
 *
 *   T1  Single-tool, explicit mention            (~80)
 *   T2  Single-tool, implicit / natural language  (~100)
 *   T3  Multi-tool sequential (2 tools)           (~100)
 *   T4  Multi-tool compositional (3+ tools)       (~80)
 *   T5  Generator-requiring                       (~60)
 *   T6  Cross-domain / ambiguous                  (~80)
 *
 * Metrics: Recall@K, NDCG@K, MRR — standard IR measures for ranked retrieval.
 */

import type { TestCase, BenchmarkSuite } from '../../src/eval/types.js';

// ============================================================================
// Extended Types
// ============================================================================

export type Tier = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface ToolSelectionMetadata {
  tier: Tier;
  expectedTools: string[];
  acceptableToolSets: string[][];
  taxonomyMethods: string[];
  difficulty: Difficulty;
  requiresMultiHop: boolean;
  domain: string;
  crossDomain?: string[];
}

export interface ToolSelectionTestCase extends TestCase {
  metadata: ToolSelectionMetadata;
}

export interface ToolSelectionResult {
  recall_at_1: number;
  recall_at_3: number;
  recall_at_5: number;
  ndcg_at_5: number;
  mrr: number;
  totalCases: number;
  byDifficulty: Record<string, { recall_at_5: number; mrr: number }>;
}

export interface RankedTool {
  tool: string;
  score: number;
}

// ============================================================================
// Helper — build a test case
// ============================================================================

let _idCounter = 0;

function tc(
  tier: Tier,
  difficulty: Difficulty,
  category: string,
  prompt: string,
  expectedTools: string[],
  taxonomyMethods: string[],
  opts: {
    acceptableToolSets?: string[][];
    requiresMultiHop?: boolean;
    crossDomain?: string[];
  } = {},
): ToolSelectionTestCase {
  _idCounter++;
  const id = `TSB-${tier}-${String(_idCounter).padStart(4, '0')}`;
  return {
    id,
    category,
    prompt,
    expectedTool: expectedTools[0],
    acceptableTools: opts.acceptableToolSets ? opts.acceptableToolSets.flat() : undefined,
    metadata: {
      tier,
      expectedTools,
      acceptableToolSets: opts.acceptableToolSets ?? [],
      taxonomyMethods,
      difficulty,
      requiresMultiHop: opts.requiresMultiHop ?? (tier === 'T4' || tier === 'T6'),
      domain: category,
      crossDomain: opts.crossDomain,
    },
  };
}

// ============================================================================
// T1 — Single-tool, explicit mention (~80 cases)
// ============================================================================

const T1_CASES: ToolSelectionTestCase[] = [
  // shapes — pinepaper_create_item (14 methods share this tool)
  tc('T1', 'easy', 'shapes', 'Create a circle at position (200, 300) with radius 50', ['pinepaper_create_item'], ['shape.circle']),
  tc('T1', 'easy', 'shapes', 'Create a rectangle at center with width 200 and height 100', ['pinepaper_create_item'], ['shape.rectangle']),
  tc('T1', 'easy', 'shapes', 'Create a square with size 80', ['pinepaper_create_item'], ['shape.square']),
  tc('T1', 'easy', 'shapes', 'Create a triangle pointing upward', ['pinepaper_create_item'], ['shape.triangle']),
  tc('T1', 'easy', 'shapes', 'Create a hexagon with 6 sides', ['pinepaper_create_item'], ['shape.polygon']),
  tc('T1', 'easy', 'shapes', 'Create a 5-pointed star', ['pinepaper_create_item'], ['shape.star']),
  tc('T1', 'easy', 'shapes', 'Create an ellipse with width 120 and height 60', ['pinepaper_create_item'], ['shape.ellipse']),
  tc('T1', 'easy', 'shapes', 'Draw a line from (0,0) to (400,300)', ['pinepaper_create_item'], ['shape.line']),
  tc('T1', 'easy', 'shapes', 'Create an arc through three points', ['pinepaper_create_item'], ['shape.arc']),
  tc('T1', 'easy', 'shapes', 'Create a custom path with SVG data', ['pinepaper_create_item'], ['shape.path']),
  tc('T1', 'easy', 'shapes', 'Add text saying "Hello World" at position (400, 100)', ['pinepaper_create_item'], ['shape.text']),
  tc('T1', 'easy', 'shapes', 'Create a grid pattern on the canvas', ['pinepaper_create_item'], ['shape.grid']),
  tc('T1', 'easy', 'shapes', 'Create diagonal stripes in blue and white', ['pinepaper_create_item'], ['shape.diagonal_stripes']),
  tc('T1', 'medium', 'shapes', 'Create a glossy sphere at (400, 300)', ['pinepaper_create_glossy_sphere'], ['shape.glossy_sphere']),

  // styling — pinepaper_modify_item
  tc('T1', 'easy', 'styling', 'Change the fill color to solid red', ['pinepaper_modify_item'], ['styling.solid_color']),
  tc('T1', 'easy', 'styling', 'Apply a linear gradient from blue to green', ['pinepaper_modify_item'], ['styling.linear_gradient']),
  tc('T1', 'easy', 'styling', 'Apply a radial gradient from white to black', ['pinepaper_modify_item'], ['styling.radial_gradient']),
  tc('T1', 'easy', 'styling', 'Change the stroke color to red', ['pinepaper_modify_item'], ['styling.stroke_color']),
  tc('T1', 'easy', 'styling', 'Set the stroke width to 4 pixels', ['pinepaper_modify_item'], ['styling.stroke_width']),
  tc('T1', 'easy', 'styling', 'Set the stroke cap to round', ['pinepaper_modify_item'], ['styling.stroke_cap']),
  tc('T1', 'easy', 'styling', 'Apply a dashed stroke pattern', ['pinepaper_modify_item'], ['styling.dash_pattern']),
  tc('T1', 'easy', 'styling', 'Add a drop shadow to the element', ['pinepaper_modify_item'], ['styling.shadow']),
  tc('T1', 'easy', 'styling', 'Set the opacity to 50%', ['pinepaper_modify_item'], ['styling.opacity']),
  tc('T1', 'easy', 'styling', 'Set the blend mode to multiply', ['pinepaper_modify_item'], ['styling.blend_mode']),

  // animations — pinepaper_animate
  tc('T1', 'easy', 'animations', 'Apply a pulse animation to the circle', ['pinepaper_animate'], ['animation.pulse']),
  tc('T1', 'easy', 'animations', 'Apply a rotation animation', ['pinepaper_animate'], ['animation.rotate']),
  tc('T1', 'easy', 'animations', 'Apply a bounce animation', ['pinepaper_animate'], ['animation.bounce']),
  tc('T1', 'easy', 'animations', 'Apply a fade animation to the element', ['pinepaper_animate'], ['animation.fade']),
  tc('T1', 'easy', 'animations', 'Apply a wobble animation', ['pinepaper_animate'], ['animation.wobble']),
  tc('T1', 'easy', 'animations', 'Apply a typewriter animation to the text', ['pinepaper_animate'], ['animation.typewriter']),
  tc('T1', 'easy', 'animations', 'Apply a shake animation', ['pinepaper_animate'], ['animation.shake']),
  tc('T1', 'easy', 'animations', 'Apply a swing animation', ['pinepaper_animate'], ['animation.swing']),
  tc('T1', 'easy', 'animations', 'Apply a jelly animation', ['pinepaper_animate'], ['animation.jelly']),
  tc('T1', 'easy', 'animations', 'Apply a slide animation left to right', ['pinepaper_animate'], ['animation.slide']),
  tc('T1', 'medium', 'animations', 'Create a keyframe animation with multiple states', ['pinepaper_animate_keyframe'], ['animation.keyframe']),
  tc('T1', 'easy', 'animations', 'Play the timeline from the beginning', ['pinepaper_timeline'], ['animation.timeline_play']),
  tc('T1', 'easy', 'animations', 'Apply ease-in-out easing to the animation', ['pinepaper_animate'], ['animation.easing']),

  // relations — pinepaper_add_relation
  tc('T1', 'medium', 'relations', 'Make the moon orbit around the planet', ['pinepaper_add_relation'], ['relation.orbits']),
  tc('T1', 'medium', 'relations', 'Make element B follow element A', ['pinepaper_add_relation'], ['relation.follows']),
  tc('T1', 'medium', 'relations', 'Attach the hat to the character head', ['pinepaper_add_relation'], ['relation.attached_to']),
  tc('T1', 'medium', 'relations', 'Make the arrow point at the target', ['pinepaper_add_relation'], ['relation.points_at']),
  tc('T1', 'medium', 'relations', 'Mirror element A across the center axis', ['pinepaper_add_relation'], ['relation.mirrors']),
  tc('T1', 'medium', 'relations', 'Keep 100px distance between the two items', ['pinepaper_add_relation'], ['relation.maintains_distance']),
  tc('T1', 'medium', 'relations', 'Bound the child element to the parent area', ['pinepaper_add_relation'], ['relation.bounds_to']),
  tc('T1', 'medium', 'relations', 'Trigger animation when the button is clicked', ['pinepaper_add_relation'], ['relation.triggers_on']),
  tc('T1', 'medium', 'relations', 'Sync the animation between both elements', ['pinepaper_add_relation'], ['relation.synced_animation']),
  tc('T1', 'hard', 'relations', 'Drive the rotation by a sine expression', ['pinepaper_add_relation'], ['relation.driven_by']),
  tc('T1', 'medium', 'relations', 'Add a wiggle effect to the position', ['pinepaper_add_relation'], ['relation.wiggle']),
  tc('T1', 'hard', 'relations', 'Set a time expression for the x position', ['pinepaper_add_relation'], ['relation.time_expression']),
  tc('T1', 'hard', 'relations', 'Apply spring physics to the follower element', ['pinepaper_add_relation'], ['relation.spring_follow']),

  // filters — pinepaper_add_filter
  tc('T1', 'easy', 'filters', 'Apply a grayscale filter', ['pinepaper_add_filter'], ['filter.grayscale']),
  tc('T1', 'easy', 'filters', 'Apply a blur filter with radius 5', ['pinepaper_add_filter'], ['filter.blur']),
  tc('T1', 'easy', 'filters', 'Apply a sepia filter', ['pinepaper_add_filter'], ['filter.sepia']),
  tc('T1', 'easy', 'filters', 'Apply an invert colors filter', ['pinepaper_add_filter'], ['filter.invert']),
  tc('T1', 'easy', 'filters', 'Apply a posterize filter', ['pinepaper_add_filter'], ['filter.posterize']),
  tc('T1', 'easy', 'filters', 'Shift the hue by 90 degrees', ['pinepaper_add_filter'], ['filter.hue_shift']),
  tc('T1', 'easy', 'filters', 'Increase the brightness by 30%', ['pinepaper_add_filter'], ['filter.brightness']),
  tc('T1', 'easy', 'filters', 'Increase the contrast', ['pinepaper_add_filter'], ['filter.contrast']),
  tc('T1', 'easy', 'filters', 'Boost the color saturation', ['pinepaper_add_filter'], ['filter.saturation']),
  tc('T1', 'easy', 'filters', 'Apply a zoom blur effect', ['pinepaper_add_filter'], ['filter.zoom_blur']),
  tc('T1', 'easy', 'filters', 'Apply a motion blur in horizontal direction', ['pinepaper_add_filter'], ['filter.motion_blur']),
  tc('T1', 'easy', 'filters', 'Apply a Gaussian blur with sigma 3', ['pinepaper_add_filter'], ['filter.gaussian_blur']),
  tc('T1', 'easy', 'filters', 'Apply an oil paint filter', ['pinepaper_add_filter'], ['filter.oil_paint']),
  tc('T1', 'easy', 'filters', 'Apply a sketch filter', ['pinepaper_add_filter'], ['filter.sketch']),
  tc('T1', 'easy', 'filters', 'Apply a watercolor filter', ['pinepaper_add_filter'], ['filter.watercolor']),
  tc('T1', 'easy', 'filters', 'Pixelate the image with block size 8', ['pinepaper_add_filter'], ['filter.pixelate']),

  // diagrams
  tc('T1', 'easy', 'diagrams', 'Create a flowchart process box', ['pinepaper_create_diagram_shape'], ['diagram.flowchart_process']),
  tc('T1', 'easy', 'diagrams', 'Create a decision diamond shape', ['pinepaper_create_diagram_shape'], ['diagram.flowchart_decision']),
  tc('T1', 'easy', 'diagrams', 'Connect two diagram shapes with an arrow', ['pinepaper_connect'], ['diagram.connect']),
  tc('T1', 'easy', 'diagrams', 'Auto-layout the diagram', ['pinepaper_auto_layout'], ['diagram.auto_layout']),

  // effects
  tc('T1', 'easy', 'effects', 'Add a sparkle effect', ['pinepaper_add_effect'], ['effect.sparkle']),
  tc('T1', 'easy', 'effects', 'Add a blast explosion effect', ['pinepaper_add_effect'], ['effect.blast']),

  // composition
  tc('T1', 'easy', 'composition', 'Group the selected elements together', ['pinepaper_group'], ['composition.group']),
  tc('T1', 'easy', 'composition', 'Ungroup the selected group', ['pinepaper_ungroup'], ['composition.ungroup']),
  tc('T1', 'easy', 'composition', 'Create a new scene', ['pinepaper_scene'], ['composition.create_scene']),

  // export
  tc('T1', 'easy', 'export', 'Export the canvas as PNG', ['pinepaper_export'], ['export.png']),
  tc('T1', 'easy', 'export', 'Export the animation as a GIF', ['pinepaper_export'], ['export.gif']),
  tc('T1', 'easy', 'export', 'Export as SVG', ['pinepaper_export'], ['export.svg']),

  // rigging
  tc('T1', 'hard', 'rigging', 'Create a skeleton for the character', ['pinepaper_create_skeleton'], ['rigging.create_skeleton']),
  tc('T1', 'hard', 'rigging', 'Add a bone to the skeleton', ['pinepaper_add_bone'], ['rigging.add_bone']),
  tc('T1', 'hard', 'rigging', 'Attach the arm item to the shoulder bone', ['pinepaper_attach_item_to_bone'], ['rigging.attach_item']),

  // blending
  tc('T1', 'medium', 'blending', 'Apply the ghost blend preset', ['pinepaper_apply_blend_preset'], ['blending.apply_preset']),
  tc('T1', 'medium', 'blending', 'Transition the blend mode from normal to overlay', ['pinepaper_transition_blend_mode'], ['blending.transition']),

  // path_operations — boolean ops
  tc('T1', 'medium', 'path_operations', 'Unite two overlapping circles into one shape', ['pinepaper_path_boolean'], ['pathops.unite']),
  tc('T1', 'medium', 'path_operations', 'Subtract a circle from a rectangle to cut a hole', ['pinepaper_path_boolean'], ['pathops.subtract']),
  tc('T1', 'medium', 'path_operations', 'Intersect two shapes to keep only the overlap', ['pinepaper_path_boolean'], ['pathops.intersect']),
  tc('T1', 'medium', 'path_operations', 'Exclude overlapping areas of two paths (XOR)', ['pinepaper_path_boolean'], ['pathops.exclude']),
  tc('T1', 'hard', 'path_operations', 'Divide two paths at all intersection points', ['pinepaper_path_boolean'], ['pathops.divide']),

  // path_operations — manipulation
  tc('T1', 'medium', 'path_operations', 'Offset this path outward by 10 pixels', ['pinepaper_path_offset'], ['pathops.offset']),
  tc('T1', 'easy', 'path_operations', 'Simplify the freehand path to fewer points', ['pinepaper_path_simplify'], ['pathops.simplify']),
  tc('T1', 'easy', 'path_operations', 'Flatten the bezier curve to line segments', ['pinepaper_path_flatten'], ['pathops.flatten']),
  tc('T1', 'easy', 'path_operations', 'Smooth out the jagged path', ['pinepaper_path_smooth'], ['pathops.smooth']),
  tc('T1', 'easy', 'path_operations', 'Reverse the direction of this path', ['pinepaper_path_reverse'], ['pathops.reverse']),

  // path_operations — morphing & query
  tc('T1', 'hard', 'path_operations', 'Create a shape halfway between a circle and a square', ['pinepaper_path_interpolate'], ['pathops.interpolate']),
  tc('T1', 'medium', 'path_operations', 'Find where these two paths cross each other', ['pinepaper_path_intersections'], ['pathops.get_intersections']),
  tc('T1', 'easy', 'path_operations', 'Get the point at offset 100 along this path', ['pinepaper_path_point_at'], ['pathops.get_point_at']),

  // 3d — primitives
  tc('T1', 'medium', '3d', 'Create a 3D cube', ['pinepaper_create_3d_object'], ['3d.cube']),
  tc('T1', 'medium', '3d', 'Create a 3D sphere', ['pinepaper_create_3d_object'], ['3d.sphere']),
  tc('T1', 'medium', '3d', 'Create a 3D cone', ['pinepaper_create_3d_object'], ['3d.cone']),
  tc('T1', 'medium', '3d', 'Create a 3D torus donut shape', ['pinepaper_create_3d_object'], ['3d.torus']),

  // 3d — projection
  tc('T1', 'easy', '3d', 'Set isometric projection', ['pinepaper_set_3d_projection'], ['3d.isometric']),
  tc('T1', 'easy', '3d', 'Switch to perspective view', ['pinepaper_set_3d_projection'], ['3d.perspective']),
  tc('T1', 'easy', '3d', 'Use orthographic projection', ['pinepaper_set_3d_projection'], ['3d.orthographic']),

  // 3d — operations
  tc('T1', 'medium', '3d', 'Extrude this path into 3D', ['pinepaper_extrude_path'], ['3d.extrude']),
  tc('T1', 'hard', '3d', 'Revolve this profile curve into a 3D surface', ['pinepaper_extrude_path'], ['3d.revolve']),

  // 3d — camera & transform
  tc('T1', 'medium', '3d', 'Set the 3D camera position', ['pinepaper_set_3d_camera'], ['3d.camera']),
  tc('T1', 'medium', '3d', 'Rotate the 3D object 45 degrees around Y', ['pinepaper_transform_3d'], ['3d.transform']),
  tc('T1', 'hard', '3d', 'Animate the cube spinning continuously', ['pinepaper_animate_3d'], ['3d.animate']),
];

// ============================================================================
// T2 — Single-tool, implicit / natural language (~100 cases)
// ============================================================================

const T2_CASES: ToolSelectionTestCase[] = [
  // shapes — natural language without mentioning tool names
  tc('T2', 'easy', 'shapes', 'I need a round shape in the middle of the canvas', ['pinepaper_create_item'], ['shape.circle']),
  tc('T2', 'easy', 'shapes', 'Put a box in the top-left corner', ['pinepaper_create_item'], ['shape.rectangle']),
  tc('T2', 'easy', 'shapes', 'Draw something with equal sides, like a die face', ['pinepaper_create_item'], ['shape.square']),
  tc('T2', 'easy', 'shapes', 'I want a pointy three-sided shape', ['pinepaper_create_item'], ['shape.triangle']),
  tc('T2', 'easy', 'shapes', 'Can you make a stop sign shape?', ['pinepaper_create_item'], ['shape.polygon']),
  tc('T2', 'easy', 'shapes', 'I want something that twinkles, like a night sky decoration', ['pinepaper_create_item'], ['shape.star']),
  tc('T2', 'easy', 'shapes', 'Place an oval near the bottom', ['pinepaper_create_item'], ['shape.ellipse']),
  tc('T2', 'easy', 'shapes', 'Draw a straight connector between these two points', ['pinepaper_create_item'], ['shape.line']),
  tc('T2', 'easy', 'shapes', 'Make a curved swoosh across the page', ['pinepaper_create_item'], ['shape.arc']),
  tc('T2', 'medium', 'shapes', 'Draw a custom freeform shape', ['pinepaper_create_item'], ['shape.path']),
  tc('T2', 'easy', 'shapes', 'Write the word "Welcome" on the canvas', ['pinepaper_create_item'], ['shape.text']),
  tc('T2', 'medium', 'shapes', 'I want a shiny 3D ball that looks realistic', ['pinepaper_create_glossy_sphere'], ['shape.glossy_sphere']),
  tc('T2', 'easy', 'shapes', 'Add a mesh overlay of horizontal and vertical lines', ['pinepaper_create_item'], ['shape.grid']),
  tc('T2', 'easy', 'shapes', 'Add a candy-cane stripe pattern', ['pinepaper_create_item'], ['shape.diagonal_stripes']),

  // styling — descriptive language
  tc('T2', 'easy', 'styling', 'Make the circle bright crimson', ['pinepaper_modify_item'], ['styling.solid_color']),
  tc('T2', 'medium', 'styling', 'Give it a smooth color transition from top to bottom', ['pinepaper_modify_item'], ['styling.linear_gradient']),
  tc('T2', 'medium', 'styling', 'Make it glow outward from the center with fading color', ['pinepaper_modify_item'], ['styling.radial_gradient']),
  tc('T2', 'easy', 'styling', 'Outline it in gold', ['pinepaper_modify_item'], ['styling.stroke_color']),
  tc('T2', 'easy', 'styling', 'Make the border thicker', ['pinepaper_modify_item'], ['styling.stroke_width']),
  tc('T2', 'easy', 'styling', 'Round off the ends of the line', ['pinepaper_modify_item'], ['styling.stroke_cap']),
  tc('T2', 'easy', 'styling', 'Make the border dashed', ['pinepaper_modify_item'], ['styling.dash_pattern']),
  tc('T2', 'easy', 'styling', 'Give it a shadow underneath', ['pinepaper_modify_item'], ['styling.shadow']),
  tc('T2', 'easy', 'styling', 'Make it see-through', ['pinepaper_modify_item'], ['styling.opacity']),
  tc('T2', 'medium', 'styling', 'Blend it so the dark areas show through', ['pinepaper_modify_item'], ['styling.blend_mode']),

  // animations — descriptive
  tc('T2', 'easy', 'animations', 'Make the logo throb gently', ['pinepaper_animate'], ['animation.pulse']),
  tc('T2', 'easy', 'animations', 'Spin the gear continuously', ['pinepaper_animate'], ['animation.rotate']),
  tc('T2', 'easy', 'animations', 'Make the ball hop up and down', ['pinepaper_animate'], ['animation.bounce']),
  tc('T2', 'easy', 'animations', 'Slowly appear and disappear', ['pinepaper_animate'], ['animation.fade']),
  tc('T2', 'easy', 'animations', 'Make it wiggle back and forth like jelly', ['pinepaper_animate'], ['animation.wobble']),
  tc('T2', 'easy', 'animations', 'Reveal the text letter by letter', ['pinepaper_animate'], ['animation.typewriter']),
  tc('T2', 'easy', 'animations', 'Vibrate the element rapidly', ['pinepaper_animate'], ['animation.shake']),
  tc('T2', 'easy', 'animations', 'Rock it like a pendulum', ['pinepaper_animate'], ['animation.swing']),
  tc('T2', 'easy', 'animations', 'Make it squish and stretch like rubber', ['pinepaper_animate'], ['animation.jelly']),
  tc('T2', 'easy', 'animations', 'Slide the panel in from the left', ['pinepaper_animate'], ['animation.slide']),
  tc('T2', 'hard', 'animations', 'Define a multi-step animation with exact properties at each keyframe', ['pinepaper_animate_keyframe'], ['animation.keyframe']),
  tc('T2', 'easy', 'animations', 'Start the animation playback', ['pinepaper_timeline'], ['animation.timeline_play']),

  // relations — natural language
  tc('T2', 'medium', 'relations', 'Make the small dot revolve around the big one', ['pinepaper_add_relation'], ['relation.orbits']),
  tc('T2', 'medium', 'relations', 'The puppy should chase the butterfly', ['pinepaper_add_relation'], ['relation.follows']),
  tc('T2', 'medium', 'relations', 'Glue the badge onto the avatar', ['pinepaper_add_relation'], ['relation.attached_to']),
  tc('T2', 'medium', 'relations', 'The compass needle always faces north', ['pinepaper_add_relation'], ['relation.points_at']),
  tc('T2', 'medium', 'relations', 'Reflect this shape on the other side', ['pinepaper_add_relation'], ['relation.mirrors']),
  tc('T2', 'medium', 'relations', 'They should always stay the same distance apart', ['pinepaper_add_relation'], ['relation.maintains_distance']),
  tc('T2', 'medium', 'relations', 'Keep the tooltip inside the card boundaries', ['pinepaper_add_relation'], ['relation.bounds_to']),
  tc('T2', 'hard', 'relations', 'When I hover over the button, start the glow', ['pinepaper_add_relation'], ['relation.triggers_on']),
  tc('T2', 'hard', 'relations', 'Both wheels should rotate at the same speed', ['pinepaper_add_relation'], ['relation.synced_animation']),
  tc('T2', 'hard', 'relations', 'Control the size based on a mathematical formula', ['pinepaper_add_relation'], ['relation.driven_by']),
  tc('T2', 'medium', 'relations', 'Add a random jitter to the position', ['pinepaper_add_relation'], ['relation.wiggle']),
  tc('T2', 'hard', 'relations', 'Make it bounce with spring physics when released', ['pinepaper_add_relation'], ['relation.spring_follow']),

  // filters — natural descriptions
  tc('T2', 'easy', 'filters', 'Remove all color and make it black and white', ['pinepaper_add_filter'], ['filter.grayscale']),
  tc('T2', 'easy', 'filters', 'Make everything look soft and out of focus', ['pinepaper_add_filter'], ['filter.blur']),
  tc('T2', 'easy', 'filters', 'Give it a warm vintage brownish look', ['pinepaper_add_filter'], ['filter.sepia']),
  tc('T2', 'easy', 'filters', 'Flip all the colors to their opposites', ['pinepaper_add_filter'], ['filter.invert']),
  tc('T2', 'easy', 'filters', 'Reduce the number of colors to create a poster effect', ['pinepaper_add_filter'], ['filter.posterize']),
  tc('T2', 'medium', 'filters', 'Shift all the colors toward purple', ['pinepaper_add_filter'], ['filter.hue_shift']),
  tc('T2', 'easy', 'filters', 'Brighten it up, it looks too dark', ['pinepaper_add_filter'], ['filter.brightness']),
  tc('T2', 'easy', 'filters', 'The colors look washed out, add more punch', ['pinepaper_add_filter'], ['filter.contrast']),
  tc('T2', 'easy', 'filters', 'Make the colors more vivid and intense', ['pinepaper_add_filter'], ['filter.saturation']),
  tc('T2', 'medium', 'filters', 'Create a speed zoom effect radiating from center', ['pinepaper_add_filter'], ['filter.zoom_blur']),
  tc('T2', 'medium', 'filters', 'Add a speed streak effect', ['pinepaper_add_filter'], ['filter.motion_blur']),
  tc('T2', 'easy', 'filters', 'Smooth out the details slightly', ['pinepaper_add_filter'], ['filter.gaussian_blur']),
  tc('T2', 'medium', 'filters', 'Make it look like an oil painting', ['pinepaper_add_filter'], ['filter.oil_paint']),
  tc('T2', 'medium', 'filters', 'Give it a hand-drawn pencil look', ['pinepaper_add_filter'], ['filter.sketch']),
  tc('T2', 'medium', 'filters', 'Make it look like a watercolor painting', ['pinepaper_add_filter'], ['filter.watercolor']),
  tc('T2', 'easy', 'filters', 'Make it look pixelated like retro 8-bit art', ['pinepaper_add_filter'], ['filter.pixelate']),

  // diagrams — implicit
  tc('T2', 'medium', 'diagrams', 'I need a box to represent a step in my workflow', ['pinepaper_create_diagram_shape'], ['diagram.flowchart_process']),
  tc('T2', 'medium', 'diagrams', 'Add a yes/no branching point', ['pinepaper_create_diagram_shape'], ['diagram.flowchart_decision']),
  tc('T2', 'medium', 'diagrams', 'Link the start node to the processing node', ['pinepaper_connect'], ['diagram.connect']),
  tc('T2', 'medium', 'diagrams', 'Arrange all the nodes neatly', ['pinepaper_auto_layout'], ['diagram.auto_layout']),

  // effects — implicit
  tc('T2', 'easy', 'effects', 'Add some glitter around the element', ['pinepaper_add_effect'], ['effect.sparkle']),
  tc('T2', 'easy', 'effects', 'Make an explosion burst outward', ['pinepaper_add_effect'], ['effect.blast']),

  // composition — implicit
  tc('T2', 'easy', 'composition', 'Bundle these items into a single unit', ['pinepaper_group'], ['composition.group']),
  tc('T2', 'easy', 'composition', 'Break apart the grouped elements', ['pinepaper_ungroup'], ['composition.ungroup']),
  tc('T2', 'easy', 'composition', 'Create a batch of circles in a row', ['pinepaper_batch_create'], ['composition.batch_create']),
  tc('T2', 'easy', 'composition', 'Change the color of all selected items at once', ['pinepaper_batch_modify'], ['composition.batch_modify']),

  // export — implicit
  tc('T2', 'easy', 'export', 'Save this as an image file', ['pinepaper_export'], ['export.png']),
  tc('T2', 'easy', 'export', 'I want to share this as a short looping clip', ['pinepaper_export'], ['export.gif']),
  tc('T2', 'easy', 'export', 'Download it as a vector file', ['pinepaper_export'], ['export.svg']),
  tc('T2', 'easy', 'export', 'Save it as a video', ['pinepaper_export'], ['export.mp4']),

  // rigging — implicit
  tc('T2', 'hard', 'rigging', 'Set up the bone structure for the puppet', ['pinepaper_create_skeleton'], ['rigging.create_skeleton']),
  tc('T2', 'hard', 'rigging', 'Apply a walking motion to the character rig', ['pinepaper_create_skeleton'], ['rigging.auto_walk']),
  tc('T2', 'hard', 'rigging', 'Make the character breathe subtly', ['pinepaper_create_skeleton'], ['rigging.auto_breath']),

  // blending — implicit
  tc('T2', 'medium', 'blending', 'Make the layer look like a ghost', ['pinepaper_apply_blend_preset'], ['blending.apply_preset']),
  tc('T2', 'medium', 'blending', 'Create a neon glow effect on the group', ['pinepaper_apply_blend_preset'], ['blending.apply_preset']),

  // masking — implicit
  tc('T2', 'medium', 'masking', 'Clip the image to the shape beneath it', ['pinepaper_create_item'], ['masking.apply_mask']),
  tc('T2', 'medium', 'masking', 'Remove the clipping mask from the element', ['pinepaper_create_item'], ['masking.remove_mask']),

  // camera — implicit
  tc('T2', 'easy', 'camera', 'Zoom into the center area of the canvas', ['pinepaper_create_item'], ['camera.zoom_in']),
  tc('T2', 'easy', 'camera', 'Pan the view to focus on the top-right section', ['pinepaper_create_item'], ['camera.pan_to']),
  tc('T2', 'easy', 'camera', 'Reset the viewport back to the default view', ['pinepaper_create_item'], ['camera.reset']),

  // acoustic — implicit
  tc('T2', 'hard', 'acoustic', 'Play a sine wave tone at 440Hz', ['pinepaper_audio_oscillator'], ['acoustic.sine_oscillator']),
  tc('T2', 'hard', 'acoustic', 'Shape the sound with attack and release', ['pinepaper_audio_envelope'], ['acoustic.adsr']),

  // Additional T2 cases for coverage
  tc('T2', 'easy', 'shapes', 'I want a diamond shape in the center', ['pinepaper_create_item'], ['shape.polygon']),
  tc('T2', 'easy', 'shapes', 'Put a label saying "Click here"', ['pinepaper_create_item'], ['shape.text']),
  tc('T2', 'easy', 'shapes', 'Draw a curved line between points A and B', ['pinepaper_create_item'], ['shape.arc']),
  tc('T2', 'medium', 'shapes', 'Create a badge shape with five tips', ['pinepaper_create_item'], ['shape.star']),
  tc('T2', 'medium', 'diagrams', 'Create a rounded box for the start of my workflow', ['pinepaper_create_diagram_shape'], ['diagram.flowchart_terminal']),
  tc('T2', 'medium', 'diagrams', 'I need a cylinder to represent a database', ['pinepaper_create_diagram_shape'], ['diagram.flowchart_database']),
  tc('T2', 'medium', 'diagrams', 'Create a parallelogram for data input', ['pinepaper_create_diagram_shape'], ['diagram.flowchart_data']),
  tc('T2', 'medium', 'diagrams', 'Add a stick figure to represent a user', ['pinepaper_create_diagram_shape'], ['diagram.uml_actor']),
  tc('T2', 'hard', 'acoustic', 'Pan the audio to the left speaker', ['pinepaper_audio_pan'], ['acoustic.stereo_pan']),
  tc('T2', 'hard', 'acoustic', 'Trigger a sound when the node activates', ['pinepaper_audio_trigger'], ['acoustic.node_activate']),

  // 3d — implicit / natural language
  tc('T2', 'medium', '3d', 'Create a red sphere at position (100, 200, 50) with radius 30', ['pinepaper_create_3d_object'], ['3d.sphere']),
  tc('T2', 'medium', '3d', 'Make a 3D box rotated at an angle', ['pinepaper_create_3d_object'], ['3d.cube']),
  tc('T2', 'medium', '3d', 'I want things to look 3D with depth', ['pinepaper_set_3d_projection'], ['3d.perspective']),
  tc('T2', 'hard', '3d', 'Turn this flat text into a 3D sign', ['pinepaper_extrude_path'], ['3d.extrude']),
  tc('T2', 'medium', '3d', 'Give me a top-down engineering view', ['pinepaper_set_3d_projection'], ['3d.orthographic']),
];

// ============================================================================
// T3 — Multi-tool sequential, 2 tools (~100 cases)
// ============================================================================

const T3_CASES: ToolSelectionTestCase[] = [
  // shape + animation (create then animate)
  tc('T3', 'medium', 'shapes', 'Create a red circle and make it pulse', ['pinepaper_create_item', 'pinepaper_animate'], ['shape.circle', 'animation.pulse'], { crossDomain: ['animations'] }),
  tc('T3', 'medium', 'shapes', 'Draw a rectangle and make it bounce', ['pinepaper_create_item', 'pinepaper_animate'], ['shape.rectangle', 'animation.bounce'], { crossDomain: ['animations'] }),
  tc('T3', 'medium', 'shapes', 'Create a star and make it rotate continuously', ['pinepaper_create_item', 'pinepaper_animate'], ['shape.star', 'animation.rotate'], { crossDomain: ['animations'] }),
  tc('T3', 'medium', 'shapes', 'Add text "Loading" and apply a typewriter effect', ['pinepaper_create_item', 'pinepaper_animate'], ['shape.text', 'animation.typewriter'], { crossDomain: ['animations'] }),
  tc('T3', 'medium', 'shapes', 'Create a triangle and make it fade in and out', ['pinepaper_create_item', 'pinepaper_animate'], ['shape.triangle', 'animation.fade'], { crossDomain: ['animations'] }),
  tc('T3', 'medium', 'shapes', 'Draw a hexagon and make it wobble', ['pinepaper_create_item', 'pinepaper_animate'], ['shape.polygon', 'animation.wobble'], { crossDomain: ['animations'] }),
  tc('T3', 'medium', 'shapes', 'Create an ellipse and apply a swing animation', ['pinepaper_create_item', 'pinepaper_animate'], ['shape.ellipse', 'animation.swing'], { crossDomain: ['animations'] }),
  tc('T3', 'medium', 'shapes', 'Create a square and make it shake', ['pinepaper_create_item', 'pinepaper_animate'], ['shape.square', 'animation.shake'], { crossDomain: ['animations'] }),
  tc('T3', 'medium', 'shapes', 'Create a circle and slide it across the screen', ['pinepaper_create_item', 'pinepaper_animate'], ['shape.circle', 'animation.slide'], { crossDomain: ['animations'] }),
  tc('T3', 'medium', 'shapes', 'Draw a line and apply jelly animation', ['pinepaper_create_item', 'pinepaper_animate'], ['shape.line', 'animation.jelly'], { crossDomain: ['animations'] }),

  // shape + styling (create then style)
  tc('T3', 'easy', 'shapes', 'Create a circle and fill it with a gradient', ['pinepaper_create_item', 'pinepaper_modify_item'], ['shape.circle', 'styling.linear_gradient'], { crossDomain: ['styling'] }),
  tc('T3', 'easy', 'shapes', 'Draw a rectangle and add a drop shadow', ['pinepaper_create_item', 'pinepaper_modify_item'], ['shape.rectangle', 'styling.shadow'], { crossDomain: ['styling'] }),
  tc('T3', 'easy', 'shapes', 'Create a star and set its opacity to 50%', ['pinepaper_create_item', 'pinepaper_modify_item'], ['shape.star', 'styling.opacity'], { crossDomain: ['styling'] }),
  tc('T3', 'easy', 'shapes', 'Create a polygon and give it a dashed border', ['pinepaper_create_item', 'pinepaper_modify_item'], ['shape.polygon', 'styling.dash_pattern'], { crossDomain: ['styling'] }),
  tc('T3', 'easy', 'shapes', 'Draw a circle and outline it with a thick red stroke', ['pinepaper_create_item', 'pinepaper_modify_item'], ['shape.circle', 'styling.stroke_color'], { crossDomain: ['styling'] }),
  tc('T3', 'easy', 'shapes', 'Create a rectangle with rounded corners and a radial gradient', ['pinepaper_create_item', 'pinepaper_modify_item'], ['shape.rectangle', 'styling.radial_gradient'], { crossDomain: ['styling'] }),
  tc('T3', 'easy', 'shapes', 'Add text and change its color to white', ['pinepaper_create_item', 'pinepaper_modify_item'], ['shape.text', 'styling.solid_color'], { crossDomain: ['styling'] }),
  tc('T3', 'easy', 'shapes', 'Create a square and set it to multiply blend mode', ['pinepaper_create_item', 'pinepaper_modify_item'], ['shape.square', 'styling.blend_mode'], { crossDomain: ['styling'] }),

  // shape + filter (create then filter)
  tc('T3', 'medium', 'shapes', 'Create a circle and make it look blurry', ['pinepaper_create_item', 'pinepaper_add_filter'], ['shape.circle', 'filter.blur'], { crossDomain: ['filters'] }),
  tc('T3', 'medium', 'shapes', 'Draw a rectangle and apply a sepia tone', ['pinepaper_create_item', 'pinepaper_add_filter'], ['shape.rectangle', 'filter.sepia'], { crossDomain: ['filters'] }),
  tc('T3', 'medium', 'shapes', 'Create a star and make it grayscale', ['pinepaper_create_item', 'pinepaper_add_filter'], ['shape.star', 'filter.grayscale'], { crossDomain: ['filters'] }),
  tc('T3', 'medium', 'shapes', 'Draw a triangle and give it a sketch effect', ['pinepaper_create_item', 'pinepaper_add_filter'], ['shape.triangle', 'filter.sketch'], { crossDomain: ['filters'] }),
  tc('T3', 'medium', 'shapes', 'Create an ellipse and pixelate it', ['pinepaper_create_item', 'pinepaper_add_filter'], ['shape.ellipse', 'filter.pixelate'], { crossDomain: ['filters'] }),

  // shape + effect
  tc('T3', 'medium', 'shapes', 'Create a star and add sparkles around it', ['pinepaper_create_item', 'pinepaper_add_effect'], ['shape.star', 'effect.sparkle'], { crossDomain: ['effects'] }),
  tc('T3', 'medium', 'shapes', 'Draw a circle and add a blast effect', ['pinepaper_create_item', 'pinepaper_add_effect'], ['shape.circle', 'effect.blast'], { crossDomain: ['effects'] }),

  // shape + relation (create then relate)
  tc('T3', 'medium', 'shapes', 'Create two circles and make one orbit the other', ['pinepaper_create_item', 'pinepaper_add_relation'], ['shape.circle', 'relation.orbits'], { crossDomain: ['relations'] }),
  tc('T3', 'medium', 'shapes', 'Draw two rectangles and make one follow the other', ['pinepaper_create_item', 'pinepaper_add_relation'], ['shape.rectangle', 'relation.follows'], { crossDomain: ['relations'] }),
  tc('T3', 'medium', 'shapes', 'Create a triangle and attach it to the square', ['pinepaper_create_item', 'pinepaper_add_relation'], ['shape.triangle', 'relation.attached_to'], { crossDomain: ['relations'] }),
  tc('T3', 'medium', 'shapes', 'Draw two stars and mirror them along the vertical axis', ['pinepaper_create_item', 'pinepaper_add_relation'], ['shape.star', 'relation.mirrors'], { crossDomain: ['relations'] }),
  tc('T3', 'medium', 'shapes', 'Create an arrow and make it always point at the target circle', ['pinepaper_create_item', 'pinepaper_add_relation'], ['shape.line', 'relation.points_at'], { crossDomain: ['relations'] }),

  // diagram + connect
  tc('T3', 'medium', 'diagrams', 'Create a process box and a decision diamond and connect them', ['pinepaper_create_diagram_shape', 'pinepaper_connect'], ['diagram.flowchart_process', 'diagram.connect']),
  tc('T3', 'medium', 'diagrams', 'Add a start terminal and a process shape and link them', ['pinepaper_create_diagram_shape', 'pinepaper_connect'], ['diagram.flowchart_terminal', 'diagram.connect']),
  tc('T3', 'medium', 'diagrams', 'Create a UML class and a use case and connect them', ['pinepaper_create_diagram_shape', 'pinepaper_connect'], ['diagram.uml_class', 'diagram.connect']),
  tc('T3', 'medium', 'diagrams', 'Add a cloud shape and a server and link them', ['pinepaper_create_diagram_shape', 'pinepaper_connect'], ['diagram.network_cloud', 'diagram.connect']),
  tc('T3', 'medium', 'diagrams', 'Create a database shape and connect it to the process', ['pinepaper_create_diagram_shape', 'pinepaper_connect'], ['diagram.flowchart_database', 'diagram.connect']),

  // diagram + layout
  tc('T3', 'medium', 'diagrams', 'Build a set of diagram nodes and arrange them in a tree', ['pinepaper_create_diagram_shape', 'pinepaper_auto_layout'], ['diagram.flowchart_process', 'diagram.layout_tree']),
  tc('T3', 'medium', 'diagrams', 'Create several UML classes and apply force-directed layout', ['pinepaper_create_diagram_shape', 'pinepaper_auto_layout'], ['diagram.uml_class', 'diagram.layout_force']),
  tc('T3', 'medium', 'diagrams', 'Add multiple flowchart shapes and arrange hierarchically', ['pinepaper_create_diagram_shape', 'pinepaper_auto_layout'], ['diagram.flowchart_process', 'diagram.layout_hierarchical']),

  // animation + styling
  tc('T3', 'medium', 'animations', 'Make the element fade and simultaneously change its gradient colors', ['pinepaper_animate', 'pinepaper_modify_item'], ['animation.fade', 'styling.linear_gradient'], { crossDomain: ['styling'] }),
  tc('T3', 'medium', 'animations', 'Rotate the item and add a shadow', ['pinepaper_animate', 'pinepaper_modify_item'], ['animation.rotate', 'styling.shadow'], { crossDomain: ['styling'] }),

  // generator + filter
  tc('T3', 'medium', 'generators', 'Generate a sunburst background and apply a sepia filter', ['pinepaper_execute_generator', 'pinepaper_add_filter'], ['generator.sunburst', 'filter.sepia'], { crossDomain: ['filters'] }),
  tc('T3', 'medium', 'generators', 'Create a wave pattern and blur it slightly', ['pinepaper_execute_generator', 'pinepaper_add_filter'], ['generator.waves', 'filter.blur'], { crossDomain: ['filters'] }),
  tc('T3', 'medium', 'generators', 'Generate a starfield and make it grayscale', ['pinepaper_execute_generator', 'pinepaper_add_filter'], ['generator.stars', 'filter.grayscale'], { crossDomain: ['filters'] }),

  // generator + animation
  tc('T3', 'medium', 'generators', 'Generate a circuit pattern and animate it with a pulse', ['pinepaper_execute_generator', 'pinepaper_animate'], ['generator.circuit', 'animation.pulse'], { crossDomain: ['animations'] }),
  tc('T3', 'medium', 'generators', 'Create a sunset scene and apply a fade animation', ['pinepaper_execute_generator', 'pinepaper_animate'], ['generator.sunset_scene', 'animation.fade'], { crossDomain: ['animations'] }),

  // rigging + animation
  tc('T3', 'hard', 'rigging', 'Create a skeleton and make it walk', ['pinepaper_create_skeleton', 'pinepaper_create_skeleton'], ['rigging.create_skeleton', 'rigging.auto_walk'], { crossDomain: ['animations'] }),
  tc('T3', 'hard', 'rigging', 'Set up the rig and save a pose', ['pinepaper_create_skeleton', 'pinepaper_save_pose'], ['rigging.create_skeleton', 'rigging.save_pose']),

  // blending + styling
  tc('T3', 'medium', 'blending', 'Apply a ghost blend and then set the group blend mode', ['pinepaper_apply_blend_preset', 'pinepaper_set_group_blend_mode'], ['blending.apply_preset', 'blending.set_group_blend']),
  tc('T3', 'medium', 'blending', 'Apply a neon preset and add an interactive blend zone', ['pinepaper_apply_blend_preset', 'pinepaper_add_interactive_blend'], ['blending.apply_preset', 'blending.add_interactive']),

  // shape + export
  tc('T3', 'easy', 'shapes', 'Create a circle and export it as PNG', ['pinepaper_create_item', 'pinepaper_export'], ['shape.circle', 'export.png'], { crossDomain: ['export'] }),
  tc('T3', 'easy', 'shapes', 'Draw a diagram and export it as SVG', ['pinepaper_create_item', 'pinepaper_export'], ['shape.rectangle', 'export.svg'], { crossDomain: ['export'] }),

  // composition + styling
  tc('T3', 'easy', 'composition', 'Group the elements and change their color at once', ['pinepaper_group', 'pinepaper_batch_modify'], ['composition.group', 'composition.batch_modify']),
  tc('T3', 'easy', 'composition', 'Create a batch of items and group them', ['pinepaper_batch_create', 'pinepaper_group'], ['composition.batch_create', 'composition.group']),

  // More natural language multi-tool
  tc('T3', 'medium', 'shapes', 'Put a title at the top and make it slowly appear', ['pinepaper_create_item', 'pinepaper_animate'], ['shape.text', 'animation.fade'], { crossDomain: ['animations'] }),
  tc('T3', 'medium', 'shapes', 'Draw an arrow and make it point at the target', ['pinepaper_create_item', 'pinepaper_add_relation'], ['shape.line', 'relation.points_at'], { crossDomain: ['relations'] }),
  tc('T3', 'medium', 'shapes', 'Create a glossy sphere and make it bounce', ['pinepaper_create_glossy_sphere', 'pinepaper_animate'], ['shape.glossy_sphere', 'animation.bounce'], { crossDomain: ['animations'] }),
  tc('T3', 'medium', 'shapes', 'Draw a path and add a watercolor filter', ['pinepaper_create_item', 'pinepaper_add_filter'], ['shape.path', 'filter.watercolor'], { crossDomain: ['filters'] }),
  tc('T3', 'medium', 'shapes', 'Create a text element and apply an oil paint filter', ['pinepaper_create_item', 'pinepaper_add_filter'], ['shape.text', 'filter.oil_paint'], { crossDomain: ['filters'] }),

  // More diverse combinations
  tc('T3', 'medium', 'filters', 'Apply brightness increase then add contrast', ['pinepaper_add_filter', 'pinepaper_add_filter'], ['filter.brightness', 'filter.contrast']),
  tc('T3', 'medium', 'filters', 'Blur the element and then saturate the colors', ['pinepaper_add_filter', 'pinepaper_add_filter'], ['filter.blur', 'filter.saturation']),
  tc('T3', 'medium', 'shapes', 'Create a grid pattern and animate it with a fade', ['pinepaper_create_item', 'pinepaper_animate'], ['shape.grid', 'animation.fade'], { crossDomain: ['animations'] }),
  tc('T3', 'medium', 'shapes', 'Draw diagonal stripes and apply a motion blur', ['pinepaper_create_item', 'pinepaper_add_filter'], ['shape.diagonal_stripes', 'filter.motion_blur'], { crossDomain: ['filters'] }),

  // Scene operations
  tc('T3', 'easy', 'composition', 'Create a new scene and save it', ['pinepaper_scene', 'pinepaper_scene'], ['composition.create_scene', 'composition.save_scene']),
  tc('T3', 'easy', 'export', 'Export the animation as WebM and then as MP4', ['pinepaper_export', 'pinepaper_export'], ['export.webm', 'export.mp4']),

  // Additional T3 — shape + animation combos
  tc('T3', 'medium', 'shapes', 'Create a polygon and make it jelly-bounce', ['pinepaper_create_item', 'pinepaper_animate'], ['shape.polygon', 'animation.jelly'], { crossDomain: ['animations'] }),
  tc('T3', 'medium', 'shapes', 'Draw an arc and animate it with easing', ['pinepaper_create_item', 'pinepaper_animate'], ['shape.arc', 'animation.easing'], { crossDomain: ['animations'] }),

  // shape + relation combos
  tc('T3', 'hard', 'shapes', 'Create two elements and make one wiggle near the other', ['pinepaper_create_item', 'pinepaper_add_relation'], ['shape.circle', 'relation.wiggle'], { crossDomain: ['relations'] }),
  tc('T3', 'hard', 'shapes', 'Create a chain of elements that maintain equal distances', ['pinepaper_create_item', 'pinepaper_add_relation'], ['shape.circle', 'relation.maintains_distance'], { crossDomain: ['relations'] }),
  tc('T3', 'hard', 'shapes', 'Draw elements that sync their animations together', ['pinepaper_create_item', 'pinepaper_add_relation'], ['shape.rectangle', 'relation.synced_animation'], { crossDomain: ['relations'] }),
  tc('T3', 'hard', 'shapes', 'Create items and drive their rotation with an expression', ['pinepaper_create_item', 'pinepaper_add_relation'], ['shape.polygon', 'relation.driven_by'], { crossDomain: ['relations'] }),
  tc('T3', 'hard', 'shapes', 'Make two shapes and apply spring physics between them', ['pinepaper_create_item', 'pinepaper_add_relation'], ['shape.circle', 'relation.spring_follow'], { crossDomain: ['relations'] }),
  tc('T3', 'hard', 'shapes', 'Draw elements where one triggers the other on click', ['pinepaper_create_item', 'pinepaper_add_relation'], ['shape.rectangle', 'relation.triggers_on'], { crossDomain: ['relations'] }),
  tc('T3', 'medium', 'shapes', 'Create a shape and bound it within a container', ['pinepaper_create_item', 'pinepaper_add_relation'], ['shape.circle', 'relation.bounds_to'], { crossDomain: ['relations'] }),

  // diagram + layout combos
  tc('T3', 'medium', 'diagrams', 'Create flowchart nodes and apply a radial layout', ['pinepaper_create_diagram_shape', 'pinepaper_auto_layout'], ['diagram.flowchart_process', 'diagram.layout_radial']),
  tc('T3', 'medium', 'diagrams', 'Create diagram shapes and use port-based connectors', ['pinepaper_create_diagram_shape', 'pinepaper_connect'], ['diagram.flowchart_process', 'diagram.connect_ports']),
  tc('T3', 'medium', 'diagrams', 'Build UML use cases and connect them with arrows', ['pinepaper_create_diagram_shape', 'pinepaper_connect'], ['diagram.uml_use_case', 'diagram.connect']),
  tc('T3', 'medium', 'diagrams', 'Create document shapes and connect with flow arrows', ['pinepaper_create_diagram_shape', 'pinepaper_connect'], ['diagram.flowchart_document', 'diagram.connect']),
  tc('T3', 'medium', 'diagrams', 'Create data shapes and connect them to processes', ['pinepaper_create_diagram_shape', 'pinepaper_connect'], ['diagram.flowchart_data', 'diagram.connect']),
  tc('T3', 'medium', 'diagrams', 'Create actor shapes and connect to use cases', ['pinepaper_create_diagram_shape', 'pinepaper_connect'], ['diagram.uml_actor', 'diagram.connect']),

  // More filter combos
  tc('T3', 'medium', 'filters', 'Apply a hue shift and then increase saturation', ['pinepaper_add_filter', 'pinepaper_add_filter'], ['filter.hue_shift', 'filter.saturation']),
  tc('T3', 'medium', 'filters', 'Invert the colors and then posterize', ['pinepaper_add_filter', 'pinepaper_add_filter'], ['filter.invert', 'filter.posterize']),
  tc('T3', 'medium', 'filters', 'Apply a watercolor effect and reduce brightness', ['pinepaper_add_filter', 'pinepaper_add_filter'], ['filter.watercolor', 'filter.brightness']),

  // styling + filter
  tc('T3', 'medium', 'styling', 'Add a gradient fill and then apply a sepia filter', ['pinepaper_modify_item', 'pinepaper_add_filter'], ['styling.linear_gradient', 'filter.sepia'], { crossDomain: ['filters'] }),
  tc('T3', 'medium', 'styling', 'Set the opacity and add a motion blur', ['pinepaper_modify_item', 'pinepaper_add_filter'], ['styling.opacity', 'filter.motion_blur'], { crossDomain: ['filters'] }),

  // animation + relation
  tc('T3', 'hard', 'animations', 'Apply a bounce and add a synced animation relation', ['pinepaper_animate', 'pinepaper_add_relation'], ['animation.bounce', 'relation.synced_animation'], { crossDomain: ['relations'] }),

  // rigging combos
  tc('T3', 'hard', 'rigging', 'Create a skeleton and apply a rig preset', ['pinepaper_create_skeleton', 'pinepaper_apply_rig_preset'], ['rigging.create_skeleton', 'rigging.apply_preset']),
  tc('T3', 'hard', 'rigging', 'Create an IK chain and attach items to bones', ['pinepaper_create_skeleton', 'pinepaper_attach_item_to_bone'], ['rigging.create_ik_chain', 'rigging.attach_item']),
  tc('T3', 'hard', 'rigging', 'Save a pose and then interpolate between poses', ['pinepaper_save_pose', 'pinepaper_interpolate_poses'], ['rigging.save_pose', 'rigging.interpolate_poses']),

  // masking combos
  tc('T3', 'medium', 'masking', 'Apply a mask and then animate it', ['pinepaper_create_item', 'pinepaper_animate'], ['masking.apply_animated_mask', 'animation.fade'], { crossDomain: ['animations'] }),
  tc('T3', 'medium', 'masking', 'Create a custom mask shape and apply it', ['pinepaper_create_item', 'pinepaper_create_item'], ['shape.path', 'masking.apply_custom_mask']),

  // camera combos
  tc('T3', 'medium', 'camera', 'Zoom in and then pan to the target element', ['pinepaper_create_item', 'pinepaper_create_item'], ['camera.zoom_in', 'camera.pan_to']),
  tc('T3', 'medium', 'camera', 'Pan the camera and apply camera animation relation', ['pinepaper_create_item', 'pinepaper_add_relation'], ['camera.pan_to', 'relation.camera_animates'], { crossDomain: ['relations'] }),

  // export combos
  tc('T3', 'easy', 'export', 'Export as high-definition PNG and then as PDF', ['pinepaper_export', 'pinepaper_export'], ['export.png_hd', 'export.pdf']),
  tc('T3', 'easy', 'export', 'Export the animated canvas as GIF and as animated SVG', ['pinepaper_export', 'pinepaper_export'], ['export.gif', 'export.svg_animated']),

  // 3d combos
  tc('T3', 'medium', '3d', 'Create a cube and set perspective projection', ['pinepaper_create_3d_object', 'pinepaper_set_3d_projection'], ['3d.cube', '3d.perspective']),
  tc('T3', 'medium', '3d', 'Create a sphere and rotate it 90 degrees', ['pinepaper_create_3d_object', 'pinepaper_transform_3d'], ['3d.sphere', '3d.transform']),
  tc('T3', 'hard', '3d', 'Extrude a shape and animate it spinning', ['pinepaper_extrude_path', 'pinepaper_animate_3d'], ['3d.extrude', '3d.animate']),
  tc('T3', 'medium', '3d', 'Set the camera and switch to isometric view', ['pinepaper_set_3d_camera', 'pinepaper_set_3d_projection'], ['3d.camera', '3d.isometric']),
];

// ============================================================================
// T4 — Multi-tool compositional, 3+ tools (~80 cases)
// ============================================================================

const T4_CASES: ToolSelectionTestCase[] = [
  // Complex design compositions
  tc('T4', 'hard', 'shapes', 'Create a red circle, give it a gradient fill, and make it pulse', ['pinepaper_create_item', 'pinepaper_modify_item', 'pinepaper_animate'], ['shape.circle', 'styling.linear_gradient', 'animation.pulse'], { crossDomain: ['styling', 'animations'] }),
  tc('T4', 'hard', 'shapes', 'Draw a star, add a sparkle effect, and make it rotate', ['pinepaper_create_item', 'pinepaper_add_effect', 'pinepaper_animate'], ['shape.star', 'effect.sparkle', 'animation.rotate'], { crossDomain: ['effects', 'animations'] }),
  tc('T4', 'hard', 'shapes', 'Create a rectangle, apply a shadow, give it a blur filter, and fade it in', ['pinepaper_create_item', 'pinepaper_modify_item', 'pinepaper_add_filter', 'pinepaper_animate'], ['shape.rectangle', 'styling.shadow', 'filter.blur', 'animation.fade'], { crossDomain: ['styling', 'filters', 'animations'] }),
  tc('T4', 'hard', 'shapes', 'Create a glossy sphere, add an orbit relation with a small circle, and animate both', ['pinepaper_create_glossy_sphere', 'pinepaper_create_item', 'pinepaper_add_relation'], ['shape.glossy_sphere', 'shape.circle', 'relation.orbits'], { crossDomain: ['relations'] }),
  tc('T4', 'hard', 'shapes', 'Build a solar system: create a large circle as the sun, smaller circles as planets, and make them orbit', ['pinepaper_create_item', 'pinepaper_create_item', 'pinepaper_add_relation'], ['shape.circle', 'shape.circle', 'relation.orbits'], { crossDomain: ['relations'] }),

  // Flowchart / diagram compositions
  tc('T4', 'hard', 'diagrams', 'Build a flowchart with start, process, decision, and end nodes connected with arrows', ['pinepaper_create_diagram_shape', 'pinepaper_connect', 'pinepaper_auto_layout'], ['diagram.flowchart_terminal', 'diagram.flowchart_process', 'diagram.flowchart_decision', 'diagram.connect', 'diagram.auto_layout'], { crossDomain: ['diagrams'] }),
  tc('T4', 'hard', 'diagrams', 'Create a UML class diagram with three classes connected by arrows and laid out hierarchically', ['pinepaper_create_diagram_shape', 'pinepaper_connect', 'pinepaper_auto_layout'], ['diagram.uml_class', 'diagram.connect', 'diagram.layout_hierarchical']),
  tc('T4', 'hard', 'diagrams', 'Design a network diagram with a cloud, two servers, and connections between them', ['pinepaper_create_diagram_shape', 'pinepaper_connect', 'pinepaper_auto_layout'], ['diagram.network_cloud', 'diagram.network_server', 'diagram.connect', 'diagram.layout_force']),
  tc('T4', 'hard', 'diagrams', 'Create a flowchart for a login process with process, decision, data, and terminal shapes', ['pinepaper_create_diagram_shape', 'pinepaper_connect', 'pinepaper_auto_layout'], ['diagram.flowchart_process', 'diagram.flowchart_decision', 'diagram.flowchart_data', 'diagram.flowchart_terminal', 'diagram.connect']),
  tc('T4', 'hard', 'diagrams', 'Build a database schema diagram with database shapes, connect them with port connectors, and apply radial layout', ['pinepaper_create_diagram_shape', 'pinepaper_connect', 'pinepaper_auto_layout'], ['diagram.flowchart_database', 'diagram.connect_ports', 'diagram.layout_radial']),

  // Animated design scenes
  tc('T4', 'hard', 'animations', 'Create a banner: add text, give it a gradient, apply typewriter animation, and add a sparkle effect', ['pinepaper_create_item', 'pinepaper_modify_item', 'pinepaper_animate', 'pinepaper_add_effect'], ['shape.text', 'styling.linear_gradient', 'animation.typewriter', 'effect.sparkle'], { crossDomain: ['shapes', 'styling', 'effects'] }),
  tc('T4', 'hard', 'animations', 'Create a loading spinner: draw a circle, set a dashed stroke, and rotate it continuously', ['pinepaper_create_item', 'pinepaper_modify_item', 'pinepaper_animate'], ['shape.circle', 'styling.dash_pattern', 'animation.rotate'], { crossDomain: ['shapes', 'styling'] }),
  tc('T4', 'hard', 'animations', 'Create a notification badge: draw a circle, add text on it, and apply a bounce animation', ['pinepaper_create_item', 'pinepaper_create_item', 'pinepaper_animate'], ['shape.circle', 'shape.text', 'animation.bounce'], { crossDomain: ['shapes'] }),
  tc('T4', 'hard', 'animations', 'Make an animated progress bar: create a rectangle, fill with gradient, and slide it', ['pinepaper_create_item', 'pinepaper_modify_item', 'pinepaper_animate'], ['shape.rectangle', 'styling.linear_gradient', 'animation.slide'], { crossDomain: ['shapes', 'styling'] }),
  tc('T4', 'hard', 'animations', 'Create a countdown: add text, apply keyframe animation for number changes, then fade out', ['pinepaper_create_item', 'pinepaper_animate_keyframe', 'pinepaper_animate'], ['shape.text', 'animation.keyframe', 'animation.fade'], { crossDomain: ['shapes'] }),

  // Generator-based compositions
  tc('T4', 'hard', 'generators', 'Generate a sunburst background, create a circle on top, and animate it pulsing', ['pinepaper_execute_generator', 'pinepaper_create_item', 'pinepaper_animate'], ['generator.sunburst', 'shape.circle', 'animation.pulse'], { crossDomain: ['shapes', 'animations'] }),
  tc('T4', 'hard', 'generators', 'Create a starfield background, add a glossy sphere planet, and make a small dot orbit it', ['pinepaper_execute_generator', 'pinepaper_create_glossy_sphere', 'pinepaper_create_item', 'pinepaper_add_relation'], ['generator.stars', 'shape.glossy_sphere', 'shape.circle', 'relation.orbits'], { crossDomain: ['shapes', 'relations'] }),
  tc('T4', 'hard', 'generators', 'Generate a wave pattern, apply a sepia filter, and fade it in', ['pinepaper_execute_generator', 'pinepaper_add_filter', 'pinepaper_animate'], ['generator.waves', 'filter.sepia', 'animation.fade'], { crossDomain: ['filters', 'animations'] }),
  tc('T4', 'hard', 'generators', 'Create a circuit background, add text overlay, and apply a blur filter to the background', ['pinepaper_execute_generator', 'pinepaper_create_item', 'pinepaper_add_filter'], ['generator.circuit', 'shape.text', 'filter.blur'], { crossDomain: ['shapes', 'filters'] }),
  tc('T4', 'hard', 'generators', 'Generate a sunset scene, add silhouette shapes, and apply oil paint filter', ['pinepaper_execute_generator', 'pinepaper_create_item', 'pinepaper_add_filter'], ['generator.sunset_scene', 'shape.path', 'filter.oil_paint'], { crossDomain: ['shapes', 'filters'] }),

  // Rigging compositions
  tc('T4', 'hard', 'rigging', 'Create a skeleton, add bones, and attach items to the bones', ['pinepaper_create_skeleton', 'pinepaper_add_bone', 'pinepaper_attach_item_to_bone'], ['rigging.create_skeleton', 'rigging.add_bone', 'rigging.attach_item']),
  tc('T4', 'hard', 'rigging', 'Create a character rig, apply a humanoid preset, and save a pose', ['pinepaper_create_skeleton', 'pinepaper_apply_rig_preset', 'pinepaper_save_pose'], ['rigging.create_skeleton', 'rigging.apply_preset', 'rigging.save_pose']),
  tc('T4', 'hard', 'rigging', 'Set up a skeleton, load a saved pose, and interpolate to a new pose', ['pinepaper_create_skeleton', 'pinepaper_load_pose', 'pinepaper_interpolate_poses'], ['rigging.create_skeleton', 'rigging.load_pose', 'rigging.interpolate_poses']),
  tc('T4', 'hard', 'rigging', 'Create a character skeleton, auto-skin the path, and make it walk', ['pinepaper_create_skeleton', 'pinepaper_create_skeleton', 'pinepaper_create_skeleton'], ['rigging.create_skeleton', 'rigging.auto_skin', 'rigging.auto_walk']),

  // Complex filter chains
  tc('T4', 'medium', 'filters', 'Apply grayscale, increase contrast, and add a vignette blur', ['pinepaper_add_filter', 'pinepaper_add_filter', 'pinepaper_add_filter'], ['filter.grayscale', 'filter.contrast', 'filter.gaussian_blur']),
  tc('T4', 'medium', 'filters', 'Apply sepia, reduce brightness, and add a sketch effect', ['pinepaper_add_filter', 'pinepaper_add_filter', 'pinepaper_add_filter'], ['filter.sepia', 'filter.brightness', 'filter.sketch']),
  tc('T4', 'medium', 'filters', 'Posterize the image, shift the hue, and saturate', ['pinepaper_add_filter', 'pinepaper_add_filter', 'pinepaper_add_filter'], ['filter.posterize', 'filter.hue_shift', 'filter.saturation']),

  // Complex relations
  tc('T4', 'hard', 'relations', 'Create a solar system: three circles orbiting the center, each maintaining distance from one another', ['pinepaper_create_item', 'pinepaper_add_relation', 'pinepaper_add_relation'], ['shape.circle', 'relation.orbits', 'relation.maintains_distance'], { crossDomain: ['shapes'] }),
  tc('T4', 'hard', 'relations', 'Create two items that mirror each other, and sync their animations', ['pinepaper_create_item', 'pinepaper_add_relation', 'pinepaper_add_relation'], ['shape.circle', 'relation.mirrors', 'relation.synced_animation'], { crossDomain: ['shapes'] }),
  tc('T4', 'hard', 'relations', 'Set up a chain: item A triggers item B, which triggers item C', ['pinepaper_create_item', 'pinepaper_add_relation', 'pinepaper_add_relation'], ['shape.circle', 'relation.triggers_on', 'relation.triggers_on'], { crossDomain: ['shapes'] }),

  // Blending compositions
  tc('T4', 'hard', 'blending', 'Apply ghost blend, add interactive blend zone, and set group blend mode', ['pinepaper_apply_blend_preset', 'pinepaper_add_interactive_blend', 'pinepaper_set_group_blend_mode'], ['blending.apply_preset', 'blending.add_interactive', 'blending.set_group_blend']),
  tc('T4', 'hard', 'blending', 'Apply a neon preset, transition to ghost, then set up interactive blending', ['pinepaper_apply_blend_preset', 'pinepaper_transition_blend_mode', 'pinepaper_add_interactive_blend'], ['blending.apply_preset', 'blending.transition', 'blending.add_interactive']),

  // Full scene compositions
  tc('T4', 'hard', 'shapes', 'Create a badge: circle, text overlay, gradient fill, and export as PNG', ['pinepaper_create_item', 'pinepaper_create_item', 'pinepaper_modify_item', 'pinepaper_export'], ['shape.circle', 'shape.text', 'styling.linear_gradient', 'export.png'], { crossDomain: ['styling', 'export'] }),
  tc('T4', 'hard', 'shapes', 'Create a button: rounded rectangle, text, shadow, and bounce animation', ['pinepaper_create_item', 'pinepaper_create_item', 'pinepaper_modify_item', 'pinepaper_animate'], ['shape.rectangle', 'shape.text', 'styling.shadow', 'animation.bounce'], { crossDomain: ['styling', 'animations'] }),
  tc('T4', 'hard', 'shapes', 'Build an animated logo: create a path shape, add a glossy sphere, apply sparkles, and rotate', ['pinepaper_create_item', 'pinepaper_create_glossy_sphere', 'pinepaper_add_effect', 'pinepaper_animate'], ['shape.path', 'shape.glossy_sphere', 'effect.sparkle', 'animation.rotate'], { crossDomain: ['effects', 'animations'] }),

  // Batch + composition
  tc('T4', 'medium', 'composition', 'Batch create circles, group them, and animate the group with bounce', ['pinepaper_batch_create', 'pinepaper_group', 'pinepaper_animate'], ['composition.batch_create', 'composition.group', 'animation.bounce'], { crossDomain: ['animations'] }),
  tc('T4', 'medium', 'composition', 'Batch create shapes, batch modify their colors, and group them', ['pinepaper_batch_create', 'pinepaper_batch_modify', 'pinepaper_group'], ['composition.batch_create', 'composition.batch_modify', 'composition.group']),

  // End-to-end scene workflow
  tc('T4', 'hard', 'composition', 'Create a scene, add shapes and animations, save it, and export as GIF', ['pinepaper_scene', 'pinepaper_create_item', 'pinepaper_animate', 'pinepaper_scene', 'pinepaper_export'], ['composition.create_scene', 'shape.circle', 'animation.pulse', 'composition.save_scene', 'export.gif'], { crossDomain: ['shapes', 'animations', 'export'] }),

  // Camera compositions
  tc('T4', 'hard', 'camera', 'Create a scene, add shapes, zoom into the center, and pan to the right', ['pinepaper_scene', 'pinepaper_create_item', 'pinepaper_create_item', 'pinepaper_create_item'], ['composition.create_scene', 'shape.circle', 'camera.zoom_in', 'camera.pan_to'], { crossDomain: ['composition', 'shapes'] }),

  // Acoustic compositions
  tc('T4', 'hard', 'acoustic', 'Create a sine oscillator, shape it with ADSR envelope, and pan it left', ['pinepaper_audio_oscillator', 'pinepaper_audio_envelope', 'pinepaper_audio_pan'], ['acoustic.sine_oscillator', 'acoustic.adsr', 'acoustic.stereo_pan']),
  tc('T4', 'hard', 'acoustic', 'Set up oscillator, envelope, panning, and trigger on node activation', ['pinepaper_audio_oscillator', 'pinepaper_audio_envelope', 'pinepaper_audio_pan', 'pinepaper_audio_trigger'], ['acoustic.sine_oscillator', 'acoustic.adsr', 'acoustic.stereo_pan', 'acoustic.node_activate']),

  // More complex compositions
  tc('T4', 'hard', 'shapes', 'Design an infographic: create shapes, add text labels, apply styling, and arrange them', ['pinepaper_create_item', 'pinepaper_create_item', 'pinepaper_modify_item', 'pinepaper_auto_layout'], ['shape.rectangle', 'shape.text', 'styling.linear_gradient', 'diagram.auto_layout'], { crossDomain: ['styling', 'diagrams'] }),
  tc('T4', 'hard', 'shapes', 'Create a card: rectangle with rounded corners, gradient background, text title, and shadow', ['pinepaper_create_item', 'pinepaper_modify_item', 'pinepaper_create_item', 'pinepaper_modify_item'], ['shape.rectangle', 'styling.radial_gradient', 'shape.text', 'styling.shadow'], { crossDomain: ['styling'] }),
  tc('T4', 'hard', 'generators', 'Build a space scene: generate starfield, create glossy spheres as planets, add orbit relations, and export as animated SVG', ['pinepaper_execute_generator', 'pinepaper_create_glossy_sphere', 'pinepaper_add_relation', 'pinepaper_export'], ['generator.stars', 'shape.glossy_sphere', 'relation.orbits', 'export.svg_animated'], { crossDomain: ['shapes', 'relations', 'export'] }),

  // Additional T4 — complex diagram compositions
  tc('T4', 'hard', 'diagrams', 'Build a complete flowchart: add terminal, process, decision, and document shapes, connect them, and apply hierarchical layout', ['pinepaper_create_diagram_shape', 'pinepaper_connect', 'pinepaper_auto_layout'], ['diagram.flowchart_terminal', 'diagram.flowchart_process', 'diagram.flowchart_decision', 'diagram.flowchart_document', 'diagram.connect', 'diagram.layout_hierarchical']),
  tc('T4', 'hard', 'diagrams', 'Create a use case diagram: add actors, use case ellipses, connect them, and layout radially', ['pinepaper_create_diagram_shape', 'pinepaper_connect', 'pinepaper_auto_layout'], ['diagram.uml_actor', 'diagram.uml_use_case', 'diagram.connect', 'diagram.layout_radial']),
  tc('T4', 'hard', 'diagrams', 'Build a network topology: cloud, multiple servers, connect with port connectors, and auto-layout', ['pinepaper_create_diagram_shape', 'pinepaper_connect', 'pinepaper_auto_layout'], ['diagram.network_cloud', 'diagram.network_server', 'diagram.connect_ports', 'diagram.auto_layout']),
  tc('T4', 'hard', 'diagrams', 'Design a data flow diagram: add data shapes, process shapes, database, connect all, and tree layout', ['pinepaper_create_diagram_shape', 'pinepaper_connect', 'pinepaper_auto_layout'], ['diagram.flowchart_data', 'diagram.flowchart_process', 'diagram.flowchart_database', 'diagram.connect', 'diagram.layout_tree']),

  // Additional T4 — animated scene compositions
  tc('T4', 'hard', 'shapes', 'Create a hero banner: rectangle background, text title, glossy sphere icon, slide-in animation', ['pinepaper_create_item', 'pinepaper_create_item', 'pinepaper_create_glossy_sphere', 'pinepaper_animate'], ['shape.rectangle', 'shape.text', 'shape.glossy_sphere', 'animation.slide'], { crossDomain: ['animations'] }),
  tc('T4', 'hard', 'shapes', 'Design a tooltip: create rectangle, add text, apply shadow, and fade animation', ['pinepaper_create_item', 'pinepaper_create_item', 'pinepaper_modify_item', 'pinepaper_animate'], ['shape.rectangle', 'shape.text', 'styling.shadow', 'animation.fade'], { crossDomain: ['styling', 'animations'] }),
  tc('T4', 'hard', 'shapes', 'Create a pulsing radar: nested circles, gradient fills, synchronized pulse animations', ['pinepaper_create_item', 'pinepaper_modify_item', 'pinepaper_animate', 'pinepaper_add_relation'], ['shape.circle', 'styling.radial_gradient', 'animation.pulse', 'relation.synced_animation'], { crossDomain: ['styling', 'animations', 'relations'] }),
  tc('T4', 'hard', 'shapes', 'Build a clock: circle face, line hands, rotation animations with time expressions', ['pinepaper_create_item', 'pinepaper_create_item', 'pinepaper_animate', 'pinepaper_add_relation'], ['shape.circle', 'shape.line', 'animation.rotate', 'relation.time_expression'], { crossDomain: ['animations', 'relations'] }),
  tc('T4', 'hard', 'shapes', 'Create a pendulum: circle weight, line arm, swing animation, with spring physics', ['pinepaper_create_item', 'pinepaper_create_item', 'pinepaper_animate', 'pinepaper_add_relation'], ['shape.circle', 'shape.line', 'animation.swing', 'relation.spring_follow'], { crossDomain: ['animations', 'relations'] }),

  // Additional T4 — generator + complex scenes
  tc('T4', 'hard', 'generators', 'Create an ocean scene: wave background, circle sun, sunset colors gradient, and fade animation', ['pinepaper_execute_generator', 'pinepaper_create_item', 'pinepaper_modify_item', 'pinepaper_animate'], ['generator.waves', 'shape.circle', 'styling.radial_gradient', 'animation.fade'], { crossDomain: ['shapes', 'styling', 'animations'] }),
  tc('T4', 'hard', 'generators', 'Build a tech dashboard: circuit background, diagram shapes, text labels, and auto-layout', ['pinepaper_execute_generator', 'pinepaper_create_diagram_shape', 'pinepaper_create_item', 'pinepaper_auto_layout'], ['generator.circuit', 'diagram.flowchart_process', 'shape.text', 'diagram.auto_layout'], { crossDomain: ['diagrams', 'shapes'] }),
  tc('T4', 'hard', 'generators', 'Create a presentation slide: sunburst background, title text, glossy sphere icon, and sparkle effect', ['pinepaper_execute_generator', 'pinepaper_create_item', 'pinepaper_create_glossy_sphere', 'pinepaper_add_effect'], ['generator.sunburst', 'shape.text', 'shape.glossy_sphere', 'effect.sparkle'], { crossDomain: ['shapes', 'effects'] }),
  tc('T4', 'hard', 'generators', 'Design a pattern card: pattern background, rectangle frame, text overlay, and shadow', ['pinepaper_execute_generator', 'pinepaper_create_item', 'pinepaper_create_item', 'pinepaper_modify_item'], ['generator.pattern', 'shape.rectangle', 'shape.text', 'styling.shadow'], { crossDomain: ['shapes', 'styling'] }),

  // Additional T4 — rigging + scene
  tc('T4', 'hard', 'rigging', 'Create a character: draw a path shape, create skeleton, skin it, and make it breathe', ['pinepaper_create_item', 'pinepaper_create_skeleton', 'pinepaper_create_skeleton', 'pinepaper_create_skeleton'], ['shape.path', 'rigging.create_skeleton', 'rigging.auto_skin', 'rigging.auto_breath'], { crossDomain: ['shapes'] }),
  tc('T4', 'hard', 'rigging', 'Animate a puppet: skeleton, add multiple bones, attach items, apply humanoid preset', ['pinepaper_create_skeleton', 'pinepaper_add_bone', 'pinepaper_attach_item_to_bone', 'pinepaper_apply_rig_preset'], ['rigging.create_skeleton', 'rigging.add_bone', 'rigging.attach_item', 'rigging.apply_preset']),
  tc('T4', 'hard', 'rigging', 'Character walk cycle: skeleton, auto-walk preset, save pose at each keyframe, interpolate', ['pinepaper_create_skeleton', 'pinepaper_create_skeleton', 'pinepaper_save_pose', 'pinepaper_interpolate_poses'], ['rigging.create_skeleton', 'rigging.auto_walk', 'rigging.save_pose', 'rigging.interpolate_poses']),

  // Additional T4 — blending + effects
  tc('T4', 'hard', 'blending', 'Create a dreamy effect: apply ghost preset, transition to vintage blend, add interactive zone, set group blend', ['pinepaper_apply_blend_preset', 'pinepaper_transition_blend_mode', 'pinepaper_add_interactive_blend', 'pinepaper_set_group_blend_mode'], ['blending.apply_preset', 'blending.transition', 'blending.add_interactive', 'blending.set_group_blend']),

  // Additional T4 — masking + animation
  tc('T4', 'hard', 'masking', 'Create an animated reveal: draw shape, apply custom mask, animate the mask, and add sparkle', ['pinepaper_create_item', 'pinepaper_create_item', 'pinepaper_animate', 'pinepaper_add_effect'], ['shape.rectangle', 'masking.apply_animated_mask', 'animation.fade', 'effect.sparkle'], { crossDomain: ['animations', 'effects'] }),

  // Additional T4 — camera + animation scene
  tc('T4', 'hard', 'camera', 'Create a camera zoom scene: add shapes, zoom in, pan to element, and add camera animation relation', ['pinepaper_create_item', 'pinepaper_create_item', 'pinepaper_create_item', 'pinepaper_add_relation'], ['shape.circle', 'camera.zoom_in', 'camera.pan_to', 'relation.camera_animates'], { crossDomain: ['shapes', 'relations'] }),

  // Additional T4 — full export pipelines
  tc('T4', 'hard', 'export', 'Create an animation, save the scene, and export as WebM and GIF', ['pinepaper_create_item', 'pinepaper_animate', 'pinepaper_scene', 'pinepaper_export'], ['shape.circle', 'animation.pulse', 'composition.save_scene', 'export.webm'], { crossDomain: ['shapes', 'animations', 'composition'] }),
  tc('T4', 'hard', 'export', 'Build a static design, export as PNG, PDF, and SVG', ['pinepaper_create_item', 'pinepaper_export', 'pinepaper_export', 'pinepaper_export'], ['shape.rectangle', 'export.png', 'export.pdf', 'export.svg'], { crossDomain: ['shapes'] }),

  // Additional T4 — complex styling
  tc('T4', 'hard', 'styling', 'Style an element: apply gradient, add shadow, set dash pattern, and reduce opacity', ['pinepaper_modify_item', 'pinepaper_modify_item', 'pinepaper_modify_item', 'pinepaper_modify_item'], ['styling.linear_gradient', 'styling.shadow', 'styling.dash_pattern', 'styling.opacity']),

  // Additional T4 — cross-domain scene
  tc('T4', 'hard', 'shapes', 'Create a weather icon: circle sun, arc rainbow, glossy sphere raindrop, and bounce animation', ['pinepaper_create_item', 'pinepaper_create_item', 'pinepaper_create_glossy_sphere', 'pinepaper_animate'], ['shape.circle', 'shape.arc', 'shape.glossy_sphere', 'animation.bounce'], { crossDomain: ['animations'] }),
  tc('T4', 'hard', 'shapes', 'Design a navigation menu: batch create rectangles, add text labels, group them, apply slide animation', ['pinepaper_batch_create', 'pinepaper_create_item', 'pinepaper_group', 'pinepaper_animate'], ['composition.batch_create', 'shape.text', 'composition.group', 'animation.slide'], { crossDomain: ['composition', 'animations'] }),
  tc('T4', 'hard', 'shapes', 'Build an icon grid: batch create shapes, batch modify colors, apply grid layout, export as SVG', ['pinepaper_batch_create', 'pinepaper_batch_modify', 'pinepaper_auto_layout', 'pinepaper_export'], ['composition.batch_create', 'composition.batch_modify', 'diagram.auto_layout', 'export.svg'], { crossDomain: ['composition', 'diagrams', 'export'] }),

  // 3d — multi-tool scene
  tc('T4', 'hard', '3d', 'Build a 3D scene with cube, sphere, and perspective camera', ['pinepaper_create_3d_object', 'pinepaper_create_3d_object', 'pinepaper_set_3d_projection', 'pinepaper_set_3d_camera'], ['3d.cube', '3d.sphere', '3d.perspective', '3d.camera']),
  tc('T4', 'hard', '3d', 'Create a torus, set isometric view, and animate it rotating', ['pinepaper_create_3d_object', 'pinepaper_set_3d_projection', 'pinepaper_animate_3d'], ['3d.torus', '3d.isometric', '3d.animate']),
  tc('T4', 'hard', '3d', 'Extrude a star into 3D, position the camera, and set perspective', ['pinepaper_extrude_path', 'pinepaper_set_3d_camera', 'pinepaper_set_3d_projection'], ['3d.extrude', '3d.camera', '3d.perspective'], { crossDomain: ['shapes'] }),
];

// ============================================================================
// T5 — Generator-requiring (~60 cases)
// ============================================================================

const T5_CASES: ToolSelectionTestCase[] = [
  // Sunburst generator
  tc('T5', 'medium', 'generators', 'Generate a sunburst background', ['pinepaper_execute_generator'], ['generator.sunburst']),
  tc('T5', 'medium', 'generators', 'Create a radial ray pattern emanating from the center', ['pinepaper_execute_generator'], ['generator.sunburst']),
  tc('T5', 'medium', 'generators', 'Add sunrays spreading outward', ['pinepaper_execute_generator'], ['generator.sunburst']),
  tc('T5', 'easy', 'generators', 'I need a sunburst design as the background', ['pinepaper_execute_generator'], ['generator.sunburst']),
  tc('T5', 'medium', 'generators', 'Create a retro sunburst pattern in warm colors', ['pinepaper_execute_generator'], ['generator.sunburst']),

  // Waves generator
  tc('T5', 'medium', 'generators', 'Generate a layered wave pattern', ['pinepaper_execute_generator'], ['generator.waves']),
  tc('T5', 'medium', 'generators', 'Create ocean-like waves across the canvas', ['pinepaper_execute_generator'], ['generator.waves']),
  tc('T5', 'medium', 'generators', 'Add flowing wave layers at the bottom of the design', ['pinepaper_execute_generator'], ['generator.waves']),
  tc('T5', 'easy', 'generators', 'Make a wavy background', ['pinepaper_execute_generator'], ['generator.waves']),
  tc('T5', 'medium', 'generators', 'Generate smooth sine wave curves stacked vertically', ['pinepaper_execute_generator'], ['generator.waves']),

  // Circuit generator
  tc('T5', 'medium', 'generators', 'Generate a circuit board pattern', ['pinepaper_execute_generator'], ['generator.circuit']),
  tc('T5', 'medium', 'generators', 'Create a tech-style PCB trace design', ['pinepaper_execute_generator'], ['generator.circuit']),
  tc('T5', 'medium', 'generators', 'Add electronic circuit traces as a background', ['pinepaper_execute_generator'], ['generator.circuit']),
  tc('T5', 'hard', 'generators', 'I need something that looks like a motherboard', ['pinepaper_execute_generator'], ['generator.circuit']),
  tc('T5', 'medium', 'generators', 'Create a technology-themed background with traces and nodes', ['pinepaper_execute_generator'], ['generator.circuit']),

  // Sunset scene generator
  tc('T5', 'medium', 'generators', 'Generate a sunset scene', ['pinepaper_execute_generator'], ['generator.sunset_scene']),
  tc('T5', 'medium', 'generators', 'Create a sky gradient with sun near the horizon', ['pinepaper_execute_generator'], ['generator.sunset_scene']),
  tc('T5', 'easy', 'generators', 'Make a beautiful sunset background', ['pinepaper_execute_generator'], ['generator.sunset_scene']),
  tc('T5', 'medium', 'generators', 'Generate a golden hour scene with warm sky colors', ['pinepaper_execute_generator'], ['generator.sunset_scene']),
  tc('T5', 'hard', 'generators', 'I want a landscape with the sun setting', ['pinepaper_execute_generator'], ['generator.sunset_scene']),

  // Stars generator
  tc('T5', 'medium', 'generators', 'Generate a starfield background', ['pinepaper_execute_generator'], ['generator.stars']),
  tc('T5', 'medium', 'generators', 'Create a night sky full of twinkling stars', ['pinepaper_execute_generator'], ['generator.stars']),
  tc('T5', 'easy', 'generators', 'I need a starry background', ['pinepaper_execute_generator'], ['generator.stars']),
  tc('T5', 'hard', 'generators', 'Make the background look like deep space', ['pinepaper_execute_generator'], ['generator.stars']),
  tc('T5', 'medium', 'generators', 'Add a cosmos-style background with scattered light points', ['pinepaper_execute_generator'], ['generator.stars']),

  // Stacked circles generator
  tc('T5', 'medium', 'generators', 'Generate concentric circles', ['pinepaper_execute_generator'], ['generator.stacked_circles']),
  tc('T5', 'medium', 'generators', 'Create a bullseye target pattern', ['pinepaper_execute_generator'], ['generator.stacked_circles']),
  tc('T5', 'medium', 'generators', 'Make a ripple effect with rings expanding outward', ['pinepaper_execute_generator'], ['generator.stacked_circles']),
  tc('T5', 'hard', 'generators', 'Create an abstract pattern of nested circles', ['pinepaper_execute_generator'], ['generator.stacked_circles']),
  tc('T5', 'medium', 'generators', 'Generate stacked circular rings with alternating colors', ['pinepaper_execute_generator'], ['generator.stacked_circles']),

  // Pattern generator
  tc('T5', 'medium', 'generators', 'Generate a repeating pattern', ['pinepaper_execute_generator'], ['generator.pattern']),
  tc('T5', 'medium', 'generators', 'Create a tiled design from a base element', ['pinepaper_execute_generator'], ['generator.pattern']),
  tc('T5', 'medium', 'generators', 'Fill the canvas with a repeating motif', ['pinepaper_execute_generator'], ['generator.pattern']),
  tc('T5', 'hard', 'generators', 'I need a wallpaper-style repeating background', ['pinepaper_execute_generator'], ['generator.pattern']),
  tc('T5', 'medium', 'generators', 'Make a tessellation pattern across the entire canvas', ['pinepaper_execute_generator'], ['generator.pattern']),

  // Grid generator (uses pinepaper_create_grid)
  tc('T5', 'easy', 'generators', 'Generate a grid layout', ['pinepaper_create_grid'], ['generator.grid']),
  tc('T5', 'easy', 'generators', 'Create a dotted grid pattern', ['pinepaper_create_grid'], ['generator.grid']),
  tc('T5', 'easy', 'generators', 'Make a graph paper background', ['pinepaper_create_grid'], ['generator.grid']),
  tc('T5', 'easy', 'generators', 'Add a grid of evenly spaced lines', ['pinepaper_create_grid'], ['generator.grid']),
  tc('T5', 'medium', 'generators', 'Create a grid background like a blueprint', ['pinepaper_create_grid'], ['generator.grid']),

  // Natural language variants for generators
  tc('T5', 'hard', 'generators', 'I want something abstract and geometric for the background', ['pinepaper_execute_generator'], ['generator.pattern'], { acceptableToolSets: [['pinepaper_execute_generator'], ['pinepaper_create_grid']] }),
  tc('T5', 'hard', 'generators', 'Add a decorative backdrop behind the main content', ['pinepaper_execute_generator'], ['generator.waves'], { acceptableToolSets: [['pinepaper_execute_generator'], ['pinepaper_create_grid']] }),
  tc('T5', 'hard', 'generators', 'Generate an ambient space theme', ['pinepaper_execute_generator'], ['generator.stars'], { acceptableToolSets: [['pinepaper_execute_generator']] }),
  tc('T5', 'hard', 'generators', 'Create a nature-inspired gradient scene', ['pinepaper_execute_generator'], ['generator.sunset_scene'], { acceptableToolSets: [['pinepaper_execute_generator']] }),
  tc('T5', 'medium', 'generators', 'Generate a radial burst in orange and yellow', ['pinepaper_execute_generator'], ['generator.sunburst']),
  tc('T5', 'medium', 'generators', 'Create a calm water ripple pattern', ['pinepaper_execute_generator'], ['generator.waves']),
  tc('T5', 'medium', 'generators', 'Make a cyberpunk circuit aesthetic', ['pinepaper_execute_generator'], ['generator.circuit']),
  tc('T5', 'hard', 'generators', 'I need a procedural background that tiles', ['pinepaper_execute_generator'], ['generator.pattern'], { acceptableToolSets: [['pinepaper_execute_generator'], ['pinepaper_create_grid']] }),
  tc('T5', 'medium', 'generators', 'Generate a colorful bullseye pattern', ['pinepaper_execute_generator'], ['generator.stacked_circles']),
  tc('T5', 'easy', 'generators', 'Create a simple grid overlay for alignment', ['pinepaper_create_grid'], ['generator.grid']),

  // Multi-hop generator cases (need to resolve generator name from description)
  tc('T5', 'hard', 'generators', 'Cover the canvas with a technology-themed generative art', ['pinepaper_execute_generator'], ['generator.circuit'], { requiresMultiHop: true }),
  tc('T5', 'hard', 'generators', 'Create a hypnotic concentric pattern', ['pinepaper_execute_generator'], ['generator.stacked_circles'], { requiresMultiHop: true }),
  tc('T5', 'hard', 'generators', 'Make a retro Japanese rising sun pattern', ['pinepaper_execute_generator'], ['generator.sunburst'], { requiresMultiHop: true }),
  tc('T5', 'hard', 'generators', 'Create a calm ocean waves backdrop', ['pinepaper_execute_generator'], ['generator.waves'], { requiresMultiHop: true }),

  // Additional T5 — more natural language generator cases
  tc('T5', 'hard', 'generators', 'Create a psychedelic spiral pattern', ['pinepaper_execute_generator'], ['generator.stacked_circles'], { requiresMultiHop: true }),
  tc('T5', 'hard', 'generators', 'Generate a minimalist geometric background', ['pinepaper_execute_generator'], ['generator.pattern'], { requiresMultiHop: true, acceptableToolSets: [['pinepaper_execute_generator'], ['pinepaper_create_grid']] }),
  tc('T5', 'medium', 'generators', 'Create a dusk sky gradient backdrop', ['pinepaper_execute_generator'], ['generator.sunset_scene']),
  tc('T5', 'easy', 'generators', 'Generate a square grid with 8 columns and 6 rows', ['pinepaper_create_grid'], ['generator.grid']),
  tc('T5', 'medium', 'generators', 'Create a halftone dot grid pattern', ['pinepaper_create_grid'], ['generator.grid']),
  tc('T5', 'medium', 'generators', 'Generate a Fibonacci spiral pattern', ['pinepaper_execute_generator'], ['generator.stacked_circles']),
];

// ============================================================================
// T6 — Cross-domain / ambiguous (~80 cases)
// ============================================================================

const T6_CASES: ToolSelectionTestCase[] = [
  // Vague / creative instructions
  tc('T6', 'hard', 'shapes', 'Make it look professional', ['pinepaper_modify_item'], ['styling.shadow', 'styling.linear_gradient'], {
    acceptableToolSets: [['pinepaper_modify_item'], ['pinepaper_modify_item', 'pinepaper_add_filter'], ['pinepaper_add_filter']],
    crossDomain: ['styling', 'filters'],
  }),
  tc('T6', 'hard', 'shapes', 'Add some energy to the design', ['pinepaper_animate'], ['animation.pulse', 'animation.bounce'], {
    acceptableToolSets: [['pinepaper_animate'], ['pinepaper_add_effect'], ['pinepaper_animate', 'pinepaper_add_effect']],
    crossDomain: ['animations', 'effects'],
  }),
  tc('T6', 'hard', 'shapes', 'Make it pop', ['pinepaper_modify_item'], ['styling.solid_color', 'styling.shadow'], {
    acceptableToolSets: [['pinepaper_modify_item'], ['pinepaper_add_filter'], ['pinepaper_add_effect'], ['pinepaper_modify_item', 'pinepaper_add_effect']],
    crossDomain: ['styling', 'filters', 'effects'],
  }),
  tc('T6', 'hard', 'styling', 'It needs more depth', ['pinepaper_modify_item'], ['styling.shadow', 'styling.linear_gradient'], {
    acceptableToolSets: [['pinepaper_modify_item'], ['pinepaper_add_filter'], ['pinepaper_modify_item', 'pinepaper_add_filter']],
    crossDomain: ['filters'],
  }),
  tc('T6', 'hard', 'animations', 'Make it feel alive', ['pinepaper_animate'], ['animation.pulse', 'animation.wobble'], {
    acceptableToolSets: [['pinepaper_animate'], ['pinepaper_add_relation'], ['pinepaper_animate', 'pinepaper_add_relation']],
    crossDomain: ['relations'],
  }),
  tc('T6', 'hard', 'shapes', 'Clean up the design', ['pinepaper_auto_layout'], ['diagram.auto_layout'], {
    acceptableToolSets: [['pinepaper_auto_layout'], ['pinepaper_modify_item'], ['pinepaper_group']],
    crossDomain: ['diagrams', 'styling', 'composition'],
  }),
  tc('T6', 'hard', 'shapes', 'Make this more visually interesting', ['pinepaper_add_filter'], ['filter.hue_shift'], {
    acceptableToolSets: [['pinepaper_add_filter'], ['pinepaper_modify_item'], ['pinepaper_add_effect'], ['pinepaper_execute_generator']],
    crossDomain: ['styling', 'effects', 'generators', 'filters'],
  }),
  tc('T6', 'hard', 'styling', 'Give it that vintage feel', ['pinepaper_add_filter'], ['filter.sepia'], {
    acceptableToolSets: [['pinepaper_add_filter'], ['pinepaper_modify_item', 'pinepaper_add_filter']],
    crossDomain: ['filters'],
  }),

  // Cross-domain creative prompts
  tc('T6', 'hard', 'shapes', 'Design a logo', ['pinepaper_create_item'], ['shape.circle', 'shape.text'], {
    acceptableToolSets: [['pinepaper_create_item'], ['pinepaper_create_item', 'pinepaper_modify_item'], ['pinepaper_create_item', 'pinepaper_create_glossy_sphere']],
    crossDomain: ['styling'],
  }),
  tc('T6', 'hard', 'shapes', 'Create an animated banner for a website', ['pinepaper_create_item', 'pinepaper_animate'], ['shape.rectangle', 'shape.text', 'animation.slide'], {
    acceptableToolSets: [['pinepaper_create_item', 'pinepaper_animate'], ['pinepaper_create_item', 'pinepaper_animate', 'pinepaper_modify_item']],
    crossDomain: ['animations', 'styling'],
  }),
  tc('T6', 'hard', 'shapes', 'Build a presentation slide', ['pinepaper_create_item'], ['shape.rectangle', 'shape.text'], {
    acceptableToolSets: [['pinepaper_create_item'], ['pinepaper_create_item', 'pinepaper_modify_item'], ['pinepaper_create_item', 'pinepaper_execute_generator']],
    crossDomain: ['styling', 'generators'],
  }),
  tc('T6', 'hard', 'shapes', 'Make an icon set', ['pinepaper_create_item'], ['shape.circle', 'shape.path'], {
    acceptableToolSets: [['pinepaper_create_item'], ['pinepaper_create_item', 'pinepaper_modify_item'], ['pinepaper_batch_create']],
    crossDomain: ['styling', 'composition'],
  }),

  // Ambiguous tool resolution
  tc('T6', 'hard', 'shapes', 'Add a background to the canvas', ['pinepaper_execute_generator'], ['generator.sunburst'], {
    acceptableToolSets: [['pinepaper_execute_generator'], ['pinepaper_create_item'], ['pinepaper_create_grid']],
    crossDomain: ['generators'],
  }),
  tc('T6', 'hard', 'shapes', 'Connect these elements together', ['pinepaper_connect'], ['diagram.connect'], {
    acceptableToolSets: [['pinepaper_connect'], ['pinepaper_add_relation'], ['pinepaper_create_item']],
    crossDomain: ['diagrams', 'relations'],
  }),
  tc('T6', 'hard', 'shapes', 'Organize everything neatly', ['pinepaper_auto_layout'], ['diagram.auto_layout'], {
    acceptableToolSets: [['pinepaper_auto_layout'], ['pinepaper_group'], ['pinepaper_batch_modify']],
    crossDomain: ['diagrams', 'composition'],
  }),
  tc('T6', 'hard', 'animations', 'Add movement to the scene', ['pinepaper_animate'], ['animation.slide'], {
    acceptableToolSets: [['pinepaper_animate'], ['pinepaper_add_relation'], ['pinepaper_animate', 'pinepaper_add_relation']],
    crossDomain: ['relations'],
  }),
  tc('T6', 'hard', 'shapes', 'Enhance the existing elements', ['pinepaper_modify_item'], ['styling.shadow'], {
    acceptableToolSets: [['pinepaper_modify_item'], ['pinepaper_add_filter'], ['pinepaper_add_effect'], ['pinepaper_modify_item', 'pinepaper_add_filter']],
    crossDomain: ['styling', 'filters', 'effects'],
  }),
  tc('T6', 'hard', 'shapes', 'Decorate the border', ['pinepaper_modify_item'], ['styling.stroke_color', 'styling.dash_pattern'], {
    acceptableToolSets: [['pinepaper_modify_item'], ['pinepaper_create_item'], ['pinepaper_create_item', 'pinepaper_modify_item']],
    crossDomain: ['styling'],
  }),

  // Multi-interpretation instructions
  tc('T6', 'hard', 'shapes', 'I want something that glows', ['pinepaper_modify_item'], ['styling.shadow'], {
    acceptableToolSets: [['pinepaper_modify_item'], ['pinepaper_apply_blend_preset'], ['pinepaper_add_effect'], ['pinepaper_create_glossy_sphere']],
    crossDomain: ['styling', 'blending', 'effects'],
  }),
  tc('T6', 'hard', 'shapes', 'Make it spin and sparkle', ['pinepaper_animate', 'pinepaper_add_effect'], ['animation.rotate', 'effect.sparkle'], {
    acceptableToolSets: [['pinepaper_animate', 'pinepaper_add_effect'], ['pinepaper_animate']],
    crossDomain: ['animations', 'effects'],
  }),
  tc('T6', 'hard', 'shapes', 'Create something that reacts to other elements', ['pinepaper_add_relation'], ['relation.follows', 'relation.triggers_on'], {
    acceptableToolSets: [['pinepaper_add_relation'], ['pinepaper_add_interactive_blend'], ['pinepaper_add_relation', 'pinepaper_animate']],
    crossDomain: ['relations', 'blending', 'animations'],
  }),
  tc('T6', 'hard', 'shapes', 'I need a smooth transition between states', ['pinepaper_animate'], ['animation.fade'], {
    acceptableToolSets: [['pinepaper_animate'], ['pinepaper_transition_blend_mode'], ['pinepaper_animate_keyframe'], ['pinepaper_interpolate_poses']],
    crossDomain: ['animations', 'blending', 'rigging'],
  }),
  tc('T6', 'hard', 'shapes', 'Create a dynamic pattern', ['pinepaper_execute_generator'], ['generator.pattern'], {
    acceptableToolSets: [['pinepaper_execute_generator'], ['pinepaper_batch_create'], ['pinepaper_create_item', 'pinepaper_animate']],
    crossDomain: ['generators', 'composition', 'animations'],
  }),
  tc('T6', 'hard', 'shapes', 'Make the elements interact with each other', ['pinepaper_add_relation'], ['relation.follows'], {
    acceptableToolSets: [['pinepaper_add_relation'], ['pinepaper_add_interactive_blend'], ['pinepaper_add_relation', 'pinepaper_add_relation']],
    crossDomain: ['relations', 'blending'],
  }),

  // Scene-level ambiguous requests
  tc('T6', 'hard', 'shapes', 'Create an animation', ['pinepaper_animate'], ['animation.bounce'], {
    acceptableToolSets: [['pinepaper_animate'], ['pinepaper_animate_keyframe'], ['pinepaper_create_item', 'pinepaper_animate']],
    crossDomain: ['animations'],
  }),
  tc('T6', 'hard', 'shapes', 'Build a chart', ['pinepaper_create_diagram_shape'], ['diagram.flowchart_process'], {
    acceptableToolSets: [['pinepaper_create_diagram_shape'], ['pinepaper_create_item'], ['pinepaper_create_diagram_shape', 'pinepaper_connect']],
    crossDomain: ['diagrams'],
  }),
  tc('T6', 'hard', 'shapes', 'Draw a flowchart', ['pinepaper_create_diagram_shape'], ['diagram.flowchart_process', 'diagram.flowchart_decision'], {
    acceptableToolSets: [['pinepaper_create_diagram_shape'], ['pinepaper_create_diagram_shape', 'pinepaper_connect'], ['pinepaper_create_diagram_shape', 'pinepaper_connect', 'pinepaper_auto_layout']],
    crossDomain: ['diagrams'],
  }),
  tc('T6', 'hard', 'shapes', 'I want to create a character', ['pinepaper_create_item'], ['shape.path'], {
    acceptableToolSets: [['pinepaper_create_item'], ['pinepaper_create_item', 'pinepaper_create_skeleton'], ['pinepaper_create_glossy_sphere']],
    crossDomain: ['rigging'],
  }),
  tc('T6', 'hard', 'shapes', 'Make it 3D-looking', ['pinepaper_create_glossy_sphere'], ['shape.glossy_sphere'], {
    acceptableToolSets: [['pinepaper_create_glossy_sphere'], ['pinepaper_modify_item'], ['pinepaper_modify_item', 'pinepaper_add_filter']],
    crossDomain: ['styling', 'filters'],
  }),

  // Domain-crossing requests
  tc('T6', 'hard', 'shapes', 'Create a data visualization dashboard', ['pinepaper_create_item', 'pinepaper_create_diagram_shape'], ['shape.rectangle', 'diagram.flowchart_process'], {
    acceptableToolSets: [['pinepaper_create_item', 'pinepaper_create_diagram_shape'], ['pinepaper_create_item'], ['pinepaper_batch_create', 'pinepaper_create_diagram_shape']],
    crossDomain: ['diagrams', 'composition'],
  }),
  tc('T6', 'hard', 'shapes', 'Design a game UI with buttons and animations', ['pinepaper_create_item', 'pinepaper_animate'], ['shape.rectangle', 'shape.text', 'animation.bounce'], {
    acceptableToolSets: [['pinepaper_create_item', 'pinepaper_animate'], ['pinepaper_create_item', 'pinepaper_modify_item', 'pinepaper_animate']],
    crossDomain: ['animations', 'styling'],
  }),
  tc('T6', 'hard', 'shapes', 'Create an educational diagram that is animated', ['pinepaper_create_diagram_shape', 'pinepaper_animate'], ['diagram.flowchart_process', 'animation.fade'], {
    acceptableToolSets: [['pinepaper_create_diagram_shape', 'pinepaper_animate'], ['pinepaper_create_diagram_shape', 'pinepaper_connect', 'pinepaper_animate']],
    crossDomain: ['diagrams', 'animations'],
  }),
  tc('T6', 'hard', 'shapes', 'Build an interactive prototype', ['pinepaper_create_item', 'pinepaper_add_relation'], ['shape.rectangle', 'relation.triggers_on'], {
    acceptableToolSets: [['pinepaper_create_item', 'pinepaper_add_relation'], ['pinepaper_create_item', 'pinepaper_animate', 'pinepaper_add_relation']],
    crossDomain: ['relations', 'animations'],
  }),

  // Stylistic / mood-based requests
  tc('T6', 'hard', 'styling', 'Make it look like a painting', ['pinepaper_add_filter'], ['filter.oil_paint'], {
    acceptableToolSets: [['pinepaper_add_filter'], ['pinepaper_add_filter', 'pinepaper_modify_item']],
    crossDomain: ['filters'],
  }),
  tc('T6', 'hard', 'styling', 'Give it a dreamy atmosphere', ['pinepaper_add_filter'], ['filter.gaussian_blur'], {
    acceptableToolSets: [['pinepaper_add_filter'], ['pinepaper_apply_blend_preset'], ['pinepaper_add_filter', 'pinepaper_modify_item']],
    crossDomain: ['filters', 'blending'],
  }),
  tc('T6', 'hard', 'styling', 'Make the design feel retro', ['pinepaper_add_filter'], ['filter.sepia', 'filter.posterize'], {
    acceptableToolSets: [['pinepaper_add_filter'], ['pinepaper_add_filter', 'pinepaper_modify_item'], ['pinepaper_execute_generator', 'pinepaper_add_filter']],
    crossDomain: ['filters', 'generators'],
  }),
  tc('T6', 'hard', 'styling', 'Add a futuristic look', ['pinepaper_execute_generator'], ['generator.circuit'], {
    acceptableToolSets: [['pinepaper_execute_generator'], ['pinepaper_add_filter'], ['pinepaper_apply_blend_preset'], ['pinepaper_modify_item']],
    crossDomain: ['generators', 'filters', 'blending', 'styling'],
  }),
  tc('T6', 'hard', 'styling', 'Make everything monochrome', ['pinepaper_add_filter'], ['filter.grayscale'], {
    acceptableToolSets: [['pinepaper_add_filter'], ['pinepaper_modify_item'], ['pinepaper_batch_modify']],
    crossDomain: ['filters', 'styling', 'composition'],
  }),
  tc('T6', 'hard', 'styling', 'Give it a neon aesthetic', ['pinepaper_apply_blend_preset'], ['blending.apply_preset'], {
    acceptableToolSets: [['pinepaper_apply_blend_preset'], ['pinepaper_modify_item'], ['pinepaper_modify_item', 'pinepaper_add_effect']],
    crossDomain: ['blending', 'styling', 'effects'],
  }),
  tc('T6', 'hard', 'styling', 'Create a dark mode version', ['pinepaper_modify_item'], ['styling.solid_color'], {
    acceptableToolSets: [['pinepaper_modify_item'], ['pinepaper_batch_modify'], ['pinepaper_add_filter']],
    crossDomain: ['styling', 'composition', 'filters'],
  }),
  tc('T6', 'hard', 'shapes', 'Add some flair', ['pinepaper_add_effect'], ['effect.sparkle'], {
    acceptableToolSets: [['pinepaper_add_effect'], ['pinepaper_animate'], ['pinepaper_modify_item']],
    crossDomain: ['effects', 'animations', 'styling'],
  }),

  // Action-ambiguous requests
  tc('T6', 'hard', 'shapes', 'Duplicate this pattern across the canvas', ['pinepaper_batch_create'], ['composition.batch_create'], {
    acceptableToolSets: [['pinepaper_batch_create'], ['pinepaper_execute_generator'], ['pinepaper_create_item']],
    crossDomain: ['composition', 'generators'],
  }),
  tc('T6', 'hard', 'shapes', 'Transform this into something animated', ['pinepaper_animate'], ['animation.pulse'], {
    acceptableToolSets: [['pinepaper_animate'], ['pinepaper_animate_keyframe'], ['pinepaper_add_relation']],
    crossDomain: ['animations', 'relations'],
  }),
  tc('T6', 'hard', 'shapes', 'Prepare this for export', ['pinepaper_export'], ['export.png'], {
    acceptableToolSets: [['pinepaper_export'], ['pinepaper_scene', 'pinepaper_export']],
    crossDomain: ['export', 'composition'],
  }),
  tc('T6', 'hard', 'shapes', 'Add physics-based motion', ['pinepaper_add_relation'], ['relation.spring_follow'], {
    acceptableToolSets: [['pinepaper_add_relation'], ['pinepaper_animate'], ['pinepaper_create_skeleton']],
    crossDomain: ['relations', 'animations', 'rigging'],
  }),
  tc('T6', 'hard', 'shapes', 'Create something musical', ['pinepaper_audio_oscillator'], ['acoustic.sine_oscillator'], {
    acceptableToolSets: [['pinepaper_audio_oscillator'], ['pinepaper_audio_oscillator', 'pinepaper_audio_envelope']],
    crossDomain: ['acoustic'],
  }),
  tc('T6', 'hard', 'shapes', 'Add sound to the animation', ['pinepaper_audio_trigger'], ['acoustic.node_activate'], {
    acceptableToolSets: [['pinepaper_audio_trigger'], ['pinepaper_audio_oscillator', 'pinepaper_audio_trigger']],
    crossDomain: ['acoustic', 'animations'],
  }),

  // Extremely ambiguous
  tc('T6', 'hard', 'shapes', 'Surprise me', ['pinepaper_execute_generator'], ['generator.sunburst'], {
    acceptableToolSets: [['pinepaper_execute_generator'], ['pinepaper_create_item'], ['pinepaper_create_glossy_sphere'], ['pinepaper_batch_create']],
    crossDomain: ['generators', 'shapes', 'composition'],
  }),
  tc('T6', 'hard', 'shapes', 'Just make it look good', ['pinepaper_modify_item'], ['styling.shadow'], {
    acceptableToolSets: [['pinepaper_modify_item'], ['pinepaper_add_filter'], ['pinepaper_modify_item', 'pinepaper_add_filter']],
    crossDomain: ['styling', 'filters'],
  }),
  tc('T6', 'hard', 'shapes', 'I want something creative', ['pinepaper_execute_generator'], ['generator.pattern'], {
    acceptableToolSets: [['pinepaper_execute_generator'], ['pinepaper_create_item'], ['pinepaper_create_glossy_sphere'], ['pinepaper_create_item', 'pinepaper_animate']],
    crossDomain: ['generators', 'shapes', 'animations'],
  }),
  tc('T6', 'hard', 'shapes', 'Fix the layout', ['pinepaper_auto_layout'], ['diagram.auto_layout'], {
    acceptableToolSets: [['pinepaper_auto_layout'], ['pinepaper_modify_item'], ['pinepaper_batch_modify']],
    crossDomain: ['diagrams', 'styling', 'composition'],
  }),
  tc('T6', 'hard', 'shapes', 'Finish the design', ['pinepaper_modify_item'], ['styling.shadow'], {
    acceptableToolSets: [['pinepaper_modify_item'], ['pinepaper_export'], ['pinepaper_modify_item', 'pinepaper_export']],
    crossDomain: ['styling', 'export'],
  }),

  // Domain-specific jargon that maps to unexpected tools
  tc('T6', 'hard', 'shapes', 'Apply easing curves to the motion path', ['pinepaper_animate'], ['animation.easing'], {
    acceptableToolSets: [['pinepaper_animate'], ['pinepaper_animate_keyframe']],
    crossDomain: ['animations'],
  }),
  tc('T6', 'hard', 'shapes', 'Set up inverse kinematics for the arm', ['pinepaper_create_skeleton'], ['rigging.create_ik_chain'], {
    acceptableToolSets: [['pinepaper_create_skeleton'], ['pinepaper_create_skeleton', 'pinepaper_add_bone']],
    crossDomain: ['rigging'],
  }),
  tc('T6', 'hard', 'shapes', 'Create a morph transition between two shapes', ['pinepaper_animate_keyframe'], ['animation.keyframe'], {
    acceptableToolSets: [['pinepaper_animate_keyframe'], ['pinepaper_interpolate_poses'], ['pinepaper_transition_blend_mode']],
    crossDomain: ['animations', 'rigging', 'blending'],
  }),
  tc('T6', 'hard', 'shapes', 'Add a compositing layer effect', ['pinepaper_apply_blend_preset'], ['blending.apply_preset'], {
    acceptableToolSets: [['pinepaper_apply_blend_preset'], ['pinepaper_modify_item'], ['pinepaper_set_group_blend_mode']],
    crossDomain: ['blending', 'styling'],
  }),

  // More cross-domain
  tc('T6', 'hard', 'shapes', 'Create an animated infographic with data shapes and transitions', ['pinepaper_create_diagram_shape', 'pinepaper_animate'], ['diagram.flowchart_process', 'animation.fade'], {
    acceptableToolSets: [['pinepaper_create_diagram_shape', 'pinepaper_animate'], ['pinepaper_create_item', 'pinepaper_animate'], ['pinepaper_create_diagram_shape', 'pinepaper_connect', 'pinepaper_animate']],
    crossDomain: ['diagrams', 'animations'],
  }),
  tc('T6', 'hard', 'shapes', 'Make a product showcase with 3D elements and effects', ['pinepaper_create_glossy_sphere', 'pinepaper_add_effect'], ['shape.glossy_sphere', 'effect.sparkle'], {
    acceptableToolSets: [['pinepaper_create_glossy_sphere', 'pinepaper_add_effect'], ['pinepaper_create_glossy_sphere', 'pinepaper_animate'], ['pinepaper_create_item', 'pinepaper_modify_item']],
    crossDomain: ['effects', 'animations'],
  }),
  tc('T6', 'hard', 'shapes', 'Build an explainer video scene', ['pinepaper_create_item', 'pinepaper_animate', 'pinepaper_export'], ['shape.text', 'animation.typewriter', 'export.mp4'], {
    acceptableToolSets: [['pinepaper_create_item', 'pinepaper_animate', 'pinepaper_export'], ['pinepaper_create_item', 'pinepaper_animate'], ['pinepaper_scene', 'pinepaper_create_item', 'pinepaper_animate']],
    crossDomain: ['animations', 'export', 'composition'],
  }),

  // Additional T6 — more cross-domain ambiguous cases
  tc('T6', 'hard', 'shapes', 'Make this more dynamic', ['pinepaper_animate'], ['animation.pulse'], {
    acceptableToolSets: [['pinepaper_animate'], ['pinepaper_add_relation'], ['pinepaper_add_effect'], ['pinepaper_animate', 'pinepaper_add_effect']],
    crossDomain: ['animations', 'relations', 'effects'],
  }),
  tc('T6', 'hard', 'shapes', 'Simplify the layout', ['pinepaper_auto_layout'], ['diagram.auto_layout'], {
    acceptableToolSets: [['pinepaper_auto_layout'], ['pinepaper_group'], ['pinepaper_batch_modify']],
    crossDomain: ['diagrams', 'composition'],
  }),
  tc('T6', 'hard', 'shapes', 'Create a mood board', ['pinepaper_batch_create'], ['composition.batch_create'], {
    acceptableToolSets: [['pinepaper_batch_create'], ['pinepaper_create_item'], ['pinepaper_batch_create', 'pinepaper_execute_generator']],
    crossDomain: ['composition', 'generators'],
  }),
  tc('T6', 'hard', 'styling', 'Make it warmer', ['pinepaper_add_filter'], ['filter.hue_shift'], {
    acceptableToolSets: [['pinepaper_add_filter'], ['pinepaper_modify_item'], ['pinepaper_add_filter', 'pinepaper_modify_item']],
    crossDomain: ['filters', 'styling'],
  }),
  tc('T6', 'hard', 'styling', 'Cool down the colors', ['pinepaper_add_filter'], ['filter.hue_shift'], {
    acceptableToolSets: [['pinepaper_add_filter'], ['pinepaper_modify_item'], ['pinepaper_batch_modify']],
    crossDomain: ['filters', 'styling', 'composition'],
  }),
  tc('T6', 'hard', 'shapes', 'Animate the whole page', ['pinepaper_animate'], ['animation.fade'], {
    acceptableToolSets: [['pinepaper_animate'], ['pinepaper_batch_modify'], ['pinepaper_animate', 'pinepaper_add_relation']],
    crossDomain: ['animations', 'composition', 'relations'],
  }),
  tc('T6', 'hard', 'shapes', 'Add interactivity to the buttons', ['pinepaper_add_relation'], ['relation.triggers_on'], {
    acceptableToolSets: [['pinepaper_add_relation'], ['pinepaper_add_relation', 'pinepaper_animate'], ['pinepaper_add_interactive_blend']],
    crossDomain: ['relations', 'animations', 'blending'],
  }),
  tc('T6', 'hard', 'shapes', 'Optimize for mobile display', ['pinepaper_modify_item'], ['styling.opacity'], {
    acceptableToolSets: [['pinepaper_modify_item'], ['pinepaper_auto_layout'], ['pinepaper_batch_modify']],
    crossDomain: ['styling', 'diagrams', 'composition'],
  }),
  tc('T6', 'hard', 'shapes', 'Add texture to the surface', ['pinepaper_add_filter'], ['filter.oil_paint'], {
    acceptableToolSets: [['pinepaper_add_filter'], ['pinepaper_execute_generator'], ['pinepaper_modify_item']],
    crossDomain: ['filters', 'generators', 'styling'],
  }),
  tc('T6', 'hard', 'shapes', 'Make the transitions smooth between elements', ['pinepaper_animate'], ['animation.easing'], {
    acceptableToolSets: [['pinepaper_animate'], ['pinepaper_transition_blend_mode'], ['pinepaper_interpolate_poses']],
    crossDomain: ['animations', 'blending', 'rigging'],
  }),
  tc('T6', 'hard', 'shapes', 'Connect the dots', ['pinepaper_connect'], ['diagram.connect'], {
    acceptableToolSets: [['pinepaper_connect'], ['pinepaper_add_relation'], ['pinepaper_create_item']],
    crossDomain: ['diagrams', 'relations', 'shapes'],
  }),
  tc('T6', 'hard', 'shapes', 'Create a collage effect', ['pinepaper_batch_create'], ['composition.batch_create'], {
    acceptableToolSets: [['pinepaper_batch_create'], ['pinepaper_create_item', 'pinepaper_modify_item'], ['pinepaper_batch_create', 'pinepaper_batch_modify']],
    crossDomain: ['composition', 'styling'],
  }),
  tc('T6', 'hard', 'shapes', 'Add a cinematic feel', ['pinepaper_add_filter'], ['filter.contrast'], {
    acceptableToolSets: [['pinepaper_add_filter'], ['pinepaper_add_filter', 'pinepaper_modify_item'], ['pinepaper_create_item', 'pinepaper_add_filter']],
    crossDomain: ['filters', 'styling', 'masking'],
  }),
  tc('T6', 'hard', 'shapes', 'Layer the elements with depth', ['pinepaper_modify_item'], ['styling.opacity', 'styling.blend_mode'], {
    acceptableToolSets: [['pinepaper_modify_item'], ['pinepaper_apply_blend_preset'], ['pinepaper_modify_item', 'pinepaper_add_filter']],
    crossDomain: ['styling', 'blending', 'filters'],
  }),
  tc('T6', 'hard', 'shapes', 'Rig up the character and animate it', ['pinepaper_create_skeleton', 'pinepaper_animate'], ['rigging.create_skeleton', 'animation.bounce'], {
    acceptableToolSets: [['pinepaper_create_skeleton', 'pinepaper_animate'], ['pinepaper_create_skeleton'], ['pinepaper_create_skeleton', 'pinepaper_create_skeleton']],
    crossDomain: ['rigging', 'animations'],
  }),
  tc('T6', 'hard', 'shapes', 'Generate something and export it', ['pinepaper_execute_generator', 'pinepaper_export'], ['generator.sunburst', 'export.png'], {
    acceptableToolSets: [['pinepaper_execute_generator', 'pinepaper_export'], ['pinepaper_create_item', 'pinepaper_export']],
    crossDomain: ['generators', 'export'],
  }),
  tc('T6', 'hard', 'shapes', 'Make the background interactive', ['pinepaper_add_interactive_blend'], ['blending.add_interactive'], {
    acceptableToolSets: [['pinepaper_add_interactive_blend'], ['pinepaper_add_relation'], ['pinepaper_execute_generator', 'pinepaper_add_relation']],
    crossDomain: ['blending', 'relations', 'generators'],
  }),
  tc('T6', 'hard', 'shapes', 'Create a parallax scrolling effect', ['pinepaper_add_relation'], ['relation.follows'], {
    acceptableToolSets: [['pinepaper_add_relation'], ['pinepaper_animate'], ['pinepaper_add_relation', 'pinepaper_animate']],
    crossDomain: ['relations', 'animations'],
  }),
  tc('T6', 'hard', 'shapes', 'Set up a responsive layout', ['pinepaper_auto_layout'], ['diagram.auto_layout'], {
    acceptableToolSets: [['pinepaper_auto_layout'], ['pinepaper_batch_modify'], ['pinepaper_group']],
    crossDomain: ['diagrams', 'composition'],
  }),
  tc('T6', 'hard', 'shapes', 'Polish the final design', ['pinepaper_modify_item'], ['styling.shadow', 'styling.linear_gradient'], {
    acceptableToolSets: [['pinepaper_modify_item'], ['pinepaper_add_filter'], ['pinepaper_modify_item', 'pinepaper_add_filter'], ['pinepaper_export']],
    crossDomain: ['styling', 'filters', 'export'],
  }),
  tc('T6', 'hard', 'shapes', 'Create a wireframe prototype', ['pinepaper_create_diagram_shape'], ['diagram.flowchart_process'], {
    acceptableToolSets: [['pinepaper_create_diagram_shape'], ['pinepaper_create_item'], ['pinepaper_create_diagram_shape', 'pinepaper_connect']],
    crossDomain: ['diagrams', 'shapes'],
  }),

  // 3d — cross-domain / ambiguous
  tc('T6', 'hard', '3d', 'Make this design look three-dimensional', ['pinepaper_create_3d_object'], ['3d.cube'], {
    acceptableToolSets: [['pinepaper_create_3d_object'], ['pinepaper_set_3d_projection'], ['pinepaper_create_glossy_sphere'], ['pinepaper_extrude_path']],
    crossDomain: ['3d', 'shapes'],
  }),
  tc('T6', 'hard', '3d', 'Add depth and perspective to the scene', ['pinepaper_set_3d_projection'], ['3d.perspective'], {
    acceptableToolSets: [['pinepaper_set_3d_projection'], ['pinepaper_set_3d_camera'], ['pinepaper_modify_item']],
    crossDomain: ['3d', 'styling'],
  }),
  tc('T6', 'hard', '3d', 'Create a product showcase with rotating objects', ['pinepaper_create_3d_object', 'pinepaper_animate_3d'], ['3d.sphere', '3d.animate'], {
    acceptableToolSets: [['pinepaper_create_3d_object', 'pinepaper_animate_3d'], ['pinepaper_create_glossy_sphere', 'pinepaper_animate'], ['pinepaper_create_3d_object', 'pinepaper_transform_3d']],
    crossDomain: ['3d', 'animations'],
  }),

  // ---- Diverse category T6 cases (rebalancing) ----

  // Filters as primary
  tc('T6', 'medium', 'filters', 'Make the photo look old and faded', ['pinepaper_add_filter'], ['filter.sepia'], {
    acceptableToolSets: [['pinepaper_add_filter'], ['pinepaper_add_filter', 'pinepaper_modify_item']],
    crossDomain: ['styling'],
  }),
  tc('T6', 'hard', 'filters', 'Create a tilt-shift miniature effect', ['pinepaper_add_filter'], ['filter.blur'], {
    acceptableToolSets: [['pinepaper_add_filter'], ['pinepaper_add_filter', 'pinepaper_modify_item']],
    crossDomain: ['styling', 'composition'],
  }),
  tc('T6', 'medium', 'filters', 'Give the whole scene a warm vintage feel', ['pinepaper_add_filter'], ['filter.hue_shift', 'filter.sepia'], {
    acceptableToolSets: [['pinepaper_add_filter'], ['pinepaper_add_filter', 'pinepaper_modify_item']],
    crossDomain: ['styling'],
  }),

  // Diagrams as primary
  tc('T6', 'medium', 'diagrams', 'Show the user flow visually', ['pinepaper_create_diagram_shape', 'pinepaper_connect'], ['diagram.flowchart_process', 'diagram.connect'], {
    acceptableToolSets: [['pinepaper_create_diagram_shape', 'pinepaper_connect'], ['pinepaper_create_diagram_shape']],
    crossDomain: ['shapes', 'composition'],
  }),
  tc('T6', 'hard', 'diagrams', 'Map out the system architecture', ['pinepaper_create_diagram_shape', 'pinepaper_connect'], ['diagram.flowchart_process', 'diagram.connect'], {
    acceptableToolSets: [['pinepaper_create_diagram_shape', 'pinepaper_connect'], ['pinepaper_create_diagram_shape', 'pinepaper_auto_layout']],
    crossDomain: ['composition', 'shapes'],
  }),
  tc('T6', 'medium', 'diagrams', 'Organize these ideas into a structure', ['pinepaper_auto_layout'], ['diagram.auto_layout'], {
    acceptableToolSets: [['pinepaper_auto_layout'], ['pinepaper_create_diagram_shape'], ['pinepaper_create_diagram_shape', 'pinepaper_connect']],
    crossDomain: ['composition', 'shapes'],
  }),

  // Relations as primary
  tc('T6', 'medium', 'relations', 'Make these elements follow each other', ['pinepaper_add_relation'], ['relation.follows'], {
    acceptableToolSets: [['pinepaper_add_relation'], ['pinepaper_animate']],
    crossDomain: ['animations'],
  }),
  tc('T6', 'hard', 'relations', 'Create a chain reaction between shapes', ['pinepaper_add_relation'], ['relation.triggers_on'], {
    acceptableToolSets: [['pinepaper_add_relation'], ['pinepaper_add_relation', 'pinepaper_animate']],
    crossDomain: ['animations', 'shapes'],
  }),
  tc('T6', 'medium', 'relations', 'Link the icons to the text labels', ['pinepaper_add_relation'], ['relation.attached_to'], {
    acceptableToolSets: [['pinepaper_add_relation'], ['pinepaper_connect']],
    crossDomain: ['diagrams', 'shapes'],
  }),

  // Generators as primary
  tc('T6', 'medium', 'generators', 'Fill the background with something organic', ['pinepaper_execute_generator'], ['generator.waves'], {
    acceptableToolSets: [['pinepaper_execute_generator'], ['pinepaper_create_item']],
    crossDomain: ['shapes', 'styling'],
  }),
  tc('T6', 'hard', 'generators', 'Create a procedural pattern for the header', ['pinepaper_execute_generator'], ['generator.sunburst'], {
    acceptableToolSets: [['pinepaper_execute_generator'], ['pinepaper_create_item', 'pinepaper_batch_create']],
    crossDomain: ['shapes', 'composition'],
  }),
  tc('T6', 'medium', 'generators', 'Generate a techy circuit-board backdrop', ['pinepaper_execute_generator'], ['generator.circuit'], {
    acceptableToolSets: [['pinepaper_execute_generator'], ['pinepaper_create_item']],
    crossDomain: ['styling'],
  }),

  // Composition as primary
  tc('T6', 'medium', 'composition', 'Group everything into one unit', ['pinepaper_group'], ['composition.group'], {
    acceptableToolSets: [['pinepaper_group'], ['pinepaper_scene']],
    crossDomain: ['shapes'],
  }),
  tc('T6', 'hard', 'composition', 'Arrange the elements into a grid layout', ['pinepaper_batch_create'], ['composition.batch_create'], {
    acceptableToolSets: [['pinepaper_batch_create'], ['pinepaper_auto_layout'], ['pinepaper_create_item']],
    crossDomain: ['diagrams', 'shapes'],
  }),
  tc('T6', 'medium', 'composition', 'Set up the scene with a background', ['pinepaper_scene'], ['composition.create_scene'], {
    acceptableToolSets: [['pinepaper_scene'], ['pinepaper_execute_generator'], ['pinepaper_scene', 'pinepaper_execute_generator']],
    crossDomain: ['generators'],
  }),

  // Export as primary
  tc('T6', 'medium', 'export', 'Save this as something I can share on social media', ['pinepaper_export'], ['export.png'], {
    acceptableToolSets: [['pinepaper_export'], ['pinepaper_export']],
    crossDomain: ['composition'],
  }),
  tc('T6', 'hard', 'export', 'Render the final animation and package it', ['pinepaper_export'], ['export.gif', 'export.mp4'], {
    acceptableToolSets: [['pinepaper_export'], ['pinepaper_scene', 'pinepaper_export']],
    crossDomain: ['animations', 'composition'],
  }),

  // Rigging as primary
  tc('T6', 'hard', 'rigging', 'Set up the character for animation', ['pinepaper_create_skeleton'], ['rigging.create_skeleton'], {
    acceptableToolSets: [['pinepaper_create_skeleton'], ['pinepaper_create_skeleton', 'pinepaper_add_bone']],
    crossDomain: ['animations', 'shapes'],
  }),
  tc('T6', 'medium', 'rigging', 'Make the puppet move its arms', ['pinepaper_create_skeleton', 'pinepaper_animate'], ['rigging.create_skeleton', 'animation.keyframe'], {
    acceptableToolSets: [['pinepaper_create_skeleton', 'pinepaper_animate'], ['pinepaper_create_skeleton']],
    crossDomain: ['animations'],
  }),

  // Blending as primary
  tc('T6', 'medium', 'blending', 'Blend the layers together softly', ['pinepaper_apply_blend_preset'], ['blending.apply_preset'], {
    acceptableToolSets: [['pinepaper_apply_blend_preset'], ['pinepaper_modify_item']],
    crossDomain: ['styling'],
  }),
  tc('T6', 'hard', 'blending', 'Create a smooth transition between two styles', ['pinepaper_transition_blend_mode'], ['blending.transition_blend_mode'], {
    acceptableToolSets: [['pinepaper_transition_blend_mode'], ['pinepaper_apply_blend_preset'], ['pinepaper_animate']],
    crossDomain: ['styling', 'animations'],
  }),

  // Effects as primary
  tc('T6', 'medium', 'effects', 'Add some magic sparkles around the text', ['pinepaper_add_effect'], ['effect.sparkle'], {
    acceptableToolSets: [['pinepaper_add_effect'], ['pinepaper_animate'], ['pinepaper_execute_generator']],
    crossDomain: ['animations', 'generators'],
  }),
  tc('T6', 'hard', 'effects', 'Create an explosion transition', ['pinepaper_add_effect'], ['effect.blast'], {
    acceptableToolSets: [['pinepaper_add_effect'], ['pinepaper_animate'], ['pinepaper_add_effect', 'pinepaper_animate']],
    crossDomain: ['animations'],
  }),

  // Masking as primary
  tc('T6', 'hard', 'masking', 'Reveal the image with a dramatic wipe', ['pinepaper_animate'], ['masking.animated_reveal'], {
    acceptableToolSets: [['pinepaper_animate'], ['pinepaper_modify_item'], ['pinepaper_animate_keyframe']],
    crossDomain: ['animations', 'styling'],
  }),

  // Camera as primary
  tc('T6', 'medium', 'camera', 'Pan across the scene slowly', ['pinepaper_add_relation'], ['relation.camera_follows'], {
    acceptableToolSets: [['pinepaper_add_relation'], ['pinepaper_set_camera'], ['pinepaper_animate']],
    crossDomain: ['animations', 'relations'],
  }),
  tc('T6', 'hard', 'camera', 'Create a cinematic zoom into the logo', ['pinepaper_set_camera', 'pinepaper_animate'], ['camera.zoom', 'animation.keyframe'], {
    acceptableToolSets: [['pinepaper_set_camera', 'pinepaper_animate'], ['pinepaper_add_relation'], ['pinepaper_animate_keyframe']],
    crossDomain: ['animations'],
  }),

  // Acoustic as primary
  tc('T6', 'hard', 'acoustic', 'Add ambient sound design to the scene', ['pinepaper_audio_oscillator'], ['acoustic.sine_oscillator'], {
    acceptableToolSets: [['pinepaper_audio_oscillator'], ['pinepaper_audio_oscillator', 'pinepaper_audio_envelope']],
    crossDomain: ['animations'],
  }),
  tc('T6', 'medium', 'acoustic', 'Make it respond with sound when clicked', ['pinepaper_audio_trigger'], ['acoustic.node_activate'], {
    acceptableToolSets: [['pinepaper_audio_trigger'], ['pinepaper_audio_oscillator']],
    crossDomain: ['relations'],
  }),

  // Path operations as primary
  tc('T6', 'medium', 'path_operations', 'Combine these shapes into one', ['pinepaper_path_boolean'], ['path_operations.unite'], {
    acceptableToolSets: [['pinepaper_path_boolean'], ['pinepaper_group']],
    crossDomain: ['composition', 'shapes'],
  }),
  tc('T6', 'hard', 'path_operations', 'Cut out the overlap between the circles', ['pinepaper_path_boolean'], ['path_operations.subtract'], {
    acceptableToolSets: [['pinepaper_path_boolean'], ['pinepaper_modify_item']],
    crossDomain: ['shapes'],
  }),

  // Animations as primary (more diversity)
  tc('T6', 'medium', 'animations', 'Make everything come alive', ['pinepaper_animate'], ['animation.pulse', 'animation.bounce'], {
    acceptableToolSets: [['pinepaper_animate'], ['pinepaper_animate_keyframe'], ['pinepaper_animate', 'pinepaper_add_relation']],
    crossDomain: ['relations', 'composition'],
  }),
  tc('T6', 'hard', 'animations', 'Choreograph a sequence of reveals', ['pinepaper_animate_keyframe'], ['animation.keyframe'], {
    acceptableToolSets: [['pinepaper_animate_keyframe'], ['pinepaper_animate'], ['pinepaper_animate', 'pinepaper_add_relation']],
    crossDomain: ['composition', 'masking'],
  }),
  tc('T6', 'medium', 'animations', 'Add a gentle breathing effect to the card', ['pinepaper_animate'], ['animation.pulse'], {
    acceptableToolSets: [['pinepaper_animate'], ['pinepaper_add_relation']],
    crossDomain: ['styling'],
  }),
];

// ============================================================================
// Combined Dataset
// ============================================================================

const ALL_CASES: ToolSelectionTestCase[] = [
  ...T1_CASES,
  ...T2_CASES,
  ...T3_CASES,
  ...T4_CASES,
  ...T5_CASES,
  ...T6_CASES,
];

// ============================================================================
// Evaluator — IR Metrics
// ============================================================================

export class ToolSelectionBenchmark {
  private suite: BenchmarkSuite;

  constructor(suite?: BenchmarkSuite) {
    this.suite = suite ?? ToolSelectionBenchmark.getDataset();
  }

  // --------------------------------------------------------------------------
  // Static IR metrics
  // --------------------------------------------------------------------------

  /**
   * Recall@K: fraction of ground-truth tools present in the top-K predictions.
   */
  static recallAtK(predicted: string[], groundTruth: string[], k: number): number {
    if (groundTruth.length === 0) return 1;
    const topK = predicted.slice(0, k);
    const hits = groundTruth.filter((t) => topK.includes(t)).length;
    return hits / groundTruth.length;
  }

  /**
   * NDCG@K: normalized discounted cumulative gain.
   * Relevance = 1 for ground-truth tools, 0 otherwise.
   */
  static ndcgAtK(predicted: string[], groundTruth: string[], k: number): number {
    if (groundTruth.length === 0) return 1;
    const topK = predicted.slice(0, k);

    // DCG
    let dcg = 0;
    for (let i = 0; i < topK.length; i++) {
      const rel = groundTruth.includes(topK[i]) ? 1 : 0;
      dcg += rel / Math.log2(i + 2); // i+2 because rank is 1-based
    }

    // Ideal DCG: all relevant items at top
    const idealK = Math.min(groundTruth.length, k);
    let idcg = 0;
    for (let i = 0; i < idealK; i++) {
      idcg += 1 / Math.log2(i + 2);
    }

    return idcg === 0 ? 0 : dcg / idcg;
  }

  /**
   * Mean Reciprocal Rank: 1 / rank of the first correct prediction.
   */
  static mrr(predicted: string[], groundTruth: string[]): number {
    for (let i = 0; i < predicted.length; i++) {
      if (groundTruth.includes(predicted[i])) {
        return 1 / (i + 1);
      }
    }
    return 0;
  }

  // --------------------------------------------------------------------------
  // Evaluate a findTools implementation
  // --------------------------------------------------------------------------

  evaluate(
    findTools: (instruction: string) => RankedTool[],
  ): ToolSelectionResult {
    return this.evaluateCases(this.suite.testCases as ToolSelectionTestCase[], findTools);
  }

  evaluateByTier(
    findTools: (instruction: string) => RankedTool[],
  ): Record<string, ToolSelectionResult> {
    const tiers: Record<string, ToolSelectionResult> = {};
    for (const tier of ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'] as Tier[]) {
      const cases = ToolSelectionBenchmark.getTestCasesByTier(tier);
      tiers[tier] = this.evaluateCases(cases, findTools);
    }
    return tiers;
  }

  private evaluateCases(
    cases: ToolSelectionTestCase[],
    findTools: (instruction: string) => RankedTool[],
  ): ToolSelectionResult {
    let r1Sum = 0, r3Sum = 0, r5Sum = 0, ndcg5Sum = 0, mrrSum = 0;
    const byDifficulty: Record<string, { r5Sum: number; mrrSum: number; count: number }> = {};

    for (const tc of cases) {
      const ranked = findTools(tc.prompt);
      const predicted = ranked.map((r) => r.tool);
      const gt = tc.metadata.expectedTools;

      const r1 = ToolSelectionBenchmark.recallAtK(predicted, gt, 1);
      const r3 = ToolSelectionBenchmark.recallAtK(predicted, gt, 3);
      const r5 = ToolSelectionBenchmark.recallAtK(predicted, gt, 5);
      const n5 = ToolSelectionBenchmark.ndcgAtK(predicted, gt, 5);
      const m = ToolSelectionBenchmark.mrr(predicted, gt);

      r1Sum += r1; r3Sum += r3; r5Sum += r5; ndcg5Sum += n5; mrrSum += m;

      const d = tc.metadata.difficulty;
      if (!byDifficulty[d]) byDifficulty[d] = { r5Sum: 0, mrrSum: 0, count: 0 };
      byDifficulty[d].r5Sum += r5;
      byDifficulty[d].mrrSum += m;
      byDifficulty[d].count++;
    }

    const n = cases.length || 1;
    return {
      recall_at_1: r1Sum / n,
      recall_at_3: r3Sum / n,
      recall_at_5: r5Sum / n,
      ndcg_at_5: ndcg5Sum / n,
      mrr: mrrSum / n,
      totalCases: cases.length,
      byDifficulty: Object.fromEntries(
        Object.entries(byDifficulty).map(([d, v]) => [
          d,
          { recall_at_5: v.r5Sum / (v.count || 1), mrr: v.mrrSum / (v.count || 1) },
        ]),
      ),
    };
  }

  // --------------------------------------------------------------------------
  // LaTeX export
  // --------------------------------------------------------------------------

  toLatexTable(results: Record<string, ToolSelectionResult>): string {
    const lines: string[] = [
      '\\begin{table}[t]',
      '\\centering',
      '\\caption{Tool selection benchmark results by tier.}',
      '\\label{tab:tool-selection}',
      '\\begin{tabular}{lrrrrr}',
      '\\toprule',
      'Tier & R@1 & R@3 & R@5 & NDCG@5 & MRR \\\\',
      '\\midrule',
    ];

    for (const [tier, r] of Object.entries(results)) {
      lines.push(
        `${tier} & ${r.recall_at_1.toFixed(3)} & ${r.recall_at_3.toFixed(3)} & ${r.recall_at_5.toFixed(3)} & ${r.ndcg_at_5.toFixed(3)} & ${r.mrr.toFixed(3)} \\\\`,
      );
    }

    lines.push('\\bottomrule', '\\end{tabular}', '\\end{table}');
    return lines.join('\n');
  }

  // --------------------------------------------------------------------------
  // Dataset access
  // --------------------------------------------------------------------------

  static getDataset(): BenchmarkSuite {
    return {
      name: 'PinePaper-ToolBench',
      description:
        'Tool selection benchmark with 6 complexity tiers for evaluating KG-based retrieval vs flat baselines.',
      version: '1.0.0',
      testCases: ALL_CASES,
      categories: [
        'shapes', 'styling', 'animations', 'relations', 'generators',
        'filters', 'effects', 'diagrams', 'composition', 'export',
        'acoustic', 'rigging', 'blending', 'masking', 'camera',
        '3d',
      ],
    };
  }

  static getTestCasesByTier(tier: Tier): ToolSelectionTestCase[] {
    return ALL_CASES.filter((c) => c.metadata.tier === tier);
  }

  static getAllTestCases(): ToolSelectionTestCase[] {
    return ALL_CASES;
  }

  static getTierCounts(): Record<Tier, number> {
    const counts: Record<string, number> = {};
    for (const c of ALL_CASES) {
      counts[c.metadata.tier] = (counts[c.metadata.tier] || 0) + 1;
    }
    return counts as Record<Tier, number>;
  }
}
