import { useAuth } from "@/components/providers/AuthProvider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/types";

export function UserSwitcher() {
  const { user, users, switchUser } = useAuth();
  return (
    <div className="flex items-center gap-3">
      <div className="hidden flex-wrap justify-end gap-1 md:flex">
        {user?.roles.map((r) => (
          <Badge key={r} variant="secondary" className="text-[10px]">
            {ROLE_LABELS[r]}
          </Badge>
        ))}
      </div>
      <Select value={user?.id ?? ""} onValueChange={(v) => switchUser(v)}>
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Demo-Benutzer wählen" />
        </SelectTrigger>
        <SelectContent>
          {users.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}