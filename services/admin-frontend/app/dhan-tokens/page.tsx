import DhanTokenManager from '@/components/DhanTokenManager';

export default function DhanTokensPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dhan API Tokens</h1>
        <p className="text-muted-foreground">
          Manage authentication tokens for the Dhan API ingestion service.
        </p>
      </div>
      
      <DhanTokenManager />
    </div>
  );
}
