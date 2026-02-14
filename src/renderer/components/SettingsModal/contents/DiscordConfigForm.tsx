/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IChannelPairingRequest, IChannelPluginStatus, IChannelUser } from '@/channels/types';
import { channel } from '@/common/ipcBridge';
import type { IProvider, TProviderWithModel } from '@/common/storage';
import { ConfigStorage } from '@/common/storage';
import { hasSpecificModelCapability } from '@/renderer/utils/modelCapabilities';
import { Button, Dropdown, Empty, Input, Menu, Message, Spin, Tooltip } from '@arco-design/web-react';
import { CheckOne, CloseOne, Copy, Delete, Down, Refresh } from '@icon-park/react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Get available primary models for a provider (supports function calling)
 */
const getAvailableModels = (provider: IProvider): string[] => {
  const result: string[] = [];
  for (const modelName of provider.model || []) {
    const functionCalling = hasSpecificModelCapability(provider, modelName, 'function_calling');
    const excluded = hasSpecificModelCapability(provider, modelName, 'excludeFromPrimary');

    if ((functionCalling === true || functionCalling === undefined) && excluded !== true) {
      result.push(modelName);
    }
  }
  return result;
};

/**
 * Preference row component
 */
const PreferenceRow: React.FC<{
  label: string;
  description?: React.ReactNode;
  extra?: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, description, extra, children }) => (
  <div className='flex items-center justify-between gap-24px py-12px'>
    <div className='flex-1'>
      <div className='flex items-center gap-8px'>
        <span className='text-14px text-t-primary'>{label}</span>
        {extra}
      </div>
      {description && <div className='text-12px text-t-tertiary mt-2px'>{description}</div>}
    </div>
    <div className='flex items-center'>{children}</div>
  </div>
);

/**
 * Section header component
 */
const SectionHeader: React.FC<{ title: string; action?: React.ReactNode }> = ({ title, action }) => (
  <div className='flex items-center justify-between mb-12px'>
    <h3 className='text-14px font-500 text-t-primary m-0'>{title}</h3>
    {action}
  </div>
);

interface DiscordConfigFormProps {
  pluginStatus: IChannelPluginStatus | null;
  modelList: IProvider[];
  selectedModel: TProviderWithModel | null;
  onStatusChange: (status: IChannelPluginStatus | null) => void;
  onModelChange: (model: TProviderWithModel | null) => void;
}

