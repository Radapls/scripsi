#!/usr/bin/env node
import { Command } from 'commander';
import { getConfig } from './config.js';
import { Scripsi } from './chronicle.js';

const program = new Command();

program
  .name('scripsi')
  .description('Scripsi — self-documentation tool for AI-assisted development work')
  .version('1.0.0');

program
  .command('verify')
  .description('Verify GitLab and Jira connections')
  .action(async () => {
    const config = getConfig();
    const chronicle = new Scripsi(config);
    const status = await chronicle.verify();
    const label = status.provider === 'github' ? 'GitHub' : 'GitLab';
    console.log(`${label}: ${status.git ? '✅ Connected' : '❌ Failed'}`);
    console.log(`Jira:   ${status.jira ? '✅ Connected' : '❌ Failed'}`);
    if (!status.git || !status.jira) process.exit(1);
  });

program
  .command('init')
  .description('Create a new docs repo for a project')
  .argument('<project-slug>', 'Project identifier (e.g., constellations, side-project)')
  .option('-d, --description <desc>', 'Project description')
  .option('--local [path]', 'Create repo locally instead of pushing to GitLab (optional: specify path)')
  .action(async (slug: string, opts: { description?: string; local?: string | boolean }) => {
    const config = getConfig();
    const chronicle = new Scripsi(config);
    const url = opts.local
      ? await chronicle.initProjectLocal(slug, opts.description, typeof opts.local === 'string' ? opts.local : undefined)
      : await chronicle.initProject(slug, opts.description);
    console.log(`✅ Docs repo ready: ${url}`);
  });

program
  .command('log')
  .description('Log work done for a Jira ticket')
  .argument('<ticket>', 'Jira ticket key (e.g., RMD-123)')
  .argument('<summary>', 'Summary of changes made')
  .option('-p, --project <slug>', 'Override project slug (defaults to Jira project key)')
  .action(async (ticket: string, summary: string, opts: { project?: string }) => {
    const config = getConfig();
    const chronicle = new Scripsi(config);
    const url = await chronicle.logTicket(ticket, summary, opts.project);
    console.log(`✅ Logged work on ${ticket}: ${url}`);
  });

program
  .command('log-branch')
  .description('Log work from current git branch (extracts ticket from branch name)')
  .argument('<summary>', 'Summary of changes made')
  .option('-c, --cwd <path>', 'Working directory', process.cwd())
  .action(async (summary: string, opts: { cwd: string }) => {
    const config = getConfig();
    const chronicle = new Scripsi(config);
    const url = await chronicle.logFromGit(summary, opts.cwd);
    console.log(`✅ Logged from branch: ${url}`);
  });

program.parse();
