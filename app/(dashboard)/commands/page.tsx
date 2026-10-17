import { COMMAND_CATALOG, MODES, TIERS, MODE_ICONS, roleName, aestheticTier } from '@/src/core/config.js';
import { IconCommand, IconCheck, IconAlert } from '@/components/icons';

export const dynamic = 'force-dynamic';

export default function CommandsPage() {
  return (
    <main className="page">
      <div className="mb" style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 20, letterSpacing: '-0.3px' }}>Slash commands</h2>
        <p className="faint" style={{ margin: '3px 0 0', fontSize: 12.5 }}>
          Everything the bot registers with Discord. Commands are synced automatically when the bot starts.
        </p>
      </div>

      <div className="grid cols-2 mb">
        {COMMAND_CATALOG.map(command => (
          <div className="card" key={command.name}>
            <div className="card-head">
              <h2 className="mono">/{command.name}</h2>
              <span className={`pill ${command.permission === 'Everyone' ? 'mute' : 'violet'}`}>{command.permission}</span>
            </div>
            <div className="card-body">
              <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>{command.description}</p>
              {command.options.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Option</th>
                        <th>Type</th>
                        <th>Required</th>
                      </tr>
                    </thead>
                    <tbody>
                      {command.options.map(option => (
                        <tr key={option.name}>
                          <td className="mono">{option.name}</td>
                          <td>
                            {option.type}
                            {option.choices ? (
                              <span className="faint" style={{ display: 'block', fontSize: 11 }}>
                                {option.choices.join(' · ')}
                              </span>
                            ) : null}
                          </td>
                          <td>
                            {option.required ? (
                              <span className="pill err">required</span>
                            ) : (
                              <span className="pill mute">optional</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <span className="faint" style={{ fontSize: 12.5 }}>No options</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card-head">
            <h2>Testing modes</h2>
            <span className="sub">{MODES.length} configured</span>
          </div>
          <div className="card-body">
            <div className="mode-chips">
              {MODES.map(mode => (
                <span className="mode-chip" key={mode}>{MODE_ICONS[mode]} {mode}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Tier ladder</h2>
            <span className="sub">{TIERS.length} tiers per mode</span>
          </div>
          <div className="card-body">
            <div className="mode-chips">
              {TIERS.map(tier => (
                <span className="mode-chip mono" key={tier}>{tier}</span>
              ))}
            </div>
            <p className="faint mt" style={{ fontSize: 12, marginBottom: 0 }}>
              Every mode creates one role per tier, e.g.{' '}
              <code className="mono">{roleName('Axe', 'LT1')}</code> →{' '}
              <code className="mono">{aestheticTier('LT1')}</code>.
            </p>
          </div>
        </div>
      </div>

      <div className="alert mt">
        <IconCommand />
        <div>
          <b>Discord setup reminder:</b> the bot needs the <b>Manage Roles</b>, <b>Manage Channels</b> and{' '}
          <b>Manage Server</b> permissions, and its highest role must sit above the tier roles it creates.
        </div>
      </div>

      <div className="alert warn mt">
        <IconAlert />
        <div>
          <b>Keep your token secret.</b> Never paste <code className="mono">DISCORD_TOKEN</code> into chat, commit it to
          GitHub, or expose it in a client-side variable. If it leaks, reset it in the Discord Developer Portal.
        </div>
      </div>
    </main>
  );
}
