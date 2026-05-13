/**
 * React 19 / @types/react v19 compatibility shim for class-component libraries
 * (expo-blur, expo-image, expo-linear-gradient, react-native-maps, react-native-svg)
 * that were compiled against older @types/react and omit some instance members.
 *
 * `export {}` makes this a module augmentation (not an ambient module replacement)
 * so all existing React exports are preserved.
 */
export {};

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Component<P = object, S = object, SS = unknown> {
    context: unknown;
    setState: (...args: unknown[]) => void;
    forceUpdate: (callback?: () => void) => void;
    props: Readonly<P>;
    state: Readonly<S>;
    refs: Record<string, unknown>;
  }
}
