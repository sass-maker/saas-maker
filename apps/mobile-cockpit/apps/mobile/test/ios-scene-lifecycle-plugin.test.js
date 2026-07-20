import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const sceneLifecyclePlugin = require("../plugins/with-ios-scene-lifecycle");

const generatedAppDelegate = `internal import Expo
import React
import ReactAppDependencyProvider

@main
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Linking API
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {}
`;

describe("iOS scene lifecycle config plugin", () => {
  it("creates the required single-window scene manifest without mutating input", () => {
    const input = { CFBundleDisplayName: "Mobile Dev Cockpit" };
    const result = sceneLifecyclePlugin.applySceneManifest(input);

    expect(result).not.toBe(input);
    expect(input).not.toHaveProperty("UIApplicationSceneManifest");
    expect(result.UIApplicationSceneManifest).toEqual({
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate",
          },
        ],
      },
    });
  });

  it("moves React Native window startup into a scene delegate", () => {
    const result =
      sceneLifecyclePlugin.transformAppDelegate(generatedAppDelegate);

    expect(result).toContain("class SceneDelegate: UIResponder");
    expect(result).toContain("UIWindowSceneDelegate");
    expect(result).toContain("configurationForConnecting");
    expect(result).toContain("UIWindow(windowScene: windowScene)");
    expect(result).toContain("UIApplicationLaunchOptionsURLKey");
    expect(result).toContain(
      "UIApplicationLaunchOptionsUserActivityDictionaryKey",
    );
    expect(result).toContain("sceneLaunchOptions: launchOptions");
    expect(result).not.toContain("UIWindow(frame: UIScreen.main.bounds)");
  });

  it("is idempotent", () => {
    const first =
      sceneLifecyclePlugin.transformAppDelegate(generatedAppDelegate);
    expect(sceneLifecyclePlugin.transformAppDelegate(first)).toBe(first);
  });

  it("fails loudly when the Expo AppDelegate template drifts", () => {
    expect(() =>
      sceneLifecyclePlugin.transformAppDelegate(
        generatedAppDelegate.replace(
          "  // Linking API\n",
          "  // Different linking section\n",
        ),
      ),
    ).toThrow("Expo AppDelegate template changed; missing linking section");
  });
});
