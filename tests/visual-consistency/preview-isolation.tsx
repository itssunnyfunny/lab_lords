// The historical organization prototype must not inject CSS or history guards
// into checks of the integrated production Basic workspace.
export const previewEnabled = () => false;
export const identityKey = () => "isolated-production-components";
export const allowNavigation = () => true;
export const installNavigationProtection = () => {};
export const installFixtureTransport = () => {};
export const OrganizationPreview = () => null;
