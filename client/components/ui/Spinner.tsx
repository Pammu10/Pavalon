import React from 'react';

interface SpinnerProps {
    size?: 'sm' | 'md' | 'lg';
}

const Spinner: React.FC<SpinnerProps> = ({ size = 'md' }) => {
    const sizeClasses = {
        sm: 'w-6 h-6',
        md: 'w-12 h-12',
        lg: 'w-24 h-24',
    };
    return (
        <div className="flex justify-center items-center">
            <div
                className={`${sizeClasses[size]} border-4 border-slate-500 border-t-yellow-600 border-solid rounded-full animate-spin`}
            ></div>
        </div>
    );
};

export default Spinner;
