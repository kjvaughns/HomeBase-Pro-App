import { Text, type TextProps } from "react-native";

import { useTheme } from "@/hooks/useTheme";
import { Typography } from "@/constants/theme";

export type ThemedTextType =
  | "display"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "body"
  | "small"
  | "caption"
  | "label"
  | "link"
  | "largeTitle"
  | "title1"
  | "title2"
  | "title3"
  | "headline"
  | "callout"
  | "subhead"
  | "footnote"
  | "caption1"
  | "caption2";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemedTextType;
};

const TYPE_TO_STYLE: Record<ThemedTextType, object> = {
  display: Typography.display,
  h1: Typography.h1,
  h2: Typography.h2,
  h3: Typography.h3,
  h4: Typography.h4,
  body: Typography.body,
  small: Typography.small,
  caption: Typography.caption,
  label: Typography.label,
  link: Typography.link,
  largeTitle: Typography.largeTitle,
  title1: Typography.title1,
  title2: Typography.title2,
  title3: Typography.title3,
  headline: Typography.headline,
  callout: Typography.callout,
  subhead: Typography.subhead,
  footnote: Typography.footnote,
  caption1: Typography.caption1,
  caption2: Typography.caption2,
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = "body",
  ...rest
}: ThemedTextProps) {
  const { theme, isDark } = useTheme();

  const getColor = () => {
    if (isDark && darkColor) {
      return darkColor;
    }

    if (!isDark && lightColor) {
      return lightColor;
    }

    if (type === "link") {
      return theme.link;
    }

    return theme.text;
  };

  return (
    <Text style={[{ color: getColor() }, TYPE_TO_STYLE[type], style]} {...rest} />
  );
}
