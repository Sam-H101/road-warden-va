// Pseudo-3D projection. Depth z: 1 = at the player, larger = farther away.
// screen y = horizonY + (baseY - horizonY) / z, scale = 1 / z.
// World x is measured in lanes: lane centers at -1, 0, +1, road edges at +-1.5.

export const Z_FAR = 40 // events spawn here
export const Z_DRAW = 60 // road and scenery are drawn out to here

export class Projection {
  W = 1
  H = 1
  dpr = 1
  horizonY = 0
  baseY = 0
  /** Lane width in px at z = 1. */
  laneW = 1
  /** Depth at the bottom edge of the screen. */
  zNear = 0.8
  /** Camera x in lanes (follows the car part of the way for a parallax feel). */
  camLane = 0
  /** Road curvature, in lanes of horizon shift / 3. */
  curve = 0

  resize(W: number, H: number, dpr: number): void {
    this.W = Math.max(1, W)
    this.H = Math.max(1, H)
    this.dpr = dpr
    // Tall phone screens: lift the car above the thumb controls.
    const portrait = this.H / this.W > 1.25
    this.horizonY = Math.round(this.H * (portrait ? 0.37 : 0.35))
    this.baseY = Math.round(this.H * (portrait ? 0.815 : 0.86))
    const unit = Math.min(this.W, this.H * 0.95)
    this.laneW = unit * 0.33
    this.zNear = (this.baseY - this.horizonY) / (this.H - this.horizonY)
  }

  yOf(z: number): number {
    return this.horizonY + (this.baseY - this.horizonY) / Math.max(0.05, z)
  }

  zOfY(y: number): number {
    return (this.baseY - this.horizonY) / Math.max(0.0001, y - this.horizonY)
  }

  curveOff(z: number): number {
    if (z <= 1 || this.curve === 0) return 0
    const k = 1 - 1 / z
    return this.curve * this.laneW * 3 * k * k
  }

  xOf(lanes: number, z: number): number {
    return this.W / 2 + ((lanes - this.camLane) * this.laneW) / Math.max(0.05, z) + this.curveOff(z)
  }

  /** Pixels per lane at depth z. */
  lanePx(z: number): number {
    return this.laneW / Math.max(0.05, z)
  }

  /** Vanishing point x. */
  get vpX(): number {
    return this.W / 2 + this.curve * this.laneW * 3
  }
}
