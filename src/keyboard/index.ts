import {
  isPointInRect,
  nn,
  nnm,
  EventEmitter,
  shidinnLetterFromChat,
  DocumentEventListenerRegister,
} from "../utils"

import html from "./dom.html"
import css from "./style.css"

const minVisualFeedbackDur = 100
const altgrMaxDX = 20
const altgrMinDY = 30
const halfPi = Math.PI / 2
const altgrDownMaxYOffset = 50
const altgrUpMaxYOffset = 150
const tapMaxDur = 150
const consecTapMaxInterv = 250
const bkspRepeatDelay = 500
const bkspRepeatInterv = 100

/**
 * Struct specifying the glyphs that a certain printable key may print under a certain layout.
 */
interface KeyDefinition {
  default: string
  altgr?: string //| string[]
  toggleSymbol?: true
}

function getLtrLayouts() {
  const lettersCA = [
    [..."12345678"],
    [..."qwertyuiop"],
    [..."asdfghjkl"],
    [..."zxcvbnm"],
  ]
  const layoutCases = [1, 0, 2]
  const layouts: KeyDefinition[][][] = layoutCases.map(() =>
    lettersCA.map(() => [])
  )

  lettersCA.forEach((line, lineIndex) => {
    line.forEach((letr, letrIndex) => {
      layoutCases.forEach((cas, layoutIndex) => {
        const deft = shidinnLetterFromChat(letr, cas)
        const altgr = shidinnLetterFromChat(letr, cas, true)

        const def: KeyDefinition = { default: deft }
        if (altgr) def.altgr = altgr
        layouts[layoutIndex][lineIndex][letrIndex] = def
      })
    })
  })

  return layouts
}

function _makeLayout(
  def: ArrayLike<
    string | { default: string; altgr?: string; toggleSymbol?: boolean }
  >[]
) {
  return def.map(l =>
    Array.from(l, c =>
      typeof c === "string" ? { default: c[0], altgr: c[1] } : c
    )
  ) as KeyDefinition[][]
}

const symbolLayout = _makeLayout([
  [..."123456789", "0°"],
  ["-—", "/÷", ...":;()", "$¥", ...'&@"'],
  [],
  [...".,?!", { default: "'", toggleSymbol: true }],
])
const symbolShiftLayout = _makeLayout([
  ["[\u27e6", "]\u27e7", ..."{}#%^", "*×", "+−", "="],
  [..."_\\|~<>", "\xab\u2039", "\xbb\u203a", "\u2662", "·`"],
  [],
  [...".,?!", { default: "'", toggleSymbol: true }],
])

function _isHTMLOrSVGElement(value: unknown): value is HTMLOrSVGElement {
  return value instanceof HTMLElement || value instanceof SVGElement
}

function _querySelector<T extends Element = HTMLElement>(
  parent: ParentNode,
  selectors: string
) {
  return nnm(
    parent.querySelector<T>(selectors),
    `CSS selector '${selectors}' matched nothing`
  )
}

