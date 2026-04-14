import React from "react";

interface Props {
  publishableKey: string;
  children: React.ReactNode;
}

export function StripeProviderWrapper({ children }: Props) {
  return <>{children}</>;
}
