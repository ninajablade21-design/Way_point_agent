import { HashRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { ToastProvider } from '@/components/ui/Toast';
import { ReportsProvider } from '@/hooks/useReports';
import { Dashboard } from '@/pages/Dashboard';
import { LiveMap } from '@/pages/LiveMap';
import { ReportForm } from '@/pages/ReportForm';
import { ReportDetails } from '@/pages/ReportDetails';
import { Agent } from '@/pages/Agent';
import { Complaints } from '@/pages/Complaints';
import { Weather } from '@/pages/Weather';

function App() {
  return (
    <ToastProvider>
      <ReportsProvider>
        <HashRouter>
          <AppShell>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/map" element={<LiveMap />} />
              <Route path="/report" element={<ReportForm />} />
              <Route path="/report/:id" element={<ReportDetails />} />
              <Route path="/agent" element={<Agent />} />
              <Route path="/complaints" element={<Complaints />} />
              <Route path="/weather" element={<Weather />} />
            </Routes>
          </AppShell>
        </HashRouter>
      </ReportsProvider>
    </ToastProvider>
  );
}

export default App;