export class Keyboard extends EventEmitter<{
  reset: []
  bkspdown: []
  touchstart: []
  touchout: []
  printablekeytouch: []
  printablekeypress: [key: SlidableKey, altgr: boolean]
  enterpress: []
}> {
  readonly $doc: Document
  readonly $parent: HTMLElement
  readonly $shadow: ShadowRoot
  readonly $style: HTMLStyleElement
  readonly $padding: HTMLElement
  readonly $container: HTMLElement
  readonly $body: HTMLElement

  readonly documentEventListenerRegister: DocumentEventListenerRegister
  readonly printables: PrintableKeyArray
  readonly shift: ShiftKey
  readonly bksp: BkspKey
  readonly enter: EnterKey
  readonly symbol: SymbolKey
  readonly symbolShift: SymbolShiftKey
  readonly layouts: KeyDefinition[][][]
  readonly symbolLayouts: KeyDefinition[][][]
  readonly closeBtn: BarButton

  $targetDoc: Document | null = null

  get disposed() {
    return this._disposed
  }
  private _disposed = false

  constructor(doc?: Document | DocumentEventListenerRegister) {
    super()

    const $doc = doc instanceof Document ? doc : doc ? doc.$doc : document
    this.$doc = $doc
    this.$targetDoc = $doc
    this.documentEventListenerRegister =
      doc && !(doc instanceof Document)
        ? doc
        : new DocumentEventListenerRegister($doc)

    this.$container = $doc.createElement("div")
    this.$container.innerHTML = html
    this.$container.className = "xdi8kbd-wrap"
    this.$container.hidden = true
    this.$container.addEventListener("touchstart", ev => {
      ev.preventDefault()
    })
    this.$container.addEventListener("touchmove", ev => {
      ev.preventDefault()
    })
    this.$container.addEventListener("mousedown", ev => {
      if (ev.button === 0) ev.preventDefault()
    })

    this.$body = _querySelector(this.$container, ".xdi8kbd")
    this.printables = new PrintableKeyArray(this)
    this.shift = new ShiftKey(
      _querySelector(this.$container, ".key-shift"),
      this
    )
    this.bksp = new BkspKey(_querySelector(this.$container, ".key-bksp"), this)
    this.enter = new EnterKey(
      _querySelector(this.$container, ".key-enter"),
      this
    )
    this.symbol = new SymbolKey(
      _querySelector(this.$container, ".key-symbol"),
      this
    )
    this.symbolShift = new SymbolShiftKey(
      _querySelector(this.$container, ".key-symbolshift"),
      this
    )

    this.layouts = getLtrLayouts()
    this.symbolLayouts = [symbolLayout, symbolShiftLayout]

    this.closeBtn = new BarButton(
      _querySelector(this.$container, ".bar-btn-close"),
      this
    )
    this.closeBtn.press = () => {
      const $e = this.$doc?.activeElement
      if (_isHTMLOrSVGElement($e)) $e.blur()
      this.hide()
    }
    this.$parent = document.createElement("xdi8-ime-keyboard")
    document.documentElement.appendChild(this.$parent)

    this.$style = $doc.createElement("style")
    this.$style.textContent = css

    this.$padding = $doc.createElement("div")
    this.$padding.className = "xdi8kbd-pad"

    this.$shadow = this.$parent.attachShadow({ mode: "open" })
    this.$shadow.appendChild(this.$style)
    this.$shadow.appendChild(this.$container)
    // $padding should follow $container for convenience of css
    this.$shadow.appendChild(this.$padding)
    //this.update()
  }

  show() {
    this.$container.hidden = false
    this.emit("reset")
    this.symbols = false
    this.layoutIndex = 0
    this.update()
  }

  hide() {
    this.$container.hidden = true
    this.$padding.style.height = "0"
  }
  /*
  docEventListeners: [
    type: string,
    listener: (this: Document, ev: unknown) => unknown,
    options?: boolean | AddEventListenerOptions
  ][] = []
  delr.register<K extends keyof DocumentEventMap>(
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
*/
  dispose() {
    if (this._disposed) return
    this.$parent.remove()
    this.documentEventListenerRegister.removeAllEventListeners()
    this._disposed = true
    super.dispose()
    Object.freeze(this)
  }

  symbols = false
  layoutIndex = 0

  update() {
    const layouts = this.symbols ? this.symbolLayouts : this.layouts
    const layout = layouts[this.layoutIndex]

    this.printables.update(layout)
    this.$body.dataset.layout = `${this.symbols ? "symbol" : ""}${
      this.layoutIndex
    }`
    this.$padding.style.height = `${
      this.$container.getBoundingClientRect().height
    }px`
  }

  execute(action: string, arg?: string | undefined) {
    this.$targetDoc?.execCommand(action, false, arg)
  }
}

export default Keyboard

export abstract class Key {
  private _pressTime = -Infinity
  private _unpressHandle = 0

  constructor(
    public readonly $wrap: HTMLElement,
    public readonly $body: HTMLElement & { Key?: Key }
  ) {}

  show() {
    this.$wrap.hidden = false
  }
  hide() {
    this.$wrap.hidden = true
  }

  getRect() {
    return this.$wrap.getBoundingClientRect()
  }