const DiscordConfigForm: React.FC<DiscordConfigFormProps> = ({ pluginStatus, modelList, selectedModel, onStatusChange, onModelChange }) => {
  const { t } = useTranslation();

  const [discordToken, setDiscordToken] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [tokenTested, setTokenTested] = useState(false);
  const [testedBotUsername, setTestedBotUsername] = useState<string | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [pendingPairings, setPendingPairings] = useState<IChannelPairingRequest[]>([]);
  const [authorizedUsers, setAuthorizedUsers] = useState<IChannelUser[]>([]);

  // Load pending pairings (filtered by discord platform)
  const loadPendingPairings = useCallback(async () => {
    setPairingLoading(true);
    try {
      const result = await channel.getPendingPairings.invoke();
      if (result.success && result.data) {
        setPendingPairings(result.data.filter((p) => p.platformType === 'discord'));
      }
    } catch (error) {
      console.error('[DiscordConfig] Failed to load pending pairings:', error);
    } finally {
      setPairingLoading(false);
    }
  }, []);

  // Load authorized users (filtered by discord platform)
  const loadAuthorizedUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const result = await channel.getAuthorizedUsers.invoke();
      if (result.success && result.data) {
        setAuthorizedUsers(result.data.filter((u) => u.platformType === 'discord'));
      }
    } catch (error) {
      console.error('[DiscordConfig] Failed to load authorized users:', error);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void loadPendingPairings();
    void loadAuthorizedUsers();
  }, [loadPendingPairings, loadAuthorizedUsers]);

  // Listen for pairing requests (discord only)
  useEffect(() => {
    const unsubscribe = channel.pairingRequested.on((request) => {
      if (request.platformType !== 'discord') return;
      setPendingPairings((prev) => {
        const exists = prev.some((p) => p.code === request.code);
        if (exists) return prev;
        return [request, ...prev];
      });
    });
    return () => unsubscribe();
  }, []);

  // Listen for user authorization (discord only)
  useEffect(() => {
    const unsubscribe = channel.userAuthorized.on((user) => {
      if (user.platformType !== 'discord') return;
      setAuthorizedUsers((prev) => {
        const exists = prev.some((u) => u.id === user.id);
        if (exists) return prev;
        return [user, ...prev];
      });
      setPendingPairings((prev) => prev.filter((p) => p.platformUserId !== user.platformUserId));
    });
    return () => unsubscribe();
  }, []);

  // Test Discord connection
  const handleTestConnection = async () => {
    if (!discordToken.trim()) {
      Message.warning(t('settings.discord.tokenRequired', 'Please enter a bot token'));
      return;
    }

    setTestLoading(true);
    setTokenTested(false);
    setTestedBotUsername(null);
    try {
      const result = await channel.testPlugin.invoke({
        pluginId: 'discord_default',
        credentials: { token: discordToken.trim() },
      });

      if (result.success && result.data?.success) {
        setTokenTested(true);
        setTestedBotUsername(result.data.botUsername || null);
        Message.success(t('settings.discord.connectionSuccess', `Connected! Bot: ${result.data.botUsername || 'unknown'}`));

        // Auto-enable bot after successful test
        await handleAutoEnable();
      } else {
        setTokenTested(false);
        Message.error(result.data?.error || t('settings.discord.connectionFailed', 'Connection failed'));
      }
    } catch (error: any) {
      setTokenTested(false);
      Message.error(error.message || t('settings.discord.connectionFailed', 'Connection failed'));
    } finally {
      setTestLoading(false);
    }
  };

  // Auto-enable plugin after successful test
  const handleAutoEnable = async () => {
    try {
      const result = await channel.enablePlugin.invoke({
        pluginId: 'discord_default',
        config: { token: discordToken.trim() },
      });

      if (result.success) {
        Message.success(t('settings.discord.pluginEnabled', 'Discord bot enabled'));
        const statusResult = await channel.getPluginStatus.invoke();
        if (statusResult.success && statusResult.data) {
          const discordPlugin = statusResult.data.find((p) => p.type === 'discord');
          onStatusChange(discordPlugin || null);
        }
      }
    } catch (error: any) {
      console.error('[DiscordConfig] Auto-enable failed:', error);
    }
  };

  // Reset token tested state when token changes
  const handleTokenChange = (value: string) => {
    setDiscordToken(value);
    setTokenTested(false);
    setTestedBotUsername(null);
  };

  // Save model selection
  const handleModelSelect = async (provider: IProvider, modelName: string) => {
    const newModel: TProviderWithModel = { ...provider, useModel: modelName };
    onModelChange(newModel);
    try {
      await ConfigStorage.set('assistant.discord.defaultModel' as 'assistant.telegram.defaultModel', {
        id: provider.id,
        useModel: modelName,
      });
      Message.success(t('settings.assistant.modelSaved', 'Model saved'));
    } catch (error) {
      console.error('[DiscordConfig] Failed to save model:', error);
      Message.error(t('settings.assistant.modelSaveFailed', 'Failed to save model'));
    }
  };

  // Approve pairing
  const handleApprovePairing = async (code: string) => {
    try {
      const result = await channel.approvePairing.invoke({ code });
      if (result.success) {
        Message.success(t('settings.assistant.pairingApproved', 'Pairing approved'));
        await loadPendingPairings();
        await loadAuthorizedUsers();
      } else {
        Message.error(result.msg || t('settings.assistant.approveFailed', 'Failed to approve pairing'));
      }
    } catch (error: any) {
      Message.error(error.message);
    }
  };

  // Reject pairing
  const handleRejectPairing = async (code: string) => {
    try {
      const result = await channel.rejectPairing.invoke({ code });
      if (result.success) {
        Message.info(t('settings.assistant.pairingRejected', 'Pairing rejected'));
        await loadPendingPairings();
      } else {
        Message.error(result.msg || t('settings.assistant.rejectFailed', 'Failed to reject pairing'));
      }
    } catch (error: any) {
      Message.error(error.message);
    }
  };

  // Revoke user
  const handleRevokeUser = async (userId: string) => {
    try {
      const result = await channel.revokeUser.invoke({ userId });
      if (result.success) {
        Message.success(t('settings.assistant.userRevoked', 'User access revoked'));
        await loadAuthorizedUsers();
      } else {
        Message.error(result.msg || t('settings.assistant.revokeFailed', 'Failed to revoke user'));
      }
    } catch (error: any) {
      Message.error(error.message);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    Message.success(t('common.copied', 'Copied to clipboard'));
  };

  // Format timestamp
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  // Calculate remaining time
  const getRemainingTime = (expiresAt: number) => {
    const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000 / 60));
    return `${remaining} min`;
  };

  return (
    <div className='flex flex-col gap-24px'>
      <PreferenceRow label={t('settings.discord.botToken', 'Bot Token')} description={t('settings.discord.botTokenDesc', 'Go to Discord Developer Portal, create an application, and get your Bot Token from the Bot section.')}>
        <div className='flex items-center gap-8px'>
          <Input.Password value={discordToken} onChange={handleTokenChange} placeholder={authorizedUsers.length > 0 || pluginStatus?.hasValidCredentials ? '••••••••••••••••' : 'MTIzNDU2Nzg5...'} style={{ width: 240 }} visibilityToggle disabled={authorizedUsers.length > 0} />
          <Button type='outline' loading={testLoading} onClick={handleTestConnection} disabled={authorizedUsers.length > 0}>
            {t('settings.assistant.testConnection', 'Test')}
          </Button>
        </div>
      </PreferenceRow>

      <PreferenceRow label={t('settings.assistant.defaultModel', 'Default Model')} description={t('settings.discord.defaultModelDesc', 'Model used for Discord conversations')}>
        <Dropdown
          trigger='click'
          position='br'
          droplist={
            <Menu selectedKeys={selectedModel ? [selectedModel.id + selectedModel.useModel] : []}>
              {!modelList || modelList.length === 0 ? (
                <Menu.Item key='no-models' className='px-12px py-12px text-t-secondary text-14px text-center' disabled>
                  {t('settings.assistant.noAvailableModels', 'No Gemini models configured')}
                </Menu.Item>
              ) : (
                modelList.map((provider) => {
                  const availableModels = getAvailableModels(provider);
                  if (availableModels.length === 0) return null;
                  return (
                    <Menu.ItemGroup title={provider.name} key={provider.id}>
                      {availableModels.map((modelName) => (
                        <Menu.Item
                          key={provider.id + modelName}
                          className={selectedModel?.id + selectedModel?.useModel === provider.id + modelName ? '!bg-fill-2' : ''}
                          onClick={() => {
                            handleModelSelect(provider, modelName).catch((error) => {
                              console.error('Failed to select model:', error);
                            });
                          }}
                        >
                          {modelName}
                        </Menu.Item>
                      ))}
                    </Menu.ItemGroup>
                  );
                })
              )}
            </Menu>
          }
        >
          <Button type='secondary' className='min-w-160px flex items-center justify-between gap-8px'>
            <span className='truncate'>{selectedModel?.useModel || t('settings.assistant.selectModel', 'Select Model')}</span>
            <Down theme='outline' size={14} />
          </Button>
        </Dropdown>
      </PreferenceRow>

      {/* Next Steps Guide - show when bot is enabled and no authorized users yet */}
      {pluginStatus?.enabled && pluginStatus?.connected && authorizedUsers.length === 0 && (
        <div className='bg-blue-50 dark:bg-blue-900/20 rd-12px p-16px border border-blue-200 dark:border-blue-800'>
          <SectionHeader title={t('settings.assistant.nextSteps', 'Next Steps')} />
          <div className='text-14px text-t-secondary space-y-8px'>
            <p className='m-0'>
              <strong>1.</strong> {t('settings.discord.step1', 'Invite the bot to your Discord server using the OAuth2 URL from the Developer Portal')}
            </p>
            <p className='m-0'>
              <strong>2.</strong> {t('settings.discord.step2', 'Send a DM to the bot, or @mention the bot in a server channel')}
            </p>
            <p className='m-0'>
              <strong>3.</strong> {t('settings.discord.step3', 'A pairing request will appear below. Click "Approve" to authorize the user.')}
            </p>
            <p className='m-0'>
              <strong>4.</strong> {t('settings.discord.step4', 'Once approved, you can start chatting with the AI assistant through Discord!')}
            </p>
          </div>
        </div>
      )}

      {/* Pending Pairings */}
      {pluginStatus?.enabled && authorizedUsers.length === 0 && (
        <div className='bg-fill-1 rd-12px pt-16px pr-16px pb-16px pl-0'>
          <SectionHeader
            title={t('settings.assistant.pendingPairings', 'Pending Pairing Requests')}
            action={
              <Button size='mini' type='text' icon={<Refresh size={14} />} loading={pairingLoading} onClick={loadPendingPairings}>
                {t('common.refresh', 'Refresh')}
              </Button>
            }
          />

          {pairingLoading ? (
            <div className='flex justify-center py-24px'>
              <Spin />
            </div>
          ) : pendingPairings.length === 0 ? (
            <Empty description={t('settings.assistant.noPendingPairings', 'No pending pairing requests')} />
          ) : (
            <div className='flex flex-col gap-12px'>
              {pendingPairings.map((pairing) => (
                <div key={pairing.code} className='flex items-center justify-between bg-fill-2 rd-8px p-12px'>
                  <div className='flex-1'>
                    <div className='flex items-center gap-8px'>
                      <span className='text-14px font-500 text-t-primary'>{pairing.displayName || 'Unknown User'}</span>
                      <Tooltip content={t('settings.assistant.copyCode', 'Copy pairing code')}>
                        <button className='p-4px bg-transparent border-none text-t-tertiary hover:text-t-primary cursor-pointer' onClick={() => copyToClipboard(pairing.code)}>
                          <Copy size={14} />
                        </button>
                      </Tooltip>
                    </div>
                    <div className='text-12px text-t-tertiary mt-4px'>
                      {t('settings.assistant.pairingCode', 'Code')}: <code className='bg-fill-3 px-4px rd-2px'>{pairing.code}</code>
                      <span className='mx-8px'>|</span>
                      {t('settings.assistant.expiresIn', 'Expires in')}: {getRemainingTime(pairing.expiresAt)}
                    </div>
                  </div>
                  <div className='flex items-center gap-8px'>
                    <Button type='primary' size='small' icon={<CheckOne size={14} />} onClick={() => handleApprovePairing(pairing.code)}>
                      {t('settings.assistant.approve', 'Approve')}
                    </Button>
                    <Button type='secondary' size='small' status='danger' icon={<CloseOne size={14} />} onClick={() => handleRejectPairing(pairing.code)}>
                      {t('settings.assistant.reject', 'Reject')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Authorized Users */}
      {authorizedUsers.length > 0 && (
        <div className='bg-fill-1 rd-12px pt-16px pr-16px pb-16px pl-0'>
          <SectionHeader
            title={t('settings.assistant.authorizedUsers', 'Authorized Users')}
            action={
              <Button size='mini' type='text' icon={<Refresh size={14} />} loading={usersLoading} onClick={loadAuthorizedUsers}>
                {t('common.refresh', 'Refresh')}
              </Button>
            }
          />

          {usersLoading ? (
            <div className='flex justify-center py-24px'>
              <Spin />
            </div>
          ) : authorizedUsers.length === 0 ? (
            <Empty description={t('settings.assistant.noAuthorizedUsers', 'No authorized users yet')} />
          ) : (
            <div className='flex flex-col gap-12px'>
              {authorizedUsers.map((user) => (
                <div key={user.id} className='flex items-center justify-between bg-fill-2 rd-8px p-12px'>
                  <div className='flex-1'>
                    <div className='text-14px font-500 text-t-primary'>{user.displayName || 'Unknown User'}</div>
                    <div className='text-12px text-t-tertiary mt-4px'>
                      {t('settings.assistant.platform', 'Platform')}: Discord
                      <span className='mx-8px'>|</span>
                      {t('settings.assistant.authorizedAt', 'Authorized')}: {formatTime(user.authorizedAt)}
                    </div>
                  </div>
                  <Tooltip content={t('settings.assistant.revokeAccess', 'Revoke access')}>
                    <Button type='text' status='danger' size='small' icon={<Delete size={16} />} onClick={() => handleRevokeUser(user.id)} />
                  </Tooltip>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DiscordConfigForm;
