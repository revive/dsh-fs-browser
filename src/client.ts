/**
 * dsh-fs-browser client entry (TS source → built by tsdown into
 * lib/client.js as a ModuleLoader bundle).
 *
 * Syntax highlighting: shiki core (synchronous JS-regex engine, CSS-variables
 * theme) bundled at build time — the same engine and `--shiki-*` theme tokens
 * the product's read cards use. The lightweight tokenizer below remains as a
 * zero-cost fallback when shiki has no grammar or throws.
 */
import * as React from 'react'
import {
  createHighlighterCoreSync,
  createCssVariablesTheme,
  type HighlighterCore,
} from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import langTs from '@shikijs/langs/typescript'
import langBash from '@shikijs/langs/shellscript'
import langJson from '@shikijs/langs/json'
import langPy from '@shikijs/langs/python'
import langYaml from '@shikijs/langs/yaml'
import langSql from '@shikijs/langs/sql'
import langC from '@shikijs/langs/c'
import langCpp from '@shikijs/langs/cpp'
import langJava from '@shikijs/langs/java'
import langGo from '@shikijs/langs/go'
import langRust from '@shikijs/langs/rust'
import langCss from '@shikijs/langs/css'
import langHtml from '@shikijs/langs/html'
import langMarkdown from '@shikijs/langs/markdown'
import langRuby from '@shikijs/langs/ruby'
import langPhp from '@shikijs/langs/php'
import langToml from '@shikijs/langs/toml'
import langIni from '@shikijs/langs/ini'
import langPerl from '@shikijs/langs/perl'
import langLua from '@shikijs/langs/lua'
import langElisp from '@shikijs/langs/elisp'
import langHaskell from '@shikijs/langs/haskell'
import langJulia from '@shikijs/langs/julia'

// ---------------------------------------------------------------- shiki core
let highlighter: HighlighterCore | undefined
try {
  highlighter = createHighlighterCoreSync({
    themes: [createCssVariablesTheme()],
    langs: [
      langTs, langBash, langJson, langPy, langYaml, langSql, langC, langCpp,
      langJava, langGo, langRust, langCss, langHtml, langMarkdown, langRuby,
      langPhp, langToml, langIni, langPerl, langLua, langElisp, langHaskell,
      langJulia,
    ],
    engine: createJavaScriptRegexEngine(),
  })
} catch (err) {
  highlighter = undefined
}

/** Map our extension-based language id to a shiki grammar id, or null. */
function shikiLangId(lang: string | null): string | null {
  if (lang === null) return null
  const table: Record<string, string> = {
    js: 'ts', mjs: 'ts', cjs: 'ts', jsx: 'ts', ts: 'ts', mts: 'ts', tsx: 'ts',
    json: 'json', py: 'python', sh: 'bash', bash: 'bash', yml: 'yaml',
    yaml: 'yaml', sql: 'sql', c: 'c', h: 'c', cc: 'cpp', cpp: 'cpp', hpp: 'cpp',
    cs: 'csharp', java: 'java', go: 'go', rs: 'rust', php: 'php', css: 'css',
    html: 'html', htm: 'html', xml: 'xml', svg: 'xml', md: 'markdown',
    markdown: 'markdown', ruby: 'ruby', rb: 'ruby', toml: 'toml', ini: 'ini',
    pl: 'perl', pm: 'perl', perl: 'perl', lua: 'lua', el: 'elisp', elisp: 'elisp',
    lisp: 'elisp', hs: 'haskell', haskell: 'haskell', jl: 'julia', julia: 'julia',
  }
  return table[lang] ?? null
}

/** shiki HTML → per-line inner HTML, parsed with a throwaway DOM node. */
function shikiLines(html: string): string[] {
  const wrap = document.createElement('div')
  wrap.innerHTML = html
  const out: string[] = []
  wrap.querySelectorAll('.line').forEach((el) => {
    out.push((el as HTMLElement).innerHTML)
  })
  return out
}

function shikiHighlight(code: string, lang: string | null): string | null {
  const id = shikiLangId(lang)
  if (highlighter === undefined || id === null) return null
  try {
    return highlighter.codeToHtml(code, { lang: id, theme: 'css-variables' })
  } catch (err) {
    return null
  }
}

