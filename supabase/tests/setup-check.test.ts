// @vitest-environment node
/**
 * The decisions behind `npm run setup:check`.
 *
 * The beginner setup leans on this checklist between stages, so what it calls a
 * blocker — a secret in a VITE_ variable, a CLI linked to a different project
 * than the app points at, a remote that can push to the original repository —
 * has to be exactly right.
 */
import { describe, expect, it } from 'vitest'

import {
  classifyKey,
  compareVersions,
  envFileContents,
  evaluate,
  isOriginalAtlasRemote,
  isReady,
  parseEnvFile,
  pickBrowserKey,
  projectRefFromUrl,
  type SetupFacts,
} from '../../scripts/setup-check-lib.mjs'

function jwt(role: string): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'HS256' })}.${encode({ role, ref: 'abcdefghijklmnopqrst' })}.sig`
}

const REF = 'abcdefghijklmnopqrst'

function facts(overrides: Partial<SetupFacts> = {}): SetupFacts {
  return {
    nodeVersion: '22.11.0',
    requiredNode: '20.19.0',
    gitVersion: '2.45.0',
    dependenciesInstalled: true,
    env: {
      VITE_SUPABASE_URL: `https://${REF}.supabase.co`,
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
    },
    linkedRef: REF,
    migrationCount: 54,
    latestMigration: '20260825100000_fleet_occupancy_follows_lifecycle',
    isGitRepository: true,
    envIgnored: true,
    remotes: [
      {
        name: 'origin',
        fetch: 'https://github.com/someone/my-atlas.git',
        push: 'https://github.com/someone/my-atlas.git',
      },
    ],
    ...overrides,
  }
}

const status = (results: ReturnType<typeof evaluate>, id: string) =>
  results.find((result) => result.id === id)?.status

describe('setup check helpers', () => {
  it('parses env files without comments, blanks or quotes', () => {
    expect(
      parseEnvFile(
        '# comment\n\nVITE_SUPABASE_URL="https://x.supabase.co"\nVITE_SUPABASE_PUBLISHABLE_KEY= sb_publishable_a \n',
      ),
    ).toEqual({
      VITE_SUPABASE_URL: 'https://x.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_a',
    })
  })

  it('classifies keys without needing their value afterwards', () => {
    expect(classifyKey('')).toBe('missing')
    expect(classifyKey('sb_publishable_abc')).toBe('publishable')
    expect(classifyKey('sb_secret_abc')).toBe('secret')
    expect(classifyKey(jwt('anon'))).toBe('legacy-anon')
    expect(classifyKey(jwt('service_role'))).toBe('secret')
    expect(classifyKey('something-else')).toBe('unknown')
  })

  it('reads the project ref only from a real Supabase https URL', () => {
    expect(projectRefFromUrl(`https://${REF}.supabase.co`)).toBe(REF)
    expect(projectRefFromUrl(`http://${REF}.supabase.co`)).toBeNull()
    expect(projectRefFromUrl('https://example.com')).toBeNull()
    expect(projectRefFromUrl('')).toBeNull()
  })

  it('compares versions numerically', () => {
    expect(compareVersions('2.21.0', '2.30.0')).toBe(-1)
    expect(compareVersions('v22.11.0', '20.19.0')).toBe(1)
    expect(compareVersions('2.30', '2.30.0')).toBe(0)
  })

  it('recognises every URL form of the original repository', () => {
    expect(isOriginalAtlasRemote('https://github.com/salhiworks/atlas-car-rental-saas.git')).toBe(
      true,
    )
    expect(isOriginalAtlasRemote('git@github.com:salhiworks/atlas-car-rental-saas.git')).toBe(true)
    expect(isOriginalAtlasRemote('https://github.com/someone/atlas-car-rental-saas.git')).toBe(
      false,
    )
    expect(isOriginalAtlasRemote('DISABLED--never-push-to-original-atlas')).toBe(false)
  })
})

