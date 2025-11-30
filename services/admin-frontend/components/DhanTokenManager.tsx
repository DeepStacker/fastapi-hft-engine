'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Loader2, CheckCircle2, XCircle, Eye, EyeOff, RefreshCw } from 'lucide-react';

export default function DhanTokenManager() {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [testing, setTesting] = useState(false);
  const [tokens, setTokens] = useState<{
    auth_token_preview: string;
    authorization_token_preview: string;
    last_updated: string | null;
  } | null>(null);
  
  const [formData, setFormData] = useState({
    auth_token: '',
    authorization_token: ''
  });
  
  const [showAuthToken, setShowAuthToken] = useState(false);
  const [showAuthzToken, setShowAuthzToken] = useState(false);
  
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [testResult, setTestResult] = useState<any>(null);

  const fetchTokens = async () => {
    try {
      setLoading(true);
      const response = await api.getDhanTokens();
      setTokens(response.data);
    } catch (error) {
      console.error('Failed to fetch tokens:', error);
      setMessage({ type: 'error', text: 'Failed to load current token configuration' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.auth_token && !formData.authorization_token) {
      setMessage({ type: 'error', text: 'Please provide at least one token to update' });
      return;
    }
    
    try {
      setUpdating(true);
      setMessage(null);
      
      await api.updateDhanTokens({
        auth_token: formData.auth_token || undefined,
        authorization_token: formData.authorization_token || undefined
      });
      
      setMessage({ type: 'success', text: 'Tokens updated successfully! Ingestion service will pick them up shortly.' });
      setFormData({ auth_token: '', authorization_token: '' });
      fetchTokens();
    } catch (error) {
      console.error('Failed to update tokens:', error);
      setMessage({ type: 'error', text: 'Failed to update tokens. Please try again.' });
    } finally {
      setUpdating(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const response = await api.testDhanTokens();
      setTestResult(response.data);
    } catch (error: any) {
      console.error('Test failed:', error);
      setTestResult({
        status: 'error',
        message: error.response?.data?.detail || 'Test request failed',
        response_status: error.response?.status
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading && !tokens) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            Current Configuration
          </CardTitle>
          <CardDescription>
            Current Dhan API tokens stored in the system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Auth Token (Preview)</Label>
              <div className="p-3 bg-muted rounded-md font-mono text-xs break-all">
                {tokens?.auth_token_preview || 'Not configured'}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Authorization Token (Preview)</Label>
              <div className="p-3 bg-muted rounded-md font-mono text-xs break-all">
                {tokens?.authorization_token_preview || 'Not configured'}
              </div>
            </div>
          </div>
          
          {tokens?.last_updated && (
            <div className="text-xs text-muted-foreground pt-2">
              Last updated: {new Date(tokens.last_updated).toLocaleString()}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Update Tokens</CardTitle>
            <CardDescription>
              Enter new tokens from Dhan web interface
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="auth_token">New Auth Token</Label>
                <div className="relative">
                  <Input
                    id="auth_token"
                    type={showAuthToken ? "text" : "password"}
                    placeholder="Paste new auth token here..."
                    value={formData.auth_token}
                    onChange={(e) => setFormData({...formData, auth_token: e.target.value})}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowAuthToken(!showAuthToken)}
                  >
                    {showAuthToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="authorization_token">New Authorization Token</Label>
                <div className="relative">
                  <Input
                    id="authorization_token"
                    type={showAuthzToken ? "text" : "password"}
                    placeholder="Paste new authorization token here (starts with 'Token ')..."
                    value={formData.authorization_token}
                    onChange={(e) => setFormData({...formData, authorization_token: e.target.value})}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowAuthzToken(!showAuthzToken)}
                  >
                    {showAuthzToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {message && (
                <Alert variant={message.type === 'success' ? 'default' : 'destructive'}>
                  {message.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  <AlertTitle>{message.type === 'success' ? 'Success' : 'Error'}</AlertTitle>
                  <AlertDescription>{message.text}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" disabled={updating} className="w-full">
                {updating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Update Tokens
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Configuration</CardTitle>
            <CardDescription>
              Verify that the current tokens are working correctly
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-md text-sm">
              <p className="mb-2">This will attempt to fetch expiry dates for NIFTY using the configured tokens.</p>
              <p className="text-muted-foreground">Use this to verify tokens before or after updating.</p>
            </div>

            <Button 
              onClick={handleTest} 
              disabled={testing} 
              variant="outline" 
              className="w-full"
            >
              {testing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                'Run Connectivity Test'
              )}
            </Button>

            {testResult && (
              <div className={`mt-4 p-4 rounded-md border ${
                testResult.status === 'success' 
                  ? 'bg-green-50/10 border-green-500/20 text-green-600 dark:text-green-400' 
                  : 'bg-red-50/10 border-red-500/20 text-red-600 dark:text-red-400'
              }`}>
                <div className="flex items-center gap-2 font-semibold mb-1">
                  {testResult.status === 'success' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  {testResult.status === 'success' ? 'Test Passed' : 'Test Failed'}
                </div>
                <div className="text-xs font-mono mt-2 space-y-1">
                  <div>Message: {testResult.message}</div>
                  <div>Status Code: {testResult.response_status}</div>
                  {testResult.test_call && <div>Operation: {testResult.test_call}</div>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
