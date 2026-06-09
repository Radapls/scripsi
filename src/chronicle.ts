import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { Config } from './config.js';
import { GitLabClient } from './gitlab.js';
import { GitHubClient } from './github.js';
import { JiraClient, TicketSummary, MinimalTicket } from './jira.js';
import simpleGit from 'simple-git';

interface GitRemote {
  verifyConnection(): Promise<boolean>;
  findProject(name: string): Promise<{ id: number; http_url_to_repo: string } | null>;
  createProject(name: string, description: string): Promise<{ id: number; http_url_to_repo: string }>;
  getFile(projectId: number, filePath: string, branch?: string): Promise<string | null>;
  createOrUpdateFile(projectId: number, filePath: string, content: string, commitMessage: string, branch?: string): Promise<void>;
}

export class Scripsi {
  private git: GitRemote;
  private jira: JiraClient | null;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.git = config.provider === 'github'
      ? new GitHubClient(config)
      : new GitLabClient(config);
    this.jira = config.jira ? new JiraClient(config) : null;
  }

  async verify(): Promise<{ git: boolean; jira?: boolean; provider: string }> {
    const jiraPromise = this.jira
      ? this.jira.verifyConnection()
      : Promise.resolve(undefined);
    const [git, jira] = await Promise.all([
      this.git.verifyConnection(),
      jiraPromise,
    ]);
    return { git, jira, provider: this.config.provider };
  }

  private async ensureDocsRepo(projectSlug: string) {
    const repoName = `${this.config.docs.repoPrefix}-${projectSlug}`;
    let project = await this.git.findProject(repoName);

    if (!project) {
      console.log(`📁 Creating private docs repo: ${repoName}`);
      project = await this.git.createProject(repoName, `Development chronicle for ${projectSlug}`);
      await this.git.createOrUpdateFile(
        project.id,
        'README.md',
        `# Dev Chronicle: ${projectSlug}\n\nAuto-generated development documentation.\n\n## Entries\n\n`,
        'Initial commit: chronicle setup'
      );
    }

    return project;
  }

  async initProject(projectSlug: string, description?: string): Promise<string> {
    const project = await this.ensureDocsRepo(projectSlug);
    if (description) {
      await this.git.createOrUpdateFile(
        project.id,
        'PROJECT.md',
        `# ${projectSlug}\n\n${description}\n\nCreated: ${new Date().toISOString()}\n`,
        'docs: add project description'
      );
    }
    return project.http_url_to_repo;
  }

  async initProjectLocal(projectSlug: string, description?: string, basePath?: string): Promise<string> {
    const repoName = `${this.config.docs.repoPrefix}-${projectSlug}`;
    const repoDir = resolve(basePath ?? process.cwd(), repoName);

    if (existsSync(repoDir)) return repoDir;

    mkdirSync(repoDir, { recursive: true });
    mkdirSync(resolve(repoDir, 'entries'), { recursive: true });

    writeFileSync(
      resolve(repoDir, 'README.md'),
      `# Dev Chronicle: ${projectSlug}\n\nAuto-generated development documentation.\n\n## Entries\n\n`
    );

    if (description) {
      writeFileSync(
        resolve(repoDir, 'PROJECT.md'),
        `# ${projectSlug}\n\n${description}\n\nCreated: ${new Date().toISOString()}\n`
      );
    }

    const git = simpleGit(repoDir);
    await git.init();
    await git.add('.');
    await git.commit('Initial commit: chronicle setup');

    return repoDir;
  }

  async logTicket(ticketKey: string, changeSummary: string, projectSlug?: string): Promise<string> {
    if (this.jira) {
      const ticket = await this.jira.getTicket(ticketKey);
      const slug = projectSlug ?? ticket.project.toLowerCase();
      const project = await this.ensureDocsRepo(slug);

      const entry = this.buildEntry(ticket, changeSummary);
      const filePath = `entries/${ticketKey}.md`;

      const existing = await this.git.getFile(project.id, filePath);
      const content = existing
        ? `${existing}\n---\n\n${entry}`
        : `# ${ticketKey}: ${ticket.summary}\n\n${entry}`;

      await this.git.createOrUpdateFile(project.id, filePath, content, `docs: log work on ${ticketKey}`);
      await this.updateIndex(project.id, ticketKey, ticket.summary);

      return project.http_url_to_repo;
    } else {
      const slug = projectSlug ?? ticketKey.toLowerCase();
      const project = await this.ensureDocsRepo(slug);

      const ticket: MinimalTicket = { key: ticketKey, summary: changeSummary };
      const entry = this.buildEntry(ticket, changeSummary);
      const filePath = `entries/${ticketKey}.md`;

      const existing = await this.git.getFile(project.id, filePath);
      const content = existing
        ? `${existing}\n---\n\n${entry}`
        : `# ${ticketKey}: ${changeSummary}\n\n${entry}`;

      await this.git.createOrUpdateFile(project.id, filePath, content, `docs: log work on ${ticketKey}`);
      await this.updateIndex(project.id, ticketKey, changeSummary);

      return project.http_url_to_repo;
    }
  }

  async logFromGit(changeSummary: string, cwd: string): Promise<string> {
    const git = simpleGit(cwd);
    const branch = await git.revparse(['--abbrev-ref', 'HEAD']);

    const match = branch.match(/([A-Z]+-\d+)/);
    if (!match) throw new Error(`Could not extract ticket key from branch: ${branch}`);

    const ticketKey = match[1];
    const log = await git.log({ maxCount: 5 });
    const recentCommits = log.all
      .map(c => `- ${c.message} (${c.date.split('T')[0]})`)
      .join('\n');

    const fullSummary = `${changeSummary}\n\n### Recent Commits\n${recentCommits}`;
    return this.logTicket(ticketKey, fullSummary);
  }

  private buildEntry(ticket: TicketSummary | MinimalTicket, changeSummary: string): string {
    const now = new Date().toISOString();
    const lines: string[] = [
      `## Entry: ${now.split('T')[0]}`,
      '',
    ];

    if ('status' in ticket) {
      const t = ticket as TicketSummary;
      lines.push(
        `**Status:** ${t.status}`,
        `**Type:** ${t.type}`,
        `**Project:** ${t.projectName}`,
      );
      if (t.labels.length) {
        lines.push(`**Labels:** ${t.labels.join(', ')}`);
      }
    }

    lines.push(
      '',
      '### Changes Made',
      '',
      changeSummary,
      '',
      `_Logged at ${now}_`,
    );

    return lines.join('\n');
  }

  private async updateIndex(projectId: number, ticketKey: string, summary: string) {
    const readme = (await this.git.getFile(projectId, 'README.md')) ?? '';
    const link = `- [${ticketKey}](entries/${ticketKey}.md) - ${summary}`;
    if (!readme.includes(ticketKey)) {
      const updated = readme.trimEnd() + `\n${link}\n`;
      await this.git.createOrUpdateFile(projectId, 'README.md', updated, `docs: index ${ticketKey}`);
    }
  }
}
