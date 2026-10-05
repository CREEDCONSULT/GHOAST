import { AppShell } from '@/components/AppShell';
import { ReturnConfirm } from '@/components/ReturnConfirm';
import { ToastProvider } from '@/components/Toast';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AppShell>{children}</AppShell>
      <ReturnConfirm />
    </ToastProvider>
  );
}