// -------------------------------------------------------- lightweight fallback
const JS_KEYS = new Set(('break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new of return static super switch this throw try typeof var void while with yield async await null true false undefined NaN Infinity').split(' '))
const C_KEYS = new Set(('auto break case char const continue default do double else enum extern float for goto if int long register return short signed sizeof static struct switch typedef union unsigned void volatile while true false null string bool class namespace public private protected using new delete template typename this throw try catch finally virtual override friend constexpr auto').split(' '))
const PY_KEYS = new Set(('and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield None True False').split(' '))
const SH_KEYS = new Set(('if then else elif fi for while do done case esac function in select time export local readonly unset set shift source eval exec exit return true false').split(' '))
const SQL_KEYS = new Set(('select from where insert into values update set delete create table index view alter add drop primary key foreign references join inner left right outer on group by order having limit offset as and or not null true false between like in exists distinct count sum avg min max union all case when then end').split(' '))
const YAML_KEYS = new Set(('true false null yes no on off').split(' '))
const JSON_KEYS = new Set(('true false null').split(' '))
const QUOTES_JS = ["'", '"', '`']
const QUOTES_C = ["'", '"']

interface TokSpec {
  kw: Set<string> | null
  line: string | null
  block: [string, string] | null
  quotes: string[]
}

function fallbackSpec(lang: string | null): TokSpec {
  if (lang === 'js' || lang === 'ts') return { kw: JS_KEYS, line: '//', block: ['/*', '*/'], quotes: QUOTES_JS }
  if (lang === 'json') return { kw: JSON_KEYS, line: null, block: null, quotes: ['"'] }
  if (lang === 'py') return { kw: PY_KEYS, line: '#', block: null, quotes: QUOTES_C }
  if (lang === 'sh' || lang === 'bash') return { kw: SH_KEYS, line: '#', block: null, quotes: QUOTES_C }
  if (lang === 'yml' || lang === 'yaml') return { kw: YAML_KEYS, line: '#', block: null, quotes: QUOTES_C }
  if (lang === 'sql') return { kw: SQL_KEYS, line: '--', block: ['/*', '*/'], quotes: ["'"] }
  if (lang === 'css') return { kw: null, line: null, block: ['/*', '*/'], quotes: QUOTES_C }
  if (lang === 'html' || lang === 'xml' || lang === 'svg') return { kw: null, line: null, block: ['<!--', '-->'], quotes: ['"', "'"] }
  if (lang === 'ini') return { kw: null, line: ';', block: null, quotes: QUOTES_C }
  if (lang === 'toml') return { kw: null, line: '#', block: null, quotes: QUOTES_C }
  if (lang === 'pl' || lang === 'pm') return { kw: null, line: '#', block: null, quotes: QUOTES_C }
  if (lang === 'lua') return { kw: null, line: '--', block: ['--[[', ']]'], quotes: QUOTES_C }
  if (lang === 'el' || lang === 'elisp' || lang === 'lisp') return { kw: null, line: ';', block: null, quotes: QUOTES_C }
  if (lang === 'hs' || lang === 'haskell') return { kw: null, line: '--', block: ['{-', '-}'], quotes: QUOTES_C }
  if (lang === 'jl' || lang === 'julia') return { kw: null, line: '#', block: null, quotes: QUOTES_C }
  if (lang === 'c') return { kw: C_KEYS, line: '//', block: ['/*', '*/'], quotes: QUOTES_C }
  return { kw: null, line: '#', block: null, quotes: QUOTES_C }
}

interface Tok { t: string; s: string }

