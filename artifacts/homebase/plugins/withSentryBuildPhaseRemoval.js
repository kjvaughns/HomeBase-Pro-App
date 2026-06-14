const { withXcodeProject } = require('expo/config-plugins');

module.exports = function withSentryBuildPhaseRemoval(config) {
  return withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const objects = xcodeProject.hash.project.objects;
    const shellScripts = objects['PBXShellScriptBuildPhase'] || {};

    const sentryUUIDs = Object.keys(shellScripts).filter((uuid) => {
      if (uuid.endsWith('_comment')) return false;
      const phase = shellScripts[uuid];
      return (
        phase &&
        typeof phase.name === 'string' &&
        phase.name.includes('Upload Debug Symbols to Sentry')
      );
    });

    if (sentryUUIDs.length === 0) return config;

    const nativeTargets = objects['PBXNativeTarget'] || {};
    for (const targetKey of Object.keys(nativeTargets)) {
      if (targetKey.endsWith('_comment')) continue;
      const target = nativeTargets[targetKey];
      if (!target || !Array.isArray(target.buildPhases)) continue;
      target.buildPhases = target.buildPhases.filter(
        (phase) => !sentryUUIDs.includes(phase.value)
      );
    }

    for (const uuid of sentryUUIDs) {
      delete shellScripts[uuid];
      delete shellScripts[`${uuid}_comment`];
    }

    return config;
  });
};