describe('setup check decisions', () => {
  it('passes a correctly prepared folder', () => {
    const results = evaluate(facts())
    expect(isReady(results)).toBe(true)
    expect(results.every((result) => result.status === 'ok')).toBe(true)
  })

  it('blocks on a secret key under either variable name', () => {
    expect(
      status(
        evaluate(
          facts({
            env: {
              VITE_SUPABASE_URL: `https://${REF}.supabase.co`,
              VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_x',
            },
          }),
        ),
        'supabase-key',
      ),
    ).toBe('fail')
    expect(
      status(
        evaluate(
          facts({
            env: {
              VITE_SUPABASE_URL: `https://${REF}.supabase.co`,
              VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_ok',
              VITE_SUPABASE_ANON_KEY: jwt('service_role'),
            },
          }),
        ),
        'supabase-key',
      ),
    ).toBe('fail')
  })

  it('accepts the legacy anon variable on its own', () => {
    const results = evaluate(
      facts({
        env: {
          VITE_SUPABASE_URL: `https://${REF}.supabase.co`,
          VITE_SUPABASE_ANON_KEY: jwt('anon'),
        },
      }),
    )
    expect(status(results, 'supabase-key')).toBe('ok')
  })

  it('accepts a publishable key kept under the older variable name', () => {
    // Existing installs put the new sb_publishable_ key in VITE_SUPABASE_ANON_KEY.
    const results = evaluate(
      facts({
        env: {
          VITE_SUPABASE_URL: `https://${REF}.supabase.co`,
          VITE_SUPABASE_ANON_KEY: 'sb_publishable_existing_install',
        },
      }),
    )
    expect(status(results, 'supabase-key')).toBe('ok')
  })

  it('blocks when the CLI is linked to a different project than the app uses', () => {
    const results = evaluate(facts({ linkedRef: 'zzzzzzzzzzzzzzzzzzzz' }))
    expect(status(results, 'supabase-link')).toBe('fail')
    expect(isReady(results)).toBe(false)
  })

  it('only warns before the folder is linked', () => {
    expect(status(evaluate(facts({ linkedRef: null })), 'supabase-link')).toBe('warn')
  })

  it('treats a missing .env.local as not yet written, and blocks one that could be committed', () => {
    expect(status(evaluate(facts({ env: null })), 'env-file')).toBe('warn')
    expect(status(evaluate(facts({ envIgnored: false })), 'env-ignored')).toBe('fail')
  })

  it('warns while a remote can still push to the original repository', () => {
    const results = evaluate(
      facts({
        remotes: [
          {
            name: 'origin',
            fetch: 'https://github.com/salhiworks/atlas-car-rental-saas.git',
            push: 'https://github.com/salhiworks/atlas-car-rental-saas.git',
          },
        ],
      }),
    )
    expect(status(results, 'repository')).toBe('warn')
  })

  it('treats a disabled upstream push as safe', () => {
    const results = evaluate(
      facts({
        remotes: [
          {
            name: 'upstream',
            fetch: 'https://github.com/salhiworks/atlas-car-rental-saas.git',
            push: 'DISABLED--never-push-to-original-atlas',
          },
        ],
      }),
    )
    expect(status(results, 'repository')).toBe('ok')
  })

  it('warns about an old Git and blocks on an old Node', () => {
    expect(status(evaluate(facts({ gitVersion: '2.21.0' })), 'git')).toBe('warn')
    expect(status(evaluate(facts({ gitVersion: null })), 'git')).toBe('warn')
    expect(status(evaluate(facts({ nodeVersion: '18.20.0' })), 'node')).toBe('fail')
  })

  it('never puts a key value into a message', () => {
    const secret = 'sb_secret_do_not_print_me'
    const results = evaluate(
      facts({
        env: {
          VITE_SUPABASE_URL: `https://${REF}.supabase.co`,
          VITE_SUPABASE_PUBLISHABLE_KEY: secret,
        },
      }),
    )
    expect(JSON.stringify(results)).not.toContain(secret)
  })
})

describe('writing .env.local', () => {
  // The shape `supabase projects api-keys -o json` returned for a new project.
  const apiKeys = [
    { name: 'anon', type: 'legacy', api_key: jwt('anon') },
    { name: 'service_role', type: 'legacy', api_key: jwt('service_role') },
    { name: 'default', type: 'publishable', api_key: 'sb_publishable_new' },
    { name: 'default', type: 'secret', api_key: 'sb_secret_never' },
  ]

  it('prefers the publishable key', () => {
    expect(pickBrowserKey(apiKeys)).toEqual({ kind: 'publishable', value: 'sb_publishable_new' })
  })

  it('falls back to the legacy anon key when there is no publishable one', () => {
    expect(pickBrowserKey(apiKeys.filter((key) => key.type !== 'publishable'))).toEqual({
      kind: 'legacy-anon',
      value: jwt('anon'),
    })
  })

  it('never picks a secret key, whatever it is labelled', () => {
    expect(
      pickBrowserKey(apiKeys.filter((key) => key.name !== 'anon' && key.type !== 'publishable')),
    ).toBeNull()
    expect(
      pickBrowserKey([{ name: 'anon', type: 'publishable', api_key: 'sb_secret_mislabelled' }]),
    ).toBeNull()
    expect(pickBrowserKey(undefined)).toBeNull()
  })

  it('writes exactly the two values the app needs', () => {
    const contents = envFileContents(REF, 'sb_publishable_new')
    expect(parseEnvFile(contents)).toEqual({
      VITE_SUPABASE_URL: `https://${REF}.supabase.co`,
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_new',
    })
  })
})
