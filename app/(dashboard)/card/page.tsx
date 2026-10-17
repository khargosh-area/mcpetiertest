import CardDesigner from '@/components/card-designer';

export const dynamic = 'force-dynamic';

export default function CardPage() {
  return (
    <main className="page">
      <div className="mb" style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 20, letterSpacing: '-0.3px' }}>Tier card designer</h2>
        <p className="faint" style={{ margin: '3px 0 0', fontSize: 12.5 }}>
          Preview the premium tier card exactly as the bot posts it in Discord.
        </p>
      </div>
      <CardDesigner />
    </main>
  );
}