  press() {
    this._pressTime = Date.now()
    this.$body.classList.add("pressed")
    clearTimeout(this._unpressHandle)
  }
  unpress(instant?: boolean) {
    const dt = instant ? 0 : this._pressTime + minVisualFeedbackDur - Date.now()
    if (dt > 0)
      setTimeout(() => void this.$body.classList.remove("pressed"), dt)
    else this.$body.classList.remove("pressed")
  }
}

export abstract class DynamicKey extends Key {
  constructor($mark: Element | CharacterData) {
    const $doc = $mark.ownerDocument
    super($doc.createElement("div"), $doc.createElement("button"))

    this.$wrap.className = "key-wrap"
    this.$body.className = "key"
    this.$body.Key = this
    this.$wrap.appendChild(this.$body)
  }
}

export type SlidableKey = Key & { def: KeyDefinition }

/**
 * A key on the virtual keyboard that can be used to input a glyph.
 */
export class PrintableKey extends DynamicKey {
  $label: HTMLElement

  constructor($mark: Element | CharacterData) {
    super($mark)

    this.$body.classList.add("key-printable")
    this.$label = this.$body.ownerDocument.createElement("div")
    this.$label.className = "key-label"
    this.$body.appendChild(this.$label)

    nn($mark.parentNode, "$mark.parentNode").insertBefore(this.$wrap, $mark)
  }

  def: KeyDefinition | null = null
  update(def: KeyDefinition | null) {
    this.def = def
    if (!def) {
      this.hide()
      return
    }
    this.show()
    this.$label.textContent = def.default
  }
}

/** A faux touch identifier for mouse events. */
export const mouse = Symbol("mouse")
export type TouchIdentifier = number | typeof mouse

/**
 * A 2-dimensional array of `PrintableKey`s on the virtual keyboard.
 */
export class PrintableKeyArray {
  $marks: Element[]
  $rows: Element[]
  rows: PrintableKey[][]
  space: SpaceKey
  slidables: SlidableKey[]
  balloon: Balloon
  touchId: TouchIdentifier | null = null
  slid = false
  startY = 0
  altgr = false
  activeKey: SlidableKey | null = null

  constructor(public kbd: Keyboard) {
    this.$marks = [...kbd.$container.querySelectorAll(".key-insertionmark")]
    this.$rows = this.$marks.map($mark =>
      nn($mark.parentElement, "$mark.parentElement")
    )
    this.rows = this.$marks.map(() => [])
    this.space = new SpaceKey(_querySelector(kbd.$container, ".key-space"))
    this.slidables = [this.space]

    this.balloon = new Balloon(_querySelector(kbd.$container, ".balloon"), this)

    kbd.$body.addEventListener(
      "touchstart",
      ev => {
        for (const touch of ev.changedTouches)
          this.down(touch.identifier, touch.clientX, touch.clientY)
        //ev.preventDefault()
      },
      { capture: true, passive: false }
    )
    kbd.$body.addEventListener(
      "touchmove",
      ev => {
        for (const touch of ev.changedTouches)
          this.move(touch.identifier, touch.clientX, touch.clientY)
        //ev.preventDefault()
      },
      { capture: true, passive: false }
    )
    kbd.$body.addEventListener(
      "touchend",
      ev => {
        for (const touch of ev.changedTouches) this.up(touch.identifier)
      },
      { capture: true, passive: false }
    )
    kbd.$body.addEventListener(
      "touchcancel",
      ev => {
        for (const touch of ev.changedTouches) this.cancel(touch.identifier)
      },
      true
    )
    kbd.$body.addEventListener(
      "mousedown",
      ev => {
        if (ev.button !== 0) return
        this.down(mouse, ev.clientX, ev.clientY)
        //ev.preventDefault()
      },
      true
    )
    kbd.documentEventListenerRegister.addEventListener(
      "mousemove",
      ev => {
        if (ev.button !== 0) return
        this.move(mouse, ev.clientX, ev.clientY)
      },
      true
    )
    kbd.documentEventListenerRegister.addEventListener(
      "mouseup",
      ev => {
        if (ev.button !== 0) return
        this.up(mouse)
      },
      true
    )

    kbd.on("bkspdown", () => {
      this.touchId && this.cancel(this.touchId)
    })
    kbd.on("reset", () => {
      this.touchId && this.cancel(this.touchId)
    })
  }

