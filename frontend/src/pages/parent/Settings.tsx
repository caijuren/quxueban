import ChildrenManagement from './settings/ChildrenManagement';

export default function SettingsPage() {
  return (
    <div className="h-[calc(100vh-6rem)] p-6">
      <div className="h-full rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b border-border p-6">
          <h1 className="text-xl font-semibold text-foreground">孩子管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            当前收口阶段先保留孩子配置功能，等核心链路稳定后再逐步恢复其他设置模块。
          </p>
        </div>
        <div className="p-6">
          <ChildrenManagement />
        </div>
      </div>
    </div>
  );
}
