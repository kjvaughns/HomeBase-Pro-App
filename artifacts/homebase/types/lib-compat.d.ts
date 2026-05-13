/**
 * Ambient module declarations that replace class-component library types
 * with React.ComponentType<Props> so TypeScript accepts them as JSX elements
 * when compiled against @types/react v19.
 *
 * NOTE: No top-level import/export — this file must remain an ambient
 * declaration file (not a module) so that each `declare module` block
 * acts as a full replacement, not an augmentation.
 */

declare module "expo-blur" {
  import type { ViewProps } from "react-native";
  export type BlurMethod = "none" | "dimezisBlurView";
  export type BlurTint =
    | "light"
    | "dark"
    | "default"
    | "prominent"
    | "regular"
    | "systemUltraThinMaterial"
    | "systemThinMaterial"
    | "systemMaterial"
    | "systemThickMaterial"
    | "systemChromeMaterial"
    | "systemUltraThinMaterialLight"
    | "systemThinMaterialLight"
    | "systemMaterialLight"
    | "systemThickMaterialLight"
    | "systemChromeMaterialLight"
    | "systemUltraThinMaterialDark"
    | "systemThinMaterialDark"
    | "systemMaterialDark"
    | "systemThickMaterialDark"
    | "systemChromeMaterialDark"
    | string;
  export type BlurViewProps = ViewProps & {
    intensity?: number;
    tint?: BlurTint;
    experimentalBlurMethod?: BlurMethod;
    blurReductionFactor?: number;
  };
  export const BlurView: import("react").ComponentType<BlurViewProps>;
  export default BlurView;
}

declare module "expo-image" {
  import type { AccessibilityProps, StyleProp, ImageStyle, NativeSyntheticEvent } from "react-native";
  export type ImageSource = {
    uri?: string;
    width?: number;
    height?: number;
    headers?: Record<string, string>;
    [key: string]: unknown;
  };
  export type ContentFit = "cover" | "contain" | "fill" | "none" | "scale-down";
  export type ImageProps = AccessibilityProps & {
    source?: ImageSource | string | number | ImageSource[] | import("react-native").ImageSourcePropType | null;
    style?: StyleProp<ImageStyle>;
    contentFit?: ContentFit;
    contentPosition?: { top?: number | string; left?: number | string } | string;
    transition?: number | { duration?: number; effect?: string; timing?: string } | null;
    placeholder?: ImageSource | string | null;
    placeholderContentFit?: ContentFit;
    priority?: "low" | "normal" | "high";
    cachePolicy?: "none" | "disk" | "memory" | "memory-disk" | "disk-with-upfront-size-determination";
    onLoad?: (event: NativeSyntheticEvent<{ source: ImageSource }>) => void;
    onError?: (event: NativeSyntheticEvent<{ error: string }>) => void;
    onLoadStart?: () => void;
    onLoadEnd?: () => void;
    onProgress?: (event: NativeSyntheticEvent<{ loaded: number; total: number }>) => void;
    recyclingKey?: string;
    alt?: string;
    tintColor?: string;
    blurRadius?: number;
    allowDownscaling?: boolean;
    [key: string]: unknown;
  };
  export const Image: import("react").ComponentType<ImageProps> & {
    prefetch(urls: string | string[], options?: unknown): Promise<boolean>;
    clearMemoryCache(): Promise<void>;
    clearDiskCache(): Promise<void>;
  };
}

declare module "expo-linear-gradient" {
  import type { ViewProps } from "react-native";
  export type LinearGradientPoint = { x: number; y: number };
  export type LinearGradientProps = ViewProps & {
    colors: readonly (string | number)[];
    locations?: number[] | null;
    start?: LinearGradientPoint | null;
    end?: LinearGradientPoint | null;
    dither?: boolean;
  };
  export const LinearGradient: import("react").ComponentType<LinearGradientProps>;
  export default LinearGradient;
}

declare module "react-native-maps" {
  import type { ViewProps } from "react-native";

