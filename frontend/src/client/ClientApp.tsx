import FigmaApp from '@/client/app/App';
import { LoyaltyProvider } from '@/client/app/context/LoyaltyContext';
import { NotificationsProvider } from '@/client/context/NotificationsContext';
import { SystemConfigProvider } from '@/client/context/SystemConfigContext';

export default function ClientApp() {
  return (
    <SystemConfigProvider>
      <LoyaltyProvider>
        <NotificationsProvider>
          <FigmaApp />
        </NotificationsProvider>
      </LoyaltyProvider>
    </SystemConfigProvider>
  );
}
