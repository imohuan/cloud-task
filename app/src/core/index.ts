/**
 * 核心层统一导出
 */

// Contracts
export type {
  FieldType,
  FieldDefinition,
  InputSchema,
  OutputSchema,
  AuthSchema,
} from '@core/contracts/field-definition';

export type {
  ExecutionMode,
  ApiCallContext,
  SyncApiResult,
  AsyncTaskResult,
  ApiMetadata,
} from '@core/contracts/api.types';

export type {
  AuthProfile,
  AuthContext,
  AuthStrategyMetadata,
} from '@core/contracts/auth.types';

// Domain
export { BasePlatformProvider } from '@core/domain/platform/base-platform.provider';
export type { PlatformMetadata, CategoryMetadata } from '@core/domain/platform/base-platform.provider';

export { BaseAuthStrategy } from '@core/domain/auth/base-auth.strategy';

export { BaseApiHandler } from '@core/domain/api/base-api.handler';

// Ports
export type {
  AuthProfileRepository,
} from '@core/ports/auth-profile.repository';

export type {
  TaskRunRepository,
  TaskRun,
  TaskStatus,
} from '@core/ports/task-run.repository';

export type {
  TaskDispatcherPort,
} from '@core/ports/task-dispatcher.port';

export type {
  HttpClientPort,
} from '@core/ports/http-client.port';

// Application
export { RegistryCenter, registry } from '@core/application/registry/registry-center';
