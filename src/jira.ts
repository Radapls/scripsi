import { Config } from './config.js';

interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    status: { name: string };
    issuetype: { name: string };
    assignee?: { displayName: string };
    description?: string;
    project: { key: string; name: string };
    labels: string[];
    created: string;
    updated: string;
  };
}

export interface MinimalTicket {
  key: string;
  summary: string;
}

export interface TicketSummary {
  key: string;
  summary: string;
  status: string;
  type: string;
  project: string;
  projectName: string;
  labels: string[];
  created: string;
  updated: string;
  description: string;
}

export class JiraClient {
  private baseUrl: string;
  private token: string;
  private email: string;

  constructor(config: Config) {
    this.baseUrl = config.jira!.url;
    this.token = config.jira!.token;
    this.email = config.jira!.email;
  }

  private async request<T>(path: string): Promise<T> {
    const isCloud = this.baseUrl.includes('atlassian.net');
    const auth = isCloud ? Buffer.from(`${this.email}:${this.token}`).toString('base64') : null;
    const res = await fetch(`${this.baseUrl}/rest/api/2${path}`, {
      headers: {
        Authorization: auth ? `Basic ${auth}` : `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Jira API error ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.request('/myself');
      return true;
    } catch {
      return false;
    }
  }

  async getTicket(ticketKey: string): Promise<TicketSummary> {
    const issue = await this.request<JiraIssue>(`/issue/${ticketKey}`);
    return {
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      type: issue.fields.issuetype.name,
      project: issue.fields.project.key,
      projectName: issue.fields.project.name,
      labels: issue.fields.labels,
      created: issue.fields.created,
      updated: issue.fields.updated,
      description: issue.fields.description ?? '',
    };
  }
}
