import { useAuth } from "@/features/auth/context"

type Role = "Owner" | "Admin" | "Manager" | "Viewer"

const RANK: Record<Role, number> = { Viewer: 0, Manager: 1, Admin: 2, Owner: 3 }

type Props = {
  /** Roles aceitas literalmente. Se passar `minRole`, é ignorada. */
  allow?: Role[]
  /** Role mínima (hierárquica): Viewer < Manager < Admin < Owner. */
  minRole?: Role
  fallback?: React.ReactNode
  children: React.ReactNode
}

export function RoleGate({ allow, minRole, fallback = null, children }: Props) {
  const { role } = useAuth()
  if (!role) return <>{fallback}</>

  const current = role as Role
  const ok = minRole
    ? (RANK[current] ?? -1) >= RANK[minRole]
    : (allow?.includes(current) ?? false)

  return <>{ok ? children : fallback}</>
}