  down(id: TouchIdentifier, x: number, y: number) {
    if (this.touchId) this.up(this.touchId)
    this.touchId = id
    this.slid = false
    this.startY = y
    this.altgr = false
    this.kbd.emit("touchstart")
    return this.move(id, x, y)
  }
  move(id: TouchIdentifier, x: number, y: number) {
    if (id !== this.touchId) return

    const kbRect = this.kbd.$body.getBoundingClientRect()

    let rect: DOMRect | null = null
    if (this.activeKey) {
      rect = this.activeKey.getRect()
      if (
        typeof this.activeKey.def.altgr === "string" &&
        !this.slid &&
        x >= rect.left - altgrMaxDX &&
        x < rect.right + altgrMaxDX
      ) {
        const dy = y - this.startY
        const altgr = Math.abs(dy) > altgrMinDY
        this.altgr = altgr
        let yOffset = 0
        if (altgr) {
          const k = (dy > 0 ? altgrDownMaxYOffset : altgrUpMaxYOffset) / halfPi
          yOffset = Math.atan(dy / k) * k
        }
        this.balloon.update(rect, yOffset)
        return
      }
    }

    if (!isPointInRect(kbRect, x, y)) {
      this.kbd.emit("touchout")
      return this.cancel(id)
    }

    if (rect && isPointInRect(rect, x, y)) return

    const newActiveKey = this.slidables.find(key => {
      if (key === this.activeKey) return
      rect = key.getRect()
      return isPointInRect(rect, x, y)
    })
    if (!newActiveKey) return

    if (this.activeKey) {
      this.activeKey.unpress(true)
      this.slid = true
      this.altgr = false
    }
    newActiveKey.press()
    this.activeKey = newActiveKey
    this.balloon.update()
    this.kbd.emit("printablekeytouch")
  }
  up(id: TouchIdentifier) {
    if (id !== this.touchId) return
    this.touchId = null
    if (this.activeKey) {
      const def = this.activeKey.def
      const char = this.altgr ? def.altgr : def.default
      this.kbd.execute("insertText", char)
      this.kbd.emit("printablekeypress", this.activeKey, this.altgr)

      this.activeKey.unpress()
      this.balloon.hide()
      this.activeKey = null
    }
  }
  cancel(id: TouchIdentifier) {
    if (id !== this.touchId) return
    this.touchId = null
    if (this.activeKey) {
      this.activeKey.unpress(true)
      this.activeKey = null
      this.balloon.hide(true)
    }
  }
  update(layout: KeyDefinition[][]) {
    this.slidables.length = 0
    this.slidables.push(this.space)

    this.rows.forEach((row, rowIndex) => {
      const rowDef = layout[rowIndex]
      while (row.length < rowDef.length)
        row.push(new PrintableKey(this.$marks[rowIndex]))
      if (rowDef.length === 0) this.$rows[rowIndex].classList.add("row-empty")
      else this.$rows[rowIndex].classList.remove("row-empty")
      row.forEach((key, keyIndex) => {
        key.update(rowDef[keyIndex] || null)
        // Non-slidable (i.e. disabled) prinable-keys are not pushed
        if (keyIndex < rowDef.length) this.slidables.push(key as SlidableKey)
      })
    })
  }
}

export class Balloon {
  private _showTime: number = -Infinity
  private _hideHandle = 0

  constructor(
    public readonly $body: HTMLElement,
    public readonly pka: PrintableKeyArray
  ) {}

  shown = false
  show() {
    this.shown = true
    this._showTime = Date.now()
    this.$body.hidden = false
    clearTimeout(this._hideHandle)
  }
  hide(instant?: boolean) {
    this.shown = false
    const dt = instant ? 0 : this._showTime + minVisualFeedbackDur - Date.now()
    if (dt > 0)
      this._hideHandle = setTimeout(() => void (this.$body.hidden = true), dt)
    else this.$body.hidden = true
  }

