/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { Button, Collapse, Input, Message, Modal, Popover, Tooltip, Typography } from '@arco-design/web-react';
import { CheckOne, CloseOne, FolderOpen, Loading, Plus, Refresh } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface SkillInfo {
  name: string;
  description: string;
  location: string;
  isCustom: boolean;
}

interface EngineNativeSkill {
  name: string;
  engine: 'claude' | 'codex' | 'gemini';
  path: string;
  hasSkillMd: boolean;
}

interface GlobalSkill {
  name: string;
  engine: 'claude' | 'gemini';
  path: string;
  hasSkillMd: boolean;
}

interface DependencyCheck {
  type: 'bin' | 'npm' | 'python' | 'mcp';
  name: string;
  status: 'installed' | 'missing' | 'error';
  install: string;
  version?: string;
  error?: string;
}

interface SkillDepReport {
  skillName: string;
  dependencies: DependencyCheck[];
  allSatisfied: boolean;
  requiredMissing: number;
}

/**
 * Global Skills Management — browse installed skills, check dependencies, and import new ones.
 */
const SkillsManagement: React.FC = () => {
  const { t } = useTranslation();
  const [availableSkills, setAvailableSkills] = useState<SkillInfo[]>([]);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [skillPath, setSkillPath] = useState('');
  const [commonPaths, setCommonPaths] = useState<Array<{ name: string; path: string; exists: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [engineNativeSkills, setEngineNativeSkills] = useState<EngineNativeSkill[]>([]);
  const [globalSkills, setGlobalSkills] = useState<GlobalSkill[]>([]);
  const [importingSkill, setImportingSkill] = useState<string | null>(null);
  const [depReports, setDepReports] = useState<SkillDepReport[]>([]);
  const [depChecking, setDepChecking] = useState(false);

  // Build a map: skillName -> SkillDepReport
  const depMap = useMemo(() => {
    const map = new Map<string, SkillDepReport>();
    for (const r of depReports) {
      map.set(r.skillName, r);
    }
    return map;
  }, [depReports]);

  const loadSkills = useCallback(async () => {
    try {
      const skills = await ipcBridge.fs.listAvailableSkills.invoke();
      setAvailableSkills(skills || []);
    } catch (error) {
      console.error('Failed to load skills:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEngineNativeSkills = useCallback(async () => {
    try {
      const sysInfo = await ipcBridge.application.systemInfo.invoke();
      if (!sysInfo?.workDir) return;
      const result = await ipcBridge.fs.detectEngineNativeSkills.invoke({ workspace: sysInfo.workDir });
      if (result.success && result.data) {
        setEngineNativeSkills(result.data);
      }
    } catch (error) {
      console.error('Failed to detect engine-native skills:', error);
    }
  }, []);

  const loadGlobalSkills = useCallback(async () => {
    try {
      const result = await ipcBridge.fs.detectGlobalSkills.invoke();
      if (result.success && result.data) {
        setGlobalSkills(result.data);
      }
    } catch (error) {
      console.error('Failed to detect global skills:', error);
    }
  }, []);

  const checkDependencies = useCallback(async () => {
    setDepChecking(true);
    try {
      const result = await ipcBridge.fs.checkSkillDependencies.invoke();
      if (result.success && result.data) {
        setDepReports(result.data);
      }
    } catch (error) {
      console.error('Failed to check dependencies:', error);
    } finally {
      setDepChecking(false);
    }
  }, []);

  useEffect(() => {
    void loadSkills();
    void loadEngineNativeSkills();
    void loadGlobalSkills();
    void checkDependencies();
  }, [loadSkills, loadEngineNativeSkills, loadGlobalSkills, checkDependencies]);

  // Detect common skill paths when import modal opens
  useEffect(() => {
    if (importModalVisible) {
      void (async () => {
        try {
          const response = await ipcBridge.fs.detectCommonSkillPaths.invoke();
          if (response.success && response.data) {
            setCommonPaths(response.data);
          }
        } catch (error) {
          console.error('Failed to detect common paths:', error);
        }
      })();
    }
  }, [importModalVisible]);

  const handleImport = useCallback(async () => {
    if (!skillPath.trim()) {
      Message.warning(t('settings.pleaseSelectSkillPath', { defaultValue: 'Please select a skill folder path' }));
      return;
    }

    const currentPath = skillPath.trim();
    setSkillPath('');

    try {
      const paths = currentPath
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      const allFoundSkills: Array<{ name: string; description: string; path: string }> = [];

      for (const p of paths) {
        const response = await ipcBridge.fs.scanForSkills.invoke({ folderPath: p });
        if (response.success && response.data) {
          allFoundSkills.push(...response.data);
        }
      }

      if (allFoundSkills.length === 0) {
        Message.warning(t('settings.noSkillsFound', { defaultValue: 'No valid skills found in the selected path(s)' }));
        setImportModalVisible(false);
        return;
      }

      let importedCount = 0;
      let skippedCount = 0;

      for (const skill of allFoundSkills) {
        const exists = availableSkills.some((s) => s.name === skill.name);
        if (exists) {
          skippedCount++;
          continue;
        }

        const result = await ipcBridge.fs.importSkill.invoke({ skillPath: skill.path });
        if (result.success) {
          importedCount++;
        }
      }

      if (importedCount > 0) {
        const skippedText = skippedCount > 0 ? ` (${skippedCount} ${t('settings.skillsSkipped', { defaultValue: 'already installed' })})` : '';
        Message.success(`${importedCount} ${t('settings.skillsImported', { defaultValue: 'skills imported' })}${skippedText}`);
        void loadSkills();
        void checkDependencies();
      } else if (skippedCount > 0) {
        Message.warning(t('settings.allSkillsExist', { defaultValue: 'All found skills already exist' }));
      }

      setImportModalVisible(false);
    } catch (error) {
      console.error('Failed to import skills:', error);
      Message.error(t('settings.skillScanFailed', { defaultValue: 'Failed to scan skills' }));
      setImportModalVisible(false);
    }
  }, [skillPath, availableSkills, t, loadSkills, checkDependencies]);

  const handleImportEngineNative = useCallback(
    async (skill: EngineNativeSkill) => {
      setImportingSkill(skill.name);
      try {
        const result = await ipcBridge.fs.importSkill.invoke({ skillPath: skill.path });
        if (result.success) {
          Message.success(t('settings.skillImported', { defaultValue: 'Skill "{name}" imported successfully', name: skill.name }));
          void loadSkills();
          void loadEngineNativeSkills();
          void checkDependencies();
        } else {
          Message.error(result.msg || t('settings.skillImportFailed', { defaultValue: 'Failed to import skill' }));
        }
      } catch (error) {
        console.error('Failed to import engine-native skill:', error);
        Message.error(t('settings.skillImportFailed', { defaultValue: 'Failed to import skill' }));
      } finally {
        setImportingSkill(null);
      }
    },
    [t, loadSkills, loadEngineNativeSkills, checkDependencies]
  );

  const handleInstallDep = useCallback(
    async (dep: DependencyCheck) => {
      if (!dep.install) return;
      try {
        await ipcBridge.shell.openInTerminal.invoke({ command: dep.install });
        Message.info(t('settings.depInstallOpened', { defaultValue: 'Install command opened in terminal. Re-check after installation.' }));
      } catch {
        // Fallback: copy to clipboard
        try {
          await navigator.clipboard.writeText(dep.install);
          Message.info(t('settings.depInstallCopied', { defaultValue: 'Install command copied to clipboard: {cmd}', cmd: dep.install }));
        } catch {
          Message.info(dep.install);
        }
      }
    },
    [t]
  );

  const builtinSkills = availableSkills.filter((s) => !s.isCustom);
  const customSkills = availableSkills.filter((s) => s.isCustom);

  // Render dependency status for a skill
  const renderDepStatus = (skillName: string) => {
    const report = depMap.get(skillName);
    if (!report || report.dependencies.length === 0) return null;

    if (report.allSatisfied) {
      return (
        <Tooltip content={t('settings.allDepsReady', { defaultValue: 'All dependencies ready' })}>
          <span className='inline-flex items-center gap-2px text-10px px-4px py-1px bg-green-50 text-green-600 rounded border border-green-200' style={{ fontSize: '9px', fontWeight: 'bold' }}>
            <CheckOne size={10} fill='#16a34a' />
            Ready
          </span>
        </Tooltip>
      );
    }

    const missingDeps = report.dependencies.filter((d) => d.status !== 'installed');

    return (
      <Popover
        trigger='click'
        position='bottom'
        content={
          <div className='p-8px space-y-6px max-w-[360px]'>
            <div className='text-12px font-medium mb-4px'>{t('settings.missingDeps', { defaultValue: 'Missing Dependencies' })}</div>
            {missingDeps.map((dep) => (
              <div key={`${dep.type}-${dep.name}`} className='flex items-center justify-between gap-8px p-4px bg-fill-1 rounded-4px'>
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center gap-4px'>
                    <span className='text-11px font-medium'>{dep.name}</span>
                    <span className='text-9px px-3px py-0.5 bg-gray-100 text-gray-500 rounded uppercase'>{dep.type}</span>
                  </div>
                  {dep.error && <div className='text-10px text-orange-500 mt-1px'>{dep.error}</div>}
                </div>
                {dep.install && (
                  <Button size='mini' type='outline' status='warning' onClick={() => void handleInstallDep(dep)} className='shrink-0'>
                    {t('settings.install', { defaultValue: 'Install' })}
                  </Button>
                )}
              </div>
            ))}
            <div className='text-10px text-t-tertiary mt-4px'>{t('settings.depInstallHint', { defaultValue: 'Click Install to open in terminal, then re-check.' })}</div>
          </div>
        }
      >
        <span className='inline-flex items-center gap-2px text-10px px-4px py-1px bg-amber-50 text-amber-600 rounded border border-amber-200 cursor-pointer hover:bg-amber-100' style={{ fontSize: '9px', fontWeight: 'bold' }}>
          <CloseOne size={10} fill='#d97706' />
          {missingDeps.length} {t('settings.missing', { defaultValue: 'missing' })}
        </span>
      </Popover>
    );
  };

  // Render inline dependency list (for expanded view)
  const renderDepList = (skillName: string) => {
    const report = depMap.get(skillName);
    if (!report || report.dependencies.length === 0) return null;

    return (
      <div className='flex flex-wrap gap-4px mt-4px'>
        {report.dependencies.map((dep) => {
          const isOk = dep.status === 'installed';
          return (
            <Tooltip key={`${dep.type}-${dep.name}`} content={isOk ? `${dep.name}${dep.version ? ` v${dep.version}` : ''} - installed` : `${dep.name} - ${dep.install || 'not installed'}`}>
              <span className={`inline-flex items-center gap-2px text-10px px-3px py-0.5 rounded border ${isOk ? 'bg-green-50/50 text-green-600 border-green-200/60' : 'bg-red-50/50 text-red-500 border-red-200/60 cursor-pointer hover:bg-red-100/50'}`} style={{ fontSize: '9px' }} onClick={isOk ? undefined : () => void handleInstallDep(dep)}>
                {isOk ? <CheckOne size={9} fill='#16a34a' /> : <CloseOne size={9} fill='#ef4444' />}
                {dep.type}:{dep.name}
              </span>
            </Tooltip>
          );
        })}
      </div>
    );
  };

  // Render a single skill row
  const renderSkillRow = (skill: SkillInfo, showCustomBadge = false) => (
    <div key={skill.name} className='flex items-start gap-8px p-8px hover:bg-fill-1 rounded-4px'>
      <div className='flex-1 min-w-0'>
        <div className='flex items-center gap-4px flex-wrap'>
          <div className='text-13px font-medium text-t-primary'>{skill.name}</div>
          {showCustomBadge && (
            <span className='text-10px px-4px py-1px bg-orange-100 text-orange-600 rounded border border-orange-200 uppercase' style={{ fontSize: '9px', fontWeight: 'bold' }}>
              Custom
            </span>
          )}
          {renderDepStatus(skill.name)}
        </div>
        {skill.description && <div className='text-12px text-t-secondary mt-2px line-clamp-2'>{skill.description}</div>}
        {renderDepList(skill.name)}
      </div>
    </div>
  );

  return (
    <div className='flex flex-col gap-16px'>
      <div className='flex items-center justify-between'>
        <div>
          <Typography.Title heading={5} className='!mb-4px'>
            {t('settings.skills', { defaultValue: 'Skills' })}
          </Typography.Title>
          <Typography.Text className='text-12px !color-#86909C'>{t('settings.skillsDescription', { defaultValue: 'Manage globally installed skills. Per-assistant skill selection is configured in Assistants settings.' })}</Typography.Text>
        </div>
        <div className='flex items-center gap-8px'>
          <Tooltip content={t('settings.recheckDeps', { defaultValue: 'Re-check dependencies' })}>
            <Button type='secondary' icon={depChecking ? <Loading size={14} /> : <Refresh size={14} />} onClick={() => void checkDependencies()} disabled={depChecking} className='rounded-[100px]' />
          </Tooltip>
          <Button type='primary' icon={<Plus size={14} />} onClick={() => setImportModalVisible(true)} className='rounded-[100px]'>
            {t('settings.importSkills', { defaultValue: 'Import Skills' })}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className='text-center text-t-secondary py-32px'>{t('common.loading', { defaultValue: 'Loading...' })}</div>
      ) : availableSkills.length === 0 ? (
        <div className='text-center text-t-secondary py-32px'>{t('settings.noSkillsInstalled', { defaultValue: 'No skills installed' })}</div>
      ) : (
        <Collapse defaultActiveKey={['builtin-skills', 'custom-skills']}>
          {builtinSkills.length > 0 && (
            <Collapse.Item header={<span className='text-13px font-medium'>{t('settings.builtinSkills', { defaultValue: 'Builtin Skills' })}</span>} name='builtin-skills' extra={<span className='text-12px text-t-secondary'>{builtinSkills.length}</span>}>
              <div className='space-y-4px'>{builtinSkills.map((skill) => renderSkillRow(skill))}</div>
            </Collapse.Item>
          )}

          {customSkills.length > 0 && (
            <Collapse.Item header={<span className='text-13px font-medium'>{t('settings.customSkills', { defaultValue: 'Imported Skills (Library)' })}</span>} name='custom-skills' extra={<span className='text-12px text-t-secondary'>{customSkills.length}</span>}>
              <div className='space-y-4px'>{customSkills.map((skill) => renderSkillRow(skill, true))}</div>
            </Collapse.Item>
          )}
        </Collapse>
      )}

      {/* Engine-Native Skills Section */}
      <Collapse defaultActiveKey={['engine-native-skills']}>
        <Collapse.Item header={<span className='text-13px font-medium'>{t('settings.engineNativeSkills', { defaultValue: 'Detected Skills' })}</span>} name='engine-native-skills' extra={<span className='text-12px text-t-secondary'>{engineNativeSkills.length}</span>}>
          <div className='text-12px color-#86909C mb-8px'>{t('settings.engineNativeDescription', { defaultValue: 'Skills created by agents in engine directories, not managed by Margay.' })}</div>
          {engineNativeSkills.length > 0 ? (
            <div className='space-y-4px'>
              {engineNativeSkills.map((skill) => (
                <div key={`${skill.engine}-${skill.name}`} className='flex items-center justify-between gap-8px p-8px hover:bg-fill-1 rounded-4px'>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-4px'>
                      <span className='text-13px font-medium text-t-primary'>{skill.name}</span>
                      <span
                        className='text-10px px-4px py-1px rounded border uppercase'
                        style={{
                          fontSize: '9px',
                          fontWeight: 'bold',
                          backgroundColor: skill.engine === 'claude' ? '#EDE9FE' : skill.engine === 'gemini' ? '#DCFCE7' : '#DBEAFE',
                          color: skill.engine === 'claude' ? '#7C3AED' : skill.engine === 'gemini' ? '#16A34A' : '#2563EB',
                          borderColor: skill.engine === 'claude' ? '#C4B5FD' : skill.engine === 'gemini' ? '#86EFAC' : '#93C5FD',
                        }}
                      >
                        {skill.engine}
                      </span>
                    </div>
                    {!skill.hasSkillMd && <div className='text-11px color-#F59E0B mt-2px'>{t('settings.noSkillMd', { defaultValue: 'Missing SKILL.md — cannot import' })}</div>}
                  </div>
                  <Button size='mini' type='outline' disabled={!skill.hasSkillMd || importingSkill === skill.name} loading={importingSkill === skill.name} onClick={() => void handleImportEngineNative(skill)}>
                    {t('settings.importToMargay', { defaultValue: 'Import' })}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className='text-12px text-t-tertiary py-8px'>{t('settings.noEngineNativeSkills', { defaultValue: 'No engine-native skills detected. Skills created by agents will appear here.' })}</div>
          )}
        </Collapse.Item>
      </Collapse>

      {/* Global Skills Section (home directory) */}
      {globalSkills.length > 0 && (
        <Collapse defaultActiveKey={['global-skills']}>
          <Collapse.Item header={<span className='text-13px font-medium'>{t('settings.globalSkills', { defaultValue: 'Global Skills' })}</span>} name='global-skills' extra={<span className='text-12px text-t-secondary'>{globalSkills.length}</span>}>
            <div className='text-12px color-#86909C mb-8px'>{t('settings.globalSkillsDescription', { defaultValue: 'Skills installed at home directory level (~/.claude/skills/, ~/.gemini/skills/). Read-only.' })}</div>
            <div className='space-y-4px'>
              {globalSkills.map((skill) => (
                <div key={`${skill.engine}-${skill.name}`} className='flex items-center gap-8px p-8px hover:bg-fill-1 rounded-4px'>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-4px'>
                      <span className='text-13px font-medium text-t-primary'>{skill.name}</span>
                      <span
                        className='text-10px px-4px py-1px rounded border uppercase'
                        style={{
                          fontSize: '9px',
                          fontWeight: 'bold',
                          backgroundColor: skill.engine === 'claude' ? '#EDE9FE' : '#DCFCE7',
                          color: skill.engine === 'claude' ? '#7C3AED' : '#16A34A',
                          borderColor: skill.engine === 'claude' ? '#C4B5FD' : '#86EFAC',
                        }}
                      >
                        {skill.engine}
                      </span>
                    </div>
                    <div className='text-11px text-t-tertiary mt-2px truncate'>{skill.path}</div>
                  </div>
                </div>
              ))}
            </div>
          </Collapse.Item>
        </Collapse>
      )}

      {/* Import Skills Modal */}
      <Modal
        visible={importModalVisible}
        onCancel={() => {
          setImportModalVisible(false);
          setSkillPath('');
        }}
        onOk={() => void handleImport()}
        title={t('settings.addSkillsTitle', { defaultValue: 'Add Skills' })}
        okText={t('common.confirm', { defaultValue: 'Confirm' })}
        cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
        className='w-[90vw] md:w-[500px]'
      >
        <div className='space-y-16px'>
          <div>
            <div className='text-12px text-t-secondary mb-8px'>{t('settings.quickScan', { defaultValue: 'Quick Scan Common Paths' })}</div>
            <div className='flex flex-wrap gap-8px'>
              {commonPaths.map((cp) => (
                <Button
                  key={cp.path}
                  size='small'
                  type='secondary'
                  disabled={!cp.exists}
                  className={`rounded-[100px] ${cp.exists ? 'bg-fill-2 hover:bg-fill-3' : 'opacity-50'}`}
                  onClick={() => {
                    if (!cp.exists || skillPath.includes(cp.path)) return;
                    setSkillPath(skillPath ? `${skillPath}, ${cp.path}` : cp.path);
                  }}
                >
                  {cp.name}
                  {!cp.exists && <span className='text-10px ml-4px text-t-tertiary'>(not found)</span>}
                </Button>
              ))}
            </div>
          </div>

          <div className='space-y-12px'>
            <Typography.Text>{t('settings.skillFolderPath', { defaultValue: 'Skill Folder Path' })}</Typography.Text>
            <Input.Group className='flex items-center gap-8px'>
              <Input value={skillPath} onChange={(value) => setSkillPath(value)} placeholder={t('settings.skillPathPlaceholder', { defaultValue: 'Enter or browse skill folder path' })} className='flex-1' />
              <Button
                type='outline'
                icon={<FolderOpen size={16} />}
                onClick={async () => {
                  try {
                    const result = await ipcBridge.dialog.showOpen.invoke({
                      properties: ['openDirectory', 'multiSelections'],
                    });
                    if (result && result.length > 0) {
                      setSkillPath(result.join(', '));
                    }
                  } catch (error) {
                    console.error('Failed to open directory dialog:', error);
                  }
                }}
              >
                {t('common.browse', { defaultValue: 'Browse' })}
              </Button>
            </Input.Group>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SkillsManagement;
