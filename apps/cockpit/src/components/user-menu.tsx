"use client";

import Image from "next/image";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SignOutButton } from "@/components/sign-out-button";

type UserMenuProps = {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
};

export function UserMenu({ user }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-2">
          {user?.image ? (
            <Image
              src={user.image}
              alt={user.name ?? "User"}
              width={24}
              height={24}
              className="h-6 w-6 rounded-full"
            />
          ) : (
            <User className="h-4 w-4" />
          )}
          <span className="truncate text-sm">
            {user?.name ?? "Account"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {user?.email && (
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
            {user.email}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <SignOutButton />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
