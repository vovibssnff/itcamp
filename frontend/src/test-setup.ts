import '@testing-library/jest-dom'

// Node 22+ may expose a broken experimental `localStorage` global that
// overrides jsdom's implementation (zustand persist then crashes on setItem).
// Always install a working in-memory store for unit tests.
const memory = new Map<string, string>()
const localStorageMock: Storage = {
  get length() {
    return memory.size
  },
  clear() {
    memory.clear()
  },
  getItem(key: string) {
    return memory.has(key) ? (memory.get(key) ?? null) : null
  },
  key(index: number) {
    return [...memory.keys()][index] ?? null
  },
  removeItem(key: string) {
    memory.delete(key)
  },
  setItem(key: string, value: string) {
    memory.set(key, String(value))
  },
}

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
})
