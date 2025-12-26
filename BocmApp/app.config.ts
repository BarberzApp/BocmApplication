// Expo app config with small per-build-profile overrides needed for App Store builds.
// We keep `app.json` as the source of truth and apply targeted adjustments here.
// Docs: https://docs.expo.dev/workflow/configuration/
/* eslint-disable @typescript-eslint/no-var-requires */

import type { ExpoConfig, ConfigContext } from "expo/config";

const appJson = require("./app.json") as { expo: ExpoConfig };

function getApsEnvironment(buildProfile?: string): "development" | "production" {
  // For iOS, Ad Hoc/TestFlight/App Store distributions should use production APNs.
  // Development builds should use the sandbox (development) APNs environment.
  if (buildProfile === "development") return "development";
  return "production";
}

export default ({}: ConfigContext): ExpoConfig => {
  const base = appJson.expo;
  const easProfile = process.env.EAS_BUILD_PROFILE;
  const apsEnvironment = getApsEnvironment(easProfile);

  return {
    ...base,
    ios: {
      ...base.ios,
      // Ensure we always have an initial build number (EAS can auto-increment from here).
      buildNumber: base.ios?.buildNumber ?? "1",
      entitlements: {
        ...(base.ios?.entitlements ?? {}),
        "aps-environment": apsEnvironment,
      },
    },
    android: {
      ...base.android,
      // Ensure we always have an initial versionCode (EAS can auto-increment from here).
      versionCode: (base.android as any)?.versionCode ?? 1,
    },
  };
};


