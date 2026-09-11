"use client";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useSidebar } from "../context/SidebarContext";
import {
  BoxCubeIcon,
  CalenderIcon,
  ChevronDownIcon,
  GridIcon,
  HorizontaLDots,
  ListIcon,
  PageIcon,
  PieChartIcon,
  PlugInIcon,
  TableIcon,
  UserCircleIcon,
  DollarLineIcon,
  BoltIcon
} from "../icons/index";
import SidebarWidget from "./SidebarWidget";
import { isAdminRole, isAccountantRole } from "@/lib/roles";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: {
    name: string;
    path: string;
    pro?: boolean;
    new?: boolean;
    adminOnly?: boolean;
    accountantOnly?: boolean;
    /** P0 S6 HIDE — deferred CMS/marketing surfaces */
    p0Hide?: boolean;
  }[];
  adminOnly?: boolean;
  accountantOnly?: boolean;
  p0Hide?: boolean;
};

const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    subItems: [
      { name: "Overview", path: "/overview", pro: false },
      { name: "Manage Client", path: "/manage-client", pro: false, adminOnly: true },
      { name: "Manage Accountant", path: "/manage-accountant", pro: false, adminOnly: true },
    ],
  },
  {
    icon: <PageIcon />,
    name: "Manage Tax Return",
    subItems: [
      { name: "Tax Return Type", path: "/tax-return-type", pro: false, adminOnly: true, p0Hide: true },
      { name: "Tax Return", path: "/tax-return-list", pro: false, accountantOnly: true },
      { name: "Tax Manager", path: "/manage-tax", pro: false, adminOnly: true },
      { name: "Tax Rates Management", path: "/tax-rates", pro: false, adminOnly: true, p0Hide: true },
    ],
  },
  {
    icon: <PlugInIcon />,
    name: "Notifications",
    path: "/notifications",
  },

  {
    icon: <BoxCubeIcon />,
    name: "Email Templates",
    path: "/email-template",
    adminOnly: true,
    p0Hide: true,
  },
  {
    icon: <ListIcon />,
    name: "Reviews",
    path: "/reviews",
    p0Hide: true, // star-review CMS deferred — case workflow reviews live on case detail
  },
  {
    icon: <UserCircleIcon />,
    name: "User Profile",
    path: "/user-profile",
  },
  {
    icon: <PageIcon />,
    name: "Payment Management",
    subItems: [
      { name: "Transaction History", path: "/manage-payments", pro: false, adminOnly: true },
      { name: "Api Key", path: "/key-management", pro: false, adminOnly: true, p0Hide: true },
      { name: "Transaction Fee Settings", path: "/fee-settings", pro: false, adminOnly: true, p0Hide: true },

    ],
  },
  {
    icon: <ListIcon />,
    name: "Audit Logs",
    path: "/audit-logs",
    adminOnly: true,
    p0Hide: true, // deferred until compat audit-log adapter
  },
];

