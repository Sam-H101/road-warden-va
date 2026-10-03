// Dev-only page (?artsheet=1): every procedural texture in one labeled grid,
// rendered at full height so a page screenshot captures the whole sheet.
import Phaser from 'phaser'
import { renderArtSheet } from './preview'

export function mountArtSheet(parent: HTMLElement): void {
  document.title = 'Road Warden art sheet'
  document.body.style.background = '#0b1020'
  const width = Math.max(320, Math.min(parent.clientWidth || window.innerWidth, 1600))

  class SheetScene extends Phaser.Scene {
    constructor() {
      super('art-sheet')
    }
    create() {
      const sheet = renderArtSheet(this, { width })
      const h = Math.max(window.innerHeight, Math.ceil(sheet.height))
      this.scale.resize(width, h)
      this.cameras.main.setSize(width, h)
      document.body.dataset.artsheet = 'ready'
    }
  }

  new Phaser.Game({
    type: Phaser.CANVAS,
    parent,
    width,
    height: window.innerHeight,
    backgroundColor: '#0b1020',
    banner: false,
    audio: { noAudio: true },
    scale: { mode: Phaser.Scale.NONE },
    scene: [SheetScene],
  })
}
