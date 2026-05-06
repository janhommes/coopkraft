import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/components/providers/AuthProvider";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user } = useAuth();
  // Mitglied → eigenes Dashboard, sonst allgemeines Dashboard
  if (user && user.roles.length === 1 && user.roles[0] === "mitglied" && user.memberId) {
    return <Navigate to="/app/mitglieder/$id" params={{ id: user.memberId }} />;
  }
  return <Navigate to="/app/dashboard" />;
}
