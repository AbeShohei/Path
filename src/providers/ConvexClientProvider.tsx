import { ReactNode } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

interface Props {
  children: ReactNode;
}

export function ConvexClientProvider({ children }: Props) {
  const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  // If Clerk is not configured, use Convex without auth
  if (!clerkPubKey) {
    return <ConvexProvider client={convex}>{children}</ConvexProvider>;
  }

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      appearance={{
        variables: {
          colorPrimary: "#10b981", // emerald-500
          colorText: "#1f2937", // gray-800
        },
        elements: {
          formButtonPrimary:
            "bg-emerald-500 hover:bg-emerald-600 text-sm normal-case",
        },
      }}
      localization={{
        locale: "ja-JP",
      }}
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