function tokenizeLine(line: string, spec: TokSpec, inBlock: boolean): { out: Tok[]; inBlock: boolean } {
  const out: Tok[] = []
  const L = line.length
  const lineCmt = spec.line
  const block = spec.block
  const quotes = spec.quotes
  const kwSet = spec.kw
  let i = 0
  let guard = 0
  while (i < L) {
    guard++
    if (guard > L + 4) break
    if (block !== null && inBlock) {
      const close = line.indexOf(block[1], i)
      if (close === -1) { out.push({ t: 'cmt', s: line.slice(i) }); return { out, inBlock: true } }
      out.push({ t: 'cmt', s: line.slice(i, close + block[1].length) })
      i = close + block[1].length
      inBlock = false
      continue
    }
    if (lineCmt !== null && line.startsWith(lineCmt, i)) {
      out.push({ t: 'cmt', s: line.slice(i) })
      break
    }
    if (block !== null && line.startsWith(block[0], i)) {
      const close = line.indexOf(block[1], i + block[0].length)
      if (close === -1) { out.push({ t: 'cmt', s: line.slice(i) }); return { out, inBlock: true } }
      out.push({ t: 'cmt', s: line.slice(i, close + block[1].length) })
      i = close + block[1].length
      continue
    }
    let matched = false
    for (const q of quotes) {
      if (line[i] === q) {
        let j = i + 1
        let esc = false
        let end = L
        while (j < L) {
          if (line[j] === '\\' && !esc) { esc = true } else if (line[j] === q && !esc) { end = j + 1; break } else { esc = false }
          j++
        }
        out.push({ t: 'str', s: line.slice(i, end) })
        i = end
        matched = true
        break
      }
    }
    if (matched) continue
    if (/[0-9]/.test(line[i]) || (line[i] === '-' && i + 1 < L && /[0-9]/.test(line[i + 1]))) {
      let j = i
      if (line[i] === '-') j = i + 1
      while (j < L && /[\d._a-zA-Z]/.test(line[j])) j++
      out.push({ t: 'num', s: line.slice(i, j) })
      i = j
      continue
    }
    if (/[A-Za-z_$]/.test(line[i])) {
      let j = i
      while (j < L && /[\w$]/.test(line[j])) j++
      const w = line.slice(i, j)
      out.push(kwSet !== null && kwSet.has(w) ? { t: 'kw', s: w } : { t: 'plain', s: w })
      i = j
      continue
    }
    let j = i
    while (j < L
      && !/[A-Za-z_$\d]/.test(line[j])
      && !(lineCmt !== null && line.startsWith(lineCmt, j))
      && !(block !== null && line.startsWith(block[0], j))
      && quotes.indexOf(line[j]) === -1) {
      j++
    }
    if (j === i) { out.push({ t: 'plain', s: line[i] }); i++ } else { out.push({ t: 'plain', s: line.slice(i, j) }); i = j }
  }
  return { out, inBlock }
}

// ---------------------------------------------------------------- plugin state
export const inject = ['slots', 'layout']

let worxOpen = false
let worxDir: string | null = null
const worxListeners = new Set<() => void>()
function setWorxOpen(open: boolean): void {
  if (worxOpen === open) return
  worxOpen = open
  for (const fn of worxListeners) fn()
}
function useWorxOpen(): boolean {
  const [open, setOpen] = React.useState(worxOpen)
  React.useEffect(() => {
    const notify = () => setOpen(worxOpen)
    worxListeners.add(notify)
    return () => { worxListeners.delete(notify) }
  }, [])
  return open
}
function saveWorxState(call: CallFn, root: string | null): void {
  if (!root || !worxDir) return
  call('state', { action: 'set', root, dir: worxDir, expanded: worxOpen }).catch(() => {})
}
let lastSid: string | null = null

type CallFn = (op: string, args: Record<string, unknown>) => Promise<any>

function call(op: string, args: Record<string, unknown>): Promise<any> {
  return fetch('/worx-api', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ op, args: args || {} }),
  }).then(async (r) => {
    let body: any = null
    try { body = await r.json() } catch (e) { body = null }
    if (!r.ok) throw new Error(body && body.error ? body.error : 'worx-api ' + r.status)
    return body
  })
}

