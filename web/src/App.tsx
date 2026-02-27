import { useWebSocket } from './hooks/useWebSocket';
import { useTrafficStore } from './stores/trafficStore';
import { Toolbar } from './components/layout/Toolbar';
import { StatusBar } from './components/layout/StatusBar';
import { Sidebar } from './components/layout/Sidebar';
import { RequestList } from './components/traffic/RequestList';
import { RequestDetail } from './components/traffic/RequestDetail';
import { UnknownHostRequestsPanel } from './components/traffic/UnknownHostRequestsPanel';
import { ParsePage } from './components/parse/ParsePage';

export default function App() {
  useWebSocket();
  const selectedRequestId = useTrafficStore((s) => s.selectedRequestId);
  const currentView = useTrafficStore((s) => s.currentView);
  const selectedUnknownHost = useTrafficStore((s) => s.selectedUnknownHost);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-surface-1 relative">
      <Toolbar />
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <div className="flex-1 flex min-w-0 border-l border-border">
          <RequestList />
          {selectedUnknownHost && (
            <div className="w-[45%] min-w-[360px] border-l border-border bg-surface-1 overflow-hidden">
              <UnknownHostRequestsPanel />
            </div>
          )}
          {!selectedUnknownHost && selectedRequestId && (
            <div className="w-[45%] min-w-[360px] border-l border-border bg-surface-1 overflow-hidden">
              <RequestDetail />
            </div>
          )}
        </div>
      </div>
      <StatusBar />

      {currentView === 'parse' && (
        <div className="absolute inset-0 z-20 bg-surface-1">
          <ParsePage />
        </div>
      )}
    </div>
  );
}
