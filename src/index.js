/**
 * dsh-fs-browser host half: a Cordis plugin row that registers two
 * webServer routes:
 *   - GET  /worx-file?p=<path>  — raw file bytes (image preview)
 *   - POST /worx-api           — JSON ops: { op: 'list'|'read'|'state', args }
 *
 * Per-workspace UI state (open directory + expanded) lives in a durable
 * storage **domain** (`fs-browser`, table `state`) — the same facility that
 * backs `~/.dsh/storages/workspace.json`. The domain backend writes its own
 * file (`~/.dsh/storages/fs-browser.json`), so no fs-sandbox policy is
 * involved and no state file pollutes the workspace. Records are keyed by
 * workspace id (path fallback).
 */

import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { z } from 'zod'

export const name = 'dsh-fs-browser'

/**
 * Hard dependencies: the row must not activate before the services it needs
 * are live — a plugin that fires at boot with no inject can run its apply
 * while they are still mounting and silently skip its routes.
 */
export const inject = ['fs', 'webServer', 'storageDomain']

/** Durable per-workspace state: the open directory and whether the column is expanded. */
const fsBrowserDomainSpec = defineDomain({
  name: 'fs_browser',
  version: 1,
  tables: {
    state: domainTable(z.object({
      dir: z.string(),
      expanded: z.boolean(),
    })),
  },
})

const LEGACY_STATE_FILE = '.worx-state.json'

function errText(err) {
  return err && typeof err.message === 'string' ? err.message : String(err)
}

function imageMime(path) {
  const m = path.match(/\.([a-z0-9]+)$/i)
  const ext = m ? m[1].toLowerCase() : ''
  if (ext === 'svg') return 'image/svg+xml'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'bmp') return 'image/bmp'
  return 'application/octet-stream'
}

function bytesToBase64(bytes) {
  const chunks = []
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) {
    chunks.push(String.fromCharCode.apply(null, bytes.subarray(i, i + step)))
  }
  return btoa(chunks.join(''))
}

const MAX_ROUTE_BYTES = 8 * 1024 * 1024
const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const MAX_TEXT_BYTES = 256 * 1024
const IMAGE_RE = /\.(png|jpe?g|gif|webp|svg|bmp)$/i

async function listDir(fs, path) {
  const target = await fs.resolve(path)
  const info = await fs.stat(target)
  if (!info || info.type !== 'directory') {
    return { ok: false, error: '目录不存在或不可读：' + (path || '(空)') }
  }
  const entries = await fs.listDir(target)
  return {
    ok: true,
    path: fs.processPath(target),
    entries: entries
      .filter((e) => e.name !== LEGACY_STATE_FILE)
      .map((e) => ({
        name: e.name,
        type: e.type,
        size: typeof e.size === 'number' ? e.size : null,
      })),
  }
}

async function readFilePreview(fs, path) {
  const target = await fs.resolve(path)
  const info = await fs.stat(target)
  if (!info || info.type !== 'file') {
    return { ok: false, error: '文件不存在或不可读：' + path }
  }
  const size = typeof info.size === 'number' ? info.size : null
  if (IMAGE_RE.test(path) && (size === null || size <= MAX_IMAGE_BYTES)) {
    try {
      const bytes = await fs.readBytes(target, undefined, MAX_IMAGE_BYTES)
      return {
        ok: true,
        kind: 'image',
        path,
        size,
        dataUrl: 'data:' + imageMime(path) + ';base64,' + bytesToBase64(bytes),
      }
    } catch (imgErr) {
      // not an image or read failed; fall through to text handling
    }
  }
  if (size === null || size <= MAX_TEXT_BYTES) {
    try {
      const text = await fs.readText(target)
      const cap = 24 * 1024
      return {
        ok: true,
        kind: 'text',
        path,
        size,
        text: text.slice(0, cap),
        truncated: text.length > cap,
      }
    } catch (textErr) {
      try {
        await fs.readBytes(target, undefined, 16 * 1024)
        return { ok: true, kind: 'binary', path, size }
      } catch (bytesErr) {
        return { ok: false, error: '无法读取文件内容：' + errText(textErr) }
      }
    }
  }
  return { ok: true, kind: 'too-large', path, size }
}

/** Stable domain key for one workspace root: workspace id when registrable, else the path. */
async function stateKey(ctx, root) {
  try {
    const registry = ctx.get('workspaceRegistry')
    if (registry !== undefined) {
      const ws = await registry.resolveByPath(root)
      if (ws !== undefined && typeof ws.id === 'string') return ws.id
    }
  } catch (err) {
    // registry unavailable or lookup failed — fall back to the path key
  }
  return root
}

async function workspaceState(ctx, domain, raw) {
  const action = raw && raw.action === 'set' ? 'set' : 'get'
  const root = raw && typeof raw.root === 'string' ? raw.root : ''
  if (!root) return { ok: false, error: 'missing root' }
  const table = domain.table('state')
  try {
    const key = await stateKey(ctx, root)
    if (action === 'get') {
      const record = table.get(key)
      return {
        ok: true,
        key,
        dir: record && typeof record.dir === 'string' ? record.dir : null,
        expanded: !!(record && record.expanded),
      }
    }
    const dir = raw && typeof raw.dir === 'string' ? raw.dir : ''
    const expanded = !!(raw && raw.expanded)
    if (!dir) return { ok: false, error: 'missing dir' }
    await table.put(key, { dir, expanded })
    return { ok: true, key }
  } catch (err) {
    console.error('worx state error:', errText(err))
    return { ok: false, error: errText(err) }
  }
}