function deriveRoot(sessionsState: any, wsItems: any[], sessionId: string): string | null {
  let chosenPath: string | null = null
  if (sessionsState && sessionsState.current && sessionsState.byId) {
    const cur = sessionsState.byId[sessionsState.current]
    if (cur && typeof cur.cwd === 'string' && cur.cwd) chosenPath = cur.cwd
  }
  if (chosenPath === null && sessionId && sessionsState && sessionsState.byId) {
    const cur = sessionsState.byId[sessionId]
    if (cur && typeof cur.cwd === 'string' && cur.cwd) chosenPath = cur.cwd
  }
  if (chosenPath === null && Array.isArray(wsItems)) {
    const target = sessionId || (sessionsState ? sessionsState.current : undefined)
    for (const w of wsItems) {
      if (target && Array.isArray(w.sessionIds) && w.sessionIds.indexOf(target) !== -1) { chosenPath = w.path; break }
    }
    if (chosenPath === null && wsItems.length > 0 && typeof wsItems[0].path === 'string') chosenPath = wsItems[0].path
  }
  return chosenPath
}

// ------------------------------------------------------------- shared helpers
function fmtSize(n: number | null | undefined): string {
  if (n === null || n === undefined) return ''
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / (1024 * 1024)).toFixed(1) + ' MB'
}
function joinPath(base: string, name: string): string {
  return base.endsWith('/') ? base + name : base + '/' + name
}
function parentPath(p: string): string {
  const i = p.lastIndexOf('/')
  return i <= 0 ? '/' : p.slice(0, i)
}

// ---------------------------------------------------------------- components
function TextPreview(props: { text: string; lang: string | null }): React.ReactElement {
  const html = React.useMemo(() => shikiHighlight(props.text, props.lang), [props.text, props.lang])
  if (html !== null) {
    let lineHtml: string[] = []
    try { lineHtml = shikiLines(html) } catch (err) { lineHtml = [] }
    const rows = lineHtml.map((inner, i) =>
      h('div', { key: i, className: 'worx-line' },
        h('span', { className: 'worx-ln' }, String(i + 1)),
        h('code', { className: 'worx-code' }, h('span', { dangerouslySetInnerHTML: { __html: inner } })),
      ))
    return h('div', { className: 'worx-body-pre' }, rows)
  }
  // fallback: lightweight tokenizer (never throws, YAML-hang guarded)
  const spec = fallbackSpec(props.lang)
  const lines = props.text.split('\n')
  const rows: React.ReactElement[] = []
  let inBlock = false
  for (let i = 0; i < lines.length; i++) {
    const res = tokenizeLine(lines[i], spec, inBlock)
    inBlock = res.inBlock
    rows.push(h('div', { key: i, className: 'worx-line' },
      h('span', { className: 'worx-ln' }, String(i + 1)),
      h('code', { className: 'worx-code' }, ...res.out.map((t, idx) =>
        t.t === 'plain' ? (t.s as unknown) : h('span', { key: idx, className: 'worx-tok-' + t.t }, t.s),
      )),
    ))
  }
  return h('div', { className: 'worx-body-pre' }, rows)
}

function ImagePreview(props: { name: string; routeUrl: string; dataUrl: string | null; size: number | null }): React.ReactElement {
  const [src, setSrc] = React.useState(props.routeUrl)
  const [failed, setFailed] = React.useState(0)
  const onError = () => {
    if (failed === 0 && props.dataUrl) { setFailed(1); setSrc(props.dataUrl) } else { setFailed(2) }
  }
  if (failed === 2) {
    return h('div', { className: 'worx-note' }, '图片无法显示（页面策略或加载失败），大小 ' + fmtSize(props.size))
  }
  return h('img', { className: 'worx-img', src, alt: props.name, onError })
}