  update(rect?: DOMRect, yOffset = 0) {
    if (!(this.pka.activeKey instanceof PrintableKey)) {
      this.hide()
      return
    }

    if (!rect) rect = this.pka.activeKey.getRect()
    const def = this.pka.activeKey.def
    const kbRect = this.pka.kbd.$container.getBoundingClientRect()

    this.$body.textContent = this.pka.altgr ? def.altgr || "" : def.default
    this.$body.style.left = `${rect.left + rect.width / 2 - kbRect.left}px`
    this.$body.style.top = `${rect.top - kbRect.top + yOffset}px`
    if (!this.shown) this.show()
  }
}

export abstract class PreconstructedKey extends Key {
  constructor($body: HTMLElement & { Key?: Key }) {
    super(nn($body.parentElement, "$body.parentElement"), $body)
    $body.Key = this
  }
}

export class SpaceKey extends PreconstructedKey {
  def = { default: " " }
}

export abstract class SingletonKey extends PreconstructedKey {
  constructor(
    $body: HTMLElement,
    public readonly kbd: Keyboard
  ) {
    super($body)

    this.$wrap.addEventListener(
      "touchstart",
      ev => {
        //ev.preventDefault()
        if (this.pressed) return
        this.down(ev)
      },
      { passive: false }
    )
    this.$wrap.addEventListener(
      "touchend",
      ev => {
        if (!this.pressed) return
        this.up(ev)
      },
      { passive: false }
    )
    this.$wrap.addEventListener("touchcancel", ev => {
      if (!this.pressed) return
      this.cancel(ev)
    })
    this.$wrap.addEventListener("mousedown", ev => {
      if (ev.button !== 0 || this.pressed) return
      this.down(ev)
      //ev.preventDefault()
    })
    kbd.documentEventListenerRegister.addEventListener("mouseup", ev => {
      if (ev.button !== 0 || !this.pressed) return
      this.up(ev)
      //ev.preventDefault()
    })

    kbd.on("reset", () => {
      this.reset()
    })
  }

  pressed = false

  down(_ev?: TouchEvent | MouseEvent) {
    this.pressed = true
    this.press()
  }
  up(_ev?: TouchEvent | MouseEvent) {
    this.pressed = false
    this.unpress()
  }
  cancel(_ev?: TouchEvent | MouseEvent) {
    this.pressed = false
    this.unpress(true)
  }
  reset() {
    this.pressed = false
    this.unpress(true)
  }
}

export class ShiftKey extends SingletonKey {
  constructor($body: HTMLElement, kbd: Keyboard) {
    super($body, kbd)

    kbd.on("printablekeypress", () => {
      if (kbd.symbols) return
      this.otherKeyPressed = true
      if (this.state !== 3 && !this.pressed) {
        this.state = 0
        this.update()
      }
    })
  }

  state = 0
  pressed = false
  downTime = -Infinity
  upTime = -Infinity
  otherKeyPressed = false
  returning = false

  getState() {
    if (this.returning) return 1
    return this.state
  }

  down(ev: TouchEvent | MouseEvent) {
    this.pressed = true
    this.otherKeyPressed = false

    const time = ev.timeStamp

    if (
      this.state !== 3 &&
      this.upTime - this.downTime <= tapMaxDur &&
      time - this.upTime <= consecTapMaxInterv
    ) {
      this.state = this.state === 2 ? 3 : 2
    } else if (this.state === 0) {
      this.state = 1
    } else {
      this.returning = true
    }

    this.downTime = time
    this.update()
  }
  up(ev: TouchEvent | MouseEvent) {
    this.pressed = false

    const time = ev.timeStamp

    if (this.returning || this.otherKeyPressed) {
      this.returning = false
      this.state = 0
    }

    this.upTime = time
    this.update()
  }
  cancel() {
    this.pressed = false

    this.downTime = -Infinity
    this.update()
  }
  reset() {
    super.reset()
    this.state = 0
    this.downTime = -Infinity
    this.upTime = -Infinity
    this.returning = false
    this.$body.dataset.state = String(0)
  }