/** One-time best-effort import of legacy per-workspace `.worx-state.json` files (kept, then ignored). */
async function migrateLegacyState(ctx, domain) {
  try {
    const registry = ctx.get('workspaceRegistry')
    if (registry === undefined || typeof registry.list !== 'function') return
    const table = domain.table('state')
    const workspaces = await registry.list()
    for (const ws of workspaces) {
      const root = ws && ws.path
      if (typeof root !== 'string' || !root) continue
      const key = await stateKey(ctx, root)
      if (table.get(key) !== undefined) continue
      const legacySep = root.indexOf('\\') !== -1 ? '\\' : '/'
      try {
        const target = await ctx.fs.resolve(root + legacySep + LEGACY_STATE_FILE)
        const text = await ctx.fs.readText(target)
        const data = JSON.parse(text)
        if (data && typeof data.dir === 'string') {
          await table.put(key, { dir: data.dir, expanded: !!data.expanded })
        }
      } catch (err) {
        // no legacy file for this workspace — skip
      }
    }
  } catch (err) {
    console.error('worx legacy migration:', errText(err))
  }
}

function sendJson(res, status, value) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(value))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      chunks.push(chunk)
      size += chunk.length
      if (size > 1 * 1024 * 1024) {
        reject(new Error('request body too large'))
        req.destroy()
        return
      }
    })
    req.on('end', () => {
      try {
        resolve(Buffer.concat(chunks).toString('utf8'))
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function apiHandler(fs, stateOp) {
  return async (req, res) => {
    try {
      if (req.method !== 'POST' && req.method !== 'OPTIONS') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      const text = await readBody(req)
      let payload = null
      try {
        payload = text ? JSON.parse(text) : null
      } catch (parseErr) {
        sendJson(res, 400, { ok: false, error: 'invalid json' })
        return
      }
      const op = payload && typeof payload.op === 'string' ? payload.op : ''
      const args = payload && payload.args !== null && typeof payload.args === 'object' ? payload.args : {}
      const argPath = typeof args.path === 'string' ? args.path : ''
      let result
      if (op === 'list') result = await listDir(fs, argPath)
      else if (op === 'read') result = await readFilePreview(fs, argPath)
      else if (op === 'state') result = await stateOp(args)
      else result = { ok: false, error: 'unknown op: ' + op }
      sendJson(res, 200, result)
    } catch (err) {
      sendJson(res, 500, { ok: false, error: 'worx-api: ' + errText(err) })
    }
  }
}

function fileRouteHandler(fs) {
  return async (req, res) => {
    try {
      const url = req.url || ''
      const qi = url.indexOf('?')
      let p = ''
      if (qi >= 0) {
        const query = url.slice(qi + 1)
        for (const pair of query.split('&')) {
          const eq = pair.indexOf('=')
          if (eq > 0 && pair.slice(0, eq) === 'p') {
            p = pair.slice(eq + 1)
            break
          }
        }
      }
      if (!p) {
        res.statusCode = 400
        res.setHeader('content-type', 'text/plain; charset=utf-8')
        res.end('missing p')
        return
      }
      const dec = decodeURIComponent(p)
      const target = await fs.resolve(dec)
      const info = await fs.stat(target)
      if (!info || info.type !== 'file') {
        res.statusCode = 404
        res.setHeader('content-type', 'text/plain; charset=utf-8')
        res.end('not found')
        return
      }
      const size = typeof info.size === 'number' ? info.size : 0
      if (size > MAX_ROUTE_BYTES) {
        res.statusCode = 404
        res.setHeader('content-type', 'text/plain; charset=utf-8')
        res.end('too large')
        return
      }
      const bytes = await fs.readBytes(target, undefined, MAX_ROUTE_BYTES)
      res.statusCode = 200
      res.setHeader('content-type', imageMime(dec))
      res.setHeader('content-length', String(bytes.length))
      res.setHeader('cache-control', 'no-store')
      res.end(bytes)
    } catch (err) {
      res.statusCode = 500
      res.setHeader('content-type', 'text/plain; charset=utf-8')
      res.end('worx-file: ' + errText(err))
    }
  }
}

/**
 * Cordis plugin body: open the durable state domain and register the two
 * routes. Each registration is fenced so one failure never silences another.
 */
export function apply(ctx) {
  const fs = ctx.fs
  const webServer = ctx.webServer

  let domainPromise = ctx.storageDomain.open(fsBrowserDomainSpec).then((domain) => {
    ctx.effect(() => () => domain.close(), 'dsh-fs-browser.domainClose')
    // Best-effort import of legacy per-workspace state files (non-blocking).
    void migrateLegacyState(ctx, domain)
    return domain
  })
  domainPromise.catch((err) => {
    console.error('dsh-fs-browser: could not open state domain:', errText(err))
  })

  const stateOp = async (args) => {
    const domain = await domainPromise
    return await workspaceState(ctx, domain, args)
  }

  const register = (route) => {
    try {
      return ctx.effect(() => webServer.register(route))
    } catch (err) {
      console.error('dsh-fs-browser: route register failed:', route.path, errText(err))
      return undefined
    }
  }
  register({
    kind: 'prefix',
    path: '/worx-file',
    handler: fileRouteHandler(fs),
  })
  register({
    kind: 'exact',
    path: '/worx-api',
    handler: apiHandler(fs, stateOp),
  })
}