  export type Region = {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  export type LatLng = { latitude: number; longitude: number };

  export type MapViewProps = ViewProps & {
    region?: Region;
    initialRegion?: Region;
    mapType?: "standard" | "satellite" | "hybrid" | "terrain" | "none";
    showsUserLocation?: boolean;
    followsUserLocation?: boolean;
    showsMyLocationButton?: boolean;
    showsCompass?: boolean;
    showsScale?: boolean;
    zoomEnabled?: boolean;
    zoomControlEnabled?: boolean;
    scrollEnabled?: boolean;
    rotateEnabled?: boolean;
    pitchEnabled?: boolean;
    onRegionChange?: (region: Region) => void;
    onRegionChangeComplete?: (region: Region) => void;
    onPress?: (event: { nativeEvent: { coordinate: LatLng } }) => void;
    onMapReady?: () => void;
    provider?: "google" | null;
    customMapStyle?: unknown[];
    minZoomLevel?: number;
    maxZoomLevel?: number;
    [key: string]: unknown;
  };

  export type MarkerProps = ViewProps & {
    coordinate: LatLng;
    title?: string;
    description?: string;
    pinColor?: string;
    image?: number | { uri: string };
    anchor?: { x: number; y: number };
    calloutAnchor?: { x: number; y: number };
    flat?: boolean;
    identifier?: string;
    rotation?: number;
    draggable?: boolean;
    onPress?: (event: unknown) => void;
    onDragEnd?: (event: unknown) => void;
    tracksViewChanges?: boolean;
    zIndex?: number;
    [key: string]: unknown;
  };

  export type PolylineProps = {
    coordinates: LatLng[];
    strokeColor?: string;
    strokeColors?: string[];
    strokeWidth?: number;
    lineDashPattern?: number[];
    geodesic?: boolean;
    lineCap?: "butt" | "round" | "square";
    lineJoin?: "miter" | "round" | "bevel";
    [key: string]: unknown;
  };

  const MapView: import("react").ComponentType<MapViewProps>;
  export const Marker: import("react").ComponentType<MarkerProps>;
  export const Polyline: import("react").ComponentType<PolylineProps>;
  export const Callout: import("react").ComponentType<any>;
  export const Circle: import("react").ComponentType<any>;
  export const Polygon: import("react").ComponentType<any>;
  export { MapView as default };
}

declare module "react-native-svg" {
  import type { ViewProps } from "react-native";

  export type SvgProps = ViewProps & {
    width?: number | string;
    height?: number | string;
    viewBox?: string;
    preserveAspectRatio?: string;
    fill?: string;
    fillOpacity?: number | string;
    stroke?: string;
    strokeWidth?: number | string;
    strokeOpacity?: number | string;
    color?: string;
    [key: string]: unknown;
  };

  export type BaseShapeProps = {
    fill?: string;
    fillOpacity?: number | string;
    stroke?: string;
    strokeWidth?: number | string;
    strokeOpacity?: number | string;
    strokeDasharray?: string | number[];
    strokeDashoffset?: number | string;
    strokeLinecap?: "butt" | "round" | "square";
    strokeLinejoin?: "miter" | "round" | "bevel";
    [key: string]: unknown;
  };

  export type CircleProps = BaseShapeProps & {
    cx?: number | string;
    cy?: number | string;
    r?: number | string;
    animatedProps?: unknown;
  };

  export type PathProps = BaseShapeProps & {
    d?: string;
  };

  export type RectProps = BaseShapeProps & {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    height?: number | string;
    rx?: number | string;
    ry?: number | string;
  };

  const Svg: import("react").ComponentType<SvgProps>;
  export const Circle: import("react").ComponentType<CircleProps>;
  export const Path: import("react").ComponentType<PathProps>;
  export const Rect: import("react").ComponentType<RectProps>;
  export const Line: import("react").ComponentType<BaseShapeProps & { x1?: string | number; y1?: string | number; x2?: string | number; y2?: string | number }>;
  export const G: import("react").ComponentType<SvgProps>;
  export const Text: import("react").ComponentType<BaseShapeProps & { x?: string | number; y?: string | number; fontSize?: string | number; textAnchor?: string; children?: import("react").ReactNode }>;
  export const Defs: import("react").ComponentType<{ children?: import("react").ReactNode }>;
  export const LinearGradient: import("react").ComponentType<{ id?: string; x1?: string | number; y1?: string | number; x2?: string | number; y2?: string | number; children?: import("react").ReactNode }>;
  export const Stop: import("react").ComponentType<{ offset?: string | number; stopColor?: string; stopOpacity?: string | number }>;
  export function createAnimatedComponent<P extends object>(component: import("react").ComponentType<P>): import("react").ComponentType<P & { animatedProps?: unknown }>;
  export default Svg;
}
