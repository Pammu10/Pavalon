import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
  const baseClasses = 'bg-slate-900/40 backdrop-blur-lg border border-slate-700/60 rounded-xl shadow-2xl p-6 transition-all duration-300';
  const clickableClasses = onClick ? 'cursor-pointer hover:border-yellow-500/80 hover:shadow-yellow-500/20' : '';

  return (
    <div className={`${baseClasses} ${clickableClasses} ${className}`} onClick={onClick}>
      {children}
    </div>
  );
};

export default Card;
