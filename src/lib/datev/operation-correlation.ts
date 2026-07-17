import type { WorkerOperationKind, WorkerOperationReference } from "./types";

export interface WorkerOperationCoordinator {
  begin<OperationKind extends WorkerOperationKind>(
    operationKind: OperationKind
  ): WorkerOperationReference<OperationKind>;
  complete(operation: WorkerOperationReference): boolean;
  invalidate(operationKind: WorkerOperationKind): void;
  isCurrent(operation: WorkerOperationReference): boolean;
}

export const createWorkerOperationCoordinator =
  (): WorkerOperationCoordinator => {
    let nextOperationId = 0;
    const currentOperationIds: Partial<Record<WorkerOperationKind, number>> =
      {};

    const isCurrent = (operation: WorkerOperationReference): boolean =>
      currentOperationIds[operation.operationKind] === operation.operationId;

    return {
      begin: <OperationKind extends WorkerOperationKind>(
        operationKind: OperationKind
      ): WorkerOperationReference<OperationKind> => {
        nextOperationId += 1;
        currentOperationIds[operationKind] = nextOperationId;
        return { operationId: nextOperationId, operationKind };
      },
      complete: (operation): boolean => {
        if (!isCurrent(operation)) return false;
        currentOperationIds[operation.operationKind] = undefined;
        return true;
      },
      invalidate: (operationKind): void => {
        currentOperationIds[operationKind] = undefined;
      },
      isCurrent,
    };
  };

export interface LatestOperationIdTracker {
  begin(operationId: number): void;
  isCurrent(operationId: number): boolean;
}

export const createLatestOperationIdTracker = (): LatestOperationIdTracker => {
  let currentOperationId: number | undefined;
  return {
    begin: (operationId): void => {
      currentOperationId = operationId;
    },
    isCurrent: (operationId): boolean => currentOperationId === operationId,
  };
};
