export * from "./alphabet"

/** Asserts that value is not nullish and returns it. */
export function nn<T>(value: T, desc: string) {
  if (value === undefined || value === null)
    throw new TypeError(`${desc} appears to be ${value}`)
  return value
}

/** Asserts that value is not nullish and returns it. */
export function nnm<T>(value: T, msg: string) {
  if (value === undefined || value === null) throw new TypeError(msg)
  return value
}

export class EventEmitter<M extends Record<string | symbol, unknown>> {
  private readonly _eventListeners: {
    type: keyof M
    handler: (event: unknown) => void
  }[] = []
  on<T extends keyof M>(type: T, handler: (event: M[T]) => void) {
    this._eventListeners.push({
      type,
      handler: handler as (event: unknown) => void,
    })
  }
  emit<T extends { [T in keyof M]: M[T] extends {} ? never : T }[keyof M] & {}>(
    type: T
  ): void
  emit<T extends keyof M>(type: T, event: M[T]): void
  emit<T extends keyof M>(type: T, event?: M[T]) {
    for (const listener of this._eventListeners) {
      if (listener.type === type) listener.handler.call(this, event)
    }
  }
  dispose() {
    this._eventListeners.length = 0
  }
}

export class DocumentEventListenerRegister {
  constructor(public readonly $doc: Document) {}

  public readonly docEventListeners: [
    type: string,
    listener: (this: Document, ev: unknown) => unknown,
    options?: boolean | AddEventListenerOptions
  ][] = []
  addEventListener<K extends keyof DocumentEventMap>(
    type: K,
    listener: (this: Document, ev: DocumentEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions
  ) {
    this.docEventListeners.push([
      type,
      listener as (this: Document, ev: unknown) => unknown,
      options,
    ])
    this.$doc.addEventListener(type, listener, options)
  }

  removeAllEventListeners() {
    for (const args of this.docEventListeners) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.$doc.removeEventListener(...(args as [any, any]))
    }
    this.docEventListeners.length = 0
  }
}

export function isPointInRect(
  rect: { left: number; top: number; right: number; bottom: number },
  x: number,
  y: number
) {
  return x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom
}