const othersItems: NavItem[] = [
  {
    icon: <BoltIcon />,
    name: "Page Settings",
    subItems: [
      { name: "Faq Page", path: "/faq-page-settings", pro: false, adminOnly: true },
      { name: "Our Partners", path: "/about-page-settings", pro: false, adminOnly: true, p0Hide: true },
      { name: "Menu Category", path: "/category-menu", pro: false, adminOnly: true, p0Hide: true },
      { name: "Submenu Category", path: "/subcategory-menu", pro: false, adminOnly: true, p0Hide: true },
      { name: "Articles", path: "/article", pro: false, adminOnly: true, p0Hide: true },
      { name: "Services", path: "/service", pro: false, adminOnly: true, p0Hide: true },
      { name: "Subscription Plan", path: "/subscription-plan", pro: false, adminOnly: true, p0Hide: true },
      { name: "Home Page Settings", path: "/home-page-settings", pro: false, adminOnly: true, p0Hide: true },
    ],
  },
  
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const { data: session, status } = useSession();
  const pathname = usePathname();

  // Get user role — SUPER_ADMIN is first-class admin (S1)
  const userRole = session?.user?.role;
  const isAdmin = isAdminRole(userRole);
  const isAccountant = isAccountantRole(userRole);
  // Memoized filter function to prevent recreating on every render
  const filterMenuItems = useCallback((items: NavItem[]) => {
    return items
      .filter(item => {
        if (item.p0Hide) return false;
        // Hide admin-only items for non-admins
        if (item.adminOnly && !isAdmin) {
          return false;
        }

        // Hide accountant-only items for non-accountants
        if (item.accountantOnly && !isAccountant) {
          return false;
        }

        return true;
      })
      .map(item => {
        if (item.subItems) {
          const filteredSubItems = item.subItems.filter(subItem => {
            if (subItem.p0Hide) return false;
            if (subItem.adminOnly && !isAdmin) {
              return false;
            }
            if (subItem.accountantOnly && !isAccountant) {
              return false;
            }
            return true;
          });

          if (filteredSubItems.length > 0) {
            return { ...item, subItems: filteredSubItems };
          }
          return null;
        }
        return item;
      })
      .filter(Boolean) as NavItem[];
  }, [isAdmin, isAccountant]);


  // Get filtered menu items with useMemo to prevent infinite re-renders
  const filteredNavItems = useMemo(() => filterMenuItems(navItems), [filterMenuItems]);
  const filteredOthersItems = useMemo(() => filterMenuItems(othersItems), [filterMenuItems]);

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main" | "others";
    index: number;
  } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>({});
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Memoized isActive function
  // Memoized isActive function
  const isActive = useCallback((path: string) => {
    if (path === '/') return pathname === '/';
    return pathname === path || pathname.startsWith(path + '/');
  }, [pathname]);

  // Memoized event handlers
  const handleSubmenuToggle = useCallback((index: number, menuType: "main" | "others") => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        return null;
      }
      return { type: menuType, index };
    });
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (!isExpanded) {
      setIsHovered(true);
    }
  }, [isExpanded, setIsHovered]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, [setIsHovered]);

  // Fixed useEffect to prevent infinite loops
  useEffect(() => {
    if (status === "loading") return;

    let submenuMatched = false;

    const checkMenuItems = (items: NavItem[], menuType: "main" | "others") => {
      items.forEach((nav, index) => {
        if (nav.subItems && !submenuMatched) {
          nav.subItems.forEach((subItem) => {
            if (pathname === subItem.path || pathname.startsWith(subItem.path + '/')) {
              setOpenSubmenu({
                type: menuType as "main" | "others",
                index,
              });
              submenuMatched = true;
            }
          });
        }
      });
    };

    checkMenuItems(filteredNavItems, "main");
    if (!submenuMatched) {
      checkMenuItems(filteredOthersItems, "others");
    }

    if (!submenuMatched) {
      setOpenSubmenu(null);
    }
  }, [pathname, filteredNavItems, filteredOthersItems, status]);

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prevHeights) => ({
          ...prevHeights,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  // Memoized render function
  const renderMenuItems = useCallback((
    navItems: NavItem[],
    menuType: "main" | "others"
  ) => (
    <ul className="flex flex-col gap-3 ps-0">
      {navItems.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group  ${openSubmenu?.type === menuType && openSubmenu?.index === index
                ? "menu-item-active"
                : "menu-item-inactive"
                } cursor-pointer ${!isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
                }`}
            >
              <span
                className={` ${openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-icon-active"
                  : "menu-item-icon-inactive"
                  }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className={`menu-item-text`}>{nav.name}</span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon
                  className={`ml-auto w-5 h-5 transition-transform duration-200  ${openSubmenu?.type === menuType &&
                    openSubmenu?.index === index
                    ? "rotate-180 text-brand-500"
                    : ""
                    }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                href={nav.path}
                className={`menu-item group ${isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                  }`}
              >
                <span
                  className={`${isActive(nav.path)
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                    }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className={`menu-item-text`}>{nav.name}</span>
                )}
              </Link>
            )
          )}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? `${subMenuHeight[`${menuType}-${index}`]}px`
                    : "0px",
              }}
            >
              <ul className="mt-2 space-y-1 ml-9 ps-0 ms-2 main-menu-dropdown">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.name}>
                    <Link
                      href={subItem.path}
                      className={`menu-dropdown-item ${isActive(subItem.path)
                        ? "menu-dropdown-item-active"
                        : "menu-dropdown-item-inactive"
                        }`}
                    >
                      {subItem.name}
                      <span className="flex items-center gap-1 ml-auto">
                        {subItem.new && (
                          <span
                            className={`ml-auto ${isActive(subItem.path)
                              ? "menu-dropdown-badge-active"
                              : "menu-dropdown-badge-inactive"
                              } menu-dropdown-badge `}
                          >
                            new
                          </span>
                        )}
                        {subItem.pro && (
                          <span
                            className={`ml-auto ${isActive(subItem.path)
                              ? "menu-dropdown-badge-active"
                              : "menu-dropdown-badge-inactive"
                              } menu-dropdown-badge `}
                          >
                            pro
                          </span>
                        )}
                        {subItem.adminOnly && isAdmin && (
                          <span
                            className={`ml-auto ${isActive(subItem.path)
                              ? "menu-dropdown-badge-active"
                              : "menu-dropdown-badge-inactive"
                              } menu-dropdown-badge `}
                          >
                            admin
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  ), [isExpanded, isHovered, isMobileOpen, openSubmenu, subMenuHeight, handleSubmenuToggle, isActive, isAdmin]);

  // Show loading state while session is loading
  if (status === "loading") {
    return (
      <aside className="fixed mt-16 flex flex-col lg:mt-0 top-0 px-4 left-0 bg-white dark:bg-gray-900 w-[90px] h-screen z-50 border-r border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      </aside>
    );
  }

  // Show default menu if no session (shouldn't happen with middleware, but good fallback)
  const showFilteredMenus = session && session.user;

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-4 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${isExpanded || isMobileOpen
          ? "w-[290px]"
          : isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={`py-6 lg:flex hidden  ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-center"
          }`}
      >
        <Link href="/">
          {isExpanded || isHovered || isMobileOpen ? (
            <>
              <Image
                className="dark:hidden"
                src="/images/logo/logo.svg"
                alt="Logo"
                width={150}
                height={40}
              />
              <Image
                className="hidden dark:block dark:invert"
                src="/images/logo/logo.svg"
                alt="Logo"
                width={150}
                height={40}
              />
            </>
          ) : (
            <Image
              src="/images/logo/logo-icon.svg"
              alt="Logo"
              width={32}
              height={32}
            />
          )}
        </Link>
      </div>

      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar mt-4 lg:mt-0">
        <nav className="mb-6">
          <div className="flex flex-col gap-0">
            <div>
              {showFilteredMenus
                ? renderMenuItems(filteredNavItems, "main")
                : renderMenuItems(navItems, "main")
              }
            </div>

            {isAdmin && <div className="">
              {showFilteredMenus
                ? renderMenuItems(filteredOthersItems, "others")
                : renderMenuItems(othersItems, "others")
              }
            </div>}
          </div>
        </nav>

      </div>
    </aside>
  );
};

export default AppSidebar;