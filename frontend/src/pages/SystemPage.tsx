import Stack from '@mui/material/Stack';
import { PageHeader } from '../components/PageHeader';
import { SystemMetricsPanel } from '../components/SystemMetricsPanel';

export function SystemPage() {
  return (
    <Stack spacing={4}>
      <PageHeader
        title="Live proof"
        subtitle="Real-time runtime metrics from the backend replicas behind the gateway."
      />
      <SystemMetricsPanel />
    </Stack>
  );
}