function Divider(props: { bodyRef: React.RefObject<HTMLDivElement>; listPxRef: React.RefObject<number | null>; onMove: (px: number) => void }): React.ReactElement {
  const [on, setOn] = React.useState(false)
  const startY = React.useRef(0)
  const startPx = React.useRef(0)
  const base = React.useRef(0)

  const begin = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    try { (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId) } catch (err) {}
    const h = props.bodyRef.current ? props.bodyRef.current.clientHeight : 300
    base.current = h
    startPx.current = props.listPxRef.current === null ? Math.round(h / 3) : props.listPxRef.current
    startY.current = e.clientY
    setOn(true)
  }
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!on) return
    let captured = false
    try { captured = (e.currentTarget as HTMLDivElement).hasPointerCapture(e.pointerId) } catch (err) {}
    if (!captured) return
    let px = startPx.current + (e.clientY - startY.current)
    const min = 96
    const max = Math.max(min + 96, base.current - 96)
    if (px < min) px = min
    if (px > max) px = max
    props.onMove(px)
  }
  const end = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!on) return
    try { (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId) } catch (err) {}
    setOn(false)
  }

  return h('div', {
    className: on ? 'worx-divider worx-divider-on' : 'worx-divider',
    title: '拖动调整列表/预览高度',
    onPointerDown: begin,
    onPointerMove: move,
    onPointerUp: end,
  })
}

interface PreviewState {
  path: string
  name: string
  kind: string
  text?: string | null
  size?: number | null
  truncated?: boolean
  dataUrl?: string | null
  error?: string
}

