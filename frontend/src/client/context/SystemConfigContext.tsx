import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchSystemConfig, DEFAULT_SYSTEM_CONFIG, type SystemConfig } from "@/client/api/config";

interface SystemConfigContextValue {
  config: SystemConfig;
  loading: boolean;
}

const SystemConfigContext = createContext<SystemConfigContextValue>({
  config: DEFAULT_SYSTEM_CONFIG,
  loading: true,
});

export function SystemConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_SYSTEM_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSystemConfig()
      .then(setConfig)
      .finally(() => setLoading(false));
  }, []);

  return (
    <SystemConfigContext.Provider value={{ config, loading }}>
      {children}
    </SystemConfigContext.Provider>
  );
}

export function useSystemConfig(): SystemConfigContextValue {
  return useContext(SystemConfigContext);
}
