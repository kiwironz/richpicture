/**
 * iconLibrary — SVG path definitions for the built-in icon palette.
 *
 * Each icon is rendered on-canvas via rough.svg.path(), giving it the same
 * hand-drawn sketchy aesthetic as all other elements.
 *
 * paths[] — array of { d, stroke?, fill?, strokeWidth? }
 *   Each path entry becomes one rough.js path() call so each stroke gets its
 *   own independent roughness variation (looks more natural).
 *
 * All icons use a 0 0 100 100 viewBox.  The Renderer scales them to whatever
 * width/height the element has in the store.
 */

export const ICON_LIBRARY = [
  // ── Actors ────────────────────────────────────────────────────────────────
  {
    id:       'person',
    label:    'Person',
    category: 'Actors',
    paths: [
      { d: 'M35,22 A15,15 0 1,0 65,22 A15,15 0 1,0 35,22' },  // head
      { d: 'M50,37 L50,74' },                                    // body
      { d: 'M20,54 L80,54' },                                    // arms
      { d: 'M50,74 L28,100 M50,74 L72,100' },                   // legs
    ],
  },
  {
    id:       'people',
    label:    'Group',
    category: 'Actors',
    paths: [
      // centre
      { d: 'M44,18 A11,11 0 1,0 66,18 A11,11 0 1,0 44,18' },
      { d: 'M55,30 L55,62 M33,44 L77,44 M55,62 L40,82 M55,62 L70,82' },
      // left
      { d: 'M14,22 A11,11 0 1,0 36,22 A11,11 0 1,0 14,22' },
      { d: 'M25,34 L25,66 M5,48 L45,48 M25,66 L12,86 M25,66 L38,86' },
      // right
      { d: 'M64,22 A11,11 0 1,0 86,22 A11,11 0 1,0 64,22' },
      { d: 'M75,34 L75,66 M55,48 L95,48 M75,66 L62,86 M75,66 L88,86' },
    ],
  },
  {
    id:       'organisation',
    label:    'Organisation',
    category: 'Actors',
    paths: [
      { d: 'M5,40 L50,8 L95,40' },          // roof
      { d: 'M10,40 L10,94 M90,40 L90,94' }, // walls
      { d: 'M10,94 L90,94' },               // floor
      { d: 'M40,94 L40,70 L60,70 L60,94' }, // door
      { d: 'M18,52 L32,52 L32,66 L18,66 Z' }, // window L
      { d: 'M68,52 L82,52 L82,66 L68,66 Z' }, // window R
    ],
  },
  {
    id:       'role',
    label:    'Role',
    category: 'Actors',
    paths: [
      { d: 'M35,28 A14,14 0 1,0 63,28 A14,14 0 1,0 35,28' }, // head
      { d: 'M49,42 L49,72 M28,56 L70,56 M49,72 L33,92 M49,72 L65,92' }, // body
      { d: 'M10,10 L90,10 L90,95 L10,95 Z' }, // box
    ],
  },
  {
    id:       'external',
    label:    'External',
    category: 'Actors',
    paths: [
      { d: 'M38,26 A12,12 0 1,0 62,26 A12,12 0 1,0 38,26' }, // head
      { d: 'M50,38 L50,70 M28,54 L72,54 M50,70 L34,92 M50,70 L66,92' }, // body
      { d: 'M6,6 L94,6 L94,94 L6,94 Z', strokeWidth: 1.2 }, // external frame
    ],
  },

  // ── Systems ───────────────────────────────────────────────────────────────
  {
    id:       'process',
    label:    'Process',
    category: 'Systems',
    paths: [
      { d: 'M8,8 L92,8 L92,92 L8,92 Z' },       // outer box
      { d: 'M8,28 L92,28' },                      // header rule
      { d: 'M22,45 L78,45 M22,58 L62,58 M22,71 L70,71' }, // content lines
    ],
  },
  {
    id:       'database',
    label:    'Database',
    category: 'Systems',
    paths: [
      { d: 'M15,22 A35,11 0 1,0 85,22 A35,11 0 1,0 15,22' }, // top ellipse
      { d: 'M15,22 L15,78 M85,22 L85,78' },                   // sides
      { d: 'M15,50 A35,11 0 1,0 85,50 A35,11 0 1,0 15,50' }, // middle seam
      { d: 'M15,78 A35,11 0 1,0 85,78 A35,11 0 1,0 15,78' }, // bottom ellipse
    ],
  },
  {
    id:       'computer',
    label:    'Computer',
    category: 'Systems',
    paths: [
      { d: 'M8,8 L92,8 L92,72 L8,72 Z' },    // screen
      { d: 'M50,72 L50,84' },                  // neck
      { d: 'M28,84 L72,84' },                  // base
      { d: 'M18,18 L82,18 L82,62 L18,62 Z' }, // screen bezel
    ],
  },
  {
    id:       'cloud',
    label:    'Cloud',
    category: 'Systems',
    paths: [
      { d: 'M25,75 Q8,75 8,60 Q8,44 22,40 Q20,18 40,18 Q46,6 62,10 Q74,4 82,16 Q96,14 96,30 Q108,32 104,50 Q106,68 90,70 Q86,80 74,76 Q68,88 54,82 Q44,90 34,82 Q20,84 25,75 Z' },
    ],
  },
  {
    id:       'server',
    label:    'Server',
    category: 'Systems',
    paths: [
      { d: 'M8,8 L92,8 L92,40 L8,40 Z' },   // rack 1
      { d: 'M8,46 L92,46 L92,78 L8,78 Z' },  // rack 2
      { d: 'M74,22 A6,6 0 1,0 86,22 A6,6 0 1,0 74,22' }, // LED 1
      { d: 'M74,60 A6,6 0 1,0 86,60 A6,6 0 1,0 74,60' }, // LED 2
      { d: 'M18,22 L58,22 M18,60 L58,60' },  // front detail
    ],
  },
  {
    id:       'mobile',
    label:    'Mobile',
    category: 'Systems',
    paths: [
      { d: 'M28,4 L72,4 L72,96 L28,96 Z' },  // body
      { d: 'M28,20 L72,20 M28,78 L72,78' },   // bezels
      { d: 'M44,88 A6,5 0 1,0 56,88 A6,5 0 1,0 44,88' }, // home button
      { d: 'M44,11 L56,11' },                  // speaker
    ],
  },
  {
    id:       'document',
    label:    'Document',
    category: 'Systems',
    paths: [
      { d: 'M15,5 L73,5 L85,17 L85,95 L15,95 Z' }, // body
      { d: 'M73,5 L73,17 L85,17' },                 // folded corner
      { d: 'M26,35 L74,35 M26,50 L74,50 M26,65 L62,65' }, // content lines
    ],
  },
  {
    id:       'service',
    label:    'Service',
    category: 'Systems',
    paths: [
      { d: 'M50,6 L88,27 L88,73 L50,94 L12,73 L12,27 Z' }, // outer hex
      { d: 'M50,30 L69,41 L69,63 L50,74 L31,63 L31,41 Z' }, // inner hex
    ],
  },

  // ── Communication ─────────────────────────────────────────────────────────
  {
    id:       'speech',
    label:    'Speech',
    category: 'Communication',
    paths: [
      { d: 'M8,8 Q8,5 12,5 L88,5 Q92,5 92,8 L92,64 Q92,67 88,67 L52,67 L42,86 L40,67 L12,67 Q8,67 8,64 Z' },
    ],
  },
  {
    id:       'thought',
    label:    'Thought',
    category: 'Communication',
    paths: [
      { d: 'M22,72 Q8,72 8,58 Q8,44 20,40 Q18,22 36,20 Q42,8 58,12 Q70,6 78,18 Q92,16 92,32 Q104,34 100,50 Q102,66 88,68 Q84,78 72,74 Q66,84 54,80 Q44,86 36,80 Q24,82 22,72 Z' },
      { d: 'M28,82 A4,4 0 1,0 36,82 A4,4 0 1,0 28,82' },
      { d: 'M22,90 A3,3 0 1,0 28,90 A3,3 0 1,0 22,90' },
      { d: 'M18,96 A2,2 0 1,0 22,96 A2,2 0 1,0 18,96' },
    ],
  },
  {
    id:       'email',
    label:    'Email',
    category: 'Communication',
    paths: [
      { d: 'M8,22 L92,22 L92,78 L8,78 Z' },  // envelope body
      { d: 'M8,22 L50,54 L92,22' },           // V fold
    ],
  },
  {
    id:       'meeting',
    label:    'Meeting',
    category: 'Communication',
    paths: [
      { d: 'M24,40 L76,40 L76,66 L24,66 Z' }, // table
      // top person
      { d: 'M42,8 A8,8 0 1,0 58,8 A8,8 0 1,0 42,8 M50,16 L50,40' },
      // left person
      { d: 'M4,46 A7,7 0 1,0 18,46 A7,7 0 1,0 4,46 M11,53 L24,52' },
      // right person
      { d: 'M82,46 A7,7 0 1,0 96,46 A7,7 0 1,0 82,46 M89,53 L76,52' },
      // bottom person
      { d: 'M42,86 A8,8 0 1,0 58,86 A8,8 0 1,0 42,86 M50,66 L50,78' },
    ],
  },

  // ── Concepts & Issues ─────────────────────────────────────────────────────
  {
    id:       'lightning',
    label:    'Conflict',
    category: 'Issues',
    paths: [
      { d: 'M62,4 L34,50 L54,50 L38,96 L80,42 L56,42 Z' },
    ],
  },
  {
    id:       'explosion',
    label:    'Issue',
    category: 'Issues',
    paths: [
      { d: 'M50,4 L58,36 L88,20 L68,46 L96,60 L62,60 L66,92 L48,70 L30,92 L34,60 L4,60 L32,46 L12,20 L42,36 Z' },
    ],
  },
  {
    id:       'question',
    label:    'Uncertainty',
    category: 'Issues',
    paths: [
      { d: 'M32,36 Q32,12 50,12 Q68,12 68,30 Q68,46 50,52 L50,67' }, // ? curve
      { d: 'M44,80 A6,6 0 1,0 56,80 A6,6 0 1,0 44,80' },             // dot
    ],
  },
  {
    id:       'lightbulb',
    label:    'Idea',
    category: 'Issues',
    paths: [
      { d: 'M50,8 A28,28 0 0,1 78,36 Q78,55 64,64 L64,78 L36,78 L36,64 Q22,55 22,36 A28,28 0 0,1 50,8 Z' }, // bulb
      { d: 'M38,78 L62,78 M40,85 L60,85 M44,92 L56,92' }, // base ridges
    ],
  },
  {
    id:       'heart',
    label:    'Value',
    category: 'Issues',
    paths: [
      { d: 'M50,82 Q14,58 14,38 A22,22 0 0,1 50,22 A22,22 0 0,1 86,38 Q86,58 50,82 Z' },
    ],
  },
  {
    id:       'warning',
    label:    'Warning',
    category: 'Issues',
    paths: [
      { d: 'M50,8 L94,90 L6,90 Z' },                          // triangle
      { d: 'M50,38 L50,65' },                               // ! bar
      { d: 'M44,76 A6,6 0 1,0 56,76 A6,6 0 1,0 44,76' },  // ! dot
    ],
  },
  {
    id:       'clock',
    label:    'Deadline',
    category: 'Issues',
    paths: [
      { d: 'M50,8 A42,42 0 0,1 50,92 A42,42 0 0,1 50,8 Z' }, // face
      { d: 'M50,50 L50,22 M50,50 L74,50' },                   // hands
      { d: 'M48,50 A2,2 0 1,0 52,50 A2,2 0 1,0 48,50' },     // centre dot
    ],
  },
  {
    id:       'lock',
    label:    'Constraint',
    category: 'Issues',
    paths: [
      { d: 'M30,46 L30,28 Q30,8 50,8 Q70,8 70,28 L70,46' },  // shackle
      { d: 'M12,44 L88,44 L88,94 L12,94 Z' },                 // body
      { d: 'M44,64 A6,6 0 1,0 56,64 A6,6 0 1,0 44,64 M50,70 L50,82' }, // keyhole
    ],
  },
  {
    id:       'arrow-right',
    label:    'Flow',
    category: 'Issues',
    paths: [
      { d: 'M8,50 L82,50' },
      { d: 'M82,50 L60,28 M82,50 L60,72' },
    ],
  },
]

// Category order for the panel
export const ICON_CATEGORIES = ['Actors', 'Systems', 'Communication', 'Issues']
