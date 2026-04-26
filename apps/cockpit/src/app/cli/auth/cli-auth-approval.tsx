"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Terminal, Check, Loader2 } from "lucide-react";
import { apiFetchClient, getClientToken } from "@/lib/api-client";

interface Props {
  code?: string;
  userEmail: string;
}

export function CliAuthApproval({ code, userEmail }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!code) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Terminal className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
          <CardTitle>Invalid Request</CardTitle>
          <CardDescription>
            No authorization code provided. Run <code className="text-xs bg-muted px-1 py-0.5 rounded">fnd login</code> from your terminal.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (status === "success") {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Check className="mx-auto h-10 w-10 text-green-500 mb-2" />
          <CardTitle>CLI Authorized</CardTitle>
          <CardDescription>
            You can close this tab and return to your terminal.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  async function handleApprove() {
    setStatus("loading");
    setError(null);
    try {
      const token = await getClientToken();
      await apiFetchClient("/v1/cli/approve", token, {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      setStatus("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to authorize");
      setStatus("error");
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <Terminal className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
        <CardTitle>Authorize CLI</CardTitle>
        <CardDescription>
          The SaaS Maker CLI is requesting access to your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border px-3 py-2 text-sm">
          <span className="text-muted-foreground">Signed in as </span>
          <span className="font-medium">{userEmail}</span>
        </div>
        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}
        <Button
          onClick={handleApprove}
          disabled={status === "loading"}
          className="w-full"
          size="lg"
        >
          {status === "loading" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Terminal className="mr-2 h-4 w-4" />
          )}
          Authorize
        </Button>
      </CardContent>
    </Card>
  );
}
