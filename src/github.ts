import { Config } from './config.js';

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  clone_url: string;
}

export class GitHubClient {
  private token: string;
  private username: string;

  constructor(config: Config) {
    this.token = config.github!.token;
    this.username = config.github!.username;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`https://api.github.com${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub API error ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.request('/user');
      return true;
    } catch {
      return false;
    }
  }

  async findProject(name: string): Promise<{ id: number; http_url_to_repo: string } | null> {
    try {
      const repo = await this.request<GitHubRepo>(`/repos/${this.username}/${name}`);
      return { id: repo.id, http_url_to_repo: repo.clone_url };
    } catch {
      return null;
    }
  }

  async createProject(name: string, description: string): Promise<{ id: number; http_url_to_repo: string }> {
    const repo = await this.request<GitHubRepo>('/user/repos', {
      method: 'POST',
      body: JSON.stringify({
        name,
        description,
        private: true,
        auto_init: true,
      }),
    });
    return { id: repo.id, http_url_to_repo: repo.clone_url };
  }

  async getFile(projectId: number, filePath: string, branch = 'main'): Promise<string | null> {
    try {
      const repo = await this.getRepoFullName(projectId);
      const res = await this.request<{ content: string; sha: string }>(
        `/repos/${repo}/contents/${encodeURIComponent(filePath)}?ref=${branch}`
      );
      return Buffer.from(res.content, 'base64').toString('utf-8');
    } catch {
      return null;
    }
  }

  async getFileSha(projectId: number, filePath: string, branch = 'main'): Promise<string | null> {
    try {
      const repo = await this.getRepoFullName(projectId);
      const res = await this.request<{ sha: string }>(
        `/repos/${repo}/contents/${encodeURIComponent(filePath)}?ref=${branch}`
      );
      return res.sha;
    } catch {
      return null;
    }
  }

  async createOrUpdateFile(
    projectId: number,
    filePath: string,
    content: string,
    commitMessage: string,
    branch = 'main'
  ): Promise<void> {
    const repo = await this.getRepoFullName(projectId);
    const sha = await this.getFileSha(projectId, filePath, branch);
    const body: Record<string, string> = {
      message: commitMessage,
      content: Buffer.from(content).toString('base64'),
      branch,
    };
    if (sha) body.sha = sha;

    await this.request(`/repos/${repo}/contents/${encodeURIComponent(filePath)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  private async getRepoFullName(projectId: number): Promise<string> {
    const repo = await this.request<GitHubRepo>(`/repositories/${projectId}`);
    return repo.full_name;
  }
}
