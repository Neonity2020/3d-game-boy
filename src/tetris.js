/**
 * Tetris for a 160x144 DMG-style LCD.
 *
 * Everything is drawn at the console's native logical resolution (160x144) and
 * scaled up with nearest-neighbour, so the result stays as crunchy as the real
 * hardware. Colours come from the four-tone Game Boy palette.
 */

export const PALETTE = {
  lightest: '#9bbc0f',
  light: '#8bac0f',
  dark: '#306230',
  darkest: '#0f380f',
};

const W = 160;
const H = 144;
const SCALE = 3;

const COLS = 10;
const ROWS = 18;
const CELL = 7;

const BOARD_X = 8;
const BOARD_Y = 13;

const PANEL_X = 86;

/* ------------------------------------------------------------------ *
 * 5x7 bitmap font — cheaper and crisper than fillText at this size.
 * ------------------------------------------------------------------ */

const FONT = {
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#',
  B: '####.|#...#|#...#|####.|#...#|#...#|####.',
  C: '.###.|#...#|#....|#....|#....|#...#|.###.',
  D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
  E: '#####|#....|#....|####.|#....|#....|#####',
  F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.###.|#...#|#....|#.###|#...#|#...#|.###.',
  H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
  I: '#####|..#..|..#..|..#..|..#..|..#..|#####',
  J: '..###|...#.|...#.|...#.|...#.|#..#.|.##..',
  K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#',
  L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#...#|#...#|#...#|#...#',
  N: '#...#|##..#|#.#.#|#..##|#...#|#...#|#...#',
  O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
  P: '####.|#...#|#...#|####.|#....|#....|#....',
  Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#',
  R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.',
  T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
  V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
  W: '#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#',
  X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..',
  Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  0: '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.',
  1: '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
  2: '.###.|#...#|....#|...#.|..#..|.#...|#####',
  3: '####.|....#|....#|.###.|....#|....#|####.',
  4: '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.',
  5: '#####|#....|####.|....#|....#|#...#|.###.',
  6: '..##.|.#...|#....|####.|#...#|#...#|.###.',
  7: '#####|....#|...#.|..#..|..#..|..#..|..#..',
  8: '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
  9: '.###.|#...#|#...#|.####|....#|...#.|.##..',
  '-': '.....|.....|.....|#####|.....|.....|.....',
  ':': '.....|..#..|..#..|.....|..#..|..#..|.....',
  '.': '.....|.....|.....|.....|.....|..#..|..#..',
  '!': '..#..|..#..|..#..|..#..|..#..|.....|..#..',
  '>': '.....|.#...|..#..|...#.|..#..|.#...|.....',
  '<': '.....|...#.|..#..|.#...|..#..|...#.|.....',
  '/': '....#|....#|...#.|..#..|.#...|#....|#....',
  '+': '.....|..#..|..#..|#####|..#..|..#..|.....',
  ' ': '.....|.....|.....|.....|.....|.....|.....',
};

/* ------------------------------------------------------------------ *
 * Piece definitions. Only rotation 0 is authored; the rest is derived.
 * ------------------------------------------------------------------ */

function rotateCells(cells, size) {
  const out = [];
  for (const [x, y] of cells) out.push([y, size - 1 - x]);
  return out;
}

function makePiece(name, size, rowStrings) {
  let cells = [];
  rowStrings.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === 'X') cells.push([x, y]);
  });
  const states = [cells];
  for (let i = 1; i < 4; i++) states.push(rotateCells(states[i - 1], size));
  return { name, size, states };
}

const PIECES = [
  makePiece('I', 4, ['....', 'XXXX', '....', '....']),
  makePiece('J', 3, ['X..', 'XXX', '...']),
  makePiece('L', 3, ['..X', 'XXX', '...']),
  makePiece('O', 2, ['XX', 'XX']),
  makePiece('S', 3, ['.XX', 'XX.', '...']),
  makePiece('T', 3, ['.X.', 'XXX', '...']),
  makePiece('Z', 3, ['XX.', '.XX', '...']),
];

const KICKS = [
  [0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0], [0, 1], [-1, -1], [1, -1],
];

/* ------------------------------------------------------------------ */

export class Tetris {
  constructor(canvas, { onSound } = {}) {
    this.canvas = canvas;
    canvas.width = W * SCALE;
    canvas.height = H * SCALE;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this.onSound = onSound || (() => {});
    this.state = 'off';
    this.time = 0;
    this.flash = 0;
    this.sweep = 0;

    this.highScore = this.loadHighScore();
    this.board = [];
    this.reset();
  }

