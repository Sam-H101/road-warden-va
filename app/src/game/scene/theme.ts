// Road color themes per weather. Bright and toy-like on clear days.
import type { Weather } from '../../engine/types'

export interface RoadTheme {
  skyTop: string
  skyBottom: string
  hillsFar: number
  hillsNear: number
  grassA: number
  grassB: number
  road: number
  roadB: number
  rumbleA: number
  rumbleB: number
  line: number
  post: number
  haze: number
}

export const THEMES: Record<Weather, RoadTheme> = {
  clear: {
    skyTop: '#1d4ed8',
    skyBottom: '#9bd4ff',
    hillsFar: 0x6d9fd6,
    hillsNear: 0x2f7d46,
    grassA: 0x44a84f,
    grassB: 0x3b9646,
    road: 0x474d5a,
    roadB: 0x4d5361,
    rumbleA: 0xe11d48,
    rumbleB: 0xf8fafc,
    line: 0xf8fafc,
    post: 0xf8fafc,
    haze: 0xbfe3ff,
  },
  rain: {
    skyTop: '#273244',
    skyBottom: '#6b7a90',
    hillsFar: 0x4b5a6e,
    hillsNear: 0x2b5236,
    grassA: 0x2f6e3a,
    grassB: 0x2a6334,
    road: 0x30353e,
    roadB: 0x353a44,
    rumbleA: 0xb4183c,
    rumbleB: 0xcbd5e1,
    line: 0xe2e8f0,
    post: 0xe2e8f0,
    haze: 0x7b8796,
  },
  fog: {
    skyTop: '#9aa7b8',
    skyBottom: '#d7dee7',
    hillsFar: 0xc3ccd7,
    hillsNear: 0x9fb2a5,
    grassA: 0x6f9479,
    grassB: 0x688b72,
    road: 0x5a616c,
    roadB: 0x5f6672,
    rumbleA: 0xc0485f,
    rumbleB: 0xe5e9ee,
    line: 0xf1f5f9,
    post: 0xf1f5f9,
    haze: 0xd5dde6,
  },
  night: {
    skyTop: '#020617',
    skyBottom: '#1e1b4b',
    hillsFar: 0x1a1d3d,
    hillsNear: 0x0f2416,
    grassA: 0x173a1f,
    grassB: 0x14331b,
    road: 0x22262e,
    roadB: 0x262a33,
    rumbleA: 0x9f1239,
    rumbleB: 0xcbd5e1,
    line: 0xe2e8f0,
    post: 0xfde68a,
    haze: 0x1e1b4b,
  },
  snow: {
    skyTop: '#64748b',
    skyBottom: '#e2e8f0',
    hillsFar: 0xcbd5e1,
    hillsNear: 0xe2e8f0,
    grassA: 0xeef3f8,
    grassB: 0xdfe7ef,
    road: 0x4b5563,
    roadB: 0x525c6b,
    rumbleA: 0xe11d48,
    rumbleB: 0xf8fafc,
    line: 0xf8fafc,
    post: 0x334155,
    haze: 0xe2e8f0,
  },
}
