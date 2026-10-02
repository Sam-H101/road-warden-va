// A tiny typed event bus. One instance per run, so nothing leaks between runs.
import type { BusEvents } from './protocol'

type Handler<T> = (payload: T) => void

export class Bus<E extends object> {
  private handlers = new Map<keyof E, Set<Handler<never>>>()

  on<K extends keyof E>(name: K, fn: Handler<E[K]>): () => void {
    let set = this.handlers.get(name)
    if (!set) {
      set = new Set()
      this.handlers.set(name, set)
    }
    set.add(fn as Handler<never>)
    return () => {
      set.delete(fn as Handler<never>)
    }
  }

  emit<K extends keyof E>(name: K, payload: E[K]): void {
    const set = this.handlers.get(name)
    if (!set) return
    for (const fn of [...set]) {
      try {
        ;(fn as Handler<E[K]>)(payload)
      } catch (err) {
        console.error('[bus]', String(name), err)
      }
    }
  }

  clear(): void {
    this.handlers.clear()
  }
}

export type GameBus = Bus<BusEvents>

export function createBus(): GameBus {
  return new Bus<BusEvents>()
}