  /* ---------------------------- persistence ---------------------------- */

  loadHighScore() {
    try {
      const v = parseInt(localStorage.getItem('gb-tetris-hi') || '0', 10);
      return Number.isFinite(v) ? v : 0;
    } catch {
      return 0;
    }
  }

  saveHighScore() {
    try {
      localStorage.setItem('gb-tetris-hi', String(this.highScore));
    } catch { /* private mode — score simply won't persist */ }
  }

  /* ------------------------------ lifecycle ---------------------------- */

  power(on) {
    if (on) {
      this.state = 'boot';
      this.time = 0;
    } else {
      this.state = 'off';
    }
  }

  reset() {
    this.board = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
    this.score = 0;
    this.lines = 0;
    this.level = 0;
    this.hold = null;
    this.holdUsed = false;
    this.piece = null;
    this.bag = [];
    this.dropTimer = 0;
    this.clearTimer = 0;
    this.clearingRows = [];
  }

  /* -------------------------------- input ------------------------------ */

  press(action) {
    if (this.state === 'off' || this.state === 'boot') return;

    if (action === 'start') {
      if (this.state === 'title') this.startGame();
      else if (this.state === 'playing') { this.state = 'paused'; this.onSound('pause'); }
      else if (this.state === 'paused') { this.state = 'playing'; this.onSound('pause'); }
      else if (this.state === 'over' && this.time > 900) { this.state = 'title'; this.time = 0; }
      return;
    }

    if (action === 'select' && this.state === 'playing') {
      this.swapHold();
      return;
    }

    if (this.state !== 'playing' || !this.piece) return;

    switch (action) {
      case 'left': this.move(-1); break;
      case 'right': this.move(1); break;
      case 'a': case 'up': this.rotate(1); break;
      case 'b': this.rotate(-1); break;
      case 'down':
        if (this.tryMove(0, 1)) {
          this.score += 1;
          this.dropTimer = 0;
          this.onSound('move');
        }
        break;
      case 'drop': {
        let landed = false;
        while (!this.collides(this.piece, 0, 1)) { this.piece.y += 1; landed = true; }
        if (landed) this.score += 2;
        this.onSound('locksoft');
        this.lockPiece();
        break;
      }
      default: break;
    }
  }

  startGame() {
    this.reset();
    this.spawn();
    this.state = 'playing';
    this.onSound('start');
  }

  swapHold() {
    if (this.holdUsed) return;
    const current = this.piece.type.name;
    const swap = this.hold; // null the very first time
    this.hold = current; // we are now holding what just came off the board
    this.spawn(swap); // null draws a fresh random piece
    this.holdUsed = true;
    this.onSound('move');
  }

  /* -------------------------------- logic ------------------------------ */

  refillBag() {
    this.bag = PIECES.map((p) => p.name);
    for (let i = this.bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
    }
  }

  nextFromBag() {
    if (this.bag.length === 0) this.refillBag();
    return this.bag.pop();
  }

  /** Look at the next piece without consuming it. */
  peekNext() {
    if (this.bag.length === 0) this.refillBag();
    return this.bag[this.bag.length - 1];
  }

  spawn(name = null) {
    const typeName = name || this.nextFromBag();
    const type = PIECES.find((p) => p.name === typeName);
    const size = type.size;
    this.piece = {
      type,
      rot: 0,
      x: Math.floor((COLS - size) / 2),
      y: -1,
    };
    this.holdUsed = false;
    this.dropTimer = 0;

    if (this.collides(this.piece, 0, 0, this.piece.rot)) this.gameOver();
  }

