import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { KDSTerminalLogin } from "./kds-terminal-login";
import { KDSProductionQueue } from "./kds-production-queue";
import { useAuth } from "@/admin/utils/auth-context";

type StationType = "FRY" | "CURRY" | "RICE" | "PREP" | "GRILL" | "DESSERT" | "HEAD_CHEF";

const VALID_STATIONS: StationType[] = ["FRY", "CURRY", "RICE", "PREP", "GRILL", "DESSERT", "HEAD_CHEF"];

export function MochaKDS() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Normalize kitchenStation to uppercase so "fry" matches "FRY" etc.
  const normalizedStation = user?.kitchenStation?.toUpperCase() as StationType | undefined;

  // Auto-derive station from the logged-in chef's kitchenStation.
  // Admins/managers always see the full picker (null → show login screen).
  // Chef role always auto-enters — uses their assigned station or HEAD_CHEF as default.
  const autoStation: StationType | null =
    user?.role === 'chef'
      ? (normalizedStation && VALID_STATIONS.includes(normalizedStation) ? normalizedStation : 'HEAD_CHEF')
      : null;

  const fromPath = (() => {
    const parts = location.pathname.toLowerCase().split('/').filter(Boolean);
    const kitchenIndex = parts.indexOf('kitchen');
    const pathStation = kitchenIndex >= 0 ? parts[kitchenIndex + 1] : undefined;
    if (!pathStation) return null;
    const mapped = pathStation.replace('-', '_').toUpperCase() as StationType;
    return VALID_STATIONS.includes(mapped) ? mapped : null;
  })();

  const [loggedInStation, setLoggedInStation] = useState<StationType | null>(fromPath || autoStation);

  const buildKitchenPath = (station?: StationType) => {
    const slug = station ? `/${station.toLowerCase().replace('_', '-')}` : '';
    const base = location.pathname.startsWith('/admin') ? '/admin/kitchen' : '/kitchen';
    return `${base}${slug}`;
  };

  const handleLogin = (station: StationType) => {
    setLoggedInStation(station);
    navigate(buildKitchenPath(station));
  };

  const handleLogout = () => {
    // Clear auth/session first so logout never requires a second click.
    logout();
    setLoggedInStation(null);
    navigate('/admin', { replace: true });
  };

  useEffect(() => {
    if (fromPath && fromPath !== loggedInStation) {
      setLoggedInStation(fromPath);
    }
  }, [fromPath, loggedInStation]);

  if (!loggedInStation) {
    return <KDSTerminalLogin onLogin={handleLogin} />;
  }

  return <KDSProductionQueue station={loggedInStation} onLogout={handleLogout} />;
}
