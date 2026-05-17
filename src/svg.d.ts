declare module "*.svg?react" {
  import type { ComponentProps } from "react"
  const component: React.FC<ComponentProps<"svg">>
  export default component
}
