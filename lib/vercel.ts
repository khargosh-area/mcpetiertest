import 'server-only';

/**
 * Minimal Vercel REST client used by the Deploy page to show live deployment
 * status. Everything degrades gracefully when the token is not configured.
 */
export interface VercelDeployment {
  id: string;
  name: string;
  url: string;
  state: string;
  createdAt: number;
  target: string;
  source?: string;
}

export interface VercelStatus {
  connected: boolean;
  projectName: string | null;
  projectId: string | null;
  account: string | null;
  deployments: VercelDeployment[];
  error?: string;
}

const API = 'https://api.vercel.com';

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
    'Content-Type': 'application/json'
  };
}

export async function getVercelStatus(): Promise<VercelStatus> {
  const token = process.env.VERCEL_TOKEN?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  if (!token || !projectId) {
    return {
      connected: false,
      projectName: null,
      projectId: projectId || null,
      account: process.env.VERCEL_TEAM_ID || null,
      deployments: []
    };
  }

  const query = new URLSearchParams({ projectId, limit: '6' });
  if (process.env.VERCEL_TEAM_ID) query.set('teamId', process.env.VERCEL_TEAM_ID);

  try {
    const [projectRes, deployRes] = await Promise.all([
      fetch(`${API}/v9/projects/${projectId}?${process.env.VERCEL_TEAM_ID ? `teamId=${process.env.VERCEL_TEAM_ID}` : ''}`, {
        headers: headers(),
        cache: 'no-store'
      }),
      fetch(`${API}/v6/deployments?${query.toString()}`, { headers: headers(), cache: 'no-store' })
    ]);

    if (!deployRes.ok) {
      return {
        connected: false,
        projectName: null,
        projectId,
        account: process.env.VERCEL_TEAM_ID || null,
        deployments: [],
        error: `Vercel API responded ${deployRes.status}`
      };
    }

    const deployJson = (await deployRes.json()) as { deployments?: any[] };
    const deployments: VercelDeployment[] = (deployJson.deployments || []).map(d => ({
      id: d.uid || d.id,
      name: d.name,
      url: d.url ? `https://${d.url}` : '',
      state: d.state || d.readyState || 'UNKNOWN',
      createdAt: d.created || d.createdAt || 0,
      target: d.target || 'production',
      source: d.meta?.githubCommitRef || d.gitSource?.ref
    }));

    let projectName: string | null = null;
    if (projectRes.ok) {
      const projectJson = (await projectRes.json()) as { name?: string };
      projectName = projectJson.name ?? null;
    }

    return {
      connected: true,
      projectName,
      projectId,
      account: process.env.VERCEL_TEAM_ID || null,
      deployments
    };
  } catch (error) {
    return {
      connected: false,
      projectName: null,
      projectId,
      account: process.env.VERCEL_TEAM_ID || null,
      deployments: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
