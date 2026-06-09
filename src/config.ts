import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env') });

export type GitProvider = 'gitlab' | 'github';

export interface Config {
  provider: GitProvider;
  gitlab: {
    url: string;
    token: string;
    username: string;
  };
  github?: {
    token: string;
    username: string;
  };
  jira: {
    url: string;
    token: string;
    email: string;
  };
  docs: {
    group: string;
    repoPrefix: string;
  };
}

export function getConfig(): Config {
  const missing: string[] = [];
  const provider: GitProvider = (process.env['GIT_PROVIDER'] as GitProvider) ?? 'gitlab';

  const require = (key: string): string => {
    const val = process.env[key];
    if (!val || val.includes('your_')) missing.push(key);
    return val ?? '';
  };

  const cfg: Config = {
    provider,
    gitlab: {
      url: provider === 'gitlab' ? require('GITLAB_URL') : (process.env['GITLAB_URL'] ?? ''),
      token: provider === 'gitlab' ? require('GITLAB_TOKEN') : (process.env['GITLAB_TOKEN'] ?? ''),
      username: provider === 'gitlab' ? require('GITLAB_USERNAME') : (process.env['GITLAB_USERNAME'] ?? ''),
    },
    github: process.env['GITHUB_TOKEN'] ? {
      token: provider === 'github' ? require('GITHUB_TOKEN') : process.env['GITHUB_TOKEN']!,
      username: provider === 'github' ? require('GITHUB_USERNAME') : (process.env['GITHUB_USERNAME'] ?? ''),
    } : undefined,
    jira: {
      url: require('JIRA_URL'),
      token: require('JIRA_TOKEN'),
      email: require('JIRA_EMAIL'),
    },
    docs: {
      group: process.env['DOCS_GROUP'] ?? 'eradjua',
      repoPrefix: process.env['DOCS_REPO_PREFIX'] ?? 'scripsi',
    },
  };

  if (missing.length) {
    console.error(`❌ Missing/unconfigured env vars: ${missing.join(', ')}`);
    console.error('   Copy .env.example to .env and fill in your credentials.');
    process.exit(1);
  }

  return cfg;
}