  collides(piece, dx, dy, rot = piece.rot) {
    const cells = piece.type.states[rot];
    for (const [cx, cy] of cells) {
      const x = piece.x + cx + dx;
      const y = piece.y + cy + dy;
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && this.board[y][x]) return true;
    }
    return false;
  }

  tryMove(dx, dy, rot = this.piece.rot) {
    if (this.collides(this.piece, dx, dy, rot)) return false;
    this.piece.x += dx;
    this.piece.y += dy;
    if (rot !== this.piece.rot) this.piece.rot = rot;
    return true;
  }

  move(dir) {
    if (this.tryMove(dir, 0)) this.onSound('move');
  }

  rotate(dir) {
    const next = (this.piece.rot + (dir > 0 ? 1 : 3)) % 4;
    for (const [kx, ky] of KICKS) {
      if (this.tryMove(kx, ky, next)) {
        this.onSound('rotate');
        return;
      }
    }
  }

  lockPiece() {
    const cells = this.piece.type.states[this.piece.rot];
    // check the whole piece before writing any of it, so a top-out leaves the
    // board untouched
    for (const [cx, cy] of cells) {
      if (this.piece.y + cy < 0) { this.gameOver(); return; }
    }
    for (const [cx, cy] of cells) {
      this.board[this.piece.y + cy][this.piece.x + cx] = this.piece.type.name;
    }

    const full = [];
    for (let y = 0; y < ROWS; y++) {
      if (this.board[y].every(Boolean)) full.push(y);
    }

    if (full.length) {
      this.clearingRows = full;
      this.clearTimer = 320;
      this.flash = 1;
      this.onSound('clear');
    } else {
      this.spawn();
    }
  }

  finishClear() {
    const { clearingRows } = this;
    const kept = this.board.filter((row, y) => !clearingRows.includes(y));
    const newRows = clearingRows.length;
    while (kept.length < ROWS) kept.unshift(new Array(COLS).fill(null));
    this.board = kept;

    const points = [0, 100, 300, 500, 800][newRows] * (this.level + 1);
    this.score += points;
    this.lines += newRows;
    this.level = Math.floor(this.lines / 10);
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.saveHighScore();
    }
    this.clearingRows = [];
    this.spawn();
  }

  gameOver() {
    this.state = 'over';
    this.time = 0;
    this.piece = null;
    this.onSound('gameover');
  }

  /* -------------------------------- frame ------------------------------ */

  update(dt) {
    if (this.state === 'off') return;

    this.time += dt;
    this.sweep = (this.sweep + dt * 0.02) % (H + 30);
    this.flash = Math.max(0, this.flash - dt * 0.006);

    if (this.state === 'boot' && this.time > 1500) {
      this.state = 'title';
      this.time = 0;
    }

    if (this.state === 'playing') {
      if (this.clearTimer > 0) {
        this.clearTimer -= dt;
        if (this.clearTimer <= 0) this.finishClear();
      } else if (this.piece) {
        const interval = Math.max(90, 820 - this.level * 68);
        this.dropTimer += dt;
        if (this.dropTimer >= interval) {
          this.dropTimer = 0;
          if (this.tryMove(0, 1)) {
            this.onSound('locksoft');
          } else {
            this.lockPiece();
          }
        }
      }
    }
  }

  render() {
    const ctx = this.ctx;

    if (this.state === 'off') {
      ctx.fillStyle = '#7d8a52';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }

    ctx.save();
    ctx.scale(SCALE, SCALE);
    ctx.fillStyle = PALETTE.lightest;
    ctx.fillRect(0, 0, W, H);

    if (this.state === 'boot') this.drawBoot(ctx);
    else {
      this.drawBoard(ctx);
      this.drawPanel(ctx);
      if (this.state === 'title') this.drawTitle(ctx);
      if (this.state === 'paused') this.drawBanner(ctx, 'PAUSE');
      if (this.state === 'over') this.drawGameOver(ctx);
    }

    this.drawLcdFx(ctx);
    ctx.restore();
  }

  drawBoot(ctx) {
    const t = this.time;
    ctx.fillStyle = PALETTE.lightest;
    ctx.fillRect(0, 0, W, H);

    if (t > 150) {
      // the classic line sweeping down the screen
      const p = Math.min(1, (t - 150) / 900);
      const y = 40 + p * 60;
      ctx.fillStyle = PALETTE.dark;
      ctx.fillRect(52, y, 56, 2);
    }

    if (t > 1100) {
      // little rabbit-ish pixel mascot
      const bob = Math.sin((t - 1100) / 90) * 0.5;
      ctx.fillStyle = PALETTE.darkest;
      ctx.fillRect(70, 20 + bob, 3, 24);
      ctx.fillRect(87, 20 + bob, 3, 24);
      ctx.fillRect(68, 40 + bob, 24, 3);
      ctx.fillRect(72, 44 + bob, 3, 3);
      ctx.fillRect(85, 44 + bob, 3, 3);
      ctx.fillRect(76, 47 + bob, 8, 2);
    }
  }

  drawTitle(ctx) {
    ctx.fillStyle = PALETTE.dark;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = PALETTE.lightest;
    ctx.fillRect(2, 2, W - 4, H - 4);

    this.text(ctx, 'TETRIS', 80, 34, 'darkest', 3, 'center');
    ctx.fillStyle = PALETTE.dark;
    ctx.fillRect(30, 62, 100, 1);

    this.text(ctx, 'HI  ' + this.pad(this.highScore), 80, 74, 'dark', 1, 'center');
    this.text(ctx, 'TOP ' + this.pad(this.highScore), 80, 84, 'dark', 1, 'center');

    if (Math.floor(this.time / 480) % 2 === 0) {
      this.text(ctx, 'PRESS START', 80, 112, 'darkest', 1, 'center');
    }
    this.text(ctx, 'SELECT = HOLD', 80, 130, 'dark', 1, 'center');
  }

  drawGameOver(ctx) {
    ctx.fillStyle = 'rgba(15,56,15,0.62)';
    ctx.fillRect(0, 0, W, H);
    this.box(ctx, 18, 46, 124, 54);
    this.text(ctx, 'GAME OVER', 80, 56, 'darkest', 2, 'center');
    this.text(ctx, 'SCORE ' + this.pad(this.score), 80, 78, 'darkest', 1, 'center');
    this.text(ctx, 'TOP   ' + this.pad(this.highScore), 80, 88, 'darkest', 1, 'center');
    if (Math.floor(this.time / 500) % 2 === 0 && this.time > 900) {
      this.text(ctx, 'PRESS START', 80, 118, 'darkest', 1, 'center');
    }
  }

  drawBanner(ctx, label) {
    ctx.fillStyle = 'rgba(15,56,15,0.55)';
    ctx.fillRect(0, 0, W, H);
    this.box(ctx, 32, 62, 96, 22);
    this.text(ctx, label, 80, 69, 'darkest', 2, 'center');
  }

  /* ------------------------------- drawing ----------------------------- */

  drawBoard(ctx) {
    const x0 = BOARD_X;
    const y0 = BOARD_Y;

    // well background + frame
    ctx.fillStyle = PALETTE.light;
    ctx.fillRect(x0, y0, COLS * CELL, ROWS * CELL);
    ctx.strokeStyle = PALETTE.darkest;
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 - 2.5, y0 - 2.5, COLS * CELL + 5, ROWS * CELL + 5);

    // faint grid inside the well
    ctx.fillStyle = PALETTE.dark;
    for (let x = 1; x < COLS; x++) ctx.fillRect(x0 + x * CELL, y0, 1, ROWS * CELL);
    for (let y = 1; y < ROWS; y++) ctx.fillRect(x0, y0 + y * CELL, COLS * CELL, 1);

    const clearing = this.clearingRows;

    for (let y = 0; y < ROWS; y++) {
      const isClearing = clearing.includes(y);
      for (let x = 0; x < COLS; x++) {
        const cell = this.board[y][x];
        if (cell && !isClearing) this.block(ctx, x0 + x * CELL, y0 + y * CELL, cell);
      }
    }

    // clearing rows flash in and out before vanishing
    if (clearing.length) {
      const phase = Math.floor(this.clearTimer / 55) % 2 === 0;
      if (phase) {
        ctx.fillStyle = PALETTE.darkest;
        for (const y of clearing) ctx.fillRect(x0, y0 + y * CELL, COLS * CELL, CELL);
      }
    }

    if (this.piece) {
      const cells = this.piece.type.states[this.piece.rot];
      // ghost outline
      let ghostY = this.piece.y;
      while (!this.collides(this.piece, 0, ghostY - this.piece.y + 1, this.piece.rot)) ghostY++;
      if (ghostY !== this.piece.y) {
        ctx.fillStyle = PALETTE.dark;
        for (const [cx, cy] of cells) {
          const px = x0 + (this.piece.x + cx) * CELL;
          const py = y0 + (ghostY + cy) * CELL;
          if (ghostY + cy >= 0) ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
        }
      }
      for (const [cx, cy] of cells) {
        const px = x0 + (this.piece.x + cx) * CELL;
        const py = y0 + (this.piece.y + cy) * CELL;
        if (this.piece.y + cy >= 0) this.block(ctx, px, py, this.piece.type.name, ghostY - this.piece.y);
      }
    }
  }

  block(ctx, x, y, name, dim = 0) {
    const outline = PALETTE.darkest;
    const face = dim > 0 ? PALETTE.dark : PALETTE.light;

    ctx.fillStyle = outline;
    ctx.fillRect(x, y, CELL, CELL);
    ctx.fillStyle = face;
    ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
    ctx.fillStyle = outline;
    ctx.fillRect(x + 1, y + 1, CELL - 2, 1);
    ctx.fillRect(x + 1, y + 1, 1, CELL - 2);
    ctx.fillStyle = dim > 0 ? PALETTE.darkest : PALETTE.lightest;
    ctx.fillRect(x + 2, y + 2, 2, 2);
  }

  drawPanel(ctx) {
    const x = PANEL_X;

    this.text(ctx, 'SCORE', x, 6, 'dark', 1);
    this.text(ctx, this.pad(this.score, 6), x, 15, 'darkest', 1);

    this.text(ctx, 'LEVEL', x, 30, 'dark', 1);
    this.text(ctx, this.pad(this.level, 2), x, 39, 'darkest', 1);

    this.text(ctx, 'LINES', x, 54, 'dark', 1);
    this.text(ctx, this.pad(this.lines, 3), x, 63, 'darkest', 1);

    this.text(ctx, 'HOLD', x, 84, 'dark', 1);

    // hold slot
    ctx.strokeStyle = PALETTE.dark;
    ctx.strokeRect(x - 1.5, 90.5, 29, 17);
    if (this.hold) this.miniBlock(ctx, x + 1, 92, this.hold);

    // next slot
    this.text(ctx, 'NEXT', x, 113, 'dark', 1);
    const upcoming = this.peekNext();
    ctx.strokeStyle = PALETTE.dark;
    ctx.strokeRect(x - 1.5, 119.5, 29, 22);
    if (upcoming) this.miniBlock(ctx, x + 4, 123, upcoming);
  }

  miniBlock(ctx, x, y, name) {
    const type = PIECES.find((p) => p.name === name);
    if (!type) return;
    const cells = type.states[0];
    const xs = cells.map((c) => c[0]);
    const ys = cells.map((c) => c[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) + 1;
    const scale = Math.max(2, Math.floor(20 / (span * 3 + 1)));
    const ox = x + (24 - (Math.max(...xs) - minX + 1) * scale * 3) / 2;
    const oy = y + (17 - (Math.max(...ys) - minY + 1) * scale * 3) / 2;
    for (const [cx, cy] of cells) {
      this.block(ctx, ox + (cx - minX) * scale * 3, oy + (cy - minY) * scale * 3, name);
    }
  }

  /* ------------------------------ primitives --------------------------- */

  box(ctx, x, y, w, h) {
    ctx.fillStyle = PALETTE.darkest;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = PALETTE.lightest;
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  }

  text(ctx, str, x, y, color = 'darkest', scale = 1, align = 'left') {
    ctx.fillStyle = PALETTE[color];
    const width = str.length * 6 * scale - scale;
    let cx = align === 'center' ? Math.round(x - width / 2) : x;
    for (const ch of str.toUpperCase()) {
      const glyph = FONT[ch] || FONT[' '];
      const rows = glyph.split('|');
      for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < rows[r].length; c++) {
          if (rows[r][c] === '#') ctx.fillRect(cx + c * scale, y + r * scale, scale, scale);
        }
      }
      cx += 6 * scale;
    }
  }

  pad(n, len = 6) {
    return String(Math.max(0, Math.round(n))).padStart(len, '0');
  }

  /**
   * Two cheap tricks that sell the LCD: a dot matrix over every logical
   * pixel, and a slow refresh band that ghosts across the glass. The matrix is
   * a repeating pattern — one fill instead of 23k tiny rects per frame.
   */
  drawLcdFx(ctx) {
    if (!this.dotPattern) {
      const tile = document.createElement('canvas');
      tile.width = 1;
      tile.height = 1;
      const g = tile.getContext('2d');
      g.fillStyle = 'rgba(15,56,15,0.13)';
      g.fillRect(0, 0, 1, 1);
      this.dotPattern = ctx.createPattern(tile, 'repeat');
    }
    ctx.fillStyle = this.dotPattern;
    ctx.fillRect(0, 0, W, H);

    const bandY = this.sweep - 15;
    const grad = ctx.createLinearGradient(0, bandY, 0, bandY + 30);
    grad.addColorStop(0, 'rgba(240,255,200,0)');
    grad.addColorStop(0.5, 'rgba(240,255,200,0.10)');
    grad.addColorStop(1, 'rgba(240,255,200,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, bandY, W, 30);

    ctx.fillStyle = `rgba(15,56,15,${0.05 + this.flash * 0.12})`;
    ctx.fillRect(0, 0, W, H);
  }
}