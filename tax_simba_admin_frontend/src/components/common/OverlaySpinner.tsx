import React from 'react';

interface OverlaySpinnerProps {
  isLoading: boolean;
  message?: string;
  spinnerSize?: 'small' | 'medium' | 'large';
  backdropOpacity?: number;
}

const OverlaySpinner: React.FC<OverlaySpinnerProps> = ({
  isLoading,
  message = 'Loading...',
  spinnerSize = 'medium',
  backdropOpacity = 0.7,
}) => {
  if (!isLoading) return null;

  const getSizeClasses = () => {
    switch (spinnerSize) {
      case 'small':
        return 'w-8 h-8 border-2';
      case 'large':
        return 'w-16 h-16 border-4';
      default:
        return 'w-12 h-12 border-3';
    }
  };

  return (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center"
      style={{
        backgroundColor: `rgba(0, 0, 0, ${backdropOpacity})`,
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)', // Safari support
      }}
    >
      <div className="bg-transparent flex flex-col items-center space-y-4 max-w-sm mx-4">
       
        <div
          className={`${getSizeClasses()} border-gray-200 border-t-blue-600 rounded-full animate-spin`}
        />
        
        {/* Loading message */}
        {message && (
          <p className="text-gray-200 text-center font-medium">
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

export default OverlaySpinner;