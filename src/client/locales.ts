/**
 * Localized text for the plugin master settings tab. The Chinese copy is
 * the source of truth for the key set; the English copy is checked
 * against it during typecheck (same number of keys).
 *
 * Keys are grouped by UI region:
 *   - tab + header
 *   - controls (search, refresh, expand/collapse)
 *   - section headings
 *   - per-package card labels
 *   - per-entry row labels
 *   - uninstall dialog
 *   - status / failure messages
 */

export const zh = {
  // Tab + header
  tab: '插件管理',
  headerTitle: '插件管理',
  headerIntro: '浏览已安装的插件,按仓库名、描述或 Loader 条目搜索,启用、禁用或卸载插件,区分系统自带与用户安装的包。',
  profile: 'Profile',
  systemTotal: '系统插件',
  userTotal: '用户插件',
  totalPlugins: '共',

  // Search + controls
  searchPlaceholder: '按名称、仓库或条目 id 搜索(支持空格、模糊)',
  search: '搜索',
  refresh: '刷新',
  collapseAll: '全部折叠',
  expandAll: '全部展开',

  // Sections
  systemSection: '系统插件',
  systemSectionHint: '随 DeepSeek Harness 安装或 profile 模板加载的插件,不可卸载。',
  userSection: '用户安装的插件',
  userSectionHint: '通过 `dsh plugin add`、链接或 tarball 安装的第三方插件,可启用、禁用或卸载。',
  emptySystem: '没有系统插件。',
  emptyUser: '没有用户安装的插件。',
  noMatches: '没有匹配的插件。',
  emptySearch: '请输入关键字以过滤插件。',
  loadError: '读取插件失败。',
  retry: '重试',

  // Package card
  packageVersion: '版本',
  packageInstallKind: '安装方式',
  packageInstallKindRegistry: 'npm 注册表',
  packageInstallKindLink: '本地链接',
  packageInstallKindFile: '本地路径',
  packageInstallKindGit: 'Git 仓库',
  packageInstallKindTarball: 'Tarball',
  packageInstallKindWorkspace: 'Workspace',
  packageInstallKindUnknown: '未知',
  packageRepository: '仓库',
  packageHomepage: '首页',
  packageAuthor: '作者',
  packageBundle: 'Bundle',
  packageYes: '是',
  packageNo: '否',
  packageKeywords: '关键词',
  packageReasons: '分类依据',
  packageLoaderEntries: 'Loader 条目',

  installKindRegistry: 'npm 注册表',
  installKindLink: '本地链接',
  installKindFile: '本地路径',
  installKindGit: 'Git 仓库',
  installKindTarball: 'Tarball',
  installKindWorkspace: 'Workspace',
  installKindUnknown: '未知',

  // Per-entry row
  entryId: 'Loader entry id',
  configId: '配置 id',
  moduleName: '模块名',
  status: '状态',
  phasePending: '等待依赖',
  phaseLoading: '加载中',
  phaseActive: '已挂载',
  phaseFailed: '挂载失败',
  phaseUnloading: '卸载中',
  phaseUnobserved: '未挂载',
  enabledTag: '已启用',
  disabledTag: '已停用',
  errorTag: '失败',
  protectedReason: '受保护',

  // Controls on rows / cards
  enable: '启用',
  disable: '停用',
  uninstall: '卸载',
  uninstallConfirm: '确认卸载',
  uninstallConfirmMessage: '确定卸载 {package}?将从 node_modules 中删除该包,并将其从 profile 的 bundles 中移除。需要重启 profile 才能完全生效。',
  cancel: '取消',
  confirm: '确认',
  restartRequired: '需要重启 profile',

  // Mutation receipts
  mutationChanged: '已修改',
  mutationUnchanged: '未变化',
  mutationSkipped: '已跳过',
  mutationFailed: '失败',
  mutationRestartRequired: '需要重启 profile',

  // Snapshot errors
  uninstallFailed: '卸载失败',
  uninstallBlocked: '此插件无法卸载。',
  uninstallBlockedSystem: '此插件随 Harness 安装,无法卸载。',
  uninstallBlockedSelf: '插件管理器自身不能卸载。',

  // Development mode
  devMode: '开发模式',
  devModeHint: '开启后,启动失败的开发插件会被自动隔离(仅运行时),不会阻止进入 Harness 主界面;系统插件不受影响。',
  devModeOn: '已开启',
  devModeOff: '已关闭',
  quarantinedTag: '开发模式隔离',

  // Receipt dialog
  operationFailed: '操作未完成',
  close: '关闭',
}

