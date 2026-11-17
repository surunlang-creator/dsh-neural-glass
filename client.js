/**
 * Neural Glass · 神经流光 — Client half.
 *
 * A switchable skin for the Harness Web UI:
 *  - a transparent canvas behind every shell panel that animates one continuous
 *    Transformer pipeline (the sentence -> tokens -> embeddings -> Q/K/V ->
 *    attention -> residual/norm -> MLP neurons -> next token),
 *  - a glass token layer over the host surfaces so panels show the pipeline,
 *  - a settings page under Settings that drives both.
 *
 * The canvas is inserted as body's first child at z-index -1 (the frame paints
 * its own surfaces above it) and everything is removed again on dispose. The
 * dark ground itself comes from the host page, so the canvas stays transparent.
 */

window.__ModuleLoader__.load({
  id: '@local/neural-glass',
  factory(require) {
    'use strict'

    const React = require('react')
    const PACKAGE_ID = '@local/neural-glass'
    const SETTINGS_KEY = 'neural-glass:settings:v1'
    const PREV_THEME_KEY = 'neural-glass:previous-theme'
    const TAU = Math.PI * 2
    const MONO = '"SF Mono", "JetBrains Mono", "Fira Code", Menlo, Consolas, monospace'
    const SANS = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Helvetica Neue", Arial, sans-serif'

    // Demo sentence. Word-level split on purpose: Chinese word segmentation is
    // illustrative here and the scene labels it as such.
    const SENTENCE = ['一只', '蓝色', '小动物', '穿过', '安静的', '森林']

    // --------------------------------------------------------------- settings

    /** One-click moods; only the visual tunables, never structure or on/off state. */
    const PRESETS = {
      focus: { glass: 0.4, brightness: 0.58, frost: 0.72, speed: 0.7, particles: 0.45, codeScan: false, glow: 0.6 },
      balanced: { glass: 0.3, brightness: 0.82, frost: 0.35, speed: 1, particles: 0.85, codeScan: true, glow: 0.9 },
      immersive: { glass: 0.2, brightness: 1.12, frost: 0.1, speed: 1.2, particles: 1.25, codeScan: true, glow: 1.2 },
    }

    const DEFAULTS = {
      enabled: true,
      paused: false,
      brightness: 0.82,
      glass: 0.3,
      frost: 0.35,
      speed: 1,
      glow: 0.9,
      particles: 0.85,
      codeScan: true,
      labels: true,
      mode: 'encdec',
      source: 'demo',
      quality: 'medium',
      reduceMotion: false,
      darkBase: true,
      intro: true,
    }

    const RANGES = {
      brightness: [0.35, 1.4],
      glass: [0.12, 0.55],
      frost: [0, 1],
      speed: [0.4, 2],
      glow: [0, 1.6],
      particles: [0.2, 1.6],
    }

    const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
    /** Background glow is presented as 0..100% over the stored 0.35..1.4 range. */
    const glowPercentOf = (value) => Math.round(clamp((value - 0.35) / 1.05, 0, 1) * 100)
    const glowValueOf = (percent) => clamp(0.35 + (clamp(percent, 0, 100) / 100) * 1.05, 0.35, 1.4)
    const lerp = (a, b, x) => a + (b - a) * x
    const rgba = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`
    const frac = (x) => x - Math.floor(x)

    /** Normalize one stored value against DEFAULTS/RANGES. */
    function sanitize(patch) {
      const next = { ...DEFAULTS }
      if (patch === null || typeof patch !== 'object') return next
      for (const [key, fallback] of Object.entries(DEFAULTS)) {
        const value = patch[key]
        if (typeof fallback === 'boolean') {
          if (typeof value === 'boolean') next[key] = value
        } else if (typeof fallback === 'number') {
          if (typeof value === 'number' && Number.isFinite(value)) {
            const range = RANGES[key]
            next[key] = range === undefined ? value : clamp(value, range[0], range[1])
          }
        } else if (typeof fallback === 'string') {
          const allowed = {
            mode: ['encdec', 'decoder'],
            source: ['demo', 'host'],
            quality: ['low', 'medium', 'high'],
          }[key]
          if (typeof value === 'string' && (allowed === undefined || allowed.includes(value))) next[key] = value
        }
      }
      return next
    }

    function loadSettings() {
      try {
        const raw = window.localStorage.getItem(SETTINGS_KEY)
        if (raw === null) return { ...DEFAULTS }
        return sanitize(JSON.parse(raw))
      } catch {
        return { ...DEFAULTS }
      }
    }

    function saveSettings(state) {
      try {
        window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(state))
      } catch {
        // Private mode or quota: the skin still runs with in-memory settings.
      }
    }

    /** Minimal observable settings store shared by the scene and the settings page. */
    function createSettingsStore() {
      let state = loadSettings()
      const listeners = new Set()
      return {
        get: () => state,
        subscribe(listener) {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
        patch(patch) {
          state = sanitize({ ...state, ...patch })
          saveSettings(state)
          for (const listener of [...listeners]) listener()
          return state
        },
        reset() {
          state = { ...DEFAULTS }
          saveSettings(state)
          for (const listener of [...listeners]) listener()
          return state
        },
      }
    }

    /** Open/closed state of the floating control panel (page-local, not persisted). */
    function createPanelStore() {
      let open = false
      const listeners = new Set()
      const emit = () => { for (const listener of [...listeners]) listener() }
      return {
        get: () => open,
        subscribe(listener) {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
        set(value) {
          if (open === value) return
          open = value
          emit()
        },
        toggle() {
          open = !open
          emit()
        },
      }
    }

    // ------------------------------------------------------------------ theme

    const INK = {
      dark: {
        ground: [5, 8, 15],
        groundHi: [11, 20, 34],
        grid: [49, 68, 84],
        link: [49, 68, 84],
        label: [124, 147, 168],
        code: [93, 127, 150],
        token: [220, 231, 245],
        q: [233, 205, 114],
        k: [99, 216, 197],
        v: [237, 154, 142],
        attn: [138, 190, 255],
        mlp: [182, 160, 237],
        out: [234, 244, 255],
        veil: [5, 8, 15],
        glowBlend: 'lighter',
      },
      light: {
        ground: [238, 243, 250],
        groundHi: [255, 255, 255],
        grid: [120, 150, 180],
        link: [159, 178, 196],
        label: [93, 116, 136],
        code: [122, 147, 168],
        token: [29, 53, 80],
        q: [184, 137, 31],
        k: [30, 156, 136],
        v: [201, 106, 94],
        attn: [63, 127, 212],
        mlp: [122, 98, 200],
        out: [15, 42, 68],
        veil: [238, 243, 250],
        glowBlend: 'multiply',
      },
    }

    /** Glass surfaces. Alpha lives on the paint tokens, never on container opacity. */
    function glassTokens(glass) {
      const base = (a) => `rgba(8, 14, 24, ${a.toFixed(3)})`
      const deep = (a) => `rgba(10, 18, 30, ${a.toFixed(3)})`
      const light = (a) => `rgba(244, 248, 253, ${a.toFixed(3)})`
      const lightDeep = (a) => `rgba(250, 252, 255, ${a.toFixed(3)})`
      return {
        // The Harness stacks bg-base on the frame, the centre column and the
        // conversation root, so one glass coat is roughly this value squared.
        '--dsw-alias-bg-base': { dark: base(glass), light: light(glass + 0.02) },
        '--dsw-alias-bg-document-preview': { dark: deep(glass + 0.2), light: lightDeep(glass + 0.34) },
        '--dsw-alias-bg-layer-1': { dark: deep(glass + 0.1), light: lightDeep(glass + 0.24) },
        '--dsw-alias-bg-layer-2': { dark: deep(glass + 0.16), light: lightDeep(glass + 0.3) },
        '--dsw-alias-bg-layer-3': { dark: deep(glass + 0.22), light: lightDeep(glass + 0.36) },
        '--dsw-alias-bg-overlay': { dark: 'rgba(7, 12, 20, 0.97)', light: 'rgba(255, 255, 255, 0.985)' },
        '--dsw-alias-hovercard-bg': { dark: 'rgba(9, 15, 25, 0.96)', light: 'rgba(255, 255, 255, 0.97)' },
        '--dsw-alias-card-fill': { dark: deep(glass + 0.2), light: lightDeep(glass + 0.3) },
        '--dsw-alias-button-floating-fill': { dark: deep(glass + 0.26), light: lightDeep(glass + 0.38) },
        '--dsw-alias-bg-mask-1': { dark: 'rgba(3, 6, 11, 0.52)', light: 'rgba(226, 235, 246, 0.5)' },
        '--dsw-alias-bg-skeleton': { dark: 'rgba(122, 178, 232, 0.09)', light: 'rgba(30, 90, 150, 0.08)' },
        '--dsw-alias-border-l1': { dark: 'rgba(122, 158, 196, 0.13)', light: 'rgba(26, 84, 148, 0.10)' },
        '--dsw-alias-border-l2': { dark: 'rgba(122, 158, 196, 0.19)', light: 'rgba(26, 84, 148, 0.16)' },
        '--dsw-alias-border-l3': { dark: 'rgba(122, 158, 196, 0.23)', light: 'rgba(26, 84, 148, 0.19)' },
        '--dsw-alias-border-l4': { dark: 'rgba(122, 158, 196, 0.28)', light: 'rgba(26, 84, 148, 0.24)' },
        '--dsw-specific-sidebar-fill': { dark: base(glass + 0.16), light: light(glass + 0.2) },
        '--dsw-specific-sidebar-tint': {
          dark: `color-mix(in srgb, rgba(8, 14, 24, ${(glass + 0.16).toFixed(3)}) 50%, transparent)`,
          light: `color-mix(in srgb, rgba(240, 246, 253, 0.8) 50%, transparent)`,
        },
        '--dsw-specific-sidebar-wash-top': { dark: 'rgba(84, 172, 255, 0.09)', light: 'rgba(72, 140, 226, 0.09)' },
        '--dsw-specific-sidebar-wash-bottom': { dark: 'rgba(132, 122, 214, 0.08)', light: 'rgba(120, 112, 200, 0.07)' },
        '--dsw-specific-sidebar-glass-fill': { dark: deep(glass + 0.24), light: lightDeep(glass + 0.5) },
        '--dsw-specific-sidebar-glass-hover': { dark: deep(glass + 0.32), light: lightDeep(glass + 0.58) },
        '--dsw-specific-input-major': { dark: deep(Math.min(0.66, glass + 0.34)), light: lightDeep(glass + 0.44) },
        '--dsw-specific-selector': { dark: deep(glass + 0.3), light: lightDeep(glass + 0.4) },
      }
    }

    // ----------------------------------------------------------------- layout

    /** Rounded rectangle path (Path2D.roundRect is not available everywhere). */
    function roundRect(g, x, y, w, h, r) {
      const rr = Math.min(r, w / 2, h / 2)
      g.beginPath()
      g.moveTo(x + rr, y)
      g.lineTo(x + w - rr, y)
      g.arcTo(x + w, y, x + w, y + rr, rr)
      g.lineTo(x + w, y + h - rr)
      g.arcTo(x + w, y + h, x + w - rr, y + h, rr)
      g.lineTo(x + rr, y + h)
      g.arcTo(x, y + h, x, y + h - rr, rr)
      g.lineTo(x, y + rr)
      g.arcTo(x, y, x + rr, y, rr)
      g.closePath()
    }

    /** Point on a cubic bezier (t in 0..1). */
    function cubicPoint(p0, c1, c2, p1, t) {
      const u = 1 - t
      const a = u * u * u
      const b = 3 * u * u * t
      const c = 3 * u * t * t
      const d = t * t * t
      return { x: a * p0.x + b * c1.x + c * c2.x + d * p1.x, y: a * p0.y + b * c1.y + c * c2.y + d * p1.y }
    }

    /** Symmetric 0..1 envelope with eased shoulders. */
    function envelope(x) {
      const s = Math.sin(Math.PI * clamp(x, 0, 1))
      return s * s
    }

    /** Ramp up over `inMs`, hold, ramp down over `outMs`, all normalized to 0..1. */
    function phaseEnv(p, start, end, fadeIn, fadeOut) {
      if (p < start || p > end) return 0
      const head = fadeIn <= 0 ? 1 : clamp((p - start) / fadeIn, 0, 1)
      const tail = fadeOut <= 0 ? 1 : clamp((end - p) / fadeOut, 0, 1)
      return head * tail
    }

    /** Seeded PRNG keeps the ambient layer identical between frames. */
    function mulberry32(seed) {
      let a = seed >>> 0
      return function next() {
        a = (a + 0x6D2B79F5) >>> 0
        let x = a
        x = Math.imul(x ^ (x >>> 15), x | 1)
        x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296
      }
    }

    /**
     * Resolve the pipeline geometry for one viewport.
     * Three densities: full (wide), compact (medium), minimal (narrow).
     */
    function computeLayout(W, H) {
      const margin = clamp(W * 0.02, 12, 36)
      const density = W >= 1120 ? 'full' : W >= 760 ? 'compact' : 'minimal'
      const towerWidth = density === 'full' ? clamp(W * 0.26, 330, 400) : clamp(W * 0.34, 220, 300)
      const towerX = W - margin - towerWidth

      const bandTop = clamp(H * 0.1, 86, 150)
      const tokenY = bandTop + 14
      const tokenH = 24
      const tokenGap = density === 'full' ? 11 : 8
      const tokenW = density === 'full' ? 56 : 46
      const tokenMax = density === 'full' ? SENTENCE.length : Math.min(SENTENCE.length, 4)
      const tokensStart = Math.max(margin + 4, Math.min(W * 0.23, 330))
      const tokens = []
      for (let i = 0; i < tokenMax; i += 1) {
        tokens.push({
          label: SENTENCE[i],
          index: i,
          x: tokensStart + i * (tokenW + tokenGap),
          y: tokenY,
          w: tokenW,
          h: tokenH,
        })
      }
      const tokenEnd = tokens.length === 0 ? tokensStart : tokens[tokens.length - 1].x + tokenW
      const arcDepth = density === 'full' ? 58 : 40
      const arcBase = tokenY + tokenH
      const embedY = arcBase + arcDepth + 22
      const embedH = density === 'full' ? 36 : 26
      const contextY = embedY + embedH + 12

      const matrixSize = density === 'full' ? 84 : 60
      const matrix = {
        x: Math.min(tokenEnd + 34, towerX - matrixSize - 20),
        y: tokenY - 4,
        w: matrixSize,
        h: matrixSize,
        cols: tokenMax,
      }

      // Right-hand tower: projection matrices -> blocks -> MLP -> output.
      let y = Math.max(H * 0.26, bandTop + 120)
      const qkv = { x: towerX, y, w: towerWidth, h: 34, cells: [] }
      const cellGap = 8
      const cellW = (towerWidth - cellGap * 2) / 3
      for (let i = 0; i < 3; i += 1) {
        qkv.cells.push({ x: towerX + i * (cellW + cellGap), y: y + 12, w: cellW, h: 34 })
      }
      y += 34 + 12 + 26
      const blockW = towerWidth * (density === 'full' ? 0.72 : 0.86)
      const blockX = towerX + (towerWidth - blockW) / 2
      const blockH = 46
      const enc = { x: blockX, y, w: blockW, h: blockH }
      y += blockH + (density === 'full' ? 26 : 18)
      const dec = { x: blockX, y, w: blockW, h: blockH }
      y += blockH + 30

      // MLP: 12 -> 24 -> 12 illustrative units, drawn as rows of circles.
      const mlpRows = density === 'full' ? [12, 24, 12] : [8, 16, 8]
      const rowGap = density === 'full' ? 34 : 28
      const nodeR = density === 'full' ? 5.2 : 4.2
      const mlp = { x: towerX, y, w: towerWidth, rows: [], rowGap, nodeR }
      const usableW = towerWidth - 24
      for (let li = 0; li < mlpRows.length; li += 1) {
        const count = mlpRows[li]
        const step = usableW / Math.max(1, count - 1)
        const nodes = []
        for (let ni = 0; ni < count; ni += 1) {
          nodes.push({ x: towerX + 12 + ni * step, y: y + li * rowGap })
        }
        mlp.rows.push(nodes)
      }
      y += (mlpRows.length - 1) * rowGap + 26

      const output = { x: towerX, y, w: towerWidth, h: 44 }
      y += output.h + 12
      const outToken = { x: towerX + towerWidth / 2, y }

      return {
        density,
        margin,
        W,
        H,
        bandTop,
        tokens,
        tokenY,
        tokenH,
        tokenEnd,
        arcBase,
        arcDepth,
        embedY,
        embedH,
        contextY,
        matrix,
        towerX,
        towerWidth,
        qkv,
        enc,
        dec,
        mlp,
        output,
        outToken,
        towerTop: qkv.y,
        towerBottom: y,
        veil: {
          cx: W * 0.5,
          half: clamp(W * 0.32, 260, 470),
          top: H * 0.19,
          bottom: H * 0.95,
        },
      }
    }

    // ------------------------------------------------------------ illustrations

    /** Fixed weight values so numbers never flicker between frames. */
    function matrixValues(seed, rows, cols) {
      const rand = mulberry32(seed)
      const out = []
      for (let r = 0; r < rows; r += 1) {
        const row = []
        for (let c = 0; c < cols; c += 1) row.push((rand() * 2 - 1) * 9.4)
        out.push(row)
      }
      return out
    }

    /** Vector cells: a sampled high-dimensional embedding, stable per token. */
    function vectorCells(seed, count) {
      const rand = mulberry32(seed)
      const out = []
      for (let i = 0; i < count; i += 1) out.push(rand())
      return out
    }

    /**
     * Attention weights (illustrative, not model telemetry).
     * @param {boolean} causal - mask positions after the current token.
     */
    function attentionWeights(seed, n, causal) {
      const rand = mulberry32(seed)
      const out = []
      for (let r = 0; r < n; r += 1) {
        const row = []
        let sum = 0
        for (let c = 0; c < n; c += 1) {
          const allowed = !causal || c <= r
          const value = allowed ? rand() ** 2 : 0
          row.push(value)
          sum += value
        }
        out.push(row.map(v => (sum === 0 ? 0 : v / sum)))
      }
      return out
    }

    const WQ = matrixValues(17, 3, 3)
    const WK = matrixValues(31, 3, 3)
    const WV = matrixValues(53, 3, 3)
    const ATTENTION = {
      full: attentionWeights(71, SENTENCE.length, false),
      causal: attentionWeights(97, SENTENCE.length, true),
    }
    const EMBEDDINGS = SENTENCE.map((_, i) => vectorCells(101 + i * 13, 10))

    // Ordered so the scanned line follows the scene: projection, residual,
    // attention scores, softmax, value mix, FFN gate, FFN projection, logits.
    const CODE_FRAGMENTS = [
      'q = x @ Wq',
      'x = x + attn(norm(x))',
      'scores = q @ k.T / sqrt(d_k)',
      'weights = softmax(scores + mask)',
      'context = weights @ v',
      'h = gelu(x @ W1 + b1)',
      'y = h @ W2 + b2',
      'logits = h @ W_out',
    ]

    /** Which code fragment belongs to the scene phase at `t`. */
    function fragmentFocus(t) {
      if (t < 8) return 0
      if (t < 12.6) return 2 + Math.floor((t - 8) / 1.7)
      if (t < 14.2) return 1
      if (t < 17.6) return 5
      if (t < 19.4) return 6
      return 7
    }

    // ------------------------------------------------------------------ scene

    const CYCLE = 24

    /** Pre-rendered radial glow used by every travelling signal. */
    function makeGlow(col) {
      const size = 64
      const c = document.createElement('canvas')
      c.width = size
      c.height = size
      const g = c.getContext('2d')
      const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
      grd.addColorStop(0, rgba(col, 0.95))
      grd.addColorStop(0.16, rgba(col, 0.46))
      grd.addColorStop(0.44, rgba(col, 0.14))
      grd.addColorStop(1, rgba(col, 0))
      g.fillStyle = grd
      g.fillRect(0, 0, size, size)
      return c
    }

    /**
     * Build the scene: one transparent canvas plus the animation clock.
     * @param {string} scheme - active color scheme from the theme snapshot.
     * @param {object} store - settings store (read-only here).
     * @returns {object} scene handle with disposal.
     */
    function createScene(scheme, store) {
      const canvas = document.createElement('canvas')
      canvas.setAttribute('data-neural-glass', '')
      canvas.setAttribute('aria-hidden', 'true')
      canvas.style.cssText = [
        'position:fixed', 'inset:0', 'width:100%', 'height:100%', 'display:block',
        'z-index:-1', 'pointer-events:none', 'background:transparent',
        'opacity:0', 'transition:opacity 800ms ease-out',
      ].join(';')
      const host = document.body || document.documentElement
      host.insertBefore(canvas, host.firstChild)
      const g = canvas.getContext('2d')

      let ink = INK[scheme === 'light' ? 'light' : 'dark']
      let options = store.get()
      let W = 0
      let H = 0
      let dpr = 1
      let layout = null
      let backdrop = null
      let scratch = null
      let scratchCtx = null
      let sprites = null
      let digits = []
      let clock = 9.6
      const INTRO_SECONDS = 9
      // Armed on the first frame the page is actually visible, so a slow window
      // reveal cannot swallow the opening.
      let introStart = 0
      let introSeen = false
      let introBoost = 1
      let veilFactor = 1
      let lastFrame = 0
      let raf = 0
      let disposed = false
      let paused = false
      let engagement = 'demo'

      const reducedQuery = typeof matchMedia === 'function'
        ? matchMedia('(prefers-reduced-motion: reduce)')
        : null
      const motionReduced = () => (reducedQuery !== null && reducedQuery.matches) || options.reduceMotion

      const smoothstep = (x) => {
        const v = clamp(x, 0, 1)
        return v * v * (3 - 2 * v)
      }

      /** Brightness multiplier: full-strength opening that settles into the background. */
      const dimScale = () => options.brightness * introBoost

      function updateIntro() {
        if (!options.intro || motionReduced()) {
          introBoost = 1
          veilFactor = 1
          return
        }
        if (document.hidden) {
          // Hold the opening frame until the window is on screen.
          introBoost = 1.55
          veilFactor = 0.05
          return
        }
        if (introStart === 0) {
          introStart = performance.now()
          clock = 0
        }
        const elapsed = (performance.now() - introStart) / 1000
        const k = smoothstep(elapsed / INTRO_SECONDS)
        introBoost = 1 + 0.55 * (1 - k)
        veilFactor = 0.05 + 0.95 * k
        if (k > 0.999) introSeen = true
      }

      // ------------------------------------------------------------- building

      function targetFps() {
        if (options.quality === 'low') return 15
        if (options.quality === 'high') return 30
        return 24
      }

      function targetDpr() {
        const raw = window.devicePixelRatio || 1
        if (options.quality === 'low') return 1
        if (options.quality === 'high') return clamp(raw, 1, 2)
        return clamp(raw, 1, 1.25)
      }

      function buildSprites() {
        if (options.quality === 'low') {
          sprites = null
          return
        }
        sprites = {
          q: makeGlow(ink.q),
          k: makeGlow(ink.k),
          v: makeGlow(ink.v),
          attn: makeGlow(ink.attn),
          mlp: makeGlow(ink.mlp),
          out: makeGlow(ink.out),
          token: makeGlow(ink.token),
        }
      }

      function buildBackdrop() {
        const c = document.createElement('canvas')
        c.width = Math.max(1, Math.round(W * dpr))
        c.height = Math.max(1, Math.round(H * dpr))
        const bg = c.getContext('2d')
        bg.setTransform(dpr, 0, 0, dpr, 0, 0)

        // Two very soft field lights: cool above, violet below-left.
        const halo = (cx, cy, r, col, alpha) => {
          const grd = bg.createRadialGradient(cx, cy, 0, cx, cy, r)
          grd.addColorStop(0, rgba(col, alpha))
          grd.addColorStop(1, rgba(col, 0))
          bg.fillStyle = grd
          bg.fillRect(cx - r, cy - r, r * 2, r * 2)
        }
        halo(W * 0.74, H * 0.1, Math.max(W, H) * 0.5, ink.attn, ink === INK.dark ? 0.055 : 0.07)
        halo(W * 0.16, H * 0.9, Math.max(W, H) * 0.45, ink.mlp, ink === INK.dark ? 0.05 : 0.05)
        halo(W * 0.5, H * 0.45, Math.max(W, H) * 0.6, ink.groundHi, ink === INK.dark ? 0.5 : 0.35)

        // Faint coordinate grid.
        const step = 48
        bg.lineWidth = 1
        bg.strokeStyle = rgba(ink.grid, ink === INK.dark ? 0.075 : 0.09)
        bg.beginPath()
        for (let x = 0; x <= W; x += step) {
          bg.moveTo(Math.round(x) + 0.5, 0)
          bg.lineTo(Math.round(x) + 0.5, H)
        }
        for (let y = 0; y <= H; y += step) {
          bg.moveTo(0, Math.round(y) + 0.5)
          bg.lineTo(W, Math.round(y) + 0.5)
        }
        bg.stroke()

        // Crosshair ticks at the major intersections.
        bg.strokeStyle = rgba(ink.grid, ink === INK.dark ? 0.16 : 0.14)
        bg.beginPath()
        for (let x = step * 4; x < W; x += step * 4) {
          for (let y = step * 4; y < H; y += step * 4) {
            bg.moveTo(x - 3, y + 0.5)
            bg.lineTo(x + 3, y + 0.5)
            bg.moveTo(x + 0.5, y - 3)
            bg.lineTo(x + 0.5, y + 3)
          }
        }
        bg.stroke()
        backdrop = c
      }

      function buildAmbient() {
        const rand = mulberry32(0x1f2e3d4c)
        const count = options.quality === 'low' ? 8 : 16
        digits = []
        for (let i = 0; i < count; i += 1) {
          const side = i % 2 === 0
            ? margin0() + rand() * Math.max(60, W * 0.16)
            : W - margin0() - rand() * Math.max(60, W * 0.16)
          digits.push({
            text: (rand() < 0.5 ? '-' : '+') + (rand() * 9.9).toFixed(1),
            x: side,
            y: rand() * H,
            size: 8.5 + rand() * 2.5,
            drift: 1.6 + rand() * 4,
            phase: rand() * TAU,
          })
        }
      }

      const margin0 = () => layout === null ? 16 : layout.margin

      function build() {
        W = Math.max(360, window.innerWidth || document.documentElement.clientWidth || 1280)
        H = Math.max(360, window.innerHeight || document.documentElement.clientHeight || 800)
        dpr = targetDpr()
        canvas.width = Math.max(1, Math.round(W * dpr))
        canvas.height = Math.max(1, Math.round(H * dpr))
        layout = computeLayout(W, H)
        scratch = document.createElement('canvas')
        scratch.width = Math.max(1, Math.round(W / 4))
        scratch.height = Math.max(1, Math.round(H / 4))
        scratchCtx = scratch.getContext('2d')
        buildSprites()
        buildBackdrop()
        buildAmbient()
      }

      // ----------------------------------------------------------- primitives

      function glow(sprite, x, y, size, alpha) {
        if (sprite === null || alpha <= 0.004) return
        g.globalCompositeOperation = ink.glowBlend
        g.globalAlpha = clamp(alpha, 0, 1)
        g.drawImage(sprite, x - size / 2, y - size / 2, size, size)
        g.globalAlpha = 1
        g.globalCompositeOperation = 'source-over'
      }

      function text(str, x, y, size, color, alpha, opts) {
        if (alpha <= 0.004) return
        const o = opts || {}
        g.font = o.mono === false
          ? `500 ${size}px ${SANS}`
          : `400 ${size}px ${MONO}`
        g.fillStyle = rgba(color, alpha)
        g.textAlign = o.align || 'left'
        g.textBaseline = o.baseline || 'middle'
        g.fillText(str, x, y)
      }

      function line(x1, y1, x2, y2, color, alpha, width) {
        g.beginPath()
        g.moveTo(x1, y1)
        g.lineTo(x2, y2)
        g.strokeStyle = rgba(color, alpha)
        g.lineWidth = width || 1
        g.stroke()
      }

      function dot(x, y, r, color, alpha) {
        g.beginPath()
        g.arc(x, y, r, 0, TAU)
        g.fillStyle = rgba(color, alpha)
        g.fill()
      }

      /** Fade in/out envelope in scene seconds. */
      function env(t, start, end, fadeIn, fadeOut) {
        return phaseEnv(t, start, end, fadeIn === undefined ? 0.4 : fadeIn, fadeOut === undefined ? 0.5 : fadeOut)
      }

      // -------------------------------------------------------------- ambient

      function drawAmbient(t) {
        const dim = dimScale() * (options.quality === 'low' ? 0.8 : 1)

        // Sparse code fragments, with a scan that lights one group at a time.
        if (options.codeScan) {
          const fragments = options.quality === 'low' ? CODE_FRAGMENTS.slice(0, 4) : CODE_FRAGMENTS
          const focus = fragmentFocus(t) % fragments.length
          g.textBaseline = 'middle'
          for (let i = 0; i < fragments.length; i += 1) {
            const col = i % 2
            const row = Math.floor(i / 2)
            const x = col === 0
              ? margin0() + 6
              : W - margin0() - (fragments[i].length * 5.6 + 12)
            const y = 150 + row * 26 + (col === 1 ? 12 : 0)
            if (y > H - 40) continue
            // The current phase's fragment flares; the rest keep residue.
            const local = frac(t / 7 + i * 0.11)
            const residue = local < 0.16 ? 1 - local / 0.16 : Math.exp(-(local - 0.16) * 7) * 0.45
            const lit = i === focus ? Math.max(residue, 0.85) : residue * 0.4
            text(fragments[i], x, y, 9.5, ink.code, (0.12 + 0.34 * lit) * dim * 0.9)
          }
          // Narrow scan bar moving through the left code column.
          const scanP = frac(t / 7)
          if (scanP < 0.5) {
            const sx = W * 0.02 + (scanP / 0.5) * W * 0.2
            const grd = g.createLinearGradient(sx - 40, 0, sx + 6, 0)
            grd.addColorStop(0, rgba(ink.code, 0))
            grd.addColorStop(1, rgba(ink.code, 0.05 * dim))
            g.fillStyle = grd
            g.fillRect(sx - 40, H * 0.12, 46, H * 0.7)
          }
        }

        // Floating weight numbers at the margins.
        if (options.quality !== 'low') {
          for (const d of digits) {
            const y = H - frac((t * d.drift) / H + d.phase) * H
            const a = 0.055 + 0.05 * (0.5 + 0.5 * Math.sin(t * 0.6 + d.phase))
            text(d.text, d.x + Math.sin(t * 0.3 + d.phase) * 4, y, d.size, ink.label, a * dim)
          }
        }
      }

      // --------------------------------------------------------------- tokens

      function drawTokenBand(t) {
        const L = layout
        if (L.tokens.length === 0) return
        const dim = dimScale()
        const reveal = clamp(t / 2.6, 0, 1)
        const split = clamp((t - 1.1) / 1.9, 0, 1)

        // The whole sentence before it splits: one line that dissolves in place.
        if (split < 1) {
          const sentence = SENTENCE.slice(0, L.tokens.length).join('')
          g.font = `400 13px ${SANS}`
          g.fillStyle = rgba(ink.token, 0.42 * (1 - split) * dim)
          g.textAlign = 'left'
          g.textBaseline = 'middle'
          g.fillText(sentence, L.tokens[0].x + 2 + split * 6, L.tokenY + L.tokenH / 2)
        }

        // Attention matrix highlight row follows the active token.
        const active = Math.floor(clamp((t - 8) / 0.85, 0, L.tokens.length - 1 + 0.999))
        const attnPhase = env(t, 8, 12.6, 0.5, 0.8)

        for (const token of L.tokens) {
          const appear = clamp((reveal - token.index * 0.08) / 0.35, 0, 1)
          if (appear <= 0.01) continue
          const isActive = attnPhase > 0.05 && token.index === Math.min(active, L.tokens.length - 1)
          const a = appear * dim
          roundRect(g, token.x, token.y, token.w, token.h, 4)
          g.fillStyle = rgba(ink.token, (isActive ? 0.13 : 0.05) * a)
          g.fill()
          g.strokeStyle = rgba(ink.token, (isActive ? 0.82 : 0.46) * a)
          g.lineWidth = 1
          g.stroke()
          g.font = `400 11px ${SANS}`
          g.fillStyle = rgba(ink.token, (isActive ? 0.98 : 0.84) * a)
          g.textAlign = 'center'
          g.textBaseline = 'middle'
          g.fillText(token.label, token.x + token.w / 2, token.y + token.h / 2 + 0.5)
          text(`#${token.index}`, token.x + token.w / 2, token.y + token.h + 8, 7.5, ink.label, 0.42 * a, { align: 'center' })
          if (isActive) {
            g.globalCompositeOperation = ink.glowBlend
            g.fillStyle = rgba(ink.token, 0.06 * a)
            g.fillRect(token.x - 3, token.y - 3, token.w + 6, token.h + 6)
            g.globalCompositeOperation = 'source-over'
          }
        }

        if (options.labels) {
          text('示意分词 · word-level demo', L.tokens[0].x, L.tokenY - 12, 8.8, ink.label, 0.72 * dim, { mono: false })
        }
      }

      // ----------------------------------------------------------- embeddings

      function drawEmbeddings(t) {
        const L = layout
        const dim = dimScale()
        const phase = env(t, 2.6, 6.2, 0.5, 0.9)
        if (phase <= 0.01 && L.tokens.length === 0) return
        const cells = 10
        const cellH = L.embedH / cells

        for (const token of L.tokens) {
          const values = EMBEDDINGS[token.index] || []
          const cx = token.x + token.w / 2
          // Guide line from the token down to its vector column.
          line(cx, token.y + token.h + 2, cx, L.embedY - 2, ink.link, 0.18 * dim)
          if (phase <= 0.01) continue
          const grow = clamp((phase - token.index * 0.05) / 0.5, 0, 1)

          // A column of 10 sampled dimensions.
          const stripX = token.x + token.w / 2 - 7
          for (let c = 0; c < cells; c += 1) {
            const v = values[c] === undefined ? 0.3 : values[c]
            const top = L.embedY + c * cellH
            const h = Math.max(1.4, cellH - 1.6)
            g.fillStyle = rgba(ink.token, (0.1 + v * 0.62) * grow * dim)
            g.fillRect(stripX, top, 14, h)
          }
          g.strokeStyle = rgba(ink.token, 0.34 * grow * dim)
          g.lineWidth = 1
          g.strokeRect(stripX - 0.5, L.embedY - 0.5, 15, L.embedH + 1)

          // Position ring: a small pulsing circle where the position vector merges.
          const py = L.contextY - 8
          const ringPhase = frac(t / 4 + token.index * 0.08)
          g.beginPath()
          g.arc(token.x + token.w / 2, py, 4.5 + ringPhase * 5, 0, TAU)
          g.strokeStyle = rgba(ink.attn, (1 - ringPhase) * 0.3 * grow * dim)
          g.lineWidth = 1
          g.stroke()
          dot(cx, py, 1.6, ink.attn, 0.5 * grow * dim)
        }
        if (options.labels && phase > 0.05) {
          const first = L.tokens[0]
          text('embedding · 示意 10 维采样', first.x, L.embedY - 8, 8.5, ink.label, 0.45 * phase * dim, { mono: false })
        }
      }

      // ------------------------------------------------------------ attention

      function drawAttention(t) {
        const L = layout
        const dim = dimScale()
        const n = L.tokens.length
        if (n < 2) return
        const phase = env(t, 8, 12.6, 0.7, 0.9)
        const weights = options.mode === 'decoder' ? ATTENTION.causal : ATTENTION.full
        const activeRow = Math.min(n - 1, Math.floor(clamp((t - 8) / 0.85, 0, n - 1 + 0.999)))

        const y0 = L.arcBase
        for (let i = 0; i < n; i += 1) {
          for (let j = 0; j < n; j += 1) {
            if (i === j) continue
            if (options.mode === 'decoder' && j > i) continue
            const w = (weights[i] && weights[i][j]) || 0
            const from = L.tokens[i]
            const to = L.tokens[j]
            const x1 = from.x + from.w / 2
            const x2 = to.x + to.w / 2
            const span = Math.abs(x2 - x1)
            const depth = L.arcDepth * (0.32 + Math.min(1, span / (L.tokens[n - 1].x - L.tokens[0].x + 1)) * 0.68)
            const c1 = { x: x1, y: y0 + depth }
            const c2 = { x: x2, y: y0 + depth }
            const isActiveRow = i === activeRow
            const headCount = options.particles >= 0.7 ? 3 : options.particles >= 0.4 ? 2 : 1
            const heads = isActiveRow && phase > 0.05 ? headCount : 1
            for (let h = 0; h < heads; h += 1) {
              const lift = h * 9
              const hc1 = { x: c1.x, y: c1.y + lift }
              const hc2 = { x: c2.x, y: c2.y + lift }
              const headWeight = h === 0 ? 1 : 0.34 + 0.3 * frac(Math.sin((i + 1) * 7.1 + (j + 1) * 3.7 + h * 5.3) * 1234.5)
              const base = 0.1 + (isActiveRow ? phase * 0.46 * headWeight : 0) * w
              g.beginPath()
              g.moveTo(x1, y0)
              g.bezierCurveTo(hc1.x, hc1.y, hc2.x, hc2.y, x2, y0)
              g.strokeStyle = rgba(ink.attn, base * dim)
              g.lineWidth = (0.7 + w * 2.2) * (h === 0 ? 1 : 0.6)
              g.stroke()

              // Signal travelling towards the queried token on each head.
              if (isActiveRow && sprites !== null) {
                const p = frac(t * 0.55 + j * 0.07 + h * 0.21)
                const pt = cubicPoint({ x: x1, y: y0 }, hc1, hc2, { x: x2, y: y0 }, p)
                glow(sprites.attn, pt.x, pt.y, 24, 0.5 * w * phase * headWeight * options.glow)
              } else if (isActiveRow) {
                const p = frac(t * 0.55 + j * 0.07 + h * 0.21)
                const pt = cubicPoint({ x: x1, y: y0 }, hc1, hc2, { x: x2, y: y0 }, p)
                dot(pt.x, pt.y, 1.4, ink.attn, 0.7 * w * phase * headWeight)
              }
            }
          }
        }

        // V columns gather into the context row under the active token.
        if (phase > 0.03) {
          for (let j = 0; j < n; j += 1) {
            const token = L.tokens[j]
            const p = frac(t * 0.5 + j * 0.09)
            const x = token.x + token.w / 2
            const yTop = L.contextY - 6
            line(x, yTop, x, yTop + 10, ink.v, 0.16 * phase * dim)
            if (p < 0.7) {
              dot(x, yTop + (p / 0.7) * 10, 1.5, ink.v, 0.8 * phase)
            }
          }
        }

        // Attention weight matrix, one row at a time.
        drawAttentionMatrix(t, phase, activeRow)
      }

      function drawAttentionMatrix(t, phase, activeRow) {
        const L = layout
        const M = L.matrix
        const n = L.tokens.length
        const dim = dimScale()
        const weights = options.mode === 'decoder' ? ATTENTION.causal : ATTENTION.full
        if (M.x + M.w > L.towerX - 6) return
        const cell = Math.min(M.w / n, M.h / n)

        g.strokeStyle = rgba(ink.link, 0.35 * dim)
        g.lineWidth = 1
        g.strokeRect(M.x - 0.5, M.y - 0.5, cell * n + 1, cell * n + 1)

        for (let r = 0; r < n; r += 1) {
          const rowOn = phase > 0.05 && r <= activeRow
          const rowPulse = rowOn && r === activeRow ? 1 : rowOn ? 0.28 : 0.1
          for (let c = 0; c < n; c += 1) {
            const masked = options.mode === 'decoder' && c > r
            const bgx = M.x + c * cell
            const bgy = M.y + r * cell
            if (masked) {
              g.fillStyle = rgba(ink.link, 0.08 * dim)
              g.fillRect(bgx, bgy, cell - 0.6, cell - 0.6)
              continue
            }
            const w = (weights[r] && weights[r][c]) || 0
            g.fillStyle = rgba(ink.attn, clamp(w * 2.4, 0.03, 0.92) * rowPulse * (0.4 + phase * 0.6) * dim)
            g.fillRect(bgx, bgy, cell - 0.6, cell - 0.6)
          }
        }

        if (options.labels) {
          text(options.mode === 'decoder' ? 'masked attention' : 'attention weights', M.x, M.y - 10, 8, ink.label, 0.55 * dim, { mono: false })
          text('Attention(Q,K,V) = softmax(QKᵀ/√dₖ)·V', M.x, M.y + cell * n + 10, 7.6, ink.label, 0.6 * dim)
          text('示意权重 · 3 heads', M.x, M.y + cell * n + 20, 7.6, ink.label, 0.55 * dim, { mono: false })
        }
      }

      // ----------------------------------------------------------------- QKV

      function drawMatrix(box, values, color, title, sub, t, scanStart) {
        const dim = dimScale()
        const rows = values.length
        const cols = values[0].length
        roundRect(g, box.x, box.y, box.w, box.h, 3)
        g.fillStyle = rgba(color, 0.05 * dim)
        g.fill()
        g.strokeStyle = rgba(color, 0.56 * dim)
        g.lineWidth = 1
        g.stroke()

        const rowH = box.h / rows
        const colW = box.w / cols
        const scan = frac((t - scanStart) / 2.4)
        const scanY = box.y + scan * box.h

        g.font = `400 ${Math.max(5.4, Math.min(7.4, box.h / rows * 0.5))}px ${MONO}`
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        for (let r = 0; r < rows; r += 1) {
          for (let c = 0; c < cols; c += 1) {
            const v = values[r][c]
            const hot = Math.abs(box.y + r * rowH + rowH / 2 - scanY) < rowH * 0.75
            g.fillStyle = rgba(color, (hot ? 0.98 : 0.56) * dim)
            g.fillText(`${v >= 0 ? '+' : '-'}${Math.abs(v).toFixed(1)}`, box.x + c * colW + colW / 2, box.y + r * rowH + rowH / 2)
          }
        }
        if (scan >= 0 && scan <= 1) {
          g.fillStyle = rgba(color, 0.12 * dim)
          g.fillRect(box.x, scanY - 1, box.w, 2)
        }
        if (options.labels) {
          text(title, box.x, box.y - 8, 8.5, color, 0.9 * dim)
          if (sub !== null) text(sub, box.x + box.w, box.y - 8, 7.5, color, 0.5 * dim, { align: 'right' })
        }
      }

      function drawQkv(t) {
        const L = layout
        const dim = dimScale()
        const phase = env(t, 4.8, 8.6, 0.6, 0.8)
        const specs = [
          { values: WQ, color: ink.q, title: 'W_Q', sub: 'query', formula: 'Q = XW_Q' },
          { values: WK, color: ink.k, title: 'W_K', sub: 'key', formula: 'K = XW_K' },
          { values: WV, color: ink.v, title: 'W_V', sub: 'value', formula: 'V = XW_V' },
        ]
        for (let i = 0; i < L.qkv.cells.length; i += 1) {
          const spec = specs[i]
          drawMatrix(L.qkv.cells[i], spec.values, spec.color, spec.title, options.labels ? spec.sub : null, t, 5.1 + i * 0.55)
        }
        if (options.labels && phase > 0.02) {
          const first = L.qkv.cells[0]
          for (let i = 0; i < 3; i += 1) {
            text(specs[i].formula, first.x + i * (first.w + 8), L.qkv.cells[0].y + L.qkv.cells[0].h + 14, 7.4, specs[i].color, 0.6 * phase * dim)
          }
        }
        // Q/K/V output bars leaving the projections.
        if (phase > 0.05) {
          for (let i = 0; i < 3; i += 1) {
            const cell = L.qkv.cells[i]
            const bx = cell.x + cell.w / 2 - 10
            const by = cell.y + cell.h + 24
            const p = frac(t * 0.4 + i * 0.2)
            for (let c = 0; c < 5; c += 1) {
              const v = 0.25 + 0.65 * frac(Math.sin((c + 1) * 9.7 + i * 3.1) * 4321.7)
              g.fillStyle = rgba(specs[i].color, v * 0.5 * phase * dim)
              g.fillRect(bx + c * 4.4, by, 3, 10)
            }
            if (p < 0.55) {
              dot(bx + 10, by - 4 + (p / 0.55) * 6, 1.5, specs[i].color, 0.85 * phase)
            }
          }
        }
      }

      // -------------------------------------------------------------- blocks

      function drawBlock(box, title, sub, color, t, phaseOffset) {
        const dim = dimScale()
        const h = box.h
        roundRect(g, box.x, box.y, box.w, h, 5)
        g.fillStyle = rgba(color, 0.05 * dim)
        g.fill()
        g.strokeStyle = rgba(color, 0.55 * dim)
        g.lineWidth = 1
        g.stroke()

        // Sublayer strips: attention then feed-forward, each with its own norm.
        const innerX = box.x + 10
        const innerW = box.w - 26
        const barH = 6
        for (let i = 0; i < 2; i += 1) {
          const by = box.y + 20 + i * 12
          g.fillStyle = rgba(color, 0.26 * dim)
          g.fillRect(innerX, by, innerW, barH)
          g.fillStyle = rgba(color, 0.44 * dim)
          g.fillRect(innerX + innerW + 2, by, 4, barH)
        }
        // Residual bypass on the left of the block.
        const rx = box.x - 7
        g.beginPath()
        g.moveTo(box.x, box.y + h - 6)
        g.lineTo(rx, box.y + h - 6)
        g.lineTo(rx, box.y + 6)
        g.lineTo(box.x, box.y + 6)
        g.strokeStyle = rgba(ink.link, 0.62 * dim)
        g.lineWidth = 1
        g.stroke()
        dot(box.x, box.y + 6, 2, ink.out, 0.4 * dim)
        dot(box.x, box.y + h - 6, 2, ink.out, 0.4 * dim)
        if (options.labels) {
          text(title, box.x + 10, box.y + 9, 8.5, color, 0.9 * dim)
          text(sub, box.x + box.w - 8, box.y + 9, 7.5, color, 0.55 * dim, { align: 'right' })
        }

        // Signal climbing the block during its phase.
        const p = frac((t - phaseOffset) / 2.2)
        if (p > 0 && p < 0.9) {
          const y = box.y + h - 8 - p * (h - 14)
          glow(sprites === null ? null : sprites.out, box.x + box.w * 0.5, y, 24, 0.4 * envelope(p) * options.glow)
          g.fillStyle = rgba(ink.out, 0.5 * envelope(p) * dim)
          g.fillRect(innerX, y, innerW, 1)
        }
      }

      function drawTower(t) {
        const L = layout
        const dim = dimScale()
        const encdec = options.mode === 'encdec'

        // Bridge between the token band and the projections.
        const srcX = L.tokenEnd + 6
        const srcY = L.tokenY + L.tokenH / 2
        const dstX = L.qkv.x + L.qkv.w / 2
        const dstY = L.qkv.y + 6
        g.beginPath()
        g.moveTo(srcX, srcY)
        g.bezierCurveTo(srcX + 40, srcY, dstX - 60, srcY, dstX, dstY)
        g.strokeStyle = rgba(ink.link, 0.62 * dim)
        g.lineWidth = 1
        g.stroke()
        const beamP = frac((t - 4.6) / 2.6)
        if (beamP > 0 && beamP < 1) {
          const pt = cubicPoint({ x: srcX, y: srcY }, { x: srcX + 40, y: srcY }, { x: dstX - 60, y: srcY }, { x: dstX, y: dstY }, beamP)
          if (sprites !== null) glow(sprites.attn, pt.x, pt.y, 30, 0.55 * envelope(beamP) * options.glow)
          else dot(pt.x, pt.y, 1.8, ink.attn, 0.8 * envelope(beamP))
        }

        // Encoder -> decoder (classic mode) or stacked decoder ghost.
        if (encdec) {
          const midX = L.enc.x + L.enc.w / 2
          line(midX, L.enc.y + L.enc.h + 2, midX, L.dec.y - 2, ink.link, 0.5 * dim)
          // Cross-attention feed: encoder output enters the decoder's second sublayer.
          const bx = L.dec.x + L.dec.w + 10
          g.beginPath()
          g.moveTo(L.enc.x + L.enc.w, L.enc.y + L.enc.h * 0.5)
          g.bezierCurveTo(bx + 16, L.enc.y + L.enc.h * 0.5, bx + 16, L.dec.y + L.dec.h * 0.62, L.dec.x + L.dec.w, L.dec.y + L.dec.h * 0.62)
          g.strokeStyle = rgba(ink.k, 0.22 * dim)
          g.lineWidth = 1
          g.stroke()
          if (options.labels) {
            text('cross-attn', bx + 12, L.dec.y + L.dec.h * 0.56, 7.5, ink.k, 0.5 * dim)
          }
          drawBlock(L.enc, 'ENCODER', '×N', ink.attn, t, 12.4)
          drawBlock(L.dec, 'DECODER', '×N', ink.mlp, t, 12.9)
        } else {
          drawBlock(L.enc, 'DECODER BLOCK', '×N', ink.attn, t, 12.4)
          // Ghost stack under the active block: repetition without extra detail.
          const ghost = { x: L.dec.x + 6, y: L.dec.y + 4, w: L.dec.w - 12, h: L.dec.h - 8 }
          roundRect(g, ghost.x, ghost.y, ghost.w, ghost.h, 5)
          g.strokeStyle = rgba(ink.link, 0.62 * dim)
          g.lineWidth = 1
          g.stroke()
          g.setLineDash([3, 4])
          roundRect(g, ghost.x + 6, ghost.y + 6, ghost.w - 12, ghost.h - 12, 4)
          g.stroke()
          g.setLineDash([])
          if (options.labels) text('×N', ghost.x + ghost.w - 8, ghost.y + 9, 7.5, ink.label, 0.5 * dim, { align: 'right' })
        }

        // Norm / add nodes between the last block and the MLP.
        const addX = L.mlp.x - 12
        const addY = L.mlp.y - 16
        const pulse = frac((t - 13.6) / 2.2)
        if (pulse > 0 && pulse < 1) {
          const r = 6 + envelope(pulse) * 9
          g.beginPath()
          g.arc(addX, addY, r, 0, TAU)
          g.strokeStyle = rgba(ink.out, (1 - pulse) * 0.35 * dim)
          g.lineWidth = 1
          g.stroke()
        }
        dot(addX, addY, 3, ink.out, 0.55 * dim)
        if (options.labels) text('Norm', addX, addY - 9, 7.4, ink.label, 0.6 * dim, { align: 'center' })
      }

      // ------------------------------------------------------------------ MLP

      function nodeActivation(t, row, index) {
        // Staggered, causal per-layer activation; per-node strength varies.
        const strength = 0.35 + 0.65 * frac(Math.sin((row + 1) * 12.9898 + (index + 1) * 78.233) * 43758.5453)
        if (row === 0) {
          const start = 14.2 + index * 0.03
          return phaseEnv(t, start, 17.4, 0.35, 1.2) * strength
        }
        if (row === 1) {
          const start = 15.1 + (index % 8) * 0.05 + Math.floor(index / 8) * 0.22
          return phaseEnv(t, start, 18.4, 0.5, 1.3) * strength
        }
        const start = 16.6 + index * 0.04
        return phaseEnv(t, start, 19.6, 0.55, 1.4) * strength
      }

      function drawMlp(t) {
        const L = layout
        const mlp = L.mlp
        const dim = dimScale()
        const rows = mlp.rows
        if (rows.length < 2) return
        const phase = env(t, 13.8, 20.2, 0.5, 0.8)

        // Connections first, batched per layer pair.
        g.strokeStyle = rgba(ink.link, 0.5 * dim)
        g.lineWidth = 0.65
        for (let li = 0; li < rows.length - 1; li += 1) {
          g.beginPath()
          for (const from of rows[li]) {
            for (const to of rows[li + 1]) {
              g.moveTo(from.x, from.y)
              g.lineTo(to.x, to.y)
            }
          }
          g.stroke()
        }

        // Firing connections: a small subset, never the whole fan.
        if (phase > 0.03) {
          const everyN = Math.max(2, Math.round(6 / Math.max(0.2, options.particles)))
          for (let li = 0; li < rows.length - 1; li += 1) {
            const from = rows[li]
            const to = rows[li + 1]
            const p = frac(t * 0.62 + li * 0.3)
            if (p > 0.72) continue
            const q = p / 0.72
            for (let i = 0; i < from.length; i += 1) {
              for (let j = 0; j < to.length; j += 1) {
                if ((i * 7 + j * 5 + li * 3) % everyN !== 0) continue
                const x = lerp(from[i].x, to[j].x, q)
                const y = lerp(from[i].y, to[j].y, q)
                const strength = nodeActivation(t, li, i)
                if (strength < 0.12) continue
                if (sprites !== null) glow(sprites.mlp, x, y, 20, 0.4 * envelope(q) * strength * options.glow)
                else dot(x, y, 1.2, ink.mlp, 0.6 * envelope(q) * strength)
              }
            }
          }
        }

        // Neurons: every circle independent, with its own activation.
        for (let li = 0; li < rows.length; li += 1) {
          for (let i = 0; i < rows[li].length; i += 1) {
            const node = rows[li][i]
            const act = nodeActivation(t, li, i)
            const r = mlp.nodeR
            if (act > 0.5 && sprites !== null) glow(sprites.mlp, node.x, node.y, r * 7, 0.28 * act * options.glow)
            g.beginPath()
            g.arc(node.x, node.y, r, 0, TAU)
            g.fillStyle = rgba(ink.mlp, (0.07 + act * 0.55) * dim)
            g.fill()
            g.strokeStyle = rgba(ink.mlp, (0.52 + act * 0.42) * dim)
            g.lineWidth = 1
            g.stroke()
            if (act > 0.55) {
              dot(node.x, node.y, r * 0.4, ink.out, act * 0.8 * dim)
            }
          }
        }

        if (options.labels && phase > 0.02) {
          const first = rows[0][0]
          const last = rows[rows.length - 1][0]
          text('MLP 示意展开', mlp.x, first.y - 14, 8.5, ink.mlp, 0.7 * dim, { mono: false })
          const shape = rows.map(r => r.length).join(' → ')
          text(`${shape} 神经元 · 示意规模`, mlp.x, last.y + 16, 7.8, ink.label, 0.62 * dim, { mono: false })
        }
      }

      // --------------------------------------------------------------- output

      function drawOutput(t) {
        const L = layout
        const dim = dimScale()
        const O = L.output
        const phase = env(t, 19.2, 23.4, 0.6, 0.9)
        if (phase <= 0.02) return
        const barCount = 4
        const labels = ['森林', '小动物', '穿过', '。']
        const probs = [0.46, 0.27, 0.15, 0.09]
        const rowH = O.h / barCount
        for (let i = 0; i < barCount; i += 1) {
          const y = O.y + i * rowH
          const w = (O.w - 46) * probs[i] * 1.6
          g.fillStyle = rgba(i === 0 ? ink.out : ink.link, (i === 0 ? 0.5 : 0.3) * phase * dim)
          g.fillRect(O.x + 40, y + 2, w, rowH - 5)
          text(labels[i], O.x + 34, y + rowH / 2, 8, i === 0 ? ink.out : ink.label, (i === 0 ? 0.9 : 0.5) * phase * dim, { align: 'right', mono: false })
          text(probs[i].toFixed(2), O.x + 42 + w + 4, y + rowH / 2, 7, ink.label, 0.45 * phase * dim)
        }
        if (options.labels) {
          text('下一个 token · 示意概率', O.x, O.y - 8, 8, ink.label, 0.5 * phase * dim, { mono: false })
        }

        // The chosen token leaves the output projection.
        const chip = env(t, 20.6, 24, 0.5, 0)
        const chipX = O.x + O.w / 2
        const chipY = L.outToken.y + 6
        if (chip > 0.02) {
          roundRect(g, chipX - 24, chipY - 10, 48, 20, 4)
          g.fillStyle = rgba(ink.out, 0.1 * chip * dim)
          g.fill()
          g.strokeStyle = rgba(ink.out, 0.55 * chip * dim)
          g.lineWidth = 1
          g.stroke()
          text('森林', chipX, chipY, 10, ink.out, 0.95 * chip * dim, { align: 'center', mono: false })
        }

        // Return path back to the token band; the next cycle starts from it.
        const back = env(t, 21.8, 24, 0.5, 0)
        if (back > 0.02) {
          const startX = L.outToken.x
          const startY = L.outToken.y + 22
          const endX = L.tokens[L.tokens.length - 1].x + L.tokens[L.tokens.length - 1].w / 2
          const cornerY = H - 18
          g.beginPath()
          g.moveTo(startX, startY)
          g.lineTo(startX, cornerY)
          g.lineTo(endX, cornerY)
          g.lineTo(endX, L.arcBase + L.arcDepth + 12)
          g.strokeStyle = rgba(ink.out, 0.12 * back * dim)
          g.lineWidth = 1
          g.stroke()
          const p = frac((t - 21.8) / 2.2)
          if (p > 0 && p < 1) {
            const seg = p * 3
            let px
            let py
            if (seg < 1) {
              px = startX
              py = lerp(startY, cornerY, seg)
            } else if (seg < 2) {
              px = lerp(startX, endX, seg - 1)
              py = cornerY
            } else {
              px = endX
              py = lerp(cornerY, L.arcBase + L.arcDepth + 12, seg - 2)
            }
            if (sprites !== null) glow(sprites.out, px, py, 28, 0.5 * envelope(p) * options.glow)
            else dot(px, py, 1.6, ink.out, 0.8 * envelope(p))
          }
        }
      }

      // ----------------------------------------------------------- readability

      /**
       * Local darkening behind the reading column, plus an optional frost pass
       * that softens the animation exactly where the text sits.
       */
      let frostAge = 0

      /** Refresh the frosted band every few frames; compositing the cache is cheap. */
      function refreshFrost(V) {
        if (scratchCtx === null) return
        const sx = Math.max(0, V.cx - V.half)
        const sw = Math.min(V.half * 2, W - sx)
        if (sw <= 4) return
        scratchCtx.clearRect(0, 0, scratch.width, scratch.height)
        scratchCtx.drawImage(canvas, sx * dpr, 0, sw * dpr, H * dpr, 0, 0, scratch.width, scratch.height)
      }

      function drawVeil() {
        const V = layout.veil
        const sx = Math.max(0, V.cx - V.half)
        const sw = Math.min(V.half * 2, W - sx)
        if (options.frost > 0.02 && sw > 4) {
          if (frostAge <= 0) {
            refreshFrost(V)
            frostAge = 4
          }
          frostAge -= 1
          g.globalAlpha = clamp(options.frost, 0, 1)
          g.drawImage(scratch, 0, 0, scratch.width, scratch.height, sx, 0, sw, H)
          g.globalAlpha = 1
        }

        const alpha = (ink === INK.dark ? 0.62 : 0.6) * (0.65 + options.frost * 0.35) * veilFactor
        const left = V.cx - V.half
        const right = V.cx + V.half
        const grd = g.createLinearGradient(left, 0, right, 0)
        grd.addColorStop(0, rgba(ink.veil, 0))
        grd.addColorStop(0.16, rgba(ink.veil, alpha))
        grd.addColorStop(0.84, rgba(ink.veil, alpha))
        grd.addColorStop(1, rgba(ink.veil, 0))
        g.fillStyle = grd
        g.fillRect(left, V.top - H * 0.06, right - left, (V.bottom - V.top) + H * 0.06)

        // Soft top and bottom shoulders so chrome and composer keep clean edges.
        const top = g.createLinearGradient(0, V.top - H * 0.06, 0, V.top + H * 0.04)
        top.addColorStop(0, rgba(ink.veil, 0))
        top.addColorStop(1, rgba(ink.veil, alpha))
        g.fillStyle = top
        g.fillRect(left, V.top - H * 0.06, right - left, H * 0.1)
        const bottom = g.createLinearGradient(0, V.bottom - H * 0.06, 0, V.bottom + H * 0.05)
        bottom.addColorStop(0, rgba(ink.veil, alpha))
        bottom.addColorStop(1, rgba(ink.veil, 0))
        g.fillStyle = bottom
        g.fillRect(left, V.bottom - H * 0.06, right - left, H * 0.11)
      }

      /** One slow scan sweep across the canvas; deliberately faint. */
      function drawSweep(t) {
        const p = frac(t / 9)
        if (p > 0.55) return
        const y = (p / 0.55) * H
        const trail = H * 0.14
        const grd = g.createLinearGradient(0, y - trail, 0, y)
        grd.addColorStop(0, rgba(ink.attn, 0))
        grd.addColorStop(1, rgba(ink.attn, ink === INK.dark ? 0.035 : 0.025))
        g.fillStyle = grd
        g.fillRect(0, y - trail, W, trail)
        g.fillStyle = rgba(ink.attn, ink === INK.dark ? 0.1 : 0.07)
        g.fillRect(0, y, W, 1)
      }

      // ----------------------------------------------------------------- draw

      function draw(t) {
        if (layout === null) return
        updateIntro()
        g.setTransform(dpr, 0, 0, dpr, 0, 0)
        g.clearRect(0, 0, W, H)
        if (backdrop !== null) g.drawImage(backdrop, 0, 0, W, H)
        drawAmbient(t)
        drawTokenBand(t)
        drawEmbeddings(t)
        drawAttention(t)
        drawQkv(t)
        drawTower(t)
        drawMlp(t)
        drawOutput(t)
        drawSweep(t)
        drawVeil()
      }

      // ------------------------------------------------------------ lifecycle

      function frame(now) {
        if (disposed) return
        raf = requestAnimationFrame(frame)
        const interval = 1000 / targetFps()
        if (now - lastFrame < interval) return
        const dt = lastFrame === 0 ? interval : now - lastFrame
        lastFrame = now
        if (!paused && !motionReduced()) {
          const pace = engagement === 'idle' ? 0.45
            : engagement === 'thinking' ? 1.3
              : engagement === 'submitting' ? 1.2
                : engagement === 'streaming' ? 1.15
                  : engagement === 'complete' ? 0.85
                    : engagement === 'error' ? 0.6 : 1
          clock = (clock + (dt / 1000) * options.speed * pace) % CYCLE
        }
        draw(clock)
      }

      function start() {
        if (disposed || raf !== 0) return
        lastFrame = 0
        raf = requestAnimationFrame(frame)
      }

      function stop() {
        if (raf !== 0) {
          cancelAnimationFrame(raf)
          raf = 0
        }
      }

      function resize() {
        const nextW = window.innerWidth || document.documentElement.clientWidth || W
        const nextH = window.innerHeight || document.documentElement.clientHeight || H
        if (nextW === W && nextH === H && targetDpr() === dpr) return
        build()
        draw(clock)
      }

      let resizeTimer = 0
      const onResize = () => {
        if (resizeTimer !== 0) window.clearTimeout(resizeTimer)
        resizeTimer = window.setTimeout(() => {
          resizeTimer = 0
          if (!disposed) resize()
        }, 140)
      }
      const onVisibility = () => {
        if (document.hidden) stop()
        else if (!motionReduced() && !paused) start()
      }
      const onMotionChange = () => {
        if (motionReduced() || paused) {
          stop()
          draw(clock)
        } else {
          start()
        }
      }

      if (options.intro && !motionReduced()) clock = 0
      build()
      draw(clock)
      canvas.style.opacity = '1'
      paused = options.paused === true
      if (!motionReduced() && !paused) start()
      window.addEventListener('resize', onResize)
      document.addEventListener('visibilitychange', onVisibility)
      if (reducedQuery !== null) reducedQuery.addEventListener('change', onMotionChange)

      return {
        /** Apply a new direction for the scene without rebuilding geometry. */
        setOptions(next) {
          const qualityChanged = next.quality !== options.quality
          const introTurnedOn = next.intro === true && options.intro !== true
          options = next
          if (introTurnedOn) {
            introStart = performance.now()
            introSeen = false
            clock = 0
          }
          paused = next.paused === true
          if (qualityChanged) build()
          draw(clock)
          if (paused || motionReduced()) stop()
          else start()
        },
        /** Switch the ink palette with the host color scheme. */
        setScheme(next) {
          const schemeKey = next === 'light' ? 'light' : 'dark'
          if (ink === INK[schemeKey]) return
          ink = INK[schemeKey]
          build()
          draw(clock)
        },
        /** Report engagement from a host signal (idle / thinking / streaming / error). */
        setEngagement(state) {
          if (state === engagement) return
          engagement = state
          draw(clock)
        },
        getEngagement() {
          return engagement
        },
        dispose() {
          disposed = true
          stop()
          window.clearTimeout(resizeTimer)
          window.removeEventListener('resize', onResize)
          document.removeEventListener('visibilitychange', onVisibility)
          if (reducedQuery !== null) reducedQuery.removeEventListener('change', onMotionChange)
          canvas.remove()
        },
      }
    }

    // ------------------------------------------------------------ controller

    /** Owner of the canvas, the glass layer and the ground override. */
    function createController(ctx, store) {
      let scene = null
      let tokenDispose = null
      let groundTag = null
      let mounted = false
      const theme = ctx.get('theme')

      function currentPreference() {
        if (theme === undefined || typeof theme.getTheme !== 'function') return null
        const snapshot = theme.getTheme()
        return snapshot === null || snapshot.preference === undefined ? null : String(snapshot.preference)
      }

      function currentScheme() {
        if (theme === undefined || typeof theme.getTheme !== 'function') return 'dark'
        const snapshot = theme.getTheme()
        return snapshot !== null && snapshot.active !== undefined ? snapshot.active.colorScheme : 'dark'
      }

      let appliedGlass = null
      let restoreTheme = null
      let initialPreference = null
      let respectChoice = false

      function readStoredTheme() {
        try {
          return window.localStorage.getItem(PREV_THEME_KEY)
        } catch {
          return null
        }
      }

      function storeTheme(preference) {
        try {
          if (window.localStorage.getItem(PREV_THEME_KEY) === null) {
            window.localStorage.setItem(PREV_THEME_KEY, preference)
          }
        } catch {
          // In-memory restore still works for this page session.
        }
      }

      function clearStoredTheme() {
        try {
          window.localStorage.removeItem(PREV_THEME_KEY)
        } catch {
          // Nothing to clean up when storage is unavailable.
        }
      }

      /** Remember the user's preference, then switch to the dark theme the skin is drawn for. */
      function ensureDarkBase() {
        if (respectChoice) return
        if (theme === undefined || typeof theme.getTheme !== 'function' || typeof theme.setTheme !== 'function') return
        const snapshot = theme.getTheme()
        if (snapshot === null || snapshot.active === undefined) return
        if (!store.get().darkBase) {
          restoreThemeBase()
          return
        }
        if (snapshot.active.colorScheme === 'dark') return
        // One forced switch only: a later manual light choice is the user's.
        if (restoreTheme !== null) return
        restoreTheme = snapshot.preference
        storeTheme(restoreTheme)
        try {
          theme.setTheme('dark')
        } catch (error) {
          console.error(`[${PACKAGE_ID}] could not switch to the dark base`, error)
        }
      }

      function restoreThemeBase() {
        // Survives a reload: the forced preference was remembered in storage.
        const preference = restoreTheme === null ? readStoredTheme() : restoreTheme
        restoreTheme = null
        if (preference === null) return
        try {
          theme.setTheme(preference)
          clearStoredTheme()
        } catch {
          // The previous preference may no longer be registered; the dark base stays.
        }
      }

      function applyTokens(glass) {
        if (theme === undefined || typeof theme.overrideTokens !== 'function') return
        if (appliedGlass === glass) return
        appliedGlass = glass
        if (tokenDispose !== null) tokenDispose()
        tokenDispose = theme.overrideTokens(PACKAGE_ID, glassTokens(glass))
      }

      function setGround(scheme) {
        const root = document.documentElement
        if (scheme === 'light') root.style.setProperty('--ng-ground', '#eef3fa')
        else root.style.setProperty('--ng-ground', '#05080f')
      }

      function mount() {
        if (mounted) return
        mounted = true
        ensureDarkBase()
        groundTag = document.createElement('style')
        groundTag.setAttribute('data-plugin', PACKAGE_ID)
        groundTag.setAttribute('data-plugin-css', `${PACKAGE_ID}/ground`)
        groundTag.textContent = [
          `html { background-color: var(--ng-ground, #05080f) !important; }`,
          `body { background-color: transparent !important; }`,
        ].join('\n')
        document.head.appendChild(groundTag)
        const scheme = currentScheme()
        setGround(scheme)
        scene = createScene(scheme, store)
        scene.setOptions(store.get())
        applyTokens(store.get().glass)
      }

      function unmount() {
        if (!mounted) return
        mounted = false
        if (scene !== null) {
          scene.dispose()
          scene = null
        }
        if (tokenDispose !== null) {
          tokenDispose()
          tokenDispose = null
        }
        appliedGlass = null
        if (groundTag !== null) {
          groundTag.remove()
          groundTag = null
        }
        document.documentElement.style.removeProperty('--ng-ground')
        restoreThemeBase()
      }

      function sync() {
        const state = store.get()
        if (!state.enabled) {
          unmount()
          return
        }
        mount()
        ensureDarkBase()
        if (scene !== null) {
          scene.setScheme(currentScheme())
          scene.setOptions(state)
          scene.setEngagement(state.source === 'host' ? 'idle' : 'demo')
        }
        applyTokens(state.glass)
      }

      return {
        start() {
          sync()
          initialPreference = currentPreference()
          const offTheme = ctx.on('theme/change', (snapshot) => {
            const scheme = snapshot !== null && snapshot.active !== undefined ? snapshot.active.colorScheme : 'dark'
            setGround(scheme)
            if (scene !== null) scene.setScheme(scheme)
            // A light preference that the user introduced after mount wins over
            // the skin's one-time dark base.
            const preference = snapshot !== null && snapshot.preference !== undefined ? String(snapshot.preference) : null
            if (scheme === 'light' && preference === 'light'
              && (restoreTheme !== null || (initialPreference !== null && preference !== initialPreference))) {
              respectChoice = true
            }
            ensureDarkBase()
          })
          const offStore = store.subscribe(() => { sync() })
          return () => {
            offTheme()
            offStore()
            unmount()
          }
        },
        sync,
        isMounted: () => mounted,
        scene: () => scene,
      }
    }

    // -------------------------------------------------------------- copy deck

    const COPY = {
      zh: {
        nav: '神经流光',
        title: 'Neural Glass · 神经流光',
        intro: '半透明的玻璃界面，背后持续演示一个 Transformer 从分词、向量化、Q/K/V 投影、注意力、残差与归一化到 MLP 神经元与下一个 token 的完整光流。',
        groupLook: '外观',
        groupMotion: '动画',
        groupStructure: '结构与模式',
        groupPerf: '性能',
        enable: '启用皮肤',
        enableHint: '关闭后恢复原始界面，设置会保留。',
        darkBase: '深色底座',
        darkBaseHint: '启用时把应用切到深色主题（动画按 #05080F 深色设计），关闭皮肤时恢复原来的主题偏好。',
        pause: '暂停动画',
        pauseHint: '暂停时保留当前画面，不再消耗动画帧。',
        panelTitle: 'Neural Glass',
        panelSubtitle: '让计算成为背景，让文字保持清晰。',
        panelOpen: 'Neural Glass 设置',
        panelClose: '关闭',
        panelDisabled: '已停用',
        presetFocus: '专注',
        presetBalanced: '平衡',
        presetImmersive: '沉浸',
        uiOpacity: '界面透明度',
        solid: '实色',
        transparent: '通透',
        bgGlow: '背景光效',
        muted: '隐藏',
        luminous: '明亮',
        glassBlur: '玻璃模糊',
        crisp: '清晰',
        soft: '柔和',
        animSpeed: '动画速度',
        calm: '舒缓',
        flowing: '流动',
        enabledShort: '启用动态背景',
        pausedShort: '暂停动画',
        introShort: '开场淡入',
        savedLocal: '已自动保存到本机',
        resetShort: '恢复默认',
        panelNote: '透明度仅影响面板底色，不降低文字亮度。光流为计算示意，并非模型实时数据。',
        bgDensity: '背景浓度',
        bgDensityHint: '背景动画的明暗，不影响面板与文字。',
        intro: '开场淡入',
        introHint: '启动时先播放完整动画，随后淡到安静背景。',
        glass: '玻璃不透明度',
        glassHint: '面板底色 alpha。界面有多层底色叠在一起，这里显示叠加后的有效不透明度；文字与图标不受影响。',
        frost: '阅读区雾化',
        frostHint: '在正文背后柔化并压暗动画，数值越高文字越安静。',
        brightness: '背景亮度',
        speed: '动画速度',
        glow: '发光强度',
        particles: '粒子密度',
        particlesHint: '同时控制 MLP 连线光点数量与注意力示意头数。',
        codeScan: '代码扫描',
        codeScanHint: '低亮度计算片段与扫描残影；关闭后只保留网格与网络结构。',
        labels: '模块标签',
        mode: '结构模式',
        modeEncdec: '经典 Encoder–Decoder',
        modeDecoder: 'Decoder-only',
        source: '驱动方式',
        sourceDemo: '内置演示循环',
        sourceHost: '跟随会话状态',
        sourceHint: '读取当前会话是否在运行：空闲时放慢，思考时加快。只是视觉隐喻，不读取模型内部数据。',
        quality: '质量档位',
        qualityLow: '低',
        qualityMedium: '中',
        qualityHigh: '高',
        reduceMotion: '减少动态效果',
        reduceMotionHint: '静止画面，不循环播放。',
        reset: '恢复默认',
        statusOn: '已启用',
        statusOff: '已停用',
        statusPaused: '已暂停',
        note: '背景是演示动画：分词、注意力权重与 MLP 维度均为示意数据，不代表模型内部真实计算。',
        noteColor: '颜色含义固定：金黄 Q / 青绿 K / 珊瑚 V / 冰蓝注意力输出 / 淡紫 MLP 激活 / 蓝灰静态连接。',
      },
      en: {
        nav: 'Neural Glass',
        title: 'Neural Glass',
        intro: 'A glass UI over one continuous Transformer light-flow: tokens, embeddings, Q/K/V projections, attention, residual and norm, MLP neurons, next token.',
        groupLook: 'Appearance',
        groupMotion: 'Motion',
        groupStructure: 'Structure',
        groupPerf: 'Performance',
        enable: 'Enable skin',
        enableHint: 'Turning it off restores the original UI; settings are kept.',
        darkBase: 'Dark base',
        darkBaseHint: 'Switches the app to the dark theme while enabled (the scene is designed for #05080F) and restores your previous theme preference when the skin is turned off.',
        pause: 'Pause animation',
        pauseHint: 'Keeps the current frame and stops animation frames.',
        panelTitle: 'Neural Glass',
        panelSubtitle: 'Computation as the backdrop, text stays clear.',
        panelOpen: 'Neural Glass settings',
        panelClose: 'Close',
        panelDisabled: 'Disabled',
        presetFocus: 'Focus',
        presetBalanced: 'Balanced',
        presetImmersive: 'Immersive',
        uiOpacity: 'Interface transparency',
        solid: 'Solid',
        transparent: 'Clear',
        bgGlow: 'Background glow',
        muted: 'Hidden',
        luminous: 'Bright',
        glassBlur: 'Glass blur',
        crisp: 'Crisp',
        soft: 'Soft',
        animSpeed: 'Animation speed',
        calm: 'Calm',
        flowing: 'Flowing',
        enabledShort: 'Live background',
        pausedShort: 'Pause animation',
        introShort: 'Intro fade',
        savedLocal: 'Saved on this device',
        resetShort: 'Reset',
        panelNote: 'Transparency only affects panel fills, never text contrast. The light flow is an illustration, not model telemetry.',
        bgDensity: 'Background density',
        bgDensityHint: 'Brightness of the animation only; panels and text are untouched.',
        intro: 'Intro fade',
        introHint: 'Play the full animation on startup, then settle into the quiet background.',
        glass: 'Glass opacity',
        glassHint: 'Panel fill alpha. The shell stacks a few fills, so this value is the effective coverage after stacking; text and icons keep full contrast.',
        frost: 'Reading frost',
        frostHint: 'Softens and darkens the animation behind the text column.',
        brightness: 'Background brightness',
        speed: 'Animation speed',
        glow: 'Glow strength',
        particles: 'Particle density',
        particlesHint: 'Scales the MLP link pulses and the number of illustrative attention heads.',
        codeScan: 'Code scan',
        codeScanHint: 'Dim calculation fragments and scan residue; off keeps only the grid and the network.',
        labels: 'Module labels',
        mode: 'Structure mode',
        modeEncdec: 'Classic Encoder–Decoder',
        modeDecoder: 'Decoder-only',
        source: 'Driver',
        sourceDemo: 'Built-in demo loop',
        sourceHost: 'Follow session activity',
        sourceHint: 'Reads whether the current session is running: slower when idle, faster while thinking. A visual metaphor only; no model internals are read.',
        quality: 'Quality',
        qualityLow: 'Low',
        qualityMedium: 'Medium',
        qualityHigh: 'High',
        reduceMotion: 'Reduce motion',
        reduceMotionHint: 'One still frame, no loop.',
        reset: 'Reset',
        statusOn: 'Enabled',
        statusOff: 'Disabled',
        statusPaused: 'Paused',
        note: 'The background is an illustration: tokenization, attention weights and MLP widths are demo data, not model telemetry.',
        noteColor: 'Fixed color meaning: gold Q / teal K / coral V / ice-blue attention output / violet MLP activation / blue-grey static links.',
      },
    }

    // ------------------------------------------------------------------- page

    const PAGE_CSS = `
.ng-page { display: flex; flex-direction: column; gap: 16px; padding: 2px 2px 28px; color: var(--dsw-alias-label-primary); }
.ng-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.ng-title { font-size: 16px; font-weight: 600; line-height: 1.35; }
.ng-intro { margin-top: 6px; max-width: 560px; font-size: 12.5px; line-height: 1.6; color: var(--dsw-alias-label-secondary); }
.ng-status { flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1); font-size: 11px; color: var(--dsw-alias-label-secondary); }
.ng-status[data-on='false'] { opacity: 0.65; }
.ng-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-success-primary); }
.ng-status[data-on='false'] .ng-dot { background: var(--dsw-alias-state-idle-primary); }
.ng-status[data-paused='true'] .ng-dot { background: var(--dsw-alias-state-warn-primary); }
.ng-group { display: flex; flex-direction: column; gap: 8px; }
.ng-group-title { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--dsw-alias-label-secondary); }
.ng-card { border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; background: var(--dsw-alias-bg-layer-1); overflow: hidden; }
.ng-row { display: flex; align-items: center; gap: 14px; padding: 11px 14px; border-top: 1px solid var(--dsw-alias-border-l1); }
.ng-row:first-child { border-top: none; }
.ng-row-main { flex: 1; min-width: 0; }
.ng-row-label { font-size: 13px; line-height: 1.4; }
.ng-row-hint { margin-top: 2px; font-size: 11.5px; line-height: 1.5; color: var(--dsw-alias-label-secondary); }
.ng-control { flex: none; display: flex; align-items: center; gap: 8px; }
.ng-value { min-width: 34px; text-align: right; font-size: 11.5px; font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-secondary); }
.ng-switch { position: relative; width: 38px; height: 22px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); cursor: pointer; padding: 0; transition: background 160ms ease, border-color 160ms ease; }
.ng-switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: var(--dsw-alias-label-primary); opacity: 0.75; transition: transform 160ms ease, opacity 160ms ease; }
.ng-switch[aria-checked='true'] { background: var(--dsw-alias-brand-primary); border-color: transparent; }
.ng-switch[aria-checked='true']::after { transform: translateX(16px); background: var(--dsw-alias-bg-base); opacity: 1; }
.ng-switch:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
.ng-slider { width: 150px; accent-color: var(--dsw-alias-brand-primary); cursor: pointer; }
.ng-seg { display: inline-flex; padding: 2px; gap: 2px; border-radius: 9px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); }
.ng-seg button { border: none; background: transparent; color: var(--dsw-alias-label-secondary); font-size: 12px; padding: 4px 9px; border-radius: 7px; cursor: pointer; white-space: nowrap; transition: background 140ms ease, color 140ms ease; }
.ng-seg button:hover { color: var(--dsw-alias-label-primary); }
.ng-seg button[aria-pressed='true'] { background: var(--dsw-alias-bg-overlay); color: var(--dsw-alias-label-primary); box-shadow: 0 1px 2px rgb(0 0 0 / 0.18); }
.ng-seg button:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.ng-reset { align-self: flex-start; border: 1px solid var(--dsw-alias-border-l2); background: transparent; color: var(--dsw-alias-label-secondary); border-radius: 8px; padding: 5px 11px; font-size: 12px; cursor: pointer; }
.ng-reset:hover { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l3); }
.ng-fab { position: absolute; top: 84px; bottom: 132px; right: 20px; width: 322px; overflow: auto; z-index: 30; padding: 18px 18px 14px; border-radius: 16px; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-overlay); box-shadow: 0 24px 64px rgb(0 0 0 / 0.45); color: var(--dsw-alias-label-primary); outline: none; }
.ng-fab-head { display: flex; align-items: flex-start; gap: 12px; }
.ng-fab-headtext { flex: 1; min-width: 0; }
.ng-fab-title { font-size: 20px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.2; }
.ng-fab-sub { margin-top: 4px; font-size: 12.5px; line-height: 1.5; color: var(--dsw-alias-label-secondary); }
.ng-fab-close { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0; border: none; border-radius: 8px; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.ng-fab-close:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2); }
.ng-fab-close:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
.ng-fab-presets { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 16px 0 18px; }
.ng-fab-preset { height: 38px; border-radius: 10px; border: 1px solid var(--dsw-alias-border-l2); background: transparent; color: var(--dsw-alias-label-secondary); font-size: 13px; cursor: pointer; transition: background 140ms ease, color 140ms ease, border-color 140ms ease; }
.ng-fab-preset:hover { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l3); }
.ng-fab-preset[aria-pressed='true'] { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l3); }
.ng-fab-preset:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
.ng-fab-field { margin-bottom: 16px; }
.ng-fab-fieldhead { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.ng-fab-label { font-size: 13.5px; font-weight: 600; }
.ng-fab-value { font-size: 13px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
.ng-fab-range { -webkit-appearance: none; appearance: none; display: block; width: 100%; height: 22px; margin: 0; background: transparent; cursor: pointer; }
.ng-fab-range::-webkit-slider-runnable-track { height: 8px; border-radius: 999px; background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1); box-sizing: border-box; }
.ng-fab-range::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; margin-top: -7px; border-radius: 50%; background: var(--dsw-alias-label-primary); box-shadow: 0 2px 8px rgb(0 0 0 / 0.4); }
.ng-fab-range:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 4px; border-radius: 999px; }
.ng-fab-ends { display: flex; justify-content: space-between; margin-top: 6px; font-size: 11.5px; color: var(--dsw-alias-label-secondary); }
.ng-fab-toggle { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 0; }
.ng-fab-toggle .ng-switch { width: 44px; height: 24px; }
.ng-fab-toggle .ng-switch::after { width: 18px; height: 18px; }
.ng-fab-toggle .ng-switch[aria-checked='true']::after { transform: translateX(20px); }
.ng-fab-divider { height: 1px; margin: 10px 0 12px; background: var(--dsw-alias-border-l1); }
.ng-fab-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.ng-fab-saved { font-size: 12px; color: var(--dsw-alias-label-secondary); }
.ng-fab-reset { height: 32px; padding: 0 12px; border-radius: 9px; border: 1px solid var(--dsw-alias-border-l2); background: transparent; color: var(--dsw-alias-label-primary); font-size: 12.5px; cursor: pointer; }
.ng-fab-reset:hover { background: var(--dsw-alias-bg-layer-2); }
.ng-fab-note { margin: 14px 0 0; font-size: 11.5px; line-height: 1.65; color: var(--dsw-alias-label-secondary); }
.ng-fab-trigger { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0; border: none; border-radius: 8px; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.ng-fab-trigger:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2); }
.ng-fab-trigger[aria-pressed='true'] { color: var(--dsw-alias-brand-primary); }
.ng-fab-trigger:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.ng-inline { display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 4px 0 6px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); flex: none; }
.ng-inline-range { width: 44px; height: 14px; margin: 0; accent-color: var(--dsw-alias-brand-primary); cursor: pointer; }
.ng-inline-toggle { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; padding: 0; border: none; border-radius: 50%; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; transition: color 140ms ease, background 140ms ease; }
.ng-inline-toggle:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2); }
.ng-inline-toggle[aria-pressed='true'] { color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-bg-layer-2); }
.ng-inline-toggle:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.ng-inline-range:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
.ng-notes { display: flex; flex-direction: column; gap: 6px; padding: 11px 14px; border-radius: 12px; border: 1px dashed var(--dsw-alias-border-l2); font-size: 11.5px; line-height: 1.6; color: var(--dsw-alias-label-secondary); }
@media (max-width: 560px) {
  .ng-row { flex-wrap: wrap; }
  .ng-slider { width: 120px; }
  .ng-seg { flex-wrap: wrap; }
}
`

    /** Build the Settings page component for one controller instance. */
    function createSettingsPage(React_, tr, store, controller) {
      const h = React_.createElement
      const { useState, useEffect, useCallback } = React_

      function useSettings() {
        const [state, setState] = useState(store.get())
        useEffect(() => store.subscribe(() => setState(store.get())), [])
        return state
      }

      function Row(props) {
        return h('div', { className: 'ng-row' },
          h('div', { className: 'ng-row-main' },
            h('div', { className: 'ng-row-label' }, props.label),
            props.hint === undefined ? null : h('div', { className: 'ng-row-hint' }, props.hint)),
          h('div', { className: 'ng-control' }, props.children))
      }

      function Switch(props) {
        return h('button', {
          type: 'button',
          className: 'ng-switch',
          role: 'switch',
          'aria-checked': props.checked ? 'true' : 'false',
          'aria-label': props.label,
          onClick: () => props.onChange(!props.checked),
        })
      }

      function Slider(props) {
        return [
          h('input', {
            key: 'input',
            className: 'ng-slider',
            type: 'range',
            min: props.min,
            max: props.max,
            step: props.step,
            value: props.value,
            'aria-label': props.label,
            onChange: (event) => props.onChange(Number(event.currentTarget.value)),
          }),
          h('span', { key: 'value', className: 'ng-value' }, props.format === undefined ? props.value.toFixed(2) : props.format(props.value)),
        ]
      }

      function Segmented(props) {
        return h('div', { className: 'ng-seg', role: 'group', 'aria-label': props.label },
          props.options.map(option => h('button', {
            key: option.value,
            type: 'button',
            'aria-pressed': props.value === option.value ? 'true' : 'false',
            onClick: () => props.onChange(option.value),
          }, option.label)))
      }

      return function NeuralGlassSection() {
        const state = useSettings()
        const patch = useCallback((next) => { store.patch(next) }, [])
        const status = !state.enabled ? tr('statusOff') : state.paused ? tr('statusPaused') : tr('statusOn')
        const percent = (value) => `${Math.round(value * 100)}%`

        return h('div', { className: 'ng-page' },
          h('header', { className: 'ng-head' },
            h('div', null,
              h('div', { className: 'ng-title' }, tr('title')),
              h('p', { className: 'ng-intro' }, tr('intro'))),
            h('div', { className: 'ng-status', 'data-on': state.enabled ? 'true' : 'false', 'data-paused': state.paused ? 'true' : 'false' },
              h('span', { className: 'ng-dot' }), status)),

          h('section', { className: 'ng-group' },
            h('div', { className: 'ng-group-title' }, tr('groupLook')),
            h('div', { className: 'ng-card' },
              h(Row, { label: tr('enable'), hint: tr('enableHint') },
                h(Switch, { label: tr('enable'), checked: state.enabled, onChange: (v) => patch({ enabled: v }) })),
              h(Row, { label: tr('darkBase'), hint: tr('darkBaseHint') },
                h(Switch, { label: tr('darkBase'), checked: state.darkBase, onChange: (v) => patch({ darkBase: v }) })),
              h(Row, { label: tr('glass'), hint: tr('glassHint') },
                h(Slider, { label: tr('glass'), min: 0.12, max: 0.55, step: 0.01, value: state.glass, format: (v) => `${Math.round((1 - (1 - v) ** 2) * 100)}%`, onChange: (v) => patch({ glass: v }) })),
              h(Row, { label: tr('frost'), hint: tr('frostHint') },
                h(Slider, { label: tr('frost'), min: 0, max: 1, step: 0.01, value: state.frost, format: percent, onChange: (v) => patch({ frost: v }) })),
              h(Row, { label: tr('brightness') },
                h(Slider, { label: tr('brightness'), min: 0, max: 100, step: 1, value: glowPercentOf(state.brightness), format: (v) => `${v}%`, onChange: (v) => patch({ brightness: glowValueOf(v) }) })))),

          h('section', { className: 'ng-group' },
            h('div', { className: 'ng-group-title' }, tr('groupMotion')),
            h('div', { className: 'ng-card' },
              h(Row, { label: tr('pause'), hint: tr('pauseHint') },
                h(Switch, { label: tr('pause'), checked: state.paused, onChange: (v) => patch({ paused: v }) })),
              h(Row, { label: tr('intro'), hint: tr('introHint') },
                h(Switch, { label: tr('intro'), checked: state.intro, onChange: (v) => patch({ intro: v }) })),
              h(Row, { label: tr('speed') },
                h(Slider, { label: tr('speed'), min: 0.4, max: 2, step: 0.05, value: state.speed, format: (v) => `${v.toFixed(2)}×`, onChange: (v) => patch({ speed: v }) })),
              h(Row, { label: tr('glow') },
                h(Slider, { label: tr('glow'), min: 0, max: 1.6, step: 0.05, value: state.glow, format: (v) => v.toFixed(2), onChange: (v) => patch({ glow: v }) })),
              h(Row, { label: tr('particles'), hint: tr('particlesHint') },
                h(Slider, { label: tr('particles'), min: 0.2, max: 1.6, step: 0.05, value: state.particles, format: (v) => v.toFixed(2), onChange: (v) => patch({ particles: v }) })),
              h(Row, { label: tr('codeScan'), hint: tr('codeScanHint') },
                h(Switch, { label: tr('codeScan'), checked: state.codeScan, onChange: (v) => patch({ codeScan: v }) })),
              h(Row, { label: tr('labels') },
                h(Switch, { label: tr('labels'), checked: state.labels, onChange: (v) => patch({ labels: v }) })),
              h(Row, { label: tr('reduceMotion'), hint: tr('reduceMotionHint') },
                h(Switch, { label: tr('reduceMotion'), checked: state.reduceMotion, onChange: (v) => patch({ reduceMotion: v }) })))),

          h('section', { className: 'ng-group' },
            h('div', { className: 'ng-group-title' }, tr('groupStructure')),
            h('div', { className: 'ng-card' },
              h(Row, { label: tr('mode') },
                h(Segmented, {
                  label: tr('mode'),
                  value: state.mode,
                  options: [{ value: 'encdec', label: tr('modeEncdec') }, { value: 'decoder', label: tr('modeDecoder') }],
                  onChange: (v) => patch({ mode: v }),
                })),
              h(Row, { label: tr('source'), hint: tr('sourceHint') },
                h(Segmented, {
                  label: tr('source'),
                  value: state.source,
                  options: [{ value: 'demo', label: tr('sourceDemo') }, { value: 'host', label: tr('sourceHost') }],
                  onChange: (v) => patch({ source: v }),
                })))),

          h('section', { className: 'ng-group' },
            h('div', { className: 'ng-group-title' }, tr('groupPerf')),
            h('div', { className: 'ng-card' },
              h(Row, { label: tr('quality') },
                h(Segmented, {
                  label: tr('quality'),
                  value: state.quality,
                  options: [
                    { value: 'low', label: tr('qualityLow') },
                    { value: 'medium', label: tr('qualityMedium') },
                    { value: 'high', label: tr('qualityHigh') },
                  ],
                  onChange: (v) => patch({ quality: v }),
                })))),

          h('div', { className: 'ng-notes' },
            h('div', null, tr('note')),
            h('div', null, tr('noteColor'))),

          h('button', {
            type: 'button',
            className: 'ng-reset',
            onClick: () => {
              // Reset every tunable but keep the skin's on/off and pause state.
              store.patch({ ...DEFAULTS, enabled: state.enabled, paused: state.paused })
              controller.sync()
            },
          }, tr('reset')),
        )
      }
    }

    // ------------------------------------------------------------ control panel

    /** One slider row: label, live value, track, and the two end captions. */
    function createPanelField(React_) {
      const h = React_.createElement
      return function PanelField(props) {
        return h('div', { className: 'ng-fab-field' },
          h('div', { className: 'ng-fab-fieldhead' },
            h('span', { className: 'ng-fab-label' }, props.label),
            h('span', { className: 'ng-fab-value' }, props.value)),
          h('input', {
            className: 'ng-fab-range',
            type: 'range',
            min: props.min,
            max: props.max,
            step: props.step,
            value: props.raw,
            'aria-label': props.label,
            onChange: (event) => props.onChange(Number(event.currentTarget.value)),
          }),
          h('div', { className: 'ng-fab-ends' },
            h('span', null, props.minLabel),
            h('span', null, props.maxLabel)))
      }
    }

    /** The floating Neural Glass panel: presets, sliders, switches, reset. */
    function createControlPanel(React_, tr, store, panel) {
      const h = React_.createElement
      const { useState, useEffect, useRef } = React_
      const PanelField = createPanelField(React_)

      function useSettings() {
        const [state, setState] = useState(store.get())
        useEffect(() => store.subscribe(() => setState(store.get())), [])
        return state
      }

      function usePanelOpen() {
        const [open, setOpen] = useState(panel.get())
        useEffect(() => panel.subscribe(() => setOpen(panel.get())), [])
        return open
      }

      function Switch(props) {
        return h('button', {
          type: 'button',
          className: 'ng-switch',
          role: 'switch',
          'aria-checked': props.checked ? 'true' : 'false',
          'aria-label': props.label,
          onClick: () => props.onChange(!props.checked),
        })
      }

      const closeIcon = h('svg', { viewBox: '0 0 16 16', width: 14, height: 14, 'aria-hidden': 'true' },
        h('path', { d: 'M3.2 3.2l9.6 9.6M12.8 3.2l-9.6 9.6', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }))

      return function NeuralGlassPanel() {
        const state = useSettings()
        const open = usePanelOpen()
        const ref = useRef(null)

        useEffect(() => {
          if (!open) return undefined
          const node = ref.current
          if (node !== null) node.focus()
          const onKey = (event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
              panel.set(false)
            }
          }
          window.addEventListener('keydown', onKey)
          return () => { window.removeEventListener('keydown', onKey) }
        }, [open])

        if (!open) return null

        const patch = (next) => store.patch(next)
        const transparency = Math.round((1 - (1 - state.glass) ** 2) * 100)
        const glowPercent = glowPercentOf(state.brightness)
        const blurPx = Math.round(state.frost * 16)
        const presetKeys = ['focus', 'balanced', 'immersive']
        const activePreset = presetKeys.find((key) => {
          const preset = PRESETS[key]
          return Math.abs(preset.glass - state.glass) < 0.005
            && Math.abs(preset.brightness - state.brightness) < 0.005
            && Math.abs(preset.frost - state.frost) < 0.005
            && Math.abs(preset.speed - state.speed) < 0.005
        }) ?? null

        return h('aside', {
          className: 'ng-fab',
          role: 'dialog',
          'aria-label': tr('panelTitle'),
          tabIndex: -1,
          ref,
        },
        h('div', { className: 'ng-fab-head' },
          h('div', { className: 'ng-fab-headtext' },
            h('div', { className: 'ng-fab-title' }, tr('panelTitle')),
            h('div', { className: 'ng-fab-sub' }, state.enabled ? tr('panelSubtitle') : `${tr('panelDisabled')} · ${tr('panelSubtitle')}`)),
          h('button', {
            type: 'button',
            className: 'ng-fab-close',
            'aria-label': tr('panelClose'),
            title: tr('panelClose'),
            onClick: () => panel.set(false),
          }, closeIcon)),

        h('div', { className: 'ng-fab-presets', role: 'group', 'aria-label': tr('panelTitle') },
          h('button', {
            type: 'button',
            className: 'ng-fab-preset',
            'aria-pressed': activePreset === 'focus' ? 'true' : 'false',
            onClick: () => patch({ ...PRESETS.focus }),
          }, tr('presetFocus')),
          h('button', {
            type: 'button',
            className: 'ng-fab-preset',
            'aria-pressed': activePreset === 'balanced' ? 'true' : 'false',
            onClick: () => patch({ ...PRESETS.balanced }),
          }, tr('presetBalanced')),
          h('button', {
            type: 'button',
            className: 'ng-fab-preset',
            'aria-pressed': activePreset === 'immersive' ? 'true' : 'false',
            onClick: () => patch({ ...PRESETS.immersive }),
          }, tr('presetImmersive'))),

        h(PanelField, {
          label: tr('uiOpacity'),
          value: `${transparency}%`,
          raw: state.glass,
          min: 0.12,
          max: 0.55,
          step: 0.01,
          minLabel: tr('solid'),
          maxLabel: tr('transparent'),
          onChange: (v) => patch({ glass: v }),
        }),
        h(PanelField, {
          label: tr('bgGlow'),
          value: `${glowPercent}%`,
          raw: glowPercent,
          min: 0,
          max: 100,
          step: 1,
          minLabel: tr('muted'),
          maxLabel: tr('luminous'),
          onChange: (v) => patch({ brightness: glowValueOf(v) }),
        }),
        h(PanelField, {
          label: tr('glassBlur'),
          value: `${blurPx}px`,
          raw: state.frost,
          min: 0,
          max: 1,
          step: 0.01,
          minLabel: tr('crisp'),
          maxLabel: tr('soft'),
          onChange: (v) => patch({ frost: v }),
        }),
        h(PanelField, {
          label: tr('animSpeed'),
          value: `${state.speed.toFixed(1)}×`,
          raw: state.speed,
          min: 0.4,
          max: 2,
          step: 0.05,
          minLabel: tr('calm'),
          maxLabel: tr('flowing'),
          onChange: (v) => patch({ speed: v }),
        }),

        h('div', { className: 'ng-fab-toggle' },
          h('span', { className: 'ng-fab-label' }, tr('enabledShort')),
          h(Switch, { label: tr('enabledShort'), checked: state.enabled, onChange: (v) => patch({ enabled: v }) })),
        h('div', { className: 'ng-fab-toggle' },
          h('span', { className: 'ng-fab-label' }, tr('pausedShort')),
          h(Switch, { label: tr('pausedShort'), checked: state.paused, onChange: (v) => patch({ paused: v }) })),
        h('div', { className: 'ng-fab-toggle' },
          h('span', { className: 'ng-fab-label' }, tr('introShort')),
          h(Switch, { label: tr('introShort'), checked: state.intro, onChange: (v) => patch({ intro: v }) })),

        h('div', { className: 'ng-fab-divider' }),
        h('div', { className: 'ng-fab-foot' },
          h('span', { className: 'ng-fab-saved' }, tr('savedLocal')),
          h('button', {
            type: 'button',
            className: 'ng-fab-reset',
            onClick: () => patch({ ...DEFAULTS, enabled: state.enabled, paused: state.paused }),
          }, tr('resetShort'))),
        h('p', { className: 'ng-fab-note' }, tr('panelNote')))
      }
    }

    /** Sidebar-foot button that opens the panel. */
    function createPanelTrigger(React_, tr, panel) {
      const h = React_.createElement
      const { useState, useEffect } = React_
      const icon = h('svg', { viewBox: '0 0 16 16', width: 15, height: 15, 'aria-hidden': 'true' },
        h('path', { d: 'M8 2.4l1.4 3.8 3.8 1.4-3.8 1.4L8 12.8 6.6 9 2.8 7.6 6.6 6.2z', fill: 'currentColor', opacity: 0.92 }))
      return function NeuralGlassFooterAction() {
        const [open, setOpen] = useState(panel.get())
        useEffect(() => panel.subscribe(() => setOpen(panel.get())), [])
        return h('button', {
          type: 'button',
          className: 'ng-fab-trigger',
          'aria-label': tr('panelOpen'),
          'aria-pressed': open ? 'true' : 'false',
          title: tr('panelOpen'),
          onClick: () => panel.toggle(),
        }, icon)
      }
    }

    // --------------------------------------------------------- composer control

    /**
     * Compact background-density slider plus the intro-fade switch, seated in
     * the composer tool row directly beside the model selector.
     */
    function createComposerControls(React_, tr, store, panel) {
      const h = React_.createElement
      const { useState, useEffect } = React_

      function useSettings() {
        const [state, setState] = useState(store.get())
        const [panelOpen, setPanelOpen] = useState(panel.get())
        useEffect(() => store.subscribe(() => setState(store.get())), [])
        useEffect(() => panel.subscribe(() => setPanelOpen(panel.get())), [])
        return [state, panelOpen]
      }

      const sparkIcon = h('svg', { viewBox: '0 0 16 16', width: 13, height: 13, 'aria-hidden': 'true' },
        h('path', { d: 'M8 2.2l1.5 4.1 4.1 1.5-4.1 1.5L8 13.4 6.5 9.3 2.4 7.8l4.1-1.5z', fill: 'currentColor' }))

      return function NeuralGlassComposerControls() {
        const [state, panelOpen] = useSettings()
        const density = glowPercentOf(state.brightness)
        return h('div', { className: 'ng-inline' },
          h('input', {
            className: 'ng-inline-range',
            type: 'range',
            min: 0,
            max: 100,
            step: 1,
            value: glowPercentOf(state.brightness),
            'aria-label': `${tr('bgDensity')} ${density}%`,
            title: `${tr('bgDensity')} · ${density}%`,
            onChange: (event) => store.patch({ brightness: glowValueOf(Number(event.currentTarget.value)) }),
          }),
          h('button', {
            type: 'button',
            className: 'ng-inline-toggle',
            'aria-pressed': panelOpen ? 'true' : 'false',
            'aria-label': tr('panelOpen'),
            title: tr('panelOpen'),
            onClick: () => panel.toggle(),
          }, sparkIcon))
      }
    }

    // ------------------------------------------------------------ status bridge

    /**
     * Invisible seat that turns live session activity into a scene state.
     * Renders nothing; without the standard hook it stays inert.
     */
    function createStatusBridge(controller, store) {
      return function NeuralGlassStatusBridge(props) {
        const selectRunning = React.useCallback((snapshot) => {
          if (snapshot === undefined || snapshot === null || typeof snapshot.values !== 'function') return false
          for (const status of snapshot.values()) {
            if (status !== null && status !== undefined && status.running === true) return true
          }
          return false
        }, [])
        const useStatus = props !== null && props !== undefined && typeof props.useSessionStatus === 'function'
          ? props.useSessionStatus
          : () => false
        const running = useStatus(selectRunning)
        const previous = React.useRef(false)

        React.useEffect(() => {
          const wasRunning = previous.current
          previous.current = running
          const scene = controller.scene()
          if (scene === null) return undefined
          if (store.get().source !== 'host') {
            if (scene.getEngagement() !== 'demo') scene.setEngagement('demo')
            return undefined
          }
          if (running) {
            scene.setEngagement('thinking')
            return undefined
          }
          if (wasRunning) {
            scene.setEngagement('complete')
            const timer = window.setTimeout(() => {
              const live = controller.scene()
              if (live !== null) live.setEngagement('idle')
            }, 2600)
            return () => { window.clearTimeout(timer) }
          }
          scene.setEngagement('idle')
          return undefined
        }, [running])

        return null
      }
    }

    // ------------------------------------------------------------------ plugin

    /** Resolve a translate function from the host locale, falling back to the browser. */
    function makeTranslator(ctx) {
      let lang = ''
      try {
        const locale = ctx.get('locale')
        if (locale !== undefined && typeof locale.getLocale === 'function') {
          const snapshot = locale.getLocale()
          if (snapshot !== null && snapshot !== undefined && typeof snapshot.id === 'string') lang = snapshot.id
        }
      } catch {
        // Locale service unavailable: fall back to the browser language.
      }
      if (lang === '') {
        lang = typeof navigator !== 'undefined' && typeof navigator.language === 'string' ? navigator.language : 'en'
      }
      const dict = String(lang).toLowerCase().startsWith('zh') ? COPY.zh : COPY.en
      return (key) => (dict[key] === undefined ? key : dict[key])
    }

    return {
      inject: ['slots'],
      /**
       * Mount the skin and its settings page.
       * @param {object} ctx - Client Cordis context.
       */
      apply(ctx) {
        const store = createSettingsStore()
        const panel = createPanelStore()
        const controller = createController(ctx, store)
        const tr = makeTranslator(ctx)

        // Page styles live as long as the plugin, so the settings page is styled
        // even while the skin itself is switched off.
        ctx.effect(() => {
          const tag = document.createElement('style')
          tag.setAttribute('data-plugin', PACKAGE_ID)
          tag.setAttribute('data-plugin-css', `${PACKAGE_ID}/page`)
          tag.textContent = PAGE_CSS
          document.head.appendChild(tag)
          return () => { tag.remove() }
        }, 'neural-glass: settings styles')

        ctx.effect(() => controller.start(), 'neural-glass: scene + glass layer')

        // State interface for host automation: window.__NEURAL_GLASS__.
        ctx.effect(() => {
          const api = {
            version: 1,
            getSettings: () => store.get(),
            patch: (patch) => store.patch(patch),
            reset: () => store.reset(),
            /** Drive the illustration: idle | submitting | thinking | streaming | complete | error. */
            setState: (state) => {
              const scene = controller.scene()
              if (scene !== null) scene.setEngagement(state)
            },
          }
          window.__NEURAL_GLASS__ = api
          return () => { delete window.__NEURAL_GLASS__ }
        }, 'neural-glass: host interface')

        ctx.effect(() => ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
          name: 'conversation.input.right',
          id: 'neural-glass-controls',
          order: 0,
        }, createComposerControls(React, tr, store, panel))), 'neural-glass: composer controls')

        ctx.effect(() => ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
          name: 'sidebar.footer.action',
          id: 'neural-glass-panel',
          order: 5,
        }, createPanelTrigger(React, tr, panel))), 'neural-glass: sidebar trigger')

        ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'neural-glass-panel',
          order: 80,
        }, createControlPanel(React, tr, store, panel))), 'neural-glass: control panel')

        ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'neural-glass-state',
          order: 90,
        }, createStatusBridge(controller, store))), 'neural-glass: session activity bridge')

        ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'neural-glass',
          order: 30,
          label: () => tr('nav'),
        }, createSettingsPage(React, tr, store, controller))), 'neural-glass: settings section')
      },
    }
  },
})

