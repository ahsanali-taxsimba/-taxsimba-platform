import { Bell } from 'lucide-react'
import React from 'react'

interface Notification {
    read: boolean;
    // Add other properties if needed
}

interface BellButtonProps {
    notifications: Notification[];
}

const BellButton: React.FC<BellButtonProps> = ({ notifications }) => {
    return (
        <>
            <div className="flex items-center space-x-4">
                <div className="relative">
                    <Bell className="h-6 w-6 text-gray-600 cursor-pointer" />
                    {notifications.filter((n:any) => !n.read).length > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                            {notifications.filter((n:any) => !n.read).length}
                        </span>
                    )}
                </div>
            </div>
        </>
    )
}

export default BellButton