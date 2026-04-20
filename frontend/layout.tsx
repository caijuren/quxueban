import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/components/parent/Layout.tsx");import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=df6cf075"; const _jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"]; const _Fragment = __vite__cjsImport0_react_jsxDevRuntime["Fragment"];
var _s = $RefreshSig$();
import __vite__cjsImport1_react from "/node_modules/.vite/deps/react.js?v=df6cf075"; const useState = __vite__cjsImport1_react["useState"]; const useEffect = __vite__cjsImport1_react["useEffect"];
import { NavLink, Outlet, useNavigate, useLocation } from "/node_modules/.vite/deps/react-router-dom.js?v=df6cf075";
import { motion, AnimatePresence } from "/node_modules/.vite/deps/framer-motion.js?v=df6cf075";
import { LayoutDashboard, ListTodo, CalendarDays, Library, BookOpen, Trophy, Users, BarChart3, Settings, LogOut, Menu, ChevronDown, Bell } from "/node_modules/.vite/deps/lucide-react.js?v=df6cf075";
import { useAuth } from "/src/hooks/useAuth.tsx?t=1776268069209";
import { Button } from "/src/components/ui/button.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "/src/components/ui/avatar.tsx";
import { ScrollArea } from "/src/components/ui/scroll-area.tsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "/src/components/ui/dropdown-menu.tsx";
import { cn } from "/src/lib/utils.ts";
import { useSelectedChild } from "/src/contexts/SelectedChildContext.tsx?t=1776268069209";
const navItems = [
    {
        path: '/parent',
        label: '概览',
        icon: LayoutDashboard
    },
    {
        path: '/parent/tasks',
        label: '任务',
        icon: ListTodo
    },
    {
        path: '/parent/plans',
        label: '计划',
        icon: CalendarDays
    },
    {
        path: '/parent/library',
        label: '图书馆',
        icon: Library
    },
    {
        path: '/parent/reading',
        label: '阅读',
        icon: BookOpen
    },
    {
        path: '/parent/achievements',
        label: '成就',
        icon: Trophy
    },
    {
        path: '/parent/statistics',
        label: '数据',
        icon: BarChart3
    },
    {
        path: '/parent/settings',
        label: '设置',
        icon: Settings
    }
];
const sidebarVariants = {
    closed: {
        x: '-100%',
        opacity: 0
    },
    open: {
        x: 0,
        opacity: 1
    }
};
const overlayVariants = {
    closed: {
        opacity: 0
    },
    open: {
        opacity: 1
    }
};
export default function ParentLayout() {
    _s();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
    const { user, logout, isAuthenticated, isInitializing } = useAuth();
    const { children, selectedChild, selectChild, isLoading } = useSelectedChild();
    const navigate = useNavigate();
    const location = useLocation();
    // 路由守卫：未登录时跳转到登录页，孩子用户跳转到孩子页面
    useEffect(()=>{
        if (!isInitializing && !isAuthenticated) {
            navigate('/login', {
                replace: true,
                state: {
                    from: location
                }
            });
        } else if (!isInitializing && isAuthenticated && user?.role !== 'parent') {
            // 孩子用户访问家长页面，重定向到孩子首页
            navigate('/child', {
                replace: true
            });
        }
    }, [
        isInitializing,
        isAuthenticated,
        user,
        navigate,
        location
    ]);
    // 初始化中显示加载状态，避免子组件访问未定义数据
    if (isInitializing) {
        console.log('[Layout] Initializing...');
        return /*#__PURE__*/ _jsxDEV("div", {
            className: "min-h-screen bg-[#F5F5F7] flex items-center justify-center",
            children: /*#__PURE__*/ _jsxDEV("div", {
                className: "flex flex-col items-center gap-4",
                children: [
                    /*#__PURE__*/ _jsxDEV("div", {
                        className: "w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-purple-500/25 animate-pulse",
                        children: "🐛"
                    }, void 0, false, {
                        fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                        lineNumber: 76,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ _jsxDEV("p", {
                        className: "text-gray-500",
                        children: "加载中..."
                    }, void 0, false, {
                        fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                        lineNumber: 79,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                lineNumber: 75,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
            lineNumber: 74,
            columnNumber: 7
        }, this);
    }
    // 未登录不渲染任何内容（会由useEffect重定向）
    if (!isAuthenticated) {
        console.log('[Layout] Not authenticated, rendering null');
        return null;
    }
    console.log('[Layout] Rendering with user:', user?.name, 'familyCode:', user?.familyCode);
    const handleLogout = ()=>{
        logout();
        navigate('/login');
    };
    const closeSidebar = ()=>setSidebarOpen(false);
    return /*#__PURE__*/ _jsxDEV("div", {
        className: "min-h-screen bg-background",
        children: [
            /*#__PURE__*/ _jsxDEV("div", {
                className: "fixed inset-0 overflow-hidden pointer-events-none",
                children: [
                    /*#__PURE__*/ _jsxDEV("div", {
                        className: "absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-primary/5 to-primary/10 rounded-full blur-3xl"
                    }, void 0, false, {
                        fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                        lineNumber: 104,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ _jsxDEV("div", {
                        className: "absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-primary/5 to-primary/10 rounded-full blur-3xl"
                    }, void 0, false, {
                        fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                        lineNumber: 105,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                lineNumber: 103,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ _jsxDEV("header", {
                className: "fixed top-0 left-0 right-0 z-50 bg-white border-b border-border shadow-sm h-16",
                children: /*#__PURE__*/ _jsxDEV("div", {
                    className: "flex items-center justify-between h-full px-6",
                    children: [
                        /*#__PURE__*/ _jsxDEV("div", {
                            className: "flex items-center gap-4",
                            children: [
                                /*#__PURE__*/ _jsxDEV("div", {
                                    className: "flex items-center",
                                    children: [
                                        /*#__PURE__*/ _jsxDEV("div", {
                                            className: "w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-sm shadow-md",
                                            children: "趣"
                                        }, void 0, false, {
                                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                            lineNumber: 114,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ _jsxDEV("h1", {
                                            className: "ml-2 font-semibold text-foreground text-base",
                                            children: "趣学伴"
                                        }, void 0, false, {
                                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                            lineNumber: 117,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                    lineNumber: 113,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ _jsxDEV("nav", {
                                    className: "hidden md:flex items-center gap-2 ml-6",
                                    children: navItems.map((item)=>{
                                        const isActive = item.path === '/parent' ? location.pathname === '/parent' : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
                                        const Icon = item.icon;
                                        return /*#__PURE__*/ _jsxDEV(NavLink, {
                                            to: item.path,
                                            className: cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group', isActive ? 'bg-primary text-white shadow-sm' : 'text-foreground hover:bg-muted'),
                                            children: [
                                                /*#__PURE__*/ _jsxDEV("div", {
                                                    className: cn('w-7 h-7 rounded flex items-center justify-center transition-all duration-200', isActive ? 'bg-white/20' : 'bg-muted group-hover:bg-muted/50'),
                                                    children: /*#__PURE__*/ _jsxDEV(Icon, {
                                                        className: cn('size-4 transition-transform duration-200', isActive ? '' : 'group-hover:scale-105')
                                                    }, void 0, false, {
                                                        fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                        lineNumber: 140,
                                                        columnNumber: 23
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                    lineNumber: 136,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ _jsxDEV("span", {
                                                    className: "text-sm transition-all duration-200",
                                                    children: item.label
                                                }, void 0, false, {
                                                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                    lineNumber: 145,
                                                    columnNumber: 21
                                                }, this)
                                            ]
                                        }, item.path, true, {
                                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                            lineNumber: 126,
                                            columnNumber: 19
                                        }, this);
                                    })
                                }, void 0, false, {
                                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                    lineNumber: 119,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                            lineNumber: 112,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ _jsxDEV("div", {
                            className: "flex items-center gap-3",
                            children: [
                                /*#__PURE__*/ _jsxDEV(Button, {
                                    variant: "ghost",
                                    size: "icon",
                                    className: "text-foreground hover:bg-muted",
                                    children: /*#__PURE__*/ _jsxDEV(Bell, {
                                        className: "size-5"
                                    }, void 0, false, {
                                        fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                        lineNumber: 155,
                                        columnNumber: 15
                                    }, this)
                                }, void 0, false, {
                                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                    lineNumber: 154,
                                    columnNumber: 13
                                }, this),
                                children.length > 0 && /*#__PURE__*/ _jsxDEV(DropdownMenu, {
                                    children: [
                                        /*#__PURE__*/ _jsxDEV(DropdownMenuTrigger, {
                                            asChild: true,
                                            children: /*#__PURE__*/ _jsxDEV("button", {
                                                className: "flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted transition-colors",
                                                children: [
                                                    /*#__PURE__*/ _jsxDEV(Avatar, {
                                                        className: "size-7 ring-2 ring-white shadow-sm",
                                                        children: [
                                                            /*#__PURE__*/ _jsxDEV(AvatarImage, {
                                                                src: selectedChild?.avatar
                                                            }, void 0, false, {
                                                                fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                                lineNumber: 164,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ _jsxDEV(AvatarFallback, {
                                                                className: "bg-gradient-to-br from-purple-500 to-blue-500 text-white text-xs font-medium",
                                                                children: selectedChild?.name?.charAt(0) || 'C'
                                                            }, void 0, false, {
                                                                fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                                lineNumber: 165,
                                                                columnNumber: 23
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                        lineNumber: 163,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ _jsxDEV("span", {
                                                        className: "text-sm font-medium text-foreground",
                                                        children: selectedChild?.name || '选择孩子'
                                                    }, void 0, false, {
                                                        fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                        lineNumber: 169,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ _jsxDEV(ChevronDown, {
                                                        className: "size-4 text-gray-400"
                                                    }, void 0, false, {
                                                        fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                        lineNumber: 170,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                lineNumber: 162,
                                                columnNumber: 19
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                            lineNumber: 161,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ _jsxDEV(DropdownMenuContent, {
                                            align: "end",
                                            className: "w-56 border border-border rounded-lg shadow-lg p-1",
                                            children: [
                                                children.map((child)=>{
                                                    const isSelected = selectedChild?.id === child.id;
                                                    return /*#__PURE__*/ _jsxDEV(DropdownMenuItem, {
                                                        className: cn("cursor-pointer rounded-md hover:bg-muted transition-colors", isSelected && "bg-primary/10 text-primary"),
                                                        onClick: ()=>selectChild(child.id),
                                                        children: [
                                                            /*#__PURE__*/ _jsxDEV(Avatar, {
                                                                className: "size-5 mr-2",
                                                                children: [
                                                                    /*#__PURE__*/ _jsxDEV(AvatarImage, {
                                                                        src: child.avatar
                                                                    }, void 0, false, {
                                                                        fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                                        lineNumber: 187,
                                                                        columnNumber: 27
                                                                    }, this),
                                                                    /*#__PURE__*/ _jsxDEV(AvatarFallback, {
                                                                        className: "bg-gradient-to-br from-purple-500 to-blue-500 text-white text-xs",
                                                                        children: child.name?.charAt(0) || 'C'
                                                                    }, void 0, false, {
                                                                        fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                                        lineNumber: 188,
                                                                        columnNumber: 27
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                                lineNumber: 186,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ _jsxDEV("span", {
                                                                children: child.name
                                                            }, void 0, false, {
                                                                fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                                lineNumber: 192,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, child.id, true, {
                                                        fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                        lineNumber: 178,
                                                        columnNumber: 23
                                                    }, this);
                                                }),
                                                /*#__PURE__*/ _jsxDEV(DropdownMenuSeparator, {
                                                    className: "my-1"
                                                }, void 0, false, {
                                                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                    lineNumber: 197,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ _jsxDEV(DropdownMenuItem, {
                                                    className: "cursor-pointer rounded-md hover:bg-muted transition-colors",
                                                    onClick: ()=>navigate('/parent/settings'),
                                                    children: [
                                                        /*#__PURE__*/ _jsxDEV(Users, {
                                                            className: "size-4 mr-2"
                                                        }, void 0, false, {
                                                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                            lineNumber: 204,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ _jsxDEV("span", {
                                                            children: "管理孩子…"
                                                        }, void 0, false, {
                                                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                            lineNumber: 205,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                    lineNumber: 200,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                            lineNumber: 173,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                    lineNumber: 160,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ _jsxDEV(DropdownMenu, {
                                    children: [
                                        /*#__PURE__*/ _jsxDEV(DropdownMenuTrigger, {
                                            asChild: true,
                                            children: /*#__PURE__*/ _jsxDEV("button", {
                                                className: "p-1 rounded-lg hover:bg-muted transition-colors",
                                                children: /*#__PURE__*/ _jsxDEV(Avatar, {
                                                    className: "size-8 ring-2 ring-white shadow-sm",
                                                    children: [
                                                        /*#__PURE__*/ _jsxDEV(AvatarImage, {
                                                            src: user?.avatar
                                                        }, void 0, false, {
                                                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                            lineNumber: 216,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ _jsxDEV(AvatarFallback, {
                                                            className: "bg-gradient-to-br from-purple-500 to-blue-500 text-white text-sm font-medium",
                                                            children: user?.name?.charAt(0) || 'P'
                                                        }, void 0, false, {
                                                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                            lineNumber: 217,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                    lineNumber: 215,
                                                    columnNumber: 19
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                lineNumber: 214,
                                                columnNumber: 17
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                            lineNumber: 213,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ _jsxDEV(DropdownMenuContent, {
                                            align: "end",
                                            className: "w-48 border border-border rounded-lg shadow-lg p-1",
                                            children: /*#__PURE__*/ _jsxDEV(DropdownMenuItem, {
                                                className: "cursor-pointer text-destructive rounded-md hover:bg-muted transition-colors",
                                                onClick: handleLogout,
                                                children: [
                                                    /*#__PURE__*/ _jsxDEV(LogOut, {
                                                        className: "size-4 mr-2"
                                                    }, void 0, false, {
                                                        fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                        lineNumber: 225,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ _jsxDEV("span", {
                                                        children: "退出登录"
                                                    }, void 0, false, {
                                                        fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                        lineNumber: 226,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                lineNumber: 224,
                                                columnNumber: 17
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                            lineNumber: 223,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                    lineNumber: 212,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                            lineNumber: 153,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                    lineNumber: 110,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                lineNumber: 109,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ _jsxDEV("header", {
                className: "lg:hidden fixed top-16 left-0 right-0 z-40 bg-white border-b border-border",
                children: /*#__PURE__*/ _jsxDEV("div", {
                    className: "flex items-center justify-between h-12 px-5",
                    children: [
                        /*#__PURE__*/ _jsxDEV(Button, {
                            variant: "ghost",
                            size: "icon",
                            onClick: ()=>setSidebarOpen(true),
                            className: "text-foreground hover:bg-muted",
                            children: /*#__PURE__*/ _jsxDEV(Menu, {
                                className: "size-5"
                            }, void 0, false, {
                                fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                lineNumber: 243,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                            lineNumber: 237,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ _jsxDEV("h1", {
                            className: "font-semibold text-foreground text-base",
                            children: "趣学伴"
                        }, void 0, false, {
                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                            lineNumber: 245,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ _jsxDEV(Button, {
                            variant: "ghost",
                            size: "icon",
                            className: "text-foreground hover:bg-muted",
                            children: /*#__PURE__*/ _jsxDEV(Bell, {
                                className: "size-5"
                            }, void 0, false, {
                                fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                lineNumber: 247,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                            lineNumber: 246,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                    lineNumber: 236,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                lineNumber: 235,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ _jsxDEV(AnimatePresence, {
                children: sidebarOpen && /*#__PURE__*/ _jsxDEV(_Fragment, {
                    children: [
                        /*#__PURE__*/ _jsxDEV(motion.div, {
                            variants: overlayVariants,
                            initial: "closed",
                            animate: "open",
                            exit: "closed",
                            transition: {
                                duration: 0.2
                            },
                            className: "lg:hidden fixed inset-0 z-50 bg-black/30 backdrop-blur-sm",
                            onClick: closeSidebar
                        }, void 0, false, {
                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                            lineNumber: 256,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ _jsxDEV(motion.aside, {
                            variants: sidebarVariants,
                            initial: "closed",
                            animate: "open",
                            exit: "closed",
                            transition: {
                                type: 'spring',
                                damping: 25,
                                stiffness: 300
                            },
                            className: "lg:hidden fixed left-0 top-0 bottom-0 z-50 w-72 bg-white shadow-2xl",
                            children: /*#__PURE__*/ _jsxDEV(SidebarContent, {
                                user: user,
                                onLogout: handleLogout,
                                onClose: closeSidebar,
                                currentPath: location.pathname,
                                selectedChild: selectedChild
                            }, void 0, false, {
                                fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                lineNumber: 273,
                                columnNumber: 15
                            }, this)
                        }, void 0, false, {
                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                            lineNumber: 265,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true)
            }, void 0, false, {
                fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                lineNumber: 253,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ _jsxDEV("div", {
                className: "hidden lg:flex min-h-screen relative z-10 pt-16",
                children: [
                    !sidebarCollapsed && /*#__PURE__*/ _jsxDEV("aside", {
                        className: "w-56 bg-white border-r border-border flex flex-col h-screen sticky top-16 transition-all duration-300",
                        children: /*#__PURE__*/ _jsxDEV(SidebarContent, {
                            user: user,
                            onLogout: handleLogout,
                            currentPath: location.pathname,
                            selectedChild: selectedChild
                        }, void 0, false, {
                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                            lineNumber: 290,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                        lineNumber: 289,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ _jsxDEV("main", {
                        className: "flex-1 min-h-screen overflow-auto transition-all duration-300",
                        children: /*#__PURE__*/ _jsxDEV("div", {
                            className: "p-6",
                            children: /*#__PURE__*/ _jsxDEV(Outlet, {}, void 0, false, {
                                fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                lineNumber: 302,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                            lineNumber: 301,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                        lineNumber: 300,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                lineNumber: 286,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ _jsxDEV("main", {
                className: "lg:hidden pt-28 min-h-screen overflow-auto relative z-10",
                children: /*#__PURE__*/ _jsxDEV("div", {
                    className: "p-5",
                    children: /*#__PURE__*/ _jsxDEV(Outlet, {}, void 0, false, {
                        fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                        lineNumber: 310,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                    lineNumber: 309,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                lineNumber: 308,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
        lineNumber: 101,
        columnNumber: 5
    }, this);
}
_s(ParentLayout, "2ElnXvEAToGc9NBwHIKxw9uoduM=", false, function() {
    return [
        useAuth,
        useSelectedChild,
        useNavigate,
        useLocation
    ];
});
_c = ParentLayout;
function SidebarContent({ user, onLogout, onClose, currentPath, selectedChild }) {
    return /*#__PURE__*/ _jsxDEV(_Fragment, {
        children: [
            /*#__PURE__*/ _jsxDEV("div", {
                className: "p-4",
                children: /*#__PURE__*/ _jsxDEV("div", {
                    className: "flex items-center justify-between",
                    children: /*#__PURE__*/ _jsxDEV("div", {
                        className: "flex items-center",
                        children: [
                            /*#__PURE__*/ _jsxDEV("div", {
                                className: "w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-sm shadow-md",
                                children: "趣"
                            }, void 0, false, {
                                fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                lineNumber: 334,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ _jsxDEV("div", {
                                className: "ml-2",
                                children: /*#__PURE__*/ _jsxDEV("h1", {
                                    className: "font-bold text-foreground text-base",
                                    children: "趣学伴"
                                }, void 0, false, {
                                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                    lineNumber: 338,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                lineNumber: 337,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                        lineNumber: 333,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                    lineNumber: 332,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                lineNumber: 331,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ _jsxDEV(ScrollArea, {
                className: "flex-1 px-3",
                children: /*#__PURE__*/ _jsxDEV("nav", {
                    className: "space-y-1.5",
                    children: navItems.filter((item)=>item.path !== '/parent/settings').map((item)=>{
                        // 对于概览(/parent)，只精确匹配，不匹配子路径
                        // 对于其他路径，匹配当前路径或以该路径开头的子路径
                        const isActive = item.path === '/parent' ? currentPath === '/parent' : currentPath === item.path || currentPath.startsWith(`${item.path}/`);
                        const Icon = item.icon;
                        return /*#__PURE__*/ _jsxDEV(NavLink, {
                            to: item.path,
                            onClick: onClose && (()=>onClose()),
                            className: cn('flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group', isActive ? 'bg-primary text-white font-medium shadow-sm' : 'text-foreground hover:bg-muted hover:text-foreground'),
                            children: [
                                /*#__PURE__*/ _jsxDEV("div", {
                                    className: cn('w-7 h-7 rounded flex items-center justify-center transition-all duration-200', isActive ? 'bg-white/20' : 'bg-muted group-hover:bg-muted/50'),
                                    children: /*#__PURE__*/ _jsxDEV(Icon, {
                                        className: cn('size-4 transition-transform duration-200', isActive ? '' : 'group-hover:scale-105')
                                    }, void 0, false, {
                                        fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                        lineNumber: 371,
                                        columnNumber: 19
                                    }, this)
                                }, void 0, false, {
                                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                    lineNumber: 367,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ _jsxDEV("span", {
                                    className: "text-sm transition-all duration-200",
                                    children: item.label
                                }, void 0, false, {
                                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                    lineNumber: 376,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, item.path, true, {
                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                            lineNumber: 356,
                            columnNumber: 15
                        }, this);
                    })
                }, void 0, false, {
                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                    lineNumber: 347,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                lineNumber: 346,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ _jsxDEV("div", {
                className: "p-3 border-t border-gray-200/50",
                children: /*#__PURE__*/ _jsxDEV("div", {
                    className: "flex items-center justify-between",
                    children: [
                        /*#__PURE__*/ _jsxDEV("div", {
                            className: "flex items-center gap-3",
                            children: [
                                /*#__PURE__*/ _jsxDEV("div", {
                                    className: "relative",
                                    children: [
                                        /*#__PURE__*/ _jsxDEV(Avatar, {
                                            className: "size-10 ring-2 ring-white shadow-sm",
                                            children: [
                                                /*#__PURE__*/ _jsxDEV(AvatarImage, {
                                                    src: user?.avatar
                                                }, void 0, false, {
                                                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                    lineNumber: 389,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ _jsxDEV(AvatarFallback, {
                                                    className: "bg-gradient-to-br from-purple-500 to-blue-500 text-white text-sm font-medium",
                                                    children: user?.name?.charAt(0) || 'P'
                                                }, void 0, false, {
                                                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                    lineNumber: 390,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                            lineNumber: 388,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ _jsxDEV("div", {
                                            className: "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full ring-2 ring-white"
                                        }, void 0, false, {
                                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                            lineNumber: 394,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                    lineNumber: 387,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ _jsxDEV("div", {
                                    children: [
                                        /*#__PURE__*/ _jsxDEV("p", {
                                            className: "font-medium text-gray-900 text-sm",
                                            children: user?.name || '家长'
                                        }, void 0, false, {
                                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                            lineNumber: 397,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ _jsxDEV("p", {
                                            className: "text-xs text-gray-500",
                                            children: "在线"
                                        }, void 0, false, {
                                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                            lineNumber: 398,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                    lineNumber: 396,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                            lineNumber: 386,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ _jsxDEV(DropdownMenu, {
                            children: [
                                /*#__PURE__*/ _jsxDEV(DropdownMenuTrigger, {
                                    asChild: true,
                                    children: /*#__PURE__*/ _jsxDEV("button", {
                                        className: "p-1 rounded-xl hover:bg-gray-100 transition-all",
                                        children: /*#__PURE__*/ _jsxDEV(ChevronDown, {
                                            className: "size-4 text-gray-400"
                                        }, void 0, false, {
                                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                            lineNumber: 404,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                        lineNumber: 403,
                                        columnNumber: 15
                                    }, this)
                                }, void 0, false, {
                                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                    lineNumber: 402,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ _jsxDEV(DropdownMenuContent, {
                                    align: "end",
                                    className: "w-48",
                                    children: [
                                        /*#__PURE__*/ _jsxDEV("div", {
                                            className: "p-2 border-b border-gray-100",
                                            children: [
                                                /*#__PURE__*/ _jsxDEV("p", {
                                                    className: "font-medium text-gray-900 text-sm",
                                                    children: user?.name || '家长'
                                                }, void 0, false, {
                                                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                    lineNumber: 409,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ _jsxDEV("p", {
                                                    className: "text-xs text-gray-500",
                                                    children: "在线"
                                                }, void 0, false, {
                                                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                    lineNumber: 410,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                            lineNumber: 408,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ _jsxDEV(DropdownMenuItem, {
                                            className: "cursor-pointer",
                                            children: [
                                                /*#__PURE__*/ _jsxDEV(Settings, {
                                                    className: "size-4 mr-2"
                                                }, void 0, false, {
                                                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                    lineNumber: 413,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ _jsxDEV("span", {
                                                    children: "设置"
                                                }, void 0, false, {
                                                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                    lineNumber: 414,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                            lineNumber: 412,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ _jsxDEV(DropdownMenuItem, {
                                            className: "cursor-pointer text-red-600",
                                            onClick: onLogout,
                                            children: [
                                                /*#__PURE__*/ _jsxDEV(LogOut, {
                                                    className: "size-4 mr-2"
                                                }, void 0, false, {
                                                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                    lineNumber: 417,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ _jsxDEV("span", {
                                                    children: "退出登录"
                                                }, void 0, false, {
                                                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                                    lineNumber: 418,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                            lineNumber: 416,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                                    lineNumber: 407,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                            lineNumber: 401,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                    lineNumber: 385,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx",
                lineNumber: 384,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true);
}
_c1 = SidebarContent;
var _c, _c1;
$RefreshReg$(_c, "ParentLayout");
$RefreshReg$(_c1, "SidebarContent");


import * as RefreshRuntime from "/@react-refresh";
const inWebWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react-swc can't detect preamble. Something is wrong."
    );
  }

  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
function $RefreshReg$(type, id) { return RefreshRuntime.register(type, "/Users/grubby/Desktop/quxueban/frontend/src/components/parent/Layout.tsx" + ' ' + id) }
function $RefreshSig$() { return RefreshRuntime.createSignatureFunctionForTransform(); }

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkxheW91dC50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdXNlU3RhdGUsIHVzZUVmZmVjdCB9IGZyb20gJ3JlYWN0JztcbmltcG9ydCB7IE5hdkxpbmssIExpbmssIE91dGxldCwgdXNlTmF2aWdhdGUsIHVzZUxvY2F0aW9uIH0gZnJvbSAncmVhY3Qtcm91dGVyLWRvbSc7XG5pbXBvcnQgeyBtb3Rpb24sIEFuaW1hdGVQcmVzZW5jZSB9IGZyb20gJ2ZyYW1lci1tb3Rpb24nO1xuaW1wb3J0IHtcbiAgTGF5b3V0RGFzaGJvYXJkLFxuICBMaXN0VG9kbyxcbiAgQ2FsZW5kYXJEYXlzLFxuICBMaWJyYXJ5LFxuICBCb29rT3BlbixcbiAgVHJvcGh5LFxuICBVc2VycyxcbiAgQmFyQ2hhcnQzLFxuICBTZXR0aW5ncyxcbiAgTG9nT3V0LFxuICBNZW51LFxuICBYLFxuICBDaGV2cm9uRG93bixcbiAgQmVsbCxcbiAgUGx1cyxcbiAgQ2FsZW5kYXJQbHVzLFxufSBmcm9tICdsdWNpZGUtcmVhY3QnO1xuaW1wb3J0IHsgdXNlQXV0aCB9IGZyb20gJ0AvaG9va3MvdXNlQXV0aCc7XG5pbXBvcnQgeyBCdXR0b24gfSBmcm9tICdAL2NvbXBvbmVudHMvdWkvYnV0dG9uJztcbmltcG9ydCB7IEF2YXRhciwgQXZhdGFyRmFsbGJhY2ssIEF2YXRhckltYWdlIH0gZnJvbSAnQC9jb21wb25lbnRzL3VpL2F2YXRhcic7XG5pbXBvcnQgeyBTY3JvbGxBcmVhIH0gZnJvbSAnQC9jb21wb25lbnRzL3VpL3Njcm9sbC1hcmVhJztcbmltcG9ydCB7IERyb3Bkb3duTWVudSwgRHJvcGRvd25NZW51Q29udGVudCwgRHJvcGRvd25NZW51SXRlbSwgRHJvcGRvd25NZW51VHJpZ2dlciwgRHJvcGRvd25NZW51U2VwYXJhdG9yIH0gZnJvbSAnQC9jb21wb25lbnRzL3VpL2Ryb3Bkb3duLW1lbnUnO1xuaW1wb3J0IHsgY24gfSBmcm9tICdAL2xpYi91dGlscyc7XG5pbXBvcnQgeyB1c2VTZWxlY3RlZENoaWxkIH0gZnJvbSAnQC9jb250ZXh0cy9TZWxlY3RlZENoaWxkQ29udGV4dCc7XG5cblxuY29uc3QgbmF2SXRlbXMgPSBbXG4gIHsgcGF0aDogJy9wYXJlbnQnLCBsYWJlbDogJ+amguiniCcsIGljb246IExheW91dERhc2hib2FyZCB9LFxuICB7IHBhdGg6ICcvcGFyZW50L3Rhc2tzJywgbGFiZWw6ICfku7vliqEnLCBpY29uOiBMaXN0VG9kbyB9LFxuICB7IHBhdGg6ICcvcGFyZW50L3BsYW5zJywgbGFiZWw6ICforqHliJInLCBpY29uOiBDYWxlbmRhckRheXMgfSxcbiAgeyBwYXRoOiAnL3BhcmVudC9saWJyYXJ5JywgbGFiZWw6ICflm77kuabppoYnLCBpY29uOiBMaWJyYXJ5IH0sXG4gIHsgcGF0aDogJy9wYXJlbnQvcmVhZGluZycsIGxhYmVsOiAn6ZiF6K+7JywgaWNvbjogQm9va09wZW4gfSxcbiAgeyBwYXRoOiAnL3BhcmVudC9hY2hpZXZlbWVudHMnLCBsYWJlbDogJ+aIkOWwsScsIGljb246IFRyb3BoeSB9LFxuICB7IHBhdGg6ICcvcGFyZW50L3N0YXRpc3RpY3MnLCBsYWJlbDogJ+aVsOaNricsIGljb246IEJhckNoYXJ0MyB9LFxuICB7IHBhdGg6ICcvcGFyZW50L3NldHRpbmdzJywgbGFiZWw6ICforr7nva4nLCBpY29uOiBTZXR0aW5ncyB9LFxuXTtcblxuY29uc3Qgc2lkZWJhclZhcmlhbnRzID0ge1xuICBjbG9zZWQ6IHsgeDogJy0xMDAlJywgb3BhY2l0eTogMCB9LFxuICBvcGVuOiB7IHg6IDAsIG9wYWNpdHk6IDEgfVxufTtcblxuY29uc3Qgb3ZlcmxheVZhcmlhbnRzID0ge1xuICBjbG9zZWQ6IHsgb3BhY2l0eTogMCB9LFxuICBvcGVuOiB7IG9wYWNpdHk6IDEgfVxufTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gUGFyZW50TGF5b3V0KCkge1xuICBjb25zdCBbc2lkZWJhck9wZW4sIHNldFNpZGViYXJPcGVuXSA9IHVzZVN0YXRlKGZhbHNlKTtcbiAgY29uc3QgW3NpZGViYXJDb2xsYXBzZWQsIHNldFNpZGViYXJDb2xsYXBzZWRdID0gdXNlU3RhdGUodHJ1ZSk7XG4gIGNvbnN0IHsgdXNlciwgbG9nb3V0LCBpc0F1dGhlbnRpY2F0ZWQsIGlzSW5pdGlhbGl6aW5nIH0gPSB1c2VBdXRoKCk7XG4gIGNvbnN0IHsgY2hpbGRyZW4sIHNlbGVjdGVkQ2hpbGQsIHNlbGVjdENoaWxkLCBpc0xvYWRpbmcgfSA9IHVzZVNlbGVjdGVkQ2hpbGQoKTtcbiAgY29uc3QgbmF2aWdhdGUgPSB1c2VOYXZpZ2F0ZSgpO1xuICBjb25zdCBsb2NhdGlvbiA9IHVzZUxvY2F0aW9uKCk7XG5cbiAgLy8g6Lev55Sx5a6I5Y2r77ya5pyq55m75b2V5pe26Lez6L2s5Yiw55m75b2V6aG177yM5a2p5a2Q55So5oi36Lez6L2s5Yiw5a2p5a2Q6aG16Z2iXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKCFpc0luaXRpYWxpemluZyAmJiAhaXNBdXRoZW50aWNhdGVkKSB7XG4gICAgICBuYXZpZ2F0ZSgnL2xvZ2luJywgeyByZXBsYWNlOiB0cnVlLCBzdGF0ZTogeyBmcm9tOiBsb2NhdGlvbiB9IH0pO1xuICAgIH0gZWxzZSBpZiAoIWlzSW5pdGlhbGl6aW5nICYmIGlzQXV0aGVudGljYXRlZCAmJiB1c2VyPy5yb2xlICE9PSAncGFyZW50Jykge1xuICAgICAgLy8g5a2p5a2Q55So5oi36K6/6Zeu5a626ZW/6aG16Z2i77yM6YeN5a6a5ZCR5Yiw5a2p5a2Q6aaW6aG1XG4gICAgICBuYXZpZ2F0ZSgnL2NoaWxkJywgeyByZXBsYWNlOiB0cnVlIH0pO1xuICAgIH1cbiAgfSwgW2lzSW5pdGlhbGl6aW5nLCBpc0F1dGhlbnRpY2F0ZWQsIHVzZXIsIG5hdmlnYXRlLCBsb2NhdGlvbl0pO1xuXG4gIC8vIOWIneWni+WMluS4reaYvuekuuWKoOi9veeKtuaAge+8jOmBv+WFjeWtkOe7hOS7tuiuv+mXruacquWumuS5ieaVsOaNrlxuICBpZiAoaXNJbml0aWFsaXppbmcpIHtcbiAgICBjb25zb2xlLmxvZygnW0xheW91dF0gSW5pdGlhbGl6aW5nLi4uJyk7XG4gICAgcmV0dXJuIChcbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwibWluLWgtc2NyZWVuIGJnLVsjRjVGNUY3XSBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlclwiPlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggZmxleC1jb2wgaXRlbXMtY2VudGVyIGdhcC00XCI+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ3LTEyIGgtMTIgcm91bmRlZC0yeGwgYmctZ3JhZGllbnQtdG8tYnIgZnJvbS1wdXJwbGUtNTAwIHRvLWJsdWUtNTAwIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHRleHQtd2hpdGUgZm9udC1ib2xkIHRleHQteGwgc2hhZG93LWxnIHNoYWRvdy1wdXJwbGUtNTAwLzI1IGFuaW1hdGUtcHVsc2VcIj5cbiAgICAgICAgICAgIPCfkJtcbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LWdyYXktNTAwXCI+5Yqg6L295LitLi4uPC9wPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICk7XG4gIH1cblxuICAvLyDmnKrnmbvlvZXkuI3muLLmn5Pku7vkvZXlhoXlrrnvvIjkvJrnlLF1c2VFZmZlY3Tph43lrprlkJHvvIlcbiAgaWYgKCFpc0F1dGhlbnRpY2F0ZWQpIHtcbiAgICBjb25zb2xlLmxvZygnW0xheW91dF0gTm90IGF1dGhlbnRpY2F0ZWQsIHJlbmRlcmluZyBudWxsJyk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zb2xlLmxvZygnW0xheW91dF0gUmVuZGVyaW5nIHdpdGggdXNlcjonLCB1c2VyPy5uYW1lLCAnZmFtaWx5Q29kZTonLCB1c2VyPy5mYW1pbHlDb2RlKTtcblxuICBjb25zdCBoYW5kbGVMb2dvdXQgPSAoKSA9PiB7XG4gICAgbG9nb3V0KCk7XG4gICAgbmF2aWdhdGUoJy9sb2dpbicpO1xuICB9O1xuXG4gIGNvbnN0IGNsb3NlU2lkZWJhciA9ICgpID0+IHNldFNpZGViYXJPcGVuKGZhbHNlKTtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3NOYW1lPVwibWluLWgtc2NyZWVuIGJnLWJhY2tncm91bmRcIj5cbiAgICAgIHsvKiBCYWNrZ3JvdW5kIGRlY29yYXRpb24gKi99XG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImZpeGVkIGluc2V0LTAgb3ZlcmZsb3ctaGlkZGVuIHBvaW50ZXItZXZlbnRzLW5vbmVcIj5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJhYnNvbHV0ZSAtdG9wLTQwIC1yaWdodC00MCB3LTk2IGgtOTYgYmctZ3JhZGllbnQtdG8tYnIgZnJvbS1wcmltYXJ5LzUgdG8tcHJpbWFyeS8xMCByb3VuZGVkLWZ1bGwgYmx1ci0zeGxcIiAvPlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImFic29sdXRlIC1ib3R0b20tNDAgLWxlZnQtNDAgdy05NiBoLTk2IGJnLWdyYWRpZW50LXRvLXRyIGZyb20tcHJpbWFyeS81IHRvLXByaW1hcnkvMTAgcm91bmRlZC1mdWxsIGJsdXItM3hsXCIgLz5cbiAgICAgIDwvZGl2PlxuXG4gICAgICB7LyogR2xvYmFsIEhlYWRlciAqL31cbiAgICAgIDxoZWFkZXIgY2xhc3NOYW1lPVwiZml4ZWQgdG9wLTAgbGVmdC0wIHJpZ2h0LTAgei01MCBiZy13aGl0ZSBib3JkZXItYiBib3JkZXItYm9yZGVyIHNoYWRvdy1zbSBoLTE2XCI+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIGgtZnVsbCBweC02XCI+XG4gICAgICAgICAgey8qIExlZnQ6IEJyYW5kICsgTmF2aWdhdGlvbiArIENoaWxkIFRhYnMgKi99XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtNFwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlclwiPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInctOCBoLTggcm91bmRlZC1sZyBiZy1wcmltYXJ5IGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHRleHQtd2hpdGUgZm9udC1ib2xkIHRleHQtc20gc2hhZG93LW1kXCI+XG4gICAgICAgICAgICAgICAg6LajXG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8aDEgY2xhc3NOYW1lPVwibWwtMiBmb250LXNlbWlib2xkIHRleHQtZm9yZWdyb3VuZCB0ZXh0LWJhc2VcIj7otqPlrabkvLQ8L2gxPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8bmF2IGNsYXNzTmFtZT1cImhpZGRlbiBtZDpmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMiBtbC02XCI+XG4gICAgICAgICAgICAgIHtuYXZJdGVtcy5tYXAoKGl0ZW0pID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBpc0FjdGl2ZSA9IGl0ZW0ucGF0aCA9PT0gJy9wYXJlbnQnXG4gICAgICAgICAgICAgICAgICA/IGxvY2F0aW9uLnBhdGhuYW1lID09PSAnL3BhcmVudCdcbiAgICAgICAgICAgICAgICAgIDogbG9jYXRpb24ucGF0aG5hbWUgPT09IGl0ZW0ucGF0aCB8fCBsb2NhdGlvbi5wYXRobmFtZS5zdGFydHNXaXRoKGAke2l0ZW0ucGF0aH0vYCk7XG4gICAgICAgICAgICAgICAgY29uc3QgSWNvbiA9IGl0ZW0uaWNvbjtcbiAgICAgICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgICAgPE5hdkxpbmtcbiAgICAgICAgICAgICAgICAgICAga2V5PXtpdGVtLnBhdGh9XG4gICAgICAgICAgICAgICAgICAgIHRvPXtpdGVtLnBhdGh9XG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17Y24oXG4gICAgICAgICAgICAgICAgICAgICAgJ2ZsZXggaXRlbXMtY2VudGVyIGdhcC0yIHB4LTMgcHktMiByb3VuZGVkLWxnIHRleHQtc20gZm9udC1tZWRpdW0gdHJhbnNpdGlvbi1hbGwgZHVyYXRpb24tMjAwIGdyb3VwJyxcbiAgICAgICAgICAgICAgICAgICAgICBpc0FjdGl2ZVxuICAgICAgICAgICAgICAgICAgICAgICAgPyAnYmctcHJpbWFyeSB0ZXh0LXdoaXRlIHNoYWRvdy1zbSdcbiAgICAgICAgICAgICAgICAgICAgICAgIDogJ3RleHQtZm9yZWdyb3VuZCBob3ZlcjpiZy1tdXRlZCdcbiAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9e2NuKFxuICAgICAgICAgICAgICAgICAgICAgICd3LTcgaC03IHJvdW5kZWQgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgdHJhbnNpdGlvbi1hbGwgZHVyYXRpb24tMjAwJyxcbiAgICAgICAgICAgICAgICAgICAgICBpc0FjdGl2ZSA/ICdiZy13aGl0ZS8yMCcgOiAnYmctbXV0ZWQgZ3JvdXAtaG92ZXI6YmctbXV0ZWQvNTAnXG4gICAgICAgICAgICAgICAgICAgICl9PlxuICAgICAgICAgICAgICAgICAgICAgIDxJY29uIGNsYXNzTmFtZT17Y24oXG4gICAgICAgICAgICAgICAgICAgICAgICAnc2l6ZS00IHRyYW5zaXRpb24tdHJhbnNmb3JtIGR1cmF0aW9uLTIwMCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBpc0FjdGl2ZSA/ICcnIDogJ2dyb3VwLWhvdmVyOnNjYWxlLTEwNSdcbiAgICAgICAgICAgICAgICAgICAgICApfSAvPlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1zbSB0cmFuc2l0aW9uLWFsbCBkdXJhdGlvbi0yMDBcIj57aXRlbS5sYWJlbH08L3NwYW4+XG4gICAgICAgICAgICAgICAgICA8L05hdkxpbms+XG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfSl9XG4gICAgICAgICAgICA8L25hdj5cbiAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgIHsvKiBSaWdodDogTm90aWZpY2F0aW9ucyArIENoaWxkIFN3aXRjaGVyICsgVXNlciAqL31cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0zXCI+XG4gICAgICAgICAgICA8QnV0dG9uIHZhcmlhbnQ9XCJnaG9zdFwiIHNpemU9XCJpY29uXCIgY2xhc3NOYW1lPVwidGV4dC1mb3JlZ3JvdW5kIGhvdmVyOmJnLW11dGVkXCI+XG4gICAgICAgICAgICAgIDxCZWxsIGNsYXNzTmFtZT1cInNpemUtNVwiIC8+XG4gICAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgey8qIENoaWxkIFN3aXRjaGVyICovfVxuICAgICAgICAgICAge2NoaWxkcmVuLmxlbmd0aCA+IDAgJiYgKFxuICAgICAgICAgICAgICA8RHJvcGRvd25NZW51PlxuICAgICAgICAgICAgICAgIDxEcm9wZG93bk1lbnVUcmlnZ2VyIGFzQ2hpbGQ+XG4gICAgICAgICAgICAgICAgICA8YnV0dG9uIGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yIHB4LTMgcHktMS41IHJvdW5kZWQtbGcgaG92ZXI6YmctbXV0ZWQgdHJhbnNpdGlvbi1jb2xvcnNcIj5cbiAgICAgICAgICAgICAgICAgICAgPEF2YXRhciBjbGFzc05hbWU9XCJzaXplLTcgcmluZy0yIHJpbmctd2hpdGUgc2hhZG93LXNtXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPEF2YXRhckltYWdlIHNyYz17c2VsZWN0ZWRDaGlsZD8uYXZhdGFyfSAvPlxuICAgICAgICAgICAgICAgICAgICAgIDxBdmF0YXJGYWxsYmFjayBjbGFzc05hbWU9XCJiZy1ncmFkaWVudC10by1iciBmcm9tLXB1cnBsZS01MDAgdG8tYmx1ZS01MDAgdGV4dC13aGl0ZSB0ZXh0LXhzIGZvbnQtbWVkaXVtXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICB7c2VsZWN0ZWRDaGlsZD8ubmFtZT8uY2hhckF0KDApIHx8ICdDJ31cbiAgICAgICAgICAgICAgICAgICAgICA8L0F2YXRhckZhbGxiYWNrPlxuICAgICAgICAgICAgICAgICAgICA8L0F2YXRhcj5cbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1zbSBmb250LW1lZGl1bSB0ZXh0LWZvcmVncm91bmRcIj57c2VsZWN0ZWRDaGlsZD8ubmFtZSB8fCAn6YCJ5oup5a2p5a2QJ308L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgIDxDaGV2cm9uRG93biBjbGFzc05hbWU9XCJzaXplLTQgdGV4dC1ncmF5LTQwMFwiIC8+XG4gICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICA8L0Ryb3Bkb3duTWVudVRyaWdnZXI+XG4gICAgICAgICAgICAgICAgPERyb3Bkb3duTWVudUNvbnRlbnQgYWxpZ249XCJlbmRcIiBjbGFzc05hbWU9XCJ3LTU2IGJvcmRlciBib3JkZXItYm9yZGVyIHJvdW5kZWQtbGcgc2hhZG93LWxnIHAtMVwiPlxuICAgICAgICAgICAgICAgICAgey8qIENoaWxkIExpc3QgKi99XG4gICAgICAgICAgICAgICAgICB7Y2hpbGRyZW4ubWFwKChjaGlsZCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpc1NlbGVjdGVkID0gc2VsZWN0ZWRDaGlsZD8uaWQgPT09IGNoaWxkLmlkO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgICAgICAgIDxEcm9wZG93bk1lbnVJdGVtIFxuICAgICAgICAgICAgICAgICAgICAgICAga2V5PXtjaGlsZC5pZH0gXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2NuKFxuICAgICAgICAgICAgICAgICAgICAgICAgICBcImN1cnNvci1wb2ludGVyIHJvdW5kZWQtbWQgaG92ZXI6YmctbXV0ZWQgdHJhbnNpdGlvbi1jb2xvcnNcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgaXNTZWxlY3RlZCAmJiBcImJnLXByaW1hcnkvMTAgdGV4dC1wcmltYXJ5XCJcbiAgICAgICAgICAgICAgICAgICAgICAgICl9IFxuICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2VsZWN0Q2hpbGQoY2hpbGQuaWQpfVxuICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxBdmF0YXIgY2xhc3NOYW1lPVwic2l6ZS01IG1yLTJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPEF2YXRhckltYWdlIHNyYz17Y2hpbGQuYXZhdGFyfSAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8QXZhdGFyRmFsbGJhY2sgY2xhc3NOYW1lPVwiYmctZ3JhZGllbnQtdG8tYnIgZnJvbS1wdXJwbGUtNTAwIHRvLWJsdWUtNTAwIHRleHQtd2hpdGUgdGV4dC14c1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtjaGlsZC5uYW1lPy5jaGFyQXQoMCkgfHwgJ0MnfVxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L0F2YXRhckZhbGxiYWNrPlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9BdmF0YXI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8c3Bhbj57Y2hpbGQubmFtZX08L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgPC9Ecm9wZG93bk1lbnVJdGVtPlxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgfSl9XG4gICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgIDxEcm9wZG93bk1lbnVTZXBhcmF0b3IgY2xhc3NOYW1lPVwibXktMVwiIC8+XG4gICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgIHsvKiBNYW5hZ2UgQ2hpbGRyZW4gKi99XG4gICAgICAgICAgICAgICAgICA8RHJvcGRvd25NZW51SXRlbSBcbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiY3Vyc29yLXBvaW50ZXIgcm91bmRlZC1tZCBob3ZlcjpiZy1tdXRlZCB0cmFuc2l0aW9uLWNvbG9yc1wiIFxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBuYXZpZ2F0ZSgnL3BhcmVudC9zZXR0aW5ncycpfVxuICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICA8VXNlcnMgY2xhc3NOYW1lPVwic2l6ZS00IG1yLTJcIiAvPlxuICAgICAgICAgICAgICAgICAgICA8c3Bhbj7nrqHnkIblranlrZDigKY8L3NwYW4+XG4gICAgICAgICAgICAgICAgICA8L0Ryb3Bkb3duTWVudUl0ZW0+XG4gICAgICAgICAgICAgICAgPC9Ecm9wZG93bk1lbnVDb250ZW50PlxuICAgICAgICAgICAgICA8L0Ryb3Bkb3duTWVudT5cbiAgICAgICAgICAgICl9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHsvKiBVc2VyIE1lbnUgKi99XG4gICAgICAgICAgICA8RHJvcGRvd25NZW51PlxuICAgICAgICAgICAgICA8RHJvcGRvd25NZW51VHJpZ2dlciBhc0NoaWxkPlxuICAgICAgICAgICAgICAgIDxidXR0b24gY2xhc3NOYW1lPVwicC0xIHJvdW5kZWQtbGcgaG92ZXI6YmctbXV0ZWQgdHJhbnNpdGlvbi1jb2xvcnNcIj5cbiAgICAgICAgICAgICAgICAgIDxBdmF0YXIgY2xhc3NOYW1lPVwic2l6ZS04IHJpbmctMiByaW5nLXdoaXRlIHNoYWRvdy1zbVwiPlxuICAgICAgICAgICAgICAgICAgICA8QXZhdGFySW1hZ2Ugc3JjPXt1c2VyPy5hdmF0YXJ9IC8+XG4gICAgICAgICAgICAgICAgICAgIDxBdmF0YXJGYWxsYmFjayBjbGFzc05hbWU9XCJiZy1ncmFkaWVudC10by1iciBmcm9tLXB1cnBsZS01MDAgdG8tYmx1ZS01MDAgdGV4dC13aGl0ZSB0ZXh0LXNtIGZvbnQtbWVkaXVtXCI+XG4gICAgICAgICAgICAgICAgICAgICAge3VzZXI/Lm5hbWU/LmNoYXJBdCgwKSB8fCAnUCd9XG4gICAgICAgICAgICAgICAgICAgIDwvQXZhdGFyRmFsbGJhY2s+XG4gICAgICAgICAgICAgICAgICA8L0F2YXRhcj5cbiAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgPC9Ecm9wZG93bk1lbnVUcmlnZ2VyPlxuICAgICAgICAgICAgICA8RHJvcGRvd25NZW51Q29udGVudCBhbGlnbj1cImVuZFwiIGNsYXNzTmFtZT1cInctNDggYm9yZGVyIGJvcmRlci1ib3JkZXIgcm91bmRlZC1sZyBzaGFkb3ctbGcgcC0xXCI+XG4gICAgICAgICAgICAgICAgPERyb3Bkb3duTWVudUl0ZW0gY2xhc3NOYW1lPVwiY3Vyc29yLXBvaW50ZXIgdGV4dC1kZXN0cnVjdGl2ZSByb3VuZGVkLW1kIGhvdmVyOmJnLW11dGVkIHRyYW5zaXRpb24tY29sb3JzXCIgb25DbGljaz17aGFuZGxlTG9nb3V0fT5cbiAgICAgICAgICAgICAgICAgIDxMb2dPdXQgY2xhc3NOYW1lPVwic2l6ZS00IG1yLTJcIiAvPlxuICAgICAgICAgICAgICAgICAgPHNwYW4+6YCA5Ye655m75b2VPC9zcGFuPlxuICAgICAgICAgICAgICAgIDwvRHJvcGRvd25NZW51SXRlbT5cbiAgICAgICAgICAgICAgPC9Ecm9wZG93bk1lbnVDb250ZW50PlxuICAgICAgICAgICAgPC9Ecm9wZG93bk1lbnU+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9oZWFkZXI+XG5cbiAgICAgIHsvKiBNb2JpbGUgSGVhZGVyICovfVxuICAgICAgPGhlYWRlciBjbGFzc05hbWU9XCJsZzpoaWRkZW4gZml4ZWQgdG9wLTE2IGxlZnQtMCByaWdodC0wIHotNDAgYmctd2hpdGUgYm9yZGVyLWIgYm9yZGVyLWJvcmRlclwiPlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBoLTEyIHB4LTVcIj5cbiAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICB2YXJpYW50PVwiZ2hvc3RcIlxuICAgICAgICAgICAgc2l6ZT1cImljb25cIlxuICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0U2lkZWJhck9wZW4odHJ1ZSl9XG4gICAgICAgICAgICBjbGFzc05hbWU9XCJ0ZXh0LWZvcmVncm91bmQgaG92ZXI6YmctbXV0ZWRcIlxuICAgICAgICAgID5cbiAgICAgICAgICAgIDxNZW51IGNsYXNzTmFtZT1cInNpemUtNVwiIC8+XG4gICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgICAgPGgxIGNsYXNzTmFtZT1cImZvbnQtc2VtaWJvbGQgdGV4dC1mb3JlZ3JvdW5kIHRleHQtYmFzZVwiPui2o+WtpuS8tDwvaDE+XG4gICAgICAgICAgPEJ1dHRvbiB2YXJpYW50PVwiZ2hvc3RcIiBzaXplPVwiaWNvblwiIGNsYXNzTmFtZT1cInRleHQtZm9yZWdyb3VuZCBob3ZlcjpiZy1tdXRlZFwiPlxuICAgICAgICAgICAgPEJlbGwgY2xhc3NOYW1lPVwic2l6ZS01XCIgLz5cbiAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2hlYWRlcj5cblxuICAgICAgey8qIE1vYmlsZSBTaWRlYmFyIE92ZXJsYXkgKi99XG4gICAgICA8QW5pbWF0ZVByZXNlbmNlPlxuICAgICAgICB7c2lkZWJhck9wZW4gJiYgKFxuICAgICAgICAgIDw+XG4gICAgICAgICAgICA8bW90aW9uLmRpdlxuICAgICAgICAgICAgICB2YXJpYW50cz17b3ZlcmxheVZhcmlhbnRzfVxuICAgICAgICAgICAgICBpbml0aWFsPVwiY2xvc2VkXCJcbiAgICAgICAgICAgICAgYW5pbWF0ZT1cIm9wZW5cIlxuICAgICAgICAgICAgICBleGl0PVwiY2xvc2VkXCJcbiAgICAgICAgICAgICAgdHJhbnNpdGlvbj17eyBkdXJhdGlvbjogMC4yIH19XG4gICAgICAgICAgICAgIGNsYXNzTmFtZT1cImxnOmhpZGRlbiBmaXhlZCBpbnNldC0wIHotNTAgYmctYmxhY2svMzAgYmFja2Ryb3AtYmx1ci1zbVwiXG4gICAgICAgICAgICAgIG9uQ2xpY2s9e2Nsb3NlU2lkZWJhcn1cbiAgICAgICAgICAgIC8+XG4gICAgICAgICAgICA8bW90aW9uLmFzaWRlXG4gICAgICAgICAgICAgIHZhcmlhbnRzPXtzaWRlYmFyVmFyaWFudHN9XG4gICAgICAgICAgICAgIGluaXRpYWw9XCJjbG9zZWRcIlxuICAgICAgICAgICAgICBhbmltYXRlPVwib3BlblwiXG4gICAgICAgICAgICAgIGV4aXQ9XCJjbG9zZWRcIlxuICAgICAgICAgICAgICB0cmFuc2l0aW9uPXt7IHR5cGU6ICdzcHJpbmcnLCBkYW1waW5nOiAyNSwgc3RpZmZuZXNzOiAzMDAgfX1cbiAgICAgICAgICAgICAgY2xhc3NOYW1lPVwibGc6aGlkZGVuIGZpeGVkIGxlZnQtMCB0b3AtMCBib3R0b20tMCB6LTUwIHctNzIgYmctd2hpdGUgc2hhZG93LTJ4bFwiXG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIDxTaWRlYmFyQ29udGVudCBcbiAgICAgICAgICAgICAgICB1c2VyPXt1c2VyfSBcbiAgICAgICAgICAgICAgICBvbkxvZ291dD17aGFuZGxlTG9nb3V0fSBcbiAgICAgICAgICAgICAgICBvbkNsb3NlPXtjbG9zZVNpZGViYXJ9XG4gICAgICAgICAgICAgICAgY3VycmVudFBhdGg9e2xvY2F0aW9uLnBhdGhuYW1lfVxuICAgICAgICAgICAgICAgIHNlbGVjdGVkQ2hpbGQ9e3NlbGVjdGVkQ2hpbGR9XG4gICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICA8L21vdGlvbi5hc2lkZT5cbiAgICAgICAgICA8Lz5cbiAgICAgICAgKX1cbiAgICAgIDwvQW5pbWF0ZVByZXNlbmNlPlxuXG4gICAgICB7LyogRGVza3RvcCBMYXlvdXQgKi99XG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImhpZGRlbiBsZzpmbGV4IG1pbi1oLXNjcmVlbiByZWxhdGl2ZSB6LTEwIHB0LTE2XCI+XG4gICAgICAgIHsvKiBEZXNrdG9wIFNpZGViYXIgKi99XG4gICAgICAgIHshc2lkZWJhckNvbGxhcHNlZCAmJiAoXG4gICAgICAgICAgPGFzaWRlIGNsYXNzTmFtZT1cInctNTYgYmctd2hpdGUgYm9yZGVyLXIgYm9yZGVyLWJvcmRlciBmbGV4IGZsZXgtY29sIGgtc2NyZWVuIHN0aWNreSB0b3AtMTYgdHJhbnNpdGlvbi1hbGwgZHVyYXRpb24tMzAwXCI+XG4gICAgICAgICAgICA8U2lkZWJhckNvbnRlbnQgXG4gICAgICAgICAgICAgIHVzZXI9e3VzZXJ9IFxuICAgICAgICAgICAgICBvbkxvZ291dD17aGFuZGxlTG9nb3V0fVxuICAgICAgICAgICAgICBjdXJyZW50UGF0aD17bG9jYXRpb24ucGF0aG5hbWV9XG4gICAgICAgICAgICAgIHNlbGVjdGVkQ2hpbGQ9e3NlbGVjdGVkQ2hpbGR9XG4gICAgICAgICAgICAvPlxuICAgICAgICAgIDwvYXNpZGU+XG4gICAgICAgICl9XG5cbiAgICAgICAgey8qIE1haW4gQ29udGVudCAqL31cbiAgICAgICAgPG1haW4gY2xhc3NOYW1lPVwiZmxleC0xIG1pbi1oLXNjcmVlbiBvdmVyZmxvdy1hdXRvIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTMwMFwiPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicC02XCI+XG4gICAgICAgICAgICA8T3V0bGV0IC8+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvbWFpbj5cbiAgICAgIDwvZGl2PlxuXG4gICAgICB7LyogTW9iaWxlIE1haW4gQ29udGVudCAqL31cbiAgICAgIDxtYWluIGNsYXNzTmFtZT1cImxnOmhpZGRlbiBwdC0yOCBtaW4taC1zY3JlZW4gb3ZlcmZsb3ctYXV0byByZWxhdGl2ZSB6LTEwXCI+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicC01XCI+XG4gICAgICAgICAgPE91dGxldCAvPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvbWFpbj5cblxuXG4gICAgPC9kaXY+XG4gICk7XG59XG5cbmludGVyZmFjZSBTaWRlYmFyQ29udGVudFByb3BzIHtcbiAgdXNlcjogYW55O1xuICBvbkxvZ291dDogKCkgPT4gdm9pZDtcbiAgb25DbG9zZT86ICgpID0+IHZvaWQ7XG4gIGN1cnJlbnRQYXRoOiBzdHJpbmc7XG4gIHNlbGVjdGVkQ2hpbGQ/OiBhbnk7XG59XG5cbmZ1bmN0aW9uIFNpZGViYXJDb250ZW50KHsgdXNlciwgb25Mb2dvdXQsIG9uQ2xvc2UsIGN1cnJlbnRQYXRoLCBzZWxlY3RlZENoaWxkIH06IFNpZGViYXJDb250ZW50UHJvcHMpIHtcbiAgcmV0dXJuIChcbiAgICA8PlxuICAgICAgey8qIEhlYWRlciAqL31cbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwicC00XCI+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuXCI+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlclwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ3LTggaC04IHJvdW5kZWQtbGcgYmctcHJpbWFyeSBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciB0ZXh0LXdoaXRlIGZvbnQtYm9sZCB0ZXh0LXNtIHNoYWRvdy1tZFwiPlxuICAgICAgICAgICAgICDotqNcbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtbC0yXCI+XG4gICAgICAgICAgICAgIDxoMSBjbGFzc05hbWU9XCJmb250LWJvbGQgdGV4dC1mb3JlZ3JvdW5kIHRleHQtYmFzZVwiPui2o+WtpuS8tDwvaDE+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgIDwvZGl2PlxuXG4gICAgICB7LyogTmF2aWdhdGlvbiAqL31cbiAgICAgIDxTY3JvbGxBcmVhIGNsYXNzTmFtZT1cImZsZXgtMSBweC0zXCI+XG4gICAgICAgIDxuYXYgY2xhc3NOYW1lPVwic3BhY2UteS0xLjVcIj5cbiAgICAgICAgICB7bmF2SXRlbXMuZmlsdGVyKGl0ZW0gPT4gaXRlbS5wYXRoICE9PSAnL3BhcmVudC9zZXR0aW5ncycpLm1hcCgoaXRlbSkgPT4ge1xuICAgICAgICAgICAgLy8g5a+55LqO5qaC6KeIKC9wYXJlbnQp77yM5Y+q57K+56Gu5Yy56YWN77yM5LiN5Yy56YWN5a2Q6Lev5b6EXG4gICAgICAgICAgICAvLyDlr7nkuo7lhbbku5bot6/lvoTvvIzljLnphY3lvZPliY3ot6/lvoTmiJbku6Xor6Xot6/lvoTlvIDlpLTnmoTlrZDot6/lvoRcbiAgICAgICAgICAgIGNvbnN0IGlzQWN0aXZlID0gaXRlbS5wYXRoID09PSAnL3BhcmVudCdcbiAgICAgICAgICAgICAgPyBjdXJyZW50UGF0aCA9PT0gJy9wYXJlbnQnXG4gICAgICAgICAgICAgIDogY3VycmVudFBhdGggPT09IGl0ZW0ucGF0aCB8fCBjdXJyZW50UGF0aC5zdGFydHNXaXRoKGAke2l0ZW0ucGF0aH0vYCk7XG4gICAgICAgICAgICBjb25zdCBJY29uID0gaXRlbS5pY29uO1xuICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgPE5hdkxpbmtcbiAgICAgICAgICAgICAgICBrZXk9e2l0ZW0ucGF0aH1cbiAgICAgICAgICAgICAgICB0bz17aXRlbS5wYXRofVxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9e29uQ2xvc2UgJiYgKCgpID0+IG9uQ2xvc2UoKSl9XG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPXtjbihcbiAgICAgICAgICAgICAgICAgICdmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMyBweC0zIHB5LTIuNSByb3VuZGVkLWxnIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTIwMCBncm91cCcsXG4gICAgICAgICAgICAgICAgICBpc0FjdGl2ZVxuICAgICAgICAgICAgICAgICAgICA/ICdiZy1wcmltYXJ5IHRleHQtd2hpdGUgZm9udC1tZWRpdW0gc2hhZG93LXNtJ1xuICAgICAgICAgICAgICAgICAgICA6ICd0ZXh0LWZvcmVncm91bmQgaG92ZXI6YmctbXV0ZWQgaG92ZXI6dGV4dC1mb3JlZ3JvdW5kJ1xuICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT17Y24oXG4gICAgICAgICAgICAgICAgICAndy03IGgtNyByb3VuZGVkIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTIwMCcsXG4gICAgICAgICAgICAgICAgICBpc0FjdGl2ZSA/ICdiZy13aGl0ZS8yMCcgOiAnYmctbXV0ZWQgZ3JvdXAtaG92ZXI6YmctbXV0ZWQvNTAnXG4gICAgICAgICAgICAgICAgKX0+XG4gICAgICAgICAgICAgICAgICA8SWNvbiBjbGFzc05hbWU9e2NuKFxuICAgICAgICAgICAgICAgICAgICAnc2l6ZS00IHRyYW5zaXRpb24tdHJhbnNmb3JtIGR1cmF0aW9uLTIwMCcsXG4gICAgICAgICAgICAgICAgICAgIGlzQWN0aXZlID8gJycgOiAnZ3JvdXAtaG92ZXI6c2NhbGUtMTA1J1xuICAgICAgICAgICAgICAgICAgKX0gLz5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXNtIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTIwMFwiPntpdGVtLmxhYmVsfTwvc3Bhbj5cbiAgICAgICAgICAgICAgPC9OYXZMaW5rPlxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9KX1cbiAgICAgICAgPC9uYXY+XG4gICAgICA8L1Njcm9sbEFyZWE+XG5cbiAgICAgIHsvKiBVc2VyIEluZm8gKi99XG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cInAtMyBib3JkZXItdCBib3JkZXItZ3JheS0yMDAvNTBcIj5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW5cIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0zXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInJlbGF0aXZlXCI+XG4gICAgICAgICAgICAgIDxBdmF0YXIgY2xhc3NOYW1lPVwic2l6ZS0xMCByaW5nLTIgcmluZy13aGl0ZSBzaGFkb3ctc21cIj5cbiAgICAgICAgICAgICAgICA8QXZhdGFySW1hZ2Ugc3JjPXt1c2VyPy5hdmF0YXJ9IC8+XG4gICAgICAgICAgICAgICAgPEF2YXRhckZhbGxiYWNrIGNsYXNzTmFtZT1cImJnLWdyYWRpZW50LXRvLWJyIGZyb20tcHVycGxlLTUwMCB0by1ibHVlLTUwMCB0ZXh0LXdoaXRlIHRleHQtc20gZm9udC1tZWRpdW1cIj5cbiAgICAgICAgICAgICAgICAgIHt1c2VyPy5uYW1lPy5jaGFyQXQoMCkgfHwgJ1AnfVxuICAgICAgICAgICAgICAgIDwvQXZhdGFyRmFsbGJhY2s+XG4gICAgICAgICAgICAgIDwvQXZhdGFyPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImFic29sdXRlIC1ib3R0b20tMC41IC1yaWdodC0wLjUgdy0zLjUgaC0zLjUgYmctZ3JlZW4tNTAwIHJvdW5kZWQtZnVsbCByaW5nLTIgcmluZy13aGl0ZVwiIC8+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cImZvbnQtbWVkaXVtIHRleHQtZ3JheS05MDAgdGV4dC1zbVwiPnt1c2VyPy5uYW1lIHx8ICflrrbplb8nfTwvcD5cbiAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LWdyYXktNTAwXCI+5Zyo57q/PC9wPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPERyb3Bkb3duTWVudT5cbiAgICAgICAgICAgIDxEcm9wZG93bk1lbnVUcmlnZ2VyIGFzQ2hpbGQ+XG4gICAgICAgICAgICAgIDxidXR0b24gY2xhc3NOYW1lPVwicC0xIHJvdW5kZWQteGwgaG92ZXI6YmctZ3JheS0xMDAgdHJhbnNpdGlvbi1hbGxcIj5cbiAgICAgICAgICAgICAgICA8Q2hldnJvbkRvd24gY2xhc3NOYW1lPVwic2l6ZS00IHRleHQtZ3JheS00MDBcIiAvPlxuICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgIDwvRHJvcGRvd25NZW51VHJpZ2dlcj5cbiAgICAgICAgICAgIDxEcm9wZG93bk1lbnVDb250ZW50IGFsaWduPVwiZW5kXCIgY2xhc3NOYW1lPVwidy00OFwiPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInAtMiBib3JkZXItYiBib3JkZXItZ3JheS0xMDBcIj5cbiAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJmb250LW1lZGl1bSB0ZXh0LWdyYXktOTAwIHRleHQtc21cIj57dXNlcj8ubmFtZSB8fCAn5a626ZW/J308L3A+XG4gICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LWdyYXktNTAwXCI+5Zyo57q/PC9wPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPERyb3Bkb3duTWVudUl0ZW0gY2xhc3NOYW1lPVwiY3Vyc29yLXBvaW50ZXJcIj5cbiAgICAgICAgICAgICAgICA8U2V0dGluZ3MgY2xhc3NOYW1lPVwic2l6ZS00IG1yLTJcIiAvPlxuICAgICAgICAgICAgICAgIDxzcGFuPuiuvue9rjwvc3Bhbj5cbiAgICAgICAgICAgICAgPC9Ecm9wZG93bk1lbnVJdGVtPlxuICAgICAgICAgICAgICA8RHJvcGRvd25NZW51SXRlbSBjbGFzc05hbWU9XCJjdXJzb3ItcG9pbnRlciB0ZXh0LXJlZC02MDBcIiBvbkNsaWNrPXtvbkxvZ291dH0+XG4gICAgICAgICAgICAgICAgPExvZ091dCBjbGFzc05hbWU9XCJzaXplLTQgbXItMlwiIC8+XG4gICAgICAgICAgICAgICAgPHNwYW4+6YCA5Ye655m75b2VPC9zcGFuPlxuICAgICAgICAgICAgICA8L0Ryb3Bkb3duTWVudUl0ZW0+XG4gICAgICAgICAgICA8L0Ryb3Bkb3duTWVudUNvbnRlbnQ+XG4gICAgICAgICAgPC9Ecm9wZG93bk1lbnU+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC8+XG4gICk7XG59XG4iXSwibmFtZXMiOlsidXNlU3RhdGUiLCJ1c2VFZmZlY3QiLCJOYXZMaW5rIiwiT3V0bGV0IiwidXNlTmF2aWdhdGUiLCJ1c2VMb2NhdGlvbiIsIm1vdGlvbiIsIkFuaW1hdGVQcmVzZW5jZSIsIkxheW91dERhc2hib2FyZCIsIkxpc3RUb2RvIiwiQ2FsZW5kYXJEYXlzIiwiTGlicmFyeSIsIkJvb2tPcGVuIiwiVHJvcGh5IiwiVXNlcnMiLCJCYXJDaGFydDMiLCJTZXR0aW5ncyIsIkxvZ091dCIsIk1lbnUiLCJDaGV2cm9uRG93biIsIkJlbGwiLCJ1c2VBdXRoIiwiQnV0dG9uIiwiQXZhdGFyIiwiQXZhdGFyRmFsbGJhY2siLCJBdmF0YXJJbWFnZSIsIlNjcm9sbEFyZWEiLCJEcm9wZG93bk1lbnUiLCJEcm9wZG93bk1lbnVDb250ZW50IiwiRHJvcGRvd25NZW51SXRlbSIsIkRyb3Bkb3duTWVudVRyaWdnZXIiLCJEcm9wZG93bk1lbnVTZXBhcmF0b3IiLCJjbiIsInVzZVNlbGVjdGVkQ2hpbGQiLCJuYXZJdGVtcyIsInBhdGgiLCJsYWJlbCIsImljb24iLCJzaWRlYmFyVmFyaWFudHMiLCJjbG9zZWQiLCJ4Iiwib3BhY2l0eSIsIm9wZW4iLCJvdmVybGF5VmFyaWFudHMiLCJQYXJlbnRMYXlvdXQiLCJzaWRlYmFyT3BlbiIsInNldFNpZGViYXJPcGVuIiwic2lkZWJhckNvbGxhcHNlZCIsInNldFNpZGViYXJDb2xsYXBzZWQiLCJ1c2VyIiwibG9nb3V0IiwiaXNBdXRoZW50aWNhdGVkIiwiaXNJbml0aWFsaXppbmciLCJjaGlsZHJlbiIsInNlbGVjdGVkQ2hpbGQiLCJzZWxlY3RDaGlsZCIsImlzTG9hZGluZyIsIm5hdmlnYXRlIiwibG9jYXRpb24iLCJyZXBsYWNlIiwic3RhdGUiLCJmcm9tIiwicm9sZSIsImNvbnNvbGUiLCJsb2ciLCJkaXYiLCJjbGFzc05hbWUiLCJwIiwibmFtZSIsImZhbWlseUNvZGUiLCJoYW5kbGVMb2dvdXQiLCJjbG9zZVNpZGViYXIiLCJoZWFkZXIiLCJoMSIsIm5hdiIsIm1hcCIsIml0ZW0iLCJpc0FjdGl2ZSIsInBhdGhuYW1lIiwic3RhcnRzV2l0aCIsIkljb24iLCJ0byIsInNwYW4iLCJ2YXJpYW50Iiwic2l6ZSIsImxlbmd0aCIsImFzQ2hpbGQiLCJidXR0b24iLCJzcmMiLCJhdmF0YXIiLCJjaGFyQXQiLCJhbGlnbiIsImNoaWxkIiwiaXNTZWxlY3RlZCIsImlkIiwib25DbGljayIsInZhcmlhbnRzIiwiaW5pdGlhbCIsImFuaW1hdGUiLCJleGl0IiwidHJhbnNpdGlvbiIsImR1cmF0aW9uIiwiYXNpZGUiLCJ0eXBlIiwiZGFtcGluZyIsInN0aWZmbmVzcyIsIlNpZGViYXJDb250ZW50Iiwib25Mb2dvdXQiLCJvbkNsb3NlIiwiY3VycmVudFBhdGgiLCJtYWluIiwiZmlsdGVyIl0sIm1hcHBpbmdzIjoiOztBQUFBLFNBQVNBLFFBQVEsRUFBRUMsU0FBUyxRQUFRLFFBQVE7QUFDNUMsU0FBU0MsT0FBTyxFQUFRQyxNQUFNLEVBQUVDLFdBQVcsRUFBRUMsV0FBVyxRQUFRLG1CQUFtQjtBQUNuRixTQUFTQyxNQUFNLEVBQUVDLGVBQWUsUUFBUSxnQkFBZ0I7QUFDeEQsU0FDRUMsZUFBZSxFQUNmQyxRQUFRLEVBQ1JDLFlBQVksRUFDWkMsT0FBTyxFQUNQQyxRQUFRLEVBQ1JDLE1BQU0sRUFDTkMsS0FBSyxFQUNMQyxTQUFTLEVBQ1RDLFFBQVEsRUFDUkMsTUFBTSxFQUNOQyxJQUFJLEVBRUpDLFdBQVcsRUFDWEMsSUFBSSxRQUdDLGVBQWU7QUFDdEIsU0FBU0MsT0FBTyxRQUFRLGtCQUFrQjtBQUMxQyxTQUFTQyxNQUFNLFFBQVEseUJBQXlC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