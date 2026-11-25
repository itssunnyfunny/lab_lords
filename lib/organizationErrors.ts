export const ORGANIZATION_ACCESS_NOT_FOUND_MESSAGE = "Organization not found";

export class OrganizationAccessNotFoundError extends Error {
  readonly code = "ORGANIZATION_NOT_FOUND";

  constructor() {
    super(ORGANIZATION_ACCESS_NOT_FOUND_MESSAGE);
    this.name = "OrganizationAccessNotFoundError";
  }
}

export class OrganizationValidationError extends Error {
  readonly code = "ORGANIZATION_INVALID_REQUEST";

  constructor(message: string) {
    super(message);
    this.name = "OrganizationValidationError";
  }
}

export class AnalyticsScopeChangedError extends Error {
  constructor() { super("Branch access changed while loading this report. Refresh to see the current branches.") }
}
