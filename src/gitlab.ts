import { Config } from './config.js';

interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  http_url_to_repo: string;
  ssh_url_to_repo: string;
}

interface GitLabFile {
  file_path: string;
  content: string;
}

export class GitLabClient {
  private baseUrl: string;
  private token: string;
  private username: string;

  constructor(config: Config) {
    this.baseUrl = `${config.gitlab.url}/api/v4`;
    this.token = config.gitlab.token;
    this.username = config.gitlab.username;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'PRIVATE-TOKEN': this.token,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitLab API error ${res.status}: ${body}`);
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

  async findProject(name: string): Promise<GitLabProject | null> {
    const projects = await this.request<GitLabProject[]>(
      `/users/${this.username}/projects?search=${encodeURIComponent(name)}`
    );
    return projects.find(p => p.name === name) ?? null;
  }

  async createProject(name: string, description: string): Promise<GitLabProject> {
    return this.request<GitLabProject>('/projects', {
      method: 'POST',
      body: JSON.stringify({
        name,
        description,
        visibility: 'private',
        initialize_with_readme: true,
      }),
    });
  }

  async getFile(projectId: number, filePath: string, branch = 'main'): Promise<string | null> {
    try {
      const file = await this.request<GitLabFile>(
        `/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}?ref=${branch}`
      );
      return Buffer.from(file.content, 'base64').toString('utf-8');
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
    const existing = await this.getFile(projectId, filePath, branch);
    const method = existing !== null ? 'PUT' : 'POST';

    await this.request(`/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}`, {
      method,
      body: JSON.stringify({
        branch,
        content,
        commit_message: commitMessage,
      }),
    });
  }
}
