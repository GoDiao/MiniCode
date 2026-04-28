import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  discoverInstructionFiles,
  loadMemory,
  type ContextFile,
} from '../src/memory.js'

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'minicode-memory-test-'))
}

function write(dir: string, name: string, content: string): string {
  const filePath = path.join(dir, name)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf8')
  return filePath
}

describe('discoverInstructionFiles', () => {
  test('returns empty when no files exist', async () => {
    const dir = makeTempDir()
    try {
      const files = await discoverInstructionFiles(dir)
      assert.equal(files.length, 0)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('finds MINI.md in cwd', async () => {
    const dir = makeTempDir()
    try {
      write(dir, 'MINI.md', 'project rules')
      const files = await discoverInstructionFiles(dir)
      assert.equal(files.length, 1)
      assert.equal(files[0].content, 'project rules')
      assert.ok(files[0].path.endsWith('MINI.md'))
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('finds MINI.local.md in cwd', async () => {
    const dir = makeTempDir()
    try {
      write(dir, 'MINI.local.md', 'local rules')
      const files = await discoverInstructionFiles(dir)
      assert.equal(files.length, 1)
      assert.equal(files[0].content, 'local rules')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('finds .mini-code/MINI.md', async () => {
    const dir = makeTempDir()
    try {
      write(dir, '.mini-code/MINI.md', 'mini-code instructions')
      const files = await discoverInstructionFiles(dir)
      assert.equal(files.length, 1)
      assert.equal(files[0].content, 'mini-code instructions')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('finds CLAUDE.md for compatibility', async () => {
    const dir = makeTempDir()
    try {
      write(dir, 'CLAUDE.md', 'claude rules')
      const files = await discoverInstructionFiles(dir)
      assert.equal(files.length, 1)
      assert.equal(files[0].content, 'claude rules')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('finds CLAUDE.local.md for compatibility', async () => {
    const dir = makeTempDir()
    try {
      write(dir, 'CLAUDE.local.md', 'claude local rules')
      const files = await discoverInstructionFiles(dir)
      assert.equal(files.length, 1)
      assert.equal(files[0].content, 'claude local rules')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('finds .claude/CLAUDE.md for compatibility', async () => {
    const dir = makeTempDir()
    try {
      write(dir, '.claude/CLAUDE.md', 'claude dir rules')
      const files = await discoverInstructionFiles(dir)
      assert.equal(files.length, 1)
      assert.equal(files[0].content, 'claude dir rules')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('walks upward from cwd to root', async () => {
    const root = makeTempDir()
    const child = path.join(root, 'apps', 'web')
    fs.mkdirSync(child, { recursive: true })
    try {
      write(root, 'MINI.md', 'root rules')
      write(child, 'MINI.md', 'child rules')
      const files = await discoverInstructionFiles(child)
      assert.equal(files.length, 2)
      // root first, then child
      assert.equal(files[0].content, 'root rules')
      assert.equal(files[1].content, 'child rules')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('dedupes files with identical content', async () => {
    const root = makeTempDir()
    const child = path.join(root, 'apps', 'web')
    fs.mkdirSync(child, { recursive: true })
    try {
      write(root, 'MINI.md', 'same rules')
      write(child, 'MINI.md', 'same rules')
      const files = await discoverInstructionFiles(child)
      assert.equal(files.length, 1)
      // keeps the one closer to cwd (child)
      assert.ok(files[0].path.includes('web'))
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('skips empty files', async () => {
    const dir = makeTempDir()
    try {
      write(dir, 'MINI.md', '   \n\n  ')
      const files = await discoverInstructionFiles(dir)
      assert.equal(files.length, 0)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('loads user global MINI.md from home directory', async () => {
    const dir = makeTempDir()
    const miniCodeHome = makeTempDir()
    try {
      write(miniCodeHome, 'MINI.md', 'global rules')
      const files = await discoverInstructionFiles(dir, miniCodeHome)
      const globalFile = files.find(f => f.content === 'global rules')
      assert.ok(globalFile)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
      fs.rmSync(miniCodeHome, { recursive: true, force: true })
    }
  })

  test('global loaded before project files', async () => {
    const dir = makeTempDir()
    const miniCodeHome = makeTempDir()
    try {
      write(miniCodeHome, 'MINI.md', 'global rules')
      write(dir, 'MINI.md', 'project rules')
      const files = await discoverInstructionFiles(dir, miniCodeHome)
      assert.equal(files.length, 2)
      assert.equal(files[0].content, 'global rules')
      assert.equal(files[1].content, 'project rules')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
      fs.rmSync(miniCodeHome, { recursive: true, force: true })
    }
  })

  test('MINI.md takes priority over CLAUDE.md in same directory', async () => {
    const dir = makeTempDir()
    try {
      write(dir, 'MINI.md', 'mini rules')
      write(dir, 'CLAUDE.md', 'claude rules')
      const files = await discoverInstructionFiles(dir)
      assert.equal(files.length, 2)
      assert.equal(files[0].content, 'mini rules')
      assert.equal(files[1].content, 'claude rules')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('MINI.local.md loaded after MINI.md in same directory', async () => {
    const dir = makeTempDir()
    try {
      write(dir, 'MINI.md', 'shared rules')
      write(dir, 'MINI.local.md', 'local rules')
      const files = await discoverInstructionFiles(dir)
      assert.equal(files.length, 2)
      assert.equal(files[0].content, 'shared rules')
      assert.equal(files[1].content, 'local rules')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('loadMemory', () => {
  test('returns empty string when no files exist', async () => {
    const dir = makeTempDir()
    try {
      const result = await loadMemory(dir)
      assert.equal(result, '')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('renders instruction files with scope', async () => {
    const dir = makeTempDir()
    try {
      write(dir, 'MINI.md', 'project rules')
      const result = await loadMemory(dir)
      assert.ok(result.includes('project rules'))
      assert.ok(result.includes('MINI.md'))
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('truncates files exceeding per-file limit', async () => {
    const dir = makeTempDir()
    try {
      const longContent = 'x'.repeat(10_000)
      write(dir, 'MINI.md', longContent)
      const result = await loadMemory(dir)
      assert.ok(result.includes('[truncated]'))
      // total should not include the full 10k
      assert.ok(result.length < 10_000)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('truncates total content exceeding limit', async () => {
    const root = makeTempDir()
    const child = path.join(root, 'apps', 'web')
    fs.mkdirSync(child, { recursive: true })
    try {
      write(root, 'MINI.md', 'a'.repeat(12_000))
      write(child, 'MINI.md', 'b'.repeat(12_000))
      // Call from child so upward walk finds both root and child
      const result = await loadMemory(child)
      assert.ok(result.length < 30_000)
      assert.ok(result.includes('b'))
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('omits instructions section when no files found', async () => {
    const dir = makeTempDir()
    try {
      const result = await loadMemory(dir)
      assert.equal(result, '')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
