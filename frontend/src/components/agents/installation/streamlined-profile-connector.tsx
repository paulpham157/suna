import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Plus, 
  Loader2,
  Shield,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { CredentialProfileSelector } from '@/components/workflows/CredentialProfileSelector';
import { CredentialProfileSelector as PipedreamCredentialProfileSelector } from '@/components/agents/pipedream/credential-profile-selector';
import { PipedreamConnector } from '@/components/agents/pipedream/pipedream-connector';
import { useCreateCredentialProfile, type CreateCredentialProfileRequest } from '@/hooks/react-query/mcp/use-credential-profiles';
import { useMCPServerDetails } from '@/hooks/react-query/mcp/use-mcp-servers';
import { usePipedreamProfiles } from '@/hooks/react-query/pipedream/use-pipedream-profiles';
import type { SetupStep } from './types';

interface ProfileConnectorProps {
  step: SetupStep;
  selectedProfileId: string | undefined;
  onProfileSelect: (qualifiedName: string, profileId: string | null) => void;
  onComplete?: () => void;
}

export const ProfileConnector: React.FC<ProfileConnectorProps> = ({
  step,
  selectedProfileId,
  onProfileSelect,
  onComplete
}) => {
  const [profileStep, setProfileStep] = useState<'select' | 'create'>('select');
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [config, setConfig] = useState<Record<string, string>>({});
  const [showPipedreamConnector, setShowPipedreamConnector] = useState(false);

  const createProfileMutation = useCreateCredentialProfile();
  const { data: serverDetails } = useMCPServerDetails(step.qualified_name);
  const { data: pipedreamProfiles } = usePipedreamProfiles();

  const isPipedreamStep = step.type === 'pipedream_profile';
  const configProperties = serverDetails?.connections?.[0]?.configSchema?.properties || {};
  const requiredFields = serverDetails?.connections?.[0]?.configSchema?.required || [];
  const hasConnectedPipedreamProfile = pipedreamProfiles?.some(p => 
    p.app_slug === step.app_slug && p.is_connected
  );

  useEffect(() => {
    setProfileStep('select');
    setIsCreatingProfile(false);
    setNewProfileName('');
    setConfig({});
    setShowPipedreamConnector(false);
  }, [step.qualified_name]);

  const mockPipedreamApp = useMemo(() => ({
    id: step.qualified_name,
    name_slug: step.app_slug || step.qualified_name,
    name: step.service_name,
    description: `Connect your ${step.service_name} account to use its tools`,
    img_src: '',
    custom_fields_json: "[]",
    categories: [],
    featured_weight: 0,
    auth_type: "keys" as const,
    connect: {
      allowed_domains: null,
      base_proxy_target_url: "",
      proxy_enabled: false
    }
  }), [step.app_slug, step.qualified_name, step.service_name]);

  const handleCreateProfile = useCallback(async () => {
    if (!newProfileName.trim()) {
      toast.error('Please enter a profile name');
      return;
    }

    setIsCreatingProfile(true);
    try {
      const request: CreateCredentialProfileRequest = {
        mcp_qualified_name: step.qualified_name,
        profile_name: newProfileName.trim(),
        display_name: step.service_name,
        config: config,
        is_default: false
      };

      const response = await createProfileMutation.mutateAsync(request);
      toast.success('Profile created successfully!');
      
      onProfileSelect(step.qualified_name, response.profile_id || 'new-profile');
      setProfileStep('select');
      setNewProfileName('');
      setConfig({});
      onComplete?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create profile');
    } finally {
      setIsCreatingProfile(false);
    }
  }, [newProfileName, config, step.qualified_name, step.service_name, createProfileMutation, onProfileSelect, onComplete]);

  const handleConfigChange = useCallback((key: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const handleProfileNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewProfileName(e.target.value);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && profileStep === 'create') {
      handleCreateProfile();
    }
  }, [handleCreateProfile, profileStep]);

  const isFieldRequired = (fieldName: string) => {
    return requiredFields.includes(fieldName);
  };

  const SelectProfileStep = useMemo(() => (
    <div className="space-y-4">
      {isPipedreamStep ? (
        <div className="space-y-4">
          {hasConnectedPipedreamProfile ? (
            <PipedreamCredentialProfileSelector
              appSlug={step.app_slug || ''}
              appName={step.service_name}
              selectedProfileId={selectedProfileId}
              onProfileSelect={(profileId) => {
                onProfileSelect(step.qualified_name, profileId);
              }}
            />
          ) : (
            <div className="space-y-4">
              <Alert className="border-primary/20 bg-primary/5">
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  No connected {step.service_name} profiles found. Create and connect one to continue.
                </AlertDescription>
              </Alert>
              
              <Button 
                onClick={() => setShowPipedreamConnector(true)}
                className="w-full"
              >
                <Plus className="h-4 w-4" />
                Connect {step.service_name}
              </Button>
            </div>
          )}

          {hasConnectedPipedreamProfile && (
            <>
              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">OR</span>
                <Separator className="flex-1" />
              </div>

              <Button 
                variant="outline" 
                onClick={() => setShowPipedreamConnector(true)}
                className="w-full"
              >
                <Plus className="h-4 w-4" />
                Connect Different Account
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <CredentialProfileSelector
            mcpQualifiedName={step.qualified_name}
            mcpDisplayName={step.service_name}
            selectedProfileId={selectedProfileId}
            onProfileSelect={(profileId) => {
              onProfileSelect(step.qualified_name, profileId);
            }}
          />

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">OR</span>
            <Separator className="flex-1" />
          </div>

          <Button 
            variant="outline" 
            onClick={() => {
              setNewProfileName(`${step.service_name} Profile`);
              setProfileStep('create');
            }}
            className="w-full"
          >
            <Plus className="h-4 w-4" />
            Create New Profile
          </Button>
        </div>
      )}
    </div>
  ), [
    step.service_name,
    step.qualified_name,
    step.app_slug,
    isPipedreamStep,
    selectedProfileId,
    hasConnectedPipedreamProfile,
    onProfileSelect
  ]);

  const CreateProfileStep = useMemo(() => (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Button 
            variant="link" 
            size="sm"
            onClick={() => setProfileStep('select')}
            className="mb-4 p-0 h-auto font-normal text-muted-foreground hover:text-foreground"
          >
            ← Back to Selection
          </Button>
        </div>
        <h3 className="font-semibold">Create {step.service_name} Profile</h3>
        <p className="text-sm text-muted-foreground">
          Set up a new credential profile for {step.service_name}
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="profile-name">Profile Name</Label>
          <Input
            id="profile-name"
            placeholder="e.g., Personal Account, Work Account"
            value={newProfileName}
            onChange={handleProfileNameChange}
            onKeyDown={handleKeyDown}
            autoFocus
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">
            This helps you identify different configurations
          </p>
        </div>

        {Object.keys(configProperties).length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="text-sm font-medium">Connection Settings</span>
            </div>
            {Object.entries(configProperties).map(([key, schema]: [string, any]) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>
                  {schema.title || key}
                  {isFieldRequired(key) && (
                    <span className="text-destructive ml-1">*</span>
                  )}
                </Label>
                <Input
                  id={key}
                  type={schema.format === 'password' ? 'password' : 'text'}
                  placeholder={schema.description || `Enter ${key}`}
                  value={config[key] || ''}
                  onChange={(e) => handleConfigChange(key, e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-11"
                />
                {schema.description && (
                  <p className="text-xs text-muted-foreground">{schema.description}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Alert className="border-primary/20 bg-primary/5">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              This service doesn't require any credentials to connect.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="pt-4 border-t">
        <Button 
          onClick={handleCreateProfile}
          disabled={!newProfileName.trim() || isCreatingProfile}
          className="w-full"
        >
          {isCreatingProfile ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Create & Continue
            </>
          )}
        </Button>
      </div>
    </div>
  ), [
    step.service_name,
    newProfileName,
    config,
    configProperties,
    isCreatingProfile,
    handleProfileNameChange,
    handleKeyDown,
    handleConfigChange,
    handleCreateProfile,
    isFieldRequired
  ]);

  return (
    <>
      <div className="space-y-6">
        {profileStep === 'select' ? SelectProfileStep : CreateProfileStep}
      </div>

      {isPipedreamStep && (
        <PipedreamConnector
          app={mockPipedreamApp}
          open={showPipedreamConnector}
          onOpenChange={setShowPipedreamConnector}
          mode="profile-only"
          onComplete={(profileId, selectedTools, appName, appSlug) => {
            onProfileSelect(step.qualified_name, profileId);
            setShowPipedreamConnector(false);
            toast.success(`Connected to ${appName} successfully!`);
            onComplete?.();
          }}
        />
      )}
    </>
  );
}; 