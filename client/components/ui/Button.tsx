import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "success" | "fail";
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  className = "",
  ...props
}) => {
  const baseClasses =
    "font-eaglelake text-lg font-bold py-3 px-6 rounded-lg shadow-lg transform transition-all duration-200 ease-in-out focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:scale-100";

  const variantClasses = {
    primary:
      "bg-yellow-600 text-white hover:bg-yellow-500 active:bg-yellow-700 focus:ring-yellow-500/50 hover:shadow-xl hover:shadow-yellow-500/20 active:scale-95",
    secondary:
      "bg-slate-700 text-slate-200 hover:bg-slate-600 active:bg-slate-800 focus:ring-slate-500/50 hover:shadow-xl hover:shadow-slate-500/10 active:scale-95",
    danger:
      "bg-red-800 text-white hover:bg-red-700 active:bg-red-900 focus:ring-red-600/50 hover:shadow-xl hover:shadow-red-600/20 active:scale-95",
    success:
      "bg-blue-700 text-white hover:bg-blue-600 active:bg-blue-800 focus:ring-blue-500/50 hover:shadow-xl hover:shadow-blue-600/20 active:scale-95",
    fail:
      "bg-red-700 text-white hover:bg-red-600 active:bg-red-800 focus:ring-red-500/50 hover:shadow-xl hover:shadow-red-600/20 active:scale-95",
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