import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "success" | "fail" | "icon-primary" | "icon-success" | "icon-danger";
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  className = "",
  ...props
}) => {
  const baseClasses =
    "font-eaglelake rounded-lg shadow-lg transform transition-all duration-200 ease-in-out focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:scale-100 [-webkit-tap-highlight-color:transparent]";

  const variantClasses = {
    primary:
      "text-lg font-bold py-3 px-6 bg-yellow-600 text-white hover:bg-yellow-500 active:bg-yellow-700 focus:ring-yellow-500/50 hover:shadow-xl hover:shadow-yellow-500/20 active:scale-95 active:brightness-90",
    secondary:
      "text-lg font-bold py-3 px-6 bg-slate-700 text-slate-200 hover:bg-slate-600 active:bg-slate-800 focus:ring-slate-500/50 hover:shadow-xl hover:shadow-slate-500/10 active:scale-95 active:brightness-90",
    danger:
      "text-lg font-bold py-3 px-6 bg-red-800 text-white hover:bg-red-700 active:bg-red-900 focus:ring-red-600/50 hover:shadow-xl hover:shadow-red-600/20 active:scale-95 active:brightness-90",
    success:
      "text-lg font-bold py-3 px-6 bg-blue-700 text-white hover:bg-blue-600 active:bg-blue-800 focus:ring-blue-500/50 hover:shadow-xl hover:shadow-blue-600/20 active:scale-95 active:brightness-90",
    fail:
      "text-lg font-bold py-3 px-6 bg-red-700 text-white hover:bg-red-600 active:bg-red-800 focus:ring-red-500/50 hover:shadow-xl hover:shadow-red-600/20 active:scale-95 active:brightness-90",
    "icon-primary": "bg-slate-800/60 text-yellow-500 hover:bg-slate-700/80 active:bg-slate-900/80 focus:ring-yellow-500/50 border border-slate-700 hover:border-slate-600",
    "icon-success": "bg-slate-800/60 text-green-500 hover:bg-slate-700/80 active:bg-slate-900/80 focus:ring-green-500/50 border border-slate-700 hover:border-slate-600",
    "icon-danger": "bg-slate-800/60 text-red-500 hover:bg-slate-700/80 active:bg-slate-900/80 focus:ring-red-500/50 border border-slate-700 hover:border-slate-600",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;