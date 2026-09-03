export const fixtureManifests = [
  { id: "entitlement-service", description: "Fictional Northstar access grant service", visibleRoot: "fixtures/entitlement-service", trustedChecks: ["unit", "typecheck"] },
  { id: "webhook-worker", description: "Fictional Bluebird webhook delivery worker", visibleRoot: "fixtures/webhook-worker", trustedChecks: ["unit", "typecheck"] },
  { id: "react-access-console", description: "Fictional Acorn access administration console", visibleRoot: "fixtures/react-access-console", trustedChecks: ["unit", "typecheck", "accessibility"] },
] as const;
