// Optional PM2 process supervisor configuration for self-hosted deployments.
module.exports = {
  apps: [{
    name: 'tiertestbot',
    script: 'index.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_restarts: 20,
    min_uptime: '10s',
    restart_delay: 5000,
    kill_timeout: 15000,
    env: { NODE_ENV: 'production' }
  }]
};