export const en = {
  tab: 'Plugin Manager',
  headerTitle: 'Plugin Manager',
  headerIntro: 'Browse installed plugins, search by name, repository, or loader entry id, enable, disable, or uninstall, and distinguish system-shipped from user-installed packages.',
  profile: 'Profile',
  systemTotal: 'System',
  userTotal: 'User',
  totalPlugins: 'Total',

  searchPlaceholder: 'Search by name, repository, or entry id (fuzzy)',
  search: 'Search',
  refresh: 'Refresh',
  collapseAll: 'Collapse all',
  expandAll: 'Expand all',

  systemSection: 'System plugins',
  systemSectionHint: 'Bundled with DeepSeek Harness or installed by the profile template. Cannot be uninstalled.',
  userSection: 'User-installed plugins',
  userSectionHint: 'Third-party packages added with `dsh plugin add`, linked, or installed from a tarball. Can be enabled, disabled, or uninstalled.',
  emptySystem: 'No system plugins.',
  emptyUser: 'No user-installed plugins.',
  noMatches: 'No plugins match the current query.',
  emptySearch: 'Type to filter the plugin list.',
  loadError: 'Failed to load plugins.',
  retry: 'Retry',

  packageVersion: 'Version',
  packageInstallKind: 'Install',
  packageInstallKindRegistry: 'npm registry',
  packageInstallKindLink: 'Local link',
  packageInstallKindFile: 'Local path',
  packageInstallKindGit: 'Git repo',
  packageInstallKindTarball: 'Tarball',
  packageInstallKindWorkspace: 'Workspace',
  packageInstallKindUnknown: 'Unknown',
  packageRepository: 'Repository',
  packageHomepage: 'Homepage',
  packageAuthor: 'Author',
  packageBundle: 'Bundle',
  packageYes: 'Yes',
  packageNo: 'No',
  packageKeywords: 'Keywords',
  packageReasons: 'Classification',
  packageLoaderEntries: 'Loader entries',

  installKindRegistry: 'npm registry',
  installKindLink: 'Local link',
  installKindFile: 'Local path',
  installKindGit: 'Git repo',
  installKindTarball: 'Tarball',
  installKindWorkspace: 'Workspace',
  installKindUnknown: 'Unknown',

  entryId: 'Loader entry id',
  configId: 'Config id',
  moduleName: 'Module name',
  status: 'Status',
  phasePending: 'Waiting on dependencies',
  phaseLoading: 'Loading',
  phaseActive: 'Mounted',
  phaseFailed: 'Mount failed',
  phaseUnloading: 'Unloading',
  phaseUnobserved: 'Not mounted',
  enabledTag: 'Enabled',
  disabledTag: 'Disabled',
  errorTag: 'Error',
  protectedReason: 'Protected',

  enable: 'Enable',
  disable: 'Disable',
  uninstall: 'Uninstall',
  uninstallConfirm: 'Confirm uninstall',
  uninstallConfirmMessage: 'Uninstall {package}? This removes it from node_modules and drops it from the profile bundle stack. Restart the profile for the change to fully take effect.',
  cancel: 'Cancel',
  confirm: 'Confirm',
  restartRequired: 'Profile restart required',

  mutationChanged: 'Changed',
  mutationUnchanged: 'Unchanged',
  mutationSkipped: 'Skipped',
  mutationFailed: 'Failed',
  mutationRestartRequired: 'Restart required',

  uninstallFailed: 'Uninstall failed',
  uninstallBlocked: 'This plugin cannot be uninstalled.',
  uninstallBlockedSystem: 'This plugin ships with Harness and cannot be uninstalled.',
  uninstallBlockedSelf: 'The plugin manager cannot uninstall itself.',

  // Development mode
  devMode: 'Development mode',
  devModeHint: 'When on, user plugins that fail to start are quarantined (runtime only) so the Harness UI still opens. System plugins are never quarantined.',
  devModeOn: 'On',
  devModeOff: 'Off',
  quarantinedTag: 'Quarantined (dev mode)',

  // Receipt dialog
  operationFailed: 'Operation not completed',
  close: 'Close',
}

export type LocaleKey = keyof typeof zh
export const locales = { zh, en } as const