  update() {
    const state = this.getState()
    this.$body.dataset.state = String(state)
    this.kbd.layoutIndex = state === 3 ? 1 : state
    this.kbd.update()
  }
}

export class BkspKey extends SingletonKey {
  private tickHandle: number = 0

  constructor($body: HTMLElement, kbd: Keyboard) {
    super($body, kbd)

    kbd.on("touchstart", () => {
      this.cancel()
    })
  }

  tick() {
    this.kbd.execute("delete")
    this.tickHandle = setTimeout(() => this.tick(), bkspRepeatInterv)
  }

  down() {
    super.down()
    this.kbd.emit("bkspdown")
    this.kbd.execute("delete")
    this.tickHandle = setTimeout(() => this.tick(), bkspRepeatDelay)
  }
  up() {
    super.up()
    clearTimeout(this.tickHandle)
  }
  cancel() {
    super.cancel()
    clearTimeout(this.tickHandle)
  }
}

export class EnterKey extends SingletonKey {
  constructor($body: HTMLElement, kbd: Keyboard) {
    super($body, kbd)

    kbd.on("touchout", () => {
      this.cancel()
    })
    kbd.on("printablekeytouch", () => {
      this.cancel()
    })
  }

  up() {
    super.up()
    this.kbd.execute("insertText", "\n")
    this.kbd.emit("enterpress")
  }
}

export abstract class BaseSymbolKey extends SingletonKey {
  readonly $label: HTMLElement

  constructor(
    $body: HTMLElement,
    kbd: Keyboard,
    readonly offText: string,
    readonly onText: string
  ) {
    super($body, kbd)

    this.$label = _querySelector(this.$body, ".key-label")
    this.$label.textContent = this.offText
  }

  down() {
    this.toggle()
  }
  up() {}
  cancel() {}
  reset() {
    this.$label.textContent = this.offText
  }

  abstract toggle(): void
}

export class SymbolKey extends BaseSymbolKey {
  constructor($body: HTMLElement, kbd: Keyboard) {
    super($body, kbd, "", "")

    kbd.on("printablekeypress", key => {
      if (!this.kbd.symbols) return
      if (
        key.def?.toggleSymbol ||
        (key instanceof SpaceKey && this.otherKeyPressed)
      )
        this.toggle()
      else this.otherKeyPressed = true
    })
    kbd.on("enterpress", () => {
      if (this.kbd.symbols && this.otherKeyPressed) this.toggle()
    })
  }

  otherKeyPressed = false

  down() {
    this.otherKeyPressed = false
    super.down()
  }
  reset() {
    this.kbd.symbolShift.hide()
    this.kbd.shift.show()
    super.reset()
  }

  toggle() {
    this.kbd.symbols = !this.kbd.symbols
    this.kbd.layoutIndex = 0
    this.kbd.emit("reset")
    if (this.kbd.symbols) {
      this.kbd.shift.hide()
      this.kbd.symbolShift.show()
      this.$label.textContent = this.onText
    }
    this.kbd.update()
  }
}

export class SymbolShiftKey extends BaseSymbolKey {
  constructor($body: HTMLElement, kbd: Keyboard) {
    super($body, kbd, "#+=", "123")
  }

  toggle() {
    this.kbd.layoutIndex = +!this.kbd.layoutIndex
    this.kbd.update()
    this.$label.textContent = this.kbd.layoutIndex ? this.onText : this.offText
  }
}

export class BarButton {
  pressed = false
  constructor(
    public $body: HTMLElement,
    public kbd: Keyboard
  ) {
    $body.addEventListener("touchstart", () => {
      this.pressed = true
    })
    $body.addEventListener("touchend", () => {
      if (this.pressed) this.press()
      this.pressed = false
    })
    $body.addEventListener("mousedown", ev => {
      if (ev.button !== 0) return
      this.pressed = true
    })
    $body.addEventListener("mouseup", ev => {
      if (ev.button !== 0) return
      if (this.pressed) this.press()
      this.pressed = false
    })
    kbd.documentEventListenerRegister.addEventListener("mouseup", ev => {
      if (ev.button !== 0) return
      this.pressed = false
    })
  }

  press() {}
}
