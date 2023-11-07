export const chatAlphabet = "!bpmwjqxynzDsrHNldtgkh45vF7BcfuaoeEAYL62T83V1i"

export function getShidinnLetter(i: number, cas: number) {
  return String.fromCharCode(0xe020 + i + ((i >> 4) << 5) + (cas << 4))
}

export function shidinnLetterFromChat(chat: string, cas: number, altgr?: false | "try"): string
export function shidinnLetterFromChat(chat: string, cas: number, altgr: true): string | undefined
export function shidinnLetterFromChat(chat: string, cas: number, altgr?: boolean | "try") {
  let i = -1
  if (typeof altgr === "boolean" || altgr === "try") {
    const upper = chat === "1" ? "!" : chat.toUpperCase()
    const lower = chat.toLowerCase()
    if (altgr && upper !== lower) i = chatAlphabet.indexOf(upper)
    if (i === -1 && altgr !== true) i = chatAlphabet.indexOf(lower)
  } else {
    i = chatAlphabet.indexOf(chat)
  }
  if (i === -1) return
  return getShidinnLetter(i, cas)
}
