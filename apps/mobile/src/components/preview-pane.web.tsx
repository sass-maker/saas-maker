import {
  Linking,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Button } from "./ui";
import { colors } from "../lib/theme";
import { deriveCockpitLayout } from "../lib/layout";

export function PreviewPane({
  url,
}: {
  url: string;
  canSendToAgent: boolean;
  onSendToAgent: (attachment: {
    mimeType: "image/jpeg";
    base64: string;
  }) => Promise<void>;
}) {
  const window = useWindowDimensions();
  const layout = deriveCockpitLayout(window.width, window.height);
  return (
    <View style={[styles.frame, { height: layout.previewHeight }]}>
      <View style={styles.toolbar}>
        <Text numberOfLines={1} style={styles.url}>
          {url}
        </Text>
        <Button variant="secondary" onPress={() => void Linking.openURL(url)}>
          Open
        </Button>
      </View>
      <iframe
        title="Project preview"
        src={url}
        style={{ flex: 1, border: 0, width: "100%", background: "#fff" }}
        sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toolbar: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
  },
  url: { color: colors.muted, flex: 1, paddingLeft: 8 },
});
