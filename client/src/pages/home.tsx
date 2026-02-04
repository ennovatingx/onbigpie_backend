import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Code2, Lock, Shield, Key } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-6">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Shield className="w-10 h-10 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Authentication API</h1>
          <p className="text-muted-foreground text-lg">
            RESTful API for user authentication with registration, login, and password management
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code2 className="w-5 h-5" />
              API Documentation
            </CardTitle>
            <CardDescription>
              Explore and test all API endpoints using the interactive Swagger UI
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Lock className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">User Registration</p>
                  <p className="text-sm text-muted-foreground">Create new accounts with validation</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Key className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Authentication</p>
                  <p className="text-sm text-muted-foreground">Login with email and password</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Shield className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Password Management</p>
                  <p className="text-sm text-muted-foreground">Reset and change password functionality</p>
                </div>
              </div>
            </div>

            <Button asChild className="w-full" size="lg" data-testid="button-open-swagger">
              <a href="/api-docs" target="_blank" rel="noopener noreferrer">
                Open API Documentation
                <ExternalLink className="w-4 h-4 ml-2" />
              </a>
            </Button>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          <p>Swagger UI available at <code className="px-2 py-1 rounded bg-muted">/api-docs</code></p>
        </div>
      </div>
    </div>
  );
}
