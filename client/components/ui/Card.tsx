import React from 'react';

// Allow any standard div attributes to be passed, including 'id'.
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ children, className = '', onClick, ...props }) => {
  const baseClasses = 'bg-slate-900/40 backdrop-blur-lg border border-slate-700/60 rounded-xl shadow-2xl p-4 sm:p-6 transition-all duration-300';
  const clickableClasses = onClick ? 'cursor-pointer hover:border-yellow-500/80 hover:shadow-yellow-500/20' : '';

  return (
    <div className={`${baseClasses} ${clickableClasses} ${className}`} onClick={onClick} {...props}>
      {children}
    </div>
  );
};

export default Card;