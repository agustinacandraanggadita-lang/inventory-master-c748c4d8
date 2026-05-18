import { NavLink, useLocation } from 'react-router-dom';
import { Package, Factory, Truck, FileText, Users, Home, Coffee } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', icon: Home, label: 'Dashboard' },
  { path: '/products', icon: Package, label: 'Produk' },
  { path: '/production', icon: Factory, label: 'Produksi' },
  { path: '/distribution', icon: Truck, label: 'Distribusi' },
  { path: '/canteen', icon: Coffee, label: 'Kantin' },
  { path: '/reports', icon: FileText, label: 'Laporan' },
];

export function MobileNav() {
  const location = useLocation();

  return (
    <nav className="mobile-nav safe-area-bottom">
      <div className="flex justify-around items-center">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn('mobile-nav-item', isActive && 'active')}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
