import { Routes } from "react-router-dom";

interface AnimatedRoutesProps {
  children: React.ReactNode;
}

/**
 * AnimatedRoutes - 页面路由容器（动画已禁用以修复白屏问题）
 */
export function AnimatedRoutes({ children }: AnimatedRoutesProps) {
  return (
    <Routes>
      {children}
    </Routes>
  );
}