function FilesPanel(props: any): React.ReactElement {
  const sessionId: string = props.sessionId || ''
  const useSessions = props.useSessions
  const useWorkspaces = props.useWorkspaces
  const sessionsState = typeof useSessions === 'function' ? useSessions((s: any) => s) : null
  const wsItems = typeof useWorkspaces === 'function' ? useWorkspaces((s: any) => s.items) : []
  const layout = props.layout

  const [root, setRoot] = React.useState<string | null>(null)
  const [dir, setDir] = React.useState<string | null>(null)
  const [entries, setEntries] = React.useState<any[] | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [preview, setPreview] = React.useState<PreviewState | null>(null)
  const [listPx, setListPx] = React.useState<number | null>(null)
  const [tick, setTick] = React.useState(0)
  const [copyBox, setCopyBox] = React.useState<{ text: string; x: number; y: number } | null>(null)
  const [copied, setCopied] = React.useState(false)
  const bodyRef = React.useRef<HTMLDivElement>(null)
  const listPxRef = React.useRef<number | null>(null)
  const previewRef = React.useRef<HTMLDivElement>(null)
  listPxRef.current = listPx

  React.useEffect(() => {
    const chosen = deriveRoot(sessionsState, wsItems, sessionId)
    if (!chosen || chosen === root) return
    const targetRoot = chosen
    setRoot(targetRoot)
    setDir(null)
    worxDir = targetRoot
    call('state', { action: 'get', root: targetRoot }).then((res) => {
      const d = res && res.ok && typeof res.dir === 'string' && res.dir ? res.dir : targetRoot
      worxDir = d
      setDir(d)
    }).catch(() => {
      worxDir = targetRoot
      setDir(targetRoot)
    })
  }, [sessionsState, wsItems, sessionId, root])

  React.useEffect(() => {
    if (dir === null) return
    worxDir = dir
    saveWorxState(call, root)
    let cancelled = false
    setLoading(true)
    setError(null)
    call('list', { path: dir }).then((res) => {
      if (cancelled) return
      setLoading(false)
      if (res && res.ok) {
        setEntries(res.entries || [])
        if (typeof res.path === 'string' && res.path && res.path !== dir) setDir(res.path)
      } else {
        setEntries(null)
        setError(res && typeof res.error === 'string' ? res.error : '列目录失败')
      }
    }).catch((err: any) => {
      if (cancelled) return
      setLoading(false)
      setEntries(null)
      setError(err && err.message ? String(err.message) : String(err))
    })
    return () => { cancelled = true }
  }, [dir, tick])

  const openPreview = (name: string) => {
    const full = joinPath(dir as string, name)
    setPreview({ path: full, name, kind: 'loading' })
    setCopyBox(null)
    call('read', { path: full }).then((res) => {
      if (!res || !res.ok) {
        setPreview({ path: full, name, kind: 'error', error: (res && typeof res.error === 'string') ? res.error : '读取失败' })
        return
      }
      setPreview({
        path: full,
        name,
        kind: res.kind,
        text: typeof res.text === 'string' ? res.text : null,
        size: typeof res.size === 'number' ? res.size : null,
        truncated: !!res.truncated,
        dataUrl: typeof res.dataUrl === 'string' ? res.dataUrl : null,
      })
    }).catch((err: any) => {
      setPreview({ path: full, name, kind: 'error', error: err && err.message ? String(err.message) : String(err) })
    })
  }

  const selectEntry = (entry: any) => {
    if (entry.type === 'directory') { setDir(joinPath(dir as string, entry.name)) } else { openPreview(entry.name) }
  }

  const handlePreviewMouseUp = () => {
    try {
      const sel = window.getSelection()
      const node = previewRef.current
      if (!node) { setCopyBox(null); return }
      if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !sel.toString().trim()
        || !node.contains(sel.anchorNode) || !node.contains(sel.focusNode)) {
        setCopyBox(null)
        return
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect()
      if (!rect || (rect.width === 0 && rect.height === 0)) { setCopyBox(null); return }
      setCopied(false)
      setCopyBox({ text: sel.toString(), x: Math.max(4, Math.min(rect.left, window.innerWidth - 90)), y: Math.max(4, rect.top - 32) })
    } catch (err) {
      setCopyBox(null)
    }
  }

  const doCopy = () => {
    if (!copyBox) return
    const text = copyBox.text
    const done = () => {
      setCopied(true)
      try { setTimeout(() => { setCopied(false) }, 1200) } catch (err) {}
    }
    const fallback = () => {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(ta)
        if (ok) done()
      } catch (err) {}
    }
    const nc = navigator && navigator.clipboard
    if (nc && typeof nc.writeText === 'function') {
      nc.writeText(text).then(done).catch(fallback)
    } else {
      fallback()
    }
    setCopyBox(null)
  }

  const rows: React.ReactElement[] = []
  if (Array.isArray(entries)) {
    const dirs = entries.filter((e) => e.type === 'directory')
    const files = entries.filter((e) => e.type !== 'directory')
    const sorted = dirs.concat(files)
    for (const e of sorted) {
      rows.push(h('div', { key: e.name, className: 'worx-entry', onClick: () => selectEntry(e) },
        h('span', { className: 'worx-ico' }, e.type === 'directory' ? '📁' : '📄'),
        h('span', { className: 'worx-name' }, e.name),
        h('span', { className: 'worx-size' }, fmtSize(e.size)),
      ))
    }
  }

  let previewBody: React.ReactNode = null
  if (preview) {
    if (preview.kind === 'loading') {
      previewBody = h('div', { className: 'worx-loading' }, '读取中…')
    } else if (preview.kind === 'text') {
      previewBody = h(TextPreview, { text: preview.text === null || preview.text === undefined ? '' : preview.text, lang: langOf(preview.path) })
    } else if (preview.kind === 'image') {
      const routeUrl = '/worx-file?p=' + encodeURIComponent(preview.path)
      previewBody = h(ImagePreview, { name: preview.name, routeUrl, dataUrl: preview.dataUrl || null, size: preview.size || null })
    } else if (preview.kind === 'too-large') {
      previewBody = h('div', { className: 'worx-note' }, '文件过大，无法预览（' + fmtSize(preview.size) + '）')
    } else if (preview.kind === 'binary') {
      previewBody = h('div', { className: 'worx-note' }, '二进制文件，无法预览（' + fmtSize(preview.size) + '）')
    } else if (preview.kind === 'error') {
      previewBody = h('div', { className: 'worx-err' }, preview.error)
    }
    if (preview.truncated) {
      previewBody = h('div', null, previewBody, h('div', { className: 'worx-note' }, '（内容过长，已截断显示）'))
    }
  }

  const body: React.ReactNode[] = []
  if (dir === null) {
    body.push(h('div', { className: 'worx-note' }, '未找到工作区/会话目录，请先打开一个工作区会话。'))
  } else if (loading) {
    body.push(h('div', { className: 'worx-loading' }, '加载中…'))
  } else if (error) {
    body.push(h('div', { className: 'worx-err' }, error))
  } else {
    const listStyle = preview
      ? { flex: '0 0 ' + (listPx === null ? '33.33%' : listPx + 'px') }
      : { flex: '1 1 auto' }
    body.push(
      h('div', { key: 'worx-list', className: 'worx-list', style: listStyle },
        root !== dir
          ? h('div', { key: '..', className: 'worx-entry', onClick: () => setDir(parentPath(dir as string)) },
            h('span', { className: 'worx-ico' }, '⬆️'),
            h('span', { className: 'worx-name' }, '..'),
          )
          : null,
        rows,
      ),
      preview ? h(Divider, { key: 'worx-div', bodyRef, listPxRef, onMove: (px) => setListPx(px) }) : null,
      preview ? h('div', { key: 'worx-preview', className: 'worx-preview', ref: previewRef, onMouseUp: handlePreviewMouseUp },
        h('div', { className: 'worx-preview-head' },
          h('span', { className: 'worx-name' }, preview.name),
          h('span', { className: 'worx-size' }, preview.kind === 'loading' ? '' : fmtSize(preview.size)),
          h('button', { className: 'worx-btn', onClick: () => setPreview(null) }, '×'),
        ),
        previewBody,
        copyBox ? h('button', {
          key: 'worx-copy',
          className: copied ? 'worx-copy worx-copy-on' : 'worx-copy',
          style: { left: copyBox.x, top: copyBox.y },
          onMouseDown: (e) => e.preventDefault(),
          onClick: doCopy,
        }, copied ? '已复制 ✓' : '复制') : null,
      ) : null,
    )
  }

  return h('div', { className: 'worx-col' },
    h('div', { className: 'worx-head' },
      h('span', { className: 'worx-title' }, '📁 文件'),
      h('span', { className: 'worx-path' }, dir || ''),
      h('button', { className: 'worx-btn', title: '刷新', onClick: () => setTick((t) => t + 1) }, '刷新'),
      h('button', { className: 'worx-btn', title: '向右折叠', onClick: () => { setWorxOpen(false); if (layout) layout.closeDetails(); saveWorxState(call, root) } }, '⏴'),
    ),
    h('div', { className: 'worx-body', ref: bodyRef }, body),
  )
}

