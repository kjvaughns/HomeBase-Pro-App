import { Platform, ScrollView, ScrollViewProps } from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardAwareScrollViewProps,
} from "react-native-keyboard-controller";
import { useLayout } from "@/hooks/useLayout";

type Props = KeyboardAwareScrollViewProps & ScrollViewProps;

/**
 * KeyboardAwareScrollView that falls back to ScrollView on web.
 * Use this for any screen containing text inputs.
 * Automatically applies tablet-aware horizontal padding via useLayout.
 */
export function KeyboardAwareScrollViewCompat({
  children,
  keyboardShouldPersistTaps = "handled",
  contentContainerStyle,
  ...props
}: Props) {
  const { horizontalPadding } = useLayout();
  const mergedContentStyle = [
    contentContainerStyle,
    { paddingHorizontal: horizontalPadding },
  ];

  if (Platform.OS === "web") {
    return (
      <ScrollView
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        contentContainerStyle={mergedContentStyle}
        {...props}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <KeyboardAwareScrollView
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      contentContainerStyle={mergedContentStyle}
      {...props}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}
