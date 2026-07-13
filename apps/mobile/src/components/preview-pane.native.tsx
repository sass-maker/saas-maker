import { useEffect, useRef, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import * as Sharing from "expo-sharing";
import * as ScreenOrientation from "expo-screen-orientation";
import { captureRef } from "react-native-view-shot";
import { WebView } from "react-native-webview";
import { Button } from "./ui";
import { colors } from "../lib/theme";

interface PreviewPaneProps {
  url: string;
  canSendToAgent: boolean;
  onSendToAgent: (attachment: {
    mimeType: "image/jpeg";
    base64: string;
  }) => Promise<void>;
}

export function PreviewPane({
  url,
  canSendToAgent,
  onSendToAgent,
}: PreviewPaneProps) {
  const webView = useRef<WebView>(null);
  const captureTarget = useRef<View>(null);
  const [landscape, setLandscape] = useState(false);
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    message: string;
  }>();

  useEffect(() => {
    return () => {
      void ScreenOrientation.unlockAsync();
    };
  }, []);

  const capture = async (): Promise<void> => {
    if (!captureTarget.current) return;
    setFeedback(undefined);
    try {
      const uri = await captureRef(captureTarget.current, {
        format: "png",
        quality: 1,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "image/png" });
        setFeedback({ kind: "success", message: "Screenshot shared." });
      } else {
        setFeedback({ kind: "success", message: `Screenshot saved at ${uri}` });
      }
    } catch (error) {
      setFeedback({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Screenshot capture failed",
      });
    }
  };

  const sendToAgent = async (): Promise<void> => {
    if (!captureTarget.current) return;
    setSending(true);
    setFeedback(undefined);
    try {
      const base64 = await captureRef(captureTarget.current, {
        format: "jpg",
        quality: 0.65,
        result: "base64",
      });
      await onSendToAgent({ mimeType: "image/jpeg", base64 });
      setFeedback({ kind: "success", message: "Screenshot sent to agent." });
    } catch (error) {
      setFeedback({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Screenshot delivery failed",
      });
    } finally {
      setSending(false);
    }
  };

  const rotate = async (): Promise<void> => {
    const next = !landscape;
    try {
      await ScreenOrientation.lockAsync(
        next
          ? ScreenOrientation.OrientationLock.LANDSCAPE
          : ScreenOrientation.OrientationLock.PORTRAIT_UP,
      );
      setLandscape(next);
    } catch (error) {
      setFeedback({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Orientation change failed",
      });
    }
  };

  const nextTheme = (): void => {
    setTheme((current) =>
      current === "system" ? "light" : current === "light" ? "dark" : "system",
    );
  };

  const themeScript = `(() => {
    const root = document.documentElement;
    root.dataset.theme = ${JSON.stringify(theme)};
    root.style.colorScheme = ${JSON.stringify(theme === "system" ? "light dark" : theme)};
    window.dispatchEvent(new CustomEvent('mobile-dev-cockpit-theme', { detail: ${JSON.stringify(theme)} }));
  })(); true;`;

  return (
    <View style={styles.frame}>
      <View style={styles.toolbar}>
        <Button variant="secondary" onPress={() => webView.current?.goBack()}>
          Back
        </Button>
        <Button variant="secondary" onPress={() => webView.current?.reload()}>
          Refresh
        </Button>
        <Button variant="secondary" onPress={capture}>
          Capture
        </Button>
        <Button
          variant="secondary"
          disabled={!canSendToAgent}
          busy={sending}
          onPress={() => void sendToAgent()}
        >
          Send to agent
        </Button>
        <Button variant="secondary" onPress={() => void rotate()}>
          {landscape ? "Portrait" : "Rotate"}
        </Button>
        <Button variant="secondary" onPress={nextTheme}>
          {theme}
        </Button>
        <Button variant="secondary" onPress={() => void Linking.openURL(url)}>
          Safari
        </Button>
      </View>
      <Text numberOfLines={1} style={styles.url}>
        {url}
      </Text>
      {feedback ? (
        <Text style={feedback.kind === "error" ? styles.error : styles.success}>
          {feedback.message}
        </Text>
      ) : null}
      <View
        ref={captureTarget}
        collapsable={false}
        style={styles.previewSurface}
      >
        <WebView
          ref={webView}
          key={`${url}:${theme}`}
          source={{ uri: url }}
          style={styles.webView}
          allowsBackForwardNavigationGestures
          injectedJavaScriptBeforeContentLoaded={themeScript}
          onShouldStartLoadWithRequest={(request) =>
            /^https?:\/\//i.test(request.url)
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: 600,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    padding: 8,
    backgroundColor: colors.panel,
  },
  url: {
    color: colors.muted,
    fontSize: 11,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  success: {
    color: colors.success,
    fontSize: 11,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  error: {
    color: colors.danger,
    fontSize: 11,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  previewSurface: { flex: 1, backgroundColor: "#FFFFFF" },
  webView: { flex: 1, backgroundColor: "#FFFFFF" },
});
