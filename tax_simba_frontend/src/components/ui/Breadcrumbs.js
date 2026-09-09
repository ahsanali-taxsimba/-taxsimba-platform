import React from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

export default function Breadcrumbs({ items }) {
    return (
        <nav className="flex items-center space-y-0 text-sm font-medium text-gray-500 mb-6 overflow-x-auto whitespace-nowrap pb-2 md:pb-0">
            <Link
                href="/"
                className="flex items-center hover:text-brand-primary transition-colors gap-1"
            >
                <Home size={14} />
                <span>Home</span>
            </Link>

            {items.map((item, index) => (
                <React.Fragment key={index}>
                    <ChevronRight size={14} className="mx-2 flex-shrink-0" />
                    {item.href ? (
                        <Link
                            href={item.href}
                            className="hover:text-brand-primary transition-colors"
                        >
                            {item.label}
                        </Link>
                    ) : (
                        <span className="text-gray-900 font-semibold">{item.label}</span>
                    )}
                </React.Fragment>
            ))}
        </nav>
    );
}
