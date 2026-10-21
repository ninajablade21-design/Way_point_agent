import { createContext, useContext, useEffect, useState, type ReactNode, useCallback } from 'react';
import type { Report } from '@/types';
import { repo } from '@/services/storage';
import { seedDemoData } from '@/services/seed';

interface ReportsCtx {
  reports: Report[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const Ctx = createContext<ReportsCtx>({
  reports: [],
  loading: true,
  error: null,
  refresh: async () => {},
});

export function useReports() {
  return useContext(Ctx);
}

export function ReportsProvider({ children }: { children: ReactNode }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const data = await repo.listReports();
      setReports(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await seedDemoData();
      } catch (e) {
        // Most often: Supabase is configured but the migration has not been applied yet.
        setError((e as Error).message);
        setLoading(false);
        return;
      }
      await refresh();
    })();
  }, [refresh]);

  return <Ctx.Provider value={{ reports, loading, error, refresh }}>{children}</Ctx.Provider>;
}
