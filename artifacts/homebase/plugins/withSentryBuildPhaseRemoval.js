const { withXcodeProject } = require('expo/config-plugins');

module.exports = function withSentryBuildPhaseRemoval(config) {
  return withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const targets = xcodeProject.hash.project.objects.PBXNativeTarget || {};

    Object.values(targets).forEach((target) => {
      if (!target.buildPhases) return;
      target.buildPhases = target.buildPhases.filter((phaseRef) => {
        const key = phaseRef.value || phaseRef;
        const scripts = xcodeProject.hash.project.objects.PBXShellScriptBuildPhase || {};
        const phase = scripts[key];
        if (!phase) return true;
        const name = (phase.name || '').replace(/"/g, '');
        return !name.includes('Upload Debug Symbols to Sentry');
      });
    });

    return config;
  });
};
