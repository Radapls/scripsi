#!/usr/bin/env node
import { Command } from 'commander';
import { Scripsi } from './chronicle.js';
import { getConfig } from './config.js';

function run<T extends unknown[]>(fn: (...args: T) => Promise<void>) {
  return async (...args: T) => {
    try {
      await fn(...args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\n❌ ${message}\n`);
      process.exit(1);
    }
  };
}

const program = new Command();

program
  .name('scripsi')
  .description('Scripsi — self-documentation tool for AI-assisted development work')
  .version('1.0.0');

program
  .command('verify')
  .description('Verify Git provider and Jira connections')
  .action(run(async () => {
    const config = getConfig();
    const chronicle = new Scripsi(config);
    const status = await chronicle.verify();
    const label = status.provider === 'github' ? 'GitHub' : 'GitLab';
    console.log(`${label}: ${status.git ? '✅ Connected' : '❌ Failed'}`);
    if (status.jira !== undefined) {
      console.log(`Jira:   ${status.jira ? '✅ Connected' : '❌ Failed'}`);
    } else {
      console.log(`Jira:   ⏭️  Not configured (skipped)`);
    }
    if (!status.git || status.jira === false) process.exit(1);
  }));

program
  .command('init')
  .description('Create a new docs repo for a project')
  .argument('<project-slug>', 'Project identifier (e.g., test-project, side-project)')
  .option('-d, --description <desc>', 'Project description')
  .option('--local <path>', 'Create repo locally at the specified path instead of pushing to a remote provider')
  .action(run(async (slug: string, opts: { description?: string; local?: string }) => {
    const config = getConfig();
    const chronicle = new Scripsi(config);
    const url = opts.local
      ? await chronicle.initProjectLocal(slug, opts.description, opts.local)
      : await chronicle.initProject(slug, opts.description);
    console.log(`✅ Docs repo ready: ${url}`);
  }));

program
  .command('log')
  .description('Log work done for a ticket')
  .argument('<ticket>', 'Ticket key (e.g., ABC-123)')
  .argument('<summary>', 'Summary of changes made')
  .option('-p, --project <slug>', 'Override project slug (defaults to ticket project key)')
  .action(run(async (ticket: string, summary: string, opts: { project?: string }) => {
    const config = getConfig();
    const chronicle = new Scripsi(config);
    const url = await chronicle.logTicket(ticket, summary, opts.project);
    console.log(`✅ Logged work on ${ticket}: ${url}`);
  }));

program
  .command('log-branch')
  .description('Log work from current git branch (extracts ticket from branch name)')
  .argument('<summary>', 'Summary of changes made')
  .option('-c, --cwd <path>', 'Working directory', process.cwd())
  .action(run(async (summary: string, opts: { cwd: string }) => {
    const config = getConfig();
    const chronicle = new Scripsi(config);
    const url = await chronicle.logFromGit(summary, opts.cwd);
    console.log(`✅ Logged from branch: ${url}`);
  }));

program.parse();
