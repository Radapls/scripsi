# Scripsi

> From Latin *scripsi* — first person singular, perfect tense of *scribo* (to write). Literally: "I have written." Because every piece of work deserves to be recorded.

Self-documentation tool for AI-assisted development work. Automatically creates and maintains private repos documenting your work per project/ticket.

Supports **GitLab**, **GitHub**, and **local-only** repos.

## Setup

```bash
git clone <this-repo>
cd scripsi
cp .env.example .env
# Edit .env with your credentials
npm install
```

### Required Credentials

1. **Git Provider** — Set `GIT_PROVIDER` to `gitlab` or `github`
2. **GitLab** — Personal Access Token with `api` scope (if using GitLab)
3. **GitHub** — Personal Access Token with `repo` scope (if using GitHub)
4. **Jira** — API token or PAT depending on your Jira instance

## Usage

### Verify connections
```bash
npx tsx src/cli.ts verify
```

### Create docs for a project
```bash
# Remote (GitLab or GitHub depending on GIT_PROVIDER)
npx tsx src/cli.ts init my-project -d "Project description"

# Local only (no remote push)
npx tsx src/cli.ts init my-project -d "Project description" --local
npx tsx src/cli.ts init my-project -d "Project description" --local /path/to/dir
```

### Log work for a ticket
```bash
npx tsx src/cli.ts log PROJ-123 "Implemented feature X"
npx tsx src/cli.ts log PROJ-456 "Fixed bug Y" -p my-project
```

### Log from current branch
```bash
# Inside a git repo on branch feature/PROJ-123-some-feature
npx tsx src/cli.ts log-branch "Added feature and fixed edge cases"
```

This extracts the ticket key from your branch name and includes your last 5 commits.

## How It Works

1. Validates the Jira ticket exists and pulls metadata
2. Finds or creates a private repo: `scripsi-{project}`
3. Creates/appends an entry in `entries/{TICKET}.md` with:
   - Ticket metadata (status, type, labels)
   - Your change summary
   - Timestamp
4. Updates the repo README index

## Structure of Generated Repos

```
scripsi-{project}/
├── README.md          # Index of all entries
├── PROJECT.md         # Project description
└── entries/
    ├── PROJ-123.md    # All work logged for PROJ-123
    ├── PROJ-456.md    # All work logged for PROJ-456
    └── ...
```

## License

[MIT](LICENSE)
