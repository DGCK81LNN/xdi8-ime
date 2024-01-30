import { Keyboard } from "../src/keyboard"

var kbd = window.kbd = new Keyboard(document)

const textarea = document.getElementById("textarea")
let working = false

function supportsInputModeNone() {
  return "inputMode" in textarea && !isSafari12OrBelow()
}

function isSafari12OrBelow() {
  if (!navigator.userAgent.match("Safari")) return false
  if (navigator.userAgent.match("Chrome")) return false
  const m = navigator.userAgent.match(/Version\/(\d+)/)
  return !!m && parseInt(m[1]) < 13
}

if (supportsInputModeNone) {
  textarea.onfocus = function () {
    kbd.show()
  }
} else {
  textarea.onfocus = textarea.onclick = function () {
    if (this.readOnly) return
    working = true
    this.blur()
    this.readOnly = true
    this.focus()
    setTimeout(() => {
      this.readOnly = false
      kbd.show()
      this.scrollIntoView({ behavior: "smooth" })
      working = false
    }, 0)
  }
}

textarea.onblur = function () {
  if (working) return
  kbd.hide()
}
