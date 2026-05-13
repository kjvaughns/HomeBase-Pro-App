/**
 * Custom Expo config plugin that declares the iOS privacy manifest's
 * NSPrivacyCollectedDataTypes (App Store data-collection disclosures)
 * while preserving any NSPrivacyAccessedAPITypes / NSPrivacyTrackingDomains
 * Expo or other plugins already write.
 *
 * Sets config.ios.privacyManifests so Expo's built-in withPrivacyInfo merge
 * helper writes the final PrivacyInfo.xcprivacy.
 */

const COLLECTED_DATA_TYPES = [
  {
    NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeEmailAddress",
    NSPrivacyCollectedDataTypeLinked: true,
    NSPrivacyCollectedDataTypeTracking: false,
    NSPrivacyCollectedDataTypePurposes: [
      "NSPrivacyCollectedDataTypePurposeAppFunctionality",
      "NSPrivacyCollectedDataTypePurposeCustomerSupport",
    ],
  },
  {
    NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeName",
    NSPrivacyCollectedDataTypeLinked: true,
    NSPrivacyCollectedDataTypeTracking: false,
    NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
  },
  {
    NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePhoneNumber",
    NSPrivacyCollectedDataTypeLinked: true,
    NSPrivacyCollectedDataTypeTracking: false,
    NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
  },
  {
    NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePhysicalAddress",
    NSPrivacyCollectedDataTypeLinked: true,
    NSPrivacyCollectedDataTypeTracking: false,
    NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
  },
  {
    NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePreciseLocation",
    NSPrivacyCollectedDataTypeLinked: true,
    NSPrivacyCollectedDataTypeTracking: false,
    NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
  },
  {
    NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePhotosorVideos",
    NSPrivacyCollectedDataTypeLinked: true,
    NSPrivacyCollectedDataTypeTracking: false,
    NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
  },
  {
    NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePaymentInfo",
    NSPrivacyCollectedDataTypeLinked: true,
    NSPrivacyCollectedDataTypeTracking: false,
    NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
  },
  {
    NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeUserID",
    NSPrivacyCollectedDataTypeLinked: true,
    NSPrivacyCollectedDataTypeTracking: false,
    NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
  },
  {
    NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeDeviceID",
    NSPrivacyCollectedDataTypeLinked: true,
    NSPrivacyCollectedDataTypeTracking: false,
    NSPrivacyCollectedDataTypePurposes: [
      "NSPrivacyCollectedDataTypePurposeAppFunctionality",
      "NSPrivacyCollectedDataTypePurposeAnalytics",
    ],
  },
  {
    NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeProductInteraction",
    NSPrivacyCollectedDataTypeLinked: true,
    NSPrivacyCollectedDataTypeTracking: false,
    NSPrivacyCollectedDataTypePurposes: [
      "NSPrivacyCollectedDataTypePurposeAnalytics",
      "NSPrivacyCollectedDataTypePurposeAppFunctionality",
    ],
  },
  {
    NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeCrashData",
    NSPrivacyCollectedDataTypeLinked: false,
    NSPrivacyCollectedDataTypeTracking: false,
    NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
  },
  {
    NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePerformanceData",
    NSPrivacyCollectedDataTypeLinked: false,
    NSPrivacyCollectedDataTypeTracking: false,
    NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAnalytics"],
  },
  {
    NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeOtherDiagnosticData",
    NSPrivacyCollectedDataTypeLinked: false,
    NSPrivacyCollectedDataTypeTracking: false,
    NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAnalytics"],
  },
  {
    NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeOtherUserContent",
    NSPrivacyCollectedDataTypeLinked: true,
    NSPrivacyCollectedDataTypeTracking: false,
    NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
  },
];

module.exports = function withPrivacyManifest(config) {
  if (!config.ios) config.ios = {};
  const existing = config.ios.privacyManifests || {};
  const accessedApis = existing.NSPrivacyAccessedAPITypes || [];
  const trackingDomains = existing.NSPrivacyTrackingDomains || [];
  const tracking = existing.NSPrivacyTracking ?? false;

  config.ios.privacyManifests = {
    NSPrivacyTracking: tracking,
    NSPrivacyTrackingDomains: trackingDomains,
    NSPrivacyAccessedAPITypes: accessedApis,
    NSPrivacyCollectedDataTypes: COLLECTED_DATA_TYPES,
  };

  return config;
};
