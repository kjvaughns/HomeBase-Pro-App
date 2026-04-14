import React from "react";
import { StripeProvider } from "@stripe/stripe-react-native";

interface Props {
  publishableKey: string;
  children: React.ReactNode;
}

export function StripeProviderWrapper({ publishableKey, children }: Props) {
  if (!publishableKey) {
    return <>{children}</>;
  }
  return (
    <StripeProvider publishableKey={publishableKey} merchantIdentifier="merchant.com.homebase.pro">
      {children}
    </StripeProvider>
  );
}
