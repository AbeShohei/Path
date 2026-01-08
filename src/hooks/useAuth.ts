import { useUser, useClerk } from "@clerk/clerk-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useState } from "react";
import { Id } from "../../convex/_generated/dataModel";

export interface AuthUser {
  clerkId: string;
  convexUserId: Id<"users"> | null;
  email: string | null;
  name: string | null;
  imageUrl: string | null;
}

export function useAuth() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { openSignIn, openUserProfile, signOut } = useClerk();
  const syncUser = useMutation(api.users.syncUser);

  const [convexUserId, setConvexUserId] = useState<Id<"users"> | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Sync user to Convex when signed in
  useEffect(() => {
    if (isSignedIn && user && !isSyncing) {
      setIsSyncing(true);
      syncUser({
        clerkId: user.id,
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName || user.firstName || undefined,
        imageUrl: user.imageUrl,
      })
        .then((userId) => {
          setConvexUserId(userId);
        })
        .catch(console.error)
        .finally(() => setIsSyncing(false));
    }
  }, [isSignedIn, user?.id]);

  // Query Convex user data
  const convexUser = useQuery(
    api.users.getUser,
    isSignedIn && user ? { clerkId: user.id } : "skip"
  );

  // Update convexUserId from query if not set
  useEffect(() => {
    if (convexUser && !convexUserId) {
      setConvexUserId(convexUser._id);
    }
  }, [convexUser]);

  const authUser: AuthUser | null =
    isSignedIn && user
      ? {
          clerkId: user.id,
          convexUserId: convexUserId || convexUser?._id || null,
          email: user.primaryEmailAddress?.emailAddress || null,
          name: user.fullName || user.firstName || null,
          imageUrl: user.imageUrl || null,
        }
      : null;

  return {
    // Auth state
    user: authUser,
    isLoaded,
    isSignedIn: isSignedIn ?? false,
    isGuest: !isSignedIn,
    isSyncing,

    // Convex user ID (for database operations)
    convexUserId: convexUserId || convexUser?._id || null,

    // Actions
    openSignIn: () => openSignIn(),
    openUserProfile: () => openUserProfile(),
    signOut: () => signOut(),
  };
}