function langOf(path: string): string | null {
  const m = path.match(/\.([a-z0-9]+)(\?.*)?$/i)
  if (!m) return null
  const ext = m[1].toLowerCase()
  const map: Record<string, string> = { js: 'js', mjs: 'js', cjs: 'js', jsx: 'js', ts: 'ts', mts: 'ts', tsx: 'ts', json: 'json', py: 'py', sh: 'sh', bash: 'sh', yml: 'yml', yaml: 'yml', c: 'c', h: 'c', cc: 'cpp', cpp: 'cpp', hpp: 'cpp', cs: 'cs', java: 'java', go: 'go', rs: 'rs', rb: 'ruby', pl: 'pl', pm: 'pl', perl: 'pl', php: 'php', sql: 'sql', css: 'css', html: 'html', htm: 'html', xml: 'xml', svg: 'xml', md: 'md', markdown: 'md', ini: 'ini', toml: 'toml', lua: 'lua', el: 'el', elisp: 'el', lisp: 'el', hs: 'hs', haskell: 'hs', jl: 'jl', julia: 'jl' }
  return map[ext] || null
}

function ToggleButton(props: any): React.ReactElement {
  const open = useWorxOpen()
  const useSessions = props.useSessions
  const useWorkspaces = props.useWorkspaces
  const sessionId: string = props.sessionId || ''
  const sessionsState = typeof useSessions === 'function' ? useSessions((s: any) => s) : null
  const wsItems = typeof useWorkspaces === 'function' ? useWorkspaces((s: any) => s.items) : []
  const root = deriveRoot(sessionsState, wsItems, sessionId)
  const currentSid = sessionsState ? sessionsState.current : undefined
  const layout = props.layout

  React.useEffect(() => {
    if (currentSid === undefined) return
    if (lastSid === currentSid) return
    lastSid = currentSid
    if (worxOpen) setWorxOpen(false)
    if (!root) return
    call('state', { action: 'get', root }).then((res) => {
      if (res && res.ok && res.expanded && !worxOpen) {
        setWorxOpen(true)
        if (layout) layout.openDetails()
        saveWorxState(call, root)
      }
    }).catch(() => {})
  }, [root, currentSid])

  return h('button', {
    className: open ? 'worx-toggle worx-toggle-on' : 'worx-toggle',
    title: open ? '收起文件面板' : '展开文件面板',
    onClick: () => {
      if (open) {
        setWorxOpen(false)
        if (layout) layout.closeDetails()
      } else {
        setWorxOpen(true)
        if (layout) layout.openDetails()
      }
      saveWorxState(call, root)
    },
  }, '📁 文件')
}

