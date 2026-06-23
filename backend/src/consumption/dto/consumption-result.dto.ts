import { ConsumptionEventDto } from './consumption-event.dto';

/** Response body for a successful POST /api/consumption. */
export interface ConsumptionResultDto {
  event: ConsumptionEventDto;
  walletBalance: number;
  /** True when the server replayed a previous request (same Idempotency-Key) instead of charging again. */
  replayed: boolean;
}
