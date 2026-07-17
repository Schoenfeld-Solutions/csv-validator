import { describe, expect, it } from "vitest";

import {
  createLatestOperationIdTracker,
  createWorkerOperationCoordinator,
} from "../../src/lib/datev/operation-correlation";

describe("worker operation correlation", () => {
  it("uses one monotonic sequence while tracking operation kinds independently", () => {
    const coordinator = createWorkerOperationCoordinator();

    const firstValidation = coordinator.begin("validation");
    const contractLoad = coordinator.begin("contract-load");
    const secondValidation = coordinator.begin("validation");

    expect(firstValidation).toEqual({
      operationId: 1,
      operationKind: "validation",
    });
    expect(contractLoad.operationId).toBe(2);
    expect(secondValidation.operationId).toBe(3);
    expect(coordinator.isCurrent(firstValidation)).toBe(false);
    expect(coordinator.isCurrent(contractLoad)).toBe(true);
    expect(coordinator.isCurrent(secondValidation)).toBe(true);
  });

  it("accepts a current completion exactly once and rejects invalidated work", () => {
    const coordinator = createWorkerOperationCoordinator();
    const validation = coordinator.begin("validation");
    const contractEdit = coordinator.begin("contract-edit");

    expect(coordinator.complete(validation)).toBe(true);
    expect(coordinator.complete(validation)).toBe(false);

    coordinator.invalidate("contract-edit");
    expect(coordinator.isCurrent(contractEdit)).toBe(false);
    expect(coordinator.complete(contractEdit)).toBe(false);
  });

  it("allows only the latest externally assigned operation to publish", () => {
    const tracker = createLatestOperationIdTracker();

    tracker.begin(41);
    expect(tracker.isCurrent(41)).toBe(true);

    tracker.begin(42);
    expect(tracker.isCurrent(41)).toBe(false);
    expect(tracker.isCurrent(42)).toBe(true);
  });
});