const h = React.createElement

const STYLES = `
.worx-col{height:100%;display:flex;flex-direction:column;box-sizing:border-box;font-size:13px;color:var(--dsw-alias-label-primary);}
.worx-head{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;}
.worx-title{font-weight:600;}
.worx-path{color:var(--dsw-alias-label-secondary);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;}
.worx-btn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:6px;padding:2px 10px;font-size:12px;cursor:pointer;}
.worx-toggle{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);border-radius:6px;padding:2px 10px;font-size:12px;cursor:pointer;}
.worx-toggle-on{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);}
.worx-body{display:flex;flex-direction:column;flex:1;min-height:0;}
.worx-list{overflow:auto;padding:6px 0;min-height:96px;}
.worx-divider{flex:none;height:6px;cursor:row-resize;background:var(--dsw-alias-border-l1);touch-action:none;}
.worx-divider:hover,.worx-divider-on{background:var(--dsw-alias-brand-primary);}
.worx-entry{display:flex;align-items:center;gap:6px;padding:4px 12px;cursor:pointer;white-space:nowrap;}
.worx-entry:hover{background:var(--dsw-alias-bg-layer-2);}
.worx-name{flex:1;overflow:hidden;text-overflow:ellipsis;}
.worx-size{color:var(--dsw-alias-label-secondary);font-size:11px;}
.worx-preview{flex:1;min-height:96px;overflow:auto;padding:10px 14px;}
.worx-preview-head{display:flex;gap:8px;align-items:baseline;margin-bottom:6px;flex:none;}
.worx-err{color:var(--dsw-alias-state-error-primary);padding:8px;}
.worx-note{color:var(--dsw-alias-label-secondary);padding:8px;}
.worx-img{max-width:100%;border-radius:6px;}
.worx-loading{color:var(--dsw-alias-label-secondary);padding:8px;}
.worx-body-pre{padding:2px 0;}
.worx-line{display:flex;align-items:baseline;min-width:max-content;}
.worx-ln{flex:none;min-width:3em;text-align:right;padding-right:0.8em;color:var(--dsw-alias-label-secondary);opacity:0.7;user-select:none;-webkit-user-select:none;font-size:11px;}
.worx-code{white-space:pre;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1.55;color:var(--dsw-alias-label-primary);}
.worx-tok-kw{color:var(--dsw-alias-brand-primary);font-weight:600;}
.worx-tok-str{color:var(--dsw-alias-state-success-primary);}
.worx-tok-cmt{color:var(--dsw-alias-label-secondary);font-style:italic;}
.worx-tok-num{color:var(--dsw-alias-state-warn-primary);}
.worx-copy{position:fixed;z-index:80;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);border-radius:6px;padding:3px 10px;font-size:12px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.25);}
.worx-copy-on{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary);}
`

export function apply(ctx: any): void {
  ctx.effect(() => {
    const tag = document.createElement('style')
    tag.setAttribute('data-worx', '1')
    tag.textContent = STYLES
    document.head.append(tag)
    return () => { tag.remove() }
  })

  const layout = ctx.layout
  if (!layout) return
  const fileProps = (props: any) => Object.assign({}, props, { layout })

  ctx.slots.inject('details', () => ctx.slots.register(
    { name: 'details', priority: -100 },
    (props: any) => h(FilesPanel, fileProps(props)),
  ))

  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register(
    { name: 'conversation.session.header.utilities', id: 'worx', order: 30, label: '文件' },
    (props: any) => h(ToggleButton, fileProps(props)),
  ))
}