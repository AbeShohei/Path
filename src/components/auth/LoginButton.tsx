import { useAuth } from "../../hooks/useAuth";

interface LoginButtonProps {
  className?: string;
  variant?: "primary" | "secondary" | "text";
}

export function LoginButton({
  className = "",
  variant = "primary",
}: LoginButtonProps) {
  const { isSignedIn, openSignIn, isLoaded } = useAuth();

  if (!isLoaded) return null;
  if (isSignedIn) return null;

  const baseStyles = "font-medium rounded-lg transition-colors";
  const variantStyles = {
    primary: "bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2",
    secondary:
      "bg-white hover:bg-gray-50 text-emerald-600 border border-emerald-500 px-4 py-2",
    text: "text-emerald-600 hover:text-emerald-700 px-2 py-1",
  };

  return (
    <button
      onClick={openSignIn}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
    >
      ログイン
    </button>
  );
}
