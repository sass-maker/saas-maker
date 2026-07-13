import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const deploymentTargetPlugin = require("../plugins/with-ios-pod-deployment-target");

const generatedPodfile = `target 'MobileDevCockpit' do
  use_expo_modules!

  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
    )
  end
end
`;

describe("iOS pod deployment-target config plugin", () => {
  it("raises generated pod targets below the app deployment floor", () => {
    const result = deploymentTargetPlugin.transformPodfile(generatedPodfile);

    expect(deploymentTargetPlugin.minimumDeploymentTarget).toBe("16.4");
    expect(result).toContain(
      "minimum_deployment_target = Gem::Version.new('16.4')",
    );
    expect(result).toContain("installer.pods_project.targets.each");
    expect(result).toContain("Gem::Version.correct?(deployment_target)");
    expect(result).toContain(
      "config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = minimum_deployment_target.to_s",
    );
  });

  it("applies the generated block inside post_install", () => {
    const result = deploymentTargetPlugin.transformPodfile(generatedPodfile);

    expect(result.indexOf("react_native_post_install")).toBeLessThan(
      result.indexOf("minimum_deployment_target"),
    );
    expect(result.indexOf("minimum_deployment_target")).toBeLessThan(
      result.lastIndexOf("  end\nend"),
    );
  });

  it("is idempotent", () => {
    const first = deploymentTargetPlugin.transformPodfile(generatedPodfile);
    expect(deploymentTargetPlugin.transformPodfile(first)).toBe(first);
  });

  it("fails loudly when the Expo Podfile template drifts", () => {
    expect(() =>
      deploymentTargetPlugin.transformPodfile(
        generatedPodfile.replace("  post_install", "  after_install"),
      ),
    ).toThrow("Expo Podfile template changed; missing post_install block");
  });
});
