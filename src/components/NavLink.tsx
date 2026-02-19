"use client";

import Link from "next/link";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface NavLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ className, activeClassName, pendingClassName, to, href, ...props }, ref) => {
    return (
      <Link
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={to || href || "#"}
        className={cn(className)}
        {...props}
      />
    );
  }
);

NavLink.displayName = "NavLink";

export { NavLink };
