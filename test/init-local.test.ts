import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, mkdtempSync, rmSync, readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';

const CLI = 'npx tsx src/cli.ts';

// Minimal env vars so config validation passes without real credentials.
// The init --local tests never call any remote API.
// Minimal env vars so config validation passes without real credentials.
// GitHub client uses api.github.com directly (no URL needed).
// GitLab vars included as fallback if provider is switched.
const TEST_ENV = {
  GIT_PROVIDER: 'github',
  GITHUB_TOKEN: 'test-token',
  GITHUB_USERNAME: 'test-user',
  GITLAB_URL: 'https://gitlab.example.com',
  GITLAB_TOKEN: 'test-token',
  GITLAB_USERNAME: 'test-user',
};

describe('init --local', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'scripsi-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function run(args: string) {
    return execSync(`${CLI} ${args}`, {
      encoding: 'utf-8',
      env: { ...process.env, ...TEST_ENV },
      timeout: 15_000,
    });
  }

  function runExpectingError(args: string): string {
    try {
      execSync(`${CLI} ${args}`, {
        encoding: 'utf-8',
        env: { ...process.env, ...TEST_ENV },
        timeout: 15_000,
        stdio: 'pipe',
      });
      throw new Error('Expected command to fail, but it succeeded');
    } catch (err: any) {
      return err.stderr || err.stdout || err.message;
    }
  }

  it('creates a local docs repo with correct structure', () => {
    const output = run(`init my-project --local ${tempDir}`);
    const repoDir = join(tempDir, 'scripsi-my-project');

    // CLI reports success
    expect(output).toContain('✅ Docs repo ready:');
    expect(output).toContain(repoDir);

    // Directory structure
    expect(existsSync(repoDir)).toBe(true);
    expect(existsSync(join(repoDir, 'entries'))).toBe(true);
    expect(existsSync(join(repoDir, 'README.md'))).toBe(true);

    // No PROJECT.md when no --description
    expect(existsSync(join(repoDir, 'PROJECT.md'))).toBe(false);

    // README.md content
    const readme = readFileSync(join(repoDir, 'README.md'), 'utf-8');
    expect(readme).toContain('# Scripsi: my-project');
    expect(readme).toContain('## Entries');

    // Git initialized
    expect(existsSync(join(repoDir, '.git'))).toBe(true);
  });

  it('creates PROJECT.md when --description is provided', () => {
    run(`init described-project --description "A test project" --local ${tempDir}`);
    const repoDir = join(tempDir, 'scripsi-described-project');

    expect(existsSync(join(repoDir, 'PROJECT.md'))).toBe(true);
    const project = readFileSync(join(repoDir, 'PROJECT.md'), 'utf-8');
    expect(project).toContain('# described-project');
    expect(project).toContain('A test project');
  });

  it('rejects creating a repo that already exists', () => {
    run(`init duplicate --local ${tempDir}`);

    const stderr = runExpectingError(`init duplicate --local ${tempDir}`);
    expect(stderr).toContain('❌');
    expect(stderr).toContain('already exists');
    expect(stderr).toContain(join(tempDir, 'scripsi-duplicate'));
  });

  it('rejects a non-existent base path', () => {
    const stderr = runExpectingError(`init test --local /nonexistent/path/xyz`);
    expect(stderr).toContain('❌');
    expect(stderr).toContain('does not exist');
    expect(stderr).toContain('/nonexistent/path/xyz');
  });

  it('only allows one repo per slug in the same location', () => {
    // First repo succeeds
    run(`init unique-project --local ${tempDir}`);

    // Different slug in same location also succeeds
    const output = run(`init other-project --local ${tempDir}`);
    expect(output).toContain(join(tempDir, 'scripsi-other-project'));

    // Verify both exist independently
    expect(existsSync(join(tempDir, 'scripsi-unique-project'))).toBe(true);
    expect(existsSync(join(tempDir, 'scripsi-other-project'))).toBe(true);
  });
});
